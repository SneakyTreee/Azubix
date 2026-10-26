// Rahmen der App: Ausbildungsjahr-Menü, Einführung, Beispiel-Modus, Tastenkürzel,
// Weiterschreiben nach Neuladen, Logo, regionale Feiertage, Kalender-Import, Rahmenplan

const PREFS_KEY = "azubix-prefs";

function readPrefs() {
  return readStorage(PREFS_KEY) || {};
}

function writePrefs(changes) {
  writeStorage(PREFS_KEY, { ...readPrefs(), ...changes });
}

// Alles neu zeichnen, z.B. nach dem Wechsel des Ausbildungsjahrs
function refreshWholeApp() {
  applyStateToForm();
  renderResults();
  renderHeftMenu();
  updateResumeBanner();
  initSetupView();
  document.getElementById("demoBanner").hidden = !demoMode;
  document.getElementById("welcome").hidden = true;
}

// ---------- Ausbildungsjahre ----------

function renderHeftMenu() {
  document.getElementById("heftLabel").textContent = demoMode ? "Beispiel" : heftLabelFor(state);
  document.getElementById("heftList").innerHTML = hefte.items
    .map(
      (item) =>
        `<button type="button" class="menu-item" role="menuitemradio" aria-checked="${item.id === hefte.active}" data-heft="${item.id}">${escHtml(item.label || "Ausbildungsjahr")}</button>`,
    )
    .join("");
  document.getElementById("deleteHeftBtn").hidden = hefte.items.length < 2;
}

function closeMenus(except) {
  document.querySelectorAll("details.menu[open]").forEach((menu) => {
    if (menu !== except) {
      menu.open = false;
    }
  });
}

function handleMenuClicks(event) {
  const menu = event.target.closest("details.menu");
  closeMenus(menu);
  const item = event.target.closest(".menu-item");
  if (item && menu && item.tagName === "BUTTON") {
    menu.open = false;
  }
  const heftButton = event.target.closest("[data-heft]");
  if (heftButton) {
    if (demoMode) {
      exitDemo();
    }
    switchHeft(heftButton.dataset.heft);
  }
}

// ---------- Einführung und Beispiel ----------

function showWelcomeIfNew() {
  const isNew = !readPrefs().onboarded && !state.profile.name && state.weeks.length === 0;
  document.getElementById("welcome").hidden = !isNew;
}

function dismissWelcome() {
  writePrefs({ onboarded: true });
  document.getElementById("welcome").hidden = true;
  showStep(1);
}

