export const SUPPORTED_COUNTRIES = ["Colombia", "Peru", "Chile", "Mexico", "Ecuador", "Default"];

export function normalizeCountry(countryName: string): string {
  const normalized = countryName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (normalized === "colombia") return "Colombia";
  if (normalized === "peru") return "Peru";
  if (normalized === "chile") return "Chile";
  if (normalized === "mexico") return "Mexico";
  if (normalized === "ecuador") return "Ecuador";
  
  if (
    normalized === "default" ||
    normalized === "usa" ||
    normalized === "estados unidos" ||
    normalized === "united states" ||
    normalized === "us"
  ) {
    return "Default";
  }

  throw new Error(`País no soportado: ${countryName}`);
}

export function isSupportedCountry(countryName: string): boolean {
  try {
    normalizeCountry(countryName);
    return true;
  } catch {
    return false;
  }
}
