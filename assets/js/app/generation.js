let activeController = null;

function validateInputs() {
  const { start, end } = state.period;
  if (!start || !end) {
    return "Trag in Abschnitt B den ersten und letzten Tag ein.";
  }
  if (end < start) {
    return "Der letzte Tag liegt vor dem ersten. Tausch die beiden Daten in Abschnitt B.";
  }
  if (state.ai.provider === "custom" && !state.ai.baseUrl) {
    return "Für den eigenen API-Schlüssel fehlt die Adresse. Trag sie oben unter „KI“ ein.";
  }
  return null;
}

function previousSummariesBefore(monday) {
  return state.weeks
    .filter((week) => week.monday < monday && week.summary && week.needsAi)
    .slice(-3)
    .map((week) => week.summary);
}

// presetMode "missing" überspringt die Rückfrage (z.B. beim Weiterschreiben)
async function startGeneration(presetMode) {
  if (activeController || dayController) {
    showToast("error", "Warte, bis die laufende Anfrage fertig ist.");
    return;
  }

  const error = validateInputs();
  if (error) {
    showToast("error", error);
    return;
  }

  const hasContent = state.weeks.some(
    (week) =>
      ["done", "partial", "fallback"].includes(week.status) ||
      week.days.some((day) => day.notes?.trim()),
  );
  let mode = typeof presetMode === "string" ? presetMode : "all";
  if (hasContent && typeof presetMode !== "string") {
    mode = await askChoice(
      "Es gibt schon geschriebene Wochen",
      "Sollen die vorhandenen Texte und deine Änderungen daran bleiben? Dann schreibt die KI nur die Wochen, die noch leer sind.",
      [
        { value: "missing", label: "Behalten und Lücken füllen", primary: true },
        { value: "all", label: "Alles neu schreiben", danger: true },
      ],
    );
    if (!mode) {
      return;
    }
  }

  state.weeks = buildWeeks(mode === "all" ? [] : state.weeks);
  if (state.weeks.length === 0) {
    showToast("error", "Im gewählten Zeitraum liegt kein Werktag.");
    return;
  }

  const targets = state.weeks.filter(
    (week) => week.needsAi && !["done", "partial", "fallback"].includes(week.status),
  );
  renderResults();
  setSetupOpen(false);
  document.getElementById("results").scrollIntoView({ behavior: "smooth" });

  if (targets.length === 0) {
    saveState();
    showToast("success", "Alle Wochen sind schon geschrieben.");
    return;
  }

  await runGeneration(targets);
}

// Wochen anlegen, ohne zu schreiben: so kann man vorher Stichworte eintragen
function createWeeksOnly() {
  const error = validateInputs();
  if (error) {
    showToast("error", error);
    return;
  }
  state.weeks = buildWeeks(state.weeks);
  saveState();
  renderResults();
  setSetupOpen(false);
  document.getElementById("results").scrollIntoView({ behavior: "smooth" });
  showToast(
    "success",
    "Wochen angelegt. Trag bei einzelnen Tagen Stichworte ein und klick dann auf „Nachweise schreiben“.",
  );
}

async function regenerateWeek(monday) {
  if (activeController) {
    showToast("error", "Warte, bis die laufenden Wochen fertig sind.");
    return;
  }
  const week = state.weeks.find((entry) => entry.monday === monday);
  if (!week?.needsAi) {
    return;
  }
  for (const day of week.days) {
    if (day.kind === "betrieb" || day.kind === "schule") {
      day.content = "";
    }
  }
  week.summary = "";
  week.reviewed = null;
  week.status = "pending";
  await runGeneration([week]);
}

async function runGeneration(targets) {
  const controller = new AbortController();
  activeController = controller;
  state.run = { active: true };
  saveStateNow();
  const provider = state.ai.provider;
  const batchSize = Math.max(1, Math.min(8, Number(state.ai.batchSize) || 3));
  const batches = [];
  for (let index = 0; index < targets.length; index += batchSize) {
    batches.push(targets.slice(index, index + batchSize));
  }

  setGenerating(true);
  let fallbackCount = 0;
  let done = 0;

  try {
    for (const batch of batches) {
      for (const week of batch) {
        week.status = "loading";
        updateWeekCard(week);
      }
      updateProgress(
        done,
        targets.length,
        `KW ${batch[0].kw}${batch.length > 1 ? ` bis ${batch.at(-1).kw}` : ""} wird geschrieben`,
      );

      if (provider === "offline") {
        batch.forEach(fillFallback);
      } else {
        try {
          const onStatus = (text) => updateProgressDetail(text);
          await withFallback(
            () =>
              generateBatch(batch, previousSummariesBefore(batch[0].monday), {
                signal: controller.signal,
                onStatus,
              }),
            onStatus,
          );
        } catch (error) {
          if (error.name === "AbortError") {
            throw error;
          }
          console.error("KI-Fehler", error);
          batch.forEach(fillFallback);
          fallbackCount += batch.length;
          updateProgressDetail(
            `KI nicht erreichbar (${error.message}). Diese Wochen bekommen Textbausteine.`,
          );
        }
      }

      done += batch.length;
      batch.forEach(updateWeekCard);
      updateStats();
      saveState();
    }

    updateProgress(done, targets.length, "Fertig");
    if (fallbackCount > 0) {
      showToast(
        "warn",
        `${fallbackCount} ${fallbackCount === 1 ? "Woche hat" : "Wochen haben"} Textbausteine bekommen, weil die KI nicht erreichbar war. Öffne die Woche und klicke auf „Neu schreiben lassen“.`,
      );
    } else {
      showToast(
        "success",
        `${targets.length} ${targets.length === 1 ? "Woche" : "Wochen"} geschrieben`,
      );
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      throw error;
    }
    for (const week of targets) {
      if (week.status === "loading") {
        week.status = "pending";
        updateWeekCard(week);
      }
    }
    saveState();
    showToast("warn", "Abgebrochen. Fertige Wochen sind gespeichert.");
  } finally {
    activeController = null;
    state.run = { active: false };
    saveState();
    setGenerating(false);
    updateResumeBanner();
  }
}

