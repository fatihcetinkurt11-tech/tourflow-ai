const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const { DatabaseSync } = require("node:sqlite");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const DB_PATH = path.join(DATA_DIR, "tourflow.sqlite");
const SESSION_COOKIE = "tourflow_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

fs.mkdirSync(DATA_DIR, { recursive: true });

const registeredRoutes = [
  "GET /api/admin/session",
  "POST /api/admin/login",
  "POST /api/admin/logout",
  "POST /api/admin/password",
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

  CREATE TABLE IF NOT EXISTS admin_users (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const sessions = new Map();

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return { hash, salt };
}

function verifyPassword(password, user) {
  if (!user) return false;
  const { hash } = hashPassword(password, user.password_salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.password_hash, "hex"));
}

function seedAdminUser() {
  const existing = db.prepare("SELECT username FROM admin_users WHERE username = ?").get("admin");
  if (existing) return;
  const { hash, salt } = hashPassword(process.env.ADMIN_PASSWORD || "fmtravelfama2002");
  db.prepare("INSERT INTO admin_users (username, password_hash, password_salt) VALUES (?, ?, ?)").run("admin", hash, salt);
}

seedAdminUser();

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
  { key: "vehicle", label: "AraÃ§", type: "fm_vip_vehicle", unit: "km", unit_price: 10, sort_order: 1 },
  { key: "guide", label: "Rehber", type: "fixed", unit: "tur", unit_price: 6000, sort_order: 2 },
  { key: "insurance", label: "Sigorta", type: "per_person", unit: "kiÅŸi", unit_price: 75, sort_order: 3 },
  { key: "photographer", label: "FotoÄŸrafÃ§Ä±", type: "fixed", unit: "tur", unit_price: 0, sort_order: 4 },
  { key: "boat", label: "Tekne", type: "boat", unit: "tur/kiÅŸi", unit_price: 0, sort_order: 5 },
  { key: "hotel", label: "Otel", type: "manual", unit: "manuel", unit_price: 0, sort_order: 6 },
  { key: "other", label: "DiÄŸer", type: "manual", unit: "manuel", unit_price: 0, sort_order: 7 }
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
    { key: "vehicle", label: "AraÃ§", type: "legacy", quantity: 1, unit: "tur", unitPrice: row.transport_cost, total: row.transport_cost },
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
      label: "AraÃ§",
      type: "fm_vip_vehicle",
      quantity: routeKm || 0,
      unit: "km formÃ¼lÃ¼",
      unitPrice: vehicleUnit * 3,
      total: hasDistance ? Math.round(routeKm * vehicleUnit * 3) : 0,
      formula: hasDistance ? `(${outboundKm} + 10 + ${returnKm}) x ${vehicleUnit} x 3` : "Kilometre bilgisi eksik",
      warning: hasDistance ? "" : "Kilometre bilgisi eksik, lÃ¼tfen Google Maps Ã¼zerinden gidiÅŸ ve dÃ¶nÃ¼ÅŸ km girin."
    },
    { key: "guide", label: "Rehber", type: "fixed", quantity: 1, unit: "tur", unitPrice: guideTotal, total: guideTotal },
    { key: "insurance", label: "Sigorta", type: "per_person", quantity: groupSize, unit: "kiÅŸi", unitPrice: insuranceUnit, total: groupSize * insuranceUnit },
    { key: "boat", label: "Tekne", type: boatPricingType, quantity: boatQuantity, unit: boatPricingType === "per_person" ? "kiÅŸi" : "tur", unitPrice: boatUnitPrice, total: boatTotal },
    { key: "hotel", label: "Otel", type: "manual", quantity: hotelCost > 0 ? 1 : 0, unit: "manuel", unitPrice: hotelCost, total: hotelCost },
    { key: "other", label: "DiÄŸer", type: "manual", quantity: otherCost + photographerTotal > 0 ? 1 : 0, unit: "manuel", unitPrice: otherCost + photographerTotal, total: otherCost + photographerTotal }
  ];
  return {
    outboundKm,
    returnKm,
    routeKm,
    distanceMissing: !hasDistance,
    warning: hasDistance ? "" : "Kilometre bilgisi eksik, lÃ¼tfen Google Maps Ã¼zerinden gidiÅŸ ve dÃ¶nÃ¼ÅŸ km girin.",
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
    style: "Karadeniz doÄŸa ve yayla rotasÄ±",
    places: ["SÃ¼mela ManastÄ±rÄ±", "UzungÃ¶l", "AtatÃ¼rk KÃ¶ÅŸkÃ¼", "Ã‡al MaÄŸarasÄ±", "Boztepe", "HÄ±dÄ±rnebi YaylasÄ±"],
    accommodation: "Trabzon merkezde ulaÅŸÄ±mÄ± kolay otel ve UzungÃ¶l/yayla hattÄ±nda kahvaltÄ± dahil butik konaklama Ã¶nerilir.",
    transport: "HavalimanÄ± transferi, yayla yollarÄ± iÃ§in ÅŸofÃ¶rlÃ¼ Ã¶zel araÃ§ ve grup bÃ¼yÃ¼klÃ¼ÄŸÃ¼ne gÃ¶re minibÃ¼s Ã¶nerilir.",
    dailyThemes: ["ÅŸehir merkezi ve manzara noktalarÄ±", "SÃ¼mela ve Zigana hattÄ±", "UzungÃ¶l ve yayla rotasÄ±", "maÄŸara, yÃ¶resel alÄ±ÅŸveriÅŸ ve dÃ¶nÃ¼ÅŸ"],
    guideThreshold: 6,
    costs: { transport: 950, accommodation: 2200, food: 520, activity: 700, guideDaily: 3800, marginRate: 0.22 }
  },
  {
    match: ["kapadokya", "cappadocia"],
    style: "vadi, balon ve kÃ¼ltÃ¼r rotasÄ±",
    places: ["GÃ¶reme AÃ§Ä±k Hava MÃ¼zesi", "PaÅŸabaÄŸ", "Avanos", "UÃ§hisar Kalesi", "KÄ±zÄ±l Vadi", "Derinkuyu YeraltÄ± Åehri"],
    accommodation: "GÃ¶reme, UÃ§hisar veya Ortahisar'da taÅŸ otel; balon izleme noktalarÄ±na yakÄ±n konum Ã¶nerilir.",
    transport: "Kayseri/NevÅŸehir transferi, vadiler arasÄ± Ã¶zel araÃ§ ve yoÄŸun gÃ¼nlerde rehberli rota Ã¶nerilir.",
    dailyThemes: ["GÃ¶reme ve gÃ¼n batÄ±mÄ± vadileri", "balon izleme, mÃ¼ze ve Avanos", "yeraltÄ± ÅŸehri ve UÃ§hisar", "fotoÄŸraf noktalarÄ± ve dÃ¶nÃ¼ÅŸ"],
    guideThreshold: 4,
    costs: { transport: 800, accommodation: 2600, food: 560, activity: 1250, guideDaily: 4200, marginRate: 0.24 }
  },
  {
    match: ["halfeti"],
    style: "FÄ±rat kÄ±yÄ±sÄ± ve tekne rotasÄ±",
    places: ["SavaÅŸan KÃ¶yÃ¼", "Rumkale", "Halfeti Tekne Turu", "FÄ±rat Nehri", "Eski Halfeti SokaklarÄ±", "Birecik Kelaynak Merkezi"],
    accommodation: "Halfeti veya ÅanlÄ±urfa merkezde butik otel; tekne turu saatlerine gÃ¶re konum seÃ§imi Ã¶nerilir.",
    transport: "Gaziantep veya ÅanlÄ±urfa Ã§Ä±kÄ±ÅŸlÄ± Ã¶zel araÃ§, Halfeti iÃ§inde tekne turu ve kÄ±sa yÃ¼rÃ¼yÃ¼ÅŸ rotasÄ± Ã¶nerilir.",
    dailyThemes: ["Halfeti sokaklarÄ± ve FÄ±rat kÄ±yÄ±sÄ±", "tekne turu, Rumkale ve SavaÅŸan KÃ¶yÃ¼", "Birecik veya ÅanlÄ±urfa baÄŸlantÄ±lÄ± dÃ¶nÃ¼ÅŸ"],
    guideThreshold: 8,
    costs: { transport: 780, accommodation: 1750, food: 470, activity: 650, guideDaily: 3200, marginRate: 0.21 }
  },
  {
    match: ["arsuz"],
    style: "Akdeniz sahil ve gastronomi rotasÄ±",
    places: ["Arsuz Sahili", "Madenli Koyu", "KaraaÄŸaÃ§ PlajÄ±", "Ä°skenderun Sahili", "Titus TÃ¼neli", "BeÅŸikli MaÄŸara"],
    accommodation: "Arsuz sahil hattÄ±nda denize yakÄ±n butik otel veya apart konaklama; aile gruplarÄ± iÃ§in geniÅŸ oda Ã¶nerilir.",
    transport: "Hatay/Adana baÄŸlantÄ±lÄ± transfer, sahil duraklarÄ± iÃ§in Ã¶zel araÃ§ ve esnek mola planÄ± Ã¶nerilir.",
    dailyThemes: ["Arsuz sahili ve gÃ¼n batÄ±mÄ±", "koylar, plaj molalarÄ± ve Ä°skenderun", "Titus TÃ¼neli, maÄŸara rotasÄ± ve gastronomi"],
    guideThreshold: 10,
    costs: { transport: 720, accommodation: 1900, food: 620, activity: 500, guideDaily: 3000, marginRate: 0.2 }
  }
];

