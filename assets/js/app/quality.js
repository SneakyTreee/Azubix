// Qualitätsprüfung der Einträge: ähnliche Texte finden, KI-Texte nachbessern

const SIMILARITY_STOP_WORDS = new Set([
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "ein",
  "eine",
  "einen",
  "einem",
  "einer",
  "eines",
  "und",
  "oder",
  "aber",
  "sowie",
  "auch",
  "noch",
  "dann",
  "danach",
  "anschließend",
  "außerdem",
  "ich",
  "wir",
  "mir",
  "mich",
  "mein",
  "meine",
  "meinen",
  "meinem",
  "meiner",
  "uns",
  "unser",
  "unsere",
  "habe",
  "hat",
  "haben",
  "hatte",
  "hatten",
  "bin",
  "ist",
  "sind",
  "war",
  "waren",
  "wurde",
  "wurden",
  "werden",
  "mit",
  "von",
  "vom",
  "zu",
  "zum",
  "zur",
  "für",
  "auf",
  "aus",
  "bei",
  "beim",
  "nach",
  "über",
  "unter",
  "in",
  "im",
  "an",
  "am",
  "um",
  "durch",
  "gegen",
  "ohne",
  "bis",
  "als",
  "wie",
  "dass",
  "damit",
  "so",
  "es",
  "sie",
  "er",
  "man",
  "sich",
  "dies",
  "diese",
  "dieser",
  "diesen",
  "diesem",
  "nicht",
  "sehr",
  "heute",
  "tag",
  "tages",
  "woche",
  "dabei",
  "hierbei",
  "zudem",
  "weitere",
  "weiteren",
  "einige",
  "mehrere",
]);

function similarityTokens(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, " ")
    .split(" ")
    .filter((word) => word.length > 1 && !SIMILARITY_STOP_WORDS.has(word));
}

// Wort-Bigramme; bei sehr kurzen Texten einzelne Wörter
function similarityShingles(text) {
  const tokens = similarityTokens(text);
  if (tokens.length < 3) {
    return new Set(tokens);
  }
  const shingles = new Set();
  for (let index = 0; index < tokens.length - 1; index += 1) {
    shingles.add(`${tokens[index]} ${tokens[index + 1]}`);
  }
  return shingles;
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }
  const [small, large] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  let shared = 0;
  for (const item of small) {
    if (large.has(item)) {
      shared += 1;
    }
  }
  return shared / (setA.size + setB.size - shared);
}

// Map day.date -> { date, otherDate, otherKw, otherName, score } für Tage,
// deren Text einem anderen Tag zu ähnlich ist (je Tag der ähnlichste Treffer)
function findSimilarEntries(weeks, threshold = 0.6) {
  const entries = [];
  for (const week of weeks || []) {
    for (const day of week.days || []) {
      const content = (day.content || "").trim();
      if ((day.kind === "betrieb" || day.kind === "schule") && content.length >= 60) {
        entries.push({ day, kw: week.kw, shingles: similarityShingles(content) });
      }
    }
  }

  const result = new Map();
  const remember = (entry, other, score) => {
    const existing = result.get(entry.day.date);
    if (!existing || existing.score < score) {
      result.set(entry.day.date, {
        date: entry.day.date,
        otherDate: other.day.date,
        otherKw: other.kw,
        otherName: other.day.name,
        score: Math.round(score * 100) / 100,
      });
    }
  };

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i].shingles;
      const b = entries[j].shingles;
      // Obergrenze der Ähnlichkeit über die Mengengrößen: spart Vergleiche
      if (Math.min(a.size, b.size) / Math.max(a.size, b.size) < threshold) {
        continue;
      }
      const score = jaccardSimilarity(a, b);
      if (score >= threshold) {
        remember(entries[i], entries[j], score);
        remember(entries[j], entries[i], score);
      }
    }
  }
  return result;
}

const QUALITY_WEEKDAY = "(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)";
const QUALITY_DATE =
  "(?:\\d{1,2}\\.\\s?\\d{1,2}\\.(?:\\s?\\d{4}|\\s?\\d{2}(?!\\d))?|\\d{4}-\\d{2}-\\d{2})";
