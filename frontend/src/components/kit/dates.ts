/** Local-calendar date helpers. A "day key" is the local date as YYYY-MM-DD. */
export const startOfDay = (d: Date) => { const n = new Date(d); n.setHours(0, 0, 0, 0); return n; };
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const dayKey = (d: Date | number | string) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
export type WeekStart = "monday" | "sunday";
/** The first day of d's week: Monday unless told Sunday. */
export const startOfWeek = (d: Date, weekStart: WeekStart = "monday") => {
  const s = startOfDay(d);
  return addDays(s, -(weekStart === "sunday" ? s.getDay() : (s.getDay() + 6) % 7));
};
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const isToday = (d: Date) => dayKey(d) === dayKey(new Date());
/** A day key back to a local Date at midnight. */
export const fromDayKey = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
