const STATUS_LABELS = {
  pending: { label: "noch leer", cls: "st-pending" },
  loading: { label: "wird geschrieben", cls: "st-loading" },
  done: { label: "geschrieben", cls: "st-done" },
  partial: { label: "teils Vorlage", cls: "st-partial" },
  fallback: { label: "Vorlage", cls: "st-fallback" },
  static: { label: "kein Arbeitstag", cls: "st-static" },
};

const CATEGORY_LABELS = {
  schule: { label: "Schule + Betrieb", cls: "cat-schule" },
  betrieb: { label: "nur Betrieb", cls: "cat-betrieb" },
  ferien: { label: "Betrieb, Ferien", cls: "cat-ferien" },
  frei: { label: "frei", cls: "cat-frei" },
};

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function escHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isWritten(week) {
  return ["done", "partial", "fallback"].includes(week.status);
}

// Tage, die anderen Einträgen zu sehr ähneln (date -> Treffer)
let similarDays = new Map();

function refreshSimilarDays() {
  similarDays =
    typeof findSimilarEntries === "function" ? findSimilarEntries(state.weeks) : new Map();
}

function renderResults() {
  const results = document.getElementById("results");
  results.hidden = state.weeks.length === 0;
  updateRegister();
  if (state.weeks.length === 0) {
    return;
  }
  updateStats();
  renderTimeline(document.getElementById("resultsTimeline"), state.weeks, true);
  document.getElementById("weeksGrid").innerHTML = state.weeks
    .map((week) => renderWeekCard(week, false))
    .join("");
  autoSizeAll(document.getElementById("weeksGrid"));
}

function updateStats() {
  const summary = summarizeSchedule(state.weeks);
  const hours = state.weeks.reduce(
    (sum, week) => sum + week.days.reduce((daySum, day) => daySum + (Number(day.hours) || 0), 0),
    0,
  );
  const written = state.weeks.filter(isWritten).length;
  const reviewed = state.weeks.filter((week) => week.reviewed).length;
  const transferred = state.weeks.filter((week) => week.transferred).length;
  refreshSimilarDays();

  document.getElementById("totalWeeksLabel").textContent = `${state.weeks.length} Wochen`;
  document.getElementById("statsRow").innerHTML = [
    ["Geschrieben", written, summary.aiWeeks],
    ["Geprüft", reviewed, summary.aiWeeks],
    ["Übertragen", transferred, summary.aiWeeks],
    ["Betriebstage", summary.betrieb],
    ["Schultage", summary.schule],
    ["Frei oder Feiertag", summary.frei],
    ["Stunden", hours.toLocaleString("de-DE")],
  ]
    .map(
      ([label, value, of]) =>
        `<div><dt>${label}</dt><dd>${value}${of !== undefined ? ` <span class="of">von ${of}</span>` : ""}</dd></div>`,
    )
    .join("")
    .concat(
      similarDays.size > 0
        ? `<div class="tally-warn"><dt>Sehr ähnliche Einträge</dt><dd>${similarDays.size} <span class="of">Tage</span></dd></div>`
        : "",
    );
  updateRegister();
  renderRahmenplan();
  updateRunbarVisibility();
}

