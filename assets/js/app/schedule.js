function findAbsence(dateString, type) {
  return state.absences.find(
    (absence) => absence.type === type && dateString >= absence.start && dateString <= absence.end,
  );
}

function isSchoolWeekAt(kw, weekIndex) {
  if (state.schoolDays.length === 0) {
    return false;
  }
  switch (state.weekType) {
    case "even":
      return kw % 2 === 0;
    case "odd":
      return kw % 2 === 1;
    case "alternating":
      return (weekIndex % 2 === 0) === (state.firstWeekType === "school");
    default:
      return true;
  }
}

// Gewählte regionale Feiertage; ohne eigene Auswahl gelten die Vorgaben des Bundeslands
function activeRegionalHolidays() {
  if (Array.isArray(state.regionalHolidays)) {
    return state.regionalHolidays;
  }
  return typeof getRegionalHolidayOptions === "function"
    ? getRegionalHolidayOptions(state.bundesland)
        .filter((option) => option.defaultOn)
        .map((option) => option.id)
    : [];
}

// Stunden für einen Tag: Betriebstage können pro Wochentag abweichen (Teilzeit)
function hoursFor(kind, dow) {
  if (kind === "betrieb") {
    const custom = state.hours.betriebDays?.[dow];
    if (custom !== undefined && custom !== "") {
      return Number(custom) || 0;
    }
  }
  return Number(state.hours[kind]) || 0;
}

function staticDayContent(kind, holidayName) {
  if (kind === "feiertag") {
    return holidayName ? `Gesetzlicher Feiertag (${holidayName})` : "Feiertag";
  }
  if (kind === "urlaub") {
    return "Urlaub";
  }
  if (kind === "krank") {
    return "Arbeitsunfähig (krank)";
  }
  return "";
}

function buildDay(date, isSchoolWeek) {
  const dateString = dateToStr(date);
  const dow = date.getDay();
  const holidayName = getHolidayName(dateString, state.bundesland, activeRegionalHolidays());
  const schulferien = findAbsence(dateString, "schulferien");
  const schulblock = findAbsence(dateString, "schulblock");

  let kind = "betrieb";
  if (holidayName) {
    kind = "feiertag";
  } else if (findAbsence(dateString, "krank")) {
    kind = "krank";
  } else if (findAbsence(dateString, "urlaub")) {
    kind = "urlaub";
  } else if (schulblock) {
    // Blockunterricht: jeder Werktag im Block ist Schule
    kind = "schule";
  } else if (isSchoolWeek && state.schoolDays.includes(dow) && !schulferien) {
    kind = "schule";
  }

  const productive = kind === "betrieb" || kind === "schule";
  return {
    date: dateString,
    dow,
    name: DAY_NAMES[dow],
    kind,
    note:
      holidayName ||
      (schulblock && kind === "schule" ? schulblock.name : "") ||
      (schulferien && kind === "betrieb" ? `${schulferien.name}, keine Schule` : ""),
    content: staticDayContent(kind, holidayName),
    hours: productive ? hoursFor(kind, dow) : 0,
    notes: "",
  };
}

// Baut die Wochenstruktur. Bereits vorhandene Texte werden übernommen,
// solange sich Datum und Art des Tages nicht geändert haben.
function buildWeeks(previousWeeks = []) {
  const { start, end } = state.period;
  if (!start || !end || end < start) {
    return [];
  }

  const previousDays = new Map();
  const previousSummaries = new Map();
  for (const week of previousWeeks) {
    previousSummaries.set(week.monday, week);
    for (const day of week.days) {
      previousDays.set(day.date, day);
    }
  }

  const startDate = parseDate(start);
  const endDate = parseDate(end);
  const weeks = [];
  let monday = getMonday(startDate);
  let weekIndex = 0;

  while (monday <= endDate) {
    const { week: kw, year } = getIsoWeek(monday);
    const isSchoolWeek = isSchoolWeekAt(kw, weekIndex);
    const days = [];

    for (let offset = 0; offset < 5; offset += 1) {
      const date = addDays(monday, offset);
      if (date < startDate || date > endDate) {
        continue;
      }
      let day = buildDay(date, isSchoolWeek);
      const previous = previousDays.get(day.date);
      if (previous?.manual) {
        day = { ...previous };
      } else if (previous && previous.kind === day.kind && previous.content) {
        day.content = previous.content;
        day.hours = previous.hours;
        day.history = previous.history;
        day.template = previous.template;
      }
      // Eigene Stichworte bleiben immer erhalten
      if (previous?.notes) {
        day.notes = previous.notes;
      }
      days.push(day);
    }

    if (days.length > 0) {
      const mondayStr = dateToStr(monday);
      const previous = previousSummaries.get(mondayStr);
      const needsAi = days.some((day) => day.kind === "betrieb" || day.kind === "schule");
      const complete = days.every(
        (day) => day.content || !["betrieb", "schule"].includes(day.kind),
      );

      weeks.push({
        monday: mondayStr,
        friday: dateToStr(addDays(monday, 4)),
        kw,
        year,
        nr: Number(state.profile.startNr || 1) + weeks.length,
        hasSchool: days.some((day) => day.kind === "schule"),
        needsAi,
        days,
        summary: previous && complete ? previous.summary : "",
        status: !needsAi ? "static" : complete && previous ? previous.status : "pending",
        reviewed: complete && previous ? previous.reviewed || null : null,
        transferred: complete && previous ? previous.transferred || null : null,
        unterweisung: previous?.unterweisung || "",
        unterweisungHours: previous?.unterweisungHours ?? "",
        comment: previous?.comment || "",
        trainerOk: previous?.trainerOk || false,
      });
    }

    monday = addDays(monday, 7);
    weekIndex += 1;
  }

  return weeks;
}

function weekCategory(week) {
  if (!week.needsAi) {
    return "frei";
  }
  if (week.hasSchool) {
    return "schule";
  }
  if (week.days.some((day) => day.note && day.kind === "betrieb")) {
    return "ferien";
  }
  return "betrieb";
}

function summarizeSchedule(weeks) {
  const count = (kind) =>
    weeks.reduce((sum, week) => sum + week.days.filter((day) => day.kind === kind).length, 0);
  return {
    weeks: weeks.length,
    betrieb: count("betrieb"),
    schule: count("schule"),
    frei: count("feiertag") + count("urlaub") + count("krank"),
    aiWeeks: weeks.filter((week) => week.needsAi).length,
  };
}