const destinationDatabase = [
  { name: "Darende", match: ["darende"], style: "Somuncu Baba, Tohma ve dogal su rotasi", places: ["Gunpinar Selalesi", "Tohma Kanyonu", "Somuncu Baba Kulliyesi", "Somuncu Baba Turbesi", "Kudret Havuzu", "Darende Carsisi", "Tarihi Darende Evleri"], historical: ["Somuncu Baba Kulliyesi", "Somuncu Baba Turbesi", "Tarihi Darende Evleri", "Darende Carsisi"], nature: ["Gunpinar Selalesi", "Tohma Kanyonu", "Kudret Havuzu"], photoSpots: ["Gunpinar Selalesi seyir noktasi", "Tohma Kanyonu", "Tarihi Darende Evleri sokaklari"], food: ["Yoresel ev yemekleri", "Darende carsisinda cay ve tatli molasi", "Yerel restoran"], hourlyProgram: ["07:00 Cikis", "10:00 Somuncu Baba Kulliyesi ve Turbesi", "11:30 Darende Carsisi", "12:30 Ogle yemegi", "14:00 Tohma Kanyonu ve Kudret Havuzu", "16:00 Gunpinar Selalesi", "18:00 Donus"], accommodation: "Gunubirlik rotalarda konaklama gerekmez; cok gunlu planlarda Malatya veya Darende merkez tercih edilebilir.", transport: "Kahramanmaras cikisli gruplar icin soforlu ozel arac ve Darende icinde esnek mola planlamasi onerilir.", guideThreshold: 8, costs: { transport: 760, accommodation: 0, food: 520, activity: 450, guideDaily: 3200, marginRate: 0.21 } },
  { name: "Halfeti", match: ["halfeti"], style: "Firat kiyisi ve tekne rotasi", places: ["Savasan Koyu", "Rumkale", "Halfeti Tekne Turu", "Firat Nehri", "Eski Halfeti Sokaklari", "Birecik Kelaynak Merkezi"], historical: ["Rumkale", "Eski Halfeti Sokaklari", "Savasan Koyu"], nature: ["Firat Nehri", "Halfeti Tekne Turu", "Birecik Kelaynak Merkezi"], photoSpots: ["Batikkoy minaresi", "Rumkale tekne manzarasi", "Eski Halfeti tas sokaklari"], food: ["Firat kenari balik", "Halfeti kebabi", "Yerel kahve molasi"], hourlyProgram: ["08:00 Cikis", "10:30 Eski Halfeti sokaklari", "11:30 Tekne turu", "12:30 Rumkale ve Savasan Koyu", "14:00 Ogle yemegi", "15:30 Birecik Kelaynak Merkezi", "17:00 Donus"], accommodation: "Halfeti veya Sanliurfa merkezde butik otel onerilir.", transport: "Gaziantep veya Sanliurfa cikisli ozel arac, Halfeti icinde tekne turu ve kisa yuruyus rotasi onerilir.", guideThreshold: 8, costs: { transport: 780, accommodation: 1750, food: 470, activity: 650, guideDaily: 3200, marginRate: 0.21 } },
  { name: "Arsuz", match: ["arsuz"], style: "Akdeniz sahil ve gastronomi rotasi", places: ["Arsuz Sahili", "Madenli Koyu", "Karaagac Plaji", "Iskenderun Sahili", "Titus Tuneli", "Besikli Magara"], historical: ["Titus Tuneli", "Besikli Magara"], nature: ["Arsuz Sahili", "Madenli Koyu", "Karaagac Plaji"], photoSpots: ["Arsuz gun batimi", "Madenli Koyu", "Iskenderun sahil hatti"], food: ["Deniz urunleri", "Hatay mezeleri", "Kunefe molasi"], hourlyProgram: ["07:30 Cikis", "10:30 Arsuz Sahili", "12:00 Madenli Koyu", "13:30 Ogle yemegi", "15:00 Karaagac Plaji", "16:30 Iskenderun Sahili", "18:00 Donus"], accommodation: "Arsuz sahil hattinda denize yakin butik otel veya apart konaklama onerilir.", transport: "Hatay/Adana baglantili transfer, sahil duraklari icin ozel arac onerilir.", guideThreshold: 10, costs: { transport: 720, accommodation: 1900, food: 620, activity: 500, guideDaily: 3000, marginRate: 0.2 } },
  { name: "Kapadokya", match: ["kapadokya", "cappadocia"], style: "vadi, balon ve kultur rotasi", places: ["Goreme Acik Hava Muzesi", "Pasabag", "Avanos", "Uchisar Kalesi", "Kizil Vadi", "Derinkuyu Yeralti Sehri"], historical: ["Goreme Acik Hava Muzesi", "Uchisar Kalesi", "Derinkuyu Yeralti Sehri"], nature: ["Kizil Vadi", "Pasabag", "Guvercinlik Vadisi"], photoSpots: ["Balon izleme noktasi", "Kizil Vadi gun batimi", "Uchisar panoramasi"], food: ["Testi kebabi", "Nevsehir kabagi", "Yerel sarap tadimi"], hourlyProgram: ["05:30 Balon izleme", "09:30 Goreme Acik Hava Muzesi", "11:30 Pasabag", "13:00 Ogle yemegi", "14:30 Avanos", "16:00 Uchisar Kalesi", "17:30 Kizil Vadi"], accommodation: "Goreme, Uchisar veya Ortahisar'da tas otel onerilir.", transport: "Kayseri/Nevsehir transferi, vadiler arasi ozel arac onerilir.", guideThreshold: 4, costs: { transport: 800, accommodation: 2600, food: 560, activity: 1250, guideDaily: 4200, marginRate: 0.24 } },
  { name: "Trabzon", match: ["trabzon"], style: "Karadeniz doga ve yayla rotasi", places: ["Sumela Manastiri", "Uzungol", "Ataturk Kosku", "Cal Magarasi", "Boztepe", "Hidirnebi Yaylasi"], historical: ["Sumela Manastiri", "Ataturk Kosku"], nature: ["Uzungol", "Cal Magarasi", "Hidirnebi Yaylasi"], photoSpots: ["Boztepe", "Uzungol kiyisi", "Sumela vadisi"], food: ["Akcaabat kofte", "Kuymak", "Karadeniz pidesi"], hourlyProgram: ["09:00 Ataturk Kosku", "10:30 Sumela Manastiri", "13:00 Ogle yemegi", "14:30 Cal Magarasi", "16:00 Boztepe", "17:30 Yoresel alisveris"], accommodation: "Trabzon merkez veya Uzungol/yayla hattinda butik konaklama onerilir.", transport: "Havalimani transferi ve yayla yollari icin soforlu ozel arac onerilir.", guideThreshold: 6, costs: { transport: 950, accommodation: 2200, food: 520, activity: 700, guideDaily: 3800, marginRate: 0.22 } },
  { name: "Sanliurfa", match: ["sanliurfa", "ÅŸanlÄ±urfa", "urfa"], style: "peygamberler sehri ve arkeoloji rotasi", places: ["Balikligol", "Gobeklitepe", "Harran", "Urfa Carsisi", "Gumruk Hani", "Halil-ur Rahman Camii"], historical: ["Gobeklitepe", "Harran", "Halil-ur Rahman Camii", "Gumruk Hani"], nature: ["Balikligol", "Harran ovasi"], photoSpots: ["Balikligol avlusu", "Harran kubbe evleri", "Urfa Carsisi"], food: ["Urfa kebabi", "Cig kofte", "Mirra ve menengic kahvesi"], hourlyProgram: ["09:00 Balikligol", "10:30 Urfa Carsisi", "12:30 Ogle yemegi", "14:00 Gobeklitepe", "16:00 Harran", "18:00 Sira gecesi opsiyonu"], accommodation: "Sanliurfa merkezde tarihi konak veya butik otel onerilir.", transport: "Sehir merkezi, Gobeklitepe ve Harran icin ozel arac planlamasi onerilir.", guideThreshold: 6, costs: { transport: 780, accommodation: 1900, food: 540, activity: 700, guideDaily: 3600, marginRate: 0.22 } },
  { name: "Gaziantep", match: ["gaziantep", "antep"], style: "gastronomi, muze ve tarihi carsilar rotasi", places: ["Zeugma Mozaik Muzesi", "Gaziantep Kalesi", "Bakircilar Carsisi", "Almaci Pazari", "Emine Gogus Mutfak Muzesi", "Rumkale"], historical: ["Gaziantep Kalesi", "Bakircilar Carsisi", "Zeugma Mozaik Muzesi"], nature: ["Rumkale", "Firat kiyisi"], photoSpots: ["Bakircilar Carsisi", "Gaziantep Kalesi", "Rumkale manzarasi"], food: ["Baklava", "Beyran", "Katmer", "Antep kebabi"], hourlyProgram: ["09:00 Zeugma Mozaik Muzesi", "11:00 Gaziantep Kalesi", "12:30 Ogle yemegi", "14:00 Bakircilar Carsisi", "16:00 Almaci Pazari", "17:30 Tatli molasi"], accommodation: "Gaziantep merkezde tarihi hanlara ve carsilara yakin otel onerilir.", transport: "Merkez ici yuruyus ve Rumkale opsiyonu icin ozel arac onerilir.", guideThreshold: 6, costs: { transport: 760, accommodation: 1850, food: 650, activity: 650, guideDaily: 3600, marginRate: 0.22 } },
  { name: "Mardin", match: ["mardin"], style: "tas mimari, Mezopotamya ve kultur rotasi", places: ["Eski Mardin", "Deyrulzafaran Manastiri", "Kasimiye Medresesi", "Mardin Ulu Camii", "Abbaralar", "Midyat Konuk Evi"], historical: ["Deyrulzafaran Manastiri", "Kasimiye Medresesi", "Mardin Ulu Camii", "Midyat Konuk Evi"], nature: ["Mezopotamya Ovasi manzarasi"], photoSpots: ["Eski Mardin teraslari", "Abbaralar", "Midyat sokaklari"], food: ["Kaburga dolmasi", "Sembusek", "Mardin kahvesi"], hourlyProgram: ["09:00 Eski Mardin", "10:30 Kasimiye Medresesi", "12:00 Ogle yemegi", "13:30 Deyrulzafaran Manastiri", "15:30 Abbaralar", "17:00 Mezopotamya manzarasi"], accommodation: "Eski Mardin'de tas konak veya butik otel onerilir.", transport: "Dar sokaklar icin yuruyus, Midyat ve manastir rotasi icin ozel arac onerilir.", guideThreshold: 5, costs: { transport: 800, accommodation: 2100, food: 580, activity: 700, guideDaily: 3800, marginRate: 0.23 } },
  { name: "Nemrut", match: ["nemrut", "nemrut dagi", "nemrut daÄŸÄ±"], style: "gunes dogumu ve Kommagene rotasi", places: ["Nemrut Dagi", "Arsameia Oren Yeri", "Cendere Koprusu", "Karakus Tumulusu", "Kahta Kalesi", "Eski Kahta"], historical: ["Arsameia Oren Yeri", "Cendere Koprusu", "Karakus Tumulusu", "Kahta Kalesi"], nature: ["Nemrut Dagi zirvesi", "Kahta vadisi"], photoSpots: ["Nemrut gun dogumu", "Dev heykeller", "Cendere Koprusu"], food: ["Adiyaman cig kofte", "Yerel kebap", "Kahta mola noktasi"], hourlyProgram: ["03:30 Zirve transferi", "05:30 Nemrut gun dogumu", "08:30 Kahvalti", "10:00 Arsameia", "11:30 Cendere Koprusu", "13:00 Ogle yemegi", "14:30 Karakus Tumulusu"], accommodation: "Kahta veya Adiyaman merkezde konaklama onerilir.", transport: "Zirve yolu icin uygun arac, gun dogumu saatlerine gore erken transfer onerilir.", guideThreshold: 6, costs: { transport: 850, accommodation: 1800, food: 520, activity: 600, guideDaily: 3600, marginRate: 0.22 } },
  { name: "Adana", match: ["adana"], style: "gastronomi, Seyhan ve kultur rotasi", places: ["Tas Kopru", "Sabanci Merkez Camii", "Adana Merkez Park", "Kazancilar Carsisi", "Buyuk Saat", "Varda Koprusu"], historical: ["Tas Kopru", "Buyuk Saat", "Kazancilar Carsisi", "Varda Koprusu"], nature: ["Seyhan Nehri", "Merkez Park"], photoSpots: ["Tas Kopru", "Sabanci Merkez Camii", "Varda Koprusu"], food: ["Adana kebap", "Salgam", "Bici bici"], hourlyProgram: ["09:00 Tas Kopru", "10:00 Sabanci Merkez Camii", "11:00 Merkez Park", "12:30 Adana kebap", "14:00 Kazancilar Carsisi", "16:00 Buyuk Saat", "17:30 Bici bici molasi"], accommodation: "Seyhan merkezde ulasimi kolay otel onerilir.", transport: "Merkez ici kisa transferler ve Varda Koprusu icin ozel arac onerilir.", guideThreshold: 8, costs: { transport: 720, accommodation: 1750, food: 620, activity: 450, guideDaily: 3200, marginRate: 0.21 } }
];

