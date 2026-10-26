// Prompts, Stilregeln und das Auslesen der KI-Antworten

const STYLE_RULES = {
  ich: 'Ich-Form in der Vergangenheit (z.B. "Ich habe ... umgesetzt"), als Fließtext',
  neutral:
    'Sachlich-neutral ohne "ich", im Nominalstil (z.B. "Umsetzung von ...", "Einrichtung von ..."), als Fließtext',
  stichpunkte:
    'Stichpunkte, jeder Punkt in einer eigenen Zeile mit "- " am Anfang, Zeilen mit \\n getrennt',
};

const LENGTH_RULES = {
  kurz: { text: "1-2 Sätze", bullets: "2-3 Stichpunkte" },
  mittel: { text: "3-4 Sätze", bullets: "3-5 Stichpunkte" },
  lang: { text: "5-6 Sätze", bullets: "5-7 Stichpunkte" },
};

const SYSTEM_PROMPT =
  "Du schreibst Einträge für Ausbildungsnachweise (Berichtsheft) deutscher Auszubildender. " +
  "Die Einträge sind realistisch, konkret, fachlich korrekt und passen zum Ausbildungsstand. " +
  "Sie werden als reiner Text in das Online-Berichtsheft der IHK kopiert, also kein Markdown, keine Emojis, keine Überschriften. " +
  "Antworte ausschließlich mit gültigem JSON, ohne Markdown und ohne Erklärungen.";

function buildContext() {
  const { profile, activities } = state;
  const lernfelder = getLernfelder(profile.beruf, profile.jahr);
  return [
    `Ausbildungsberuf: ${profile.beruf}`,
    `Ausbildungsjahr: ${profile.jahr}`,
    profile.abteilung && `Abteilung/Einsatzbereich: ${profile.abteilung}`,
    activities.taetigkeiten && `Typische Tätigkeiten im Betrieb: ${activities.taetigkeiten}`,
    activities.technologies && `Technologien & Tools: ${activities.technologies}`,
    activities.schulfaecher
      ? `Fächer/Lernfelder in der Berufsschule: ${activities.schulfaecher}`
      : lernfelder.length > 0 && `Lernfelder in diesem Ausbildungsjahr: ${lernfelder.join("; ")}`,
    activities.hinweise && `Zusätzliche Hinweise: ${activities.hinweise}`,
    typeof getBerufHints === "function" &&
      getBerufHints(profile.beruf).length > 0 &&
      `Typische Aufgaben in diesem Beruf (als Anregung, passend zum Betrieb auswählen): ${getBerufHints(profile.beruf).join("; ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function styleRules() {
  const { activities } = state;
  const length = LENGTH_RULES[activities.laenge] || LENGTH_RULES.mittel;
  const lengthRule = activities.stil === "stichpunkte" ? length.bullets : length.text;
  const maxChars = Number(activities.maxChars) || 0;
  return [
    `- Stil: ${STYLE_RULES[activities.stil] || STYLE_RULES.ich}.`,
    `- Länge pro Tag: ${lengthRule}.`,
    "- Wochentag und Datum nicht in den Text schreiben, die stehen schon im Formular.",
    "- Lernfelder nur an Berufsschultagen nennen, nie an Betriebstagen.",
    maxChars > 0 &&
      `- Höchstens ${maxChars} Zeichen pro Tag inklusive Leerzeichen. Das ist ein hartes Limit des IHK-Formulars.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function dayTypeLabel(day) {
  if (day.kind === "schule") {
    return day.note ? `Berufsschule (Blockunterricht: ${day.note})` : "Berufsschule";
  }
  return day.note ? "Betrieb (Schulferien, kein Unterricht)" : "Betrieb";
}

function buildPrompt(weeks, previousSummaries) {
  const summaryWeeks = weeks.filter((week) => !week.summary);
  const unterweisungWeeks = state.activities.unterweisungenKi
    ? weeks.filter((week) => !week.unterweisung)
    : [];
  const dayLines = weeks
    .flatMap((week) =>
      week.days
        .filter(needsText)
        .map(
          (day) =>
            `- ${day.date} (${day.name}, KW ${week.kw}): ${dayTypeLabel(day)}${day.notes?.trim() ? `. Stichworte vom Azubi: "${day.notes.trim()}"` : ""}`,
        ),
    )
    .join("\n");

  const history =
    previousSummaries.length > 0
      ? `\nZuletzt behandelte Themen (fortführen, aber nicht wörtlich wiederholen):\n${previousSummaries.map((summary) => `- ${summary}`).join("\n")}\n`
      : "";

  const user = `${buildContext()}
${history}
Erzeuge für JEDEN der folgenden Tage einen Eintrag:
${dayLines}

Regeln:
- Betriebstage: konkrete praktische Tätigkeiten, Aufgaben und Ergebnisse. Projekte dürfen sich über mehrere Tage ziehen.
- Berufsschultage: Unterrichtsinhalte (Lernfelder, Fächer wie Wirtschafts- und Sozialkunde, Englisch, Deutsch) mit konkreten Themen.
${styleRules()}
- Abwechslungsreich, keine Floskeln, keine erfundenen Firmen- oder Personennamen.
- Wenn Stichworte vom Azubi angegeben sind, beschreibe genau diese Tätigkeiten ausführlich und erfinde nichts, was ihnen widerspricht.
- Zusätzlich pro Woche eine Zusammenfassung in einem Satz, Schlüssel ist das Montagsdatum der Woche: ${summaryWeeks.map((week) => week.monday).join(", ")}.${
    unterweisungWeeks.length > 0
      ? `\n- Zusätzlich pro Woche eine kurze, realistische betriebliche Unterweisung oder Schulung (1 Satz, z.B. Arbeitssicherheit, Datenschutz, ein Tool), Schlüssel ist das Montagsdatum: ${unterweisungWeeks.map((week) => week.monday).join(", ")}.`
      : ""
  }

JSON-Format:
{"days":{"YYYY-MM-DD":"Eintrag"},"summaries":{"YYYY-MM-DD":"Zusammenfassung"}${unterweisungWeeks.length > 0 ? ',"unterweisungen":{"YYYY-MM-DD":"Unterweisung"}' : ""}}`;

  return { system: SYSTEM_PROMPT, user };
}

function needsText(day) {
  return (day.kind === "betrieb" || day.kind === "schule") && !day.content;
}

// Liest JSON auch aus abgeschnittenen Antworten: Notfalls werden alle
// vollständigen "YYYY-MM-DD": "Text"-Paare einzeln herausgezogen.
function parseJsonResponse(text) {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(cleaned.slice(first, last + 1));
    } catch {
      // weiter mit Teil-Auswertung
    }
  }

  const summaryStart = cleaned.indexOf('"summaries"');
  const result = { days: {}, summaries: {} };
  const pairs = /"(\d{4}-\d{2}-\d{2})[^"]*"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  for (const match of cleaned.matchAll(pairs)) {
    const target =
      summaryStart !== -1 && match.index > summaryStart ? result.summaries : result.days;
    target[match[1]] = JSON.parse(`"${match[2]}"`);
  }
  if (Object.keys(result.days).length === 0) {
    throw new Error("Antwort enthält kein verwertbares JSON");
  }
  return result;
}

