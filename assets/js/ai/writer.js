// Schreibt Einträge mit der KI: ganze Wochen (gebündelt) oder einen einzelnen Tag

// Nachbesserung nach dem Schreiben: Datumsangaben raus, Zeichenlimit, Hinweise
function applyQuality(text, kind) {
  if (typeof qualityFix !== "function") {
    return { text, issues: [] };
  }
  return qualityFix(text, { maxChars: Number(state.activities.maxChars) || 0, kind });
}

// Generiert Einträge für mehrere Wochen in einer Anfrage. Fehlen danach
// noch Tage (z.B. abgeschnittene Antwort), werden nur diese nachgefordert.
// onStatus(text) informiert über Wartezeiten.
async function generateBatch(weeks, previousSummaries, { signal, onStatus }) {
  const minInterval = AI_PROVIDERS[activeProvider()]?.minInterval || 0;
  let failures = 0;
  let rateLimits = 0;
  let anyFilled = false;

  while (weeks.some((week) => week.days.some(needsText))) {
    const waitMs = lastReplyAt + minInterval - Date.now();
    if (waitMs > 0) {
      await abortableWait(waitMs, signal, (seconds) =>
        onStatus?.(`Nächste Anfrage in ${seconds} s (Limit der kostenlosen KI)`),
      );
    }

    const open = weeks.filter((week) => week.days.some(needsText));
    const { system, user } = buildPrompt(open, previousSummaries);
    const messages = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];

    onStatus?.(failures > 0 ? "Fehlende Tage werden nachgefordert" : "Die KI schreibt");
    try {
      const content = await requestCompletion(messages, signal);
      lastReplyAt = Date.now();
      const filled = applyAiResult(open, parseJsonResponse(content));
      if (filled === 0) {
        throw new Error("Antwort passt zu keinem der angefragten Tage");
      }
      anyFilled = true;
      if (open.some((week) => week.days.some(needsText))) {
        failures += 1;
        if (failures >= 3) {
          break;
        }
      }
    } catch (error) {
      if (error.name === "AbortError") {
        throw error;
      }
      // Rate-Limits zählen nicht als Fehlversuch, nur eine Obergrenze
      if (error instanceof RateLimitError) {
        rateLimits += 1;
        if (rateLimits > 12) {
          throw new Error("Kostenloses Limit dauerhaft erreicht", { cause: error });
        }
        // Pollinations nennt oft zu kurze Wartezeiten; zu frühe Versuche
        // starten das 30-s-Fenster neu. Daher mindestens ein volles Intervall.
        await abortableWait(Math.max(error.waitMs, minInterval, 5000), signal, (seconds) =>
          onStatus?.(`Die kostenlose KI braucht eine Pause. Weiter in ${seconds} s`),
        );
        continue;
      }
      lastReplyAt = Date.now();
      failures += 1;
      if (failures >= 3) {
        if (!anyFilled) {
          throw error;
        }
        break;
      }
      onStatus?.("Die Antwort war unvollständig, neuer Versuch");
    }
  }

  // Was die KI nicht geliefert hat, wird mit Vorlagen gefüllt
  for (const week of weeks) {
    const missing = week.days.filter(needsText);
    missing.forEach((day) => {
      day.content = fallbackDayText(day);
      day.template = true;
    });
    week.summary ||= fallbackSummary(week);
    week.status = missing.length > 0 ? "partial" : "done";
  }
}

// Übernimmt die Texte der KI und gibt die Anzahl gefüllter Tage zurück
function applyAiResult(weeks, parsed) {
  const days = parsed.days || {};
  const summaries = parsed.summaries || {};
  const summaryKeys = Object.keys(summaries);
  let filled = 0;

  for (const week of weeks) {
    for (const day of week.days.filter(needsText)) {
      const text = cleanAiText(days[day.date]);
      if (text) {
        const checked = applyQuality(text, day.kind);
        day.content = checked.text;
        day.issues = checked.issues;
        day.template = false;
        filled += 1;
      }
    }
    const unterweisungen = parsed.unterweisungen || {};
    const unterweisungKey = Object.keys(unterweisungen).find((key) => key.startsWith(week.monday));
    if (!week.unterweisung && unterweisungKey) {
      week.unterweisung = cleanAiText(unterweisungen[unterweisungKey]);
    }
    const summaryKey =
      summaryKeys.find((key) => key.startsWith(week.monday)) ||
      summaryKeys.find((key) => key.includes(`KW ${week.kw}`));
    week.summary ||= cleanAiText(summaries[summaryKey]);
  }
  return filled;
}

async function rewriteDay(week, day, instruction, { signal, onStatus }) {
  const others = week.days
    .filter((entry) => entry !== day && entry.content && ["betrieb", "schule"].includes(entry.kind))
    .map((entry) => `- ${entry.name}: ${entry.content.replace(/\s+/g, " ").slice(0, 220)}`)
    .join("\n");

  const user = `${buildContext()}

Tag: ${day.name}, ${formatDate(day.date)}, KW ${week.kw} (${day.kind === "schule" ? "Berufsschule" : "Betrieb"})
Aktueller Eintrag:
"""
${day.content || "(noch leer)"}
"""
${day.notes?.trim() ? `Stichworte vom Azubi zu diesem Tag (verwenden, nichts Widersprüchliches erfinden): "${day.notes.trim()}"\n` : ""}
${others ? `\nAndere Tage dieser Woche, nur zur Orientierung, nicht wiederholen:\n${others}\n` : ""}
Aufgabe: ${instruction}

Regeln:
${styleRules()}
- Wenn die Aufgabe etwas anderes zu Stil oder Länge sagt, gilt die Aufgabe.

JSON-Format:
{"text":"neuer Eintrag"}`;

  const content = await completeWithRetry(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: user },
    ],
    { signal, onStatus },
  );

  let text;
  try {
    const cleaned = content.replace(/```(?:json)?/gi, "");
    const parsed = JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
    text = parsed.text ?? parsed.eintrag ?? Object.values(parsed)[0];
  } catch {
    text = content.replace(/^[\s"{]*text["\s:]*/i, "").replace(/["}\s]*$/, "");
  }
  text = cleanAiText(text);
  if (!text) {
    throw new Error("Die KI hat keinen Text geliefert");
  }
  const checked = applyQuality(text, day.kind);
  day.issues = checked.issues;
  day.template = false;
  return checked.text;
}