// Jahresplaner: eine Zelle pro Woche, nach Monat (des Montags) gruppiert
function renderTimeline(container, weeks, clickable) {
  if (!container) {
    return;
  }
  if (weeks.length === 0) {
    container.innerHTML =
      '<p class="planner-empty">Wähle oben den ersten und letzten Tag, dann erscheinen hier deine Wochen.</p>';
    return;
  }

  const thisMonday = dateToStr(getMonday(new Date()));
  const months = [];
  for (const week of weeks) {
    const key = week.monday.slice(0, 7);
    if (months.at(-1)?.key !== key) {
      months.push({ key, weeks: [] });
    }
    months.at(-1).weeks.push(week);
  }

  container.innerHTML = months
    .map(({ key, weeks: monthWeeks }) => {
      const [year, month] = key.split("-");
      const label = `${MONTHS[Number(month) - 1]}${month === "01" || key === months[0].key ? ` ${year.slice(2)}` : ""}`;
      const cells = monthWeeks
        .map((week) => {
          const category = CATEGORY_LABELS[weekCategory(week)];
          const open = clickable && week.needsAi && !isWritten(week);
          const title = `KW ${week.kw}, ab ${formatDate(week.monday)}: ${category.label}${open ? ", noch nicht geschrieben" : ""}${week.reviewed ? ", geprüft" : ""}`;
          const classes = `cell ${category.cls}${open ? " is-open" : ""}${week.monday === thisMonday ? " is-today" : ""}`;
          return clickable
            ? `<button type="button" class="${classes}" title="${title}" aria-label="${title}" data-action="jump" data-week="${week.monday}"></button>`
            : `<span class="${classes}" title="${title}"></span>`;
        })
        .join("");
      return `<div class="month"><div class="month-cells">${cells}</div><span class="month-label">${label}</span></div>`;
    })
    .join("");
}

function renderDayRow(week, day) {
  const kindOptions = Object.entries(DAY_KINDS)
    .map(
      ([value, { label }]) =>
        `<option value="${value}" ${value === day.kind ? "selected" : ""}>${label}</option>`,
    )
    .join("");
  const productive = day.kind === "betrieb" || day.kind === "schule";
  const loading = week.status === "loading" && productive && !day.content;
  const id = `day-${day.date}`;

  return `
    <div class="day-row kind-${day.kind}">
      <div class="day-meta">
        <label class="day-title" for="${id}">${day.name}<span>${formatDate(day.date)}</span></label>
        <select class="kind-select" id="kind-${day.date}" data-field="kind" data-week="${week.monday}" data-date="${day.date}" aria-label="Art des Tages am ${formatDate(day.date)}">${kindOptions}</select>
        ${day.note ? `<span class="day-note">${escHtml(day.note)}</span>` : ""}
      </div>
      <div class="day-content">
        ${
          loading
            ? '<div class="skeleton"></div><div class="skeleton short"></div>'
            : `${renderDayNotes(week, day)}<textarea id="${id}" rows="2" data-field="content" data-week="${week.monday}" data-date="${day.date}" placeholder="${productive ? "Noch leer. Selbst schreiben oder mit „Mit KI ändern“ schreiben lassen." : ""}">${escHtml(day.content)}</textarea>${renderDayTools(week, day)}`
        }
      </div>
      <div class="day-hours">
        <input type="number" id="hours-${day.date}" min="0" max="12" step="0.5" value="${day.hours}" data-field="hours" data-week="${week.monday}" data-date="${day.date}" aria-label="Stunden am ${formatDate(day.date)}" />
      </div>
    </div>`;
}

function weekPreview(week) {
  const first = week.days.find(
    (day) => (day.kind === "betrieb" || day.kind === "schule") && day.content,
  );
  return first ? first.content.replace(/\s+/g, " ") : "";
}

function renderDayNotes(week, day) {
  if (!["betrieb", "schule"].includes(day.kind)) {
    return "";
  }
  const show = Boolean(day.notes?.trim()) || !day.content;
  return `<input type="text" class="day-notes" id="notes-${day.date}" data-field="notes" data-week="${week.monday}" data-date="${day.date}" value="${escHtml(day.notes || "")}" placeholder="Stichworte für die KI, z.B. Drucker im 2. OG getauscht, Ticket 4711" aria-label="Stichworte für ${day.name}" ${show ? "" : "hidden"} />`;
}

function renderUnterweisung(week) {
  return `
    <div class="unterweisung">
      <label class="field">
        <span class="field-label">Unterweisungen, betrieblicher Unterricht <em>freiwillig</em></span>
        <textarea id="unterweisung-${week.monday}" rows="1" data-field="unterweisung" data-week="${week.monday}" placeholder="z.B. Unterweisung Arbeitssicherheit im Serverraum">${escHtml(week.unterweisung || "")}</textarea>
      </label>
      <label class="field unterweisung-hours">
        <span class="field-label">Std.</span>
        <input type="number" id="uhours-${week.monday}" min="0" max="40" step="0.5" value="${week.unterweisungHours ?? ""}" data-field="unterweisungHours" data-week="${week.monday}" />
      </label>
    </div>`;
}