function cleanAiText(value) {
  if (Array.isArray(value)) {
    value = value.map((line) => `- ${line}`).join("\n");
  }
  return String(value || "")
    .replace(/[\u2010\u2011]/g, "-")
    .replace(/[\u00a0\u202f]/g, " ")
    .trim();
}

// Fertige Anweisungen für „Mit KI ändern“
const REWRITE_PRESETS = {
  umschreiben: {
    label: "Umschreiben",
    instruction:
      "Formuliere den Eintrag neu mit anderen Worten. Inhalt und Länge bleiben ungefähr gleich.",
  },
  kuerzer: {
    label: "Kürzer",
    instruction: "Kürze den Eintrag deutlich. Die wichtigsten Tätigkeiten bleiben drin.",
  },
  laenger: {
    label: "Ausführlicher",
    instruction:
      "Schreibe den Eintrag ausführlicher, mit mehr konkreten Details zu Aufgaben, Werkzeugen und Ergebnissen. Bleib realistisch.",
  },
  fachlicher: {
    label: "Fachlicher",
    instruction: "Formuliere fachlicher und präziser, mit passenden Fachbegriffen.",
  },
  einfacher: { label: "Einfacher", instruction: "Formuliere einfacher und leichter verständlich." },
  korrektur: {
    label: "Rechtschreibung",
    instruction:
      "Korrigiere nur Rechtschreibung, Grammatik und Zeichensetzung. Ändere sonst nichts am Inhalt oder Stil.",
  },
};
