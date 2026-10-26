function setDefaultPeriod() {
  if (state.period.start && state.period.end) {
    return;
  }
  // Ausbildungsjahr: 1. August bis 31. Juli
  const today = new Date();
  const year = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  state.period.start = dateToStr(new Date(year, 7, 1));
  state.period.end = dateToStr(new Date(year + 1, 6, 31));
}

// Datei-Auswahl: Handler mit der gewählten Datei aufrufen und das Feld leeren
function onFilePicked(id, handler) {
  document.getElementById(id).addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) {
      handler(file);
    }
    event.target.value = "";
  });
}

function onClick(id, handler) {
  document.getElementById(id)?.addEventListener("click", handler);
}

window.addEventListener("DOMContentLoaded", async () => {
  await initStorage();
  loadHefte();
  state = loadState();
  setDefaultPeriod();

  // Unterbrochene Generierungen (z.B. Tab geschlossen) wieder freigeben
  for (const week of state.weeks) {
    if (week.status === "loading") {
      week.status = "pending";
    }
  }

  const stateSelect = document.getElementById("bundesland");
  stateSelect.innerHTML = Object.entries(STATES)
    .map(([code, name]) => `<option value="${code}">${name}</option>`)
    .join("");

  const presetSelect = document.getElementById("presetSelect");
  presetSelect.innerHTML += Object.entries(AI_PRESETS)
    .map(([key, preset]) => `<option value="${key}">${preset.label}</option>`)
    .join("");

  fillBerufSelect();
  applyStateToForm();
  renderResults();
  renderHeftMenu();
  updateResumeBanner();
  showWelcomeIfNew();
  initSetupView();
  watchSections();
  initTransfer();

  // Einrichtung Schritt für Schritt
  document.querySelector(".register").addEventListener("click", handleRegisterClick);
  onClick("stepNext", () => showStep(setupStep + 1));
  onClick("stepBack", () => showStep(setupStep - 1));
  onClick("editSetupBtn", () => showStep(1));
  document.getElementById("summaryList").addEventListener("click", handleSummaryClick);

  const hasAutoFerien = state.absences.some((absence) => absence.source === "auto");
  if (!hasAutoFerien) {
    loadSchoolHolidays();
  }

  const form = document.getElementById("mainForm");
  form.addEventListener("input", handleFormInput);
  form.addEventListener("click", handleSegmentClick);

  const absenceForm = document.getElementById("absenceForm");
  document.getElementById("addAbsenceBtn").addEventListener("click", addAbsence);
  absenceForm.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addAbsence();
    }
  });
  document.getElementById("absenceList").addEventListener("click", removeAbsence);
  document.getElementById("reloadFerienBtn").addEventListener("click", loadSchoolHolidays);

  document.getElementById("genBtn").addEventListener("click", startGeneration);
  document.getElementById("cancelBtn").addEventListener("click", cancelGeneration);
  onClick("weeksOnlyBtn", createWeeksOnly);
  onClick("resumeBtn", () => startGeneration("missing"));

  const results = document.getElementById("results");
  results.addEventListener("input", handleResultInput);
  results.addEventListener("change", handleKindChange);
  results.addEventListener("click", handleResultClick);
  results.addEventListener("keydown", handleResultKeydown);
  results.addEventListener("focusin", handleEditStart);
  results.addEventListener("change", handleEditCommit);
  document.getElementById("expandAllBtn").addEventListener("click", () => setAllCards(true));
  document.getElementById("collapseAllBtn").addEventListener("click", () => setAllCards(false));
  document
    .getElementById("searchInput")
    .addEventListener("input", (event) => filterWeeks(event.target.value));

  document.getElementById("exportTxtBtn").addEventListener("click", exportTXT);
  document.getElementById("exportCsvBtn").addEventListener("click", exportCSV);
  document.getElementById("printBtn").addEventListener("click", printReports);
  document.getElementById("backupBtn").addEventListener("click", exportJSON);
  onFilePicked("importInput", importJSON);
  onClick("pdfBtn", () => exportPDF());
  onClick("docxBtn", () => exportDOCX());
  onClick("trainerBtn", () => exportTrainerView());
  onFilePicked("commentsInput", (file) => importTrainerComments(file));
  onClick("redoTemplatesBtn", regenerateTemplateWeeks);
  onClick("shortenBtn", shortenOverLimit);
  onClick("unstampBtn", removeAllStamps);

  // Ausbildungsjahre, Einführung, Beispiel
  document.addEventListener("click", handleMenuClicks);
  onClick("newHeftBtn", createNextHeft);
  onClick("deleteHeftBtn", deleteActiveHeft);
  onClick("welcomeStartBtn", dismissWelcome);
  onClick("demoBtn", () => {
    writePrefs({ onboarded: true });
    enterDemo();
  });
  onClick("demoFooterBtn", enterDemo);
  onClick("exitDemoBtn", exitDemo);

  // Abschnitte A und C: Logo, regionale Feiertage, Kalender
  onFilePicked("logoInput", handleLogoFile);
  onClick("logoRemoveBtn", removeLogo);
  document.getElementById("regionalList").addEventListener("change", handleRegionalChange);
  onFilePicked("icsInput", handleIcsFile);

  // Tastenkürzel
  document.addEventListener("keydown", handleGlobalKeys);
  onClick("shortcutsBtn", () => document.getElementById("shortcutsDialog").showModal());
  onClick("shortcutsClose", () => document.getElementById("shortcutsDialog").close());

  document.getElementById("themeBtn").addEventListener("click", cycleTheme);
  document.getElementById("settingsBtn").addEventListener("click", openSettings);
  document.getElementById("resetBtn").addEventListener("click", resetAll);

  const settingsForm = document.querySelector("#settingsDialog form");
  settingsForm.addEventListener("change", (event) => {
    if (event.target.name === "provider") {
      updateSettingsVisibility();
    }
    if (event.target.id === "presetSelect") {
      applyPreset(event.target.value);
      event.target.value = "";
    }
  });
  settingsForm.addEventListener("submit", (event) => {
    if (event.submitter?.value === "save") {
      saveSettings();
    }
  });
  document.getElementById("testBtn").addEventListener("click", testConnection);

  window.addEventListener("beforeprint", buildPrintArea);
  window.addEventListener("beforeunload", saveStateNow);
});