function renderTrainerComment(week) {
  return `
    <div class="trainer-comment${week.trainerOk ? " ok" : ""}">
      <span class="field-label">${week.trainerOk ? "Ausbilder/in: in Ordnung" : "Kommentar von deinem Ausbilder"}</span>
      ${week.comment ? `<p>${escHtml(week.comment)}</p>` : ""}
    </div>`;
}

function renderWeekCard(week, open) {
  const category = CATEGORY_LABELS[weekCategory(week)];
  const flags = [
    week.reviewed && "geprüft",
    week.transferred && "übertragen",
    week.comment && "Kommentar",
  ].filter(Boolean);
  const status =
    flags.length > 0
      ? { label: flags.join(", "), cls: week.reviewed ? "st-reviewed" : "st-done" }
      : STATUS_LABELS[week.status] || STATUS_LABELS.pending;
  const busy = week.status === "loading";
  const hours = week.days.reduce((sum, day) => sum + (Number(day.hours) || 0), 0);

  return `
    <article class="week-card ${open ? "open" : ""}" id="week-${week.monday}" data-week="${week.monday}">
      <button type="button" class="week-head" data-action="toggle" aria-expanded="${open}">
        <span class="week-nr">Nr. ${week.nr}</span>
        <span class="week-kw">KW ${week.kw}<small> ${week.year}</small></span>
        <span class="week-dates">${formatDateShort(week.monday)} bis ${formatDate(week.friday)}</span>
        <span class="week-type ${category.cls}">${category.label}</span>
        <span class="week-preview">${escHtml(weekPreview(week))}</span>
        <span class="week-state ${status.cls}">${status.label}</span>
        <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="week-body">
        <div class="day-table">
          <div class="day-table-head" aria-hidden="true"><span>Tag</span><span>Tätigkeiten und Unterrichtsthemen</span><span>Std.</span></div>
          ${week.days.map((day) => renderDayRow(week, day)).join("")}
        </div>
        ${week.comment ? renderTrainerComment(week) : ""}
        ${week.needsAi ? renderUnterweisung(week) : ""}
        <div class="week-foot">
          ${
            week.needsAi
              ? `<label class="summary-field">
                  <span class="field-label">Zusammenfassung der Woche</span>
                  <textarea id="summary-${week.monday}" rows="2" data-field="summary" data-week="${week.monday}">${escHtml(week.summary)}</textarea>
                </label>`
              : "<span></span>"
          }
          ${
            week.reviewed
              ? `<div class="stamp" aria-label="Geprüft am ${formatDate(week.reviewed)}">Geprüft<small>${formatDate(week.reviewed)}</small></div>`
              : "<span></span>"
          }
          <div class="week-sum">Summe<b>${hours.toLocaleString("de-DE")} Std.</b></div>
          <div class="week-actions">
            ${week.days.some((day) => day.kind === "betrieb") ? `<button type="button" class="btn btn-text" data-action="copy-betrieb">Betrieb kopieren</button>` : ""}
            ${week.hasSchool ? `<button type="button" class="btn btn-text" data-action="copy-schule">Schule kopieren</button>` : ""}
            ${week.unterweisung ? `<button type="button" class="btn btn-text" data-action="copy-unterweisung">Unterweisungen kopieren</button>` : ""}
            <button type="button" class="btn btn-text" data-action="copy">Alles kopieren</button>
            ${
              week.needsAi
                ? `<button type="button" class="btn btn-text" data-action="regenerate" ${busy ? "disabled" : ""}>Neu schreiben lassen</button>
                   <button type="button" class="btn btn-sm ${week.reviewed ? "btn-quiet" : "btn-stamp"}" data-action="review" ${busy ? "disabled" : ""}>${week.reviewed ? "Stempel entfernen" : "Als geprüft stempeln"}</button>`
                : ""
            }
          </div>
        </div>
      </div>
    </article>`;
}

