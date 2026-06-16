import { isPublicHoliday, getHolidaysForYear } from "./holidays.js";
import { prisma } from "../infra/prisma.js";

function getWeekRange(date: Date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  // El offset para llegar al lunes anterior:
  // Si day es 0 (domingo), restamos 6 días.
  // Si day es 1 (lunes), restamos 0 días.
  // Si day es 2 (martes), restamos 1 día, etc.
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setUTCDate(diff));
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
  sunday.setUTCHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

export interface ExtraHoursResult {
  diurnal: number;
  nocturnal: number;
  diurnalHoliday: number;
  nocturnalHoliday: number;
  totalHours: number;
  diurnalAmount: number;
  nocturnalAmount: number;
  diurnalHolidayAmount: number;
  nocturnalHolidayAmount: number;
  totalAmount: number;
  hourlyRate: number;
  divisorUsed: number;
  isHoliday: boolean;
  warnings: string[];
}

interface ConsultantData {
  id: string;
  country: string | null;
  hourlyRate: number | null;
  costPerMonth: number | null;
  rateCurrency: string;
}

interface ExtraHoursConfigData {
  weeklyExtraHoursLimit: number;
  diurnalMultiplier: number;
  nocturnalMultiplier: number;
  diurnalHolidayMultiplier: number;
  nocturnalHolidayMultiplier: number;
  diurnalStart: string;
  diurnalEnd: string;
  monthlyDivisor?: number;
}

