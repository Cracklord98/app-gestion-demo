/**
 * formatCurrency.ts
 * Utilidades para formateo numérico y de monedas en tiempo real.
 */

/** Locales recomendados por moneda */
const CURRENCY_LOCALES: Record<string, string> = {
  USD: "en-US",
  EUR: "en-US",
  GBP: "en-GB",
  COP: "es-CO",
  MXN: "es-MX",
  PEN: "es-PE",
  CLP: "es-CL",
  ARS: "es-AR",
};

/**
 * Retorna el locale de Intl apropiado para la moneda indicada.
 * Fallback: "es-CO".
 */
export function getLocaleForCurrency(currency?: string): string {
  if (!currency) return "es-CO";
  return CURRENCY_LOCALES[currency.toUpperCase()] ?? "es-CO";
}

/**
 * Número de decimales que se usan para mostrar una moneda.
 * CLP no usa decimales. El resto usa 2.
 */
export function getDecimalsForCurrency(currency?: string): number {
  if (!currency) return 2;
  if (currency.toUpperCase() === "CLP") return 0;
  return 2;
}

/**
 * Formatea un número para mostrarlo con separadores de miles y
 * el símbolo de la moneda, usando Intl.NumberFormat.
 */
export function formatCurrencyDisplay(
  value: number,
  currency?: string,
): string {
  if (!Number.isFinite(value)) return "";
  const locale = getLocaleForCurrency(currency);
  const decimals = getDecimalsForCurrency(currency);
  if (currency) {
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
    } catch {
      // Fallback si la moneda no es reconocida por Intl
    }
  }
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formatea un valor numérico como string para el display del input.
 * Solo aplica separadores de miles, sin símbolo de moneda.
 * Respeta los decimales mientras el usuario escribe (no redondea mientras hay punto al final).
 */
export function formatInputDisplay(raw: string, currency?: string): string {
  if (!raw || raw === "-") return raw;

  const locale = getLocaleForCurrency(currency);
  const decimalSep = getDecimalSeparator(locale);

  // Detectar si termina en separador decimal o tiene ceros decimales finales
  const endsWithDecimal = raw.endsWith(".") || raw.endsWith(",");
  const trailingZerosMatch = raw.match(/[.,](\d*0+)$/);

  // Separar parte entera y decimal (acepta tanto "." como "," como separador)
  const normalized = raw.replace(",", ".");
  const [intPart, ...decParts] = normalized.split(".");
  const decPart = decParts.join(".");

  const intNum = parseInt(intPart || "0", 10);
  if (isNaN(intNum)) return raw;

  // Formatear parte entera con separadores de miles usando Intl
  const formattedInt = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(intNum);

  if (endsWithDecimal) {
    return `${formattedInt}${decimalSep}`;
  }

  if (decPart !== undefined && decPart !== "") {
    return `${formattedInt}${decimalSep}${trailingZerosMatch ? decPart : decPart}`;
  }

  return formattedInt;
}


/**
 * Convierte una cadena formateada con separadores de miles/decimales
 * a un string de número limpio (solo dígitos y punto decimal).
 */
export function parseRawNumber(formatted: string, currency?: string): string {
  if (!formatted) return "";
  const locale = getLocaleForCurrency(currency);
  const decimalSep = getDecimalSeparator(locale);

  // Quitar separadores de miles
  let clean = formatted.split(getThousandSeparator(locale)).join("");
  // Normalizar separador decimal a punto
  if (decimalSep !== ".") {
    clean = clean.replace(decimalSep, ".");
  }
  return clean;
}

/** Obtiene el separador decimal del locale */
function getDecimalSeparator(locale: string): string {
  const parts = new Intl.NumberFormat(locale).formatToParts(1.1);
  return parts.find((p) => p.type === "decimal")?.value ?? ".";
}

/** Obtiene el separador de miles del locale */
function getThousandSeparator(locale: string): string {
  const parts = new Intl.NumberFormat(locale).formatToParts(1000);
  return parts.find((p) => p.type === "group")?.value ?? ",";
}
