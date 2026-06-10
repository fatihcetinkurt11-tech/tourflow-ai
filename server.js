const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { DatabaseSync } = require("node:sqlite");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const DB_PATH = path.join(DATA_DIR, "tourflow.sqlite");

fs.mkdirSync(DATA_DIR, { recursive: true });

const registeredRoutes = [
  "POST /api/assistant/plan",
  "POST /api/admin/assistant/tours",
  "POST /api/planner",
  "POST /api/leads",
  "GET /api/admin/summary",
  "GET /api/tours",
  "GET /api/tours/:id",
  "PATCH /api/tours/:id/distance",
  "GET /api/tours/:id/documents/:type.pdf",
  "GET /api/cost-rules",
  "POST /api/cost-rules",
  "POST /api/tours",
  "GET /api/participants",
  "POST /api/participants",
  "GET /api/deposits",
  "GET /api/leads",
  "GET /api/leads/:id",
  "POST /api/leads/:id/status",
  "POST /api/leads/:id/convert"
];

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS tours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    destination TEXT NOT NULL,
    start_date TEXT NOT NULL,
    duration_days INTEGER NOT NULL,
    group_size INTEGER NOT NULL,
    status TEXT NOT NULL,
    guide_required INTEGER NOT NULL,
    accommodation TEXT NOT NULL,
    transport TEXT NOT NULL,
    places_json TEXT NOT NULL,
    program_json TEXT NOT NULL,
    transport_cost INTEGER NOT NULL,
    accommodation_cost INTEGER NOT NULL,
    food_cost INTEGER NOT NULL,
    guide_cost INTEGER NOT NULL,
    activity_cost INTEGER NOT NULL,
    margin_rate REAL NOT NULL,
    deposit_per_person INTEGER NOT NULL,
    cost_items_json TEXT,
    sales_price_per_person INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tour_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    people INTEGER NOT NULL,
    deposit_paid INTEGER NOT NULL,
    total_price INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tour_id) REFERENCES tours(id)
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    destination TEXT NOT NULL,
    group_size INTEGER NOT NULL,
    duration_days INTEGER NOT NULL,
    budget INTEGER NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Yeni',
    converted_tour_id INTEGER,
    converted_participant_id INTEGER,
    plan_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cost_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    type TEXT NOT NULL,
    unit TEXT NOT NULL,
    unit_price INTEGER NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn("leads", "status", "TEXT NOT NULL DEFAULT 'Yeni'");
ensureColumn("leads", "converted_tour_id", "INTEGER");
ensureColumn("leads", "converted_participant_id", "INTEGER");
ensureColumn("tours", "cost_items_json", "TEXT");
ensureColumn("tours", "sales_price_per_person", "INTEGER");
ensureColumn("tours", "outbound_km", "INTEGER");
ensureColumn("tours", "return_km", "INTEGER");
ensureColumn("participants", "seat_number", "TEXT NOT NULL DEFAULT ''");
ensureColumn("participants", "notes", "TEXT NOT NULL DEFAULT ''");

const defaultCostRules = [
  { key: "vehicle", label: "Araç", type: "fm_vip_vehicle", unit: "km", unit_price: 10, sort_order: 1 },
  { key: "guide", label: "Rehber", type: "fixed", unit: "tur", unit_price: 6000, sort_order: 2 },
  { key: "insurance", label: "Sigorta", type: "per_person", unit: "kişi", unit_price: 75, sort_order: 3 },
  { key: "photographer", label: "Fotoğrafçı", type: "fixed", unit: "tur", unit_price: 0, sort_order: 4 },
  { key: "boat", label: "Tekne", type: "boat", unit: "tur/kişi", unit_price: 0, sort_order: 5 },
  { key: "hotel", label: "Otel", type: "manual", unit: "manuel", unit_price: 0, sort_order: 6 },
  { key: "other", label: "Diğer", type: "manual", unit: "manuel", unit_price: 0, sort_order: 7 }
];

function seedCostRules() {
  const insert = db.prepare(`
    INSERT INTO cost_rules (key, label, type, unit, unit_price, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      label = excluded.label,
      type = excluded.type,
      unit = excluded.unit,
      unit_price = excluded.unit_price,
      sort_order = excluded.sort_order,
      enabled = 1
  `);
  for (const rule of defaultCostRules) {
    insert.run(rule.key, rule.label, rule.type, rule.unit, rule.unit_price, rule.sort_order);
  }
}

seedCostRules();
db.prepare("UPDATE cost_rules SET enabled = 0 WHERE key IN ('fuel', 'driver', 'activity', 'food')").run();

function getCostRules() {
  return db.prepare("SELECT * FROM cost_rules WHERE enabled = 1 ORDER BY sort_order ASC, id ASC").all().map((rule) => ({
    id: rule.id,
    key: rule.key,
    label: rule.label,
    type: rule.type,
    unit: rule.unit,
    unitPrice: rule.unit_price,
    enabled: Boolean(rule.enabled),
    sortOrder: rule.sort_order
  }));
}

function legacyCostItems(row) {
  return [
    { key: "vehicle", label: "Araç", type: "legacy", quantity: 1, unit: "tur", unitPrice: row.transport_cost, total: row.transport_cost },
    { key: "hotel", label: "Otel", type: "legacy", quantity: 1, unit: "tur", unitPrice: row.accommodation_cost, total: row.accommodation_cost },
    { key: "food", label: "Yemek", type: "legacy", quantity: 1, unit: "tur", unitPrice: row.food_cost, total: row.food_cost },
    { key: "guide", label: "Rehber", type: "legacy", quantity: 1, unit: "tur", unitPrice: row.guide_cost, total: row.guide_cost },
    { key: "activity", label: "Aktivite", type: "legacy", quantity: 1, unit: "tur", unitPrice: row.activity_cost, total: row.activity_cost }
  ];
}

