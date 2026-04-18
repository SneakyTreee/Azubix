function formatDate(dateString) {
  const [year, month, day] = dateString.split("-");
  return `${day}.${month}.${year}`;
}

function getMonday(date) {
  const monday = new Date(date);
  const day = monday.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diff);
  return monday;
}

function getKW(date) {
  const current = new Date(date);
  current.setHours(0, 0, 0, 0);
  current.setDate(current.getDate() + 3 - ((current.getDay() + 6) % 7));
  const week1 = new Date(current.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((current.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    )
  );
}

function isInFerien(dateString) {
  return ferienData.some(
    (ferien) => dateString >= ferien.start && dateString <= ferien.end,
  );
}

function isPublicHoliday(dateString, year) {
  return getPublicHolidays(year, selectedState).includes(dateString);
}

function dateToStr(date) {
  return date.toISOString().split("T")[0];
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}
