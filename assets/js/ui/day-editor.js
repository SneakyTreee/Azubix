// Einzelnen Tag bearbeiten: Werkzeugleiste, „Mit KI ändern“, Rückgängig, Zeichenzähler

function charCountLabel(day) {
  const max = Number(state.activities.maxChars) || 0;
  const length = (day.content || "").length;
  return {
    text: max > 0 ? `${length} / ${max} Zeichen` : `${length} Zeichen`,
    over: max > 0 && length > max,
  };
}

// Hinweise unter dem Tag: Ähnlichkeit zu anderen Tagen und Qualitätsprobleme
function renderDayHints(day) {
  const hints = [];
  const similar = similarDays.get(day.date);
  if (similar) {
    hints.push(
      `<button type="button" class="hint" data-action="day-jump" data-target="${similar.otherDate}">Sehr ähnlich wie ${escHtml(similar.otherName)}, KW ${similar.otherKw}</button>`,
    );
  }
  for (const issue of day.issues || []) {
    hints.push(`<span class="hint">${escHtml(issue)}</span>`);
  }
  if (day.template) {
    hints.push('<span class="hint">Textbaustein, kein KI-Text</span>');
  }
  return hints.length ? `<div class="day-hints">${hints.join("")}</div>` : "";
}

function renderDayTools(week, day) {
  const productive = day.kind === "betrieb" || day.kind === "schule";
  const count = charCountLabel(day);
  return `
    <div class="day-tools" data-week="${week.monday}" data-date="${day.date}">
      <button type="button" class="btn btn-text btn-xs" data-action="day-copy">Kopieren</button>
      ${productive ? '<button type="button" class="btn btn-text btn-xs" data-action="day-ai" aria-expanded="false">Mit KI ändern</button>' : ""}
      ${productive && !day.notes?.trim() && day.content ? '<button type="button" class="btn btn-text btn-xs" data-action="day-notes">Stichworte</button>' : ""}
      ${day.history?.length ? '<button type="button" class="btn btn-text btn-xs" data-action="day-undo">Rückgängig</button>' : ""}
      <span class="char-count${count.over ? " over" : ""}" id="count-${day.date}">${count.text}</span>
    </div>${renderDayHints(day)}`;
}

function renderAiPanel(day) {
  const presets = [
    day?.notes?.trim() &&
      '<button type="button" class="chip-btn chip-primary" data-preset="stichworte">Aus Stichworten schreiben</button>',
    ...Object.entries(REWRITE_PRESETS).map(
      ([key, preset]) =>
        `<button type="button" class="chip-btn" data-preset="${key}">${preset.label}</button>`,
    ),
  ]
    .filter(Boolean)
    .join("");
  return `
    <div class="ai-panel" role="group" aria-label="Eintrag mit KI ändern">
      <div class="ai-presets">${presets}</div>
      <div class="ai-custom">
        <input type="text" class="ai-instruction" placeholder="Eigene Anweisung, z.B. Erwähne, dass ich den Drucker im 2. OG getauscht habe" aria-label="Eigene Anweisung an die KI" />
        <button type="button" class="btn btn-ink btn-sm" data-preset="custom">Ändern</button>
      </div>
      <div class="ai-foot">
        <span class="status-line ai-status" aria-live="polite"></span>
        <button type="button" class="btn btn-text btn-xs" data-action="ai-close">Schließen</button>
      </div>
    </div>`;
}

let dayController = null;

function updateCharCount(day) {
  const element = document.getElementById(`count-${day.date}`);
  if (element) {
    const count = charCountLabel(day);
    element.textContent = count.text;
    element.classList.toggle("over", count.over);
  }
}

// Text und Werkzeugleiste eines Tages neu zeichnen, ohne die Woche zu schließen
function refreshDay(week, day) {
  const textarea = document.getElementById(`day-${day.date}`);
  textarea.value = day.content;
  autoSize(textarea);
  const tools = textarea.parentElement.querySelector(".day-tools");
  textarea.parentElement.querySelector(".day-hints")?.remove();
  const panelOpen = Boolean(textarea.parentElement.querySelector(".ai-panel"));
  const template = document.createElement("template");
  template.innerHTML = renderDayTools(week, day).trim();
  const next = template.content.firstElementChild;
  tools.replaceWith(...template.content.children);
  if (panelOpen) {
    next.querySelector('[data-action="day-ai"]')?.setAttribute("aria-expanded", "true");
  }
}