function calculateCostItems(input) {
  const groupSize = Math.max(1, Number(input.groupSize || input.group_size || 1));
  const rawOutboundKm = input.outboundKm ?? input.outbound_km;
  const rawReturnKm = input.returnKm ?? input.return_km;
  const hasDistance = rawOutboundKm !== undefined && rawOutboundKm !== "" && rawReturnKm !== undefined && rawReturnKm !== "";
  const outboundKm = hasDistance ? Math.max(0, Number(rawOutboundKm || 0)) : null;
  const returnKm = hasDistance ? Math.max(0, Number(rawReturnKm || 0)) : null;
  const routeKm = hasDistance ? outboundKm + 10 + returnKm : null;
  const boatPricingType = String(input.boatPricingType || input.boat_pricing_type || "fixed");
  const boatUnitPrice = Math.max(0, Number(input.boatUnitPrice || input.boat_unit_price || 0));
  const hotelCost = Math.max(0, Number(input.hotelCost || input.hotel_cost || 0));
  const otherCost = Math.max(0, Number(input.otherCost || input.other_cost || 0));
  const ruleByKey = Object.fromEntries(getCostRules().map((rule) => [rule.key, rule]));
  const vehicleUnit = ruleByKey.vehicle?.unitPrice || 10;
  const guideTotal = Number(input.guideCost || input.guide_cost || ruleByKey.guide?.unitPrice || 6000);
  const insuranceUnit = Number(input.insurancePerPerson || input.insurance_per_person || ruleByKey.insurance?.unitPrice || 75);
  const photographerTotal = ruleByKey.photographer?.unitPrice ?? 0;
  const boatQuantity = boatPricingType === "per_person" ? groupSize : (boatUnitPrice > 0 ? 1 : 0);
  const boatTotal = boatPricingType === "per_person" ? groupSize * boatUnitPrice : boatUnitPrice;
  const items = [
    {
      key: "vehicle",
      label: "Araç",
      type: "fm_vip_vehicle",
      quantity: routeKm || 0,
      unit: "km formülü",
      unitPrice: vehicleUnit * 3,
      total: hasDistance ? Math.round(routeKm * vehicleUnit * 3) : 0,
      formula: hasDistance ? `(${outboundKm} + 10 + ${returnKm}) x ${vehicleUnit} x 3` : "Kilometre bilgisi eksik",
      warning: hasDistance ? "" : "Kilometre bilgisi eksik, lütfen Google Maps üzerinden gidiş ve dönüş km girin."
    },
    { key: "guide", label: "Rehber", type: "fixed", quantity: 1, unit: "tur", unitPrice: guideTotal, total: guideTotal },
    { key: "insurance", label: "Sigorta", type: "per_person", quantity: groupSize, unit: "kişi", unitPrice: insuranceUnit, total: groupSize * insuranceUnit },
    { key: "boat", label: "Tekne", type: boatPricingType, quantity: boatQuantity, unit: boatPricingType === "per_person" ? "kişi" : "tur", unitPrice: boatUnitPrice, total: boatTotal },
    { key: "hotel", label: "Otel", type: "manual", quantity: hotelCost > 0 ? 1 : 0, unit: "manuel", unitPrice: hotelCost, total: hotelCost },
    { key: "other", label: "Diğer", type: "manual", quantity: otherCost + photographerTotal > 0 ? 1 : 0, unit: "manuel", unitPrice: otherCost + photographerTotal, total: otherCost + photographerTotal }
  ];
  return {
    outboundKm,
    returnKm,
    routeKm,
    distanceMissing: !hasDistance,
    warning: hasDistance ? "" : "Kilometre bilgisi eksik, lütfen Google Maps üzerinden gidiş ve dönüş km girin.",
    items
  };
}