const DEMO_TEXTS = {
  betrieb: [
    "Ich habe für eine neue Kollegin einen Laptop vorbereitet: Windows 11 per Autopilot ausgerollt, das Gerät in Intune registriert und die Standard-Apps zugewiesen. Danach habe ich zwei Tickets zu Druckerproblemen gelöst.",
    "Im Serverraum habe ich mit meinem Ausbilder neue Netzwerkdosen im 2. OG gepatcht und die Belegung im Patchplan dokumentiert. Anschließend habe ich die Verbindungen mit einem Kabeltester geprüft.",
    "Mit PowerShell habe ich ein Skript geschrieben, das inaktive Benutzerkonten im Active Directory auflistet. Das Ergebnis habe ich mit dem Team besprochen und zwei Konten nach Rücksprache deaktiviert.",
    "Ich habe im Service-Desk Passwort-Resets und VPN-Probleme bearbeitet. Wiederkehrende Lösungen habe ich als Anleitung im Wiki ergänzt.",
    "Für den Umzug der Buchhaltung habe ich zwölf Arbeitsplätze abgebaut, beschriftet und am neuen Standort wieder angeschlossen. Am Ende habe ich alle Drucker und Netzlaufwerke getestet.",
    "Ich habe die Datensicherung der Dateiserver kontrolliert, einen fehlgeschlagenen Job neu gestartet und die Rücksicherung einer Testdatei geprüft.",
    "Zusammen mit einem Kollegen habe ich einen neuen Switch im Verteilerraum konfiguriert: VLANs angelegt, Ports zugewiesen und die Konfiguration gesichert.",
    "Ich habe Softwarepakete für das Update von Microsoft 365 vorbereitet und auf einer Testgruppe von fünf Rechnern verteilt. Probleme gab es bei einem Add-in, das ich gemeldet habe.",
    "Heute habe ich das Inventar der Leihgeräte aktualisiert, defekte Netzteile aussortiert und Ersatz bestellt. Die Liste liegt jetzt im Teams-Kanal der Abteilung.",
    "Ein Drucker im Vertrieb meldete ständig Papierstau. Ich habe die Einzugsrollen gereinigt, die Firmware aktualisiert und mit der Kollegin einen Testdruck gemacht.",
    "Für zwei neue Azubis habe ich Benutzerkonten im Active Directory angelegt, Gruppen zugewiesen und die Postfächer in Exchange Online eingerichtet.",
    "Mit meinem Ausbilder habe ich die Firewall-Regeln für das Gäste-WLAN durchgesehen und eine veraltete Freigabe entfernt. Die Änderung habe ich im Change-Log festgehalten.",
    "Ich habe ein Ticket zu langsamen Anmeldezeiten untersucht. Ursache war ein fehlerhaftes Anmeldeskript, das ich mit dem Kollegen aus dem Server-Team korrigiert habe.",
    "Am Vormittag habe ich bei der monatlichen Patch-Runde geholfen und die Server nach dem Neustart überwacht. Danach habe ich den Bericht für die Teamleitung erstellt.",
  ],
  schule: [
    "Im Lernfeld 3 ging es um IPv4-Adressierung und Subnetting. Wir haben Netze für ein Beispielunternehmen aufgeteilt. In Wirtschafts- und Sozialkunde haben wir den Ausbildungsvertrag besprochen.",
    "Lernfeld 2: Wir haben Hardware für einen Büroarbeitsplatz nach Kundenwunsch ausgewählt und Angebote verglichen. In Englisch haben wir eine Support-Mail geschrieben.",
    "Im Lernfeld 4 haben wir eine Schutzbedarfsanalyse für eine Arztpraxis erstellt und Maßnahmen nach BSI-Grundschutz zugeordnet.",
    "Lernfeld 5: Einführung in relationale Datenbanken, Entity-Relationship-Modell und erste SQL-Abfragen. In Deutsch ging es um Protokolle.",
  ],
};

function buildDemoState() {
  const demo = structuredClone(DEFAULT_STATE);
  demo.ai = structuredClone(state.ai);
  demo.theme = state.theme;
  demo.profile = {
    ...demo.profile,
    name: "Lena Hoffmann",
    beruf: "Fachinformatiker/in – Systemintegration",
    betrieb: "Stadtwerke Musterstadt GmbH",
    abteilung: "IT-Service",
    ausbilder: "Herr Wagner",
  };
  demo.period = { start: "2026-08-31", end: "2026-09-25" };
  demo.schoolDays = [2];
  demo.bundesland = "NW";
  demo.absences = [
    {
      id: "d1",
      type: "urlaub",
      name: "Urlaub",
      start: "2026-09-14",
      end: "2026-09-15",
      source: "manual",
    },
  ];
  demo.activities = {
    ...demo.activities,
    taetigkeiten:
      "Tickets im Service-Desk, Clients mit Intune einrichten, Netzwerkdosen patchen, Backups prüfen",
    technologies: "Windows 11, Intune, Active Directory, PowerShell, Cisco Switches",
  };
  return demo;
}

