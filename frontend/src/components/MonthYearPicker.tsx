import type { MonthYear } from "../utils/periodUtils";
import { MONTHS_LONG_ES } from "../utils/periodUtils";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR + i);

export function MonthYearPicker({
  label,
  value,
  onChange,
  min,
  id,
}: {
  label: string;
  value: MonthYear;
  onChange: (v: MonthYear) => void;
  min?: MonthYear;
  id?: string;
}) {
  function handleMonthChange(month: number) {
    onChange({ month, year: value.year });
  }

  function handleYearChange(year: number) {
    // If new year == min.year and current month < min.month, clamp month
    const newMonth =
      min && year === min.year && value.month < min.month ? min.month : value.month;
    onChange({ month: newMonth, year });
  }

  const minYear = min?.year ?? CURRENT_YEAR;
  const availableYears = YEAR_OPTIONS.filter((y) => y >= minYear);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
      <label
        htmlFor={`${id ?? label}-month`}
        style={{ fontSize: "0.7rem", color: "var(--color-accent)", fontWeight: 600 }}
      >
        {label}
      </label>
      <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
        <select
          id={`${id ?? label}-month`}
          value={value.month}
          onChange={(e) => handleMonthChange(Number(e.target.value))}
          style={{ fontSize: "0.82rem", padding: "0.35rem 0.5rem", flex: "1 1 auto" }}
          aria-label={`${label} — mes`}
        >
          {MONTHS_LONG_ES.map((name, idx) => {
            const m = idx + 1;
            const disabled = min !== undefined &&
              value.year === min.year &&
              m < min.month;
            return (
              <option key={m} value={m} disabled={disabled}>
                {name}
              </option>
            );
          })}
        </select>

        <select
          value={value.year}
          onChange={(e) => handleYearChange(Number(e.target.value))}
          style={{ fontSize: "0.82rem", padding: "0.35rem 0.5rem" }}
          aria-label={`${label} — año`}
        >
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
