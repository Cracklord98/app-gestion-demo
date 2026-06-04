/**
 * CurrencyInput
 * Input con formateo en vivo de moneda/número.
 *
 * - Muestra el número con separadores de miles y decimales correctos
 *   según la moneda seleccionada, directamente dentro del campo.
 * - El estado externo siempre recibe/emite el número puro (sin formato).
 * - Soporta COP/MXN/PEN/CLP (locale es-*) y USD/EUR (locale en-US).
 */

import { useCallback, useRef, useState } from "react";
import { getLocaleForCurrency, getDecimalsForCurrency } from "../utils/formatCurrency";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  /** Valor numérico puro como string (sin formato) */
  value: string;
  /** Devuelve el valor numérico puro como string */
  onChange: (raw: string) => void;
  /** Moneda para determinar el locale (ej: "COP", "USD") */
  currency?: string;
  /** Número máximo de decimales permitidos (default: según moneda) */
  maxDecimals?: number;
}

export function CurrencyInput({
  value,
  onChange,
  currency,
  maxDecimals,
  onFocus,
  onBlur,
  style,
  ...rest
}: CurrencyInputProps) {
  const locale = getLocaleForCurrency(currency);
  const decimals = maxDecimals ?? getDecimalsForCurrency(currency);
  const decSep = getDecSep(locale);
  const thouSep = getThouSep(locale);

  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Formatter ─────────────────────────────────────────────────────────────

  /** Convierte el valor puro a string formateado con separadores */
  const toDisplay = useCallback(
    (raw: string): string => {
      if (!raw || raw === "") return "";
      const num = parseFloat(raw.replace(",", "."));
      if (!Number.isFinite(num)) return raw;

      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
        useGrouping: true,
      }).format(num);
    },
    [locale, decimals],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;

      // Quitar separadores de miles del input (el usuario los puede escribir o pegar)
      const stripped = raw
        .split(thouSep)
        .join("")
        .replace(",", "."); // normalizar coma a punto para parseFloat

      // Validar que sea un número válido (permite terminación en punto para decimales)
      const isValidPartial = /^-?\d*\.?\d*$/.test(stripped);
      if (!isValidPartial && stripped !== "") return;

      // Limitar decimales
      const parts = stripped.split(".");
      if (parts.length > 1 && parts[1].length > decimals) return;

      // Emitir valor puro al padre
      onChange(stripped === "" ? "" : stripped);

      // Renderizar con formato en vivo
      if (inputRef.current) {
        const formatted = formatLive(stripped, locale, decimals, decSep, thouSep);
        const cursorAtEnd = e.target.selectionStart === raw.length;
        inputRef.current.value = formatted;
        if (cursorAtEnd) {
          const len = formatted.length;
          inputRef.current.setSelectionRange(len, len);
        }
      }
    },
    [onChange, locale, decimals, decSep, thouSep],
  );

  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    },
    [onFocus],
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      // Al perder foco: forzar formato limpio
      if (inputRef.current && value !== "") {
        inputRef.current.value = toDisplay(value);
      }
      onBlur?.(e);
    },
    [onBlur, toDisplay, value],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const displayValue = isFocused
    ? formatLive(value, locale, decimals, decSep, thouSep)
    : toDisplay(value);

  return (
    <input
      {...rest}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      defaultValue={displayValue}
      key={currency} // re-render when currency changes
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={{
        fontVariantNumeric: "tabular-nums",
        ...style,
      }}
    />
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatLive(
  raw: string,
  locale: string,
  decimals: number,
  decSep: string,
  _thouSep: string,
): string {
  if (!raw || raw === "") return "";
  const endsWithDec = raw.endsWith(".");
  const trailingDec = raw.match(/\.(\d*)$/)?.[1] ?? null;

  const num = parseFloat(raw);
  if (!Number.isFinite(num)) return raw;

  const intFormatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(Math.trunc(Math.abs(num)));

  const sign = num < 0 ? "-" : "";

  if (endsWithDec) {
    return `${sign}${intFormatted}${decSep}`;
  }

  if (trailingDec !== null && raw.includes(".")) {
    // Preserve trailing decimal digits exactly as typed (don't round live)
    return `${sign}${intFormatted}${decSep}${trailingDec.slice(0, decimals)}`;
  }

  return `${sign}${intFormatted}`;
}

function getDecSep(locale: string): string {
  const parts = new Intl.NumberFormat(locale).formatToParts(1.1);
  return parts.find((p) => p.type === "decimal")?.value ?? ".";
}

function getThouSep(locale: string): string {
  const parts = new Intl.NumberFormat(locale).formatToParts(1000);
  return parts.find((p) => p.type === "group")?.value ?? ",";
}