function fillDemoWeeks() {
  const counters = { betrieb: 0, schule: 0 };
  state.weeks = buildWeeks();
  state.weeks.forEach((week, index) => {
    for (const day of week.days) {
      if (day.kind === "betrieb" || day.kind === "schule") {
        const texts = DEMO_TEXTS[day.kind];
        day.content = texts[counters[day.kind] % texts.length];
        counters[day.kind] += 1;
      }
    }
    if (week.needsAi) {
      week.status = "done";
      week.summary = "Arbeit im IT-Service, Netzwerkthemen und Berufsschule.";
      week.unterweisung =
        index % 3 === 0 ? "Unterweisung zum Datenschutz beim Umgang mit Kundendaten." : "";
      week.unterweisungHours = week.unterweisung ? 1 : "";
    }
    if (index < 2 && week.needsAi) {
      week.reviewed = "2026-10-20";
      week.transferred = "2026-10-21";
    }
  });
  const second = state.weeks[1];
  if (second) {
    second.comment = "Bitte am Mittwoch genauer beschreiben, welche VLANs du angelegt hast.";
  }
  const open = state.weeks.find((week) => week.needsAi && !week.reviewed);
  if (open) {
    open.days[0].notes = "Laptop für neue Kollegin, Autopilot, zwei Drucker-Tickets";
  }
}

function enterDemo() {
  saveStateNow();
  demoMode = true;
  state = buildDemoState();
  fillDemoWeeks();
  refreshWholeApp();
  document.getElementById("demoBanner").scrollIntoView({ behavior: "smooth", block: "center" });
  showToast("success", "Beispiel geöffnet. Schau dir unten die fertigen Nachweise an.");
}

function exitDemo() {
  demoMode = false;
  state = loadState();
  refreshWholeApp();
  showToast("success", "Zurück bei deinen Daten");
}

// ---------- Weiterschreiben nach Neuladen ----------

function updateResumeBanner() {
  const weeks = demoMode ? [] : interruptedWeeks();
  const banner = document.getElementById("resumeBanner");
  banner.hidden = weeks.length === 0 || Boolean(activeController);
  if (!banner.hidden) {
    document.getElementById("resumeText").textContent =
      `Das Schreiben wurde unterbrochen. ${weeks.length} ${weeks.length === 1 ? "Woche fehlt" : "Wochen fehlen"} noch.`;
  }
  updateRunbarVisibility();
}

// ---------- Firmenlogo ----------

function renderLogo() {
  const preview = document.getElementById("logoPreview");
  const logo = state.profile.logo;
  preview.innerHTML = logo ? `<img src="${logo}" alt="" />` : "<span>Kein Logo</span>";
  preview.classList.toggle("has-logo", Boolean(logo));
  document.getElementById("logoRemoveBtn").hidden = !logo;
}

