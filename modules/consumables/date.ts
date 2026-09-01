const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseBusinessDate(value: string) {
  const match = value.match(datePattern);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value ? date : null;
}

export function businessToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00.000Z`);
}

export function daysUntilExpiry(value: Date, now = new Date()) {
  return Math.floor((value.getTime() - businessToday(now).getTime()) / 86_400_000);
}
