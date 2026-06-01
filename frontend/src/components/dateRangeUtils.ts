export type DateRange = { from: string; to: string };

const STORAGE_KEY = "dashboardDateRange";

function pad(n: number) { return String(n).padStart(2, "0"); }
function fmt(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export type Preset = "today" | "week" | "month" | "lastMonth" | "qtd" | "ytd" | "custom";

export function getPresetRange(preset: Preset): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (preset) {
    case "today": {
      const t = fmt(now);
      return { from: t, to: t };
    }
    case "week": {
      const dow = now.getDay();
      const monday = new Date(now); monday.setDate(d - ((dow + 6) % 7));
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      return { from: fmt(monday), to: fmt(sunday) };
    }
    case "month":
      return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) };
    case "lastMonth":
      return { from: fmt(new Date(y, m - 1, 1)), to: fmt(new Date(y, m, 0)) };
    case "qtd": {
      const q = Math.floor(m / 3);
      return { from: fmt(new Date(y, q * 3, 1)), to: fmt(new Date(y, m + 1, 0)) };
    }
    case "ytd":
      return { from: fmt(new Date(y, 0, 1)), to: fmt(now) };
    default:
      return { from: "", to: "" };
  }
}

export function presetLabel(p: Preset | null): string {
  const map: Record<string, string> = {
    today: "Hoy", week: "Esta semana", month: "Este mes",
    lastMonth: "Mes anterior", qtd: "Trimestre a la fecha",
    ytd: "Año a la fecha", custom: "Personalizado",
  };
  return p ? (map[p] ?? p) : "Rango de fechas";
}

export function rangeToPreset(range: DateRange): Preset | null {
  if (!range.from && !range.to) return null;
  for (const p of ["today", "week", "month", "lastMonth", "qtd", "ytd"] as Preset[]) {
    const r = getPresetRange(p);
    if (r.from === range.from && r.to === range.to) return p;
  }
  return "custom";
}

export function readPersistedRange(): DateRange {
  try {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from") ?? "";
    const to = params.get("to") ?? "";
    if (from || to) return { from, to };
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as DateRange;
  } catch { /* ignore */ }
  return { from: "", to: "" };
}

export function persistRange(range: DateRange) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(range));
    const url = new URL(window.location.href);
    if (range.from) url.searchParams.set("from", range.from);
    else url.searchParams.delete("from");
    if (range.to) url.searchParams.set("to", range.to);
    else url.searchParams.delete("to");
    window.history.replaceState({}, "", url.toString());
  } catch { /* ignore */ }
}
