const ABSENCE_LABELS = {
  schulferien: "Schulferien",
  urlaub: "Urlaub",
  krank: "Krankheit",
  schulblock: "Schulblock",
};

let previewTimer;
let ferienTimer;
let ferienRequestId = 0;

// ---------- Formular <-> State ----------

function getPath(object, path) {
  return path.split(".").reduce((current, key) => current?.[key], object);
}

function setPath(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  keys.reduce((current, key) => current[key], object)[last] = value;
}

function applyStateToForm() {
  document.querySelectorAll("[data-bind]").forEach((element) => {
    const value = getPath(state, element.dataset.bind);
    if (element.type === "checkbox") {
      element.checked = Boolean(value);
    } else {
      element.value = value ?? "";
    }
  });
  applyBerufToForm();
  document.querySelectorAll('input[name="schoolDay"]').forEach((checkbox) => {
    checkbox.checked = state.schoolDays.includes(Number(checkbox.value));
  });
  document.querySelectorAll("[data-seg]").forEach((button) => {
    const active = state[button.dataset.seg] === button.dataset.value;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.getElementById("firstWeekPicker").hidden = state.weekType !== "alternating";
  applyTheme();
  renderAbsences();
  renderRegionalHolidays();
  renderLogo();
  updatePreview();
}

// ---------- Ausbildungsberuf ----------

const BERUF_OTHER = "__anderer";

function fillBerufSelect() {
  const select = document.getElementById("f-beruf-select");
  select.innerHTML =
    Object.entries(IT_BERUFE)
      .map(
        ([group, berufe]) =>
          `<optgroup label="${escHtml(group)}">${berufe.map((beruf) => `<option>${escHtml(beruf)}</option>`).join("")}</optgroup>`,
      )
      .join("") + `<option value="${BERUF_OTHER}">Anderer Beruf, selbst eintragen</option>`;
}

function applyBerufToForm() {
  const known = Object.values(IT_BERUFE).flat().includes(state.profile.beruf);
  document.getElementById("f-beruf-select").value = known ? state.profile.beruf : BERUF_OTHER;
  document.getElementById("berufOtherField").hidden = known;
  document.getElementById("f-beruf").value = known ? "" : state.profile.beruf;
}

function handleBerufInput(element) {
  if (element.id === "f-beruf-select") {
    const other = element.value === BERUF_OTHER;
    document.getElementById("berufOtherField").hidden = !other;
    state.profile.beruf = other ? document.getElementById("f-beruf").value.trim() : element.value;
    if (other) {
      document.getElementById("f-beruf").focus();
    }
  } else {
    state.profile.beruf = element.value;
  }
  saveState();
  schedulePreview();
}

function handleFormInput(event) {
  const element = event.target;
  if (element.id === "f-beruf-select" || element.id === "f-beruf") {
    handleBerufInput(element);
  } else if (element.dataset.bind) {
    let value = element.value;
    if (element.type === "checkbox") {
      value = element.checked;
    } else if (element.type === "number") {
      value = element.value === "" ? "" : Number(element.value);
    }
    setPath(state, element.dataset.bind, value);
    saveState();
    if (element.dataset.bind === "activities.maxChars") {
      state.weeks.forEach((week) => week.days.forEach(updateCharCount));
    }
    if (["period.start", "period.end", "bundesland"].includes(element.dataset.bind)) {
      scheduleFerienLoad();
    }
    if (element.dataset.bind === "bundesland") {
      state.regionalHolidays = null;
      renderRegionalHolidays();
    }
    schedulePreview();
  } else if (element.name === "schoolDay") {
    state.schoolDays = [...document.querySelectorAll('input[name="schoolDay"]:checked')].map(
      (checkbox) => Number(checkbox.value),
    );
    saveState();
    schedulePreview();
  }
}

function handleSegmentClick(event) {
  const button = event.target.closest("[data-seg]");
  if (!button) {
    return;
  }
  state[button.dataset.seg] = button.dataset.value;
  saveState();
  applyStateToForm();
}

// ---------- Vorschau ----------

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 150);
}

function updatePreview() {
  const weeks = buildWeeks();
  const summary = summarizeSchedule(weeks);
  renderTimeline(document.getElementById("previewTimeline"), weeks, false);

  const info = document.getElementById("generateInfo");
  if (weeks.length === 0) {
    info.textContent =
      "Wähle einen gültigen Zeitraum, dann siehst du hier, wie viel zu schreiben ist.";
    return;
  }
  const duration = estimateDuration(summary.aiWeeks);
  const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
  const timing =
    state.ai.provider === "offline"
      ? "Ohne KI ist das sofort fertig."
      : `Mit ${state.ai.provider === "pollinations" ? "der kostenlosen KI" : "deinem API-Schlüssel"} dauert das ${duration}.`;
  info.textContent = `${plural(summary.weeks, "Woche", "Wochen")} mit ${plural(summary.betrieb, "Betriebstag", "Betriebstagen")} und ${plural(summary.schule, "Schultag", "Schultagen")}. ${timing}`;
  document.getElementById("providerChip").textContent =
    state.ai.provider === "pollinations"
      ? "KI: kostenlos"
      : state.ai.provider === "custom"
        ? "KI: eigener Schlüssel"
        : "Ohne KI";
  updateRegister();
  updateDetailSummaries();
}

