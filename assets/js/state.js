let weekType = "both";
let firstWeekType = "school";
let selectedState = "NW";
let ferienData = [];
let generatedWeeks = [];
let toastTimer;

function getPublicHolidays(year, state) {
  const holidays = [];
  holidays.push(new Date(year, 0, 1));
  holidays.push(new Date(year, 4, 1));
  holidays.push(new Date(year, 9, 3));
  holidays.push(new Date(year, 11, 25));
  holidays.push(new Date(year, 11, 26));

  const easter = getEaster(year);
  const karfreitag = new Date(easter);
  karfreitag.setDate(easter.getDate() - 2);
  const ostermontag = new Date(easter);
  ostermontag.setDate(easter.getDate() + 1);
  const himmelfahrt = new Date(easter);
  himmelfahrt.setDate(easter.getDate() + 39);
  const pfingstmontag = new Date(easter);
  pfingstmontag.setDate(easter.getDate() + 50);
  holidays.push(karfreitag, ostermontag, himmelfahrt, pfingstmontag);

  const stateHolidays = {
    BW: [
      new Date(year, 0, 6),
      new Date(easter.getTime() + 60 * 86400000),
      new Date(year, 10, 1),
    ],
    BY: [
      new Date(year, 0, 6),
      new Date(easter.getTime() + 60 * 86400000),
      new Date(year, 7, 15),
      new Date(year, 10, 1),
    ],
    NW: [new Date(easter.getTime() + 60 * 86400000), new Date(year, 10, 1)],
    HE: [new Date(easter.getTime() + 60 * 86400000)],
    RP: [
      new Date(easter.getTime() + 60 * 86400000),
      new Date(year, 7, 15),
      new Date(year, 10, 1),
    ],
    SL: [
      new Date(easter.getTime() + 60 * 86400000),
      new Date(year, 7, 15),
      new Date(year, 10, 1),
    ],
    SN: [new Date(year, 10, 18)],
    TH: [new Date(year, 9, 31), new Date(year, 10, 18)],
  };

  if (stateHolidays[state]) {
    holidays.push(...stateHolidays[state]);
  }

  return holidays.map((date) => date.toISOString().split("T")[0]);
}

function getEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

const FERIEN_VORSCHLAEGE = {
  NW: [
    { name: "Herbstferien 2024", start: "2024-10-14", end: "2024-10-25" },
    { name: "Weihnachtsferien 2024", start: "2024-12-23", end: "2025-01-06" },
    { name: "Osterferien 2025", start: "2025-04-14", end: "2025-04-26" },
    { name: "Pfingstferien 2025", start: "2025-06-09", end: "2025-06-21" },
    { name: "Sommerferien 2025", start: "2025-06-23", end: "2025-08-05" },
  ],
  BY: [
    { name: "Herbstferien 2024", start: "2024-10-28", end: "2024-11-01" },
    { name: "Weihnachtsferien 2024", start: "2024-12-23", end: "2025-01-05" },
    { name: "Faschingsferien 2025", start: "2025-03-03", end: "2025-03-07" },
    { name: "Osterferien 2025", start: "2025-04-11", end: "2025-04-25" },
    { name: "Sommerferien 2025", start: "2025-07-30", end: "2025-09-12" },
  ],
  BW: [
    { name: "Herbstferien 2024", start: "2024-10-28", end: "2024-10-30" },
    { name: "Weihnachtsferien 2024", start: "2024-12-23", end: "2025-01-04" },
    { name: "Osterferien 2025", start: "2025-04-14", end: "2025-04-25" },
    { name: "Pfingstferien 2025", start: "2025-06-10", end: "2025-06-20" },
    { name: "Sommerferien 2025", start: "2025-07-31", end: "2025-09-13" },
  ],
};

const DAY_NAMES = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];
const DAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
