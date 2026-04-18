function buildWeeks() {
  const start = new Date(document.getElementById("startDate").value);
  const end = new Date(document.getElementById("endDate").value);
  const schoolDays = Array.from(
    document.querySelectorAll('input[name="schoolDay"]:checked'),
  ).map((checkbox) => parseInt(checkbox.value, 10));

  let monday = getMonday(start);
  const weeks = [];
  let weekIndex = 0;

  while (monday <= end) {
    const friday = addDays(monday, 4);
    const kw = getKW(monday);
    const year = monday.getFullYear();
    const isEven = kw % 2 === 0;

    let isSchoolWeek = false;
    if (weekType === "both") {
      isSchoolWeek = schoolDays.length > 0;
    } else if (weekType === "even") {
      isSchoolWeek = isEven && schoolDays.length > 0;
    } else if (weekType === "odd") {
      isSchoolWeek = !isEven && schoolDays.length > 0;
    } else if (weekType === "alternating") {
      isSchoolWeek =
        (weekIndex % 2 === 0 && firstWeekType === "school") ||
        (weekIndex % 2 === 1 && firstWeekType === "work");
    }

    const days = [];
    for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
      const dayDate = addDays(monday, dayIndex);
      if (dayDate > end || dayDate < start) {
        continue;
      }

      const dayString = dateToStr(dayDate);
      const dow = dayDate.getDay();
      const inFerien = isInFerien(dayString);
      const inHoliday = isPublicHoliday(dayString, year);
      const isSchoolDay = isSchoolWeek && schoolDays.includes(dow);

      days.push({
        date: dayString,
        dow,
        name: DAY_NAMES[dow],
        shortName: DAY_SHORT[dow],
        isSchoolDay: isSchoolDay && !inFerien && !inHoliday,
        isFerien: inFerien,
        isHoliday: inHoliday,
        content: "",
      });
    }

    if (days.length > 0) {
      const weekInFerien = days.every(
        (day) =>
          day.isFerien || day.isHoliday || day.dow === 0 || day.dow === 6,
      );
      weeks.push({
        kw,
        year,
        weekIndex,
        isEven,
        isSchoolWeek: isSchoolWeek && !weekInFerien,
        monday: dateToStr(monday),
        friday: dateToStr(friday),
        days,
        inFerien: weekInFerien,
        summary: "",
      });
    }

    monday = addDays(monday, 7);
    weekIndex += 1;
  }

  return weeks;
}
