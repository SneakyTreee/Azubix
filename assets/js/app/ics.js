// Kalenderdateien (.ics) einlesen, z.B. Urlaub oder Berufsschulblöcke.
// Rechnet nur mit lokalen Daten (kein toISOString, sonst Vortag in MEZ).

function icsLocalDateStr(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function icsShiftDays(dateString, amount) {
  const [year, month, day] = dateString.split("-").map(Number);
  return icsLocalDateStr(new Date(year, month - 1, day + amount));
}

function icsUnescape(value) {
  const map = { n: " ", N: " ", "\\": "\\", ";": ";", ",": "," };
  return value
    .replace(/\\([nN\\;,])/g, (match, char) => map[char])
    .replace(/\s+/g, " ")
    .trim();
}

// "DTSTART;TZID=Europe/Berlin:20261102T080000" -> { name, params, value }
function icsParseLine(line) {
  let inQuotes = false;
  let colon = -1;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ":" && !inQuotes) {
      colon = index;
      break;
    }
  }
  if (colon < 0) {
    return null;
  }
  const [name, ...paramParts] = line.slice(0, colon).split(";");
  const params = {};
  for (const part of paramParts) {
    const [key, ...rest] = part.split("=");
    params[key.toUpperCase()] = rest.join("=").replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

// Liefert { date: "YYYY-MM-DD", allDay, midnight } oder null
function icsParseDate(prop) {
  const value = prop.value.trim();
  const dateOnly = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    return { date: `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`, allDay: true, midnight: true };
  }
  const dateTime = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/i);
  if (!dateTime) {
    return null;
  }
  const [, year, month, day, hour, minute, second = "00", utc] = dateTime;
  if (utc) {
    const local = new Date(Date.UTC(+year, month - 1, +day, +hour, +minute, +second));
    return {
      date: icsLocalDateStr(local),
      allDay: false,
      midnight: local.getHours() === 0 && local.getMinutes() === 0 && local.getSeconds() === 0,
    };
  }
  // Ohne Z: Ortszeit bzw. TZID – das Datum wird wie angegeben übernommen
  return {
    date: `${year}-${month}-${day}`,
    allDay: false,
    midnight: hour === "00" && minute === "00" && second === "00",
  };
}

function icsDurationDays(value) {
  const match = (value || "").match(/^P(?:(\d+)W)?(?:(\d+)D)?/i);
  if (!match || (!match[1] && !match[2])) {
    return null;
  }
  return Number(match[1] || 0) * 7 + Number(match[2] || 0);
}

function icsBuildEvent(props) {
  const start = props.DTSTART && icsParseDate(props.DTSTART);
  if (!start) {
    return null;
  }
  let end = start.date;
  const endProp = props.DTEND && icsParseDate(props.DTEND);
  if (endProp) {
    end = endProp.date;
    // DTEND ist exklusiv: ganztägig immer, mit Uhrzeit nur bei 00:00 Uhr
    if ((start.allDay || endProp.midnight) && end > start.date) {
      end = icsShiftDays(end, -1);
    }
  } else if (props.DURATION) {
    const days = icsDurationDays(props.DURATION.value);
    if (days) {
      end = icsShiftDays(start.date, start.allDay ? days - 1 : days);
    }
  }
  if (end < start.date) {
    end = start.date;
  }
  const name = props.SUMMARY ? icsUnescape(props.SUMMARY.value) : "";
  return { name: name || "Termin", start: start.date, end };
}

// Liefert { events: [{ name, start, end }], skippedRecurring }
// Wiederkehrende Termine (RRULE/RDATE) werden nicht aufgelöst, nur gezählt.
function parseICS(text) {
  const lines = String(text || "")
    .replace(/\r\n|\r/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");

  const events = [];
  let skippedRecurring = 0;
  let props = null;
  let nested = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      props = {};
      nested = 0;
      continue;
    }
    if (!props) {
      continue;
    }
    if (upper === "END:VEVENT") {
      if (props.RRULE || props.RDATE) {
        skippedRecurring += 1;
      } else {
        const event = icsBuildEvent(props);
        if (event) {
          events.push(event);
        }
      }
      props = null;
      continue;
    }
    // Unterkomponenten wie VALARM überspringen
    if (upper.startsWith("BEGIN:")) {
      nested += 1;
      continue;
    }
    if (upper.startsWith("END:")) {
      nested = Math.max(0, nested - 1);
      continue;
    }
    if (nested > 0) {
      continue;
    }
    const prop = icsParseLine(line);
    if (prop && !props[prop.name]) {
      props[prop.name] = prop;
    }
  }

  events.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  return { events, skippedRecurring };
}