function normalizeTripText(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("Ä±", "i")
    .replaceAll("ÅŸ", "s")
    .replaceAll("ÄŸ", "g")
    .replaceAll("Ã¼", "u")
    .replaceAll("Ã¶", "o")
    .replaceAll("Ã§", "c");
}

function getDestinationProfile(destination) {
  const key = normalizeTripText(destination);
  return destinationDatabase.find((profile) => profile.match.some((term) => key.includes(normalizeTripText(term)))) || null;
  return destinationProfiles.find((profile) => profile.match.some((term) => key.includes(term))) || {
    match: [],
    style: `${destination} keÅŸif rotasÄ±`,
    places: [
      `${destination} merkez`,
      `${destination} tarihi bÃ¶lge`,
      `${destination} manzara noktasÄ±`,
      `${destination} yerel pazar`,
      `${destination} doÄŸa rotasÄ±`,
      `${destination} gastronomi duraÄŸÄ±`
    ],
    accommodation: `${destination} merkezde ulaÅŸÄ±mÄ± kolay, kahvaltÄ± dahil butik veya 3-4 yÄ±ldÄ±zlÄ± otel Ã¶nerilir.`,
    transport: `${destination} iÃ§in varÄ±ÅŸ noktasÄ±na gÃ¶re transfer, ÅŸehir iÃ§i Ã¶zel araÃ§ ve esnek mola planÄ± Ã¶nerilir.`,
    dailyThemes: [`${destination} merkez keÅŸfi`, "tarihi ve kÃ¼ltÃ¼rel duraklar", "doÄŸa/manzara rotasÄ±", "yerel pazar ve dÃ¶nÃ¼ÅŸ"],
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
  if (!profile) {
    const warning = "Bu destinasyon iÃ§in yeterli veri bulunamadÄ±";
    return {
      destination,
      groupSize,
      durationDays,
      budget,
      title: `${destination} tur planÄ±`,
      plan: [warning],
      places: [],
      historical: [],
      nature: [],
      photoSpots: [],
      food: [],
      hourlyProgram: [],
      destinationWarning: warning,
      estimatedCost: { baseCost: 0, costPerPerson: 0, profit: 0, netProfit: 0, salesTotal: 0, pricePerPerson: 0 },
      costItems: [],
      distance: { outboundKm: null, returnKm: null, routeKm: null, missing: true, warning },
      accommodation: warning,
      transport: warning,
      guideRequired: false,
      whatsappMessage: warning,
      depositMessage: warning
    };
  }
  profile.dailyThemes = profile.dailyThemes || profile.hourlyProgram || profile.places;
  const guideRequired = groupSize >= profile.guideThreshold || durationDays >= 3;
  const costEngine = calculateCostItems({ ...input, destination, groupSize, durationDays, guideRequired });
  const baseCost = costEngine.items.reduce((sum, item) => sum + item.total, 0);
  const explicitPrice = Number(input.salesPricePerPerson || input.sales_price_per_person || 0);
  const calculatedSalesTotal = baseCost + Math.round(baseCost * profile.costs.marginRate);
  const pricePerPerson = explicitPrice > 0 ? explicitPrice : Math.ceil(calculatedSalesTotal / groupSize / 50) * 50;
  const salesTotal = pricePerPerson * groupSize;
  const profit = salesTotal - baseCost;
  const costPerPerson = Math.ceil(baseCost / groupSize / 50) * 50;
  const plan = durationDays === 1 && profile.hourlyProgram?.length ? profile.hourlyProgram : Array.from({ length: durationDays }, (_, index) => {
    const theme = profile.dailyThemes[index % profile.dailyThemes.length];
    const primary = profile.places[index % profile.places.length];
    const secondary = profile.places[(index + 1) % profile.places.length];
    if (index === 0) return `1. gÃ¼n: ${destination} varÄ±ÅŸ, ${theme}, ${primary} ve yerel lezzet molasÄ±.`;
    if (index === durationDays - 1) return `${index + 1}. gÃ¼n: ${theme}, ${primary}, ${secondary} ve dÃ¶nÃ¼ÅŸ hazÄ±rlÄ±ÄŸÄ±.`;
    return `${index + 1}. gÃ¼n: ${theme}, ${primary}, ${secondary} ve serbest zaman.`;
  });

  return {
    destination,
    groupSize,
    durationDays,
    budget,
    title: `${destination} ${durationDays} GÃ¼nlÃ¼k ${profile.style}`,
    plan,
    places: profile.places,
    historical: profile.historical || [],
    nature: profile.nature || [],
    photoSpots: profile.photoSpots || [],
    food: profile.food || [],
    hourlyProgram: profile.hourlyProgram || [],
    destinationWarning: "",
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
    whatsappMessage: `Merhaba, ${destination} iÃ§in ${durationDays} gÃ¼nlÃ¼k dinamik gezi planÄ±nÄ±zÄ± hazÄ±rladÄ±k. Rotada ${profile.places.slice(0, 3).join(", ")} var. KiÅŸi baÅŸÄ± tahmini Ã¼cret ${pricePerPerson.toLocaleString("tr-TR")} TL.`,
    depositMessage: `Rezervasyonu netleÅŸtirmek iÃ§in kiÅŸi baÅŸÄ± ${Math.min(3000, Math.round(pricePerPerson * 0.3)).toLocaleString("tr-TR")} TL kapora ile konaklama ve ulaÅŸÄ±m opsiyonunu sabitleyebiliriz.`
  };
}

function parseNaturalTripRequest(message) {
  const text = String(message || "").trim();
  const lower = text.toLocaleLowerCase("tr-TR");
  const knownDestinations = ["Trabzon", "Kapadokya", "Halfeti", "Arsuz", "Rize", "KahramanmaraÅŸ", "Gaziantep", "ÅanlÄ±urfa", "Antalya", "Mardin"];
  const originMatch = text.match(/^(.{2,60}?)\s*(?:Ã§Ä±kÄ±ÅŸlÄ±|cikisli|Ã§Ä±kÄ±ÅŸ|cikis|ÃƒÂ§Ã„Â±k|ÃƒÂ§ikis)/i);
  const origin = originMatch ? originMatch[1].trim() : "";
  const peopleMatch = lower.match(/(\d+)\s*(?:kiÅŸilik|kisilik|kiÅŸi|kisi)/);
  const dayMatch = lower.match(/(\d+)\s*(?:gÃ¼nlÃ¼k|gunluk|gÃ¼n|gun)/);
  const budgetMatch = lower.match(/(\d[\d. ]*)\s*(?:tl|â‚º|lira)/);
  const destinationFromKnown = knownDestinations.find((name) => lower.includes(name.toLocaleLowerCase("tr-TR")) && name !== origin);
  const destinationMatch = text.match(/(?:tur|gezi|program)\s+(?:oluÅŸtur|olustur|hazÄ±rla|hazirla).*?\b([A-Za-zÃ‡ÄÄ°Ã–ÅÃœÃ§ÄŸÄ±Ã¶ÅŸÃ¼]+)\b/i);
  const destination = destinationFromKnown || destinationMatch?.[1] || text.replace(originMatch?.[0] || "", "").split(/\s+/).find((word) => word.length > 3) || "Yeni Rota";
  const durationDays = lower.includes("gÃ¼nÃ¼birlik") || lower.includes("gunubirlik") || lower.includes("birlik")
    ? 1
    : Math.max(1, Number(dayMatch?.[1] || 3));
  const groupSize = Math.max(1, Number(peopleMatch?.[1] || 2));
  const budget = budgetMatch ? Number(budgetMatch[1].replace(/[. ]/g, "")) : 9000;

  return { message: text, origin, destination, groupSize, durationDays, budget };
}

function parseNaturalTripRequest(message) {
  const text = String(message || "").trim();
  const lower = text.toLocaleLowerCase("tr-TR");
  const originMatch = text.match(/^(.{2,60}?)\s*(?:Ã§Ä±kÄ±ÅŸlÄ±|cikisli|Ã§Ä±kÄ±ÅŸ|cikis|ÃƒÂ§Ã„Â±kÃ„Â±Ã…Å¸lÃ„Â±|ÃƒÂ§Ã„Â±kÃ„Â±Ã…Å¸|ÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±k|ÃƒÆ’Ã‚Â§ikis)/i);
  const words = text.split(/\s+/).filter(Boolean);
  const originTokenIndex = words.findIndex((word) => /^cikisli$|^cikis$/.test(normalizeTripText(word)));
  const origin = originTokenIndex > 0 ? words.slice(0, originTokenIndex).join(" ") : (originMatch ? originMatch[1].trim() : "");
  const destinationText = originTokenIndex > -1 ? words.slice(originTokenIndex + 1).join(" ") : text.replace(originMatch?.[0] || "", " ");
  const normalizedDestinationText = normalizeTripText(destinationText);
  const peopleMatch = lower.match(/(\d+)\s*(?:kiÅŸilik|kisilik|kiÅŸi|kisi|kiÃ…Å¸ilik|kiÃ…Å¸i)/);
  const dayMatch = lower.match(/(\d+)\s*(?:gÃ¼nlÃ¼k|gunluk|gÃ¼n|gun|gÃƒÂ¼nlÃƒÂ¼k|gÃƒÂ¼n)/);
  const budgetMatch = lower.match(/(\d[\d. ]*)\s*(?:tl|â‚º|lira|Ã¢â€šÂº)/);
  const destinationFromKnown = destinationDatabase.find((profile) => profile.match.some((term) => normalizedDestinationText.includes(normalizeTripText(term))))?.name;
  const destinationMatch = destinationText.match(/\b([A-Za-zÃ‡ÄÄ°Ã–ÅÃœÃ§ÄŸÄ±Ã¶ÅŸÃ¼Ãƒâ€¡Ã„ÂÃ„Â°Ãƒâ€“Ã…ÂÃƒÅ“ÃƒÂ§Ã„Å¸Ã„Â±ÃƒÂ¶Ã…Å¸ÃƒÂ¼]+)\b/i);
  const destination = destinationFromKnown || destinationMatch?.[1] || "Yeni Rota";
  const durationDays = lower.includes("gÃ¼nÃ¼birlik") || lower.includes("gunubirlik") || lower.includes("birlik") || lower.includes("gÃƒÂ¼nÃƒÂ¼birlik")
    ? 1
    : Math.max(1, Number(dayMatch?.[1] || 3));
  const groupSize = Math.max(1, Number(peopleMatch?.[1] || 2));
  const budget = budgetMatch ? Number(budgetMatch[1].replace(/[. ]/g, "")) : 9000;

  return { message: text, origin, destination, groupSize, durationDays, budget };
}

function buildAssistantResponse(payload) {
  const parsed = parseNaturalTripRequest(payload.message);
  const plan = buildPlan(parsed);
  if (plan.destinationWarning) {
    return {
      ...plan,
      origin: parsed.origin,
      sourceMessage: parsed.message,
      assistantSummary: plan.destinationWarning,
      whatsappMessage: plan.destinationWarning,
      depositMessage: plan.destinationWarning
    };
  }
  const originText = parsed.origin ? `${parsed.origin} Ã§Ä±kÄ±ÅŸlÄ± ` : "";
  return {
    ...plan,
    origin: parsed.origin,
    sourceMessage: parsed.message,
    assistantSummary: `${originText}${plan.groupSize} kiÅŸilik ${plan.destination} iÃ§in ${plan.durationDays} gÃ¼nlÃ¼k tur taslaÄŸÄ± hazÄ±rlandÄ±.`,
    whatsappMessage: `Merhaba, ${originText}${plan.destination} turu iÃ§in ${plan.durationDays} gÃ¼nlÃ¼k program hazÄ±r. Rotada ${plan.places.slice(0, 4).join(", ")} var. KiÅŸi baÅŸÄ± tahmini Ã¼cret ${plan.estimatedCost.pricePerPerson.toLocaleString("tr-TR")} TL. DetaylarÄ± paylaÅŸabilirim.`,
    depositMessage: `Rezervasyonu netleÅŸtirmek iÃ§in kiÅŸi baÅŸÄ± ${Math.min(3000, Math.round(plan.estimatedCost.pricePerPerson * 0.3)).toLocaleString("tr-TR")} TL kapora alÄ±yoruz. Kapora sonrasÄ± ulaÅŸÄ±m ve konaklama opsiyonunu sabitliyoruz.`
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

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf("=");
      return index === -1 ? [part, ""] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    }));
}

