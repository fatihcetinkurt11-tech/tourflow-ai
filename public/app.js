const app = document.querySelector("#app");

let plannerResult = null;
let adminAssistantResult = null;
let tours = [];
let participants = [];
let deposits = [];
let leads = [];
let summary = null;
let costRules = [];
let adminSession = null;

const leadConvertEndpoint = (leadId) => `/api/leads/${leadId}/convert`;
const fmTravelLogoPath = "/assets/fm-travel-logo.png";
const caliskanDemoBase = "/demo/caliskan/admin";
const estemarDemoBase = "/demo/estemar/admin";

const caliskanDemo = {
  stats: [
    ["Toplam Lead", "36", "Sunum demo lead havuzu"],
    ["Aktif Tur", "18", "Planlanan operasyonlar"],
    ["Bekleyen Kapora", "9", "Takip edilecek ödemeler"],
    ["Tahmini Kâr", "248.000 TL", "Demo kârlılık özeti"]
  ],
  tours: [
    { name: "Umre Programı", duration: "12 gün", people: "35 kişi", status: "Kapora toplanıyor" },
    { name: "Hac Programı", duration: "45 gün", people: "40 kişi", status: "Kontenjan takipte" },
    { name: "Karadeniz Yaylalar Turu", duration: "5 gün", people: "28 kişi", status: "Satış aktif" },
    { name: "GAP Turu", duration: "4 gün", people: "32 kişi", status: "Program hazır" },
    { name: "Batum Turu", duration: "3 gün", people: "24 kişi", status: "Evrak kontrol" },
    { name: "Kapadokya Turu", duration: "2 gün", people: "20 kişi", status: "Rezervasyon" }
  ],
  leads: [
    { name: "Mehmet Yılmaz", tour: "Umre Programı", status: "Teklif Verildi" },
    { name: "Fatma Kaya", tour: "Karadeniz Turu", status: "Kapora Bekleniyor" },
    { name: "Hasan Demir", tour: "Hac Programı", status: "Satışa Dönüştü" },
    { name: "Ahmet Çelik", tour: "GAP Turu", status: "Arandı" }
  ],
  participants: [
    ["Ayşe Demir", "Umre Programı", "2 kişi", "Kapora alındı"],
    ["Mustafa Şahin", "Hac Programı", "1 kişi", "Evrak bekleniyor"],
    ["Zeynep Arslan", "GAP Turu", "4 kişi", "Ödeme planlandı"],
    ["Emre Koç", "Batum Turu", "2 kişi", "Koltuk ayrıldı"]
  ]
};

const estemarDemo = {
  stats: [
    ["Yeni Hasta Talebi", "24", "Demo hasta talep havuzu"],
    ["Bugünkü Randevu", "11", "Klinik operasyon akışı"],
    ["Bekleyen Ödeme", "8", "Takip edilecek tahsilatlar"],
    ["Aylık Tahmini Ciro", "1.450.000 TL", "Demo ciro özeti"]
  ],
  procedures: [
    "Burun Estetiği",
    "Meme Protezi",
    "Meme Küçültme",
    "Liposuction",
    "Abdominoplasti",
    "Göz Kapağı Estetiği",
    "Yüz Estetiği",
    "Kepçe Kulak",
    "Jinekomasti",
    "Saç Dökülmesi",
    "Cilt Lekeleri",
    "Akne",
    "Göz Altı Morlukları"
  ],
  patients: [
    { name: "Ayşe Yılmaz", procedure: "Burun Estetiği", status: "Teklif Verildi" },
    { name: "Fatma Demir", procedure: "Göz Kapağı Estetiği", status: "Randevu Oluşturuldu" },
    { name: "Mehmet Kaya", procedure: "Liposuction", status: "Kapora Alındı" },
    { name: "Zeynep Arslan", procedure: "Meme Protezi", status: "Kontrol Bekliyor" },
    { name: "Elif Şahin", procedure: "Cilt Lekeleri", status: "Arandı" }
  ],
  appointments: [
    ["09:30", "Ayşe Yılmaz", "Burun Estetiği ön görüşme", "Teklif görüşmesi"],
    ["11:00", "Fatma Demir", "Göz kapağı muayene", "Randevu oluşturuldu"],
    ["14:15", "Mehmet Kaya", "Liposuction planlama", "Kapora alındı"],
    ["16:00", "Zeynep Arslan", "Meme protezi kontrol", "Kontrol bekliyor"]
  ],
  whatsappMessages: [
    "Hoş geldiniz mesajı",
    "Randevu hatırlatma",
    "Fiyat teklifi",
    "İşlem sonrası bakım mesajı",
    "Kontrol randevusu mesajı"
  ],
  documents: [
    "Fiyat Teklifi",
    "Tedavi Planı",
    "Aydınlatılmış Onam Formu",
    "Kontrol Planı"
  ],
  doctor: {
    name: "Op. Dr. Hilmi Şen",
    specialty: "Plastik Rekonstrüktif ve Estetik Cerrahi",
    education: [
      "Çukurova Üniversitesi Tıp Fakültesi",
      "Ankara Eğitim ve Araştırma Hastanesi İhtisas"
    ],
    experience: [
      "Estemar Plastik ve Rekonstrüktif Estetik Cerrahi",
      "Megapark Hastanesi",
      "Adıyaman Eğitim ve Araştırma Hastanesi"
    ]
  }
};

function fmTravelLogoHtml(className = "") {
  return `
    <span class="fm-logo ${className}">
      <img src="${fmTravelLogoPath}" alt="FM Travel" onerror="this.hidden=true; this.nextElementSibling.hidden=false" />
      <span class="fm-logo-fallback" hidden><span>FM</span><small>Travel</small></span>
    </span>
  `;
}

const defaultClientCostRules = [
  { key: "vehicle", label: "Araç", type: "fm_vip_vehicle", unit: "km", unitPrice: 10 },
  { key: "guide", label: "Rehber", type: "fixed", unit: "tur", unitPrice: 6000 },
  { key: "insurance", label: "Sigorta", type: "per_person", unit: "kişi", unitPrice: 75 },
  { key: "photographer", label: "Fotoğrafçı", type: "fixed", unit: "tur", unitPrice: 0 },
  { key: "boat", label: "Tekne", type: "boat", unit: "tur/kişi", unitPrice: 0 },
  { key: "hotel", label: "Otel", type: "manual", unit: "manuel", unitPrice: 0 },
  { key: "other", label: "Diğer", type: "manual", unit: "manuel", unitPrice: 0 }
];

function money(value) {
  return `${Number(value || 0).toLocaleString("tr-TR")} TL`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function api(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 && location.pathname.startsWith("/admin")) {
      adminSession = { authenticated: false };
      renderAdminLogin();
    }
    throw new Error(payload.error || "Istek tamamlanamadi");
  }
  return response.json();
}

function buildClientPlan(data) {
  const destination = String(data.destination || "Trabzon").trim();
  const groupSize = Math.max(1, Number(data.groupSize || 2));
  const durationDays = Math.max(1, Number(data.durationDays || 4));
  const budget = Math.max(1000, Number(data.budget || 9000));
  const key = destination.toLocaleLowerCase("tr-TR");
  const profiles = [
    {
      terms: ["darende"],
      style: "Somuncu Baba, Tohma ve dogal su rotasi",
      places: ["Gunpinar Selalesi", "Tohma Kanyonu", "Somuncu Baba Kulliyesi", "Somuncu Baba Turbesi", "Kudret Havuzu", "Darende Carsisi", "Tarihi Darende Evleri"],
      accommodation: "Gunubirlik rotalarda konaklama gerekmez; cok gunlu planlarda Darende veya Malatya merkez tercih edilebilir.",
      transport: "Kahramanmaras cikisli gruplar icin soforlu ozel arac ve Darende icinde esnek mola planlamasi onerilir.",
      costs: { daily: 1850, activity: 450, guide: 3200, margin: 1.21 }
    },
    {
      terms: ["trabzon"],
      style: "Karadeniz doga ve yayla rotasi",
      places: ["Sumela Manastiri", "Uzungol", "Ataturk Kosku", "Cal Magarasi", "Boztepe", "Hidirnebi Yaylasi"],
      accommodation: "Trabzon merkez ve Uzungol/yayla hattinda kahvalti dahil butik konaklama onerilir.",
      transport: "Havalimani transferi ve yayla yollari icin soforlu ozel arac onerilir.",
      costs: { daily: 2350, activity: 700, guide: 3800, margin: 1.22 }
    },
    {
      terms: ["kapadokya", "cappadocia"],
      style: "vadi, balon ve kultur rotasi",
      places: ["Goreme Acik Hava Muzesi", "Pasabag", "Avanos", "Uchisar Kalesi", "Kizil Vadi", "Derinkuyu Yeralti Sehri"],
      accommodation: "Goreme, Uchisar veya Ortahisar'da tas otel onerilir.",
      transport: "Kayseri/Nevsehir transferi ve vadiler arasi ozel arac onerilir.",
      costs: { daily: 2650, activity: 1250, guide: 4200, margin: 1.24 }
    },
    {
      terms: ["halfeti"],
      style: "Firat kiyisi ve tekne rotasi",
      places: ["Savasan Koyu", "Rumkale", "Halfeti Tekne Turu", "Firat Nehri", "Eski Halfeti Sokaklari", "Birecik Kelaynak Merkezi"],
      accommodation: "Halfeti veya Sanliurfa merkezde butik otel onerilir.",
      transport: "Gaziantep/Sanliurfa cikisli ozel arac ve Halfeti tekne turu onerilir.",
      costs: { daily: 1900, activity: 650, guide: 3200, margin: 1.21 }
    },
    {
      terms: ["arsuz"],
      style: "Akdeniz sahil ve gastronomi rotasi",
      places: ["Arsuz Sahili", "Madenli Koyu", "Karaagac Plaji", "Iskenderun Sahili", "Titus Tuneli", "Besikli Magara"],
      accommodation: "Arsuz sahil hattinda denize yakin butik otel veya apart onerilir.",
      transport: "Hatay/Adana baglantili transfer ve sahil duraklari icin ozel arac onerilir.",
      costs: { daily: 2050, activity: 500, guide: 3000, margin: 1.2 }
    }
  ];
  const profile = profiles.find((item) => item.terms.some((term) => key.includes(term)));
  if (!profile) {
    const warning = "Bu destinasyon için yeterli veri bulunamadı";
    return {
      destination,
      groupSize,
      durationDays,
      budget,
      title: `${destination} tur planı`,
      plan: [warning],
      places: [],
      destinationWarning: warning,
      estimatedCost: { baseCost: 0, costPerPerson: 0, profit: 0, netProfit: 0, salesTotal: 0, pricePerPerson: 0 },
      costItems: [],
      distance: { outboundKm: null, returnKm: null, routeKm: null, missing: true, warning },
      accommodation: warning,
      transport: warning,
      guideRequired: false
    };
  }
  const guideRequired = groupSize >= 8 || durationDays >= 3;
  const rawOutboundKm = data.outboundKm ?? data.outbound_km;
  const rawReturnKm = data.returnKm ?? data.return_km;
  const hasDistance = rawOutboundKm !== undefined && rawOutboundKm !== "" && rawReturnKm !== undefined && rawReturnKm !== "";
  const outboundKm = hasDistance ? Math.max(0, Number(rawOutboundKm || 0)) : null;
  const returnKm = hasDistance ? Math.max(0, Number(rawReturnKm || 0)) : null;
  const routeKm = hasDistance ? outboundKm + 10 + returnKm : 0;
  const distanceWarning = "Kilometre bilgisi eksik, lütfen Google Maps üzerinden gidiş ve dönüş km girin.";
  const costItems = [
    { key: "vehicle", label: "Araç", type: "fm_vip_vehicle", quantity: routeKm, unit: "km formülü", unitPrice: 30, total: hasDistance ? routeKm * 30 : 0, formula: hasDistance ? `(${outboundKm} + 10 + ${returnKm}) x 10 x 3` : "Kilometre bilgisi eksik", warning: hasDistance ? "" : distanceWarning },
    { key: "guide", label: "Rehber", type: "fixed", quantity: 1, unit: "tur", unitPrice: 6000, total: 6000 },
    { key: "insurance", label: "Sigorta", type: "per_person", quantity: groupSize, unit: "kişi", unitPrice: 75, total: groupSize * 75 },
    { key: "boat", label: "Tekne", type: "fixed", quantity: key.includes("halfeti") ? 1 : 0, unit: "tur", unitPrice: key.includes("halfeti") ? 4500 : 0, total: key.includes("halfeti") ? 4500 : 0 },
    { key: "hotel", label: "Otel", type: "manual", quantity: 0, unit: "manuel", unitPrice: 0, total: 0 },
    { key: "other", label: "Diğer", type: "manual", quantity: 1, unit: "manuel", unitPrice: groupSize * profile.costs.activity, total: groupSize * profile.costs.activity }
  ];
  const baseCost = costItems.reduce((sum, item) => sum + item.total, 0);
  const salesTotal = Math.round(baseCost * profile.costs.margin);
  const pricePerPerson = Math.ceil(salesTotal / groupSize / 50) * 50;
  const costPerPerson = Math.ceil(baseCost / groupSize / 50) * 50;

  return {
    destination,
    groupSize,
    durationDays,
    budget,
    title: `${destination} ${durationDays} Gunluk ${profile.style}`,
    plan: Array.from({ length: durationDays }, (_, index) => {
      const primary = profile.places[index % profile.places.length];
      const secondary = profile.places[(index + 1) % profile.places.length];
      if (index === 0) return `1. gun: ${destination} varis, ${primary}, yerel lezzet molasi ve rahat tempo.`;
      if (index === durationDays - 1) return `${index + 1}. gun: ${primary}, ${secondary} ve donus hazirligi.`;
      return `${index + 1}. gun: ${primary}, ${secondary}, fotograf molalari ve serbest zaman.`;
    }),
    places: profile.places,
    estimatedCost: { baseCost, costPerPerson, profit: salesTotal - baseCost, netProfit: salesTotal - baseCost, salesTotal, pricePerPerson },
    costItems,
    distance: { outboundKm, returnKm, routeKm: hasDistance ? routeKm : null, missing: !hasDistance, warning: hasDistance ? "" : distanceWarning },
    accommodation: profile.accommodation,
    transport: profile.transport,
    guideRequired
  };
}

function parseClientTripMessage(message) {
  const text = String(message || "").trim();
  const lower = text.toLocaleLowerCase("tr-TR");
  const originMatch = text.match(/^(.{2,60}?)\s*(?:çıkışlı|cikisli|çıkış|cikis|Ã§Ä±k|Ã§ikis)/i);
  const peopleMatch = lower.match(/(\d+)\s*(?:kişilik|kisilik|kişi|kisi)/);
  const dayMatch = lower.match(/(\d+)\s*(?:günlük|gunluk|gün|gun)/);
  const known = ["Trabzon", "Kapadokya", "Halfeti", "Arsuz", "Rize", "Mardin", "Antalya"];
  const destination = known.find((item) => lower.includes(item.toLocaleLowerCase("tr-TR"))) || "Yeni Rota";
  return {
    message: text,
    origin: originMatch ? originMatch[1].trim() : "",
    destination,
    groupSize: Number(peopleMatch?.[1] || 2),
    durationDays: lower.includes("günübirlik") || lower.includes("gunubirlik") || lower.includes("birlik") ? 1 : Number(dayMatch?.[1] || 3),
    budget: 9000
  };
}

function parseClientTripMessage(message) {
  const text = String(message || "").trim();
  const lower = text.toLocaleLowerCase("tr-TR");
  const originMatch = text.match(/^(.{2,60}?)\s*(?:çıkışlı|cikisli|çıkış|cikis|Ã§Ä±kÄ±ÅŸlÄ±|Ã§Ä±kÄ±ÅŸ|ÃƒÂ§Ã„Â±k|ÃƒÂ§ikis)/i);
  const words = text.split(/\s+/).filter(Boolean);
  const normalize = (value) => String(value || "").toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll("ı", "i").replaceAll("ş", "s").replaceAll("ğ", "g").replaceAll("ü", "u").replaceAll("ö", "o").replaceAll("ç", "c");
  const originTokenIndex = words.findIndex((word) => /^cikisli$|^cikis$/.test(normalize(word)));
  const destinationText = originTokenIndex > -1 ? words.slice(originTokenIndex + 1).join(" ") : text.replace(originMatch?.[0] || "", " ");
  const destinationLower = destinationText.toLocaleLowerCase("tr-TR");
  const peopleMatch = lower.match(/(\d+)\s*(?:kişilik|kisilik|kişi|kisi|kiÅŸilik|kiÅŸi)/);
  const dayMatch = lower.match(/(\d+)\s*(?:günlük|gunluk|gün|gun|gÃ¼nlÃ¼k|gÃ¼n)/);
  const known = ["Darende", "Halfeti", "Arsuz", "Kapadokya", "Trabzon", "Sanliurfa", "Şanlıurfa", "Gaziantep", "Mardin", "Nemrut", "Adana"];
  const destination = known.find((item) => destinationLower.includes(item.toLocaleLowerCase("tr-TR"))) || "Yeni Rota";
  return {
    message: text,
    origin: originTokenIndex > 0 ? words.slice(0, originTokenIndex).join(" ") : (originMatch ? originMatch[1].trim() : ""),
    destination,
    groupSize: Number(peopleMatch?.[1] || 2),
    durationDays: lower.includes("günübirlik") || lower.includes("gunubirlik") || lower.includes("birlik") || lower.includes("gÃ¼nÃ¼birlik") ? 1 : Number(dayMatch?.[1] || 3),
    budget: 9000
  };
}

function buildClientAssistantPlan(message) {
  const parsed = parseClientTripMessage(message);
  const plan = buildClientPlan(parsed);
  return {
    ...plan,
    origin: parsed.origin,
    sourceMessage: parsed.message,
    assistantSummary: `${parsed.origin ? `${parsed.origin} çıkışlı ` : ""}${plan.groupSize} kişilik ${plan.destination} tur taslağı hazırlandı.`,
    whatsappMessage: `Merhaba, ${parsed.origin ? `${parsed.origin} çıkışlı ` : ""}${plan.destination} turu için program hazır. Rotada ${plan.places.slice(0, 4).join(", ")} var. Kişi başı tahmini ücret ${money(plan.estimatedCost.pricePerPerson)}.`,
    depositMessage: `Rezervasyonu netleştirmek için kişi başı ${money(Math.min(3000, Math.round(plan.estimatedCost.pricePerPerson * 0.3)))} kapora ile ulaşım ve konaklama opsiyonunu sabitleyebiliriz.`
  };
}