function handleLogoFile(file) {
  if (!file) {
    return;
  }
  if (!/^image\/(png|jpeg)$/.test(file.type)) {
    showToast("error", "Das Logo muss eine PNG- oder JPG-Datei sein.");
    return;
  }
  if (file.size > 500 * 1024) {
    showToast(
      "error",
      "Das Logo ist größer als 500 KB. Verkleinere es und versuch es noch einmal.",
    );
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    state.profile.logo = reader.result;
    saveState();
    renderLogo();
    showToast("success", "Logo übernommen");
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  state.profile.logo = "";
  saveState();
  renderLogo();
}

// ---------- Regionale Feiertage ----------

function renderRegionalHolidays() {
  const options =
    typeof getRegionalHolidayOptions === "function"
      ? getRegionalHolidayOptions(state.bundesland)
      : [];
  const fieldset = document.getElementById("regionalHolidays");
  fieldset.hidden = options.length === 0;
  const active = activeRegionalHolidays();
  document.getElementById("regionalList").innerHTML = options
    .map(
      (option) => `
      <label class="check">
        <input type="checkbox" value="${escHtml(option.id)}" ${active.includes(option.id) ? "checked" : ""} />
        <span>${escHtml(option.name)}${option.hint ? ` <em>${escHtml(option.hint)}</em>` : ""}</span>
      </label>`,
    )
    .join("");
}

function handleRegionalChange(event) {
  if (event.target.type !== "checkbox") {
    return;
  }
  state.regionalHolidays = [...document.querySelectorAll("#regionalList input:checked")].map(
    (input) => input.value,
  );
  saveState();
  schedulePreview();
}

// ---------- Kalender-Import ----------

async function handleIcsFile(file) {
  if (!file) {
    return;
  }
  if (typeof parseICS !== "function") {
    showToast("error", "Der Kalender-Import ist nicht geladen. Lade die Seite neu.");
    return;
  }
  try {
    const { events, skippedRecurring } = parseICS(await file.text());
    const type = document.getElementById("a-type").value;
    if (events.length === 0) {
      showToast(
        "error",
        "In der Datei steht kein Termin. Exportiere den Kalender als .ics und versuch es noch einmal.",
      );
      return;
    }
    for (const event of events) {
      state.absences.push({
        id: makeId(),
        type,
        name: event.name || ABSENCE_LABELS[type],
        start: event.start,
        end: event.end,
        source: "ics",
      });
    }
    saveState();
    renderAbsences();
    schedulePreview();
    showToast(
      "success",
      `${events.length} ${events.length === 1 ? "Termin" : "Termine"} als ${ABSENCE_LABELS[type]} eingetragen${skippedRecurring ? `. ${skippedRecurring} Serientermine wurden übersprungen` : ""}.`,
    );
  } catch (error) {
    showToast("error", `Die Datei ließ sich nicht lesen (${error.message}).`);
  }
}

// ---------- Ausbildungsrahmenplan ----------

function renderRahmenplan() {
  const panel = document.getElementById("rahmenplanPanel");
  const items =
    typeof analyzeRahmenplan === "function" && state.weeks.length > 0
      ? analyzeRahmenplan(state.weeks, state.profile.beruf)
      : [];
  panel.hidden = items.length === 0;
  if (items.length === 0) {
    return;
  }
  const covered = items.filter((item) => item.hits > 0).length;
  const max = Math.max(1, ...items.map((item) => item.hits));
  document.getElementById("rahmenplanSummary").textContent =
    `Ausbildungsrahmenplan: ${covered} von ${items.length} Themen kommen in deinen Einträgen vor`;
  document.getElementById("rahmenplanList").innerHTML = items
    .map(
      (item) => `
      <li class="${item.hits === 0 ? "uncovered" : ""}">
        <span class="coverage-title">${escHtml(item.title)}</span>
        <span class="coverage-bar" aria-hidden="true"><i style="width:${(item.hits / max) * 100}%"></i></span>
        <span class="coverage-count">${item.hits === 0 ? "noch nicht vorgekommen" : `${item.hits} ${item.hits === 1 ? "Tag" : "Tage"}`}</span>
      </li>`,
    )
    .join("");
}

// ---------- Tastenkürzel ----------

function isTyping(target) {
  return target.closest("input, textarea, select, [contenteditable]");
}

function jumpWeek(direction) {
  const cards = [...document.querySelectorAll(".week-card:not([hidden])")];
  if (cards.length === 0) {
    return;
  }
  const current = cards.findIndex((card) => card.classList.contains("open"));
  const next = cards[Math.max(0, Math.min(cards.length - 1, current + direction))] || cards[0];
  cards.forEach((card) => card !== next && setCardOpen(card, false));
  setCardOpen(next, true);
  next.scrollIntoView({ behavior: "smooth", block: "start" });
  next.querySelector(".week-head").focus({ preventScroll: true });
}

function handleGlobalKeys(event) {
  if (event.altKey && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
    event.preventDefault();
    jumpWeek(event.key === "ArrowDown" ? 1 : -1);
    return;
  }
  if (event.key === "?" && !isTyping(event.target) && !document.querySelector("dialog[open]")) {
    event.preventDefault();
    document.getElementById("shortcutsDialog").showModal();
  }
  if (event.key === "Escape") {
    closeMenus();
  }
}
