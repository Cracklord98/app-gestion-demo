/**
 * Zod/Backend Validation Error helpers
 */

/** Parse the formatted validation error string into individual field messages. */
export function parseValidationErrors(message: string): string[] {
  if (!message.startsWith("Error de validación:")) return [];
  return message
    .replace("Error de validación:\n", "")
    .split("\n")
    .map((line) => line.replace(/^[•\s]+/, "").trim())
    .filter(Boolean);
}

/** Returns true when the error message is a backend validation error. */
export function isValidationError(message: string): boolean {
  return message.startsWith("Error de validación:");
}
