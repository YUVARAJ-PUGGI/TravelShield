const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeDateOnly(value) {
  if (typeof value !== "string" || !dateOnlyPattern.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) return null;
  return value;
}

export function getInclusiveCalendarDays(startDate, endDate) {
  const start = normalizeDateOnly(startDate);
  const end = normalizeDateOnly(endDate);
  if (!start || !end || start > end) return null;
  const startSerial = Date.UTC(
    Number(start.slice(0, 4)),
    Number(start.slice(5, 7)) - 1,
    Number(start.slice(8, 10))
  );
  const endSerial = Date.UTC(
    Number(end.slice(0, 4)),
    Number(end.slice(5, 7)) - 1,
    Number(end.slice(8, 10))
  );
  return Math.floor((endSerial - startSerial) / 86400000) + 1;
}
