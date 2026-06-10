import type { Assignment, ConsultantBlock, CapacityConfig, AssignmentStatus } from "@prisma/client";
import { isPublicHoliday } from "./holidays.js";

export type AvailabilityStatus = "FREE" | "PARTIAL" | "FULL" | "OVERLOADED";

export type ConsultantAvailability = {
  consultantId: string;
  capacityHours: number;
  committedHours: number;
  availableHours: number;
  utilizationPct: number;
  availabilityStatus: AvailabilityStatus;
  nextAvailableDate: Date | null;
};

const ACTIVE_STATUSES: AssignmentStatus[] = ["ACTIVE", "PARTIAL", "PLANNED"];

/** Días hábiles entre dos fechas (lunes a viernes, sin feriados) */
export function countWorkdays(from: Date, to: Date, workDaysPerWeek = 5, country?: string | null, customHolidays?: Set<string>): number {
  if (to < from) return 0;
  
  let workdays = 0;
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));

  const current = new Date(start);
  while (current <= end) {
    const day = current.getUTCDay(); // 0=Sun, 6=Sat
    const isWorkday = workDaysPerWeek >= 6 ? day !== 0 : day !== 0 && day !== 6;
    
    if (isWorkday) {
      const y = current.getUTCFullYear();
      const m = String(current.getUTCMonth() + 1).padStart(2, "0");
      const d = String(current.getUTCDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;
      
      const isHoliday = (country ? isPublicHoliday(current, country) : false) || (customHolidays ? customHolidays.has(dateStr) : false);
      if (!isHoliday) {
        workdays++;
      }
    }
    
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return workdays;
}

/** Solapamiento en días entre un assignment/block y un período */
export function overlapDays(
  itemStart: Date,
  itemEnd: Date,
  periodStart: Date,
  periodEnd: Date,
  workDaysPerWeek = 5,
  country?: string | null,
  customHolidays?: Set<string>,
): number {
  const start = itemStart > periodStart ? itemStart : periodStart;
  const end = itemEnd < periodEnd ? itemEnd : periodEnd;
  if (end < start) return 0;
  return countWorkdays(start, end, workDaysPerWeek, country, customHolidays);
}

/** Horas de capacidad de un consultor en un período */
export function calculateCapacityHours(
  period: { from: Date; to: Date },
  config: Pick<CapacityConfig, "hoursPerDay" | "workDaysPerWeek"> | null,
  blocks: Pick<ConsultantBlock, "startDate" | "endDate">[],
  country?: string | null,
  customHolidays?: Set<string>,
): number {
  const hoursPerDay = config ? Number(config.hoursPerDay) : 8;
  const workDaysPerWeek = config ? config.workDaysPerWeek : 5;

  const totalWorkdays = countWorkdays(period.from, period.to, workDaysPerWeek, country, customHolidays);

  const blockedDays = blocks.reduce((sum, block) => {
    return sum + overlapDays(block.startDate, block.endDate, period.from, period.to, workDaysPerWeek, country, customHolidays);
  }, 0);

  return Math.max(totalWorkdays - blockedDays, 0) * hoursPerDay;
}

/** Horas comprometidas de un consultor dadas sus asignaciones en un período */
export function calculateCommittedHours(
  assignments: Pick<Assignment, "startDate" | "endDate" | "allocationMode" | "allocationPct" | "hoursPerPeriod" | "periodUnit" | "status">[],
  period: { from: Date; to: Date },
  config: Pick<CapacityConfig, "hoursPerDay" | "workDaysPerWeek"> | null,
  country?: string | null,
  customHolidays?: Set<string>,
): number {
  const hoursPerDay = config ? Number(config.hoursPerDay) : 8;
  const workDaysPerWeek = config ? config.workDaysPerWeek : 5;

  return assignments
    .filter((a) => ACTIVE_STATUSES.includes(a.status) && a.endDate >= period.from && a.startDate <= period.to)
    .reduce((sum, assignment) => {
      const overlapWorkdays = overlapDays(
        assignment.startDate,
        assignment.endDate,
        period.from,
        period.to,
        workDaysPerWeek,
        country,
        customHolidays,
      );

      if (assignment.allocationMode === "PERCENTAGE") {
        const pct = Number(assignment.allocationPct ?? 0) / 100;
        return sum + overlapWorkdays * hoursPerDay * pct;
      }

      // HOURS mode: normalize hoursPerPeriod to hours in the overlapping window
      const hoursPerPeriod = Number(assignment.hoursPerPeriod ?? 0);
      const unit = assignment.periodUnit ?? "week";

      // Full period length in workdays
      const fullWorkdays = countWorkdays(assignment.startDate, assignment.endDate, workDaysPerWeek, country, customHolidays);
      if (fullWorkdays === 0) return sum;

      // Proportional allocation for the overlapping portion
      const proportion = overlapWorkdays / fullWorkdays;

      if (unit === "week") {
        const totalWeeks = fullWorkdays / workDaysPerWeek;
        return sum + proportion * totalWeeks * hoursPerPeriod;
      }

      // month: approximate
      const totalMonths = fullWorkdays / (workDaysPerWeek * 4.33);
      return sum + proportion * totalMonths * hoursPerPeriod;
    }, 0);
}

export function getAvailabilityStatus(utilizationPct: number): AvailabilityStatus {
  if (utilizationPct === 0) return "FREE";
  if (utilizationPct < 100) return "PARTIAL";
  if (utilizationPct === 100) return "FULL";
  return "OVERLOADED";
}

/** Primera fecha en que el consultor queda libre */
export function getNextAvailableDate(
  assignments: Pick<Assignment, "startDate" | "endDate" | "status">[],
  blocks: Pick<ConsultantBlock, "startDate" | "endDate">[],
  asOf: Date,
): Date | null {
  const active = [
    ...assignments
      .filter((a) => ACTIVE_STATUSES.includes(a.status) && a.endDate >= asOf)
      .map((a) => ({ start: a.startDate, end: a.endDate })),
    ...blocks
      .filter((b) => b.endDate >= asOf)
      .map((b) => ({ start: b.startDate, end: b.endDate })),
  ].sort((a, b) => a.start.getTime() - b.start.getTime());

  if (active.length === 0) return null; // ya está libre

  let latestEnd = active[0].end;
  for (const item of active) {
    if (item.start <= addDays(latestEnd, 1)) {
      if (item.end > latestEnd) latestEnd = item.end;
    }
  }

  return addDays(latestEnd, 1);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function computeAvailability(
  consultantId: string,
  assignments: Pick<Assignment, "startDate" | "endDate" | "allocationMode" | "allocationPct" | "hoursPerPeriod" | "periodUnit" | "status">[],
  blocks: Pick<ConsultantBlock, "startDate" | "endDate">[],
  config: Pick<CapacityConfig, "hoursPerDay" | "workDaysPerWeek"> | null,
  period: { from: Date; to: Date },
  country?: string | null,
  customHolidays?: Set<string>,
): ConsultantAvailability {
  const capacityHours = calculateCapacityHours(period, config, blocks, country, customHolidays);
  const committedHours = calculateCommittedHours(assignments, period, config, country, customHolidays);
  const availableHours = Math.max(capacityHours - committedHours, 0);
  const utilizationPct = capacityHours > 0 ? Math.round((committedHours / capacityHours) * 100 * 10) / 10 : 0;
  const availabilityStatus = getAvailabilityStatus(utilizationPct);
  const nextAvailableDate = availabilityStatus !== "FREE"
    ? getNextAvailableDate(assignments, blocks, period.from)
    : null;

  return {
    consultantId,
    capacityHours: Math.round(capacityHours * 10) / 10,
    committedHours: Math.round(committedHours * 10) / 10,
    availableHours: Math.round(availableHours * 10) / 10,
    utilizationPct,
    availabilityStatus,
    nextAvailableDate,
  };
}