function sendSessionCookie(res, token) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

function getSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return session;
}

function createSession(username) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    username,
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return token;
}

function destroySession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) sessions.delete(token);
}

function isAdminSession(req) {
  return Boolean(getSession(req));
}

function isPublicApi(req, pathname) {
  return (req.method === "GET" && pathname === "/api/admin/session")
    || (req.method === "POST" && pathname === "/api/admin/login")
    || (req.method === "POST" && pathname === "/api/admin/logout")
    || (req.method === "POST" && pathname === "/api/assistant/plan")
    || (req.method === "POST" && pathname === "/api/planner")
    || (req.method === "POST" && pathname === "/api/leads");
}

function requireAdmin(req, res, pathname) {
  if (isPublicApi(req, pathname) || isAdminSession(req)) return true;
  sendJson(res, 401, { error: "Admin girisi gerekli" });
  return false;
}

function pdfSafe(value) {
  const repaired = String(value ?? "")
    .replaceAll("Ã„Â°", "Ä°")
    .replaceAll("Ã„Â±", "Ä±")
    .replaceAll("Ã…Å¾", "Å")
    .replaceAll("Ã…Å¸", "ÅŸ")
    .replaceAll("Ã„Å¾", "Ä")
    .replaceAll("Ã„Å¸", "ÄŸ")
    .replaceAll("Ãƒâ€¡", "Ã‡")
    .replaceAll("ÃƒÂ§", "Ã§")
    .replaceAll("Ãƒâ€“", "Ã–")
    .replaceAll("ÃƒÂ¶", "Ã¶")
    .replaceAll("ÃƒÅ“", "Ãœ")
    .replaceAll("ÃƒÂ¼", "Ã¼");
  const turkishCodes = {
    "Ä": 128,
    "ÄŸ": 129,
    "Ä°": 130,
    "Ä±": 131,
    "Å": 132,
    "ÅŸ": 133,
    "Ã‡": 134,
    "Ã§": 135,
    "Ã–": 136,
    "Ã¶": 137,
    "Ãœ": 138,
    "Ã¼": 139
  };
  return repaired
    .replace(/[ÄÄŸÄ°Ä±ÅÅŸÃ‡Ã§Ã–Ã¶ÃœÃ¼]/g, (char) => String.fromCharCode(turkishCodes[char]))
    .replace(/[^\x20-\x8B]/g, "")
    .replace(/[()\\]/g, "\\$&");
}