function updateWeekCard(week) {
  const card = document.getElementById(`week-${week.monday}`);
  if (!card) {
    return;
  }
  // Während des Schreibens wird die Woche automatisch geöffnet und danach
  // wieder geschlossen, außer der Nutzer hatte sie selbst geöffnet.
  const loading = week.status === "loading";
  const autoOpened = card.dataset.auto === "1" || (loading && !card.classList.contains("open"));
  const open = loading || (card.classList.contains("open") && card.dataset.auto !== "1");
  const template = document.createElement("template");
  template.innerHTML = renderWeekCard(week, open).trim();
  const next = template.content.firstElementChild;
  if (loading && autoOpened) {
    next.dataset.auto = "1";
  }
  card.replaceWith(next);
  autoSizeAll(next);
  renderTimeline(document.getElementById("resultsTimeline"), state.weeks, true);
}

function autoSize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight + 2}px`;
}

function autoSizeAll(root) {
  root.querySelectorAll(".week-card.open textarea").forEach(autoSize);
}

function findDay(monday, date) {
  const week = state.weeks.find((entry) => entry.monday === monday);
  return { week, day: week?.days.find((entry) => entry.date === date) };
}

function handleResultInput(event) {
  const target = event.target;
  const field = target.dataset.field;
  if (!field) {
    return;
  }
  const { week, day } = findDay(target.dataset.week, target.dataset.date);
  if (!week) {
    return;
  }

  if (field === "summary") {
    week.summary = target.value;
  } else if (field === "content") {
    day.content = target.value;
    autoSize(target);
    updateCharCount(day);
  } else if (field === "hours") {
    day.hours = Number(target.value) || 0;
    updateStats();
  } else if (field === "notes") {
    day.notes = target.value;
  } else if (field === "unterweisung") {
    week.unterweisung = target.value;
    autoSize(target);
  } else if (field === "unterweisungHours") {
    week.unterweisungHours = target.value === "" ? "" : Number(target.value);
  }
  saveState();
}

function handleKindChange(event) {
  const target = event.target;
  if (target.dataset.field !== "kind") {
    return;
  }
  const { week, day } = findDay(target.dataset.week, target.dataset.date);
  const kind = target.value;
  const productive = kind === "betrieb" || kind === "schule";
  const wasProductive = day.kind === "betrieb" || day.kind === "schule";

  day.kind = kind;
  day.manual = true;
  if (!productive) {
    day.content = staticDayContent(
      kind,
      getHolidayName(day.date, state.bundesland, activeRegionalHolidays()),
    );
    day.hours = 0;
  } else {
    if (!wasProductive) {
      day.content = "";
    }
    day.hours = Number(state.hours[kind]) || 0;
  }

  week.needsAi = week.days.some((entry) => ["betrieb", "schule"].includes(entry.kind));
  week.hasSchool = week.days.some((entry) => entry.kind === "schule");
  if (!week.needsAi) {
    week.status = "static";
  } else if (week.status === "static") {
    week.status = "pending";
  }
  updateWeekCard(week);
  updateStats();
  saveState();
}

async function handleResultClick(event) {
  const button = event.target.closest("[data-action], [data-preset]");
  if (!button) {
    return;
  }
  const action = button.dataset.action || "";

  if (action === "jump") {
    const card = document.getElementById(`week-${button.dataset.week}`);
    if (card) {
      setCardOpen(card, true);
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return;
  }

  const card = button.closest(".week-card");
  if (!card) {
    return;
  }
  const week = state.weeks.find((entry) => entry.monday === card.dataset.week);

  if (button.dataset.preset) {
    const tools = button.closest(".day-content").querySelector(".day-tools");
    const day = week.days.find((entry) => entry.date === tools.dataset.date);
    const panel = button.closest(".ai-panel");
    const preset = button.dataset.preset;
    let instruction = REWRITE_PRESETS[preset]?.instruction;
    if (preset === "custom") {
      instruction = panel.querySelector(".ai-instruction").value.trim();
    } else if (preset === "stichworte") {
      instruction = `Schreibe den Eintrag neu. Er soll genau die Tätigkeiten aus diesen Stichworten beschreiben: "${day.notes.trim()}"`;
    }
    if (!instruction) {
      panel.querySelector(".ai-instruction").focus();
      panel.querySelector(".ai-status").textContent = "Schreib zuerst, was die KI ändern soll.";
      return;
    }
    await runDayRewrite(week, day, instruction, panel);
    return;
  }

  if (action.startsWith("day-") || action === "ai-close") {
    const content = button.closest(".day-content");
    const day = week.days.find(
      (entry) => entry.date === content.querySelector(".day-tools").dataset.date,
    );
    if (action === "day-copy") {
      if (!day.content.trim()) {
        showToast("error", `${day.name} ist noch leer.`);
        return;
      }
      await copyText(plainText(day.content), `${day.name} kopiert`);
    } else if (action === "day-ai") {
      toggleAiPanel(content, button);
    } else if (action === "ai-close") {
      dayController?.abort();
      toggleAiPanel(content, content.querySelector('[data-action="day-ai"]'), false);
    } else if (action === "day-undo") {
      day.content = day.history.pop();
      refreshDay(week, day);
      saveState();
      showToast("success", `Alter Text von ${day.name} ist wieder da`);
    } else if (action === "day-notes") {
      const notes = content.querySelector(".day-notes");
      notes.hidden = false;
      notes.focus();
    } else if (action === "day-jump") {
      jumpToDay(button.dataset.target);
    }
    return;
  }

  if (action === "toggle") {
    setCardOpen(card, !card.classList.contains("open"));
  } else if (action === "copy") {
    await copyText(weekToText(week), `KW ${week.kw} kopiert`);
  } else if (action === "copy-unterweisung") {
    await copyText(plainText(week.unterweisung), `Unterweisungen aus KW ${week.kw} kopiert`);
  } else if (action === "copy-betrieb" || action === "copy-schule") {
    const kind = action === "copy-betrieb" ? "betrieb" : "schule";
    await copyText(
      sectionText(week, kind),
      `${kind === "betrieb" ? "Betrieb" : "Schule"} aus KW ${week.kw} kopiert (${sectionHours(week, kind)} Std.)`,
    );
  } else if (action === "regenerate") {
    await regenerateWeek(week.monday);
  } else if (action === "review") {
    week.reviewed = week.reviewed ? null : todayStr();
    updateWeekCard(week);
    updateStats();
    saveState();
    showToast(
      "success",
      week.reviewed ? `KW ${week.kw} als geprüft gestempelt` : `Stempel bei KW ${week.kw} entfernt`,
    );
  }
}

function setCardOpen(card, open) {
  delete card.dataset.auto;
  card.classList.toggle("open", open);
  card.querySelector(".week-head").setAttribute("aria-expanded", String(open));
  if (open) {
    card.querySelectorAll("textarea").forEach(autoSize);
  }
}

function setAllCards(open) {
  document.querySelectorAll(".week-card").forEach((card) => setCardOpen(card, open));
}

function filterWeeks(query) {
  const needle = query.trim().toLowerCase();
  document.querySelectorAll(".week-card").forEach((card) => {
    if (!needle) {
      card.hidden = false;
      return;
    }
    const week = state.weeks.find((entry) => entry.monday === card.dataset.week);
    const haystack = [`kw ${week.kw}`, week.summary, ...week.days.map((day) => day.content)]
      .join(" ")
      .toLowerCase();
    card.hidden = !haystack.includes(needle);
  });
}

// Springt zu einem Tag (z.B. vom Ähnlichkeits-Hinweis aus) und öffnet die Woche
function jumpToDay(date) {
  const week = state.weeks.find((entry) => entry.days.some((day) => day.date === date));
  const card = week && document.getElementById(`week-${week.monday}`);
  if (!card) {
    return;
  }
  card.hidden = false;
  setCardOpen(card, true);
  const textarea = document.getElementById(`day-${date}`);
  (textarea || card).scrollIntoView({ behavior: "smooth", block: "center" });
  textarea?.focus({ preventScroll: true });
}
