const EMILIANI_LAW_START_YEAR = 1984;

const FixedHolidays: Record<string, string> = {
  "01-01": "Año Nuevo",
  "05-01": "Día del Trabajo",
  "07-20": "Día de la Independencia",
  "08-07": "Batalla de Boyacá",
  "12-08": "Día de la Inmaculada Concepción",
  "12-25": "Navidad",
};

const MovableHolidays: Record<string, string> = {
  "01-06": "Día de los Reyes Magos",
  "03-19": "Día de San José",
  "06-29": "San Pedro y San Pablo",
  "08-15": "La Asunción",
  "10-12": "Día de la Raza",
  "11-01": "Día de Todos los Santos",
  "11-11": "Independencia de Cartagena",
};

const EasterDependentHolidays: Record<number, string> = {
  [-3]: "Jueves Santo",
  [-2]: "Viernes Santo",
  [43]: "Ascensión del Señor",
  [64]: "Corpus Christi",
  [71]: "Sagrado Corazón",
};

function calculateEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(year, month - 1, day));
}

export function getHolidaysForYear(year: number): { date: Date; name: string }[] {
  if (year < 1900 || year > 3000) {
    throw new Error(`Año ${year} fuera de rango`);
  }

  const holidays: { date: Date; name: string }[] = [];

  // Festivos fijos
  for (const [key, name] of Object.entries(FixedHolidays)) {
    const [month, day] = key.split("-").map(Number);
    holidays.push({ date: new Date(Date.UTC(year, month - 1, day)), name });
  }

  // Festivos trasladables (Ley Emiliani)
  for (const [key, name] of Object.entries(MovableHolidays)) {
    const [month, day] = key.split("-").map(Number);
    const originalDate = new Date(Date.UTC(year, month - 1, day));

    if (year >= EMILIANI_LAW_START_YEAR) {
      if (originalDate.getUTCDay() === 1) {
        // Si cae lunes, se queda igual
        holidays.push({ date: originalDate, name });
      } else {
        // Se traslada al siguiente lunes
        const daysUntilMonday = (1 - originalDate.getUTCDay() + 7) % 7;
        const offset = daysUntilMonday === 0 ? 7 : daysUntilMonday;
        const movedDate = new Date(originalDate.getTime() + offset * 24 * 60 * 60 * 1000);
        holidays.push({ date: movedDate, name: `${name} (trasladado)` });
      }
    } else {
      holidays.push({ date: originalDate, name });
    }
  }

  // Festivos de Pascua
  const easterSunday = calculateEasterSunday(year);
  for (const [offsetStr, name] of Object.entries(EasterDependentHolidays)) {
    const offset = Number(offsetStr);
    const holidayDate = new Date(easterSunday.getTime() + offset * 24 * 60 * 60 * 1000);

    if (offset === -3 || offset === -2) {
      // Jueves Santo y Viernes Santo nunca se trasladan
      holidays.push({ date: holidayDate, name });
    } else if (year >= EMILIANI_LAW_START_YEAR) {
      if (holidayDate.getUTCDay() === 1) {
        holidays.push({ date: holidayDate, name });
      } else {
        const daysUntilMonday = (1 - holidayDate.getUTCDay() + 7) % 7;
        const offsetMonday = daysUntilMonday === 0 ? 7 : daysUntilMonday;
        const movedDate = new Date(holidayDate.getTime() + offsetMonday * 24 * 60 * 60 * 1000);
        holidays.push({ date: movedDate, name: `${name} (trasladado)` });
      }
    } else {
      holidays.push({ date: holidayDate, name });
    }
  }

  return holidays.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function isPublicHoliday(date: Date): boolean {
  const year = date.getUTCFullYear();
  if (date.getUTCDay() === 0) {
    return true; // Domingo siempre cuenta como festivo
  }

  const holidays = getHolidaysForYear(year);
  const targetTime = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

  return holidays.some((h) => {
    const holidayTime = Date.UTC(h.date.getUTCFullYear(), h.date.getUTCMonth(), h.date.getUTCDate());
    return holidayTime === targetTime;
  });
}