// ---------- Register (linke Leiste) ----------

function updateRegister() {
  const { profile, period, activities } = state;
  const done = {
    a: Boolean(profile.beruf.trim()),
    b: Boolean(period.start && period.end && period.end >= period.start),
    c: Boolean(state.bundesland),
    d: Boolean(activities.taetigkeiten.trim()),
  };
  for (const [section, complete] of Object.entries(done)) {
    document
      .querySelector(`.register [data-section="${section}"]`)
      ?.classList.toggle("done", complete);
  }
  const count = document.getElementById("registerCount");
  const aiWeeks = state.weeks.filter((week) => week.needsAi);
  count.textContent =
    aiWeeks.length > 0
      ? `${aiWeeks.filter((week) => ["done", "partial", "fallback"].includes(week.status)).length}/${aiWeeks.length}`
      : "";
}

function scheduleFerienLoad() {
  clearTimeout(ferienTimer);
  ferienTimer = setTimeout(loadSchoolHolidays, 600);
}

async function loadSchoolHolidays() {
  const { start, end } = state.period;
  const status = document.getElementById("ferienStatus");
  if (!start || !end || end < start) {
    return;
  }
  const requestId = ++ferienRequestId;
  status.textContent = "Schulferien werden geladen …";

  try {
    const ferien = await fetchSchoolHolidays(state.bundesland, start, end);
    if (requestId !== ferienRequestId) {
      return;
    }
    state.absences = [
      ...state.absences.filter((absence) => absence.source !== "auto"),
      ...ferien.map((entry) => ({
        id: makeId(),
        type: "schulferien",
        source: "auto",
        ...entry,
      })),
    ];
    status.textContent =
      ferien.length > 0
        ? `${ferien.length} Ferienzeiträume für ${STATES[state.bundesland]} automatisch geladen.`
        : `Keine Schulferien in ${STATES[state.bundesland]} im gewählten Zeitraum.`;
    saveState();
    renderAbsences();
    schedulePreview();
  } catch (error) {
    console.warn(error);
    if (requestId === ferienRequestId) {
      status.textContent =
        "Schulferien konnten nicht geladen werden (offline?). Bitte manuell eintragen.";
    }
  }
}

function renderAbsences() {
  const list = document.getElementById("absenceList");
  const sorted = [...state.absences].sort((a, b) => a.start.localeCompare(b.start));
  if (sorted.length === 0) {
    list.innerHTML = '<li class="empty">Noch nichts eingetragen.</li>';
    return;
  }
  list.innerHTML = sorted
    .map(
      (absence) => `
      <li class="absence absence-${absence.type}">
        <span class="absence-type">${ABSENCE_LABELS[absence.type] || absence.type}</span>
        <span class="absence-name">${escHtml(absence.name)}${absence.source === "auto" ? " <small>auto</small>" : ""}</span>
        <span class="absence-dates">${formatDate(absence.start)} – ${formatDate(absence.end)}</span>
        <button type="button" class="icon-btn" data-remove="${absence.id}" aria-label="${escHtml(absence.name)} entfernen">×</button>
      </li>`,
    )
    .join("");
  updateDetailSummaries();
}

function addAbsence() {
  const form = document.getElementById("absenceForm");
  const field = (name) => form.querySelector(`[name="${name}"]`);
  const type = field("absenceType").value;
  const start = field("absenceStart").value;
  const end = field("absenceEnd").value || start;
  const name = field("absenceName").value.trim() || ABSENCE_LABELS[type];

  if (!start) {
    showToast("error", "Trag bei „von“ ein Datum ein.");
    return;
  }
  if (end < start) {
    showToast("error", "„bis“ liegt vor „von“. Tausch die beiden Daten.");
    return;
  }

  state.absences.push({ id: makeId(), type, name, start, end, source: "manual" });
  for (const name of ["absenceName", "absenceStart", "absenceEnd"]) {
    field(name).value = "";
  }
  saveState();
  renderAbsences();
  schedulePreview();
  showToast("success", `${name} eingetragen`);
}

function removeAbsence(event) {
  const button = event.target.closest("[data-remove]");
  if (!button) {
    return;
  }
  state.absences = state.absences.filter((absence) => absence.id !== button.dataset.remove);
  saveState();
  renderAbsences();
  schedulePreview();
}
