// Speicherort des alten Einzel-Hefts (bis v2.4), wird beim ersten Start übernommen
const LEGACY_STATE_KEY = "bh-state-v2";
const SESSION_KEY_NAME = "azubix-api-key";

const DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

const DAY_KINDS = {
  betrieb: { label: "Betrieb" },
  schule: { label: "Berufsschule" },
  feiertag: { label: "Feiertag" },
  urlaub: { label: "Urlaub" },
  krank: { label: "Krank" },
};

const DEFAULT_STATE = {
  profile: {
    name: "",
    beruf: "Fachinformatiker/in – Anwendungsentwicklung",
    betrieb: "",
    abteilung: "",
    jahr: "1",
    ausbilder: "",
    startNr: 1,
    logo: "",
  },
  period: { start: "", end: "" },
  schoolDays: [2],
  weekType: "both",
  firstWeekType: "school",
  bundesland: "NW",
  absences: [],
  activities: {
    taetigkeiten: "",
    technologies: "",
    schulfaecher: "",
    hinweise: "",
    stil: "ich",
    laenge: "mittel",
    maxChars: "",
    unterweisungenKi: false,
  },
  // betriebDays: abweichende Stunden pro Wochentag (1 = Montag), leer = Standard
  hours: { betrieb: 8, schule: 8, betriebDays: {} },
  // null = Vorgaben des Bundeslands, sonst Liste der gewählten regionalen Feiertage
  regionalHolidays: null,
  ai: {
    provider: "pollinations",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: "",
    model: "llama-3.3-70b-versatile",
    batchSize: 3,
    sessionOnlyKey: false,
    fallbackToCustom: true,
  },
  weeks: [],
  // Läuft gerade eine Generierung? Dann kann sie nach dem Neuladen weitergehen.
  run: { active: false },
  theme: "auto",
};

let state = structuredClone(DEFAULT_STATE);
let saveTimer;
// Im Beispiel-Modus wird nichts gespeichert
let demoMode = false;

function mergeDefaults(defaults, saved) {
  if (!saved || typeof saved !== "object" || Array.isArray(defaults)) {
    return saved ?? defaults;
  }
  const result = { ...defaults };
  for (const key of Object.keys(saved)) {
    const value = saved[key];
    result[key] =
      defaults[key] && typeof defaults[key] === "object" && !Array.isArray(defaults[key])
        ? mergeDefaults(defaults[key], value)
        : value;
  }
  return result;
}

function loadState() {
  const loaded = mergeDefaults(structuredClone(DEFAULT_STATE), readStorage(activeHeftKey()));
  // Alte Schreibweise aus v2.0 übernehmen
  loaded.profile.beruf = loaded.profile.beruf.replace(
    /^Fachinformatiker - /,
    "Fachinformatiker/in – ",
  );
  if (loaded.ai.sessionOnlyKey) {
    try {
      loaded.ai.apiKey = sessionStorage.getItem(SESSION_KEY_NAME) || "";
    } catch {
      loaded.ai.apiKey = "";
    }
  }
  return loaded;
}

// Der API-Schlüssel landet auf Wunsch nur im sessionStorage (weg, wenn der Tab zu ist)
function persistableState() {
  if (!state.ai.sessionOnlyKey) {
    return state;
  }
  try {
    sessionStorage.setItem(SESSION_KEY_NAME, state.ai.apiKey || "");
  } catch {
    // sessionStorage gesperrt: Schlüssel gilt nur bis zum Neuladen
  }
  return { ...state, ai: { ...state.ai, apiKey: "" } };
}

function saveStateNow() {
  clearTimeout(saveTimer);
  if (demoMode) {
    return;
  }
  const ok = writeStorage(activeHeftKey(), persistableState());
  updateHeftMeta();
  setSaveIndicator(ok ? "Gespeichert" : "Speichern fehlgeschlagen");
}

function saveState() {
  if (demoMode) {
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveStateNow, 400);
}

function resetState() {
  const { ai, theme } = state;
  state = structuredClone(DEFAULT_STATE);
  state.ai = ai;
  state.theme = theme;
  saveStateNow();
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
