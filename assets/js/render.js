function renderResults(weeks, azubiName, beruf, betrieb, ausbildungsjahr) {
  const schoolWeeks = weeks.filter(
    (week) => week.isSchoolWeek && !week.inFerien,
  ).length;
  const workWeeks = weeks.filter(
    (week) => !week.isSchoolWeek && !week.inFerien,
  ).length;
  const ferienWeeks = weeks.filter((week) => week.inFerien).length;
  const totalDays = weeks.reduce(
    (sum, week) =>
      sum + week.days.filter((day) => !day.isFerien && !day.isHoliday).length,
    0,
  );

  document.getElementById("totalWeeksLabel").textContent =
    `${weeks.length} Wochen`;
  document.getElementById("statsRow").innerHTML = `
    <div class="stat-box"><div class="stat-value">${weeks.length}</div><div class="stat-label">Gesamtwochen</div></div>
    <div class="stat-box"><div class="stat-value" style="color:var(--accent)">${schoolWeeks}</div><div class="stat-label">Schulwochen</div></div>
    <div class="stat-box"><div class="stat-value" style="color:var(--accent3)">${workWeeks}</div><div class="stat-label">Betriebswochen</div></div>
    <div class="stat-box"><div class="stat-value" style="color:var(--warn)">${ferienWeeks}</div><div class="stat-label">Ferienwochen</div></div>
    <div class="stat-box"><div class="stat-value" style="color:#a78bfa">${totalDays}</div><div class="stat-label">Arbeitstage</div></div>
  `;

  document.getElementById("weeksGrid").innerHTML = weeks
    .map((week, index) =>
      renderWeekCard(week, index, azubiName, beruf, betrieb, ausbildungsjahr),
    )
    .join("");
}

function renderWeekCard(
  week,
  index,
  azubiName,
  beruf,
  betrieb,
  ausbildungsjahr,
) {
  let typeBadge = "";
  if (week.inFerien) {
    typeBadge = '<span class="week-type-badge type-ferien">Ferien</span>';
  } else if (week.isSchoolWeek) {
    typeBadge =
      '<span class="week-type-badge type-gerade">Schule + Betrieb</span>';
  } else {
    typeBadge = '<span class="week-type-badge type-betrieb">Betrieb</span>';
  }

  const daysHtml = week.days
    .map((day) => {
      if (day.isFerien) {
        return `<div class="day-entry" style="opacity:0.5">
        <div class="day-entry-header">
          <div class="day-name">${day.name} <span class="day-date-label">${formatDate(day.date)}</span></div>
          <span class="badge badge-warn">Ferien</span>
        </div>
        <div style="font-family:var(--mono);font-size:11px;color:var(--muted)">Schulferien / Betriebsferien</div>
      </div>`;
      }

      if (day.isHoliday) {
        return `<div class="day-entry" style="opacity:0.5">
        <div class="day-entry-header">
          <div class="day-name">${day.name} <span class="day-date-label">${formatDate(day.date)}</span></div>
          <span class="badge badge-warn">Feiertag</span>
        </div>
        <div style="font-family:var(--mono);font-size:11px;color:var(--muted)">Gesetzlicher Feiertag</div>
      </div>`;
      }

      const typeLabel = day.isSchoolDay
        ? '<span class="day-entry-type entry-school">🎓 Schule</span>'
        : '<span class="day-entry-type entry-betrieb">🏢 Betrieb</span>';

      return `<div class="day-entry">
      <div class="day-entry-header">
        <div class="day-name">${day.name} <span class="day-date-label">${formatDate(day.date)}</span></div>
        ${typeLabel}
      </div>
      <textarea id="day-${day.date}" rows="3">${escHtml(day.content)}</textarea>
    </div>`;
    })
    .join("");

  const summaryHtml = week.inFerien
    ? ""
    : `
    <div class="week-summary-note">
      <div class="week-summary-label">Wochenzusammenfassung</div>
      <textarea id="summary-${week.monday}" rows="2">${escHtml(week.summary)}</textarea>
    </div>`;

  return `
    <div class="week-card" id="wcard-${index}">
      <div class="week-card-header" onclick="toggleWeek(${index})">
        <div class="week-num">KW ${week.kw} · ${week.year}</div>
        <div class="week-dates">${formatDate(week.monday)} - ${formatDate(addDays(new Date(week.monday), 4).toISOString().split("T")[0])}</div>
        ${typeBadge}
        <span class="chevron">▼</span>
      </div>
      <div class="week-card-body">
        <div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-bottom:12px">
          ${azubiName} · ${beruf} · ${betrieb} · ${ausbildungsjahr}. Ausbildungsjahr
        </div>
        <div class="day-entries">${daysHtml}</div>
        ${summaryHtml}
      </div>
    </div>`;
}

function escHtml(value) {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toggleWeek(index) {
  document.getElementById(`wcard-${index}`).classList.toggle("open");
}

function expandAll() {
  document
    .querySelectorAll(".week-card")
    .forEach((card) => card.classList.add("open"));
}

function collapseAll() {
  document
    .querySelectorAll(".week-card")
    .forEach((card) => card.classList.remove("open"));
}
