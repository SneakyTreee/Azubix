// Alle Datumsfunktionen arbeiten mit lokaler Zeit. toISOString() wird bewusst
// nicht verwendet, weil es in MEZ/MESZ auf den Vortag (UTC) springt.

function parseDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateToStr(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
  if (!dateString) {
    return "";
  }
  const [year, month, day] = dateString.split("-");
  return `${day}.${month}.${year}`;
}

function formatDateShort(dateString) {
  const [, month, day] = dateString.split("-");
  return `${day}.${month}.`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function getMonday(date) {
  const day = date.getDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
}

// ISO-8601 Kalenderwoche + zugehöriges Jahr (KW 1 kann im Dezember beginnen)
function getIsoWeek(date) {
  const thursday = addDays(date, 3 - ((date.getDay() + 6) % 7));
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const week =
    1 +
    Math.round(
      ((thursday - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7,
    );
  return { week, year: thursday.getFullYear() };
}

function todayStr() {
  return dateToStr(new Date());
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA <= endB && startB <= endA;
}