function costRows(items = []) {
  return `
    <div class="table-wrap">
      <table class="table cost-table">
        <thead><tr><th>Kalem</th><th>Miktar</th><th>Birim</th><th>Birim fiyat</th><th>Toplam</th></tr></thead>
        <tbody>${items.map((item) => `
          <tr>
            <td>${escapeHtml(item.label)}</td>
            <td>${escapeHtml(item.formula || Number(item.quantity || 0).toLocaleString("tr-TR"))}</td>
            <td>${escapeHtml(item.unit || "")}</td>
            <td>${money(item.unitPrice)}</td>
            <td><strong>${money(item.total)}</strong>${item.warning ? `<br><span class="warning-text">${escapeHtml(item.warning)}</span>` : ""}</td>
          </tr>
        `).join("")}</tbody>
      </table>
    </div>
  `;
}

function getLocalLeads() {
  return JSON.parse(localStorage.getItem("tourflowLocalLeads") || "[]");
}

function saveLocalLead(data, plan) {
  const lead = {
    id: `local-${Date.now()}`,
    destination: data.destination,
    groupSize: Number(data.groupSize),
    durationDays: Number(data.durationDays),
    budget: Number(data.budget),
    name: data.name,
    phone: data.phone,
    email: data.email,
    status: "Yeni",
    createdAt: new Date().toISOString(),
    plan
  };
  localStorage.setItem("tourflowLocalLeads", JSON.stringify([lead, ...getLocalLeads()]));
  return lead;
}