function splitPdfText(value, maxLength = 58) {
  const words = String(value ?? "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > maxLength) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function qrMatrix(value) {
  const version = 2;
  const size = 21 + (version - 1) * 4;
  const dataCodewords = 34;
  const eccCodewords = 10;
  const matrix = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));
  const setModule = (x, y, dark, reserve = true) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    matrix[y][x] = Boolean(dark);
    if (reserve) reserved[y][x] = true;
  };
  const drawFinder = (x, y) => {
    for (let row = -1; row <= 7; row += 1) {
      for (let col = -1; col <= 7; col += 1) {
        const inFinder = row >= 0 && row <= 6 && col >= 0 && col <= 6;
        const edge = row === 0 || row === 6 || col === 0 || col === 6;
        const center = row >= 2 && row <= 4 && col >= 2 && col <= 4;
        setModule(x + col, y + row, inFinder && (edge || center));
      }
    }
  };
  const drawAlignment = (x, y) => {
    for (let row = -2; row <= 2; row += 1) {
      for (let col = -2; col <= 2; col += 1) {
        setModule(x + col, y + row, Math.max(Math.abs(row), Math.abs(col)) !== 1);
      }
    }
  };
  const pushBits = (bits, valueToWrite, length) => {
    for (let index = length - 1; index >= 0; index -= 1) {
      bits.push((valueToWrite >>> index) & 1);
    }
  };
  const exp = Array(512).fill(0);
  const log = Array(256).fill(0);
  let fieldValue = 1;
  for (let index = 0; index < 255; index += 1) {
    exp[index] = fieldValue;
    log[fieldValue] = index;
    fieldValue <<= 1;
    if (fieldValue & 0x100) fieldValue ^= 0x11d;
  }
  for (let index = 255; index < exp.length; index += 1) exp[index] = exp[index - 255];
  const gfMul = (a, b) => (a && b ? exp[log[a] + log[b]] : 0);
  const polyMul = (left, right) => {
    const result = Array(left.length + right.length - 1).fill(0);
    for (let i = 0; i < left.length; i += 1) {
      for (let j = 0; j < right.length; j += 1) result[i + j] ^= gfMul(left[i], right[j]);
    }
    return result;
  };
  const reedSolomon = (data) => {
    let generator = [1];
    for (let index = 0; index < eccCodewords; index += 1) generator = polyMul(generator, [1, exp[index]]);
    const remainder = Array(eccCodewords).fill(0);
    for (const byte of data) {
      const factor = byte ^ remainder.shift();
      remainder.push(0);
      for (let index = 0; index < eccCodewords; index += 1) remainder[index] ^= gfMul(generator[index + 1], factor);
    }
    return remainder;
  };

  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);
  drawAlignment(18, 18);
  for (let index = 8; index < size - 8; index += 1) {
    setModule(index, 6, index % 2 === 0);
    setModule(6, index, index % 2 === 0);
  }
  setModule(8, size - 8, true);

  const formatData = 1 << 3;
  let formatRemainder = formatData << 10;
  for (let bit = 14; bit >= 10; bit -= 1) {
    if (((formatRemainder >>> bit) & 1) !== 0) formatRemainder ^= 0x537 << (bit - 10);
  }
  const formatBits = ((formatData << 10) | formatRemainder) ^ 0x5412;
  const getFormatBit = (index) => ((formatBits >>> index) & 1) !== 0;
  for (let index = 0; index <= 5; index += 1) setModule(8, index, getFormatBit(index));
  setModule(8, 7, getFormatBit(6));
  setModule(8, 8, getFormatBit(7));
  setModule(7, 8, getFormatBit(8));
  for (let index = 9; index < 15; index += 1) setModule(14 - index, 8, getFormatBit(index));
  for (let index = 0; index < 8; index += 1) setModule(size - 1 - index, 8, getFormatBit(index));
  for (let index = 8; index < 15; index += 1) setModule(8, size - 15 + index, getFormatBit(index));

  const bytes = Buffer.from(String(value).slice(0, 26), "utf8");
  const bits = [];
  pushBits(bits, 0x4, 4);
  pushBits(bits, bytes.length, 8);
  for (const byte of bytes) pushBits(bits, byte, 8);
  const capacityBits = dataCodewords * 8;
  pushBits(bits, 0, Math.min(4, Math.max(capacityBits - bits.length, 0)));
  while (bits.length % 8 !== 0) bits.push(0);
  const data = [];
  for (let index = 0; index < bits.length; index += 8) data.push(Number.parseInt(bits.slice(index, index + 8).join(""), 2));
  for (let pad = 0; data.length < dataCodewords; pad += 1) data.push(pad % 2 === 0 ? 0xec : 0x11);
  const codewordBits = data.concat(reedSolomon(data)).flatMap((byte) => {
    const byteBits = [];
    pushBits(byteBits, byte, 8);
    return byteBits;
  });

  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vertical = 0; vertical < size; vertical += 1) {
      const y = upward ? size - 1 - vertical : vertical;
      for (let column = 0; column < 2; column += 1) {
        const x = right - column;
        if (!reserved[y][x]) setModule(x, y, Boolean(codewordBits[bitIndex++] || 0) !== ((x + y) % 2 === 0), false);
      }
    }
    upward = !upward;
  }
  return matrix;
}

