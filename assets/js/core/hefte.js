// Mehrere Ausbildungsjahre ("Hefte"). Jedes Heft ist ein eigener, vollständiger
// Zustand. `state` ist immer das aktive Heft, die anderen liegen nur im Speicher.

const HEFTE_KEY = "azubix-hefte";
let hefte = { active: "h1", items: [{ id: "h1", label: "" }] };

function heftKey(id) {
  return `azubix-heft-${id}`;
}

function activeHeftKey() {
  return heftKey(hefte.active);
}

function loadHefte() {
  const saved = readStorage(HEFTE_KEY);
  if (saved?.items?.length) {
    hefte = saved;
    return;
  }
  // Erster Start mit Heften: altes Einzel-Heft übernehmen
  const legacy = readStorage(LEGACY_STATE_KEY);
  if (legacy) {
    writeStorage(heftKey("h1"), legacy);
  }
  writeStorage(HEFTE_KEY, hefte);
}

function heftLabelFor(data) {
  const jahr = data?.profile?.jahr || "1";
  const start = data?.period?.start?.slice(0, 4);
  const end = data?.period?.end?.slice(2, 4);
  return start && end ? `${jahr}. Ausbildungsjahr (${start}/${end})` : `${jahr}. Ausbildungsjahr`;
}

function updateHeftMeta() {
  const item = hefte.items.find((entry) => entry.id === hefte.active);
  const label = heftLabelFor(state);
  if (item && item.label !== label) {
    item.label = label;
    writeStorage(HEFTE_KEY, hefte);
    renderHeftMenu();
  }
}

function switchHeft(id) {
  if (id === hefte.active || !hefte.items.some((entry) => entry.id === id)) {
    return;
  }
  saveStateNow();
  hefte.active = id;
  writeStorage(HEFTE_KEY, hefte);
  state = loadState();
  setDefaultPeriod();
  refreshWholeApp();
  showToast("success", `${heftLabelFor(state)} geöffnet`);
}

// Nächstes Ausbildungsjahr: Profil und Einstellungen übernehmen, Zeitraum und
// Nachweis-Nummer schließen direkt an das aktuelle Heft an.
function createNextHeft() {
  saveStateNow();
  const previous = state;
  const lastNr = previous.weeks.at(-1)?.nr;
  const next = structuredClone(DEFAULT_STATE);
  next.profile = {
    ...structuredClone(previous.profile),
    jahr: String(Math.min(Number(previous.profile.jahr) + 1, 4)),
  };
  next.profile.startNr = lastNr ? lastNr + 1 : Number(previous.profile.startNr) || 1;
  next.activities = structuredClone(previous.activities);
  next.hours = structuredClone(previous.hours);
  next.ai = structuredClone(previous.ai);
  for (const key of [
    "bundesland",
    "schoolDays",
    "weekType",
    "firstWeekType",
    "regionalHolidays",
    "theme",
  ]) {
    next[key] = structuredClone(previous[key]);
  }
  if (previous.period.end) {
    const start = addDays(parseDate(previous.period.end), 1);
    next.period = {
      start: dateToStr(start),
      end: dateToStr(
        addDays(new Date(start.getFullYear() + 1, start.getMonth(), start.getDate()), -1),
      ),
    };
  }

  const id = `h${Date.now().toString(36)}`;
  writeStorage(heftKey(id), next);
  hefte.items.push({ id, label: heftLabelFor(next) });
  hefte.active = id;
  writeStorage(HEFTE_KEY, hefte);
  state = loadState();
  refreshWholeApp();
  loadSchoolHolidays();
  showToast(
    "success",
    `${heftLabelFor(state)} angelegt. Nachweise beginnen bei Nr. ${state.profile.startNr}.`,
  );
}

async function deleteActiveHeft() {
  if (hefte.items.length < 2) {
    showToast(
      "error",
      "Das ist dein einziges Ausbildungsjahr. Nutze „Alles löschen“ unten, um neu anzufangen.",
    );
    return;
  }
  const label = heftLabelFor(state);
  const answer = await askChoice(
    `${label} löschen?`,
    "Alle Eingaben und Nachweise dieses Jahres werden gelöscht. Die anderen Jahre bleiben erhalten.",
    [{ value: "delete", label: "Jahr löschen", danger: true }],
  );
  if (answer !== "delete") {
    return;
  }
  removeStorage(activeHeftKey());
  hefte.items = hefte.items.filter((entry) => entry.id !== hefte.active);
  hefte.active = hefte.items[0].id;
  writeStorage(HEFTE_KEY, hefte);
  state = loadState();
  refreshWholeApp();
  showToast("success", `${label} gelöscht`);
}
