function gatherCurrentContent() {
  return generatedWeeks.map((week) => {
    const days = week.days.map((day) => {
      const element = document.getElementById(`day-${day.date}`);
      const content = element ? element.value : day.content;
      return { ...day, content };
    });

    const summaryElement = document.getElementById(`summary-${week.monday}`);
    const summary = summaryElement ? summaryElement.value : week.summary;
    return { ...week, days, summary };
  });
}

function exportAll() {
  const azubiName = document.getElementById("azubiName").value || "Azubi";
  const beruf = document.getElementById("beruf").value;
  const betrieb = document.getElementById("betrieb").value || "Betrieb";
  const ausbildungsjahr = document.getElementById("ausbildungsjahr").value;
  const weeks = gatherCurrentContent();

  let text = "AUSBILDUNGSNACHWEISE\n";
  text += `${"=".repeat(60)}\n`;
  text += `Azubi: ${azubiName}\nBeruf: ${beruf}\nBetrieb: ${betrieb}\n${ausbildungsjahr}. Ausbildungsjahr\n\n`;

  for (const week of weeks) {
    text += `\n${"-".repeat(60)}\n`;
    text += `Berichtswoche: KW ${week.kw}/${week.year} (${formatDate(week.monday)} - ${formatDate(week.friday)})\n`;
    text += `${"-".repeat(60)}\n`;

    if (week.inFerien) {
      text += "[Schulferien / Betriebsferien]\n";
      continue;
    }

    for (const day of week.days) {
      text += `\n${day.name}, ${formatDate(day.date)}`;
      if (day.isSchoolDay) {
        text += " [Berufsschule]";
      } else if (!day.isFerien && !day.isHoliday) {
        text += " [Betrieb]";
      }
      text += `\n${day.content || "—"}\n`;
    }

    if (week.summary) {
      text += `\nZusammenfassung: ${week.summary}\n`;
    }

    text +=
      "\nUnterschrift Azubi: ________________   Datum: ________________\n";
    text += "Unterschrift Ausbilder: ________________\n";
  }

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Berichtshefte_${azubiName.replace(" ", "_")}.txt`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("success", "Export erfolgreich");
}

function exportCSV() {
  const azubiName = document.getElementById("azubiName").value || "Azubi";
  const weeks = gatherCurrentContent();

  let csv = "KW;Jahr;Datum;Wochentag;Typ;Inhalt\n";
  for (const week of weeks) {
    for (const day of week.days) {
      const type = day.isFerien
        ? "Ferien"
        : day.isHoliday
          ? "Feiertag"
          : day.isSchoolDay
            ? "Schule"
            : "Betrieb";
      const content = (day.content || "").replace(/"/g, '""');
      csv += `${week.kw};${week.year};${day.date};${day.name};${type};"${content}"\n`;
    }
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Berichtshefte_${azubiName.replace(" ", "_")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("success", "CSV exportiert");
}