let pdfLogoCache = null;
function readPdfLogo() {
  if (pdfLogoCache !== null) return pdfLogoCache;
  const logoPaths = [
    path.join(PUBLIC_DIR, "assets", "fm-travel-logo.png"),
    path.join(PUBLIC_DIR, "assets", "fm-travel-logo.png.png")
  ];
  const logoPath = logoPaths.find((candidate) => fs.existsSync(candidate));
  if (!logoPath) {
    pdfLogoCache = false;
    return null;
  }
  const png = fs.readFileSync(logoPath);
  if (png.slice(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    pdfLogoCache = false;
    return null;
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.slice(offset + 4, offset + 8).toString("ascii");
    const data = png.slice(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    }
    if (type === "IDAT") idat.push(data);
    if (type === "IEND") break;
    offset += 12 + length;
  }
  if (!width || !height || bitDepth !== 8 || colorType !== 2 || !idat.length) {
    pdfLogoCache = false;
    return null;
  }
  pdfLogoCache = {
    width,
    height,
    data: Buffer.concat(idat)
  };
  return pdfLogoCache;
}

function sendPdf(res, filename, title, documentContent) {
  const content = Array.isArray(documentContent) ? { tables: [{ rows: documentContent.map((line) => ["", line]) }] } : documentContent;
  const ops = [];
  const page = { width: 595, height: 842, margin: 44 };
  const createdAt = new Date().toLocaleString("tr-TR");
  const qrText = content.qrText || `TourFlow AI Tur No: ${content.tourId || ""}`;
  const logo = readPdfLogo();
  const add = (value) => ops.push(value);
  const color = (r, g, b) => add(`${r} ${g} ${b} rg ${r} ${g} ${b} RG`);
  const rect = (x, y, w, h, fill = true) => add(`${x} ${y} ${w} ${h} re ${fill ? "f" : "S"}`);
  const line = (x1, y1, x2, y2) => add(`${x1} ${y1} m ${x2} ${y2} l S`);
  const text = (value, x, y, size = 10, font = "F1") => {
    add(`BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfSafe(value)}) Tj ET`);
  };
  const drawWrapped = (value, x, y, maxLength, size = 9, font = "F1", leading = 12) => {
    let cursor = y;
    for (const part of splitPdfText(value, maxLength)) {
      text(part, x, cursor, size, font);
      cursor -= leading;
    }
    return cursor;
  };
  const drawQr = (value, x, y, box = 82) => {
    color(1, 1, 1);
    rect(x - 6, y - 6, box + 12, box + 12, true);
    color(0.06, 0.18, 0.14);
    const matrix = qrMatrix(value);
    const cell = box / matrix.length;
    matrix.forEach((row, rowIndex) => {
      row.forEach((filled, colIndex) => {
        if (filled) rect(x + colIndex * cell, y + box - (rowIndex + 1) * cell, cell + 0.15, cell + 0.15, true);
      });
    });
    color(0.25, 0.25, 0.25);
    text("QR Kod", x + 18, y - 18, 8, "F2");
  };

  color(0.02, 0.16, 0.12);
  rect(0, 742, page.width, 100, true);
  color(0.86, 0.64, 0.25);
  rect(0, 738, page.width, 4, true);
  color(1, 1, 1);
  if (logo) {
    const logoMaxWidth = 72;
    const logoMaxHeight = 42;
    const logoScale = Math.min(logoMaxWidth / logo.width, logoMaxHeight / logo.height);
    const logoWidth = logo.width * logoScale;
    const logoHeight = logo.height * logoScale;
    add(`q ${logoWidth.toFixed(2)} 0 0 ${logoHeight.toFixed(2)} 44 ${(770 + (logoMaxHeight - logoHeight) / 2).toFixed(2)} cm /Logo Do Q`);
  } else {
    rect(44, 768, 64, 44, false);
    text("FM", 58, 785, 18, "F2");
    text("Travel", 58, 773, 10, "F2");
  }
  text("FM Travel | TourFlow AI", 126, 794, 14, "F2");
  text("Yeni Rotalar, Yeni AnÄ±lar", 126, 776, 10, "F1");
  color(0.86, 0.64, 0.25);
  text("Profesyonel Tur Operasyon Belgesi", 370, 792, 9, "F2");

  color(0.06, 0.13, 0.1);
  text(title, page.margin, 708, 18, "F2");
  color(0.36, 0.43, 0.39);
  text(`OluÅŸturulma tarihi: ${createdAt}`, page.margin, 688, 9, "F1");
  text(`Tur No: ${content.tourId || "-"}`, 438, 688, 9, "F1");

  let y = 652;
  const drawSectionTitle = (label) => {
    color(0.02, 0.28, 0.2);
    text(label, page.margin, y, 12, "F2");
    color(0.86, 0.64, 0.25);
    line(page.margin, y - 6, page.width - page.margin, y - 6);
    y -= 24;
  };
  const drawRows = (rows) => {
    for (const [label, value] of rows) {
      if (y < 150) break;
      color(0.96, 0.98, 0.96);
      rect(page.margin, y - 9, page.width - page.margin * 2, 24, true);
      color(0.82, 0.88, 0.84);
      rect(page.margin, y - 9, page.width - page.margin * 2, 24, false);
      color(0.06, 0.13, 0.1);
      text(label, page.margin + 10, y, 9, "F2");
      drawWrapped(value, page.margin + 170, y, 56, 9, "F1", 10);
      y -= 28;
    }
  };
  const drawTable = (table) => {
    if (table.title) drawSectionTitle(table.title);
    if (table.headers?.length) {
      color(0.02, 0.28, 0.2);
      rect(page.margin, y - 10, page.width - page.margin * 2, 24, true);
      color(1, 1, 1);
      const colWidth = (page.width - page.margin * 2) / table.headers.length;
      table.headers.forEach((header, index) => text(header, page.margin + 8 + index * colWidth, y, 8.5, "F2"));
      y -= 26;
      for (const row of table.rows || []) {
        if (y < 150) break;
        color(1, 1, 1);
        rect(page.margin, y - 10, page.width - page.margin * 2, 28, true);
        color(0.86, 0.9, 0.87);
        rect(page.margin, y - 10, page.width - page.margin * 2, 28, false);
        color(0.06, 0.13, 0.1);
        row.forEach((cell, index) => drawWrapped(cell, page.margin + 8 + index * colWidth, y + 2, Math.floor(colWidth / 5.1), 7.6, "F1", 8.5));
        y -= 30;
      }
    } else {
      drawRows(table.rows || []);
    }
  };

  for (const table of content.tables || []) drawTable(table);
  if (content.notes?.length && y > 180) {
    drawSectionTitle("Notlar");
    for (const note of content.notes) {
      y = drawWrapped(`â€¢ ${note}`, page.margin, y, 92, 8.5, "F1", 11);
    }
  }

  drawQr(qrText, 464, 72, 76);
  color(0.86, 0.64, 0.25);
  line(page.margin, 54, page.width - page.margin, 54);
  color(0.36, 0.43, 0.39);
  text("FM Travel | TourFlow AI - Yeni Rotalar, Yeni AnÄ±lar", page.margin, 34, 8, "F1");
  text("Sayfa 1 / 1", 500, 34, 8, "F1");

  const stream = ops.join("\n");
  const imageResource = logo ? " /XObject << /Logo 7 0 R >>" : "";
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 6 0 R >>${imageResource} >> /Contents 5 0 R >> endobj`,
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding << /Type /Encoding /Differences [128 /Gbreve /gbreve /Idotaccent /dotlessi /Scedilla /scedilla /Ccedilla /ccedilla /Odieresis /odieresis /Udieresis /udieresis] >> >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`,
    "6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding << /Type /Encoding /Differences [128 /Gbreve /gbreve /Idotaccent /dotlessi /Scedilla /scedilla /Ccedilla /ccedilla /Odieresis /odieresis /Udieresis /udieresis] >> >> endobj"
  ];
  if (logo) {
    const imageHeader = `7 0 obj << /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ${logo.width} >> /Length ${logo.data.length} >> stream\n`;
    objects.push(Buffer.concat([Buffer.from(imageHeader, "binary"), logo.data, Buffer.from("\nendstream endobj", "binary")]));
  }
  let body = Buffer.from("%PDF-1.4\n", "binary");
  const offsets = [0];
  for (const object of objects) {
    offsets.push(body.length);
    const objectBuffer = Buffer.isBuffer(object) ? object : Buffer.from(object, "binary");
    body = Buffer.concat([body, objectBuffer, Buffer.from("\n", "binary")]);
  }
  const xref = body.length;
  let trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    trailer += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  trailer += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const buffer = Buffer.concat([body, Buffer.from(trailer, "binary")]);
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
    throw new Error("Kilometre bilgisi eksik, lÃ¼tfen Google Maps Ã¼zerinden gidiÅŸ ve dÃ¶nÃ¼ÅŸ km girin.");
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
  if (depositPaid <= 0) return "Ã–deme yok";
  if (depositPaid >= totalPrice) return "Ã–deme tamamlandÄ±";
  return "KÄ±smi Ã¶deme";
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

  const departurePoint = "FM Travel ofisi";
  const qrText = `/admin/tours/${tour.id}`;
  const moneyText = (value) => `${Number(value || 0).toLocaleString("tr-TR")} TL`;
  const createdDate = new Date().toLocaleDateString("tr-TR");

  if (type === "registration") {
    return {
      title: "Tur KayÄ±t ve KatÄ±lÄ±m Onay Belgesi",
      filename: `tur-kayit-${tour.id}-${participant.id}.pdf`,
      tourId: tour.id,
      qrText,
      tables: [{
        title: "KatÄ±lÄ±mcÄ± ve Tur Bilgileri",
        rows: [
          ["Ad Soyad", participant.name],
          ["Telefon", participant.phone],
          ["Tur AdÄ±", tour.title],
          ["Tur Tarihi", tour.startDate],
          ["KalkÄ±ÅŸ NoktasÄ±", departurePoint],
          ["Toplam Ãœcret", moneyText(participant.totalPrice)],
          ["Kapora", moneyText(participant.depositPaid)],
          ["Kalan Ã–deme", moneyText(participant.remainingPayment)]
        ]
      }],
      notes: ["Bu belge FM Travel operasyon kaydÄ± iÃ§in hazÄ±rlanmÄ±ÅŸtÄ±r.", "Tur detaylarÄ± ve Ã¶deme durumu operasyon panelinden takip edilir."]
    };
  }

  if (type === "deposit") {
    return {
      title: "Kapora Belgesi",
      filename: `kapora-${tour.id}-${participant.id}.pdf`,
      tourId: tour.id,
      qrText,
      tables: [{
        title: "Tahsilat Bilgileri",
        rows: [
          ["Ad Soyad", participant.name],
          ["Tur AdÄ±", tour.title],
          ["Tur Tarihi", tour.startDate],
          ["Tahsil Edilen Tutar", moneyText(participant.depositPaid)],
          ["Kalan Ã–deme", moneyText(participant.remainingPayment)],
          ["Tahsil Tarihi", createdDate]
        ]
      }],
      notes: ["Kapora tutarÄ± toplam tur Ã¼cretinden dÃ¼ÅŸÃ¼lÃ¼r.", "Kalan Ã¶deme tur operasyon takvimine gÃ¶re takip edilir."]
    };
  }

  if (type === "participants") {
    return {
      title: "KatÄ±lÄ±mcÄ± Listesi",
      filename: `katilimci-listesi-${tour.id}.pdf`,
      tourId: tour.id,
      qrText,
      tables: [
        {
          title: "Tur Ã–zeti",
          rows: [["Tur AdÄ±", tour.title], ["Tur Tarihi", tour.startDate], ["KalkÄ±ÅŸ NoktasÄ±", departurePoint]]
        },
        {
          title: "KatÄ±lÄ±mcÄ±lar",
          headers: ["Koltuk", "Ad Soyad", "Telefon", "Kapora", "Kalan", "Durum"],
          rows: participants.map((item) => [item.seatNumber || "-", item.name, item.phone, moneyText(item.depositPaid), moneyText(item.remainingPayment), item.status])
        }
      ]
    };
  }

  if (type === "program") {
    const programRows = (tour.hourlyProgram?.length ? tour.hourlyProgram : tour.program).map((item, index) => {
      const match = String(item).match(/^(\d{1,2}:\d{2})\s+(.+)$/);
      return match ? [match[1], match[2].split(",")[0], match[2]] : [`${index + 1}.`, tour.places[index % Math.max(tour.places.length, 1)] || "Program", String(item)];
    });
    return {
      title: "Tur ProgramÄ±",
      filename: `tur-programi-${tour.id}.pdf`,
      tourId: tour.id,
      qrText,
      tables: [
        {
          title: "Tur Bilgileri",
          rows: [["Tur AdÄ±", tour.title], ["Tur Tarihi", tour.startDate], ["KalkÄ±ÅŸ NoktasÄ±", departurePoint]]
        },
        {
          title: "Saatlik Program",
          headers: ["Saat", "Durak", "AÃ§Ä±klama"],
          rows: programRows
        }
      ],
      notes: ["UlaÅŸÄ±m, zorunlu sigorta, planlanan program akÄ±ÅŸÄ± ve operasyon takibi FM Travel tarafÄ±ndan koordine edilir."]
    };
  }

  throw new Error("Invalid document type");
}