function calculateTotals(row) {
  const costItems = row.cost_items_json ? parseJson(row.cost_items_json, legacyCostItems(row)) : legacyCostItems(row);
  const baseCost = costItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const explicitPrice = Number(row.sales_price_per_person || 0);
  const pricePerPerson = explicitPrice > 0 ? explicitPrice : Math.ceil((baseCost + Math.round(baseCost * row.margin_rate)) / row.group_size / 50) * 50;
  const salesTotal = pricePerPerson * row.group_size;
  const profit = salesTotal - baseCost;
  const costPerPerson = Math.ceil(baseCost / row.group_size / 50) * 50;
  return { baseCost, costPerPerson, profit, netProfit: profit, salesTotal, pricePerPerson, costItems };
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapTour(row) {
  return {
    id: row.id,
    title: row.title,
    destination: row.destination,
    startDate: row.start_date,
    durationDays: row.duration_days,
    groupSize: row.group_size,
    status: row.status,
    guideRequired: Boolean(row.guide_required),
    accommodation: row.accommodation,
    transport: row.transport,
    places: parseJson(row.places_json, []),
    program: parseJson(row.program_json, []),
    costs: {
      transport: row.transport_cost,
      accommodation: row.accommodation_cost,
      food: row.food_cost,
      guide: row.guide_cost,
      activities: row.activity_cost,
      marginRate: row.margin_rate
    },
    depositPerPerson: row.deposit_per_person,
    outboundKm: row.outbound_km,
    returnKm: row.return_km,
    totals: calculateTotals(row)
  };
}

const destinationProfiles = [
  {
    match: ["trabzon"],
    style: "Karadeniz doğa ve yayla rotası",
    places: ["Sümela Manastırı", "Uzungöl", "Atatürk Köşkü", "Çal Mağarası", "Boztepe", "Hıdırnebi Yaylası"],
    accommodation: "Trabzon merkezde ulaşımı kolay otel ve Uzungöl/yayla hattında kahvaltı dahil butik konaklama önerilir.",
    transport: "Havalimanı transferi, yayla yolları için şoförlü özel araç ve grup büyüklüğüne göre minibüs önerilir.",
    dailyThemes: ["şehir merkezi ve manzara noktaları", "Sümela ve Zigana hattı", "Uzungöl ve yayla rotası", "mağara, yöresel alışveriş ve dönüş"],
    guideThreshold: 6,
    costs: { transport: 950, accommodation: 2200, food: 520, activity: 700, guideDaily: 3800, marginRate: 0.22 }
  },
  {
    match: ["kapadokya", "cappadocia"],
    style: "vadi, balon ve kültür rotası",
    places: ["Göreme Açık Hava Müzesi", "Paşabağ", "Avanos", "Uçhisar Kalesi", "Kızıl Vadi", "Derinkuyu Yeraltı Şehri"],
    accommodation: "Göreme, Uçhisar veya Ortahisar'da taş otel; balon izleme noktalarına yakın konum önerilir.",
    transport: "Kayseri/Nevşehir transferi, vadiler arası özel araç ve yoğun günlerde rehberli rota önerilir.",
    dailyThemes: ["Göreme ve gün batımı vadileri", "balon izleme, müze ve Avanos", "yeraltı şehri ve Uçhisar", "fotoğraf noktaları ve dönüş"],
    guideThreshold: 4,
    costs: { transport: 800, accommodation: 2600, food: 560, activity: 1250, guideDaily: 4200, marginRate: 0.24 }
  },
  {
    match: ["halfeti"],
    style: "Fırat kıyısı ve tekne rotası",
    places: ["Savaşan Köyü", "Rumkale", "Halfeti Tekne Turu", "Fırat Nehri", "Eski Halfeti Sokakları", "Birecik Kelaynak Merkezi"],
    accommodation: "Halfeti veya Şanlıurfa merkezde butik otel; tekne turu saatlerine göre konum seçimi önerilir.",
    transport: "Gaziantep veya Şanlıurfa çıkışlı özel araç, Halfeti içinde tekne turu ve kısa yürüyüş rotası önerilir.",
    dailyThemes: ["Halfeti sokakları ve Fırat kıyısı", "tekne turu, Rumkale ve Savaşan Köyü", "Birecik veya Şanlıurfa bağlantılı dönüş"],
    guideThreshold: 8,
    costs: { transport: 780, accommodation: 1750, food: 470, activity: 650, guideDaily: 3200, marginRate: 0.21 }
  },
  {
    match: ["arsuz"],
    style: "Akdeniz sahil ve gastronomi rotası",
    places: ["Arsuz Sahili", "Madenli Koyu", "Karaağaç Plajı", "İskenderun Sahili", "Titus Tüneli", "Beşikli Mağara"],
    accommodation: "Arsuz sahil hattında denize yakın butik otel veya apart konaklama; aile grupları için geniş oda önerilir.",
    transport: "Hatay/Adana bağlantılı transfer, sahil durakları için özel araç ve esnek mola planı önerilir.",
    dailyThemes: ["Arsuz sahili ve gün batımı", "koylar, plaj molaları ve İskenderun", "Titus Tüneli, mağara rotası ve gastronomi"],
    guideThreshold: 10,
    costs: { transport: 720, accommodation: 1900, food: 620, activity: 500, guideDaily: 3000, marginRate: 0.2 }
  }
];

function getDestinationProfile(destination) {
  const key = destination.toLocaleLowerCase("tr-TR");
  return destinationProfiles.find((profile) => profile.match.some((term) => key.includes(term))) || {
    match: [],
    style: `${destination} keşif rotası`,
    places: [
      `${destination} merkez`,
      `${destination} tarihi bölge`,
      `${destination} manzara noktası`,
      `${destination} yerel pazar`,
      `${destination} doğa rotası`,
      `${destination} gastronomi durağı`
    ],
    accommodation: `${destination} merkezde ulaşımı kolay, kahvaltı dahil butik veya 3-4 yıldızlı otel önerilir.`,
    transport: `${destination} için varış noktasına göre transfer, şehir içi özel araç ve esnek mola planı önerilir.`,
    dailyThemes: [`${destination} merkez keşfi`, "tarihi ve kültürel duraklar", "doğa/manzara rotası", "yerel pazar ve dönüş"],
    guideThreshold: 8,
    costs: { transport: 760, accommodation: 1850, food: 500, activity: 550, guideDaily: 3200, marginRate: 0.21 }
  };
}

function buildPlan(input) {
  const destination = String(input.destination || "Yeni Rota").trim();
  const groupSize = Math.max(1, Number(input.groupSize || input.group_size || 2));
  const durationDays = Math.max(1, Number(input.durationDays || input.duration_days || 3));
  const budget = Math.max(1000, Number(input.budget || 9000));
  const profile = getDestinationProfile(destination);
  const guideRequired = groupSize >= profile.guideThreshold || durationDays >= 3;
  const costEngine = calculateCostItems({ ...input, destination, groupSize, durationDays, guideRequired });
  const baseCost = costEngine.items.reduce((sum, item) => sum + item.total, 0);
  const explicitPrice = Number(input.salesPricePerPerson || input.sales_price_per_person || 0);
  const calculatedSalesTotal = baseCost + Math.round(baseCost * profile.costs.marginRate);
  const pricePerPerson = explicitPrice > 0 ? explicitPrice : Math.ceil(calculatedSalesTotal / groupSize / 50) * 50;
  const salesTotal = pricePerPerson * groupSize;
  const profit = salesTotal - baseCost;
  const costPerPerson = Math.ceil(baseCost / groupSize / 50) * 50;
  const plan = Array.from({ length: durationDays }, (_, index) => {
    const theme = profile.dailyThemes[index % profile.dailyThemes.length];
    const primary = profile.places[index % profile.places.length];
    const secondary = profile.places[(index + 1) % profile.places.length];
    if (index === 0) return `1. gün: ${destination} varış, ${theme}, ${primary} ve yerel lezzet molası.`;
    if (index === durationDays - 1) return `${index + 1}. gün: ${theme}, ${primary}, ${secondary} ve dönüş hazırlığı.`;
    return `${index + 1}. gün: ${theme}, ${primary}, ${secondary} ve serbest zaman.`;
  });

  return {
    destination,
    groupSize,
    durationDays,
    budget,
    title: `${destination} ${durationDays} Günlük ${profile.style}`,
    plan,
    places: profile.places,
    estimatedCost: { baseCost, costPerPerson, profit, netProfit: profit, salesTotal, pricePerPerson },
    costItems: costEngine.items,
    distance: {
      outboundKm: costEngine.outboundKm,
      returnKm: costEngine.returnKm,
      routeKm: costEngine.routeKm,
      missing: costEngine.distanceMissing,
      warning: costEngine.warning
    },
    accommodation: profile.accommodation,
    transport: profile.transport,
    guideRequired,
    whatsappMessage: `Merhaba, ${destination} için ${durationDays} günlük dinamik gezi planınızı hazırladık. Rotada ${profile.places.slice(0, 3).join(", ")} var. Kişi başı tahmini ücret ${pricePerPerson.toLocaleString("tr-TR")} TL.`,
    depositMessage: `Rezervasyonu netleştirmek için kişi başı ${Math.min(3000, Math.round(pricePerPerson * 0.3)).toLocaleString("tr-TR")} TL kapora ile konaklama ve ulaşım opsiyonunu sabitleyebiliriz.`
  };
}

function parseNaturalTripRequest(message) {
  const text = String(message || "").trim();
  const lower = text.toLocaleLowerCase("tr-TR");
  const knownDestinations = ["Trabzon", "Kapadokya", "Halfeti", "Arsuz", "Rize", "Kahramanmaraş", "Gaziantep", "Şanlıurfa", "Antalya", "Mardin"];
  const originMatch = text.match(/^(.{2,60}?)\s*(?:çıkışlı|cikisli|çıkış|cikis|Ã§Ä±k|Ã§ikis)/i);
  const origin = originMatch ? originMatch[1].trim() : "";
  const peopleMatch = lower.match(/(\d+)\s*(?:kişilik|kisilik|kişi|kisi)/);
  const dayMatch = lower.match(/(\d+)\s*(?:günlük|gunluk|gün|gun)/);
  const budgetMatch = lower.match(/(\d[\d. ]*)\s*(?:tl|₺|lira)/);
  const destinationFromKnown = knownDestinations.find((name) => lower.includes(name.toLocaleLowerCase("tr-TR")) && name !== origin);
  const destinationMatch = text.match(/(?:tur|gezi|program)\s+(?:oluştur|olustur|hazırla|hazirla).*?\b([A-Za-zÇĞİÖŞÜçğıöşü]+)\b/i);
  const destination = destinationFromKnown || destinationMatch?.[1] || text.replace(originMatch?.[0] || "", "").split(/\s+/).find((word) => word.length > 3) || "Yeni Rota";
  const durationDays = lower.includes("günübirlik") || lower.includes("gunubirlik") || lower.includes("birlik")
    ? 1
    : Math.max(1, Number(dayMatch?.[1] || 3));
  const groupSize = Math.max(1, Number(peopleMatch?.[1] || 2));
  const budget = budgetMatch ? Number(budgetMatch[1].replace(/[. ]/g, "")) : 9000;

  return { message: text, origin, destination, groupSize, durationDays, budget };
}

function buildAssistantResponse(payload) {
  const parsed = parseNaturalTripRequest(payload.message);
  const plan = buildPlan(parsed);
  const originText = parsed.origin ? `${parsed.origin} çıkışlı ` : "";
  return {
    ...plan,
    origin: parsed.origin,
    sourceMessage: parsed.message,
    assistantSummary: `${originText}${plan.groupSize} kişilik ${plan.destination} için ${plan.durationDays} günlük tur taslağı hazırlandı.`,
    whatsappMessage: `Merhaba, ${originText}${plan.destination} turu için ${plan.durationDays} günlük program hazır. Rotada ${plan.places.slice(0, 4).join(", ")} var. Kişi başı tahmini ücret ${plan.estimatedCost.pricePerPerson.toLocaleString("tr-TR")} TL. Detayları paylaşabilirim.`,
    depositMessage: `Rezervasyonu netleştirmek için kişi başı ${Math.min(3000, Math.round(plan.estimatedCost.pricePerPerson * 0.3)).toLocaleString("tr-TR")} TL kapora alıyoruz. Kapora sonrası ulaşım ve konaklama opsiyonunu sabitliyoruz.`
  };
}

function removeStaticDemoData() {
  const staticTours = db.prepare(`
    SELECT id FROM tours
    WHERE (destination = 'Trabzon' AND status = 'Teklif hazir')
       OR (destination = 'Kapadokya' AND status = 'Kapora bekleniyor')
  `).all();
  for (const tour of staticTours) {
    db.prepare("DELETE FROM participants WHERE tour_id = ?").run(tour.id);
    db.prepare("DELETE FROM tours WHERE id = ?").run(tour.id);
  }
}

removeStaticDemoData();

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function pdfSafe(value) {
  const repaired = String(value ?? "")
    .replaceAll("Ä°", "İ")
    .replaceAll("Ä±", "ı")
    .replaceAll("Åž", "Ş")
    .replaceAll("ÅŸ", "ş")
    .replaceAll("Äž", "Ğ")
    .replaceAll("ÄŸ", "ğ")
    .replaceAll("Ã‡", "Ç")
    .replaceAll("Ã§", "ç")
    .replaceAll("Ã–", "Ö")
    .replaceAll("Ã¶", "ö")
    .replaceAll("Ãœ", "Ü")
    .replaceAll("Ã¼", "ü");
  const turkishCodes = {
    "Ğ": 128,
    "ğ": 129,
    "İ": 130,
    "ı": 131,
    "Ş": 132,
    "ş": 133,
    "Ç": 134,
    "ç": 135,
    "Ö": 136,
    "ö": 137,
    "Ü": 138,
    "ü": 139
  };
  return repaired
    .replace(/[ĞğİıŞşÇçÖöÜü]/g, (char) => String.fromCharCode(turkishCodes[char]))
    .replace(/[^\x20-\x8B]/g, "")
    .replace(/[()\\]/g, "\\$&");
}

function sendPdf(res, filename, title, lines) {
  const chunks = [];
  let y = 800;
  chunks.push("BT");
  chunks.push("/F1 18 Tf");
  chunks.push(`1 0 0 1 50 ${y} Tm (${pdfSafe(title)}) Tj`);
  y -= 34;
  chunks.push("/F1 11 Tf");
  for (const line of lines) {
    if (y < 60) break;
    chunks.push(`1 0 0 1 50 ${y} Tm (${pdfSafe(line)}) Tj`);
    y -= 18;
  }
  chunks.push("ET");
  const stream = chunks.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding << /Type /Encoding /Differences [128 /Gbreve /gbreve /Idotaccent /dotlessi /Scedilla /scedilla /Ccedilla /ccedilla /Odieresis /odieresis /Udieresis /udieresis] >> >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += `${object}\n`;
  }
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const buffer = Buffer.from(body, "binary");
  res.writeHead(200, {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": buffer.length
  });
  res.end(buffer);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function getTours() {
  return db.prepare("SELECT * FROM tours ORDER BY created_at DESC, id DESC").all().map(mapTour);
}

function getTourById(id) {
  const tour = db.prepare("SELECT * FROM tours WHERE id = ?").get(Number(id));
  return tour ? mapTour(tour) : null;
}

function updateTourDistance(id, payload) {
  const row = db.prepare("SELECT * FROM tours WHERE id = ?").get(Number(id));
  if (!row) return null;

  const outboundKm = payload.outboundKm ?? payload.outbound_km;
  const returnKm = payload.returnKm ?? payload.return_km;
  if (outboundKm === undefined || outboundKm === "" || returnKm === undefined || returnKm === "") {
    throw new Error("Kilometre bilgisi eksik, lütfen Google Maps üzerinden gidiş ve dönüş km girin.");
  }

  const existingItems = row.cost_items_json ? parseJson(row.cost_items_json, legacyCostItems(row)) : legacyCostItems(row);
  const itemByKey = Object.fromEntries(existingItems.map((item) => [item.key, item]));
  const boat = itemByKey.boat || {};
  const hotel = itemByKey.hotel || {};
  const other = itemByKey.other || {};
  const guide = itemByKey.guide || {};
  const insurance = itemByKey.insurance || {};
  const recalculated = calculateCostItems({
    group_size: row.group_size,
    outbound_km: outboundKm,
    return_km: returnKm,
    guide_cost: Number(guide.total || row.guide_cost || 6000),
    insurance_per_person: Number(insurance.unitPrice || 75),
    boat_pricing_type: boat.type || "fixed",
    boat_unit_price: Number(boat.unitPrice || boat.total || 0),
    hotel_cost: Number(hotel.total || row.accommodation_cost || 0),
    other_cost: Number(other.total || 0)
  });
  const costByKey = Object.fromEntries(recalculated.items.map((item) => [item.key, item.total]));

  db.prepare(`
    UPDATE tours
    SET outbound_km = ?,
        return_km = ?,
        transport_cost = ?,
        accommodation_cost = ?,
        food_cost = ?,
        guide_cost = ?,
        activity_cost = ?,
        cost_items_json = ?
    WHERE id = ?
  `).run(
    Number(recalculated.outboundKm),
    Number(recalculated.returnKm),
    Number(costByKey.vehicle || 0),
    Number(costByKey.hotel || 0),
    Number(costByKey.food || 0),
    Number(costByKey.guide || 0),
    Number(costByKey.boat || 0) + Number(costByKey.insurance || 0),
    JSON.stringify(recalculated.items),
    Number(id)
  );

  return getTourById(id);
}

function getParticipants() {
  return db.prepare(`
    SELECT p.*, t.title AS tour_title, t.deposit_per_person
    FROM participants p
    JOIN tours t ON t.id = p.tour_id
    ORDER BY p.created_at DESC, p.id DESC
  `).all();
}

function paymentStatus(depositPaid, totalPrice) {
  if (depositPaid <= 0) return "Ödeme yok";
  if (depositPaid >= totalPrice) return "Ödeme tamamlandı";
  return "Kısmi ödeme";
}

function mapParticipant(row) {
  const depositPaid = Number(row.deposit_paid || 0);
  const totalPrice = Number(row.total_price || 0);
  const remainingPayment = Math.max(totalPrice - depositPaid, 0);
  return {
    id: row.id,
    tourId: row.tour_id,
    tourTitle: row.tour_title,
    name: row.name,
    phone: row.phone,
    email: row.email,
    people: row.people,
    depositPaid,
    totalPrice,
    remainingPayment,
    seatNumber: row.seat_number || "",
    notes: row.notes || "",
    status: paymentStatus(depositPaid, totalPrice)
  };
}

function documentLines(type, tour, participantRows, participantId) {
  const participants = participantRows.map(mapParticipant);
  const participant = participantId
    ? participants.find((item) => Number(item.id) === Number(participantId))
    : participants[0];
  if ((type === "registration" || type === "deposit") && !participant) {
    throw new Error("Participant not found");
  }

  if (type === "registration") {
    return {
      title: "TUR KAYIT VE KATILIM ONAY BELGESİ",
      filename: `tur-kayit-${tour.id}-${participant.id}.pdf`,
      lines: [
        `Ad Soyad: ${participant.name}`,
        `Telefon: ${participant.phone}`,
        `Tur Adı: ${tour.title}`,
        `Tur Tarihi: ${tour.startDate}`,
        `Toplam Ücret: ${participant.totalPrice.toLocaleString("tr-TR")} TL`,
        `Kapora: ${participant.depositPaid.toLocaleString("tr-TR")} TL`,
        `Kalan Ödeme: ${participant.remainingPayment.toLocaleString("tr-TR")} TL`
      ]
    };
  }

  if (type === "deposit") {
    return {
      title: "Kapora Belgesi",
      filename: `kapora-${tour.id}-${participant.id}.pdf`,
      lines: [
        `Ad Soyad: ${participant.name}`,
        `Kapora Tutarı: ${participant.depositPaid.toLocaleString("tr-TR")} TL`,
        `Tarih: ${new Date().toLocaleDateString("tr-TR")}`,
        `Tur Adı: ${tour.title}`
      ]
    };
  }

  if (type === "participants") {
    return {
      title: "Katilimci Listesi",
      filename: `katilimci-listesi-${tour.id}.pdf`,
      lines: [
        `Tur Adı: ${tour.title}`,
        `Tur Tarihi: ${tour.startDate}`,
        "",
        ...participants.map((item) => `${item.seatNumber || "-"} | ${item.name} | ${item.phone} | Kapora: ${item.depositPaid.toLocaleString("tr-TR")} TL | Kalan: ${item.remainingPayment.toLocaleString("tr-TR")} TL | ${item.status}`)
      ]
    };
  }

  if (type === "program") {
    return {
      title: "Tur Programi",
      filename: `tur-programi-${tour.id}.pdf`,
      lines: [
        `Tur Adı: ${tour.title}`,
        "",
        "Program:",
        ...tour.program.map((day, index) => `${index + 1}. ${day}`),
        "",
        "Gezilecek Yerler:",
        ...tour.places.map((place) => `- ${place}`),
        "",
        "Saatler:",
        "08:00 Hareket ve bulusma",
        "10:30 Rota uzeri mola",
        "12:30 Oglen programi",
        "16:30 Serbest zaman ve donus hazirligi",
        "",
        "Dahil Olanlar:",
        "Ulasim, zorunlu sigorta, planlanan program akisi ve operasyon takibi"
      ]
    };
  }

  throw new Error("Invalid document type");
}

function createTourFromPlan(plan, options = {}) {
  if (!plan.distance || plan.distance.missing || plan.distance.outboundKm === null || plan.distance.returnKm === null) {
    throw new Error("Kilometre bilgisi eksik, lütfen Google Maps üzerinden gidiş ve dönüş km girin.");
  }
  const stmt = db.prepare(`
    INSERT INTO tours (
      title, destination, start_date, duration_days, group_size, status, guide_required,
      accommodation, transport, places_json, program_json, transport_cost,
      accommodation_cost, food_cost, guide_cost, activity_cost, margin_rate, deposit_per_person, cost_items_json,
      sales_price_per_person, outbound_km, return_km
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const deposit = Math.min(3000, Math.round(plan.estimatedCost.pricePerPerson * 0.3));
  const costItems = plan.costItems || calculateCostItems(plan).items;
  const costByKey = Object.fromEntries(costItems.map((item) => [item.key, item.total]));
  const transportCost = Number(costByKey.vehicle || 0) + Number(costByKey.fuel || 0) + Number(costByKey.driver || 0);
  const accommodationCost = Number(costByKey.hotel || 0);
  const foodCost = Number(costByKey.food || 0);
  const guideCost = Number(costByKey.guide || 0);
  const activityCost = Number(costByKey.activity || 0) + Number(costByKey.boat || 0) + Number(costByKey.insurance || 0);
  const result = stmt.run(
    options.title || plan.title,
    plan.destination,
    options.startDate || new Date().toISOString().slice(0, 10),
    plan.durationDays,
    plan.groupSize,
    options.status || "AI taslak",
    plan.guideRequired ? 1 : 0,
    plan.accommodation,
    plan.transport,
    JSON.stringify(plan.places),
    JSON.stringify(plan.plan),
    transportCost,
    accommodationCost,
    foodCost,
    guideCost,
    activityCost,
    0.22,
    deposit,
    JSON.stringify(costItems),
    Number(plan.estimatedCost.pricePerPerson || 0),
    Number(plan.distance.outboundKm),
    Number(plan.distance.returnKm)
  );
  return mapTour(db.prepare("SELECT * FROM tours WHERE id = ?").get(result.lastInsertRowid));
}

function mapLead(lead) {
  return {
    id: lead.id,
    destination: lead.destination,
    groupSize: lead.group_size,
    durationDays: lead.duration_days,
    budget: lead.budget,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    status: lead.status || "Yeni",
    convertedTourId: lead.converted_tour_id,
    convertedParticipantId: lead.converted_participant_id,
    plan: parseJson(lead.plan_json, null),
    createdAt: lead.created_at
  };
}

function getLeads() {
  return db.prepare("SELECT * FROM leads ORDER BY created_at DESC, id DESC").all().map(mapLead);
}

function getLeadById(id) {
  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(Number(id));
  return lead ? mapLead(lead) : null;
}

async function handleApi(req, res, pathname) {
  const documentMatch = pathname.match(/^\/api\/tours\/(\d+)\/documents\/([a-z-]+)\.pdf$/);
  if (req.method === "GET" && documentMatch) {
    const tour = getTourById(documentMatch[1]);
    if (!tour) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }
    try {
      const participantRows = getParticipants().filter((row) => Number(row.tour_id) === Number(tour.id));
      const url = new URL(req.url, `http://${req.headers.host}`);
      const document = documentLines(documentMatch[2], tour, participantRows, url.searchParams.get("participantId"));
      sendPdf(res, document.filename, document.title, document.lines);
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/assistant/plan") {
    sendJson(res, 200, buildAssistantResponse(await readBody(req)));
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/assistant/tours") {
    const assistantPlan = buildAssistantResponse(await readBody(req));
    if (!assistantPlan.distance || assistantPlan.distance.missing) {
      sendJson(res, 200, {
        tour: null,
        assistantPlan,
        requiresDistance: true,
        missingFields: ["Gidiş km", "Dönüş km"],
        message: assistantPlan.distance?.warning || "Kilometre bilgisi eksik, lütfen Google Maps üzerinden gidiş ve dönüş km girin."
      });
      return;
    }
    const tour = createTourFromPlan(assistantPlan, {
      title: `${assistantPlan.origin ? `${assistantPlan.origin} Çıkışlı ` : ""}${assistantPlan.destination} AI Turu`,
      status: "AI ile oluşturuldu"
    });
    sendJson(res, 201, { tour, assistantPlan });
    return;
  }

  if (req.method === "POST" && pathname === "/api/planner") {
    sendJson(res, 200, buildPlan(await readBody(req)));
    return;
  }

  if (req.method === "POST" && pathname === "/api/leads") {
    const payload = await readBody(req);
    const plan = buildPlan(payload);
    const stmt = db.prepare(`
      INSERT INTO leads (destination, group_size, duration_days, budget, name, phone, email, status, plan_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      plan.destination,
      plan.groupSize,
      plan.durationDays,
      plan.budget,
      String(payload.name || "").trim(),
      String(payload.phone || "").trim(),
      String(payload.email || "").trim(),
      "Yeni",
      JSON.stringify(plan)
    );
    sendJson(res, 201, { id: result.lastInsertRowid, ...plan });
    return;
  }

  if (req.method === "GET" && pathname === "/api/admin/summary") {
    const tours = getTours();
    const participants = getParticipants();
    const leads = db.prepare("SELECT COUNT(*) AS count FROM leads").get().count;
    const profit = tours.reduce((sum, tour) => sum + tour.totals.profit, 0);
    const openDeposits = participants.filter((row) => row.deposit_paid < row.deposit_per_person * row.people).length;
    sendJson(res, 200, { tours: tours.length, participants: participants.length, leads, openDeposits, profit });
    return;
  }

  if (req.method === "GET" && pathname === "/api/tours") {
    sendJson(res, 200, getTours());
    return;
  }

  const tourDetailMatch = pathname.match(/^\/api\/tours\/(\d+)$/);
  if (req.method === "GET" && tourDetailMatch) {
    const tour = getTourById(tourDetailMatch[1]);
    if (!tour) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }
    sendJson(res, 200, tour);
    return;
  }

  const tourDistanceMatch = pathname.match(/^\/api\/tours\/(\d+)\/distance$/);
  if (req.method === "PATCH" && tourDistanceMatch) {
    try {
      const tour = updateTourDistance(tourDistanceMatch[1], await readBody(req));
      if (!tour) {
        sendJson(res, 404, { error: "Tour not found" });
        return;
      }
      sendJson(res, 200, tour);
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (req.method === "GET" && pathname === "/api/cost-rules") {
    sendJson(res, 200, getCostRules());
    return;
  }

  if (req.method === "POST" && pathname === "/api/cost-rules") {
    const payload = await readBody(req);
    const result = db.prepare(`
      INSERT INTO cost_rules (key, label, type, unit, unit_price, enabled, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        label = excluded.label,
        type = excluded.type,
        unit = excluded.unit,
        unit_price = excluded.unit_price,
        enabled = excluded.enabled,
        sort_order = excluded.sort_order
    `).run(
      String(payload.key || payload.label || "").trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, "_"),
      String(payload.label || "").trim(),
      String(payload.type || "fixed").trim(),
      String(payload.unit || "tur").trim(),
      Math.max(0, Number(payload.unitPrice || payload.unit_price || 0)),
      payload.enabled === false ? 0 : 1,
      Number(payload.sortOrder || payload.sort_order || 50)
    );
    sendJson(res, 201, { id: result.lastInsertRowid });
    return;
  }

  if (req.method === "POST" && pathname === "/api/tours") {
    const payload = await readBody(req);
    const plan = buildPlan(payload);
    if (plan.distance.missing) {
      sendJson(res, 400, { error: plan.distance.warning });
      return;
    }
    const stmt = db.prepare(`
      INSERT INTO tours (
        title, destination, start_date, duration_days, group_size, status, guide_required,
        accommodation, transport, places_json, program_json, transport_cost,
        accommodation_cost, food_cost, guide_cost, activity_cost, margin_rate, deposit_per_person, cost_items_json,
        sales_price_per_person, outbound_km, return_km
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const deposit = Math.min(3000, Math.round(plan.estimatedCost.pricePerPerson * 0.3));
    const costByKey = Object.fromEntries(plan.costItems.map((item) => [item.key, item.total]));
    const result = stmt.run(
      plan.title,
      plan.destination,
      payload.startDate || "2026-07-20",
      plan.durationDays,
      plan.groupSize,
      "Yeni teklif",
      plan.guideRequired ? 1 : 0,
      plan.accommodation,
      plan.transport,
      JSON.stringify(plan.places),
      JSON.stringify(plan.plan),
      Number(costByKey.vehicle || 0) + Number(costByKey.fuel || 0) + Number(costByKey.driver || 0),
      Number(costByKey.hotel || 0),
      Number(costByKey.food || 0),
      Number(costByKey.guide || 0),
      Number(costByKey.activity || 0) + Number(costByKey.boat || 0) + Number(costByKey.insurance || 0),
      0.22,
      deposit,
      JSON.stringify(plan.costItems),
      Number(plan.estimatedCost.pricePerPerson || 0),
      Number(plan.distance.outboundKm),
      Number(plan.distance.returnKm)
    );
    const row = db.prepare("SELECT * FROM tours WHERE id = ?").get(result.lastInsertRowid);
    sendJson(res, 201, mapTour(row));
    return;
  }

  if (req.method === "GET" && pathname === "/api/participants") {
    sendJson(res, 200, getParticipants().map(mapParticipant));
    return;
  }

  if (req.method === "POST" && pathname === "/api/participants") {
    const payload = await readBody(req);
    const tour = db.prepare("SELECT * FROM tours WHERE id = ?").get(Number(payload.tourId));
    if (!tour) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }
    const people = Math.max(1, Number(payload.people || 1));
    const depositPaid = Math.max(0, Number(payload.depositPaid || 0));
    const totalPrice = Math.max(0, Number(payload.totalPrice || mapTour(tour).totals.pricePerPerson * people));
    const status = paymentStatus(depositPaid, totalPrice);
    const result = db.prepare(`
      INSERT INTO participants (tour_id, name, phone, email, people, deposit_paid, total_price, status, seat_number, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tour.id,
      String(payload.name || "Yeni Katilimci").trim(),
      String(payload.phone || "").trim(),
      String(payload.email || "").trim(),
      people,
      depositPaid,
      totalPrice,
      status,
      String(payload.seatNumber || payload.seat_number || "").trim(),
      String(payload.notes || "").trim()
    );
    const row = getParticipants().find((participant) => participant.id === result.lastInsertRowid);
    sendJson(res, 201, mapParticipant(row));
    return;
  }

  if (req.method === "GET" && pathname === "/api/deposits") {
    const rows = getParticipants().map((row) => {
      const expectedDeposit = row.deposit_per_person * row.people;
      return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        tourTitle: row.tour_title,
        expectedDeposit,
        depositPaid: row.deposit_paid,
        remainingDeposit: Math.max(expectedDeposit - row.deposit_paid, 0),
        status: paymentStatus(row.deposit_paid, row.total_price)
      };
    });
    sendJson(res, 200, rows);
    return;
  }

  if (req.method === "GET" && pathname === "/api/leads") {
    sendJson(res, 200, getLeads());
    return;
  }

  const leadDetailMatch = pathname.match(/^\/api\/leads\/(\d+)$/);
  if (req.method === "GET" && leadDetailMatch) {
    const lead = getLeadById(leadDetailMatch[1]);
    if (!lead) {
      sendJson(res, 404, { error: "Lead not found" });
      return;
    }
    sendJson(res, 200, lead);
    return;
  }

  const leadStatusMatch = pathname.match(/^\/api\/leads\/(\d+)\/status$/);
  if (req.method === "POST" && leadStatusMatch) {
    const payload = await readBody(req);
    const allowedStatuses = ["Yeni", "Arandı", "Teklif Verildi", "Kapora Bekleniyor", "Satışa Dönüştü"];
    const status = String(payload.status || "").trim();
    if (!allowedStatuses.includes(status)) {
      sendJson(res, 400, { error: "Invalid lead status" });
      return;
    }

    const result = db.prepare("UPDATE leads SET status = ? WHERE id = ?").run(status, Number(leadStatusMatch[1]));
    if (result.changes === 0) {
      sendJson(res, 404, { error: "Lead not found" });
      return;
    }

    sendJson(res, 200, { id: Number(leadStatusMatch[1]), status });
    return;
  }

  const leadConvertMatch = pathname.match(/^\/api\/leads\/(\d+)\/convert$/);
  if (req.method === "POST" && leadConvertMatch) {
    const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(Number(leadConvertMatch[1]));
    if (!lead) {
      sendJson(res, 404, { error: "Lead not found" });
      return;
    }

    const plan = parseJson(lead.plan_json, null) || buildPlan({
      destination: lead.destination,
      groupSize: lead.group_size,
      durationDays: lead.duration_days,
      budget: lead.budget
    });
    if (!plan.distance || plan.distance.missing) {
      sendJson(res, 400, { error: plan.distance?.warning || "Kilometre bilgisi eksik, lütfen Google Maps üzerinden gidiş ve dönüş km girin." });
      return;
    }
    const tour = createTourFromPlan(plan, {
      title: `${plan.destination} Lead Turu`,
      status: "Lead satışa dönüştü"
    });

    const participantResult = db.prepare(`
      INSERT INTO participants (tour_id, name, phone, email, people, deposit_paid, total_price, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tour.id,
      lead.name,
      lead.phone,
      lead.email,
      plan.groupSize,
      0,
      plan.estimatedCost.pricePerPerson * plan.groupSize,
      "Ödeme yok"
    );

    db.prepare(`
      UPDATE leads
      SET status = 'Satışa Dönüştü', converted_tour_id = ?, converted_participant_id = ?
      WHERE id = ?
    `).run(tour.id, participantResult.lastInsertRowid, lead.id);

    sendJson(res, 201, {
      leadId: lead.id,
      status: "Satışa Dönüştü",
      tourId: tour.id,
      participantId: participantResult.lastInsertRowid
    });
    return;
  }

  sendJson(res, 404, { error: "API route not found" });
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    const ext = path.extname(filePath);
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8"
    };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith("/api/")) {
    handleApi(req, res, pathname).catch((error) => {
      sendJson(res, 500, { error: error.message || "Server error" });
    });
    return;
  }

  const staticPath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (staticPath.startsWith(PUBLIC_DIR) && fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    serveFile(res, staticPath);
    return;
  }

  serveFile(res, path.join(PUBLIC_DIR, "index.html"));
});

server.listen(PORT, () => {
  console.log(`TourFlow AI running at http://localhost:${PORT}`);
  console.log("Registered API routes:");
  registeredRoutes.forEach((route) => console.log(`- ${route}`));
});
