import { describe, it, expect } from "vitest";
import { isPublicHoliday, getHolidaysForYear } from "../holidays.js";

describe("Ecuador holidays calculation", () => {
  it("Año Nuevo (1 de Enero) de 2026 no se mueve", () => {
    // 2026-01-01 es Jueves
    const date = new Date(Date.UTC(2026, 0, 1));
    expect(isPublicHoliday(date, "Ecuador")).toBe(true);
  });

  it("Batalla de Pichincha (24 de Mayo) cae en Domingo de 2026 y se traslada al Lunes 25", () => {
    const originalDate = new Date(Date.UTC(2026, 4, 24)); // Domingo
    const shiftedDate = new Date(Date.UTC(2026, 4, 25)); // Lunes

    // El domingo original no es festivo público en sí mismo porque se traslada al lunes
    expect(isPublicHoliday(originalDate, "Ecuador")).toBe(false);
    // El domingo ya no es devuelto por isPublicHoliday directamente, sino manejado en la lógica de horas extra o es día ordinario de asueto.
    expect(isPublicHoliday(originalDate, "Ecuador")).toBe(false);
    // El lunes 25 debe ser festivo por traslado
    expect(isPublicHoliday(shiftedDate, "Ecuador")).toBe(true);

    const holidays = getHolidaysForYear(2026, "Ecuador");
    const pichincha = holidays.find(h => h.name.includes("Pichincha"));
    expect(pichincha).toBeDefined();
    // Debe estar registrado el lunes 25 de mayo de 2026
    expect(pichincha!.date.getUTCDate()).toBe(25);
    expect(pichincha!.date.getUTCMonth()).toBe(4); // Mayo (0-indexed)
  });

  it("Independencia de Guayaquil (9 de Octubre) de 2026 cae en Viernes y se mantiene el viernes", () => {
    const date = new Date(Date.UTC(2026, 9, 9)); // Viernes
    expect(isPublicHoliday(date, "Ecuador")).toBe(true);
  });
});

describe("Mexico holidays calculation", () => {
  it("Año Nuevo (1 de Enero) de 2026 es feriado en México", () => {
    const date = new Date(Date.UTC(2026, 0, 1));
    expect(isPublicHoliday(date, "Mexico")).toBe(true);
  });

  it("Natalicio de Benito Juárez es el tercer lunes de marzo", () => {
    // En 2026, marzo inicia en Domingo. El primer lunes es 2, el segundo es 9, el tercero es 16.
    const date = new Date(Date.UTC(2026, 2, 16));
    expect(isPublicHoliday(date, "Mexico")).toBe(true);
  });
});