function createTourFromPlan(plan, options = {}) {
  if (!plan.distance || plan.distance.missing || plan.distance.outboundKm === null || plan.distance.returnKm === null) {
    throw new Error("Kilometre bilgisi eksik, lÃ¼tfen Google Maps Ã¼zerinden gidiÅŸ ve dÃ¶nÃ¼ÅŸ km girin.");
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
  if (req.method === "GET" && pathname === "/api/admin/session") {
    const session = getSession(req);
    sendJson(res, 200, { authenticated: Boolean(session), username: session?.username || null });
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/login") {
    const payload = await readBody(req);
    const username = String(payload.username || "").trim();
    const password = String(payload.password || "");
    const user = db.prepare("SELECT * FROM admin_users WHERE username = ?").get(username);
    if (username !== "admin" || !verifyPassword(password, user)) {
      sendJson(res, 401, { error: "Kullanici adi veya sifre hatali" });
      return;
    }
    sendSessionCookie(res, createSession(username));
    sendJson(res, 200, { authenticated: true, username });
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/logout") {
    destroySession(req);
    clearSessionCookie(res);
    sendJson(res, 200, { authenticated: false });
    return;
  }

  if (!requireAdmin(req, res, pathname)) return;

  if (req.method === "POST" && pathname === "/api/admin/password") {
    const session = getSession(req);
    const payload = await readBody(req);
    const currentPassword = String(payload.currentPassword || "");
    const newPassword = String(payload.newPassword || "");
    const user = db.prepare("SELECT * FROM admin_users WHERE username = ?").get(session.username);
    if (!verifyPassword(currentPassword, user)) {
      sendJson(res, 400, { error: "Mevcut sifre hatali" });
      return;
    }
    if (newPassword.length < 6) {
      sendJson(res, 400, { error: "Yeni sifre en az 6 karakter olmali" });
      return;
    }
    const { hash, salt } = hashPassword(newPassword);
    db.prepare("UPDATE admin_users SET password_hash = ?, password_salt = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?")
      .run(hash, salt, session.username);
    sendJson(res, 200, { ok: true });
    return;
  }

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
      sendPdf(res, document.filename, document.title, document);
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
        missingFields: ["GidiÅŸ km", "DÃ¶nÃ¼ÅŸ km"],
        message: assistantPlan.distance?.warning || "Kilometre bilgisi eksik, lÃ¼tfen Google Maps Ã¼zerinden gidiÅŸ ve dÃ¶nÃ¼ÅŸ km girin."
      });
      return;
    }
    const tour = createTourFromPlan(assistantPlan, {
      title: `${assistantPlan.origin ? `${assistantPlan.origin} Ã‡Ä±kÄ±ÅŸlÄ± ` : ""}${assistantPlan.destination} AI Turu`,
      status: "AI ile oluÅŸturuldu"
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
    const allowedStatuses = ["Yeni", "ArandÄ±", "Teklif Verildi", "Kapora Bekleniyor", "SatÄ±ÅŸa DÃ¶nÃ¼ÅŸtÃ¼"];
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
      sendJson(res, 400, { error: plan.distance?.warning || "Kilometre bilgisi eksik, lÃ¼tfen Google Maps Ã¼zerinden gidiÅŸ ve dÃ¶nÃ¼ÅŸ km girin." });
      return;
    }
    const tour = createTourFromPlan(plan, {
      title: `${plan.destination} Lead Turu`,
      status: "Lead satÄ±ÅŸa dÃ¶nÃ¼ÅŸtÃ¼"
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
      "Ã–deme yok"
    );

    db.prepare(`
      UPDATE leads
      SET status = 'SatÄ±ÅŸa DÃ¶nÃ¼ÅŸtÃ¼', converted_tour_id = ?, converted_participant_id = ?
      WHERE id = ?
    `).run(tour.id, participantResult.lastInsertRowid, lead.id);

    sendJson(res, 201, {
      leadId: lead.id,
      status: "SatÄ±ÅŸa DÃ¶nÃ¼ÅŸtÃ¼",
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