function payload(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function navigate(pathname) {
  history.pushState({}, "", pathname);
  render();
}

function plannerResultHtml(result) {
  return `
    <section class="planner-result" id="planner-result">
      <div class="result-grid">
        <section class="panel">
          <div class="panel-header">
            <h2>${escapeHtml(result.title)}</h2>
            <span class="badge green">${result.durationDays} gün · ${result.groupSize} kişi</span>
          </div>
          <div class="item-list">
            <article class="item">
              <h3>Gezi planı</h3>
              <ol class="program">${result.plan.map((day) => `<li>${escapeHtml(day)}</li>`).join("")}</ol>
            </article>
            <article class="item">
              <h3>Gezilecek yerler</h3>
              <div class="places">${result.places.map((place) => `<span class="badge sky">${escapeHtml(place)}</span>`).join("")}</div>
            </article>
            <div class="three-grid">
              <div class="metric"><span>Tahmini maliyet</span><strong>${money(result.estimatedCost.salesTotal)}</strong></div>
              <div class="metric"><span>Kişi başı maliyet</span><strong>${money(result.estimatedCost.costPerPerson)}</strong></div>
              <div class="metric"><span>Kişi başı</span><strong>${money(result.estimatedCost.pricePerPerson)}</strong></div>
            </div>
            <article class="item"><h3>Maliyet kalemleri</h3>${costRows(result.costItems)}</article>
            <article class="item"><h3>Konaklama önerileri</h3><p>${escapeHtml(result.accommodation)}</p></article>
            <article class="item"><h3>Ulaşım önerileri</h3><p>${escapeHtml(result.transport)}</p></article>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header"><h2>FM Travel ile organize edelim</h2></div>
          <form class="form" id="lead-form">
            <p class="lead">Bu geziyi FM Travel ile organize etmek ister misiniz?</p>
            <input type="hidden" name="destination" value="${escapeHtml(result.destination)}" />
            <input type="hidden" name="groupSize" value="${result.groupSize}" />
            <input type="hidden" name="durationDays" value="${result.durationDays}" />
            <input type="hidden" name="budget" value="${result.budget}" />
            <label>Ad soyad <input name="name" required /></label>
            <label>Telefon <input name="phone" required /></label>
            <label>E-posta <input name="email" type="email" required /></label>
            <button class="btn" type="submit">Bu geziyi FM Travel ile organize etmek ister misiniz?</button>
            <p class="muted" id="lead-status"></p>
          </form>
        </section>
      </div>
    </section>
  `;
}

function aiResultHtml(result) {
  return `
    <section class="panel ai-result-card">
      <div class="panel-header">
        <h2>AI tur taslağı</h2>
        <span class="badge green">${escapeHtml(result.destination)} · ${result.groupSize} kişi</span>
      </div>
      <div class="item-list">
        <p class="lead">${escapeHtml(result.assistantSummary || result.title)}</p>
        <div class="three-grid">
          <div class="metric"><span>Maliyet</span><strong>${money(result.estimatedCost.salesTotal)}</strong></div>
          <div class="metric"><span>Kişi başı maliyet</span><strong>${money(result.estimatedCost.costPerPerson)}</strong></div>
          <div class="metric"><span>Kâr</span><strong>${money(result.estimatedCost.profit)}</strong></div>
        </div>
        <article class="item"><h3>Maliyet kalemleri</h3>${costRows(result.costItems)}</article>
        <article class="item"><h3>Program</h3><ol class="program">${result.plan.map((day) => `<li>${escapeHtml(day)}</li>`).join("")}</ol></article>
        <article class="item"><h3>WhatsApp tanıtım metni</h3><div class="copy-box">${escapeHtml(result.whatsappMessage || "")}</div></article>
        <article class="item"><h3>Kapora mesajı</h3><div class="copy-box">${escapeHtml(result.depositMessage || "")}</div></article>
        ${result.distance?.missing ? `
          <article class="item missing-info-card">
            <h3>Eksik bilgiler</h3>
            <div class="warning-box">${escapeHtml(result.distance.warning)}</div>
            <form class="form" id="admin-ai-distance-form">
              <div class="form-grid">
                <label>Gidiş km <input name="outboundKm" type="number" min="0" placeholder="Google Maps gidiş km" required /></label>
                <label>Dönüş km <input name="returnKm" type="number" min="0" placeholder="Google Maps dönüş km" required /></label>
              </div>
              <button class="btn" type="submit">Km bilgisiyle turu oluştur</button>
              <p class="muted convert-status" id="admin-ai-distance-status" aria-live="polite"></p>
            </form>
          </article>
        ` : ""}
      </div>
    </section>
  `;
}

function renderPublic() {
  app.innerHTML = `
    <div class="public-shell">
      <header class="public-header">
        <a class="brand" href="/" data-link>
          ${fmTravelLogoHtml()}
          <span><strong>TourFlow AI</strong><small>Powered by FM Travel</small></span>
        </a>
        <a class="link-btn" href="/admin" data-link>FM Travel Admin Paneli</a>
      </header>

      <main class="hero">
        <section class="hero-copy">
          <p class="eyebrow">Premium tur teknolojisi</p>
          <h1>Talebinden Tura, Akıllı Yolculuk.</h1>
          <p class="lead">Seyahat planını saniyeler içinde oluştur, FM Travel ile güvenle organize et.</p>
          <div class="hero-points">
            <span>Dinamik rota</span>
            <span>Anlık maliyet</span>
            <span>Lead yönetimi</span>
          </div>
        </section>

        <section class="planner-stage">
          <section class="panel planner-card">
            <div class="panel-header"><h2>TourFlow AI asistanı</h2><span class="badge green">Sohbet</span></div>
            <form class="form ai-chat-form" id="public-ai-form">
              <label>Seyahat isteğini yaz
                <textarea name="message" required>Trabzon'a gitmek istiyorum. 2 kişiyiz, 4 günlük doğa ve yayla odaklı bir plan olsun.</textarea>
              </label>
              <button class="btn" type="submit">AI ile gezi planı oluştur</button>
              <p class="muted" id="public-ai-status"></p>
            </form>
          </section>

          <section class="panel compact-form-card">
            <div class="panel-header"><h2>Hızlı bilgi alanı</h2></div>
            <form class="form" id="planner-form">
              <label>Nereye gitmek istiyorum
                <input name="destination" value="Trabzon" required />
              </label>
              <div class="form-grid">
                <label>Kaç kişi
                  <input name="groupSize" type="number" min="1" value="2" required />
                </label>
                <label>Kaç gün
                  <input name="durationDays" type="number" min="1" value="4" required />
                </label>
              </div>
              <label>Bütçem
                <input name="budget" type="number" min="1000" value="9000" required />
              </label>
              <button class="btn" type="submit">Gezi talebi oluştur</button>
              <p class="muted" id="planner-status"></p>
            </form>
          </section>

          <aside class="sample-plan-card">
            <div class="sample-map">
              <span>AI</span>
            </div>
            <p class="eyebrow">Örnek plan</p>
            <h2>Kapadokya 3 Günlük Premium Rota</h2>
            <div class="places">
              <span class="badge green">Göreme</span>
              <span class="badge sky">Avanos</span>
              <span class="badge sun">Uçhisar</span>
            </div>
            <div class="sample-row"><span>Tahmini kişi başı</span><strong>12.950 TL</strong></div>
            <div class="sample-row"><span>Rehber</span><strong>Önerilir</strong></div>
          </aside>
        </section>
      </main>

      ${plannerResult ? plannerResultHtml(plannerResult) : ""}
    </div>
  `;
}

function renderPublicPremium() {
  const popularRoutes = [
    ["Halfeti", "Firat kiyisinda tekne, Rumkale ve sakin sokaklarla butik bir gun."],
    ["Arsuz", "Akdeniz sahili, gastronomi molalari ve ferah gunubirlik kacamak."],
    ["Kapadokya", "Vadiler, tas oteller ve fotograf duraklariyla premium rota."],
    ["Trabzon", "Yaylalar, Uzungol, Sumela ve Karadeniz dogasina ozel plan."],
    ["Darende", "Somuncu Baba, Tohma Kanyonu ve huzurlu kultur rotasi."],
    ["Sanliurfa", "Balikligol, Gobeklitepe ve lezzet duraklariyla dolu kesif."]
  ];

  app.innerHTML = `
    <div class="public-shell">
      <header class="public-header">
        <a class="brand" href="/" data-link>
          ${fmTravelLogoHtml()}
          <span><strong>TourFlow AI</strong><small>Powered by FM Travel</small></span>
        </a>
        <nav class="public-nav">
          <a class="link-btn" href="/about" data-link>Hakk&#305;m&#305;zda</a>
          <a class="link-btn" href="/admin" data-link>FM Travel Admin Paneli</a>
        </nav>
      </header>

      <main class="public-main">
        <section class="premium-hero">
          <div class="hero-bg" aria-hidden="true"></div>
          <section class="hero-copy">
            <p class="eyebrow">Premium seyahat teknolojisi</p>
            <h1>Hayalindeki geziyi yaz, sana özel tur planını saniyeler içinde oluşturalım.</h1>
            <p class="lead">TourFlow AI, seyahat isteğini analiz eder; rota, program, tahmini maliyet ve özel tur teklifini senin için hazırlar. FM Travel ekibi ise bu planı gerçeğe dönüştürür.</p>
            <a class="btn hero-cta" href="#ai-planner">Ücretsiz gezi planı oluştur</a>
            <div class="hero-points">
              <span>AI rota</span>
              <span>Premium teklif</span>
              <span>FM Travel takibi</span>
            </div>
          </section>

          <aside class="hero-preview">
            <span class="badge sun">Özel plan</span>
            <strong>Kahramanmaraş çıkışlı VIP tur akışı</strong>
            <p>Rota, maliyet ve teklif süreci tek ekranda hazırlanır.</p>
          </aside>
        </section>

        <section class="section-wrap planner-section" id="ai-planner">
          <div class="section-heading">
            <p class="eyebrow">AI gezi planlama</p>
            <h2>İsteğini yaz, ilk taslağı anında gör.</h2>
            <p class="muted">Doğal dille anlat; TourFlow AI rotayı, programı ve tahmini bütçeyi çıkarır.</p>
          </div>
          <div class="planner-stage premium-planner-grid">
            <section class="panel planner-card">
              <div class="panel-header"><h2>TourFlow AI asistanı</h2><span class="badge green">Sohbet</span></div>
              <form class="form ai-chat-form" id="public-ai-form">
                <label>Seyahat isteğini yaz
                  <textarea name="message" required>16 kişi Kahramanmaraş çıkışlı Darende günübirlik tur istiyoruz.</textarea>
                </label>
                <button class="btn" type="submit">Ücretsiz gezi planı oluştur</button>
                <p class="muted" id="public-ai-status"></p>
              </form>
            </section>

            <aside class="sample-plan-card premium-output-card">
              <p class="eyebrow">Örnek çıktı</p>
              <h2>Darende Günübirlik Tur</h2>
              <div class="output-list">
                <div><span>Rota</span><strong>Kahramanmaraş - Darende - Tohma</strong></div>
                <div><span>Program</span><strong>Somuncu Baba, kanyon yürüyüşü, öğle molası</strong></div>
                <div><span>Tahmini bütçe</span><strong>Kişi başı teklif taslağı</strong></div>
                <div><span>FM Travel teklif süreci</span><strong>Telefon bırakan misafir için özel takip</strong></div>
              </div>
            </aside>
          </div>
        </section>

        <section class="section-wrap quick-lead-section">
          <div class="section-heading">
            <p class="eyebrow">Hızlı başlangıç</p>
            <h2>Detayları biliyorsan hemen talep oluştur.</h2>
          </div>
          <section class="panel compact-form-card">
            <div class="panel-header"><h2>Hızlı bilgi alanı</h2></div>
            <form class="form" id="planner-form">
              <label>Nereye gitmek istiyorum
                <input name="destination" value="Darende" required />
              </label>
              <div class="form-grid">
                <label>Kaç kişi
                  <input name="groupSize" type="number" min="1" value="16" required />
                </label>
                <label>Kaç gün
                  <input name="durationDays" type="number" min="1" value="1" required />
                </label>
              </div>
              <label>Bütçem
                <input name="budget" type="number" min="1000" value="9000" required />
              </label>
              <button class="btn" type="submit">Gezi talebi oluştur</button>
              <p class="muted" id="planner-status"></p>
            </form>
          </section>
        </section>

        <section class="section-wrap trust-section">
          <div class="section-heading">
            <p class="eyebrow">Güven veren operasyon</p>
            <h2>Plan sadece güzel görünmez, uygulanabilir hazırlanır.</h2>
          </div>
          <div class="feature-grid">
            ${["Kahramanmaraş çıkışlı özel turlar", "VIP araç organizasyonu", "Kapora ile ön kayıt", "Kişiye özel tur planlama", "AI destekli hızlı teklif"].map((item) => `
              <article class="feature-card"><span></span><strong>${item}</strong><p>FM Travel operasyon deneyimiyle desteklenen net ve takip edilebilir süreç.</p></article>
            `).join("")}
          </div>
        </section>

        <section class="section-wrap routes-section">
          <div class="section-heading">
            <p class="eyebrow">Popüler rotalar</p>
            <h2>En çok istenen turlar için tek dokunuşla başla.</h2>
          </div>
          <div class="route-grid">
            ${popularRoutes.map(([name, description]) => `
              <article class="route-card">
                <div>
                  <span class="badge green">${name}</span>
                  <h3>${name}</h3>
                  <p>${description}</p>
                </div>
                <button class="link-btn" type="button" data-route-plan="${name}">Plan oluştur</button>
              </article>
            `).join("")}
          </div>
        </section>

        <section class="section-wrap how-section">
          <div class="section-heading">
            <p class="eyebrow">Nasıl çalışır?</p>
            <h2>Dört adımda fikirden teklife.</h2>
          </div>
          <div class="steps-grid">
            ${["Gezi isteğini yaz", "AI sana rota ve program çıkarsın", "Telefonunu bırak", "FM Travel sana özel teklif için ulaşsın"].map((step, index) => `
              <article class="step-card"><span>${index + 1}</span><strong>${step}</strong></article>
            `).join("")}
          </div>
        </section>

        <section class="final-cta">
          <div>
            <p class="eyebrow">Akıllı seyahat planlama</p>
            <h2>Bir sonraki yolculuğunu rastgele değil, akıllı planla.</h2>
          </div>
          <a class="btn" href="#ai-planner">Şimdi gezi planımı oluştur</a>
        </section>
      </main>

      ${plannerResult ? plannerResultHtml(plannerResult) : ""}
    </div>
  `;
}

function aboutPageHtml({ admin = false } = {}) {
  const achievements = [
    "Yapay zeka destekli tur planlama sistemi geli\u015ftirildi",
    "Kat\u0131l\u0131mc\u0131 ve m\u00fc\u015fteri y\u00f6netimi sistemi olu\u015fturuldu",
    "Kapora takip sistemi eklendi",
    "WhatsApp bilgilendirme ve ileti\u015fim merkezi kuruldu",
    "PDF kay\u0131t ve operasyon altyap\u0131s\u0131 geli\u015ftirildi",
    "Maliyet ve k\u00e2rl\u0131l\u0131k hesaplama sistemi olu\u015fturuldu",
    "Bulut altyap\u0131s\u0131na ta\u015f\u0131narak canl\u0131 yay\u0131na al\u0131nd\u0131",
    "FM Travel marka kimli\u011fi ve operasyon paneli olu\u015fturuldu"
  ];
  const team = [
    ["Fatih \u00c7etinkurt", "Kurucu & CEO", "FC"],
    ["Mahmut Can Usta", "Operasyon Direkt\u00f6r\u00fc", "MC"],
    ["Mustafa \u0130spir", "Operasyon ve Saha Koordinat\u00f6r\u00fc", "M\u0130"]
  ];
  const features = [
    "Yapay Zeka Destekli Tur Planlama",
    "Kat\u0131l\u0131mc\u0131 Y\u00f6netimi",
    "Kapora Takibi",
    "WhatsApp Merkezi",
    "PDF Evrak Sistemi",
    "Maliyet ve K\u00e2r Analizi",
    "Operasyon Y\u00f6netimi"
  ];

  return `
    <section class="about-page ${admin ? "about-page-admin" : ""}">
      <section class="about-hero">
        <div class="about-hero-copy">
          ${fmTravelLogoHtml("about-logo")}
          <p class="eyebrow">Premium seyahat operasyonu</p>
          <h1>FM Travel</h1>
          <p class="about-slogan">Yeni Rotalar, Yeni An&#305;lar</p>
          <p>FM Travel, Kahramanmara&#351; merkezli olarak insanlar&#305;n yeni yerler ke&#351;fetmesini, kaliteli ve g&#252;venli seyahat deneyimleri ya&#351;amas&#305;n&#305; sa&#287;lamak amac&#305;yla kurulmu&#351;tur.</p>
        </div>
        <aside class="about-hero-card">
          <span class="badge sun">Powered by TourFlow AI</span>
          <strong>Teknolojiyle g&#252;&#231;lenen turizm operasyonu</strong>
          <p>Lead, tur, kapora, PDF, WhatsApp ve maliyet s&#252;re&#231;leri tek premium operasyon merkezinde y&#246;netilir.</p>
        </aside>
      </section>

      <section class="about-grid">
        <article class="about-card about-story">
          <p class="eyebrow">B&#246;l&#252;m 1</p>
          <h2>Hikayemiz</h2>
          <p>TourFlow AI ise FM Travel'&#305;n operasyonlar&#305;n&#305; daha profesyonel y&#246;netebilmek i&#231;in geli&#351;tirilen yapay zeka destekli tur y&#246;netim sistemidir.</p>
        </article>
        <article class="about-card">
          <p class="eyebrow">B&#246;l&#252;m 2</p>
          <h2>Misyonumuz</h2>
          <p>Misafirlerimize g&#252;venli, kaliteli ve unutulmaz seyahat deneyimleri sunmak. Teknoloji ile turizmi birle&#351;tirerek planlama ve organizasyon s&#252;re&#231;lerini daha profesyonel hale getirmek.</p>
        </article>
        <article class="about-card">
          <p class="eyebrow">B&#246;l&#252;m 3</p>
          <h2>Vizyonumuz</h2>
          <p>Yapay zeka destekli turizm &#231;&#246;z&#252;mleriyle T&#252;rkiye'nin yenilik&#231;i ve g&#252;venilir tur organizasyon markalar&#305;ndan biri olmak.</p>
        </article>
      </section>

      <section class="about-card timeline-card">
        <div class="section-heading">
          <p class="eyebrow">Neler yapt&#305;k?</p>
          <h2>FM Travel operasyon altyap&#305;s&#305; ad&#305;m ad&#305;m g&#252;&#231;lendirildi.</h2>
        </div>
        <div class="about-timeline">
          ${achievements.map((item, index) => `
            <article>
              <span>${index + 1}</span>
              <p>${escapeHtml(item)}</p>
            </article>
          `).join("")}
        </div>
      </section>

      <section class="about-card">
        <div class="section-heading">
          <p class="eyebrow">B&#246;l&#252;m 4</p>
          <h2>Ekibimiz</h2>
        </div>
        <div class="team-grid">
          ${team.map(([name, role, initials]) => `
            <article class="team-card">
              <div class="team-photo">${escapeHtml(initials)}</div>
              <strong>${escapeHtml(name)}</strong>
              <span>${escapeHtml(role)}</span>
            </article>
          `).join("")}
        </div>
      </section>

      <section class="about-grid about-lower-grid">
        <article class="about-card">
          <p class="eyebrow">B&#246;l&#252;m 5</p>
          <h2>Sosyal Medya</h2>
          <a class="instagram-link" href="https://www.instagram.com/fmtraveltr" target="_blank" rel="noreferrer">@fmtraveltr</a>
        </article>
        <article class="about-card tourflow-card">
          <p class="eyebrow">B&#246;l&#252;m 6</p>
          <h2>TourFlow AI</h2>
          <p class="about-powered">Powered by TourFlow AI</p>
          <div class="about-feature-list">
            ${features.map((feature) => `<span>${escapeHtml(feature)}</span>`).join("")}
          </div>
        </article>
      </section>
    </section>
  `;
}

function renderPublicAbout() {
  app.innerHTML = `
    <div class="public-shell about-public-shell">
      <header class="public-header">
        <a class="brand" href="/" data-link>
          ${fmTravelLogoHtml()}
          <span><strong>TourFlow AI</strong><small>Powered by FM Travel</small></span>
        </a>
        <nav class="public-nav">
          <a class="link-btn" href="/" data-link>Ana sayfa</a>
          <a class="link-btn" href="/admin" data-link>FM Travel Admin Paneli</a>
        </nav>
      </header>
      <main class="public-main">
        ${aboutPageHtml()}
      </main>
    </div>
  `;
}

async function refreshAdmin() {
  const [summaryResult, toursResult, participantsResult, depositsResult, leadsResult, costRulesResult] = await Promise.allSettled([
    api("/api/admin/summary"),
    api("/api/tours"),
    api("/api/participants"),
    api("/api/deposits"),
    api("/api/leads"),
    api("/api/cost-rules")
  ]);

  tours = toursResult.status === "fulfilled" ? toursResult.value : [];
  participants = participantsResult.status === "fulfilled" ? participantsResult.value : [];
  deposits = depositsResult.status === "fulfilled" ? depositsResult.value : [];
  leads = leadsResult.status === "fulfilled" ? leadsResult.value : getLocalLeads();
  costRules = costRulesResult.status === "fulfilled" ? costRulesResult.value : defaultClientCostRules;

  summary = summaryResult.status === "fulfilled"
    ? summaryResult.value
    : {
        tours: tours.length,
        participants: participants.length,
        leads: leads.length,
        openDeposits: deposits.filter((row) => Number(row.remainingDeposit || 0) > 0).length,
        profit: tours.reduce((sum, tour) => sum + Number(tour.totals?.profit || 0), 0)
      };
}

async function requireAdminSession() {
  if (adminSession?.authenticated) return true;
  adminSession = await api("/api/admin/session");
  return Boolean(adminSession.authenticated);
}

function renderAdminLogin(message = "") {
  app.innerHTML = `
    <div class="auth-shell">
      <section class="auth-brand-panel">
        <a class="brand auth-brand" href="/" data-link>
          ${fmTravelLogoHtml("auth-logo")}
          <span><strong>TourFlow AI</strong><small>Powered by FM Travel</small></span>
        </a>
        <div class="auth-brand-copy">
          <p class="eyebrow">Premium operasyon teknolojisi</p>
          <h1>TourFlow AI Yönetim Paneli</h1>
          <h2>Yeni Rotalar, Yeni Anılar</h2>
          <p>Lead, tur, kapora ve operasyon yönetimini güvenle kontrol edin.</p>
        </div>
        <div class="auth-proof-grid">
          <article class="auth-feature-card">
            <i class="auth-feature-icon">&#128203;</i>
            <div class="auth-feature-text"><strong>Lead Y&#246;netimi</strong><span>Yeni m&#252;&#351;teri taleplerini y&#246;netin</span></div>
          </article>
          <article class="auth-feature-card">
            <i class="auth-feature-icon">&#128652;</i>
            <div class="auth-feature-text"><strong>Tur Y&#246;netimi</strong><span>Program ve kat&#305;l&#305;mc&#305;lar&#305; takip edin</span></div>
          </article>
          <article class="auth-feature-card">
            <i class="auth-feature-icon">&#128176;</i>
            <div class="auth-feature-text"><strong>Kapora Takibi</strong><span>&#214;deme durumlar&#305;n&#305; kontrol edin</span></div>
          </article>
          <article class="auth-feature-card">
            <i class="auth-feature-icon">&#128241;</i>
            <div class="auth-feature-text"><strong>WhatsApp Merkezi</strong><span>Bilgilendirme mesajlar&#305; olu&#351;turun</span></div>
          </article>
        </div>
      </section>

      <section class="panel auth-card">
        <div class="auth-card-head">
          <span class="auth-secure-icon" aria-hidden="true"></span>
          <span class="badge green">Güvenli giriş</span>
          <p class="auth-kicker">FM Travel Operasyon Merkezi</p>
          <h2>Admin girişi</h2>
          <p class="muted">TourFlow AI operasyon paneline devam etmek için bilgilerinizi girin.</p>
        </div>
        <form class="form auth-form" id="admin-login-form">
          <label>Kullanıcı adı <input name="username" value="admin" autocomplete="username" required /></label>
          <label>Şifre <input name="password" type="password" autocomplete="current-password" required /></label>
          <button class="btn" type="submit">Giriş yap</button>
          <p class="muted" id="admin-login-status">${escapeHtml(message)}</p>
        </form>
        <p class="auth-powered">Powered by FM Travel</p>
      </section>
    </div>
  `;
}

function caliskanLogoHtml() {
  return `
    <span class="caliskan-logo">
      <strong>ÇALIŞKAN TURİZM</strong>
      <small>Turizm ve Seyahat Acentası</small>
    </span>
  `;
}

function caliskanDemoShell(view, title, body) {
  const nav = [
    ["dashboard", caliskanDemoBase, "Dashboard"],
    ["leads", `${caliskanDemoBase}/leads`, "Lead Yönetimi"],
    ["tours", `${caliskanDemoBase}/tours`, "Tur Yönetimi"],
    ["participants", `${caliskanDemoBase}/participants`, "Katılımcılar"],
    ["deposits", `${caliskanDemoBase}/deposits`, "Kapora"],
    ["whatsapp", `${caliskanDemoBase}/whatsapp`, "WhatsApp Merkezi"],
    ["pdf", `${caliskanDemoBase}/pdf`, "PDF Merkezi"],
    ["about", `${caliskanDemoBase}/about`, "Hakkımızda"]
  ];

  app.innerHTML = `
    <div class="admin-shell caliskan-demo-shell">
      <aside class="sidebar caliskan-sidebar">
        <a class="brand" href="/demo/caliskan" data-link>
          ${caliskanLogoHtml()}
        </a>
        <span class="demo-ribbon">Demo Panel - TourFlow AI sunum amaçlıdır.</span>
        <nav class="nav">
          ${nav.map(([key, href, label]) => `<a class="nav-link ${view === key ? "active" : ""}" href="${href}" data-link>${label}</a>`).join("")}
        </nav>
      </aside>

      <main class="admin-content caliskan-content">
        <header class="admin-topbar caliskan-topbar">
          <div>
            <p class="eyebrow">Powered by TourFlow AI</p>
            <h1>${escapeHtml(title)}</h1>
            <p class="muted">Çalışkan Turizm için hazırlanmış izole satış demo paneli.</p>
          </div>
          <div class="quick-stats">
            <span class="badge sun">Demo mod</span>
            <span class="badge sky">Veritabani yok</span>
            <a class="link-btn" href="/admin" data-link>FM Travel paneli</a>
          </div>
        </header>
        <section class="view">${body}</section>
      </main>
    </div>
  `;
}

function renderCaliskanDemoDashboard() {
  caliskanDemoShell("dashboard", "Çalışkan Turizm Operasyon Paneli", `
    <div class="dashboard-cards caliskan-stats">
      ${caliskanDemo.stats.map(([label, value, note]) => `
        <article class="metric stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><p class="muted">${escapeHtml(note)}</p></article>
      `).join("")}
    </div>
    <div class="admin-grid">
      <section class="panel">
        <div class="panel-header"><h2>Aktif turlar</h2><a class="link-btn" href="${caliskanDemoBase}/tours" data-link>Tümünü aç</a></div>
        <div class="tour-list">
          ${caliskanDemo.tours.map((tour) => `
            <article class="tour-card">
              <div class="tour-head">
                <div>
                  <strong>${escapeHtml(tour.name)}</strong>
                  <p class="muted">${escapeHtml(tour.duration)} / ${escapeHtml(tour.people)}</p>
                </div>
                <span class="badge sun">${escapeHtml(tour.status)}</span>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Son leadler</h2><a class="link-btn" href="${caliskanDemoBase}/leads" data-link>Leadleri aç</a></div>
        <div class="item-list">
          ${caliskanDemo.leads.map((lead) => `
            <article class="item item-head">
              <div><strong>${escapeHtml(lead.name)}</strong><p class="muted">${escapeHtml(lead.tour)}</p></div>
              <span class="badge ${lead.status.includes("Satış") ? "green" : "sun"}">${escapeHtml(lead.status)}</span>
            </article>
          `).join("")}
        </div>
      </section>
    </div>
  `);
}

function renderCaliskanDemoLeads() {
  caliskanDemoShell("leads", "Lead Yönetimi", `
    <section class="panel">
      <div class="panel-header"><h2>Demo leadler</h2><span class="badge sun">Sabit veri</span></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Ad Soyad</th><th>Tur</th><th>Durum</th><th>Aksiyon</th></tr></thead>
          <tbody>${caliskanDemo.leads.map((lead) => `
            <tr>
              <td><strong>${escapeHtml(lead.name)}</strong></td>
              <td>${escapeHtml(lead.tour)}</td>
              <td><span class="badge ${lead.status.includes("Satış") ? "green" : "sun"}">${escapeHtml(lead.status)}</span></td>
              <td><button class="btn secondary" type="button">Demo teklif</button></td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>
    </section>
  `);
}

function renderCaliskanDemoTours() {
  caliskanDemoShell("tours", "Tur Yönetimi", `
    <section class="panel">
      <div class="panel-header"><h2>Demo aktif turlar</h2><span class="badge sun">${caliskanDemo.tours.length} program</span></div>
      <div class="tour-list">
        ${caliskanDemo.tours.map((tour) => `
          <article class="tour-card">
            <div class="tour-head">
              <div>
                <strong>${escapeHtml(tour.name)}</strong>
                <p class="muted">${escapeHtml(tour.duration)} / ${escapeHtml(tour.people)}</p>
              </div>
              <span class="badge sky">${escapeHtml(tour.status)}</span>
            </div>
            <div class="three-grid">
              <div class="metric"><span>Süre</span><strong>${escapeHtml(tour.duration)}</strong></div>
              <div class="metric"><span>Kapasite</span><strong>${escapeHtml(tour.people)}</strong></div>
              <div class="metric"><span>Operasyon</span><strong>Hazir</strong></div>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `);
}

function renderCaliskanDemoParticipants() {
  caliskanDemoShell("participants", "Katılımcılar", `
    <section class="panel">
      <div class="panel-header"><h2>Demo katılımcı listesi</h2><span class="badge sun">Örnek kayıtlar</span></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Katılımcı</th><th>Tur</th><th>Kişi</th><th>Durum</th></tr></thead>
          <tbody>${caliskanDemo.participants.map(([name, tour, people, status]) => `
            <tr><td><strong>${escapeHtml(name)}</strong></td><td>${escapeHtml(tour)}</td><td>${escapeHtml(people)}</td><td><span class="badge sun">${escapeHtml(status)}</span></td></tr>
          `).join("")}</tbody>
        </table>
      </div>
    </section>
  `);
}

function renderCaliskanDemoDeposits() {
  caliskanDemoShell("deposits", "Kapora", `
    <section class="panel">
      <div class="panel-header"><h2>Kapora takip özeti</h2><span class="badge sun">9 bekleyen</span></div>
      <div class="three-grid">
        <div class="metric"><span>Toplanan kapora</span><strong>184.000 TL</strong></div>
        <div class="metric"><span>Bekleyen kapora</span><strong>9</strong></div>
        <div class="metric"><span>Bugün aranacak</span><strong>4 kişi</strong></div>
      </div>
    </section>
  `);
}

function renderCaliskanDemoWhatsapp() {
  const message = "Merhaba, Çalışkan Turizm olarak tur programınız için ön kaydınızı aldık. Kapora ve kesin kayıt bilgileri için size yardımcı olabiliriz.";
  caliskanDemoShell("whatsapp", "WhatsApp Merkezi", `
    <div class="two-grid">
      <section class="panel">
        <div class="panel-header"><h2>Hazir demo mesajlari</h2></div>
        <div class="whatsapp-template-actions">
          <button class="btn secondary" type="button">Teklif mesaji</button>
          <button class="btn secondary" type="button">Kapora hatirlatma</button>
          <button class="btn secondary" type="button">Tur bilgisi</button>
          <button class="btn secondary" type="button">Evrak hatirlatma</button>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Mesaj önizleme</h2></div>
        <div class="item-list"><div class="copy-box">${escapeHtml(message)}</div></div>
      </section>
    </div>
  `);
}

function renderCaliskanDemoPdf() {
  caliskanDemoShell("pdf", "PDF Merkezi", `
    <section class="panel">
      <div class="panel-header"><h2>Demo PDF belgeleri</h2><span class="badge sun">Sunum önizleme</span></div>
      <div class="document-actions">
        <button class="btn secondary" type="button">Tur Kayıt Belgesi</button>
        <button class="btn secondary" type="button">Kapora Belgesi</button>
        <button class="btn secondary" type="button">Katılımcı Listesi</button>
        <button class="btn secondary" type="button">Tur Programı</button>
      </div>
      <p class="empty">Bu demo alanı gerçek PDF üretmez ve FM Travel belgelerine dokunmaz.</p>
    </section>
  `);
}

function renderCaliskanDemoAbout() {
  caliskanDemoShell("about", "Hakkımızda", `
    <section class="panel caliskan-about-panel">
      <div class="panel-header"><h2>Çalışkan Turizm</h2><span class="badge sun">1949</span></div>
      <div class="item-list">
        <article class="item">
          <h3>Marka</h3>
          <p>Çalışkan Havacılık Turizm ve Seyahat Acentası, 1949 yılında temelleri atılan köklü bir turizm markasıdır. Hac, Umre, kültür turları ve yurt dışı organizasyonlarında hizmet vermektedir.</p>
        </article>
        <article class="item">
          <h3>Yönetim</h3>
          <p><strong>Ahmet Küçükdağlı</strong> - Şirket Sahibi</p>
        </article>
      </div>
    </section>
  `);
}

function renderCaliskanDemo() {
  const route = location.pathname.replace(/\/$/, "");
  if (route === "/demo/caliskan" || route === caliskanDemoBase) return renderCaliskanDemoDashboard();
  if (route === `${caliskanDemoBase}/leads`) return renderCaliskanDemoLeads();
  if (route === `${caliskanDemoBase}/tours`) return renderCaliskanDemoTours();
  if (route === `${caliskanDemoBase}/participants`) return renderCaliskanDemoParticipants();
  if (route === `${caliskanDemoBase}/deposits`) return renderCaliskanDemoDeposits();
  if (route === `${caliskanDemoBase}/whatsapp`) return renderCaliskanDemoWhatsapp();
  if (route === `${caliskanDemoBase}/pdf`) return renderCaliskanDemoPdf();
  if (route === `${caliskanDemoBase}/about`) return renderCaliskanDemoAbout();
  return renderCaliskanDemoDashboard();
}

function estemarLogoHtml() {
  return `
    <span class="estemar-logo">
      <strong>Estemar</strong>
      <small>Plastik ve Rekonstrüktif Estetik Cerrahi</small>
    </span>
  `;
}

function estemarStatusBadge(status) {
  if (status.includes("Kapora") || status.includes("Randevu")) return "sky";
  if (status.includes("Kontrol")) return "silver";
  return "green";
}

function estemarDemoShell(view, title, body) {
  const nav = [
    ["dashboard", estemarDemoBase, "Dashboard"],
    ["patients", `${estemarDemoBase}/patients`, "Hasta Talepleri"],
    ["appointments", `${estemarDemoBase}/appointments`, "Randevular"],
    ["procedures", `${estemarDemoBase}/procedures`, "İşlem Yönetimi"],
    ["payments", `${estemarDemoBase}/payments`, "Ödeme Takibi"],
    ["whatsapp", `${estemarDemoBase}/whatsapp`, "WhatsApp Merkezi"],
    ["pdf", `${estemarDemoBase}/pdf`, "PDF Evrakları"],
    ["gallery", `${estemarDemoBase}/gallery`, "Öncesi / Sonrası Galeri"],
    ["about", `${estemarDemoBase}/about`, "Hakkımızda"]
  ];

  app.innerHTML = `
    <div class="admin-shell estemar-demo-shell">
      <aside class="sidebar estemar-sidebar">
        <a class="brand" href="/demo/estemar" data-link>
          ${estemarLogoHtml()}
        </a>
        <span class="demo-ribbon estemar-ribbon">Demo Panel - Flow AI sunum amaçlıdır.</span>
        <nav class="nav">
          ${nav.map(([key, href, label]) => `<a class="nav-link ${view === key ? "active" : ""}" href="${href}" data-link>${label}</a>`).join("")}
        </nav>
      </aside>

      <main class="admin-content estemar-content">
        <header class="admin-topbar estemar-topbar">
          <div>
            <p class="eyebrow">Powered by Flow AI</p>
            <h1>${escapeHtml(title)}</h1>
            <p class="muted">Estemar Plastik ve Rekonstrüktif Estetik Cerrahi · Kahramanmaraş</p>
          </div>
          <div class="quick-stats">
            <span class="badge sky">Klinik demo</span>
            <span class="badge silver">Veritabanı yok</span>
            <a class="link-btn" href="/admin" data-link>FM Travel paneli</a>
          </div>
        </header>
        <section class="view">${body}</section>
      </main>
    </div>
  `;
}

function renderEstemarDemoDashboard() {
  estemarDemoShell("dashboard", "Estemar Klinik Operasyon Paneli", `
    <div class="dashboard-cards estemar-stats">
      ${estemarDemo.stats.map(([label, value, note]) => `
        <article class="metric stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><p class="muted">${escapeHtml(note)}</p></article>
      `).join("")}
    </div>
    <div class="admin-grid">
      <section class="panel">
        <div class="panel-header"><h2>Hasta talepleri</h2><a class="link-btn" href="${estemarDemoBase}/patients" data-link>Talepleri aç</a></div>
        <div class="item-list">
          ${estemarDemo.patients.map((patient) => `
            <article class="item item-head">
              <div><strong>${escapeHtml(patient.name)}</strong><p class="muted">${escapeHtml(patient.procedure)}</p></div>
              <span class="badge ${estemarStatusBadge(patient.status)}">${escapeHtml(patient.status)}</span>
            </article>
          `).join("")}
        </div>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Bugünkü randevular</h2><a class="link-btn" href="${estemarDemoBase}/appointments" data-link>Takvimi aç</a></div>
        <div class="tour-list">
          ${estemarDemo.appointments.map(([time, name, procedure, status]) => `
            <article class="tour-card">
              <div class="tour-head">
                <div><strong>${escapeHtml(time)} · ${escapeHtml(name)}</strong><p class="muted">${escapeHtml(procedure)}</p></div>
                <span class="badge sky">${escapeHtml(status)}</span>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    </div>
  `);
}

function renderEstemarDemoPatients() {
  estemarDemoShell("patients", "Hasta Talepleri", `
    <section class="panel">
      <div class="panel-header"><h2>Demo hasta talepleri</h2><span class="badge sky">Sabit veri</span></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Hasta</th><th>İşlem</th><th>Durum</th><th>Aksiyon</th></tr></thead>
          <tbody>${estemarDemo.patients.map((patient) => `
            <tr>
              <td><strong>${escapeHtml(patient.name)}</strong></td>
              <td>${escapeHtml(patient.procedure)}</td>
              <td><span class="badge ${estemarStatusBadge(patient.status)}">${escapeHtml(patient.status)}</span></td>
              <td><button class="btn secondary" type="button">Demo takip</button></td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>
    </section>
  `);
}

function renderEstemarDemoAppointments() {
  estemarDemoShell("appointments", "Randevular", `
    <section class="panel">
      <div class="panel-header"><h2>Bugünkü randevu akışı</h2><span class="badge sky">11 randevu</span></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Saat</th><th>Hasta</th><th>İşlem</th><th>Durum</th></tr></thead>
          <tbody>${estemarDemo.appointments.map(([time, name, procedure, status]) => `
            <tr><td><strong>${escapeHtml(time)}</strong></td><td>${escapeHtml(name)}</td><td>${escapeHtml(procedure)}</td><td><span class="badge sky">${escapeHtml(status)}</span></td></tr>
          `).join("")}</tbody>
        </table>
      </div>
    </section>
  `);
}

function renderEstemarDemoProcedures() {
  estemarDemoShell("procedures", "İşlem Yönetimi", `
    <section class="panel">
      <div class="panel-header"><h2>Demo işlemler</h2><span class="badge silver">${estemarDemo.procedures.length} işlem</span></div>
      <div class="procedure-grid">
        ${estemarDemo.procedures.map((procedure, index) => `
          <article class="metric procedure-card">
            <span>İşlem ${index + 1}</span>
            <strong>${escapeHtml(procedure)}</strong>
            <p class="muted">Ön görüşme, teklif ve takip akışı hazır.</p>
          </article>
        `).join("")}
      </div>
    </section>
  `);
}

function renderEstemarDemoPayments() {
  estemarDemoShell("payments", "Ödeme Takibi", `
    <section class="panel">
      <div class="panel-header"><h2>Ödeme takip özeti</h2><span class="badge sky">8 bekleyen</span></div>
      <div class="three-grid">
        <div class="metric"><span>Alınan kapora</span><strong>420.000 TL</strong></div>
        <div class="metric"><span>Bekleyen ödeme</span><strong>8</strong></div>
        <div class="metric"><span>Aylık tahmini ciro</span><strong>1.450.000 TL</strong></div>
      </div>
    </section>
  `);
}

function renderEstemarDemoWhatsapp() {
  const message = "Merhaba, Estemar Klinik'e hoş geldiniz. Randevu ve işlem planınız için danışmanımız sizinle ilgilenecektir.";
  estemarDemoShell("whatsapp", "WhatsApp Merkezi", `
    <div class="two-grid">
      <section class="panel">
        <div class="panel-header"><h2>WhatsApp demo mesajları</h2></div>
        <div class="whatsapp-template-actions estemar-message-actions">
          ${estemarDemo.whatsappMessages.map((label) => `<button class="btn secondary" type="button">${escapeHtml(label)}</button>`).join("")}
        </div>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Mesaj önizleme</h2></div>
        <div class="item-list"><div class="copy-box">${escapeHtml(message)}</div></div>
      </section>
    </div>
  `);
}

function renderEstemarDemoPdf() {
  estemarDemoShell("pdf", "PDF Evrakları", `
    <section class="panel">
      <div class="panel-header"><h2>Demo PDF evrakları</h2><span class="badge silver">Sunum önizleme</span></div>
      <div class="document-actions">
        ${estemarDemo.documents.map((documentName) => `<button class="btn secondary" type="button">${escapeHtml(documentName)}</button>`).join("")}
      </div>
      <p class="empty">Bu demo alanı gerçek PDF üretmez ve FM Travel belgelerine dokunmaz.</p>
    </section>
  `);
}

function renderEstemarDemoGallery() {
  estemarDemoShell("gallery", "Öncesi / Sonrası Galeri", `
    <section class="panel">
      <div class="panel-header"><h2>Demo galeri</h2><span class="badge silver">Görsel placeholder</span></div>
      <div class="gallery-grid">
        ${["Burun Estetiği", "Göz Kapağı Estetiği", "Cilt Lekeleri"].map((label) => `
          <article class="gallery-placeholder">
            <div><span>Öncesi</span><span>Sonrası</span></div>
            <strong>${escapeHtml(label)}</strong>
            <p class="muted">Sunum amaçlı galeri alanı.</p>
          </article>
        `).join("")}
      </div>
    </section>
  `);
}

function renderEstemarDemoAbout() {
  const doctor = estemarDemo.doctor;
  estemarDemoShell("about", "Hakkımızda", `
    <div class="two-grid">
      <section class="panel estemar-about-panel">
        <div class="panel-header"><h2>Estemar</h2><span class="badge sky">Kahramanmaraş</span></div>
        <div class="item-list">
          <article class="item">
            <h3>Klinik</h3>
            <p>Estemar Plastik ve Rekonstrüktif Estetik Cerrahi, Kahramanmaraş'ta modern estetik cerrahi ve klinik takip süreçleriyle hizmet vermektedir.</p>
          </article>
          <article class="item">
            <h3>Doktor</h3>
            <p><strong>${escapeHtml(doctor.name)}</strong><br>${escapeHtml(doctor.specialty)}</p>
          </article>
          <article class="item">
            <h3>Hakkımızda</h3>
            <p>1978 doğumlu olan Op. Dr. Hilmi Şen, 2005 yılında Çukurova Üniversitesi Tıp Fakültesi'nden mezun olmuş, uzmanlık eğitimini Ankara Eğitim ve Araştırma Hastanesi'nde tamamlamıştır. Mecburi hizmetini Adıyaman Eğitim ve Araştırma Hastanesi'nde tamamlamış olup, bugün Kahramanmaraş'ta Estemar Plastik ve Rekonstrüktif Estetik Cerrahi Kliniği'nde hizmet vermektedir.</p>
          </article>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Eğitim ve deneyim</h2></div>
        <div class="item-list">
          <article class="item"><h3>Eğitim</h3><ul class="clean-list">${doctor.education.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></article>
          <article class="item"><h3>Deneyim</h3><ul class="clean-list">${doctor.experience.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></article>
        </div>
      </section>
    </div>
  `);
}

function renderEstemarDemo() {
  const route = location.pathname.replace(/\/$/, "");
  if (route === "/demo/estemar" || route === estemarDemoBase) return renderEstemarDemoDashboard();
  if (route === `${estemarDemoBase}/patients`) return renderEstemarDemoPatients();
  if (route === `${estemarDemoBase}/appointments`) return renderEstemarDemoAppointments();
  if (route === `${estemarDemoBase}/procedures`) return renderEstemarDemoProcedures();
  if (route === `${estemarDemoBase}/payments`) return renderEstemarDemoPayments();
  if (route === `${estemarDemoBase}/whatsapp`) return renderEstemarDemoWhatsapp();
  if (route === `${estemarDemoBase}/pdf`) return renderEstemarDemoPdf();
  if (route === `${estemarDemoBase}/gallery`) return renderEstemarDemoGallery();
  if (route === `${estemarDemoBase}/about`) return renderEstemarDemoAbout();
  return renderEstemarDemoDashboard();
}

function estemarDemoIcon(key) {
  const icons = {
    dashboard: "⌂",
    patients: "+",
    appointments: "◷",
    procedures: "◇",
    payments: "₺",
    whatsapp: "✉",
    pdf: "□",
    gallery: "◱",
    about: "i"
  };
  return icons[key] || "·";
}

function estemarDemoShell(view, title, body) {
  const nav = [
    ["dashboard", estemarDemoBase, "Dashboard"],
    ["patients", `${estemarDemoBase}/patients`, "Hasta Talepleri"],
    ["appointments", `${estemarDemoBase}/appointments`, "Randevular"],
    ["procedures", `${estemarDemoBase}/procedures`, "İşlem Yönetimi"],
    ["payments", `${estemarDemoBase}/payments`, "Ödeme Takibi"],
    ["whatsapp", `${estemarDemoBase}/whatsapp`, "WhatsApp Merkezi"],
    ["pdf", `${estemarDemoBase}/pdf`, "PDF Evrakları"],
    ["gallery", `${estemarDemoBase}/gallery`, "Öncesi / Sonrası"],
    ["about", `${estemarDemoBase}/about`, "Hakkımızda"]
  ];

  app.innerHTML = `
    <div class="estemar-admin-shell">
      <aside class="estemar-sidebar">
        <a class="estemar-brand" href="/demo/estemar" data-link>
          <span class="estemar-brand-mark">E</span>
          <span><strong>Estemar</strong><small>Clinic Operations</small></span>
        </a>
        <span class="estemar-demo-pill">Demo Panel - Flow AI sunum amaçlıdır.</span>
        <nav class="estemar-nav">
          ${nav.map(([key, href, label]) => `
            <a class="estemar-nav-link ${view === key ? "active" : ""}" href="${href}" data-link>
              <span class="estemar-nav-icon" aria-hidden="true">${estemarDemoIcon(key)}</span>
              <span>${label}</span>
            </a>
          `).join("")}
        </nav>
        <div class="estemar-sidebar-card">
          <span>Uzman Doktor</span>
          <strong>${escapeHtml(estemarDemo.doctor.name)}</strong>
          <small>${escapeHtml(estemarDemo.doctor.specialty)}</small>
        </div>
      </aside>

      <main class="estemar-main">
        <header class="estemar-admin-header">
          <div>
            <p class="estemar-kicker">Powered by Flow AI</p>
            <h1>${escapeHtml(title)}</h1>
            <p>Estemar Plastik ve Rekonstrüktif Estetik Cerrahi · Kahramanmaraş</p>
          </div>
          <div class="estemar-header-actions">
            <span class="estemar-badge rose">Klinik demo</span>
            <span class="estemar-badge silver">Sabit veri</span>
            <a class="estemar-ghost-btn" href="/admin" data-link>FM Travel paneli</a>
          </div>
        </header>
        <section class="estemar-view">${body}</section>
      </main>
    </div>
  `;
}

function renderEstemarDemoLanding() {
  const heroProcedures = estemarDemo.procedures.slice(0, 6);
  app.innerHTML = `
    <div class="estemar-public-shell">
      <header class="estemar-public-header">
        <a class="estemar-public-brand" href="/demo/estemar" data-link>
          <span class="estemar-brand-mark">E</span>
          <span><strong>Estemar</strong><small>Powered by Flow AI</small></span>
        </a>
        <nav>
          <a href="${estemarDemoBase}" data-link>Demo panel</a>
          <a href="${estemarDemoBase}/about" data-link>Doktor</a>
        </nav>
      </header>
      <main>
        <section class="estemar-landing-hero">
          <div class="estemar-hero-copy">
            <span class="estemar-demo-pill">Demo Panel - Flow AI sunum amaçlıdır.</span>
            <h1>Estemar Klinik Operasyon Paneli</h1>
            <p>Estetik cerrahi, hasta talebi, randevu, ödeme, WhatsApp ve klinik evrak süreçleri için özel hazırlanmış premium demo deneyimi.</p>
            <div class="estemar-hero-actions">
              <a class="estemar-primary-btn" href="${estemarDemoBase}" data-link>Paneli aç</a>
              <a class="estemar-ghost-btn" href="${estemarDemoBase}/patients" data-link>Hasta akışını gör</a>
            </div>
          </div>
          <aside class="estemar-hero-panel">
            <div class="estemar-doctor-card">
              <span>Op. Dr.</span>
              <strong>Hilmi Şen</strong>
              <p>Plastik Rekonstrüktif ve Estetik Cerrahi</p>
            </div>
            <div class="estemar-mini-stats">
              ${estemarDemo.stats.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
            </div>
          </aside>
        </section>
        <section class="estemar-landing-band">
          <div>
            <p class="estemar-kicker">Klinik Bilgileri</p>
            <h2>Estemar Plastik ve Rekonstrüktif Estetik Cerrahi</h2>
            <p>Kahramanmaraş merkezli klinik operasyonları için güven veren, temiz ve takip edilebilir sunum demosu.</p>
          </div>
          <div class="estemar-procedure-cloud">
            ${heroProcedures.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
          </div>
        </section>
      </main>
    </div>
  `;
}

function estemarPatientCards() {
  return estemarDemo.patients.map((patient) => `
    <article class="estemar-patient-card">
      <div>
        <strong>${escapeHtml(patient.name)}</strong>
        <p>${escapeHtml(patient.procedure)}</p>
      </div>
      <span class="estemar-badge ${estemarStatusBadge(patient.status)}">${escapeHtml(patient.status)}</span>
    </article>
  `).join("");
}

function estemarAppointmentCards() {
  return estemarDemo.appointments.map(([time, name, procedure, status]) => `
    <article class="estemar-appointment-card">
      <time>${escapeHtml(time)}</time>
      <div><strong>${escapeHtml(name)}</strong><p>${escapeHtml(procedure)}</p></div>
      <span class="estemar-badge sky">${escapeHtml(status)}</span>
    </article>
  `).join("");
}

function renderEstemarDemoDashboard() {
  estemarDemoShell("dashboard", "Estemar Klinik Operasyon Paneli", `
    <div class="estemar-metric-grid">
      ${estemarDemo.stats.map(([label, value, note], index) => `
        <article class="estemar-metric-card">
          <span class="estemar-metric-index">0${index + 1}</span>
          <p>${escapeHtml(label)}</p>
          <strong>${escapeHtml(value)}</strong>
          <small>${escapeHtml(note)}</small>
        </article>
      `).join("")}
    </div>
    <section class="estemar-command-strip">
      <div><span>Öncelikli takip</span><strong>Kapora alınan hastalara operasyon öncesi bilgilendirme</strong></div>
      <div><span>Bugünkü odak</span><strong>11 randevu, 5 yeni talep, 3 fiyat teklifi</strong></div>
      <div><span>Sunum modu</span><strong>Veriler sabit demo akışından okunur</strong></div>
    </section>
    <div class="estemar-dashboard-grid">
      <section class="estemar-panel">
        <div class="estemar-panel-header"><div><span>CRM</span><h2>Hasta talepleri</h2></div><a class="estemar-ghost-btn" href="${estemarDemoBase}/patients" data-link>Listeyi aç</a></div>
        <div class="estemar-card-list">${estemarPatientCards()}</div>
      </section>
      <section class="estemar-panel">
        <div class="estemar-panel-header"><div><span>Takvim</span><h2>Bugünkü randevular</h2></div><a class="estemar-ghost-btn" href="${estemarDemoBase}/appointments" data-link>Takvimi aç</a></div>
        <div class="estemar-card-list">${estemarAppointmentCards()}</div>
      </section>
    </div>
  `);
}

function renderEstemarDemoPatients() {
  estemarDemoShell("patients", "Hasta Talepleri", `
    <section class="estemar-panel">
      <div class="estemar-panel-header"><div><span>Hasta CRM</span><h2>Demo hasta talepleri</h2></div><span class="estemar-badge silver">Sabit veri</span></div>
      <div class="estemar-patient-grid">${estemarPatientCards()}</div>
    </section>
  `);
}

function renderEstemarDemoAppointments() {
  estemarDemoShell("appointments", "Randevular", `
    <section class="estemar-panel">
      <div class="estemar-panel-header"><div><span>Randevu Takvimi</span><h2>Bugünkü klinik akışı</h2></div><span class="estemar-badge rose">11 randevu</span></div>
      <div class="estemar-card-list estemar-appointment-list">${estemarAppointmentCards()}</div>
    </section>
  `);
}

function renderEstemarDemoProcedures() {
  estemarDemoShell("procedures", "İşlem Yönetimi", `
    <section class="estemar-panel">
      <div class="estemar-panel-header"><div><span>Prosedürler</span><h2>Klinik işlem kataloğu</h2></div><span class="estemar-badge silver">${estemarDemo.procedures.length} işlem</span></div>
      <div class="estemar-procedure-grid">
        ${estemarDemo.procedures.map((procedure, index) => `
          <article class="estemar-procedure-card">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <strong>${escapeHtml(procedure)}</strong>
            <p>Ön görüşme, teklif, randevu ve bakım takibi için demo akış hazır.</p>
          </article>
        `).join("")}
      </div>
    </section>
  `);
}

function renderEstemarDemoPayments() {
  estemarDemoShell("payments", "Ödeme Takibi", `
    <section class="estemar-panel">
      <div class="estemar-panel-header"><div><span>Finans</span><h2>Ödeme ve ciro özeti</h2></div><span class="estemar-badge sky">8 bekleyen</span></div>
      <div class="estemar-metric-grid compact">
        <article class="estemar-metric-card"><p>Alınan kapora</p><strong>420.000 TL</strong><small>Demo tahsilat toplamı</small></article>
        <article class="estemar-metric-card"><p>Bekleyen ödeme</p><strong>8</strong><small>Takipteki hasta dosyası</small></article>
        <article class="estemar-metric-card"><p>Aylık tahmini ciro</p><strong>1.450.000 TL</strong><small>Sunum amaçlı finans görünümü</small></article>
      </div>
    </section>
  `);
}

function renderEstemarDemoWhatsapp() {
  const message = `Merhaba Ayşe Hanım,
Estemar Klinik'e hoş geldiniz. Burun estetiği ön görüşmeniz için doktor değerlendirme notunuz ve size özel fiyat teklifiniz hazırlanmıştır.

Randevu: Bugün 14:30
Doktor: Op. Dr. Hilmi Şen
Konum: Kahramanmaraş Estemar Klinik

Randevuya gelirken varsa önceki muayene notlarınızı ve düzenli kullandığınız ilaç bilgisini yanınızda bulundurmanızı rica ederiz.`;
  estemarDemoShell("whatsapp", "WhatsApp Merkezi", `
    <div class="estemar-dashboard-grid">
      <section class="estemar-panel">
        <div class="estemar-panel-header"><div><span>Mesaj Şablonları</span><h2>WhatsApp demo mesajları</h2></div></div>
        <div class="estemar-action-grid">
          ${estemarDemo.whatsappMessages.map((label, index) => `<button class="estemar-template-btn" type="button"><span>0${index + 1}</span>${escapeHtml(label)}</button>`).join("")}
        </div>
      </section>
      <section class="estemar-panel">
        <div class="estemar-panel-header"><div><span>Önizleme</span><h2>Hasta mesajı</h2></div><span class="estemar-badge green">Hazır</span></div>
        <div class="estemar-message-preview">${escapeHtml(message)}</div>
      </section>
    </div>
  `);
}

function renderEstemarDemoPdf() {
  estemarDemoShell("pdf", "PDF Evrakları", `
    <div class="estemar-dashboard-grid">
      <section class="estemar-panel">
        <div class="estemar-panel-header"><div><span>Evrak Merkezi</span><h2>Demo PDF belgeleri</h2></div><span class="estemar-badge silver">Sunum önizleme</span></div>
        <div class="estemar-document-grid">
          ${estemarDemo.documents.map((documentName) => `
            <article class="estemar-document-card">
              <span>KLİNİK PDF</span>
              <strong>${escapeHtml(documentName)}</strong>
              <p>Hasta adı, işlem planı, teklif notu ve klinik onay alanlarını temsil eden demo belge.</p>
            </article>
          `).join("")}
        </div>
      </section>
      <aside class="estemar-panel estemar-report-preview">
        <div class="estemar-report-head"><span>ESTEMAR</span><strong>Fiyat Teklifi Önizleme</strong><small>Hasta: Ayşe Yılmaz · İşlem: Burun Estetiği</small></div>
        <div class="estemar-report-lines">
          <p><span>Doktor</span><strong>Op. Dr. Hilmi Şen</strong></p>
          <p><span>Plan</span><strong>Ön görüşme + işlem teklifi</strong></p>
          <p><span>Durum</span><strong>Teklif Verildi</strong></p>
        </div>
      </aside>
    </div>
  `);
}

function renderEstemarDemoGallery() {
  estemarDemoShell("gallery", "Öncesi / Sonrası Galeri", `
    <section class="estemar-panel">
      <div class="estemar-panel-header"><div><span>Galeri</span><h2>Öncesi / sonrası sunum alanı</h2></div><span class="estemar-badge silver">Placeholder</span></div>
      <div class="estemar-gallery-grid">
        ${["Burun Estetiği", "Göz Kapağı Estetiği", "Cilt Lekeleri"].map((label) => `
          <article class="estemar-gallery-card">
            <div><span>Öncesi</span><span>Sonrası</span></div>
            <strong>${escapeHtml(label)}</strong>
            <p>Hasta mahremiyetine uygun, klinik sunum için kilitli demo galeri alanı.</p>
            <small>Kimlik bilgisi gösterilmez</small>
          </article>
        `).join("")}
      </div>
    </section>
  `);
}

function renderEstemarDemoAbout() {
  const doctor = estemarDemo.doctor;
  estemarDemoShell("about", "Hakkımızda", `
    <div class="estemar-dashboard-grid">
      <section class="estemar-panel estemar-about-panel">
        <div class="estemar-panel-header"><div><span>Klinik Profili</span><h2>Estemar</h2></div><span class="estemar-badge rose">Kahramanmaraş</span></div>
        <div class="estemar-about-story">
          <h3>${escapeHtml(doctor.name)}</h3>
          <p><strong>${escapeHtml(doctor.specialty)}</strong></p>
          <p>1978 doğumlu olan Op. Dr. Hilmi Şen, 2005 yılında Çukurova Üniversitesi Tıp Fakültesi'nden mezun olmuş, uzmanlık eğitimini Ankara Eğitim ve Araştırma Hastanesi'nde tamamlamıştır. Mecburi hizmetini Adıyaman Eğitim ve Araştırma Hastanesi'nde tamamlamış olup, bugün Kahramanmaraş'ta Estemar Plastik ve Rekonstrüktif Estetik Cerrahi Kliniği'nde hizmet vermektedir.</p>
        </div>
      </section>
      <section class="estemar-panel">
        <div class="estemar-panel-header"><div><span>Akademik Geçmiş</span><h2>Eğitim ve deneyim</h2></div></div>
        <div class="estemar-timeline">
          <article><span>Eğitim</span>${doctor.education.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</article>
          <article><span>Deneyim</span>${doctor.experience.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</article>
        </div>
      </section>
    </div>
  `);
}

function renderEstemarDemo() {
  const route = location.pathname.replace(/\/$/, "");
  if (route === "/demo/estemar") return renderEstemarDemoLanding();
  if (route === estemarDemoBase) return renderEstemarDemoDashboard();
  if (route === `${estemarDemoBase}/patients`) return renderEstemarDemoPatients();
  if (route === `${estemarDemoBase}/appointments`) return renderEstemarDemoAppointments();
  if (route === `${estemarDemoBase}/procedures`) return renderEstemarDemoProcedures();
  if (route === `${estemarDemoBase}/payments`) return renderEstemarDemoPayments();
  if (route === `${estemarDemoBase}/whatsapp`) return renderEstemarDemoWhatsapp();
  if (route === `${estemarDemoBase}/pdf`) return renderEstemarDemoPdf();
  if (route === `${estemarDemoBase}/gallery`) return renderEstemarDemoGallery();
  if (route === `${estemarDemoBase}/about`) return renderEstemarDemoAbout();
  return renderEstemarDemoDashboard();
}

function renderNexoraHome() {
  const founderImage = "/assets/fatih-cetinkurt-founder.png";
  const services = [
    "Yapay zeka destekli yönetim panelleri",
    "CRM ve müşteri takip sistemleri",
    "WhatsApp otomasyonları",
    "PDF teklif ve rapor sistemleri",
    "Sektöre özel özel yazılım çözümleri"
  ];
  const projects = [
    ["TourFlow AI", "Turizm operasyon ve teklif sistemi"],
    ["FM Travel", "Canlı turizm operasyon altyapısı"],
    ["Çalışkan Turizm Demo", "Satış sunumu demo paneli"],
    ["Estemar Clinic AI", "Klinik CRM ve operasyon demosu"],
    ["Artiza", "Marka ve dijital ürün projesi"],
    ["Freza by Artiza", "Perakende marka deneyimi"]
  ];

  app.innerHTML = `
    <div class="nexora-shell">
      <header class="nexora-header">
        <a class="nexora-brand" href="/nexora" data-link>
          <span>N</span>
          <strong>NEXORA AI</strong>
        </a>
        <nav>
          <a href="#services">Hizmetler</a>
          <a href="#projects">Projeler</a>
          <a href="#founder">Kurucu</a>
          <a href="/nexora/community" data-link>Gençler İçin Yol Haritası</a>
        </nav>
      </header>

      <main>
        <section class="nexora-hero">
          <div class="nexora-hero-copy">
            <p class="nexora-kicker">AI Systems Studio</p>
            <h1>NEXORA AI</h1>
            <h2>Intelligent Systems for Modern Businesses</h2>
            <p>İşletmeler için yapay zeka destekli CRM, otomasyon ve yönetim sistemleri geliştiriyoruz.</p>
            <div class="nexora-actions">
              <a class="nexora-primary" href="#projects">Projeleri Gör</a>
              <a class="nexora-secondary" href="#founder">İletişime Geç</a>
              <a class="nexora-secondary" href="/nexora/community" data-link>Gençler İçin Yol Haritası</a>
            </div>
          </div>
          <aside class="nexora-orbit-panel">
            <div class="nexora-system-card active"><span>CRM</span><strong>Lead & müşteri takibi</strong></div>
            <div class="nexora-system-card"><span>Automation</span><strong>WhatsApp + PDF akışları</strong></div>
            <div class="nexora-system-card"><span>Dashboards</span><strong>Sektöre özel yönetim panelleri</strong></div>
          </aside>
        </section>

        <section class="nexora-section" id="services">
          <div class="nexora-section-head">
            <p class="nexora-kicker">Services</p>
            <h2>İşletmeler için yapay zeka destekli sistemler</h2>
          </div>
          <div class="nexora-service-grid">
            ${services.map((service, index) => `
              <article class="nexora-card">
                <span>0${index + 1}</span>
                <strong>${escapeHtml(service)}</strong>
                <p>Operasyonları sadeleştiren, satış takibini güçlendiren ve sunum kalitesini artıran özel yazılım akışı.</p>
              </article>
            `).join("")}
          </div>
        </section>

        <section class="nexora-section" id="projects">
          <div class="nexora-section-head">
            <p class="nexora-kicker">Projects</p>
            <h2>Geliştirilen sistem ve marka projeleri</h2>
          </div>
          <div class="nexora-project-grid">
            ${projects.map(([name, description]) => `
              <article class="nexora-project-card">
                <strong>${escapeHtml(name)}</strong>
                <p>${escapeHtml(description)}</p>
              </article>
            `).join("")}
          </div>
        </section>

        <section class="nexora-founder" id="founder">
          <div class="nexora-founder-photo">
            <img src="${founderImage}" alt="Fatih Çetinkurt" onerror="this.onerror=null; this.src='/assets/fatih-cetinkurt-founder.jpg';" />
          </div>
          <div class="nexora-founder-copy">
            <p class="nexora-kicker">Founder</p>
            <h2>Fatih Çetinkurt</h2>
            <h3>Founder &amp; CEO — Nexora AI</h3>
            <div class="nexora-founder-facts">
              <span>Doğum Yılı: 2006</span>
              <span>Konum: Kahramanmaraş, Türkiye</span>
              <span>Girişimci &amp; Yazılım Geliştirici</span>
            </div>
            <p>Fatih Çetinkurt, 2006 yılında doğmuş genç bir girişimci ve yazılım geliştiricisidir.</p>
            <p>Kahramanmaraş merkezli çalışmalar yürüten Fatih Çetinkurt; turizm teknolojileri, yapay zeka sistemleri, CRM çözümleri, sağlık teknolojileri, otomasyon sistemleri ve marka geliştirme alanlarında çalışmalar yürütmektedir.</p>
            <p>Nexora AI çatısı altında TourFlow AI, Estemar Clinic AI, FM Travel ve Çalışkan Turizm Demo gibi dijital projelerin yanında Artiza ve Freza by Artiza markaları üzerinde de çalışmalarına devam etmektedir.</p>
            <p>Vizyonu, farklı sektörlerde faaliyet gösteren işletmelere modern, ölçeklenebilir ve yapay zeka destekli sistemler sunarak dijital dönüşümlerine katkı sağlamaktır.</p>
          </div>
        </section>

        <section class="nexora-trust-strip">
          <article><strong>6+ Proje</strong><span>Aktif sistem ve marka çalışması</span></article>
          <article><strong>Turizm • Sağlık • Perakende</strong><span>Çok sektörlü deneyim</span></article>
          <article><strong>AI Destekli Sistemler</strong><span>CRM, otomasyon ve raporlama</span></article>
          <article><strong>Kahramanmaraş, Türkiye</strong><span>Yerelden globale ürün yaklaşımı</span></article>
        </section>

        <section class="nexora-collaborators">
          <div class="nexora-section-head">
            <p class="nexora-kicker">People</p>
            <h2>Birlikte Çalıştığımız İnsanlar</h2>
            <p>Destek verenler ve yol arkadaşları</p>
          </div>
          <article class="nexora-collab-card">
            <div class="nexora-collab-photo"><span>Fotoğraf alanı</span></div>
            <div>
              <p class="nexora-kicker">Destekçi ve fikir ortağı</p>
              <h3>Mahmut Can Usta</h3>
              <p>Mahmut Can Usta, girişimcilik yolculuğunda fikir alışverişi yapılan, destek veren ve projeler üzerine birlikte düşünülen isimlerden biridir.</p>
            </div>
          </article>
        </section>

        <section class="nexora-vision">
          <p class="nexora-kicker">Vision</p>
          <h2>Teknoloji ve girişimcilik ekosistemi</h2>
          <p>Tek bir sektöre bağlı kalmadan; turizm, sağlık, perakende ve hizmet sektörleri için yenilikçi markalar ve yapay zeka destekli sistemler geliştirerek büyüyen bir teknoloji ve girişimcilik ekosistemi oluşturmak.</p>
        </section>
      </main>
    </div>
  `;
}

function renderNexoraCommunity() {
  const supportItems = [
    "İş fikrini netleştirebiliriz",
    "Hedef kitleni belirleyebiliriz",
    "Basit bir yol haritası çıkarabiliriz",
    "Marka ismi ve sunum metni hazırlayabiliriz",
    "Web sitesi veya demo fikri oluşturabiliriz"
  ];

  app.innerHTML = `
    <div class="nexora-shell nexora-community-shell">
      <header class="nexora-header">
        <a class="nexora-brand" href="/nexora" data-link>
          <span>N</span>
          <strong>NEXORA AI</strong>
        </a>
        <nav>
          <a href="/nexora" data-link>Ana Sayfa</a>
          <a href="#story">Hikaye</a>
          <a href="#idea-form">Fikrimi Paylaş</a>
        </nav>
      </header>

      <main>
        <section class="nexora-community-hero">
          <div class="nexora-hero-copy">
            <p class="nexora-kicker">Community & Mentorship</p>
            <h1>Gençler İçin Yol Haritası</h1>
            <p>Bir fikrin varsa, nereden başlayacağını bilmiyorsan veya kendi işini kurmak istiyorsan; fikrini anlat, birlikte daha net, daha gerçekçi ve uygulanabilir bir yol haritası çıkaralım.</p>
            <div class="nexora-actions">
              <a class="nexora-primary" href="#idea-form">Fikrimi Paylaş</a>
              <a class="nexora-secondary" href="#story">Kuruluş Hikayesini Oku</a>
            </div>
          </div>
          <aside class="nexora-community-card">
            <span>Başlangıç noktası</span>
            <strong>Fikrini daha net, daha ciddi ve uygulanabilir hale getirmek.</strong>
            <p>Bu alan demo formdur; gençlerin fikirlerini düzenli biçimde anlatabilmesi için tasarlanmıştır.</p>
          </aside>
        </section>

        <section class="nexora-community-section" id="story">
          <p class="nexora-kicker">Story</p>
          <h2>Bu Noktaya Nasıl Geldik?</h2>
          <div class="nexora-story-grid">
            <article>
              <p>Fatih Çetinkurt, 2006 doğumlu genç bir girişimci olarak Kahramanmaraş’ta farklı iş fikirleri ve markalar üzerine çalışmaya başladı. İlk dönemlerde turizm, yerel markalar ve dijital projeler üzerinde denemeler yaptı. Artiza ile geleneksel el işçiliğini modern bir marka haline getirme fikrini geliştirdi. Freza by Artiza ile farklı bir gıda ve sunum konsepti üzerine düşündü.</p>
              <p>Bu süreçte bir fikrin sadece isimden ibaret olmadığını; sunum, sistem, müşteri takibi, teklif akışı ve operasyon düzeniyle birlikte güçlendiğini gördü. Turizm tarafında FM Travel operasyon sistemi ve TourFlow AI, satış ve tur yönetimi için daha düzenli bir yapı kurma fikrinden doğdu.</p>
              <p>Çalışkan Turizm Demo, bir markaya özel satış sunumunun nasıl hazırlanabileceğini gösteren ayrı bir örnek oldu. Estemar Clinic AI ise sağlık ve estetik alanında hasta talebi, randevu, ödeme, WhatsApp ve PDF evrak süreçlerinin tek panelde nasıl gösterilebileceğini ortaya koydu.</p>
              <p>Artiza ve Freza by Artiza gibi marka projeleri, yazılım dışında marka dili, ürün sunumu ve girişim fikri geliştirme tarafını besledi. Nexora AI ise tüm bu çalışmaların tek çatı altında toplandığı yapı olarak ortaya çıktı. Amaç; turizmden kliniğe, perakendeden hizmet sektörüne kadar farklı alanlarda işletmelere yapay zeka destekli sistemler sunmak.</p>
            </article>
            <aside>
              <span>Nexora AI</span>
              <strong>Marka, yazılım ve operasyon sistemlerini aynı çatı altında düşünmek.</strong>
              <p>Her proje, bir sonraki fikrin daha planlı ve daha uygulanabilir hale gelmesi için deneyim kazandırdı.</p>
            </aside>
          </div>
        </section>

        <section class="nexora-community-section">
          <p class="nexora-kicker">Support</p>
          <h2>Yol Arkadaşları ve İlk Destekler</h2>
          <p>Bu süreçte çevresindeki insanların fikirleri, desteği ve güveni de önemli rol oynadı. Mahmut Can Usta, hem yakın çevreden gelen desteklerden biri hem de girişimcilik yolculuğunda fikir alışverişi yapılan kişilerden biri olarak bu hikayenin doğal bir parçası oldu. Projeler, fikirler ve yeni denemeler üzerine yapılan sohbetler bu yolculuğun daha sağlam ilerlemesine katkı sağladı.</p>
        </section>

        <section class="nexora-community-section">
          <p class="nexora-kicker">Message</p>
          <h2>Bir Fikrin Varsa Bekleme</h2>
          <p>Nexora AI’ın amacı sadece işletmelere sistem geliştirmek değil; aynı zamanda gençlerin fikirlerini daha ciddi, daha planlı ve daha uygulanabilir hale getirmelerine yardımcı olmaktır. Fikrini anlat; hangi problemi çözdüğünü, kimlere ulaşacağını ve ilk adımı nasıl atacağını birlikte sadeleştirelim.</p>
          <div class="nexora-support-grid">
            ${supportItems.map((item) => `<article><span>•</span><strong>${escapeHtml(item)}</strong></article>`).join("")}
          </div>
        </section>

        <section class="nexora-community-form-section" id="idea-form">
          <div>
            <p class="nexora-kicker">Share Your Idea</p>
            <h2>Soru Sor / Fikir Paylaş</h2>
            <p>Fikrini kısa ve net anlat. Bu form şimdilik sadece demo görünümüdür; herhangi bir backend kaydı oluşturmaz.</p>
          </div>
          <form class="nexora-idea-form">
            <label>Ad Soyad <input name="name" placeholder="Adını yaz" /></label>
            <label>Yaş <input name="age" placeholder="Örn. 18" /></label>
            <label>Şehir <input name="city" placeholder="Örn. Kahramanmaraş" /></label>
            <label>Fikrin / Sorun <textarea name="idea" placeholder="Aklındaki fikri veya çözmek istediğin problemi anlat"></textarea></label>
            <label>Ne konuda destek istiyorsun? <textarea name="support" placeholder="Marka, yazılım, web sitesi, sunum, yol haritası..."></textarea></label>
            <label>İletişim bilgisi <input name="contact" placeholder="Telefon, Instagram veya e-posta" /></label>
            <button class="nexora-primary" type="button">Demo Formu İncele</button>
            <p>Bu form demo amaçlıdır. Gerçek iletişim için WhatsApp veya Instagram üzerinden ulaşabilirsiniz.</p>
          </form>
        </section>
      </main>
    </div>
  `;
}

function adminShell(view, title, body) {
  const nav = [
    ["dashboard", "/admin", "Dashboard"],
    ["leads", "/admin/leads", "Leadler"],
    ["tours", "/admin/tours", "Tur Yönetimi"],
    ["participants", "/admin/participants", "Katılımcılar"],
    ["deposits", "/admin/deposits", "Kapora"],
    ["profit", "/admin/profit", "Kâr"],
    ["whatsapp", "/admin/whatsapp", "WhatsApp"],
    ["about", "/admin/about", "Hakk\u0131m\u0131zda"]
  ];

  app.innerHTML = `
    <div class="admin-shell">
      <aside class="sidebar">
        <a class="brand" href="/" data-link>
          ${fmTravelLogoHtml("sidebar-logo")}
          <span><strong>TourFlow AI</strong><small>Powered by FM Travel</small></span>
        </a>
        <nav class="nav">
          ${nav.map(([key, href, label]) => `<a class="nav-link ${view === key ? "active" : ""}" href="${href}" data-link>${label}</a>`).join("")}
        </nav>
      </aside>

      <main class="admin-content">
        <header class="admin-topbar">
          <div>
            <p class="eyebrow">SaaS-ready operasyon paneli</p>
            <h1>${escapeHtml(title)}</h1>
          </div>
          <div class="quick-stats">
            <span class="badge green">${summary.tours} tur</span>
            <span class="badge sky">${summary.participants} katılımcı</span>
            <span class="badge sun">${summary.openDeposits} açık kapora</span>
            <span class="badge clay">${summary.leads} lead</span>
            <button class="link-btn logout-btn" type="button" data-admin-logout>Cikis yap</button>
          </div>
        </header>
        <section class="view">${body}</section>
      </main>
    </div>
  `;
}

function tourCard(tour) {
  return `
    <article class="tour-card clickable-card" data-tour-detail="${tour.id}">
      <div class="tour-head">
        <div>
          <strong>${escapeHtml(tour.title)}</strong>
          <p class="muted">${escapeHtml(tour.destination)} · ${tour.durationDays} gün · ${tour.groupSize} kişi</p>
        </div>
        <span class="badge ${tour.status.includes("Kapora") ? "sun" : "green"}">${escapeHtml(tour.status)}</span>
      </div>
      <div class="places">${tour.places.map((place) => `<span class="badge sky">${escapeHtml(place)}</span>`).join("")}</div>
      <div class="three-grid">
        <div class="metric"><span>Toplam maliyet</span><strong>${money(tour.totals.baseCost)}</strong></div>
        <div class="metric"><span>Kişi başı maliyet</span><strong>${money(tour.totals.costPerPerson)}</strong></div>
        <div class="metric"><span>Net kâr</span><strong>${money(tour.totals.netProfit)}</strong></div>
        <div class="metric"><span>Kişi başı</span><strong>${money(tour.totals.pricePerPerson)}</strong></div>
      </div>
      ${tour.totals.costItems?.length ? costRows(tour.totals.costItems) : ""}
      <div class="detail-actions">
        <a class="link-btn" href="/admin/tours/${tour.id}" data-link>Tur detayını aç</a>
      </div>
    </article>
  `;
}

function tourOptions() {
  return tours.map((tour) => `<option value="${tour.id}">${escapeHtml(tour.title)}</option>`).join("");
}

function leadStatusOptions(activeStatus) {
  return ["Yeni", "Arandı", "Teklif Verildi", "Kapora Bekleniyor", "Satışa Dönüştü"]
    .map((status) => `<option value="${escapeHtml(status)}" ${status === activeStatus ? "selected" : ""}>${escapeHtml(status)}</option>`)
    .join("");
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(String(value).replace(" ", "T")));
}

function leadOfferPrice(lead) {
  return Number(lead?.plan?.estimatedCost?.pricePerPerson || lead?.budget || 0);
}

function leadWhatsappMessage(lead) {
  return `Merhaba ${lead.name || "değerli misafirimiz"},
${lead.destination} talebiniz için size özel gezi planınızı hazırladık.
Kişi sayısı: ${lead.groupSize}
Süre: ${lead.durationDays} gün
Tahmini kişi başı ücret: ${money(leadOfferPrice(lead))}
Detaylı bilgi ve rezervasyon için size yardımcı olabiliriz.`;
}

function whatsappPhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `90${digits.slice(1)}`;
  if (digits.length === 10) digits = `90${digits}`;
  return digits;
}

function leadWhatsappUrl(lead) {
  const phone = whatsappPhone(lead.phone);
  return `https://wa.me/${phone}?text=${encodeURIComponent(leadWhatsappMessage(lead))}`;
}

const participantWhatsappTemplates = {
  depositReminder: "Kapora hatirlatma mesaji",
  tourInfo: "Tur bilgilendirme mesaji",
  departureTime: "Hareket saati mesaji",
  remainingPayment: "Kalan odeme hatirlatma mesaji"
};

function participantWhatsappMessage(type, tour, participant, logistics) {
  const name = participant.name || "degerli misafirimiz";
  const tourName = tour.title || tour.destination;
  const tourDate = tour.startDate || "-";
  const deposit = money(participant.depositPaid);
  const remainingPayment = money(participant.remainingPayment);
  const departureTime = logistics.departureTime || "-";
  const departurePoint = logistics.departurePoint || "-";

  const fields = `

Ad Soyad: ${name}
Tur Adi: ${tourName}
Tur Tarihi: ${tourDate}
Kapora: ${deposit}
Kalan odeme: ${remainingPayment}
Kalkis saati: ${departureTime}
Kalkis noktasi: ${departurePoint}`;

  if (type === "depositReminder") {
    return `Merhaba ${name}, ${tourName} turu icin kapora durumunuzu hatirlatmak isteriz. Rezervasyonun netlesmesi icin kapora odemenizi tamamlayabilirsiniz.${fields}`;
  }
  if (type === "tourInfo") {
    return `Merhaba ${name}, ${tourName} turunuz icin bilgilendirme mesajidir. Tur tarihimiz ${tourDate}. Kalkis noktasi ve hareket bilgileri asagidadir.${fields}`;
  }
  if (type === "departureTime") {
    return `Merhaba ${name}, ${tourName} turu hareket saati hatirlatmasidir. Lutfen ${departureTime} saatinde ${departurePoint} noktasinda hazir olunuz.${fields}`;
  }
  return `Merhaba ${name}, ${tourName} turu icin kalan odeme hatirlatmasidir. Kalan odeme tutariniz ${remainingPayment}. Tur oncesinde odemenizi tamamlayabilirsiniz.${fields}`;
}

function participantWhatsappLinksHtml(type, tour, tourParticipants, logistics) {
  if (!tourParticipants.length) {
    return '<div class="warning-box">WhatsApp linki olusturmak icin once katilimci ekleyin.</div>';
  }

  return `
    <div class="whatsapp-result-head">
      <strong>${escapeHtml(participantWhatsappTemplates[type] || participantWhatsappTemplates.depositReminder)}</strong>
      <span class="badge green">${tourParticipants.length} katilimci</span>
    </div>
    <div class="whatsapp-link-list">
      ${tourParticipants.map((participant) => {
        const phone = whatsappPhone(participant.phone);
        const message = participantWhatsappMessage(type, tour, participant, logistics);
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        return `
          <article class="whatsapp-link-card">
            <div>
              <strong>${escapeHtml(participant.name)}</strong>
              <p class="muted">${escapeHtml(participant.phone)} · ${money(participant.remainingPayment)} kalan odeme</p>
            </div>
            <a class="btn secondary ${phone ? "" : "disabled-link"}" href="${phone ? url : "#"}" target="_blank" rel="noopener">WhatsApp'ta ac</a>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function participantPaymentBadge(status) {
  if (status === "Ödeme tamamlandı") return "green";
  if (status === "Kısmi ödeme") return "sun";
  return "red";
}

function leadCard(lead) {
  const requestedTrip = `${lead.destination} · ${lead.groupSize} kişi · ${lead.durationDays} gün · ${money(lead.budget)}`;
  const isConverted = lead.status === "Satışa Dönüştü";
  return `
    <article class="tour-card lead-card clickable-card" data-lead-detail="${lead.id}">
      <div class="tour-head">
        <div>
          <strong>${escapeHtml(lead.name || "İsimsiz lead")}</strong>
          <p class="muted">${escapeHtml(lead.phone)} · ${escapeHtml(lead.email)}</p>
        </div>
        <span class="badge ${isConverted ? "green" : lead.status === "Yeni" ? "clay" : "sun"}">${escapeHtml(lead.status)}</span>
      </div>
      <div class="three-grid">
        <div class="metric"><span>İstenen gezi</span><strong>${escapeHtml(lead.destination)}</strong></div>
        <div class="metric"><span>Detay</span><strong>${escapeHtml(`${lead.groupSize} kişi / ${lead.durationDays} gün`)}</strong></div>
        <div class="metric"><span>Oluşturulma</span><strong>${escapeHtml(formatDateTime(lead.createdAt))}</strong></div>
      </div>
      <p class="muted">${escapeHtml(requestedTrip)}</p>
      <div class="lead-actions">
        <label>Durum
          <select data-lead-status="${lead.id}">
            ${leadStatusOptions(lead.status)}
          </select>
        </label>
        <a class="btn secondary" href="${leadWhatsappUrl(lead)}" target="_blank" rel="noopener">
          WhatsApp teklif gönder
        </a>
        <a class="link-btn lead-detail-link" href="/admin/leads/${lead.id}" data-link>Detay</a>
        <button class="btn" type="button" data-convert-lead="${lead.id}" ${isConverted ? "disabled" : ""}>
          Satışa dönüştür ve tura aktar
        </button>
        <p class="muted convert-status" data-convert-status="${lead.id}" aria-live="polite"></p>
      </div>
    </article>
  `;
}

async function renderLeads() {
  await refreshAdmin();
  adminShell("leads", "Leadler", `
    <section class="panel">
      <div class="panel-header">
        <h2>Public sayfadan gelen talepler</h2>
        <span class="badge clay">${leads.length} lead</span>
      </div>
      <div class="tour-list">
        ${leads.length ? leads.map(leadCard).join("") : '<p class="empty">Henüz lead yok. Public planner üzerinden talep bırakıldığında burada görünecek.</p>'}
      </div>
    </section>
  `);
}

async function renderLeadDetail(id) {
  await refreshAdmin();
  let lead = leads.find((item) => Number(item.id) === Number(id));
  try {
    lead = await api(`/api/leads/${id}`);
  } catch (error) {
    if (!lead) throw error;
  }

  const plan = lead.plan || {};
  const cost = plan.estimatedCost || {};
  const isConverted = lead.status === "Satışa Dönüştü";
  const message = leadWhatsappMessage(lead);

  adminShell("leads", "Lead Detayı", `
    <div class="detail-toolbar">
      <a class="link-btn" href="/admin/leads" data-link>Leadlere dön</a>
      <span class="badge ${isConverted ? "green" : "clay"}">${escapeHtml(lead.status)}</span>
    </div>
    <div class="lead-detail-grid">
      <section class="panel">
        <div class="panel-header"><h2>Müşteri bilgileri</h2></div>
        <div class="item-list">
          <div class="three-grid">
            <div class="metric"><span>Ad soyad</span><strong>${escapeHtml(lead.name || "-")}</strong></div>
            <div class="metric"><span>Telefon</span><strong>${escapeHtml(lead.phone || "-")}</strong></div>
            <div class="metric"><span>E-posta</span><strong>${escapeHtml(lead.email || "-")}</strong></div>
          </div>
          <div class="three-grid">
            <div class="metric"><span>İstenen gezi</span><strong>${escapeHtml(lead.destination)}</strong></div>
            <div class="metric"><span>Kişi / süre</span><strong>${escapeHtml(`${lead.groupSize} kişi / ${lead.durationDays} gün`)}</strong></div>
            <div class="metric"><span>Oluşturulma</span><strong>${escapeHtml(formatDateTime(lead.createdAt))}</strong></div>
          </div>
          <label>Durum
            <select data-lead-status="${lead.id}">
              ${leadStatusOptions(lead.status)}
            </select>
          </label>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header"><h2>WhatsApp teklif mesajı</h2></div>
        <div class="item-list">
          <div class="copy-box">${escapeHtml(message)}</div>
          <div class="detail-actions">
            <a class="btn" href="${leadWhatsappUrl(lead)}" target="_blank" rel="noopener">WhatsApp teklif gönder</a>
            <button class="btn secondary" type="button" data-convert-lead="${lead.id}" ${isConverted ? "disabled" : ""}>
              Satışa dönüştür ve tura aktar
            </button>
            <p class="muted convert-status" data-convert-status="${lead.id}" aria-live="polite"></p>
          </div>
        </div>
      </section>
    </div>

    <section class="panel">
      <div class="panel-header">
        <h2>AI planı</h2>
        <span class="badge green">${escapeHtml(plan.title || lead.destination)}</span>
      </div>
      <div class="item-list">
        <div class="three-grid">
          <div class="metric"><span>Toplam satış</span><strong>${money(cost.salesTotal)}</strong></div>
          <div class="metric"><span>Kişi başı ücret</span><strong>${money(cost.pricePerPerson || leadOfferPrice(lead))}</strong></div>
          <div class="metric"><span>Net kâr</span><strong>${money(cost.profit || cost.netProfit)}</strong></div>
        </div>
        ${plan.places?.length ? `<article class="item"><h3>Gezilecek yerler</h3><div class="places">${plan.places.map((place) => `<span class="badge sky">${escapeHtml(place)}</span>`).join("")}</div></article>` : ""}
        ${plan.plan?.length ? `<article class="item"><h3>Günlük program</h3><ol class="program">${plan.plan.map((day) => `<li>${escapeHtml(day)}</li>`).join("")}</ol></article>` : ""}
        <article class="item"><h3>Konaklama</h3><p>${escapeHtml(plan.accommodation || "-")}</p></article>
        <article class="item"><h3>Ulaşım</h3><p>${escapeHtml(plan.transport || "-")}</p></article>
        ${plan.costItems?.length ? `<article class="item"><h3>Maliyet kalemleri</h3>${costRows(plan.costItems)}</article>` : ""}
      </div>
    </section>
  `);
}

async function renderAdminDashboard() {
  await refreshAdmin();
  adminShell("dashboard", "Dashboard", `
    <div class="dashboard-cards">
      <article class="metric stat-card"><span>Toplam Lead</span><strong>${summary.leads}</strong><p class="muted">Public planner talepleri</p></article>
      <article class="metric stat-card"><span>Aktif Tur</span><strong>${summary.tours}</strong><p class="muted">Operasyondaki teklifler</p></article>
      <article class="metric stat-card"><span>Bekleyen Kapora</span><strong>${summary.openDeposits}</strong><p class="muted">Takip edilmesi gereken ödeme</p></article>
      <article class="metric stat-card"><span>Tahmini Kâr</span><strong>${money(summary.profit)}</strong><p class="muted">Planlanan toplam marj</p></article>
    </div>
    <div class="admin-grid">
      <section class="panel">
        <div class="panel-header"><h2>Son leadler</h2><a class="link-btn" href="/admin/leads" data-link>Leadleri aç</a></div>
        <div class="tour-list">
          ${leads.slice(0, 3).map(leadCard).join("") || '<p class="empty">Henüz lead yok.</p>'}
        </div>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Aktif turlar</h2><a class="link-btn" href="/admin/tours" data-link>Tur yönetimi</a></div>
        <div class="tour-list">${tours.slice(0, 3).map(tourCard).join("") || '<p class="empty">Henüz tur yok.</p>'}</div>
      </section>
    </div>
    <section class="panel">
      <div class="panel-header"><h2>Admin sifresi</h2><span class="badge sky">SQLite</span></div>
      <form class="form" id="admin-password-form">
        <div class="form-grid">
          <label>Mevcut sifre <input name="currentPassword" type="password" autocomplete="current-password" required /></label>
          <label>Yeni sifre <input name="newPassword" type="password" autocomplete="new-password" minlength="6" required /></label>
        </div>
        <button class="btn secondary" type="submit">Sifreyi degistir</button>
        <p class="muted" id="admin-password-status"></p>
      </form>
    </section>
  `);
}

async function renderTourManagement() {
  await refreshAdmin();
  adminShell("tours", "Tur Yönetimi", `
    <section class="panel ai-command-panel">
      <div class="panel-header">
        <h2>AI tur organizasyon asistanı</h2>
        <span class="badge green">Doğal dil</span>
      </div>
      <form class="form ai-chat-form" id="admin-ai-tour-form">
        <label>Tur talimatını yaz
          <textarea name="message" required>Kahramanmaraş çıkışlı 16 kişilik Arsuz günübirlik tur oluştur.</textarea>
        </label>
        <button class="btn" type="submit">AI ile tur oluştur</button>
        <p class="muted" id="admin-ai-status"></p>
      </form>
    </section>
    ${adminAssistantResult ? aiResultHtml(adminAssistantResult) : ""}
    <section class="panel">
      <div class="panel-header"><h2>Maliyet kuralları</h2><span class="badge green">${costRules.length} kural</span></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Kalem</th><th>Tip</th><th>Birim</th><th>Birim fiyat</th></tr></thead>
          <tbody>${costRules.map((rule) => `
            <tr>
              <td><strong>${escapeHtml(rule.label)}</strong></td>
              <td>${escapeHtml(rule.type)}</td>
              <td>${escapeHtml(rule.unit)}</td>
              <td>${money(rule.unitPrice)}</td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>
      <form class="form" id="cost-rule-form">
        <div class="form-grid">
          <label>Kalem adı <input name="label" value="Yeni Kalem" required /></label>
          <label>Tip
            <select name="type">
              <option value="fm_vip_vehicle">FM VIP araç formülü</option>
              <option value="fixed">Sabit ücret</option>
              <option value="per_person">Kişi başı ücret</option>
              <option value="boat">Tekne seçeneği</option>
              <option value="manual">Manuel</option>
            </select>
          </label>
          <label>Birim <input name="unit" value="tur" required /></label>
          <label>Birim fiyat <input name="unitPrice" type="number" min="0" value="1000" required /></label>
        </div>
        <button class="btn secondary" type="submit">Maliyet kuralı kaydet</button>
      </form>
    </section>
    <div class="admin-grid">
      <section class="panel">
        <div class="panel-header"><h2>Manuel tur oluştur</h2></div>
        <form class="form" id="tour-form">
          <div class="form-grid">
            <label>Kalkış şehri <input name="origin" value="Kahramanmaraş" /></label>
            <label>Varış şehri <input name="destination" value="Arsuz" required /></label>
            <label>Başlangıç tarihi <input name="startDate" type="date" value="2026-07-20" /></label>
            <label>Süre <input name="durationDays" type="number" min="1" value="4" /></label>
            <label>Grup kişi sayısı <input name="groupSize" type="number" min="1" value="16" /></label>
            <label>Satış fiyatı kişi başı <input name="salesPricePerPerson" type="number" min="0" value="1450" /></label>
            <label>Gidiş km <input name="outboundKm" type="number" min="0" placeholder="Google Maps gidiş km" /></label>
            <label>Dönüş km <input name="returnKm" type="number" min="0" placeholder="Google Maps dönüş km" /></label>
            <label>Rehber <input name="guideCost" type="number" min="0" value="6000" /></label>
            <label>Sigorta kişi başı <input name="insurancePerPerson" type="number" min="0" value="75" /></label>
            <label>Otel maliyeti <input name="hotelCost" type="number" min="0" value="0" /></label>
            <label>Tekne tipi
              <select name="boatPricingType">
                <option value="fixed">Sabit ücret</option>
                <option value="per_person">Kişi başı ücret</option>
              </select>
            </label>
            <label>Tekne tutarı <input name="boatUnitPrice" type="number" min="0" value="0" /></label>
            <label>Diğer maliyet <input name="otherCost" type="number" min="0" value="0" /></label>
          </div>
          <button class="btn" type="submit">Tur oluştur</button>
          <p class="muted convert-status" id="tour-form-status" aria-live="polite"></p>
        </form>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Aktif turlar</h2></div>
        <div class="tour-list">${tours.map(tourCard).join("")}</div>
      </section>
    </div>
    <section class="panel">
      <div class="panel-header"><h2>Public planner leadleri</h2></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Lead</th><th>Rota</th><th>Kişi</th><th>Gün</th><th>Bütçe</th></tr></thead>
          <tbody>${leads.map((lead) => `
            <tr>
              <td><strong>${escapeHtml(lead.name)}</strong><br><span class="muted">${escapeHtml(lead.phone)} · ${escapeHtml(lead.email)}</span></td>
              <td>${escapeHtml(lead.destination)}</td>
              <td>${lead.groupSize}</td>
              <td>${lead.durationDays}</td>
              <td>${money(lead.budget)}</td>
            </tr>
          `).join("") || '<tr><td colspan="5">Henüz lead yok.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `);
}

async function renderTourDetail(id) {
  await refreshAdmin();
  let tour = tours.find((item) => Number(item.id) === Number(id));
  try {
    tour = await api(`/api/tours/${id}`);
  } catch (error) {
    if (!tour) throw error;
  }
  const tourParticipants = participants.filter((item) => Number(item.tourId) === Number(tour.id));
  const vehicleWarning = tour.totals.costItems?.find((item) => item.key === "vehicle")?.warning;
  const participantSummary = {
    totalPeople: tourParticipants.reduce((sum, item) => sum + Number(item.people || 1), 0),
    collectedDeposit: tourParticipants.reduce((sum, item) => sum + Number(item.depositPaid || 0), 0),
    unpaidCount: tourParticipants.filter((item) => Number(item.depositPaid || 0) <= 0).length,
    partialCount: tourParticipants.filter((item) => Number(item.depositPaid || 0) > 0 && Number(item.remainingPayment || 0) > 0).length,
    pendingCollection: tourParticipants.reduce((sum, item) => sum + Number(item.remainingPayment || 0), 0)
  };
  const selectedParticipant = tourParticipants[0];
  const participantOptions = tourParticipants.map((participant) => `<option value="${participant.id}">${escapeHtml(`${participant.seatNumber ? `${participant.seatNumber} - ` : ""}${participant.name}`)}</option>`).join("");
  const participantQuery = selectedParticipant ? `?participantId=${selectedParticipant.id}` : "";

  adminShell("tours", "Tur Detayı", `
    <div class="detail-toolbar">
      <a class="link-btn" href="/admin/tours" data-link>Tur yönetimine dön</a>
      <span class="badge green">${escapeHtml(tour.status)}</span>
    </div>
    <section class="panel">
      <div class="panel-header">
        <h2>${escapeHtml(tour.title)}</h2>
        <span class="badge green">${escapeHtml(tour.destination)}</span>
      </div>
      <div class="item-list">
        <div class="three-grid">
          <div class="metric"><span>Tarih</span><strong>${escapeHtml(tour.startDate)}</strong></div>
          <div class="metric"><span>Kişi / süre</span><strong>${escapeHtml(`${tour.groupSize} kişi / ${tour.durationDays} gün`)}</strong></div>
          <div class="metric"><span>Kişi başı satış</span><strong>${money(tour.totals.pricePerPerson)}</strong></div>
        </div>
        <div class="three-grid">
          <div class="metric"><span>Toplam maliyet</span><strong>${money(tour.totals.baseCost)}</strong></div>
          <div class="metric"><span>Toplam satış</span><strong>${money(tour.totals.salesTotal)}</strong></div>
          <div class="metric"><span>Net kâr</span><strong>${money(tour.totals.netProfit)}</strong></div>
        </div>
        ${vehicleWarning ? `<div class="warning-box">${escapeHtml(vehicleWarning)}</div>` : ""}
        <form class="form" id="tour-distance-form" data-tour-id="${tour.id}">
          <div class="form-grid">
            <label>Gidiş km <input name="outboundKm" type="number" min="0" value="${tour.outboundKm ?? ""}" placeholder="Google Maps gidiş km" required /></label>
            <label>Dönüş km <input name="returnKm" type="number" min="0" value="${tour.returnKm ?? ""}" placeholder="Google Maps dönüş km" required /></label>
          </div>
          <button class="btn secondary" type="submit">Km bilgisini kaydet ve araç maliyetini hesapla</button>
          <p class="muted convert-status" id="tour-distance-status" aria-live="polite"></p>
        </form>
        <article class="item"><h3>Gezilecek yerler</h3><div class="places">${tour.places.map((place) => `<span class="badge sky">${escapeHtml(place)}</span>`).join("")}</div></article>
        <article class="item"><h3>Program</h3><ol class="program">${tour.program.map((day) => `<li>${escapeHtml(day)}</li>`).join("")}</ol></article>
        <article class="item"><h3>Maliyet kalemleri</h3>${costRows(tour.totals.costItems || [])}</article>
      </div>
    </section>
    <section class="panel">
      <div class="panel-header"><h2>${fmTravelLogoHtml("panel-logo")} PDF belgeler</h2><span class="badge green">İndirilebilir</span></div>
      <div class="item-list">
        ${tourParticipants.length ? `
          <label>Katılımcı seç
            <select id="document-participant-select">
              ${participantOptions}
            </select>
          </label>
        ` : '<div class="warning-box">Katılımcıya özel belge oluşturmak için önce katılımcı ekleyin.</div>'}
        <div class="document-actions">
          <a class="btn secondary participant-document-link ${selectedParticipant ? "" : "disabled-link"}" href="/api/tours/${tour.id}/documents/registration.pdf${participantQuery}" target="_blank" rel="noopener" data-document-type="registration">Tur Kayıt Belgesi</a>
          <a class="btn secondary participant-document-link ${selectedParticipant ? "" : "disabled-link"}" href="/api/tours/${tour.id}/documents/deposit.pdf${participantQuery}" target="_blank" rel="noopener" data-document-type="deposit">Kapora Belgesi</a>
          <a class="btn secondary" href="/api/tours/${tour.id}/documents/participants.pdf" target="_blank" rel="noopener">Katılımcı Listesi</a>
          <a class="btn secondary" href="/api/tours/${tour.id}/documents/program.pdf" target="_blank" rel="noopener">Tur Programı</a>
        </div>
      </div>
    </section>
    <section class="panel">
      <div class="panel-header"><h2>Katılımcılar</h2><span class="badge clay">${tourParticipants.length} kayıt</span></div>
      <div class="item-list">
        <div class="three-grid">
          <div class="metric"><span>Toplam kişi</span><strong>${participantSummary.totalPeople}</strong></div>
          <div class="metric"><span>Toplanan kapora</span><strong>${money(participantSummary.collectedDeposit)}</strong></div>
          <div class="metric"><span>Bekleyen tahsilat</span><strong>${money(participantSummary.pendingCollection)}</strong></div>
          <div class="metric"><span>Ödeme yapmayan</span><strong>${participantSummary.unpaidCount}</strong></div>
          <div class="metric"><span>Kısmi ödeme yapan</span><strong>${participantSummary.partialCount}</strong></div>
          <div class="metric"><span>Koltuk doluluğu</span><strong>${participantSummary.totalPeople} / ${tour.groupSize}</strong></div>
        </div>
        <form class="form" id="tour-participant-form" data-tour-id="${tour.id}">
          <div class="form-grid">
            <label>Ad Soyad <input name="name" required /></label>
            <label>Telefon <input name="phone" required /></label>
            <label>Kapora tutarı <input name="depositPaid" type="number" min="0" value="0" /></label>
            <label>Toplam ücret <input name="totalPrice" type="number" min="0" value="${tour.totals.pricePerPerson}" /></label>
            <label>Koltuk numarası <input name="seatNumber" /></label>
            <label>Notlar <input name="notes" /></label>
          </div>
          <button class="btn" type="submit">Katılımcı ekle</button>
          <p class="muted convert-status" id="tour-participant-status" aria-live="polite"></p>
        </form>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Ad soyad</th><th>Telefon</th><th>Koltuk</th><th>Kapora</th><th>Toplam ücret</th><th>Kalan ödeme</th><th>Durum</th><th>Notlar</th></tr></thead>
          <tbody>${tourParticipants.map((participant) => `
            <tr>
              <td><strong>${escapeHtml(participant.name)}</strong><br><span class="muted">${escapeHtml(participant.email)}</span></td>
              <td>${escapeHtml(participant.phone)}</td>
              <td>${escapeHtml(participant.seatNumber || "-")}</td>
              <td>${money(participant.depositPaid)}</td>
              <td>${money(participant.totalPrice)}</td>
              <td>${money(participant.remainingPayment)}</td>
              <td><span class="badge ${participantPaymentBadge(participant.status)}">${escapeHtml(participant.status)}</span></td>
              <td>${escapeHtml(participant.notes || "-")}</td>
            </tr>
          `).join("") || '<tr><td colspan="8">Bu tur için henüz katılımcı yok.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
    <section class="panel whatsapp-bulk-panel" data-tour-whatsapp="${tour.id}">
      <div class="panel-header"><h2>${fmTravelLogoHtml("panel-logo")} WhatsApp toplu mesaj</h2><span class="badge green">Manuel gonderim</span></div>
      <div class="item-list">
        <div class="form-grid">
          <label>Kalkis saati <input name="departureTime" type="time" value="08:00" data-whatsapp-departure-time /></label>
          <label>Kalkis noktasi <input name="departurePoint" value="FM Travel ofisi" data-whatsapp-departure-point /></label>
        </div>
        <div class="whatsapp-template-actions">
          <button class="btn secondary" type="button" data-whatsapp-template="depositReminder">Kapora hatirlatma mesaji</button>
          <button class="btn secondary" type="button" data-whatsapp-template="tourInfo">Tur bilgilendirme mesaji</button>
          <button class="btn secondary" type="button" data-whatsapp-template="departureTime">Hareket saati mesaji</button>
          <button class="btn secondary" type="button" data-whatsapp-template="remainingPayment">Kalan odeme hatirlatma mesaji</button>
        </div>
        <div class="whatsapp-link-results" aria-live="polite">
          <p class="empty">Bir mesaj sablonu secildiginde her katilimci icin ayri WhatsApp linki burada olusur.</p>
        </div>
      </div>
    </section>
  `);
}

async function renderParticipants() {
  await refreshAdmin();
  adminShell("participants", "Katılımcı yönetimi", `
    <div class="admin-grid">
      <section class="panel">
        <div class="panel-header"><h2>Katılımcı ekle</h2></div>
        <form class="form" id="participant-form">
          <label>Ad soyad <input name="name" required /></label>
          <label>Telefon <input name="phone" required /></label>
          <label>E-posta <input name="email" type="email" /></label>
          <label>Tur <select name="tourId">${tourOptions()}</select></label>
          <div class="form-grid">
            <label>Kişi sayısı <input name="people" type="number" min="1" value="1" /></label>
            <label>Kapora <input name="depositPaid" type="number" min="0" value="0" /></label>
          </div>
          <label>Toplam satış <input name="totalPrice" type="number" min="0" value="0" /></label>
          <button class="btn" type="submit">Katılımcı ekle</button>
        </form>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Kayıtlar</h2></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Katılımcı</th><th>Tur</th><th>Kişi</th><th>Kapora</th><th>Durum</th></tr></thead>
            <tbody>${participants.map((row) => `
              <tr>
                <td><strong>${escapeHtml(row.name)}</strong><br><span class="muted">${escapeHtml(row.phone)}</span></td>
                <td>${escapeHtml(row.tourTitle)}</td>
                <td>${row.people}</td>
                <td>${money(row.depositPaid)}</td>
                <td><span class="badge ${row.depositPaid > 0 ? "green" : "sun"}">${escapeHtml(row.status)}</span></td>
              </tr>
            `).join("")}</tbody>
          </table>
        </div>
      </section>
    </div>
  `);
}

async function renderDeposits() {
  await refreshAdmin();
  adminShell("deposits", "Kapora takibi", `
    <section class="panel">
      <div class="panel-header"><h2>Kapora durumu</h2></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Katılımcı</th><th>Tur</th><th>Beklenen</th><th>Alınan</th><th>Kalan</th><th>İlerleme</th></tr></thead>
          <tbody>${deposits.map((row) => {
            const percent = row.expectedDeposit ? Math.min(100, Math.round((row.depositPaid / row.expectedDeposit) * 100)) : 0;
            return `<tr>
              <td><strong>${escapeHtml(row.name)}</strong></td>
              <td>${escapeHtml(row.tourTitle)}</td>
              <td>${money(row.expectedDeposit)}</td>
              <td>${money(row.depositPaid)}</td>
              <td>${money(row.remainingDeposit)}</td>
              <td><div class="progress"><span style="width:${percent}%"></span></div></td>
            </tr>`;
          }).join("")}</tbody>
        </table>
      </div>
    </section>
  `);
}

async function renderProfit() {
  await refreshAdmin();
  adminShell("profit", "Kâr hesabı", `
    <section class="panel">
      <div class="panel-header"><h2>Tur bazında kârlılık</h2></div>
      <div class="tour-list">${tours.map((tour) => `
        <article class="tour-card">
          <div class="tour-head">
            <div><strong>${escapeHtml(tour.title)}</strong><p class="muted">${tour.groupSize} kişi · ${tour.durationDays} gün</p></div>
            <span class="badge green">${money(tour.totals.pricePerPerson)} / kişi</span>
          </div>
          <div class="three-grid">
            <div class="metric"><span>Toplam maliyet</span><strong>${money(tour.totals.baseCost)}</strong></div>
            <div class="metric"><span>Kişi başı maliyet</span><strong>${money(tour.totals.costPerPerson)}</strong></div>
            <div class="metric"><span>Satış toplamı</span><strong>${money(tour.totals.salesTotal)}</strong></div>
            <div class="metric"><span>Net kâr</span><strong>${money(tour.totals.netProfit)}</strong></div>
          </div>
          ${tour.totals.costItems?.length ? costRows(tour.totals.costItems) : ""}
        </article>
      `).join("")}</div>
    </section>
  `);
}

async function renderWhatsapp() {
  await refreshAdmin();
  const selected = tours[0];
  const message = selected
    ? `Merhaba, ${selected.destination} turunuz için program hazır. ${selected.durationDays} günlük akışta ${selected.places.slice(0, 3).join(", ")} yerleri bulunuyor. Kişi başı tahmini ücret ${money(selected.totals.pricePerPerson)}. Rezervasyon için kişi başı ${money(selected.depositPerPerson)} kapora ile ilerleyebiliriz.`
    : "";
  adminShell("whatsapp", "WhatsApp mesaj oluşturucu", `
    <div class="two-grid">
      <section class="panel">
        <div class="panel-header"><h2>Mesaj ayarları</h2></div>
        <form class="form" id="message-form">
          <label>Tur <select name="tourId">${tourOptions()}</select></label>
          <label>Mesaj türü
            <select name="type">
              <option value="offer">Tur teklifi</option>
              <option value="deposit">Kapora isteme</option>
            </select>
          </label>
          <button class="btn" type="submit">Mesaj oluştur</button>
        </form>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Hazır mesaj</h2></div>
        <div class="item-list"><div class="copy-box" id="message-output">${escapeHtml(message)}</div></div>
      </section>
    </div>
  `);
}

async function renderAdminAbout() {
  await refreshAdmin();
  adminShell("about", "Hakk\u0131m\u0131zda", aboutPageHtml({ admin: true }));
}

async function render() {
  try {
    const route = location.pathname;
    if (route === "/about") return renderPublicAbout();
    if (route === "/nexora/community" || route === "/demo/nexora/community") return renderNexoraCommunity();
    if (route === "/nexora" || route === "/demo/nexora") return renderNexoraHome();
    if (route === "/demo/caliskan" || route.startsWith("/demo/caliskan/admin")) return renderCaliskanDemo();
    if (route === "/demo/estemar" || route.startsWith("/demo/estemar/admin")) return renderEstemarDemo();
    if (route.startsWith("/admin") && !(await requireAdminSession())) {
      renderAdminLogin();
      return;
    }
    const leadDetailRoute = route.match(/^\/admin\/leads\/(\d+)$/);
    const tourDetailRoute = route.match(/^\/admin\/tours\/(\d+)$/);
    if (leadDetailRoute) return await renderLeadDetail(leadDetailRoute[1]);
    if (tourDetailRoute) return await renderTourDetail(tourDetailRoute[1]);
    if (route === "/admin/leads") return await renderLeads();
    if (route === "/admin") return await renderAdminDashboard();
    if (route === "/admin/tours") return await renderTourManagement();
    if (route === "/admin/participants") return await renderParticipants();
    if (route === "/admin/deposits") return await renderDeposits();
    if (route === "/admin/profit") return await renderProfit();
    if (route === "/admin/whatsapp") return await renderWhatsapp();
    if (route === "/admin/about") return await renderAdminAbout();
    return renderPublicPremium();
  } catch (error) {
    app.innerHTML = `
      <div class="public-shell">
        <header class="public-header">
          <a class="brand" href="/" data-link>
            ${fmTravelLogoHtml()}
            <span><strong>TourFlow AI</strong><small>FM Travel</small></span>
          </a>
          <a class="link-btn" href="/admin" data-link>Admin paneli tekrar yükle</a>
        </header>
        <main class="planner-result">
          <section class="panel"><p class="empty">${escapeHtml(error.message)}</p></section>
        </main>
      </div>
    `;
  }
}

document.addEventListener("click", (event) => {
  const routePlanButton = event.target.closest("[data-route-plan]");
  if (routePlanButton) {
    event.preventDefault();
    const route = routePlanButton.dataset.routePlan;
    const textarea = document.querySelector("#public-ai-form textarea[name='message']");
    if (textarea) {
      textarea.value = `16 kişi Kahramanmaraş çıkışlı ${route} turu istiyoruz. Bize özel rota, program ve tahmini maliyet çıkar.`;
      document.querySelector("#ai-planner")?.scrollIntoView({ behavior: "smooth", block: "start" });
      textarea.focus();
    }
    return;
  }

  const whatsappTemplateButton = event.target.closest("[data-whatsapp-template]");
  if (whatsappTemplateButton) {
    event.preventDefault();
    const panel = whatsappTemplateButton.closest("[data-tour-whatsapp]");
    const tourId = Number(panel?.dataset.tourWhatsapp);
    const tour = tours.find((item) => Number(item.id) === tourId);
    const tourParticipants = participants.filter((item) => Number(item.tourId) === tourId);
    const results = panel?.querySelector(".whatsapp-link-results");
    if (!panel || !tour || !results) return;

    panel.querySelectorAll("[data-whatsapp-template]").forEach((button) => button.classList.remove("active"));
    whatsappTemplateButton.classList.add("active");
    results.innerHTML = participantWhatsappLinksHtml(whatsappTemplateButton.dataset.whatsappTemplate, tour, tourParticipants, {
      departureTime: panel.querySelector("[data-whatsapp-departure-time]")?.value,
      departurePoint: panel.querySelector("[data-whatsapp-departure-point]")?.value
    });
    return;
  }

  const logoutButton = event.target.closest("[data-admin-logout]");
  if (logoutButton) {
    event.preventDefault();
    api("/api/admin/logout", { method: "POST", body: JSON.stringify({}) })
      .finally(() => {
        adminSession = { authenticated: false };
        navigate("/admin");
      });
    return;
  }

  const convertButton = event.target.closest("[data-convert-lead]");
  if (convertButton) {
    event.preventDefault();
    const leadId = convertButton.dataset.convertLead;
    const defaultButtonText = "Satışa dönüştür ve tura aktar";
    const status = document.querySelector(`[data-convert-status="${leadId}"]`);
    convertButton.disabled = true;
    convertButton.textContent = defaultButtonText;
    if (status) {
      status.textContent = "Satışa dönüştürülüyor, tur ve katılımcı kaydı oluşturuluyor...";
    }
    api(leadConvertEndpoint(leadId), { method: "POST", body: JSON.stringify({}) })
      .then((result) => {
        console.log("Lead convert sonucu:", result);
        if (result.tourId) {
          if (status) status.textContent = "Başarılı. Tur detay sayfasına yönlendiriliyor...";
          window.location.href = `/admin/tours/${result.tourId}`;
          return;
        }
        throw new Error("API başarılı döndü ancak tourId gelmedi.");
      })
      .catch((error) => {
        console.error("Lead convert hatası:", error);
        convertButton.disabled = false;
        convertButton.textContent = defaultButtonText;
        if (status) {
          status.textContent = `Satışa dönüştürme hatası: ${error.message}`;
        }
      });
    return;
  }

  const tourCard = event.target.closest("[data-tour-detail]");
  if (tourCard && !event.target.closest("a, button, select, input, textarea, label")) {
    event.preventDefault();
    navigate(`/admin/tours/${tourCard.dataset.tourDetail}`);
    return;
  }

  const leadCard = event.target.closest("[data-lead-detail]");
  if (leadCard && !event.target.closest("a, button, select, input, textarea, label")) {
    event.preventDefault();
    navigate(`/admin/leads/${leadCard.dataset.leadDetail}`);
    return;
  }

  const link = event.target.closest("[data-link]");
  if (!link) return;
  event.preventDefault();
  navigate(new URL(link.href).pathname);
});

document.addEventListener("change", async (event) => {
  const documentParticipantSelect = event.target.closest("#document-participant-select");
  if (documentParticipantSelect) {
    const tourId = location.pathname.match(/^\/admin\/tours\/(\d+)$/)?.[1];
    document.querySelectorAll("[data-document-type]").forEach((link) => {
      link.href = `/api/tours/${tourId}/documents/${link.dataset.documentType}.pdf?participantId=${documentParticipantSelect.value}`;
    });
    return;
  }

  const statusSelect = event.target.closest("[data-lead-status]");
  if (!statusSelect) return;

  await api(`/api/leads/${statusSelect.dataset.leadStatus}/status`, {
    method: "POST",
    body: JSON.stringify({ status: statusSelect.value })
  });
  if (location.pathname === `/admin/leads/${statusSelect.dataset.leadStatus}`) {
    await renderLeadDetail(statusSelect.dataset.leadStatus);
  } else {
    await renderLeads();
  }
});

document.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (event.target.id === "admin-login-form") {
    const form = event.target;
    const button = form.querySelector("button[type='submit']");
    const status = form.querySelector("#admin-login-status");
    button.disabled = true;
    status.textContent = "Giris kontrol ediliyor.";
    try {
      adminSession = await api("/api/admin/login", { method: "POST", body: JSON.stringify(payload(form)) });
      await render();
    } catch (error) {
      button.disabled = false;
      status.textContent = error.message;
    }
    return;
  }

  if (event.target.id === "admin-password-form") {
    const form = event.target;
    const status = form.querySelector("#admin-password-status");
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    status.textContent = "Sifre guncelleniyor.";
    try {
      await api("/api/admin/password", { method: "POST", body: JSON.stringify(payload(form)) });
      form.reset();
      status.textContent = "Sifre guncellendi.";
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
    return;
  }

  if (event.target.id === "public-ai-form") {
    const form = event.target;
    const button = form.querySelector("button[type='submit']");
    const status = form.querySelector("#public-ai-status");
    const data = payload(form);
    button.disabled = true;
    button.textContent = "AI düşünüyor...";
    status.textContent = "İsteğin analiz ediliyor, rota ve maliyet hazırlanıyor.";

    try {
      try {
        plannerResult = await api("/api/assistant/plan", { method: "POST", body: JSON.stringify(data) });
      } catch {
        plannerResult = buildClientAssistantPlan(data.message);
      }
      renderPublic();
      document.querySelector("#planner-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      status.textContent = `AI plan oluşturamadı: ${error.message}`;
      button.disabled = false;
      button.textContent = "AI ile gezi planı oluştur";
    }
  }

  if (event.target.id === "planner-form") {
    const form = event.target;
    const button = form.querySelector("button[type='submit']");
    const status = form.querySelector("#planner-status");
    button.disabled = true;
    button.textContent = "Plan oluşturuluyor...";
    status.textContent = "AI gezi planı hazırlanıyor.";

    try {
      const formData = payload(form);
      try {
        plannerResult = await api("/api/planner", { method: "POST", body: JSON.stringify(formData) });
      } catch {
        plannerResult = buildClientPlan(formData);
      }
      renderPublic();
      document.querySelector("#planner-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      status.textContent = `Plan oluşturulamadı: ${error.message}`;
      button.disabled = false;
      button.textContent = "Gezi talebi oluştur";
    }
  }

  if (event.target.id === "lead-form") {
    const formData = payload(event.target);
    try {
      await api("/api/leads", { method: "POST", body: JSON.stringify(formData) });
    } catch {
      saveLocalLead(formData, plannerResult);
    }
    document.querySelector("#lead-status").textContent = "Talebiniz alındı. FM Travel ekibi kısa süre içinde sizinle iletişime geçecek.";
  }

  if (event.target.id === "tour-form") {
    const status = event.target.querySelector("#tour-form-status");
    try {
      await api("/api/tours", { method: "POST", body: JSON.stringify(payload(event.target)) });
      await renderTourManagement();
    } catch (error) {
      if (status) status.textContent = error.message;
    }
  }

  if (event.target.id === "tour-distance-form") {
    const form = event.target;
    const status = form.querySelector("#tour-distance-status");
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    status.textContent = "Km bilgisi kaydediliyor ve araç maliyeti yeniden hesaplanıyor.";
    try {
      await api(`/api/tours/${form.dataset.tourId}/distance`, {
        method: "PATCH",
        body: JSON.stringify(payload(form))
      });
      await renderTourDetail(form.dataset.tourId);
    } catch (error) {
      button.disabled = false;
      status.textContent = error.message;
    }
  }

  if (event.target.id === "admin-ai-tour-form") {
    const form = event.target;
    const button = form.querySelector("button[type='submit']");
    const status = form.querySelector("#admin-ai-status");
    const formData = payload(form);
    button.disabled = true;
    button.textContent = "Tur oluşturuluyor...";
    status.textContent = "AI programı, maliyeti, kârı ve mesajları hazırlıyor.";

    try {
      const response = await api("/api/admin/assistant/tours", { method: "POST", body: JSON.stringify(formData) });
      adminAssistantResult = response.assistantPlan;
      if (response.requiresDistance) {
        await renderTourManagement();
        const distanceStatus = document.querySelector("#admin-ai-status");
        if (distanceStatus) distanceStatus.textContent = response.message || "Eksik km bilgilerini doldurun.";
        document.querySelector(".missing-info-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      await renderTourManagement();
    } catch (error) {
      status.textContent = `Tur oluşturulamadı: ${error.message}`;
      button.disabled = false;
      button.textContent = "AI ile tur oluştur";
    }
  }

  if (event.target.id === "admin-ai-distance-form") {
    const form = event.target;
    const status = form.querySelector("#admin-ai-distance-status");
    const button = form.querySelector("button[type='submit']");
    if (!adminAssistantResult) {
      status.textContent = "AI taslağı bulunamadı. Lütfen tur talimatını tekrar oluşturun.";
      return;
    }
    button.disabled = true;
    status.textContent = "Km bilgisi alındı, maliyet hesaplanıyor ve tur oluşturuluyor.";
    try {
      const data = payload(form);
      const response = await api("/api/tours", {
        method: "POST",
        body: JSON.stringify({
          destination: adminAssistantResult.destination,
          groupSize: adminAssistantResult.groupSize,
          durationDays: adminAssistantResult.durationDays,
          budget: adminAssistantResult.budget,
          outboundKm: data.outboundKm,
          returnKm: data.returnKm
        })
      });
      adminAssistantResult = null;
      window.location.href = `/admin/tours/${response.id}`;
    } catch (error) {
      button.disabled = false;
      status.textContent = error.message;
    }
  }

  if (event.target.id === "cost-rule-form") {
    await api("/api/cost-rules", { method: "POST", body: JSON.stringify(payload(event.target)) });
    await renderTourManagement();
  }

  if (event.target.id === "participant-form") {
    await api("/api/participants", { method: "POST", body: JSON.stringify(payload(event.target)) });
    await renderParticipants();
  }

  if (event.target.id === "tour-participant-form") {
    const form = event.target;
    const status = form.querySelector("#tour-participant-status");
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    status.textContent = "Katılımcı ekleniyor.";
    try {
      await api("/api/participants", {
        method: "POST",
        body: JSON.stringify({
          ...payload(form),
          tourId: form.dataset.tourId,
          people: 1
        })
      });
      await renderTourDetail(form.dataset.tourId);
    } catch (error) {
      button.disabled = false;
      status.textContent = error.message;
    }
  }

  if (event.target.id === "message-form") {
    const data = payload(event.target);
    const tour = tours.find((item) => String(item.id) === String(data.tourId)) || tours[0];
    const text = data.type === "deposit"
      ? `Merhaba, ${tour.destination} rezervasyonunuzu kesinleştirmek için kişi başı ${money(tour.depositPerPerson)} kapora alıyoruz. Kapora sonrası ulaşım ve konaklama opsiyonunu sabitliyorum.`
      : `Merhaba, ${tour.destination} turunuz için ${tour.durationDays} günlük program hazır. Rotada ${tour.places.slice(0, 4).join(", ")} var. Kişi başı ücret ${money(tour.totals.pricePerPerson)}.`;
    document.querySelector("#message-output").textContent = text;
  }
});

window.addEventListener("popstate", render);
render();