function toggleAiPanel(content, button, force) {
  const existing = content.querySelector(".ai-panel");
  const open = force ?? !existing;
  document.querySelectorAll(".ai-panel").forEach((panel) => {
    if (panel !== existing || !open) {
      panel
        .closest(".day-content")
        .querySelector('[data-action="day-ai"]')
        ?.setAttribute("aria-expanded", "false");
      panel.remove();
    }
  });
  if (open && !existing) {
    const date = content.querySelector(".day-tools").dataset.date;
    const day = state.weeks.flatMap((week) => week.days).find((entry) => entry.date === date);
    (content.querySelector(".day-hints") || content.querySelector(".day-tools")).insertAdjacentHTML(
      "afterend",
      renderAiPanel(day),
    );
    button?.setAttribute("aria-expanded", "true");
    content.querySelector(".ai-instruction").focus();
  }
}

async function runDayRewrite(week, day, instruction, panel) {
  const status = panel.querySelector(".ai-status");
  if (activeController || dayController) {
    status.textContent = "Es läuft schon eine Anfrage. Warte, bis sie fertig ist.";
    return;
  }
  if (state.ai.provider === "offline") {
    status.textContent =
      "Dafür brauchst du die KI. Stell oben unter „Ohne KI“ auf die kostenlose KI um.";
    return;
  }

  dayController = new AbortController();
  const textarea = document.getElementById(`day-${day.date}`);
  textarea.disabled = true;
  panel.classList.add("busy");
  panel.querySelectorAll("button[data-preset]").forEach((button) => (button.disabled = true));

  try {
    const onStatus = (message) => (status.textContent = message);
    const text = await withFallback(
      () => rewriteDay(week, day, instruction, { signal: dayController.signal, onStatus }),
      onStatus,
    );
    day.history = [...(day.history || []), day.content].slice(-5);
    day.content = text;
    refreshDay(week, day);
    saveState();
    status.textContent = "Geändert. Mit „Rückgängig“ kommt der alte Text zurück.";
    panel.querySelector(".ai-instruction").value = "";
  } catch (error) {
    status.textContent =
      error.name === "AbortError"
        ? "Abgebrochen."
        : `Das hat nicht geklappt (${error.message}). Versuch es gleich noch einmal.`;
  } finally {
    dayController = null;
    textarea.disabled = false;
    panel.classList.remove("busy");
    panel.querySelectorAll("button[data-preset]").forEach((button) => (button.disabled = false));
  }
}

function handleResultKeydown(event) {
  const target = event.target;
  if (event.key === "Enter" && target.classList.contains("ai-instruction")) {
    event.preventDefault();
    target.closest(".ai-panel").querySelector('[data-preset="custom"]').click();
    return;
  }
  if (target.dataset.field !== "content") {
    return;
  }
  const content = target.closest(".day-content");
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    toggleAiPanel(content, content.querySelector('[data-action="day-ai"]'), true);
  } else if (
    (event.ctrlKey || event.metaKey) &&
    event.shiftKey &&
    event.key.toLowerCase() === "c"
  ) {
    event.preventDefault();
    content.querySelector('[data-action="day-copy"]').click();
  }
}

// Eigene Änderungen: Stand beim Hineinklicken merken, beim Verlassen in den Verlauf
function handleEditStart(event) {
  if (event.target.dataset.field === "content") {
    event.target.dataset.before = event.target.value;
  }
}

function handleEditCommit(event) {
  const target = event.target;
  if (target.dataset.field !== "content" || target.dataset.before === undefined) {
    return;
  }
  const before = target.dataset.before;
  delete target.dataset.before;
  if (before === target.value) {
    return;
  }
  const { week, day } = findDay(target.dataset.week, target.dataset.date);
  day.history = [...(day.history || []), before].slice(-5);
  day.template = false;
  day.issues = [];
  refreshDay(week, day);
  saveState();
}
