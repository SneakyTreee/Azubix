function fileBaseName() {
  const name = (state.profile.name || "Azubi").trim().replace(/\s+/g, "_");
  return `Berichtsheft_${name.replace(/[^\wäöüÄÖÜß-]/g, "")}`;
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Summe der Woche inklusive Unterweisungen
function weekHours(week) {
  return (
    week.days.reduce((sum, day) => sum + (Number(day.hours) || 0), 0) +
    (Number(week.unterweisungHours) || 0)
  );
}

function weekToText(week) {
  const lines = [
    `Ausbildungsnachweis Nr. ${week.nr} – KW ${week.kw}/${week.year} (${formatDate(week.monday)} – ${formatDate(week.friday)})`,
    "",
  ];
  for (const day of week.days) {
    lines.push(
      `${day.name}, ${formatDate(day.date)} [${DAY_KINDS[day.kind].label}, ${day.hours} Std.]`,
      day.content || "—",
      "",
    );
  }
  if (week.unterweisung) {
    lines.push(
      `Unterweisungen, betrieblicher Unterricht${week.unterweisungHours ? ` [${week.unterweisungHours} Std.]` : ""}:`,
      week.unterweisung,
      "",
    );
  }
  if (week.summary) {
    lines.push(`Zusammenfassung: ${week.summary}`);
  }
  return lines.join("\n").trim();
}

function exportTXT() {
  if (!ensureWeeks()) {
    return;
  }
  const { profile } = state;
  const separator = "=".repeat(64);
  let text = `AUSBILDUNGSNACHWEISE\n${separator}\n`;
  text += `Name: ${profile.name || "—"}\nBeruf: ${profile.beruf}\n`;
  text += `Betrieb: ${profile.betrieb || "—"}${profile.abteilung ? ` (${profile.abteilung})` : ""}\n`;
  text += `Ausbilder/in: ${profile.ausbilder || "—"}\n${profile.jahr}. Ausbildungsjahr\n`;

  for (const week of state.weeks) {
    text += `\n${separator}\n${weekToText(week)}\n`;
    text += `Gesamtstunden: ${weekHours(week)}\n\n`;
    text += "Auszubildende/r: ______________________  Datum: ____________\n";
    text += "Ausbilder/in:    ______________________  Datum: ____________\n";
  }

  downloadFile(text, `${fileBaseName()}.txt`, "text/plain;charset=utf-8");
  showToast("success", "TXT-Datei gespeichert");
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportCSV() {
  if (!ensureWeeks()) {
    return;
  }
  const rows = [
    [
      "Nr",
      "KW",
      "Jahr",
      "Datum",
      "Wochentag",
      "Art",
      "Stunden",
      "Eintrag",
      "Wochenzusammenfassung",
      "Unterweisungen",
    ],
  ];
  for (const week of state.weeks) {
    for (const day of week.days) {
      rows.push([
        week.nr,
        week.kw,
        week.year,
        formatDate(day.date),
        day.name,
        DAY_KINDS[day.kind].label,
        String(day.hours).replace(".", ","),
        day.content,
        week.summary,
        week.unterweisung || "",
      ]);
    }
  }
  // BOM, damit Excel Umlaute korrekt anzeigt
  const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  downloadFile(csv, `${fileBaseName()}.csv`, "text/csv;charset=utf-8");
  showToast("success", "CSV-Datei gespeichert. Sie lässt sich direkt in Excel öffnen.");
}

function exportJSON() {
  const backup = {
    app: "azubix",
    version: 2,
    exportedAt: new Date().toISOString(),
    state: { ...state, ai: { ...state.ai, apiKey: "" } },
  };
  downloadFile(
    JSON.stringify(backup, null, 2),
    `${fileBaseName()}_Backup.json`,
    "application/json",
  );
  showToast("success", "Backup gespeichert. Dein API-Schlüssel ist nicht enthalten.");
}

async function importJSON(file) {
  try {
    const data = JSON.parse(await file.text());
    const imported = data.state || data;
    if (!imported.profile || !imported.period) {
      throw new Error("Unbekanntes Format");
    }
    const apiKey = state.ai.apiKey;
    state = mergeDefaults(structuredClone(DEFAULT_STATE), imported);
    state.ai.apiKey = state.ai.apiKey || apiKey;
    saveStateNow();
    applyStateToForm();
    renderResults();
    showToast("success", "Backup geladen");
  } catch (error) {
    showToast(
      "error",
      `Das Backup ließ sich nicht laden (${error.message}). Wähle eine JSON-Datei, die dieser Generator gespeichert hat.`,
    );
  }
}

function ensureWeeks() {
  if (state.weeks.length === 0) {
    showToast("error", "Es gibt noch keine Nachweise. Lass sie zuerst schreiben.");
    return false;
  }
  return true;
}

function multiline(text) {
  return escHtml(text).replace(/\n/g, "<br>");
}

function printReports() {
  if (ensureWeeks()) {
    window.print();
  }
}

// Wird auch bei Strg+P über das "beforeprint"-Event aufgerufen
function buildPrintArea() {
  const { profile } = state;
  const pages = state.weeks
    .map(
      (week) => `
      <section class="print-page">
        <header class="print-head">
          <div>
            <h2>Ausbildungsnachweis Nr. ${week.nr}</h2>
            <span>KW ${week.kw}/${week.year}, ${formatDate(week.monday)} bis ${formatDate(week.friday)}</span>
          </div>
          ${profile.logo ? `<img class="print-logo" src="${profile.logo}" alt="" />` : ""}
        </header>
        <table class="print-meta">
          <tr><th>Name</th><td>${escHtml(profile.name)}</td><th>Ausbildungsjahr</th><td>${escHtml(profile.jahr)}.</td></tr>
          <tr><th>Beruf</th><td>${escHtml(profile.beruf)}</td><th>Betrieb</th><td>${escHtml(profile.betrieb)}${profile.abteilung ? ` / ${escHtml(profile.abteilung)}` : ""}</td></tr>
        </table>
        <table class="print-days">
          <thead><tr><th>Tag</th><th>Tätigkeiten / Unterrichtsthemen</th><th>Std.</th></tr></thead>
          <tbody>
            ${week.days
              .map(
                (day) => `<tr>
                  <td><strong>${day.name}</strong><br>${formatDate(day.date)}<br><em>${DAY_KINDS[day.kind].label}</em></td>
                  <td>${multiline(day.content)}</td>
                  <td>${day.hours}</td>
                </tr>`,
              )
              .join("")}
          </tbody>
          <tfoot><tr><td colspan="2">Gesamtstunden</td><td>${weekHours(week)}</td></tr></tfoot>
        </table>
        ${week.unterweisung ? `<p class="print-summary"><strong>Unterweisungen, betrieblicher Unterricht${week.unterweisungHours ? ` (${week.unterweisungHours} Std.)` : ""}:</strong> ${multiline(week.unterweisung)}</p>` : ""}
        ${week.summary ? `<p class="print-summary"><strong>Zusammenfassung:</strong> ${escHtml(week.summary)}</p>` : ""}
        <div class="print-sign">
          <div><span>Datum, Unterschrift Auszubildende/r</span></div>
          <div><span>Datum, Unterschrift Ausbilder/in${profile.ausbilder ? ` (${escHtml(profile.ausbilder)})` : ""}</span></div>
        </div>
      </section>`,
    )
    .join("");

  document.getElementById("printArea").innerHTML = pages;
}

// Reiner Text für das IHK-Portal: einheitliche Zeilenumbrüche, keine doppelten Leerzeichen
function plainText(text) {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// Alle Tage einer Art (Betrieb/Schule) für das Wochenfeld im IHK-Formular
function sectionText(week, kind) {
  return week.days
    .filter((day) => day.kind === kind && day.content.trim())
    .map((day) => {
      const text = plainText(day.content);
      return text.includes("\n") ? `${day.name}:\n${text}` : `${day.name}: ${text}`;
    })
    .join("\n\n");
}

function sectionHours(week, kind) {
  return week.days
    .filter((day) => day.kind === kind)
    .reduce((sum, day) => sum + (Number(day.hours) || 0), 0)
    .toLocaleString("de-DE");
}

async function copyText(text, message = "Text kopiert") {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const helper = document.createElement("textarea");
    helper.value = text;
    document.body.append(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }
  if (message) {
    showToast("success", message);
  }
}