// ---------- Massenaktionen ----------

function templateWeeks() {
  return state.weeks.filter((week) => week.needsAi && week.days.some((day) => day.template));
}

function overLimitDays() {
  const max = Number(state.activities.maxChars) || 0;
  if (!max) {
    return [];
  }
  return state.weeks.flatMap((week) =>
    week.days
      .filter((day) => ["betrieb", "schule"].includes(day.kind) && day.content.length > max)
      .map((day) => ({ week, day })),
  );
}

async function regenerateTemplateWeeks() {
  const targets = templateWeeks();
  if (targets.length === 0) {
    showToast("success", "Keine Woche enthält noch Textbausteine.");
    return;
  }
  if (state.ai.provider === "offline") {
    showToast(
      "error",
      "Dafür brauchst du die KI. Stell oben unter „Ohne KI“ auf die kostenlose KI um.",
    );
    return;
  }
  for (const week of targets) {
    week.days
      .filter((day) => day.template)
      .forEach((day) => {
        day.content = "";
      });
    week.status = "pending";
    week.reviewed = null;
  }
  renderResults();
  await runGeneration(targets);
}

// Kürzt alle Einträge über dem Zeichenlimit nacheinander mit der KI
async function shortenOverLimit() {
  const items = overLimitDays();
  const max = Number(state.activities.maxChars) || 0;
  if (!max) {
    showToast("error", "Trag zuerst in Abschnitt D ein Zeichenlimit ein.");
    return;
  }
  if (items.length === 0) {
    showToast("success", `Alle Einträge haben höchstens ${max} Zeichen.`);
    return;
  }
  if (state.ai.provider === "offline" || activeController || dayController) {
    showToast(
      "error",
      state.ai.provider === "offline"
        ? "Dafür brauchst du die KI."
        : "Warte, bis die laufende Anfrage fertig ist.",
    );
    return;
  }

  const controller = new AbortController();
  activeController = controller;
  setGenerating(true);
  let done = 0;
  try {
    for (const { week, day } of items) {
      updateProgress(
        done,
        items.length,
        `${day.name}, KW ${week.kw} wird gekürzt (${done + 1} von ${items.length})`,
      );
      const onStatus = (text) => updateProgressDetail(text);
      try {
        const text = await withFallback(
          () =>
            rewriteDay(
              week,
              day,
              `Kürze den Eintrag auf höchstens ${max} Zeichen inklusive Leerzeichen. Die wichtigsten Tätigkeiten bleiben drin.`,
              {
                signal: controller.signal,
                onStatus,
              },
            ),
          onStatus,
        );
        day.history = [...(day.history || []), day.content].slice(-5);
        day.content = text;
        updateWeekCard(week);
        saveState();
      } catch (error) {
        if (error.name === "AbortError") {
          throw error;
        }
        updateProgressDetail(`${day.name}, KW ${week.kw}: ${error.message}`);
      }
      done += 1;
    }
    updateProgress(done, items.length, "Fertig");
    showToast("success", `${done} ${done === 1 ? "Eintrag" : "Einträge"} gekürzt`);
  } catch (error) {
    if (error.name !== "AbortError") {
      throw error;
    }
    showToast("warn", "Abgebrochen. Bereits gekürzte Einträge sind gespeichert.");
  } finally {
    activeController = null;
    setGenerating(false);
    updateStats();
  }
}

function removeAllStamps() {
  const count = state.weeks.filter((week) => week.reviewed).length;
  state.weeks.forEach((week) => {
    week.reviewed = null;
  });
  saveState();
  renderResults();
  showToast("success", `${count} ${count === 1 ? "Stempel" : "Stempel"} entfernt`);
}

// Nach dem Neuladen: unterbrochene Generierung anbieten
function interruptedWeeks() {
  return state.run?.active ? state.weeks.filter((week) => week.needsAi && !isWritten(week)) : [];
}

function cancelGeneration() {
  activeController?.abort();
}

function estimateDuration(weekCount) {
  if (state.ai.provider === "offline") {
    return "sofort";
  }
  const batchSize = Math.max(1, Number(state.ai.batchSize) || 3);
  const requests = Math.ceil(weekCount / batchSize);
  const seconds = state.ai.provider === "pollinations" ? requests * 55 : requests * 10;
  if (seconds < 60) {
    return `etwa ${seconds} Sekunden`;
  }
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "etwa eine Minute" : `etwa ${minutes} Minuten`;
}
