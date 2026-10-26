const STATES = {
  BW: "Baden-Württemberg",
  BY: "Bayern",
  BE: "Berlin",
  BB: "Brandenburg",
  HB: "Bremen",
  HH: "Hamburg",
  HE: "Hessen",
  MV: "Mecklenburg-Vorpommern",
  NI: "Niedersachsen",
  NW: "Nordrhein-Westfalen",
  RP: "Rheinland-Pfalz",
  SL: "Saarland",
  SN: "Sachsen",
  ST: "Sachsen-Anhalt",
  SH: "Schleswig-Holstein",
  TH: "Thüringen",
};

const holidayCache = new Map();

function getEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

// Buß- und Bettag: Mittwoch vor dem 23. November
function getBussUndBettag(year) {
  const date = new Date(year, 10, 22);
  while (date.getDay() !== 3) {
    date.setDate(date.getDate() - 1);
  }
  return date;
}

// Regionale Feiertage, die nur in Teilen eines Bundeslands gelten (wählbar).
// date: [Monat, Tag] oder easter: Abstand zu Ostersonntag in Tagen
const REGIONAL_HOLIDAYS = {
  BY: [
    {
      id: "mariae-himmelfahrt",
      name: "Mariä Himmelfahrt",
      hint: "Nur in Gemeinden mit überwiegend katholischer Bevölkerung (rund 1.700 von 2.056 Gemeinden)",
      defaultOn: true,
      date: [8, 15],
    },
    {
      id: "augsburg",
      name: "Augsburger Hohes Friedensfest",
      hint: "Nur im Stadtgebiet Augsburg",
      defaultOn: false,
      date: [8, 8],
    },
  ],
  SN: [
    {
      id: "fronleichnam-sn",
      name: "Fronleichnam",
      hint: "Nur in einigen Gemeinden im sorbisch-katholischen Gebiet (Landkreis Bautzen)",
      defaultOn: false,
      easter: 60,
    },
  ],
  TH: [
    {
      id: "fronleichnam-th",
      name: "Fronleichnam",
      hint: "Nur im Eichsfeld und in einigen Gemeinden des Unstrut-Hainich-Kreises und Wartburgkreises",
      defaultOn: false,
      easter: 60,
    },
  ],
};

// Einmalige Feiertage (automatisch, nicht wählbar). states: null = bundesweit
// 2017: 500 Jahre Reformation; Berlin 2020/2025: 75./80. Jahrestag Kriegsende
const ONE_TIME_HOLIDAYS = [
  { date: "2017-10-31", name: "Reformationstag", states: null },
  { date: "2020-05-08", name: "Tag der Befreiung", states: ["BE"] },
  { date: "2025-05-08", name: "Tag der Befreiung", states: ["BE"] },
];

function getRegionalHolidayOptions(state) {
  return (REGIONAL_HOLIDAYS[state] || []).map(({ id, name, hint, defaultOn }) => ({
    id,
    name,
    hint,
    defaultOn,
  }));
}

// Nur die zum Bundesland passenden IDs, sortiert (stabiler Cache-Schlüssel)
function normalizeRegional(state, regional) {
  const valid = new Set((REGIONAL_HOLIDAYS[state] || []).map((entry) => entry.id));
  return [...new Set(Array.isArray(regional) ? regional : [])].filter((id) => valid.has(id)).sort();
}

// Liefert eine Map "YYYY-MM-DD" -> Feiertagsname
function getPublicHolidays(year, state, regional = []) {
  const selected = normalizeRegional(state, regional);
  const key = `${year}-${state}-${selected.join(",")}`;
  if (holidayCache.has(key)) {
    return holidayCache.get(key);
  }

  const easter = getEaster(year);
  const fixed = (month, day) => new Date(year, month - 1, day);
  const fromEaster = (offset) => addDays(easter, offset);
  const inStates = (...codes) => codes.includes(state);

  const list = [
    [fixed(1, 1), "Neujahr"],
    [fromEaster(-2), "Karfreitag"],
    [fromEaster(1), "Ostermontag"],
    [fixed(5, 1), "Tag der Arbeit"],
    [fromEaster(39), "Christi Himmelfahrt"],
    [fromEaster(50), "Pfingstmontag"],
    [fixed(10, 3), "Tag der Deutschen Einheit"],
    [fixed(12, 25), "1. Weihnachtsfeiertag"],
    [fixed(12, 26), "2. Weihnachtsfeiertag"],
  ];

  if (inStates("BW", "BY", "ST")) {
    list.push([fixed(1, 6), "Heilige Drei Könige"]);
  }
  if (inStates("BE") && year >= 2019) {
    list.push([fixed(3, 8), "Internationaler Frauentag"]);
  }
  if (inStates("MV") && year >= 2023) {
    list.push([fixed(3, 8), "Internationaler Frauentag"]);
  }
  if (inStates("BW", "BY", "HE", "NW", "RP", "SL")) {
    list.push([fromEaster(60), "Fronleichnam"]);
  }
  // In Bayern nur regional (siehe REGIONAL_HOLIDAYS)
  if (inStates("SL")) {
    list.push([fixed(8, 15), "Mariä Himmelfahrt"]);
  }
  if (inStates("TH") && year >= 2019) {
    list.push([fixed(9, 20), "Weltkindertag"]);
  }
  if (
    inStates("BB", "MV", "SN", "ST", "TH") ||
    (inStates("HB", "HH", "NI", "SH") && year >= 2018)
  ) {
    list.push([fixed(10, 31), "Reformationstag"]);
  }
  if (inStates("BW", "BY", "NW", "RP", "SL")) {
    list.push([fixed(11, 1), "Allerheiligen"]);
  }
  if (inStates("SN")) {
    list.push([getBussUndBettag(year), "Buß- und Bettag"]);
  }

  for (const entry of REGIONAL_HOLIDAYS[state] || []) {
    if (selected.includes(entry.id)) {
      const date = entry.date ? fixed(...entry.date) : fromEaster(entry.easter);
      list.push([date, entry.name]);
    }
  }

  const map = new Map(list.map(([date, name]) => [dateToStr(date), name]));
  // Einmalige Feiertage ergänzen, vorhandene Namen bleiben
  for (const entry of ONE_TIME_HOLIDAYS) {
    const applies = !entry.states || entry.states.includes(state);
    if (applies && entry.date.startsWith(`${year}-`) && !map.has(entry.date)) {
      map.set(entry.date, entry.name);
    }
  }
  holidayCache.set(key, map);
  return map;
}

function getHolidayName(dateString, state, regional = []) {
  const year = Number(dateString.slice(0, 4));
  return getPublicHolidays(year, state, regional).get(dateString) || null;
}

// Schulferien aller Bundesländer über die freie OpenHolidays-API
// (https://openholidaysapi.org – kostenlos, ohne Anmeldung)
async function fetchSchoolHolidays(state, start, end) {
  const cacheKey = `bh-ferien-${state}-${start}-${end}`;
  const cached = readStorage(cacheKey);
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    countryIsoCode: "DE",
    subdivisionCode: `DE-${state}`,
    languageIsoCode: "DE",
    validFrom: start,
    validTo: end,
  });
  const response = await fetch(`https://openholidaysapi.org/SchoolHolidays?${params}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Ferien-API antwortet mit ${response.status}`);
  }

  const data = await response.json();
  const result = data.map((entry) => ({
    name:
      entry.name?.find((name) => name.language === "DE")?.text ||
      entry.name?.[0]?.text ||
      "Schulferien",
    start: entry.startDate,
    end: entry.endDate,
  }));
  writeStorage(cacheKey, result);
  return result;
}