export async function calculateExtraHours(params: {
  date: Date;
  startTime: string;
  endTime: string;
  consultantId?: string;
  config: ExtraHoursConfigData;
}): Promise<ExtraHoursResult> {
  const { date, startTime, endTime, consultantId, config } = params;

  // 1. Obtener datos del consultor (si existe)
  let consultant: ConsultantData | null = null;
  if (consultantId) {
    const rawConsultant = await prisma.consultant.findUnique({
      where: { id: consultantId },
    });
    if (rawConsultant) {
      consultant = {
        id: rawConsultant.id,
        country: rawConsultant.country,
        hourlyRate: rawConsultant.hourlyRate ? Number(rawConsultant.hourlyRate) : null,
        costPerMonth: rawConsultant.costPerMonth ? Number(rawConsultant.costPerMonth) : null,
        rateCurrency: rawConsultant.rateCurrency || "USD",
      };
    }
  }

  const country = consultant?.country || "Default";

  // Cargar feriados corporativos/personalizados de la BD
  const customHolidays = await prisma.customHoliday.findMany({
    where: {
      OR: [
        { country: "All" },
        { country: country },
      ],
    },
  });

  const customHolidaySet = new Set(
    customHolidays.map((h) => {
      const y = h.date.getUTCFullYear();
      const m = String(h.date.getUTCMonth() + 1).padStart(2, "0");
      const d = String(h.date.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }),
  );

  const isDayHoliday = (d: Date, ctry: string): boolean => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${day}`;
    return isPublicHoliday(d, ctry) || customHolidaySet.has(dateStr);
  };

  // 2. Determinar divisor de horas mensuales del país
  let divisorUsed = config.monthlyDivisor ? Number(config.monthlyDivisor) : 220;
  if (!config.monthlyDivisor) {
    if (country === "Colombia") {
      // Transición de jornada laboral Ley 2101 (220h a 210h el 15 de julio de 2026)
      const transitionDate = new Date("2026-07-15");
      divisorUsed = date >= transitionDate ? 210 : 220;
    } else if (country === "Peru" || country === "Ecuador" || country === "Mexico") {
      divisorUsed = 240;
    } else if (country === "Chile") {
      divisorUsed = 180;
    }
  }

  // 3. Determinar tarifa por hora
  let hourlyRate = 0;
  if (consultant) {
    if (consultant.hourlyRate !== null && consultant.hourlyRate > 0) {
      hourlyRate = consultant.hourlyRate;
    } else if (consultant.costPerMonth !== null && consultant.costPerMonth > 0) {
      hourlyRate = consultant.costPerMonth / divisorUsed;
    }
  } else {
    // Tarifa por hora predeterminada si no hay consultor asociado
    hourlyRate = 50; 
  }

  // 4. Parsear horas de inicio y fin (past midnight handling)
  const [startH, startM, startS] = startTime.split(":").map(Number);
  const [endH, endM, endS] = endTime.split(":").map(Number);

  // Crear fechas UTC para evitar desajustes de zona horaria
  const startDateTime = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), startH, startM, startS || 0));
  let endDateTime = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), endH, endM, endS || 0));

  // Si la hora de fin es menor o igual a la de inicio, asumimos que pasa de medianoche y termina al día siguiente
  if (endDateTime.getTime() <= startDateTime.getTime()) {
    endDateTime = new Date(endDateTime.getTime() + 24 * 60 * 60 * 1000);
  }

  const totalMilliseconds = endDateTime.getTime() - startDateTime.getTime();
  const totalHoursRaw = totalMilliseconds / (1000 * 60 * 60);

  // Inicializar acumuladores
  let diurnal = 0;
  let nocturnal = 0;
  let diurnalHoliday = 0;
  let nocturnalHoliday = 0;
  let diurnalAmount = 0;
  let nocturnalAmount = 0;
  let diurnalHolidayAmount = 0;
  let nocturnalHolidayAmount = 0;
  const warnings: string[] = [];

  // Límite de advertencia de horas extras
  if (totalHoursRaw > 2 && (country === "Chile" || country === "Colombia")) {
    warnings.push(`Advertencia: El reporte supera el límite legal sugerido de 2 horas extra diarias en ${country === "Colombia" ? "Colombia" : "Chile"}.`);
  }

  // ==========================================
  // CÁLCULO SEGÚN LEGISLACIÓN DEL PAÍS
  // ==========================================

  if (country === "Colombia") {
    // --- COLOMBIA ---
    // Recorrido minuto a minuto para mayor precisión en cambios de franja y festivos
    const step = 60 * 1000; // 1 minuto
    let current = startDateTime.getTime();
    const end = endDateTime.getTime();

    // Parsear límites diurnos
    const [dStartH, dStartM] = config.diurnalStart.split(":").map(Number);
    const [dEndH, dEndM] = config.diurnalEnd.split(":").map(Number);

    while (current < end) {
      const curDate = new Date(current);
      const isHoliday = isDayHoliday(curDate, "Colombia");
      
      const hour = curDate.getUTCHours() + curDate.getUTCMinutes() / 60;
      // Verificar si está en periodo diurno
      const isDiurnal = hour >= (dStartH + dStartM / 60) && hour < (dEndH + dEndM / 60);

      if (isHoliday) {
        if (isDiurnal) diurnalHoliday += 1 / 60;
        else nocturnalHoliday += 1 / 60;
      } else {
        if (isDiurnal) diurnal += 1 / 60;
        else nocturnal += 1 / 60;
      }
      current += step;
    }

    // Redondear horas a 2 decimales
    diurnal = Math.round(diurnal * 100) / 100;
    nocturnal = Math.round(nocturnal * 100) / 100;
    diurnalHoliday = Math.round(diurnalHoliday * 100) / 100;
    nocturnalHoliday = Math.round(nocturnalHoliday * 100) / 100;

    // Calcular montos aplicando multiplicadores de configuración
    diurnalAmount = diurnal * hourlyRate * Number(config.diurnalMultiplier);
    nocturnalAmount = nocturnal * hourlyRate * Number(config.nocturnalMultiplier);
    diurnalHolidayAmount = diurnalHoliday * hourlyRate * Number(config.diurnalHolidayMultiplier);
    nocturnalHolidayAmount = nocturnalHoliday * hourlyRate * Number(config.nocturnalHolidayMultiplier);

  } else if (country === "Peru") {
    // --- PERÚ ---
    // Primeras 2 horas del día: +25%
    // A partir de la tercera hora: +35%
    // Recargo nocturno (10:00 PM a 06:00 AM): +35% sobre la tarifa base de la hora extra.
    // Domingos y festivos: +100% sobre la tarifa normal
    
    // 1. Determinar si es festivo o domingo
    const isHoliday = isDayHoliday(date, "Peru");
    
    if (isHoliday) {
      diurnalHoliday = totalHoursRaw;
      diurnalHolidayAmount = diurnalHoliday * hourlyRate * Number(config.diurnalHolidayMultiplier); // 2.00x
    } else {
      // Recorrido minuto a minuto para separar horas diurnas y nocturnas (nocturno peruano: 22:00 a 06:00)
      const step = 60 * 1000;
      let current = startDateTime.getTime();
      const end = endDateTime.getTime();
      let regularExtraMinutes = 0;
      let nocturnalExtraMinutes = 0;

      while (current < end) {
        const curDate = new Date(current);
        const hour = curDate.getUTCHours() + curDate.getUTCMinutes() / 60;
        const isPeruNight = hour >= 22 || hour < 6;

        if (isPeruNight) {
          nocturnalExtraMinutes++;
        } else {
          regularExtraMinutes++;
        }
        current += step;
      }

      const rawDiurnal = regularExtraMinutes / 60;
      const rawNocturnal = nocturnalExtraMinutes / 60;

      // Aplicar regla de 2 horas (primeras 2h a 1.25, siguientes a 1.35)
      // Recorremos las horas acumuladas
      let remainingHours = totalHoursRaw;
      
      // Primera franja (primeras 2 horas)
      const firstTierHours = Math.min(remainingHours, 2);
      remainingHours -= firstTierHours;

      // Segunda franja (excedente)
      const secondTierHours = remainingHours;

      // Proporción de nocturnidad
      const nocturnalRatio = rawNocturnal / totalHoursRaw;
      
      // Separar por franja y nocturnidad para aplicar montos
      const firstTierNocturnal = firstTierHours * nocturnalRatio;
      const firstTierDiurnal = firstTierHours - firstTierNocturnal;

      const secondTierNocturnal = secondTierHours * nocturnalRatio;
      const secondTierDiurnal = secondTierHours - secondTierNocturnal;

      // Surcharges en Perú:
      // Diurno primer tier: 1.25x
      // Nocturno primer tier: 1.25x + 0.35x recargo nocturno = 1.60x
      // Diurno segundo tier: 1.35x
      // Nocturno segundo tier: 1.35x + 0.35x recargo nocturno = 1.70x
      
      diurnal = Math.round((firstTierDiurnal + secondTierDiurnal) * 100) / 100;
      nocturnal = Math.round((firstTierNocturnal + secondTierNocturnal) * 100) / 100;

      diurnalAmount = (firstTierDiurnal * hourlyRate * 1.25) + (secondTierDiurnal * hourlyRate * 1.35);
      nocturnalAmount = (firstTierNocturnal * hourlyRate * 1.60) + (secondTierNocturnal * hourlyRate * 1.70);
    }

  } else if (country === "Ecuador") {
    // --- ECUADOR ---
    // Recorrido minuto a minuto para separar horas suplementarias (+50%) y extraordinarias (+100%)
    const step = 60 * 1000;
    let current = startDateTime.getTime();
    const end = endDateTime.getTime();

    while (current < end) {
      const curDate = new Date(current);
      const isHoliday = isDayHoliday(curDate, "Ecuador");
      const dayOfWeek = curDate.getUTCDay(); // 0=Sun, 6=Sat
      const hour = curDate.getUTCHours() + curDate.getUTCMinutes() / 60;

      // Horas extraordinarias (+100% / 2.0x): Fines de semana, festivos, o en el bloque de 00:00 a 06:00
      const isWeekendOrHoliday = dayOfWeek === 0 || dayOfWeek === 6 || isHoliday;
      const isExtraordinaryTime = hour >= 0 && hour < 6;

      if (isWeekendOrHoliday || isExtraordinaryTime) {
        const isNightTime = hour >= 22 || hour < 6;
        if (isNightTime) {
          nocturnalHoliday += 1 / 60;
        } else {
          diurnalHoliday += 1 / 60;
        }
      } else {
        // Horas suplementarias (+50% / 1.5x)
        const isNightTime = hour >= 22 || hour < 6;
        if (isNightTime) {
          nocturnal += 1 / 60;
        } else {
          diurnal += 1 / 60;
        }
      }
      current += step;
    }

    diurnal = Math.round(diurnal * 100) / 100;
    nocturnal = Math.round(nocturnal * 100) / 100;
    diurnalHoliday = Math.round(diurnalHoliday * 100) / 100;
    nocturnalHoliday = Math.round(nocturnalHoliday * 100) / 100;

    diurnalAmount = diurnal * hourlyRate * Number(config.diurnalMultiplier);
    nocturnalAmount = nocturnal * hourlyRate * Number(config.nocturnalMultiplier);
    diurnalHolidayAmount = diurnalHoliday * hourlyRate * Number(config.diurnalHolidayMultiplier);
    nocturnalHolidayAmount = nocturnalHoliday * hourlyRate * Number(config.nocturnalHolidayMultiplier);

  } else if (country === "Chile") {
    // --- CHILE ---
    // Recorrido minuto a minuto para separar diurnas, nocturnas y festivas usando la configuración
    const step = 60 * 1000;
    let current = startDateTime.getTime();
    const end = endDateTime.getTime();

    // Límites diurnos
    const [dStartH, dStartM] = config.diurnalStart.split(":").map(Number);
    const [dEndH, dEndM] = config.diurnalEnd.split(":").map(Number);

    while (current < end) {
      const curDate = new Date(current);
      const isHoliday = isDayHoliday(curDate, "Chile");
      const hour = curDate.getUTCHours() + curDate.getUTCMinutes() / 60;
      const isDiurnal = hour >= (dStartH + dStartM / 60) && hour < (dEndH + dEndM / 60);

      if (isHoliday) {
        if (isDiurnal) diurnalHoliday += 1 / 60;
        else nocturnalHoliday += 1 / 60;
      } else {
        if (isDiurnal) diurnal += 1 / 60;
        else nocturnal += 1 / 60;
      }
      current += step;
    }

    diurnal = Math.round(diurnal * 100) / 100;
    nocturnal = Math.round(nocturnal * 100) / 100;
    diurnalHoliday = Math.round(diurnalHoliday * 100) / 100;
    nocturnalHoliday = Math.round(nocturnalHoliday * 100) / 100;

    diurnalAmount = diurnal * hourlyRate * Number(config.diurnalMultiplier);
    nocturnalAmount = nocturnal * hourlyRate * Number(config.nocturnalMultiplier);
    diurnalHolidayAmount = diurnalHoliday * hourlyRate * Number(config.diurnalHolidayMultiplier);
    nocturnalHolidayAmount = nocturnalHoliday * hourlyRate * Number(config.nocturnalHolidayMultiplier);

  } else if (country === "Mexico") {
    // --- MÉXICO ---
    // Primeras 9 horas semanales: +100% (2.00x)
    // Excedente de 9 horas semanales: +200% (3.00x)
    // Prima Dominical (+25% / 0.25x) si se trabaja en domingo
    // Feriados obligatorios nacionales se pagan al triple (3.00x) directamente
    const isNationalHoliday = isDayHoliday(date, "Mexico");
 
    if (isNationalHoliday) {
      diurnalHoliday = Math.round(totalHoursRaw * 100) / 100;
      diurnalHolidayAmount = diurnalHoliday * hourlyRate * 3.00; // 3.00x
    } else {
      const isSunday = date.getUTCDay() === 0;
      let previousHoursThisWeek = 0;

      if (consultantId) {
        // Buscar horas extras ya registradas esta semana (Lunes a Domingo)
        const { start: startOfW, end: endOfW } = getWeekRange(date);

        const weeklyEntries = await prisma.extraHourEntry.findMany({
          where: {
            consultantId,
            date: {
              gte: startOfW,
              lte: endOfW,
            },
            status: {
              in: ["APPROVED", "PENDING_FINANCE", "PENDING_PM"],
            },
          },
        });
        previousHoursThisWeek = weeklyEntries.reduce((sum, entry) => sum + Number(entry.totalHours), 0);
      }

      const remainingDoubleSlots = Math.max(0, 9 - previousHoursThisWeek);
      const doubleHours = Math.min(totalHoursRaw, remainingDoubleSlots);
      const tripleHours = Math.max(0, totalHoursRaw - doubleHours);

      diurnal = Math.round(totalHoursRaw * 100) / 100;
      const baseOvertimeAmount = (doubleHours * hourlyRate * 2.00) + (tripleHours * hourlyRate * 3.00);
      const sundayPremiumAmount = isSunday ? totalHoursRaw * hourlyRate * 0.25 : 0;
      diurnalAmount = baseOvertimeAmount + sundayPremiumAmount;

      if (isSunday) {
        warnings.push(`Información: Se aplicó el recargo de Prima Dominical (+25% sobre tarifa base) por trabajo en día domingo.`);
      }

      if (previousHoursThisWeek > 0) {
        warnings.push(`Información: El consultor ya tiene ${previousHoursThisWeek} horas extra registradas esta semana. De este reporte, ${doubleHours.toFixed(1)}h se pagan al 2.0x y ${tripleHours.toFixed(1)}h se pagan al 3.0x.`);
      }
    }

  } else {
    // --- EE.UU. / DEFAULT ---
    // Recorrido minuto a minuto para separar diurnas, nocturnas y festivas usando la configuración
    const step = 60 * 1000;
    let current = startDateTime.getTime();
    const end = endDateTime.getTime();

    // Límites diurnos
    const [dStartH, dStartM] = config.diurnalStart.split(":").map(Number);
    const [dEndH, dEndM] = config.diurnalEnd.split(":").map(Number);

    while (current < end) {
      const curDate = new Date(current);
      const isHoliday = isDayHoliday(curDate, country);
      const hour = curDate.getUTCHours() + curDate.getUTCMinutes() / 60;
      const isDiurnal = hour >= (dStartH + dStartM / 60) && hour < (dEndH + dEndM / 60);

      if (isHoliday) {
        if (isDiurnal) diurnalHoliday += 1 / 60;
        else nocturnalHoliday += 1 / 60;
      } else {
        if (isDiurnal) diurnal += 1 / 60;
        else nocturnal += 1 / 60;
      }
      current += step;
    }

    diurnal = Math.round(diurnal * 100) / 100;
    nocturnal = Math.round(nocturnal * 100) / 100;
    diurnalHoliday = Math.round(diurnalHoliday * 100) / 100;
    nocturnalHoliday = Math.round(nocturnalHoliday * 100) / 100;

    diurnalAmount = diurnal * hourlyRate * Number(config.diurnalMultiplier);
    nocturnalAmount = nocturnal * hourlyRate * Number(config.nocturnalMultiplier);
    diurnalHolidayAmount = diurnalHoliday * hourlyRate * Number(config.diurnalHolidayMultiplier);
    nocturnalHolidayAmount = nocturnalHoliday * hourlyRate * Number(config.nocturnalHolidayMultiplier);
  }


  // Redondear montos a 2 decimales
  diurnalAmount = Math.round(diurnalAmount * 100) / 100;
  nocturnalAmount = Math.round(nocturnalAmount * 100) / 100;
  diurnalHolidayAmount = Math.round(diurnalHolidayAmount * 100) / 100;
  nocturnalHolidayAmount = Math.round(nocturnalHolidayAmount * 100) / 100;

  const totalAmount = Math.round((diurnalAmount + nocturnalAmount + diurnalHolidayAmount + nocturnalHolidayAmount) * 100) / 100;
  const totalHours = Math.round((diurnal + nocturnal + diurnalHoliday + nocturnalHoliday) * 100) / 100;

  // Límite semanal general (advertencia)
  if (consultantId) {
    const { start: startOfW, end: endOfW } = getWeekRange(date);
    const weeklyEntries = await prisma.extraHourEntry.findMany({
      where: {
        consultantId,
        date: { gte: startOfW, lte: endOfW },
        status: { in: ["APPROVED", "PENDING_FINANCE", "PENDING_PM"] },
      },
    });
    const currentWeekTotal = weeklyEntries.reduce((sum, entry) => sum + Number(entry.totalHours), 0) + totalHours;
    
    if (currentWeekTotal > Number(config.weeklyExtraHoursLimit)) {
      warnings.push(`Advertencia: El total de horas extras semanales acumuladas (${currentWeekTotal.toFixed(1)}h) supera el límite configurado de ${config.weeklyExtraHoursLimit}h.`);
    }
  }

  return {
    diurnal,
    nocturnal,
    diurnalHoliday,
    nocturnalHoliday,
    totalHours,
    diurnalAmount,
    nocturnalAmount,
    diurnalHolidayAmount,
    nocturnalHolidayAmount,
    totalAmount,
    hourlyRate,
    divisorUsed,
    isHoliday: isDayHoliday(date, country),
    warnings,
  };
}

