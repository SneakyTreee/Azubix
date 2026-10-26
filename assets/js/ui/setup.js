// Einrichtung Schritt für Schritt: immer nur ein Schritt sichtbar, Freiwilliges
// eingeklappt. Sobald Nachweise da sind, wird alles zu einer kurzen Übersicht.

const STEP_TITLES = {
  1: "Beruf",
  2: "Zeitraum & Schule",
  3: "Ferien & Urlaub",
  4: "Tätigkeiten",
};

const RHYTHM_LABELS = {
  both: "jede Woche",
  even: "gerade KW",
  odd: "ungerade KW",
  alternating: "jede 2. Woche",
};

let setupStep = 1;

function isSetupOpen() {
  return !document.getElementById("mainForm").hidden;
}

function showStep(step, { scroll = true } = {}) {
  setupStep = Math.max(1, Math.min(4, Number(step) || 1));
  setSetupOpen(true);
  document.querySelectorAll("#mainForm .sheet[data-step]").forEach((sheet) => {
    sheet.classList.toggle("active", Number(sheet.dataset.step) === setupStep);
  });

  const back = document.getElementById("stepBack");
  const next = document.getElementById("stepNext");
  // Unsichtbar statt ausgeblendet, damit "Weiter" immer rechts steht
  back.style.visibility = setupStep === 1 ? "hidden" : "visible";
  next.style.visibility = setupStep === 4 ? "hidden" : "visible";
  next.textContent = setupStep < 4 ? `Weiter: ${STEP_TITLES[setupStep + 1]}` : "";
  document.querySelectorAll(".step-dots li").forEach((dot, index) => {
    dot.classList.toggle("done", index + 1 < setupStep);
    dot.classList.toggle("current", index + 1 === setupStep);
  });

  updateRunbarVisibility();
  markRegisterCurrent();
  if (!demoMode) {
    writePrefs({ setupStep });
  }
  if (scroll) {
    const sheet = document.querySelector(`#mainForm .sheet[data-step="${setupStep}"]`);
    sheet.scrollIntoView({ behavior: "smooth", block: "start" });
    sheet.querySelector("h2").focus({ preventScroll: true });
  }
}

function setSetupOpen(open) {
  document.getElementById("mainForm").hidden = !open;
  document.getElementById("setupSummary").hidden = open || state.weeks.length === 0;
  if (!open) {
    renderSetupSummary();
  }
  updateRunbarVisibility();
  markRegisterCurrent();
}

// Beim Start und nach dem Wechsel des Ausbildungsjahrs
function initSetupView() {
  if (state.weeks.length > 0) {
    setSetupOpen(false);
  } else {
    showStep(readPrefs().setupStep || 1, { scroll: false });
  }
}

// Die untere Leiste erscheint erst im letzten Schritt oder wenn es Nachweise gibt
// Sind die Nachweise schon geschrieben, erscheint sie nur noch, wenn etwas offen ist.
function updateRunbarVisibility() {
  const runbar = document.querySelector(".runbar");
  const resume = !document.getElementById("resumeBanner").hidden;
  const openWeeks = state.weeks.some((week) => week.needsAi && !isWritten(week));
  const show = isSetupOpen() ? setupStep === 4 : openWeeks || state.weeks.length === 0;
  runbar.hidden = !(show || activeController || resume);
}

function markRegisterCurrent(resultsInView = false) {
  document.querySelectorAll(".register a").forEach((link) => {
    const step = Number(link.dataset.step);
    const current = resultsInView
      ? link.dataset.section === "e"
      : isSetupOpen() && step === setupStep;
    link.classList.toggle("current", current);
    if (current) {
      link.setAttribute("aria-current", "step");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function handleRegisterClick(event) {
  const link = event.target.closest(".register a");
  if (!link) {
    return;
  }
  event.preventDefault();
  if (link.dataset.step) {
    showStep(link.dataset.step);
    return;
  }
  const results = document.getElementById("results");
  if (!results.hidden) {
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    showStep(4);
  }
}

// Markiert "Nachweise" in der Leiste, solange die Ergebnisse im Blick sind
function watchSections() {
  const results = document.getElementById("results");
  const observer = new IntersectionObserver(
    ([entry]) => markRegisterCurrent(entry.isIntersecting && !results.hidden),
    { rootMargin: "-30% 0px -50% 0px" },
  );
  observer.observe(results);
}

// ---------- Kurzfassungen ----------

function schoolSummary() {
  const days = state.schoolDays
    .slice()
    .sort()
    .map((dow) => DAY_NAMES[dow].slice(0, 2))
    .join(", ");
  return days ? `${days}, ${RHYTHM_LABELS[state.weekType]}` : "keine Schultage";
}

function absenceCountText() {
  const own = state.absences.filter((absence) => absence.source !== "auto");
  const ferien = state.absences.length - own.length;
  const parts = [];
  if (ferien) {
    parts.push(`${ferien} Schulferien`);
  }
  if (own.length) {
    parts.push(`${own.length} eigene ${own.length === 1 ? "Eintrag" : "Einträge"}`);
  }
  return parts.join(", ");
}

function updateDetailSummaries() {
  const { hours, activities } = state;
  const custom = Object.values(hours.betriebDays || {}).some((value) => value !== "");
  document.getElementById("hoursSummary").textContent =
    `${hours.betrieb} Std. Betrieb, ${hours.schule} Std. Schule${custom ? ", Teilzeit" : ""}`;
  const own = state.absences.filter((absence) => absence.source !== "auto").length;
  document.getElementById("absenceSummary").textContent =
    own > 0 ? `${own} ${own === 1 ? "Eintrag" : "Einträge"}` : "freiwillig";
  const styles = { ich: "Ich-Form", neutral: "sachlich", stichpunkte: "Stichpunkte" };
  const lengths = { kurz: "kurz", mittel: "normal", lang: "ausführlich" };
  document.getElementById("styleSummary").textContent =
    `${styles[activities.stil]}, ${lengths[activities.laenge]}${activities.maxChars ? `, max. ${activities.maxChars} Zeichen` : ""}`;
}

function renderSetupSummary() {
  const { profile, period } = state;
  const items = [
    [1, "Beruf", `${profile.beruf}, ${profile.jahr}. Jahr`],
    [2, "Zeitraum", `${formatDate(period.start)} bis ${formatDate(period.end)}`],
    [2, "Berufsschule", schoolSummary()],
    [3, "Bundesland", STATES[state.bundesland]],
  ];
  document.getElementById("summaryList").innerHTML = items
    .map(
      ([step, label, value]) => `
      <li>
        <button type="button" class="summary-item" data-edit-step="${step}" title="${escHtml(value)}">
          <span class="summary-label">${label}</span>
          <span class="summary-value">${escHtml(value)}</span>
        </button>
      </li>`,
    )
    .join("");
}

function handleSummaryClick(event) {
  const button = event.target.closest("[data-edit-step]");
  if (button) {
    showStep(button.dataset.editStep);
  }
}