const QUALITY_DAYPART = "(?:\\s+(?:früh|morgen|vormittag|mittag|nachmittag|abend))?";

// "Am Montag, den 02.11.2026, habe ich" / "Heute habe ich" -> "Ich habe"
const QUALITY_LEAD = new RegExp(
  "(^|[.!?]\\s+)" +
    "(?:heute" +
    QUALITY_DAYPART +
    "|am heutigen tag|an diesem tag" +
    "|(?:am\\s+)?" +
    QUALITY_WEEKDAY +
    QUALITY_DAYPART +
    "(?:\\s*,?\\s*(?:den\\s+)?" +
    QUALITY_DATE +
    ")?" +
    "|am\\s+" +
    QUALITY_DATE +
    ")" +
    "\\s*,?\\s+([a-zäöüß]+)\\s+(ich|wir)\\b\\s*",
  "gi",
);

function capitalizeFirst(text) {
  return text.replace(/^(\s*)([a-zäöü])/, (match, space, letter) => space + letter.toUpperCase());
}

function removeDatePhrases(text) {
  // "(02.11.2026)" komplett entfernen
  let result = text.replace(new RegExp("\\s*\\(\\s*" + QUALITY_DATE + "\\s*\\)", "gi"), "");
  result = result.replace(QUALITY_LEAD, (match, boundary, verb, pronoun) => {
    const subject = pronoun.toLowerCase() === "wir" ? "Wir" : "Ich";
    return `${boundary}${subject} ${verb.toLowerCase()} `;
  });
  // "Montag, den 02.11.2026," -> "Montag"
  result = result.replace(
    new RegExp("(" + QUALITY_WEEKDAY + ")\\s*,?\\s*(?:den\\s+)?" + QUALITY_DATE + "\\s*,?", "gi"),
    "$1",
  );
  // mitten im Satz: "habe am 02.11.2026 den" -> "habe den"
  result = result.replace(
    new RegExp("([a-zäöüß,])\\s+(?:am|vom)\\s+" + QUALITY_DATE + "(?=[\\s,.!?]|$)", "gi"),
    "$1",
  );
  return result;
}

function normalizeWhitespace(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ +([,.!?;:])/g, "$1")
    .replace(/,{2,}/g, ",")
    .replace(/^[\s,;]+/, "")
    .trim();
}

// Kürzt auf maxChars: bevorzugt am letzten Satzende, sonst an der letzten Wortgrenze
function truncateText(text, maxChars) {
  const slice = text.slice(0, maxChars);
  const sentenceEnd = Math.max(
    ...[". ", "! ", "? ", ".\n", "!\n", "?\n"].map((mark) => slice.lastIndexOf(mark)),
    /[.!?]$/.test(slice) ? slice.length - 1 : -1,
  );
  if (sentenceEnd > 0) {
    return slice.slice(0, sentenceEnd + 1).trim();
  }
  const room = text.slice(0, maxChars - 1);
  const wordEnd = room.lastIndexOf(" ");
  const base = (wordEnd > 0 ? room.slice(0, wordEnd) : room).replace(/[\s,;:\-–]+$/, "");
  return `${base}.`;
}

function qualityFix(text, { maxChars = 0, kind = "betrieb" } = {}) {
  const issues = [];
  const original = normalizeWhitespace(String(text || ""));
  let result = normalizeWhitespace(removeDatePhrases(original));
  if (result !== original) {
    issues.push("Datumsangabe entfernt");
  }
  result = capitalizeFirst(result);

  const limit = Number(maxChars) || 0;
  if (limit > 0 && result.length > limit) {
    result = truncateText(result, limit);
    issues.push("gekürzt");
  }

  if (kind === "betrieb" && /lernfeld|\bLF\s?\d{1,2}/i.test(result)) {
    issues.push("Lernfeld an einem Betriebstag");
  }
  return { text: result, issues };
}
