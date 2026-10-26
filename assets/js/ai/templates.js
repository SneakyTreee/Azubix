// Offline-Vorlagen: einfache Textbausteine, wenn keine KI genutzt wird oder sie ausfällt

function splitList(text, defaults) {
  const list = (text || "")
    .split(/[,;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  return list.length > 0 ? list : defaults;
}

function pick(list, seed) {
  return list[Math.abs(seed) % list.length];
}

function dateSeed(dateString) {
  return [...dateString].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 7);
}

function fallbackDayText(day) {
  const { activities, profile } = state;
  const seed = dateSeed(day.date);

  if (day.kind === "schule") {
    const faecher = splitList(
      activities.schulfaecher,
      getLernfelder(profile.beruf, profile.jahr).length > 0
        ? getLernfelder(profile.beruf, profile.jahr)
        : ["Wirtschafts- und Sozialkunde", "Netzwerktechnik", "Programmierung"],
    );
    const first = pick(faecher, seed);
    const second = pick(faecher, seed >> 3);
    const extra = pick(
      ["Wirtschafts- und Sozialkunde", "Englisch", "Deutsch/Kommunikation"],
      seed >> 5,
    );
    return first === second
      ? `Berufsschule: ${first} – Erarbeitung der Grundlagen und Übungsaufgaben. Außerdem Unterricht in ${extra}.`
      : `Berufsschule: ${first} sowie ${second}. Außerdem Unterricht in ${extra}.`;
  }

  const taetigkeiten = splitList(activities.taetigkeiten, [
    "Mitarbeit an laufenden Projekten",
    "Bearbeitung von Support-Anfragen",
    "Dokumentation",
  ]);
  const tools = splitList(activities.technologies, []);
  const mainIndex = Math.abs(seed) % taetigkeiten.length;
  const main = taetigkeiten[mainIndex];
  // Zweite Tätigkeit nie gleich der ersten
  const other =
    taetigkeiten.length > 1
      ? taetigkeiten[
          (mainIndex + 1 + (Math.abs(seed >> 4) % (taetigkeiten.length - 1))) % taetigkeiten.length
        ]
      : "Abstimmung der Ergebnisse im Team";
  const tool = tools.length > 0 ? ` Eingesetzt: ${pick(tools, seed >> 2)}.` : "";
  const templates = [
    `${main}. Anschließend ${other}.${tool}`,
    `Schwerpunkt des Tages: ${main}. Daneben ${other} und kurze Abstimmung mit dem Ausbilder.${tool}`,
    `${main} sowie ${other}.${tool} Ergebnisse wurden dokumentiert und im Team besprochen.`,
  ];
  return pick(templates, seed >> 6);
}

function fallbackSummary(week) {
  return week.hasSchool
    ? `KW ${week.kw}: Berufsschulunterricht und praktische Mitarbeit im Betrieb.`
    : `KW ${week.kw}: Praktische Mitarbeit an betrieblichen Aufgaben und Projekten.`;
}

function fillFallback(week) {
  for (const day of week.days.filter(needsText)) {
    day.content = fallbackDayText(day);
    day.template = true;
  }
  week.summary ||= fallbackSummary(week);
  week.status = "fallback";
}
