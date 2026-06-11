import React, { useState, useEffect, useCallback } from "react";
import { PageHeader } from "../../components/PageHeader";
import {
  listExtraHours,
  createExtraHour,
  calculateExtraHoursApi,
  listExtraHoursConfigs,
  updateCountryExtraHoursConfig,
  approveExtraHour,
  rejectExtraHour,
  getPayrollSummary,
  deleteExtraHour,
  listCustomHolidays,
  createCustomHoliday,
  deleteCustomHoliday,
  type CustomHoliday,
  type Project,
  type Consultant,
  type AuthUser,
  type ExtraHourEntry,
  type ExtraHoursConfig,
  type ExtraHoursCalculationResult,
  type PayrollConsolidationRow,
  type ApprovalDelegation
} from "../../services/api";
import { ConfirmDialog } from "../../components/ConfirmDialog";

// ─── HELPER FUNCTIONS FOR OFFICIAL HOLIDAYS ───────────────────────────────────

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

function getNthMonday(year: number, month: number, n: number): Date {
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const dayOfWeek = firstDay.getUTCDay();
  const daysUntilMonday = (1 - dayOfWeek + 7) % 7;
  const firstMondayDay = 1 + daysUntilMonday;
  const targetDay = firstMondayDay + (n - 1) * 7;
  return new Date(Date.UTC(year, month - 1, targetDay));
}

function getNthThursday(year: number, month: number, n: number): Date {
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const dayOfWeek = firstDay.getUTCDay();
  const daysUntilThursday = (4 - dayOfWeek + 7) % 7;
  const firstThursdayDay = 1 + daysUntilThursday;
  const targetDay = firstThursdayDay + (n - 1) * 7;
  return new Date(Date.UTC(year, month - 1, targetDay));
}

function moveChileanHoliday(year: number, month: number, day: number): Date {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  if (dayOfWeek === 2 || dayOfWeek === 3 || dayOfWeek === 4) {
    const offset = dayOfWeek === 2 ? -1 : dayOfWeek === 3 ? -2 : -3;
    return new Date(date.getTime() + offset * 24 * 60 * 60 * 1000);
  } else if (dayOfWeek === 5) {
    return new Date(date.getTime() + 3 * 24 * 60 * 60 * 1000);
  }
  return date;
}

function moveEcuadorHoliday(year: number, month: number, day: number): Date {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  if (dayOfWeek === 6) {
    return new Date(date.getTime() - 1 * 24 * 60 * 60 * 1000);
  } else if (dayOfWeek === 0) {
    return new Date(date.getTime() + 1 * 24 * 60 * 60 * 1000);
  } else if (dayOfWeek === 2) {
    return new Date(date.getTime() - 1 * 24 * 60 * 60 * 1000);
  } else if (dayOfWeek === 3) {
    return new Date(date.getTime() + 2 * 24 * 60 * 60 * 1000);
  } else if (dayOfWeek === 4) {
    return new Date(date.getTime() + 1 * 24 * 60 * 60 * 1000);
  }
  return date;
}

function getOfficialHolidaysForYear(year: number, country: string): { date: string; name: string }[] {
  const holidays: { date: Date; name: string }[] = [];
  const normalizedCountry = country.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  if (normalizedCountry === "colombia") {
    const fixed = {
      "01-01": "Año Nuevo",
      "05-01": "Día del Trabajo",
      "07-20": "Día de la Independencia",
      "08-07": "Batalla de Boyacá",
      "12-08": "Día de la Inmaculada Concepción",
      "12-25": "Navidad",
    };
    for (const [key, name] of Object.entries(fixed)) {
      const [m, d] = key.split("-").map(Number);
      holidays.push({ date: new Date(Date.UTC(year, m - 1, d)), name });
    }

    const movable = {
      "01-06": "Día de los Reyes Magos",
      "03-19": "Día de San José",
      "06-29": "San Pedro y San Pablo",
      "08-15": "La Asunción",
      "10-12": "Día de la Raza",
      "11-01": "Día de Todos los Santos",
      "11-11": "Independencia de Cartagena",
    };
    for (const [key, name] of Object.entries(movable)) {
      const [m, d] = key.split("-").map(Number);
      const originalDate = new Date(Date.UTC(year, m - 1, d));
      if (originalDate.getUTCDay() === 1) {
        holidays.push({ date: originalDate, name });
      } else {
        const daysUntilMonday = (1 - originalDate.getUTCDay() + 7) % 7;
        const offset = daysUntilMonday === 0 ? 7 : daysUntilMonday;
        holidays.push({ date: new Date(originalDate.getTime() + offset * 24 * 60 * 60 * 1000), name: `${name} (trasladado)` });
      }
    }

    const easter = calculateEasterSunday(year);
    const easterDependent: Record<number, string> = {
      [-3]: "Jueves Santo",
      [-2]: "Viernes Santo",
      [43]: "Ascensión del Señor",
      [64]: "Corpus Christi",
      [71]: "Sagrado Corazón",
    };
    for (const [offsetStr, name] of Object.entries(easterDependent)) {
      const offset = Number(offsetStr);
      const holidayDate = new Date(easter.getTime() + offset * 24 * 60 * 60 * 1000);
      if (offset === -3 || offset === -2) {
        holidays.push({ date: holidayDate, name });
      } else {
        if (holidayDate.getUTCDay() === 1) {
          holidays.push({ date: holidayDate, name });
        } else {
          const daysUntilMonday = (1 - holidayDate.getUTCDay() + 7) % 7;
          const offsetMonday = daysUntilMonday === 0 ? 7 : daysUntilMonday;
          holidays.push({ date: new Date(holidayDate.getTime() + offsetMonday * 24 * 60 * 60 * 1000), name: `${name} (trasladado)` });
        }
      }
    }
  } else if (normalizedCountry === "peru") {
    const fixed = {
      "01-01": "Año Nuevo",
      "05-01": "Día del Trabajo",
      "06-07": "Día de la Bandera",
      "06-29": "San Pedro y San Pablo",
      "07-23": "Día de la Fuerza Aérea",
      "07-28": "Fiestas Patrias (Independencia)",
      "07-29": "Fiestas Patrias (Fuerzas Armadas)",
      "08-06": "Batalla de Junín",
      "08-30": "Santa Rosa de Lima",
      "10-08": "Combate de Angamos",
      "11-01": "Día de Todos los Santos",
      "12-08": "Día de la Inmaculada Concepción",
      "12-09": "Batalla de Ayacucho",
      "12-25": "Navidad",
    };
    for (const [key, name] of Object.entries(fixed)) {
      const [m, d] = key.split("-").map(Number);
      holidays.push({ date: new Date(Date.UTC(year, m - 1, d)), name });
    }
    const easter = calculateEasterSunday(year);
    holidays.push({ date: new Date(easter.getTime() - 3 * 24 * 60 * 60 * 1000), name: "Jueves Santo" });
    holidays.push({ date: new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000), name: "Viernes Santo" });
  } else if (normalizedCountry === "chile") {
    const fixed = {
      "01-01": "Año Nuevo",
      "05-01": "Día del Trabajo",
      "05-21": "Día de las Glorias Navales",
      "07-16": "Día de la Virgen del Carmen",
      "08-15": "Asunción de la Virgen",
      "09-18": "Fiestas Patrias (Independencia)",
      "09-19": "Glorias del Ejército",
      "11-01": "Día de Todos los Santos",
      "12-08": "Inmaculada Concepción",
      "12-25": "Navidad",
    };
    for (const [key, name] of Object.entries(fixed)) {
      const [m, d] = key.split("-").map(Number);
      holidays.push({ date: new Date(Date.UTC(year, m - 1, d)), name });
    }
    holidays.push({ date: moveChileanHoliday(year, 6, 29), name: "San Pedro y San Pablo" });
    holidays.push({ date: moveChileanHoliday(year, 10, 12), name: "Encuentro de Dos Mundos" });

    const evangBase = new Date(Date.UTC(year, 9, 31));
    const evangDay = evangBase.getUTCDay();
    let evangDate = evangBase;
    if (evangDay === 3) {
      evangDate = new Date(Date.UTC(year, 10, 2));
    } else if (evangDay === 2) {
      evangDate = new Date(Date.UTC(year, 9, 27));
    }
    holidays.push({ date: evangDate, name: "Día de las Iglesias Evangélicas y Protestantes" });

    const easter = calculateEasterSunday(year);
    holidays.push({ date: new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000), name: "Viernes Santo" });
    holidays.push({ date: new Date(easter.getTime() - 1 * 24 * 60 * 60 * 1000), name: "Sábado Santo" });
  } else if (normalizedCountry === "mexico") {
    const fixed = {
      "01-01": "Año Nuevo",
      "05-01": "Día del Trabajo",
      "09-16": "Día de la Independencia",
      "12-25": "Navidad",
    };
    for (const [key, name] of Object.entries(fixed)) {
      const [m, d] = key.split("-").map(Number);
      holidays.push({ date: new Date(Date.UTC(year, m - 1, d)), name });
    }
    holidays.push({ date: getNthMonday(year, 2, 1), name: "Día de la Constitución Mexicana" });
    holidays.push({ date: getNthMonday(year, 3, 3), name: "Natalicio de Benito Juárez" });
    holidays.push({ date: getNthMonday(year, 11, 3), name: "Día de la Revolución Mexicana" });
    if ((year - 2024) % 6 === 0) {
      holidays.push({ date: new Date(Date.UTC(year, 11, 1)), name: "Transmisión del Poder Ejecutivo Federal" });
    }
  } else if (normalizedCountry === "ecuador") {
    holidays.push({ date: new Date(Date.UTC(year, 0, 1)), name: "Año Nuevo" });
    holidays.push({ date: new Date(Date.UTC(year, 4, 1)), name: "Día del Trabajo" });
    holidays.push({ date: new Date(Date.UTC(year, 11, 25)), name: "Navidad" });

    holidays.push({ date: moveEcuadorHoliday(year, 5, 24), name: "Batalla de Pichincha" });
    holidays.push({ date: moveEcuadorHoliday(year, 8, 10), name: "Primer Grito de Independencia" });
    holidays.push({ date: moveEcuadorHoliday(year, 10, 9), name: "Independencia de Guayaquil" });
    holidays.push({ date: moveEcuadorHoliday(year, 11, 2), name: "Día de los Difuntos" });
    holidays.push({ date: moveEcuadorHoliday(year, 11, 3), name: "Independencia de Cuenca" });

    const easter = calculateEasterSunday(year);
    holidays.push({ date: new Date(easter.getTime() - 48 * 24 * 60 * 60 * 1000), name: "Lunes de Carnaval" });
    holidays.push({ date: new Date(easter.getTime() - 47 * 24 * 60 * 60 * 1000), name: "Martes de Carnaval" });
    holidays.push({ date: new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000), name: "Viernes Santo" });
  } else {
    holidays.push({ date: new Date(Date.UTC(year, 0, 1)), name: "New Year's Day" });
    holidays.push({ date: new Date(Date.UTC(year, 6, 4)), name: "Independence Day" });
    holidays.push({ date: new Date(Date.UTC(year, 11, 25)), name: "Christmas Day" });
    holidays.push({ date: getNthMonday(year, 9, 1), name: "Labor Day" });
    holidays.push({ date: getNthThursday(year, 11, 4), name: "Thanksgiving" });

    const firstMondayJune = getNthMonday(year, 6, 1);
    holidays.push({ date: new Date(firstMondayJune.getTime() - 7 * 24 * 60 * 60 * 1000), name: "Memorial Day" });
  }

  return holidays
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((h) => {
      const y = h.date.getUTCFullYear();
      const m = String(h.date.getUTCMonth() + 1).padStart(2, "0");
      const d = String(h.date.getUTCDate()).padStart(2, "0");
      return { date: `${y}-${m}-${d}`, name: h.name };
    });
}


type ExtraHoursTabProps = {
  projects: Project[];
  consultants: Consultant[];
  authUser: AuthUser | null;
  can: (permission: string) => boolean;
  onError: (msg: string) => void;
  configModeOnly?: boolean;
};

type LegislationInfo = {
  country: string;
  flag: string;
  desc: string;
  points: string[];
};

const LEGISLATIONS: Record<string, LegislationInfo> = {
  Colombia: {
    country: "Colombia",
    flag: "🇨🇴",
    desc: "Reducción gradual de jornada laboral según Ley 2101 y recargos nocturnos reformados.",
    points: [
      "Jornada semanal actual: 44 horas (divisor 220).",
      "Reducción a 42 horas en julio 2026 (divisor 210).",
      "Franja Nocturna: Inicia a las 19:00 (7:00 PM) con recargo del +35%.",
      "Límite legal: Máximo 2 horas extras diarias, 12 horas semanales.",
      "Recargo Festivo Diurno: +100% (2.0x). Festivo Nocturno: +150% (2.5x)."
    ]
  },
  Peru: {
    country: "Perú",
    flag: "🇵🇪",
    desc: "Recargos progresivos diarios sobre las horas de trabajo extra y recargo nocturno especial.",
    points: [
      "Primeras 2 horas extras/día: +25% de la tarifa base.",
      "A partir de la 3ª hora extra/día: +35% de la tarifa base.",
      "Franja Nocturna (22:00–06:00): Recargo especial del +35% sobre la tarifa base.",
      "Domingos y Festivos: +100% (pago doble)."
    ]
  },
  Chile: {
    country: "Chile",
    flag: "🇨🇱",
    desc: "Cálculo simplificado de recargo diario con límites estrictos de salud ocupacional.",
    points: [
      "Tarifa Extra Única: +50% de recargo sobre la tarifa normal.",
      "Límite legal absoluto: Máximo 2 horas extras diarias.",
      "Solo se permiten horas extras por necesidades temporales de la empresa."
    ]
  },
  Mexico: {
    country: "México",
    flag: "🇲🇽",
    desc: "Límites semanales estrictos con doble y triple compensación según la LFT.",
    points: [
      "Primeras 9 horas extras semanales: Se pagan con +100% (tarifa doble).",
      "Excedente de 9 horas semanales: Se pagan con +200% (tarifa triple).",
      "Franja Diurna: 06:00–20:00. Franja Nocturna: 20:00–06:00.",
      "Máximo sugerido: 3 horas diarias, 3 veces por semana."
    ]
  },
  Ecuador: {
    country: "Ecuador",
    flag: "🇪🇨",
    desc: "Cálculo de horas suplementarias y extraordinarias según el Código del Trabajo de Ecuador.",
    points: [
      "Divisor mensual: 240 horas.",
      "Horas Suplementarias (+50%): Fuera de la jornada regular, hasta las 24:00 (Lunes a Viernes).",
      "Horas Extraordinarias (+100%): Sábados, domingos, festivos nacionales, o de 00:00 a 06:00.",
      "Límite legal: Máximo 4 horas extras diarias, 12 horas semanales."
    ]
  },
  Default: {
    country: "USA / Default",
    flag: "🇺🇸",
    desc: "Compensación estándar de horas extra semanales (Time and a Half).",
    points: [
      "Cálculo semanal: Horas que superen las 40 horas semanales.",
      "Multiplicador: +50% de recargo (1.5x).",
      "Se aplica de manera general si el país no cuenta con una legislación específica."
    ]
  }
};

export function ExtraHoursTab({ projects, consultants, authUser, can, onError, configModeOnly = false }: ExtraHoursTabProps) {
  // Sub-navigation tabs
  const [activeSubTab, setActiveSubTab] = useState<"report" | "pm" | "finance" | "payroll" | "config" | "holidays">(
    configModeOnly ? "config" : "report"
  );

  // Success message banner state
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Global lists
  const [entries, setEntries] = useState<ExtraHourEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // --- Custom Holidays state ---
  const [customHolidays, setCustomHolidays] = useState<CustomHoliday[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayCountry, setHolidayCountry] = useState("All");
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarCountry, setCalendarCountry] = useState("Colombia");
  const [savingHoliday, setSavingHoliday] = useState(false);


  // --- 1. Report Form state ---
  const myConsultant = consultants.find((c) => c.email?.toLowerCase() === authUser?.email?.toLowerCase());
  const [reportConsultantId, setReportConsultantId] = useState(myConsultant?.id || "");
  const [reportProjectId, setReportProjectId] = useState("");
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [reportStartTime, setReportStartTime] = useState("18:00");
  const [reportEndTime, setReportEndTime] = useState("20:00");
  const [reportObservations, setReportObservations] = useState("");
  
  // Real-time calculation preview state
  const [previewResult, setPreviewResult] = useState<ExtraHoursCalculationResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [formWarnings, setFormWarnings] = useState<string[]>([]);
  const [reporting, setReporting] = useState(false);

  // --- 2. Approvals PM & Finance ---
  const [rejectionTargetId, setRejectionTargetId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // --- 3. Delete confirmation state ---
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // --- 4. Payroll closure state ---
  const [payrollYear, setPayrollYear] = useState(() => new Date().getFullYear());
  const [payrollMonth, setPayrollMonth] = useState(() => new Date().getMonth() + 1);
  const [payrollRows, setPayrollRows] = useState<PayrollConsolidationRow[]>([]);
  const [loadingPayroll, setLoadingPayroll] = useState(false);

  // --- 5. Config state (Multi-country) ---
  const [configsList, setConfigsList] = useState<ExtraHoursConfig[]>([]);
  const [selectedCountryConfig, setSelectedCountryConfig] = useState<string>("Colombia");
  const [configLimit, setConfigLimit] = useState<number>(12);
  const [configDiurnalMult, setConfigDiurnalMult] = useState<number>(1.25);
  const [configNocturnalMult, setConfigNocturnalMult] = useState<number>(1.75);
  const [configHolidayDiurnalMult, setConfigHolidayDiurnalMult] = useState<number>(2.00);
  const [configHolidayNocturnalMult, setConfigHolidayNocturnalMult] = useState<number>(2.50);
  const [configDiurnalStart, setConfigDiurnalStart] = useState<string>("06:00");
  const [configDiurnalEnd, setConfigDiurnalEnd] = useState<string>("21:00");
  const [savingConfig, setSavingConfig] = useState(false);

  // --- 6. Delegations state ---
  const [delegations, setDelegations] = useState<ApprovalDelegation[]>([]);
  const [loadingDelegations, setLoadingDelegations] = useState(false);
  const [delegateProjectId, setDelegateProjectId] = useState("");
  const [delegateToEmail, setDelegateToEmail] = useState("");
  const [delegateStartDate, setDelegateStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [delegateEndDate, setDelegateEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [savingDelegation, setSavingDelegation] = useState(false);

  // Show a success message that auto-dismisses
  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
  };

  const loadDelegationsList = useCallback(async () => {
    if (!can("extrahours:review") && !authUser?.roles.includes("ADMIN")) return;
    setLoadingDelegations(true);
    try {
      const { listDelegations } = await import("../../services/api");
      const data = await listDelegations();
      setDelegations(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al cargar delegaciones");
    } finally {
      setLoadingDelegations(false);
    }
  }, [onError, can, authUser]);

  const handleAddDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegateProjectId || !delegateToEmail || !delegateStartDate || !delegateEndDate) {
      onError("Por favor completa todos los campos.");
      return;
    }
    setSavingDelegation(true);
    try {
      const { createDelegation } = await import("../../services/api");
      await createDelegation({
        projectId: delegateProjectId,
        toUserEmail: delegateToEmail,
        startDate: delegateStartDate,
        endDate: delegateEndDate,
      });
      triggerSuccess("Delegación registrada con éxito.");
      setDelegateProjectId("");
      setDelegateToEmail("");
      await loadDelegationsList();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al registrar delegación");
    } finally {
      setSavingDelegation(false);
    }
  };

  const handleDeleteDelegation = async (id: string) => {
    if (!window.confirm("¿Está seguro de que desea eliminar esta delegación?")) {
      return;
    }
    try {
      const { deleteDelegation } = await import("../../services/api");
      await deleteDelegation(id);
      triggerSuccess("Delegación eliminada con éxito.");
      await loadDelegationsList();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al eliminar delegación");
    }
  };

  // Fetch entries
  const loadEntries = useCallback(async () => {
    setLoadingEntries(true);
    try {
      const data = await listExtraHours();
      setEntries(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al cargar solicitudes de horas extra");
    } finally {
      setLoadingEntries(false);
    }
  }, [onError]);

  // Load configs
  const loadConfigs = useCallback(async () => {
    try {
      const data = await listExtraHoursConfigs();
      setConfigsList(data);
      
      // Load current country details
      const current = data.find((c) => c.country === selectedCountryConfig);
      if (current) {
        setConfigLimit(Number(current.weeklyExtraHoursLimit));
        setConfigDiurnalMult(Number(current.diurnalMultiplier));
        setConfigNocturnalMult(Number(current.nocturnalMultiplier));
        setConfigHolidayDiurnalMult(Number(current.diurnalHolidayMultiplier));
        setConfigHolidayNocturnalMult(Number(current.nocturnalHolidayMultiplier));
        setConfigDiurnalStart(current.diurnalStart.slice(0, 5));
        setConfigDiurnalEnd(current.diurnalEnd.slice(0, 5));
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al cargar configuraciones de horas extra");
    }
  }, [selectedCountryConfig, onError]);

  // Load custom holidays
  const loadCustomHolidaysList = useCallback(async () => {
    setLoadingHolidays(true);
    try {
      const data = await listCustomHolidays();
      setCustomHolidays(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al cargar feriados especiales");
    } finally {
      setLoadingHolidays(false);
    }
  }, [onError]);

  // Load initial data
  useEffect(() => {
    void loadEntries();
    if (can("extrahours:config")) {
      void loadConfigs();
      void loadCustomHolidaysList();
    }
    if (can("extrahours:review") || authUser?.roles.includes("ADMIN")) {
      void loadDelegationsList();
    }
  }, [loadEntries, loadConfigs, loadCustomHolidaysList, loadDelegationsList, can, authUser]);


  // Handle selected country changes in config
  useEffect(() => {
    if (configsList.length > 0) {
      const current = configsList.find((c) => c.country === selectedCountryConfig);
      if (current) {
        setConfigLimit(Number(current.weeklyExtraHoursLimit));
        setConfigDiurnalMult(Number(current.diurnalMultiplier));
        setConfigNocturnalMult(Number(current.nocturnalMultiplier));
        setConfigHolidayDiurnalMult(Number(current.diurnalHolidayMultiplier));
        setConfigHolidayNocturnalMult(Number(current.nocturnalHolidayMultiplier));
        setConfigDiurnalStart(current.diurnalStart.slice(0, 5));
        setConfigDiurnalEnd(current.diurnalEnd.slice(0, 5));
      } else {
        // Default placeholders if not seeded yet
        const defaults = LEGISLATIONS[selectedCountryConfig] ? {
          limit: 12,
          dMult: 1.25,
          nMult: 1.75,
          hdMult: 2.0,
          hnMult: 2.5,
          start: "06:00",
          end: "21:00"
        } : {
          limit: 12,
          dMult: 1.5,
          nMult: 1.5,
          hdMult: 1.5,
          hnMult: 1.5,
          start: "06:00",
          end: "21:00"
        };
        setConfigLimit(defaults.limit);
        setConfigDiurnalMult(defaults.dMult);
        setConfigNocturnalMult(defaults.nMult);
        setConfigHolidayDiurnalMult(defaults.hdMult);
        setConfigHolidayNocturnalMult(defaults.hnMult);
        setConfigDiurnalStart(defaults.start);
        setConfigDiurnalEnd(defaults.end);
      }
    }
  }, [selectedCountryConfig, configsList]);

  // Default consultant ID when consultants load
  useEffect(() => {
    if (myConsultant && !reportConsultantId) {
      setReportConsultantId(myConsultant.id);
    }
  }, [consultants, myConsultant, reportConsultantId]);

  // Real-time backend calculation preview
  useEffect(() => {
    if (!reportConsultantId || !reportDate || !reportStartTime || !reportEndTime) {
      setPreviewResult(null);
      return;
    }

    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(reportStartTime) || !timeRegex.test(reportEndTime)) {
      return;
    }

    let isMounted = true;
    const triggerCalculation = async () => {
      setPreviewLoading(true);
      try {
        const result = await calculateExtraHoursApi({
          consultantId: reportConsultantId,
          date: reportDate,
          startTime: `${reportStartTime}:00`,
          endTime: `${reportEndTime}:00`
        });
        if (isMounted) {
          setPreviewResult(result);
          setFormWarnings(result.warnings || []);
        }
      } catch {
        if (isMounted) setPreviewResult(null);
      } finally {
        if (isMounted) setPreviewLoading(false);
      }
    };

    const delayDebounce = setTimeout(() => {
      void triggerCalculation();
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(delayDebounce);
    };
  }, [reportConsultantId, reportDate, reportStartTime, reportEndTime]);

  // Handle report submission
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportProjectId) {
      onError("Por favor selecciona un proyecto.");
      return;
    }
    if (!reportConsultantId) {
      onError("Por favor selecciona o define un consultor.");
      return;
    }

    setReporting(true);
    try {
      const res = await createExtraHour({
        projectId: reportProjectId,
        consultantId: reportConsultantId,
        date: reportDate,
        startTime: `${reportStartTime}:00`,
        endTime: `${reportEndTime}:00`,
        observations: reportObservations.trim() || undefined
      });
      
      triggerSuccess(`¡Solicitud registrada con éxito! ${res.warnings?.length ? `Aviso: ${res.warnings.join(", ")}` : ""}`);
      setReportObservations("");
      await loadEntries();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al reportar horas extra");
    } finally {
      setReporting(false);
    }
  };

  // Handle delete
  const handleDeleteEntry = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteExtraHour(deleteTargetId);
      triggerSuccess("Solicitud de horas extra eliminada.");
      setDeleteTargetId(null);
      await loadEntries();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al eliminar solicitud");
    }
  };

  // Handle sequential approvals
  const handleApprove = async (id: string) => {
    if (!authUser) return;
    setApprovingId(id);
    try {
      await approveExtraHour(id, { approvedBy: authUser.displayName });
      triggerSuccess("Solicitud aprobada correctamente.");
      await loadEntries();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al aprobar la solicitud");
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionTargetId || !rejectionNote.trim() || !authUser) return;
    if (rejectionNote.trim().length < 3) {
      onError("El motivo de rechazo debe tener al menos 3 caracteres.");
      return;
    }

    try {
      await rejectExtraHour(rejectionTargetId, {
        approvedBy: authUser.displayName,
        rejectionNote: rejectionNote.trim()
      });
      setRejectionTargetId(null);
      setRejectionNote("");
      triggerSuccess("Solicitud rechazada con éxito.");
      await loadEntries();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al rechazar la solicitud");
    }
  };

  // Fetch consolidated payroll closure
  const handleLoadPayroll = async () => {
    setLoadingPayroll(true);
    try {
      const summary = await getPayrollSummary(payrollYear, payrollMonth);
      setPayrollRows(summary);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al consultar cierre de nómina");
    } finally {
      setLoadingPayroll(false);
    }
  };

  const handleExportPayrollCSV = () => {
    if (payrollRows.length === 0) return;
    const headers = [
      "Consultor",
      "Identificación DNI/Cédula",
      "País",
      "Moneda",
      "Horas Totales",
      "Diurnas",
      "Nocturnas",
      "Festivas Diurnas",
      "Festivas Nocturnas",
      "Monto Local",
      "Monto USD"
    ];

    const rows = payrollRows.map((r) => [
      `"${r.consultantName}"`,
      `"${r.identification}"`,
      `"${r.country}"`,
      `"${r.currency}"`,
      r.totalHours,
      r.diurnal,
      r.nocturnal,
      r.diurnalHoliday,
      r.nocturnalHoliday,
      r.totalAmountLocal.toFixed(2),
      r.totalAmountUSD.toFixed(2)
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Cierre_Nomina_${payrollYear}_${payrollMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Update configurations per country
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await updateCountryExtraHoursConfig(selectedCountryConfig, {
        weeklyExtraHoursLimit: configLimit,
        diurnalMultiplier: configDiurnalMult,
        nocturnalMultiplier: configNocturnalMult,
        diurnalHolidayMultiplier: configHolidayDiurnalMult,
        nocturnalHolidayMultiplier: configHolidayNocturnalMult,
        diurnalStart: `${configDiurnalStart}:00`,
        diurnalEnd: `${configDiurnalEnd}:00`
      });
      triggerSuccess(`Configuración de ${selectedCountryConfig} actualizada con éxito.`);
      await loadConfigs();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al actualizar configuración");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayName.trim() || !holidayDate) {
      onError("Por favor ingresa un nombre y una fecha válida.");
      return;
    }
    setSavingHoliday(true);
    try {
      await createCustomHoliday({
        name: holidayName,
        date: holidayDate,
        country: holidayCountry,
      });
      triggerSuccess("Feriado corporativo agregado con éxito.");
      setHolidayName("");
      setHolidayDate("");
      setHolidayCountry("All");
      await loadCustomHolidaysList();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al agregar feriado especial");
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!window.confirm("¿Está seguro de que desea eliminar este feriado especial?")) {
      return;
    }
    try {
      await deleteCustomHoliday(id);
      triggerSuccess("Feriado corporativo eliminado con éxito.");
      await loadCustomHolidaysList();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al eliminar feriado especial");
    }
  };


  const getStatusLabel = (status: string) => {
    switch (status) {
      case "PENDING_PM": return { label: "Pte. PM (Nivel 1)", bg: "#fef3c7", color: "#d97706" };
      case "PENDING_FINANCE": return { label: "Pte. Nómina (Nivel 2)", bg: "#dbeafe", color: "#2563eb" };
      case "APPROVED": return { label: "Aprobada total", bg: "#dcfce7", color: "#16a34a" };
      case "REJECTED": return { label: "Rechazada", bg: "#fee2e2", color: "#dc2626" };
      default: return { label: status, bg: "#f3f4f6", color: "#374151" };
    }
  };

  // Filter projects with allowExtraHours = true
  const availableProjects = projects.filter((p) => p.allowExtraHours !== false);

  // Filter entries based on approval views
  const pmPendingEntries = entries.filter((e) => e.status === "PENDING_PM");
  const financePendingEntries = entries.filter((e) => e.status === "PENDING_FINANCE");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", padding: "1rem 2rem" }}>
      
      {/* Success banner */}
      {successMessage && (
        <div style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          background: "#10b981",
          color: "#fff",
          padding: "0.75rem 1.5rem",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          zIndex: 9999,
          fontWeight: 700,
          fontSize: "0.85rem",
          transition: "all 0.3s ease",
          animation: "slideIn 0.3s ease forwards"
        }}>
          ✅ {successMessage}
        </div>
      )}

      <PageHeader
        icon={configModeOnly ? "⚙" : "⧗"}
        title={configModeOnly ? "Configuración de Horas Extra" : "Solicitud de Horas Extra"}
        description={
          configModeOnly
            ? "Administra los límites diarios/semanales, recargos por tipo de hora, festivos y jornada laboral."
            : "Registra y consulta tus solicitudes de horas extras con cálculo automático de recargos y estado de aprobación."
        }
        actions={
          configModeOnly ? (
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className={activeSubTab === "config" ? "" : "ghost"}
                onClick={() => setActiveSubTab("config")}
                style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem", borderRadius: "8px" }}
              >
                ⚙ Parámetros y Recargos
              </button>
              <button
                type="button"
                className={activeSubTab === "holidays" ? "" : "ghost"}
                onClick={() => setActiveSubTab("holidays")}
                style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem", borderRadius: "8px" }}
              >
                📅 Calendario y Festivos
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {can("extrahours:write") && (
                <button
                  type="button"
                  className={activeSubTab === "report" ? "" : "ghost"}
                  onClick={() => setActiveSubTab("report")}
                  style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem", borderRadius: "8px" }}
                >
                  📝 Reportar y Mis Solicitudes
                </button>
              )}

              {can("extrahours:review") && (
                <button
                  type="button"
                  className={activeSubTab === "pm" ? "" : "ghost"}
                  onClick={() => setActiveSubTab("pm")}
                  style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem", borderRadius: "8px" }}
                >
                  👥 Aprobaciones PM ({pmPendingEntries.length})
                </button>
              )}

              {can("extrahours:review") && (authUser?.roles.includes("FINANCE") || authUser?.roles.includes("ADMIN")) && (
                <button
                  type="button"
                  className={activeSubTab === "finance" ? "" : "ghost"}
                  onClick={() => setActiveSubTab("finance")}
                  style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem", borderRadius: "8px" }}
                >
                  💰 Aprobaciones Nómina ({financePendingEntries.length})
                </button>
              )}

              {(authUser?.roles.includes("FINANCE") || authUser?.roles.includes("ADMIN")) && (
                <button
                  type="button"
                  className={activeSubTab === "payroll" ? "" : "ghost"}
                  onClick={() => setActiveSubTab("payroll")}
                  style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem", borderRadius: "8px" }}
                >
                  📁 Cierre de Nómina
                </button>
              )}
              {(can("projects:write") || authUser?.roles.includes("ADMIN")) && (
                <button
                  type="button"
                  className={activeSubTab === "delegations" ? "" : "ghost"}
                  onClick={() => { setActiveSubTab("delegations"); void loadDelegationsList(); }}
                  style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem", borderRadius: "8px" }}
                >
                  🤝 Delegaciones
                </button>
              )}
            </div>
          )
        }
      />

      {/* Rejection Modal overlay */}
      {rejectionTargetId && (
        <div className="modal-overlay">
          <form onSubmit={handleRejectSubmit} className="modal-card" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <h3>Rechazar Solicitud de Horas Extra</h3>
              <button type="button" className="ghost" onClick={() => setRejectionTargetId(null)} style={{ padding: "0.2rem 0.5rem" }}>✕</button>
            </div>
            <div className="form-grid">
              <div>
                <label className="form-label" style={{ fontSize: "0.85rem", fontWeight: 700 }}>Motivo de Rechazo *</label>
                <textarea
                  required
                  placeholder="Por favor explica brevemente por qué rechazas la solicitud..."
                  value={rejectionNote}
                  onChange={(e) => setRejectionNote(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: "1rem" }}>
              <button type="button" className="ghost" onClick={() => setRejectionTargetId(null)}>Cancelar</button>
              <button type="submit" style={{ background: "#ef4444", borderColor: "#ef4444" }}>Rechazar Solicitud</button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteTargetId !== null}
        title="¿Eliminar Solicitud?"
        message="¿Está seguro de que desea eliminar permanentemente esta solicitud de horas extra? Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        danger={true}
        onConfirm={handleDeleteEntry}
        onCancel={() => setDeleteTargetId(null)}
      />

      {/* --- REPORT SUB-TAB --- */}
      {activeSubTab === "report" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.9fr", gap: "2rem", alignItems: "start" }}>
          
          {/* Form and Preview */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div className="card glass-card" style={{ padding: "1.5rem", borderRadius: "14px", border: "1px solid #f4d4b6", background: "rgba(255, 255, 255, 0.55)" }}>
              <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.05rem", color: "var(--text-strong)", fontFamily: "var(--display)" }}>
                Registrar Solicitud
              </h3>
              
              <form onSubmit={handleReportSubmit} className="form-grid" style={{ gap: "0.8rem" }}>
                {authUser?.roles.includes("ADMIN") ? (
                  <div>
                    <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Consultor *</label>
                    <select
                      value={reportConsultantId}
                      onChange={(e) => setReportConsultantId(e.target.value)}
                      required
                    >
                      <option value="">-- Selecciona --</option>
                      {consultants.map((c) => (
                        <option key={c.id} value={c.id}>{c.fullName} ({c.country || "N/A"})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Consultor</label>
                    <input
                      type="text"
                      readOnly
                      value={myConsultant ? `${myConsultant.fullName} (${myConsultant.country || "Default"})` : authUser?.displayName || ""}
                      style={{ background: "#f3f4f6", cursor: "not-allowed" }}
                    />
                  </div>
                )}

                <div>
                  <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Proyecto *</label>
                  <select
                    value={reportProjectId}
                    onChange={(e) => setReportProjectId(e.target.value)}
                    required
                  >
                    <option value="">-- Selecciona Proyecto (Habilitados) --</option>
                    {availableProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Fecha *</label>
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <div>
                    <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Hora Inicio *</label>
                    <input
                      type="time"
                      value={reportStartTime}
                      onChange={(e) => setReportStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Hora Fin *</label>
                    <input
                      type="time"
                      value={reportEndTime}
                      onChange={(e) => setReportEndTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Observaciones / Tarea Realizada</label>
                  <textarea
                    rows={2}
                    value={reportObservations}
                    onChange={(e) => setReportObservations(e.target.value)}
                    placeholder="Describe el entregable, debugging o despliegue realizado..."
                  />
                </div>

                {/* Warnings warning box */}
                {formWarnings.length > 0 && (
                  <div style={{ padding: "0.5rem 0.75rem", background: "#fffbeb", border: "1px solid #fde68a", color: "#b45309", borderRadius: "8px", fontSize: "0.8rem" }}>
                    ⚠️ <strong>Límite advertencia:</strong>
                    <ul style={{ margin: "0.25rem 0 0 0", paddingLeft: "1.2rem" }}>
                      {formWarnings.map((w, idx) => <li key={idx}>{w}</li>)}
                    </ul>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={reporting || previewLoading}
                  style={{ marginTop: "0.5rem", width: "100%", background: "linear-gradient(135deg, #ff9c2c, #9a4f0f)", border: "none" }}
                >
                  {reporting ? "Registrando..." : "Enviar a Aprobación"}
                </button>
              </form>
            </div>

            {/* Live calculation details card */}
            {previewResult && (
              <div className="card" style={{ padding: "1.25rem", borderRadius: "14px", border: "1px solid #f4d4b6", background: "#fffcf9" }}>
                <h4 style={{ margin: "0 0 0.5rem 0", color: "#9a4f0f", fontSize: "0.9rem", fontWeight: 700 }}>🧮 Simulación en Vivo (Cálculo Backend)</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.8rem", color: "var(--text-soft)" }}>
                  <div>Horas Totales: <strong>{previewResult.totalHours} hrs</strong></div>
                  <div>¿Día Festivo?: <strong>{previewResult.isHoliday ? "Sí" : "No"}</strong></div>
                  <div>Diurnas / Nocturnas: <strong>{previewResult.diurnal} / {previewResult.nocturnal}</strong></div>
                  <div>Festivas (D / N): <strong>{previewResult.diurnalHoliday} / {previewResult.nocturnalHoliday}</strong></div>
                  <div>Tarifa Aplicada: <strong>{previewResult.hourlyRateUsed > 0 ? `$${previewResult.hourlyRateUsed.toLocaleString("es-CO")}` : "Costo/Mes div."}</strong></div>
                  <div style={{ gridColumn: "span 2", borderTop: "1px dashed #f4d4b6", paddingTop: "0.4rem", marginTop: "0.2rem" }}>
                    Valor Estimado Pago: <strong style={{ color: "#9a4f0f", fontSize: "0.95rem" }}>${previewResult.totalAmount.toLocaleString("es-CO")}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* List of my entries */}
          <div className="card" style={{ padding: "1.5rem", borderRadius: "14px", border: "1px solid #f4d4b6", background: "#fff" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.05rem", color: "var(--text-strong)", fontFamily: "var(--display)" }}>
              Historial de Solicitudes
            </h3>

            {loadingEntries ? (
              <p className="loading">Cargando...</p>
            ) : entries.length === 0 ? (
              <p style={{ fontStyle: "italic", color: "var(--text-soft)", fontSize: "0.85rem" }}>No se han registrado solicitudes todavía.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Proyecto</th>
                      <th>Consultor</th>
                      <th>Horario</th>
                      <th>Horas</th>
                      <th>Monto</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => {
                      const stat = getStatusLabel(entry.status);
                      const isOwn = entry.consultantId === myConsultant?.id || authUser?.roles.includes("ADMIN");
                      const canDelete = isOwn && entry.status !== "APPROVED";

                      return (
                        <tr key={entry.id}>
                          <td>{entry.date.slice(0, 10)}</td>
                          <td><strong>{entry.project?.name || "Sin proyecto"}</strong></td>
                          <td>{entry.consultant?.fullName}</td>
                          <td style={{ fontSize: "0.75rem" }}>{entry.startTime.slice(0, 5)} - {entry.endTime.slice(0, 5)}</td>
                          <td>
                            <strong>{Number(entry.totalHours).toFixed(1)}</strong>
                            <span style={{ fontSize: "0.7rem", color: "#888", display: "block" }}>
                              D:{Number(entry.diurnal).toFixed(1)} N:{Number(entry.nocturnal).toFixed(1)} F:{Number(Number(entry.diurnalHoliday) + Number(entry.nocturnalHoliday)).toFixed(1)}
                            </span>
                          </td>
                          <td>
                            <strong>${Number(entry.totalAmount).toLocaleString("es-CO")}</strong>
                            <span style={{ fontSize: "0.7rem", color: "#888", display: "block" }}>{entry.consultant?.rateCurrency || "COP"}</span>
                          </td>
                          <td>
                            <span className="pill" style={{ background: stat.bg, color: stat.color, fontSize: "0.72rem", padding: "0.15rem 0.45rem", fontWeight: 700 }}>
                              {stat.label}
                            </span>
                            {entry.rejectionNote && (
                              <span style={{ display: "block", color: "#ef4444", fontSize: "0.7rem", marginTop: "0.2rem", maxWidth: "150px" }}>
                                Motivo: {entry.rejectionNote}
                              </span>
                            )}
                          </td>
                          <td>
                            {canDelete ? (
                              <button
                                type="button"
                                onClick={() => setDeleteTargetId(entry.id)}
                                style={{ background: "none", color: "#ef4444", border: "none", cursor: "pointer", fontSize: "0.95rem" }}
                                title="Eliminar solicitud"
                              >
                                🗑
                              </button>
                            ) : (
                              <span style={{ color: "#aaa", fontSize: "0.8rem" }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* --- PM APPROVALS SUB-TAB --- */}
      {activeSubTab === "pm" && (
        <div className="card" style={{ padding: "1.5rem", borderRadius: "14px", border: "1px solid #f4d4b6", background: "#fff" }}>
          <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.05rem", color: "var(--text-strong)", fontFamily: "var(--display)" }}>
            Buzón de Aprobaciones del Supervisor (Nivel 1)
          </h3>
          <p style={{ color: "var(--text-soft)", fontSize: "0.82rem", marginBottom: "1rem" }}>
            Revisa y valida de forma operativa las horas extra registradas en tus proyectos. Luego pasarán a Nómina.
          </p>

          {pmPendingEntries.length === 0 ? (
            <p style={{ color: "var(--text-soft)", fontStyle: "italic", fontSize: "0.85rem" }}>No hay solicitudes pendientes por aprobación PM.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Consultor</th>
                    <th>Proyecto</th>
                    <th>Fecha</th>
                    <th>Horario</th>
                    <th>Horas</th>
                    <th>Monto Local</th>
                    <th>Observaciones</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pmPendingEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td><strong>{entry.consultant?.fullName}</strong> ({entry.consultant?.country || "Default"})</td>
                      <td>{entry.project?.name}</td>
                      <td>{entry.date.slice(0, 10)}</td>
                      <td>{entry.startTime.slice(0, 5)} - {entry.endTime.slice(0, 5)}</td>
                      <td>
                        <strong>{Number(entry.totalHours).toFixed(1)}</strong>
                        <span style={{ fontSize: "0.7rem", color: "#888", display: "block" }}>
                          D:{Number(entry.diurnal).toFixed(1)} N:{Number(entry.nocturnal).toFixed(1)} F:{Number(Number(entry.diurnalHoliday) + Number(entry.nocturnalHoliday)).toFixed(1)}
                        </span>
                      </td>
                      <td>
                        <strong>${Number(entry.totalAmount).toLocaleString("es-CO")}</strong>
                        <span style={{ fontSize: "0.7rem", color: "#888", display: "block" }}>{entry.consultant?.rateCurrency || "COP"}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-soft)" }}>{entry.observations || "Sin observaciones"}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button
                            type="button"
                            disabled={approvingId === entry.id}
                            onClick={() => void handleApprove(entry.id)}
                            style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", background: "#16a34a", borderColor: "#16a34a" }}
                          >
                            {approvingId === entry.id ? "Aprobando..." : "✓ Aprobar"}
                          </button>
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => { setRejectionTargetId(entry.id); setRejectionNote(""); }}
                            style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", borderColor: "#fca5a5", color: "#dc2626", background: "#fff5f5" }}
                          >
                            ✕ Rechazar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- FINANCE/PAYROLL APPROVALS SUB-TAB --- */}
      {activeSubTab === "finance" && (
        <div className="card" style={{ padding: "1.5rem", borderRadius: "14px", border: "1px solid #f4d4b6", background: "#fff" }}>
          <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.05rem", color: "var(--text-strong)", fontFamily: "var(--display)" }}>
            Buzón de Aprobaciones de Nómina / Recursos Humanos (Nivel 2)
          </h3>
          <p style={{ color: "var(--text-soft)", fontSize: "0.82rem", marginBottom: "1rem" }}>
            Valida financieramente para consolidar en el pago final.
          </p>

          {financePendingEntries.length === 0 ? (
            <p style={{ color: "var(--text-soft)", fontStyle: "italic", fontSize: "0.85rem" }}>No hay solicitudes pendientes de validación final.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Consultor</th>
                    <th>Identificación</th>
                    <th>País</th>
                    <th>Proyecto</th>
                    <th>Fecha</th>
                    <th>Horario</th>
                    <th>Horas</th>
                    <th>Monto Local</th>
                    <th>Observaciones</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {financePendingEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td><strong>{entry.consultant?.fullName}</strong></td>
                      <td>{entry.consultant?.identification || "No asignado"}</td>
                      <td>{entry.consultant?.country || "Default"}</td>
                      <td>{entry.project?.name}</td>
                      <td>{entry.date.slice(0, 10)}</td>
                      <td>{entry.startTime.slice(0, 5)} - {entry.endTime.slice(0, 5)}</td>
                      <td>
                        <strong>{Number(entry.totalHours).toFixed(1)}</strong>
                        <span style={{ fontSize: "0.7rem", color: "#888", display: "block" }}>
                          D:{Number(entry.diurnal).toFixed(1)} N:{Number(entry.nocturnal).toFixed(1)} F:{Number(Number(entry.diurnalHoliday) + Number(entry.nocturnalHoliday)).toFixed(1)}
                        </span>
                      </td>
                      <td>
                        <strong>${Number(entry.totalAmount).toLocaleString("es-CO")}</strong>
                        <span style={{ fontSize: "0.7rem", color: "#888", display: "block" }}>{entry.consultant?.rateCurrency || "COP"}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-soft)" }}>{entry.observations || "Sin observaciones"}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button
                            type="button"
                            disabled={approvingId === entry.id}
                            onClick={() => void handleApprove(entry.id)}
                            style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", background: "#16a34a", borderColor: "#16a34a" }}
                          >
                            {approvingId === entry.id ? "Aprobando..." : "✓ Aprobar Pago"}
                          </button>
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => { setRejectionTargetId(entry.id); setRejectionNote(""); }}
                            style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", borderColor: "#fca5a5", color: "#dc2626", background: "#fff5f5" }}
                          >
                            ✕ Rechazar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- PAYROLL CLOSURE SUB-TAB --- */}
      {activeSubTab === "payroll" && (
        <div className="card" style={{ padding: "1.5rem", borderRadius: "14px", border: "1px solid #f4d4b6", background: "#fff" }}>
          <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.05rem", color: "var(--text-strong)", fontFamily: "var(--display)" }}>
            Cierre Consolidado de Nómina Mensual
          </h3>
          <p style={{ color: "var(--text-soft)", fontSize: "0.82rem", marginBottom: "1rem" }}>
            Filtra por periodo para descargar el reporte CSV de horas aprobadas consolidado en bimoneda local y USD.
          </p>

          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "120px" }}>
              <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Año</label>
              <select value={payrollYear} onChange={(e) => setPayrollYear(Number(e.target.value))}>
                {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "150px" }}>
              <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Mes</label>
              <select value={payrollMonth} onChange={(e) => setPayrollMonth(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString("es-CO", { month: "long" })}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={handleLoadPayroll} disabled={loadingPayroll} style={{ padding: "0.55rem 1.2rem", background: "linear-gradient(135deg, #ff9c2c, #9a4f0f)", border: "none" }}>
              {loadingPayroll ? "Consolidando..." : "🔍 Consolidar Horas"}
            </button>
            {payrollRows.length > 0 && (
              <button type="button" className="ghost" onClick={handleExportPayrollCSV} style={{ padding: "0.55rem 1.2rem", borderColor: "#f4d4b6" }}>
                ⬇ Descargar Reporte CSV
              </button>
            )}
          </div>

          {payrollRows.length === 0 ? (
            <p style={{ color: "var(--text-soft)", fontStyle: "italic", fontSize: "0.85rem" }}>No se han consultado cierres de nómina para este periodo o no hay horas aprobadas.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Consultor</th>
                    <th>Identificación DNI</th>
                    <th>País</th>
                    <th>Moneda</th>
                    <th>Total Horas</th>
                    <th>Diurnas</th>
                    <th>Nocturnas</th>
                    <th>Festivas Diu.</th>
                    <th>Festivas Noc.</th>
                    <th>Total Local</th>
                    <th>Total USD</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollRows.map((row, idx) => (
                    <tr key={idx}>
                      <td><strong>{row.consultantName}</strong></td>
                      <td>{row.identification}</td>
                      <td>{row.country}</td>
                      <td>{row.currency}</td>
                      <td><strong>{row.totalHours}</strong></td>
                      <td>{row.diurnal}</td>
                      <td>{row.nocturnal}</td>
                      <td>{row.diurnalHoliday}</td>
                      <td>{row.nocturnalHoliday}</td>
                      <td><strong>${row.totalAmountLocal.toLocaleString("es-CO")}</strong></td>
                      <td><strong style={{ color: "#b45309" }}>${row.totalAmountUSD.toLocaleString("es-CO", { maximumFractionDigits: 2 })} USD</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- CONFIGURATION SUB-TAB (Multi-Country Selector & Forms) --- */}
      {activeSubTab === "config" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* Header */}
          <div className="card glass-card" style={{ padding: "1.5rem", borderRadius: "14px", border: "1px solid #f4d4b6", background: "rgba(255, 255, 255, 0.55)" }}>
            <h3 style={{ margin: 0, fontSize: "1.15rem", color: "var(--text-strong)", fontFamily: "var(--display)" }}>
              ⚙ Configuración Multipaís de Horas Extra
            </h3>
            <p style={{ color: "var(--text-soft)", fontSize: "0.82rem", marginTop: "0.25rem" }}>
              Define y edita los multiplicadores, límites semanales y jornada diurna de forma independiente para cada país en el que opere la empresa.
            </p>
          </div>

          {/* Country Selection Tabs (Pills) */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", borderBottom: "1px dashed #f4d4b6", paddingBottom: "1rem" }}>
            {Object.keys(LEGISLATIONS).map((cName) => {
              const leg = LEGISLATIONS[cName];
              return (
                <button
                  key={cName}
                  type="button"
                  className={selectedCountryConfig === cName ? "" : "ghost"}
                  onClick={() => setSelectedCountryConfig(cName)}
                  style={{
                    fontSize: "0.85rem",
                    padding: "0.45rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    borderRadius: "20px"
                  }}
                >
                  <span style={{ fontSize: "1.1rem" }}>{leg.flag}</span>
                  <span>{leg.country}</span>
                </button>
              );
            })}
          </div>

          {/* Grid Layout (Legislation helper + Edit Form) */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: "2rem", alignItems: "start" }}>
            
            {/* Left Column: Legislation Helper */}
            <div style={{
              background: "#fffbf5",
              border: "1px solid #fde68a",
              borderRadius: "14px",
              padding: "1.5rem",
              boxShadow: "0 4px 12px rgba(154, 79, 15, 0.04)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "1.5rem" }}>{LEGISLATIONS[selectedCountryConfig].flag}</span>
                <h4 style={{ margin: 0, fontSize: "1.1rem", color: "#9a4f0f", fontWeight: 700 }}>
                  Legislación: {LEGISLATIONS[selectedCountryConfig].country}
                </h4>
              </div>
              <p style={{ fontSize: "0.82rem", color: "var(--text-soft)", lineHeight: 1.5, marginBottom: "1.25rem" }}>
                {LEGISLATIONS[selectedCountryConfig].desc}
              </p>
              
              <ul style={{ paddingLeft: "1.2rem", margin: 0, display: "flex", flexDirection: "column", gap: "0.6rem", fontSize: "0.78rem", color: "#475569" }}>
                {LEGISLATIONS[selectedCountryConfig].points.map((pt, idx) => (
                  <li key={idx} style={{ lineHeight: 1.4 }}>{pt}</li>
                ))}
              </ul>
            </div>

            {/* Right Column: Edit Form */}
            <form onSubmit={handleSaveConfig} className="card" style={{ padding: "1.5rem", borderRadius: "14px", border: "1px solid #f4d4b6", background: "#fff", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <h4 style={{ margin: 0, paddingBottom: "0.5rem", borderBottom: "1px solid #f3f4f6", fontSize: "0.95rem", color: "var(--text-strong)" }}>
                Editar Parámetros - {selectedCountryConfig}
              </h4>

              <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                
                <div>
                  <label className="form-label">Límite Semanal (Horas)</label>
                  <input
                    type="number"
                    min={1}
                    max={48}
                    required
                    value={configLimit}
                    onChange={(e) => setConfigLimit(Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="form-label">Inicio Jornada Diurna (HH:mm)</label>
                  <input
                    type="time"
                    required
                    value={configDiurnalStart}
                    onChange={(e) => setConfigDiurnalStart(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Fin Jornada Diurna (HH:mm)</label>
                  <input
                    type="time"
                    required
                    value={configDiurnalEnd}
                    onChange={(e) => setConfigDiurnalEnd(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Multiplicador Diurno Regular</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    step={0.05}
                    required
                    value={configDiurnalMult}
                    onChange={(e) => setConfigDiurnalMult(Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="form-label">Multiplicador Nocturno Regular</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    step={0.05}
                    required
                    value={configNocturnalMult}
                    onChange={(e) => setConfigNocturnalMult(Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="form-label">Multiplicador Festivo Diurno</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    step={0.05}
                    required
                    value={configHolidayDiurnalMult}
                    onChange={(e) => setConfigHolidayDiurnalMult(Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="form-label">Multiplicador Festivo Nocturno</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    step={0.05}
                    required
                    value={configHolidayNocturnalMult}
                    onChange={(e) => setConfigHolidayNocturnalMult(Number(e.target.value))}
                  />
                </div>

              </div>

              <button
                type="submit"
                disabled={savingConfig}
                style={{
                  background: "linear-gradient(135deg, #ff9c2c, #9a4f0f)",
                  border: "none",
                  marginTop: "0.5rem",
                  alignSelf: "flex-end"
                }}
              >
                {savingConfig ? "Guardando..." : "Guardar Configuración"}
              </button>
            </form>

          </div>

        </div>
      )}

      {/* --- HOLIDAYS SUB-TAB (Official Calendar & Corporate Non-Working Days) --- */}
      {activeSubTab === "holidays" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* Header */}
          <div className="card glass-card" style={{ padding: "1.5rem", borderRadius: "14px", border: "1px solid #f4d4b6", background: "rgba(255, 255, 255, 0.55)" }}>
            <h3 style={{ margin: 0, fontSize: "1.15rem", color: "var(--text-strong)", fontFamily: "var(--display)" }}>
              📅 Gestión de Días No Laborables y Festivos
            </h3>
            <p style={{ color: "var(--text-soft)", fontSize: "0.82rem", marginTop: "0.25rem" }}>
              Visualiza los calendarios oficiales de festivos nacionales por país y registra los días festivos especiales de la empresa (feriados corporativos).
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: "2rem", alignItems: "start" }}>
            
            {/* Left Column: Official Holiday Calendar */}
            <div className="card" style={{ padding: "1.5rem", borderRadius: "14px", border: "1px solid #f4d4b6", background: "#fff" }}>
              <h4 style={{ margin: 0, paddingBottom: "0.5rem", borderBottom: "1px solid #f3f4f6", fontSize: "0.95rem", color: "var(--text-strong)" }}>
                🗓️ Calendario de Festivos Oficiales
              </h4>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "1rem", marginBottom: "1.25rem" }}>
                <div>
                  <label className="form-label" style={{ fontSize: "0.78rem" }}>País</label>
                  <select
                    value={calendarCountry}
                    onChange={(e) => setCalendarCountry(e.target.value)}
                    style={{ fontSize: "0.85rem", padding: "0.35rem 0.5rem" }}
                  >
                    <option value="Colombia">Colombia 🇨🇴</option>
                    <option value="Peru">Perú 🇵🇪</option>
                    <option value="Chile">Chile 🇨🇱</option>
                    <option value="Mexico">México 🇲🇽</option>
                    <option value="Ecuador">Ecuador 🇪🇨</option>
                    <option value="Default">USA / Default 🇺🇸</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: "0.78rem" }}>Año</label>
                  <input
                    type="number"
                    min={2020}
                    max={2030}
                    value={calendarYear}
                    onChange={(e) => setCalendarYear(Number(e.target.value))}
                    style={{ fontSize: "0.85rem", padding: "0.35rem 0.5rem" }}
                  />
                </div>
              </div>

              <div style={{ maxHeight: "350px", overflowY: "auto", border: "1px solid #f3f4f6", borderRadius: "8px", padding: "0.5rem" }}>
                {getOfficialHolidaysForYear(calendarYear, calendarCountry).map((h, index) => {
                  const [y, m, d] = h.date.split("-");
                  const dateObj = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
                  const formattedDate = dateObj.toLocaleDateString("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    timeZone: "UTC"
                  });
                  return (
                    <div
                      key={index}
                      style={{
                        padding: "0.5rem 0.75rem",
                        borderBottom: "1px solid #f3f4f6",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.78rem"
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "var(--text-strong)", textTransform: "capitalize" }}>
                        {formattedDate}
                      </span>
                      <span style={{ color: "#9a4f0f", background: "#fffbeb", padding: "0.15rem 0.4rem", borderRadius: "12px", fontSize: "0.72rem", border: "1px solid #fde68a" }}>
                        {h.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Custom Holiday Administration */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              
              {/* Form to Create Custom Holiday */}
              <form onSubmit={handleAddHoliday} className="card" style={{ padding: "1.5rem", borderRadius: "14px", border: "1px solid #f4d4b6", background: "#fff" }}>
                <h4 style={{ margin: 0, paddingBottom: "0.5rem", borderBottom: "1px solid #f3f4f6", fontSize: "0.95rem", color: "var(--text-strong)" }}>
                  ➕ Agregar Feriado Corporativo / Especial
                </h4>
                
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: "0.75rem", marginTop: "1rem", alignItems: "end" }}>
                  <div>
                    <label className="form-label" style={{ fontSize: "0.78rem" }}>Nombre del Evento *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Aniversario Synaptica"
                      value={holidayName}
                      onChange={(e) => setHolidayName(e.target.value)}
                      style={{ fontSize: "0.85rem", padding: "0.35rem 0.5rem" }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: "0.78rem" }}>Fecha *</label>
                    <input
                      type="date"
                      required
                      value={holidayDate}
                      onChange={(e) => setHolidayDate(e.target.value)}
                      style={{ fontSize: "0.85rem", padding: "0.35rem 0.5rem" }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: "0.78rem" }}>País / Alcance</label>
                    <select
                      value={holidayCountry}
                      onChange={(e) => setHolidayCountry(e.target.value)}
                      style={{ fontSize: "0.85rem", padding: "0.35rem 0.5rem" }}
                    >
                      <option value="All">Todos (Corporativo) 🌐</option>
                      <option value="Colombia">Colombia 🇨🇴</option>
                      <option value="Peru">Perú 🇵🇪</option>
                      <option value="Chile">Chile 🇨🇱</option>
                      <option value="Mexico">México 🇲🇽</option>
                      <option value="Ecuador">Ecuador 🇪🇨</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
                  <button
                    type="submit"
                    disabled={savingHoliday}
                    style={{
                      background: "linear-gradient(135deg, #ff9c2c, #9a4f0f)",
                      border: "none",
                      padding: "0.45rem 1rem",
                      fontSize: "0.8rem"
                    }}
                  >
                    {savingHoliday ? "Guardando..." : "Agregar Feriado"}
                  </button>
                </div>
              </form>

              {/* Table of Custom Holidays */}
              <div className="card" style={{ padding: "1.5rem", borderRadius: "14px", border: "1px solid #f4d4b6", background: "#fff" }}>
                <h4 style={{ margin: 0, paddingBottom: "0.5rem", borderBottom: "1px solid #f3f4f6", fontSize: "0.95rem", color: "var(--text-strong)" }}>
                  📋 Feriados Corporativos Registrados
                </h4>

                <div style={{ marginTop: "1rem" }} className="table-container">
                  {loadingHolidays ? (
                    <p style={{ textAlign: "center", color: "var(--text-soft)", fontSize: "0.8rem", padding: "1rem" }}>
                      Cargando feriados...
                    </p>
                  ) : customHolidays.length === 0 ? (
                    <p style={{ textAlign: "center", color: "var(--text-soft)", fontSize: "0.8rem", padding: "1.5rem" }}>
                      No hay feriados corporativos especiales registrados.
                    </p>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                          <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "var(--text-soft)", fontWeight: 600 }}>Nombre</th>
                          <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "var(--text-soft)", fontWeight: 600 }}>Fecha</th>
                          <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "var(--text-soft)", fontWeight: 600 }}>Alcance</th>
                          <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "var(--text-soft)", fontWeight: 600, textAlign: "right" }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customHolidays.map((h) => {
                          const dateObj = new Date(h.date);
                          const formattedDate = dateObj.toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            timeZone: "UTC"
                          });
                          return (
                            <tr key={h.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "var(--text-strong)", fontWeight: 600 }}>{h.name}</td>
                              <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "var(--text-normal)" }}>{formattedDate}</td>
                              <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "var(--text-normal)" }}>
                                {h.country === "All" ? "🌐 Todos" : (
                                  <span>
                                    {h.country === "Colombia" && "🇨🇴 "}
                                    {h.country === "Peru" && "🇵🇪 "}
                                    {h.country === "Chile" && "🇨🇱 "}
                                    {h.country === "Mexico" && "🇲🇽 "}
                                    {h.country === "Ecuador" && "🇪🇨 "}
                                    {h.country}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", textAlign: "right" }}>
                                <button
                                  type="button"
                                  className="ghost"
                                  onClick={() => handleDeleteHoliday(h.id)}
                                  style={{
                                    color: "#ef4444",
                                    padding: "0.25rem 0.5rem",
                                    fontSize: "0.75rem",
                                    border: "none",
                                    background: "none",
                                    cursor: "pointer"
                                  }}
                                >
                                  🗑️ Eliminar
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* --- DELEGATIONS SUB-TAB --- */}
      {activeSubTab === "delegations" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* Header */}
          <div className="card glass-card" style={{ padding: "1.5rem", borderRadius: "14px", border: "1px solid #f4d4b6", background: "rgba(255, 255, 255, 0.55)" }}>
            <h3 style={{ margin: 0, fontSize: "1.15rem", color: "var(--text-strong)", fontFamily: "var(--display)" }}>
              🤝 Delegación de Aprobaciones
            </h3>
            <p style={{ color: "var(--text-soft)", fontSize: "0.82rem", marginTop: "0.25rem" }}>
              Permite a los Directores de Proyecto (PM) delegar temporalmente la aprobación Nivel 1 a un consultor normal para un proyecto y rango de fechas específico.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: "2rem", alignItems: "start" }}>
            
            {/* Left Column: Create Delegation */}
            <form onSubmit={handleAddDelegation} className="card" style={{ padding: "1.5rem", borderRadius: "14px", border: "1px solid #f4d4b6", background: "#fff", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <h4 style={{ margin: 0, paddingBottom: "0.5rem", borderBottom: "1px solid #f3f4f6", fontSize: "0.95rem", color: "var(--text-strong)" }}>
                ➕ Registrar Nueva Delegación
              </h4>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                <div>
                  <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Proyecto *</label>
                  <select
                    value={delegateProjectId}
                    onChange={(e) => setDelegateProjectId(e.target.value)}
                    required
                  >
                    <option value="">-- Selecciona --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Delegar a (Consultor) *</label>
                  <select
                    value={delegateToEmail}
                    onChange={(e) => setDelegateToEmail(e.target.value)}
                    required
                  >
                    <option value="">-- Selecciona --</option>
                    {consultants
                      .filter(c => c.email && c.email.toLowerCase() !== authUser?.email?.toLowerCase())
                      .map((c) => (
                        <option key={c.id} value={c.email}>{c.fullName} ({c.email})</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Fecha Inicio *</label>
                  <input
                    type="date"
                    required
                    value={delegateStartDate}
                    onChange={(e) => setDelegateStartDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Fecha Fin *</label>
                  <input
                    type="date"
                    required
                    value={delegateEndDate}
                    onChange={(e) => setDelegateEndDate(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingDelegation}
                style={{
                  background: "linear-gradient(135deg, #ff9c2c, #9a4f0f)",
                  border: "none",
                  marginTop: "0.5rem",
                  width: "100%"
                }}
              >
                {savingDelegation ? "Guardando..." : "Delegar Aprobación"}
              </button>
            </form>

            {/* Right Column: Delegations List */}
            <div className="card" style={{ padding: "1.5rem", borderRadius: "14px", border: "1px solid #f4d4b6", background: "#fff" }}>
              <h4 style={{ margin: 0, paddingBottom: "0.5rem", borderBottom: "1px solid #f3f4f6", fontSize: "0.95rem", color: "var(--text-strong)" }}>
                📋 Delegaciones Activas y Registradas
              </h4>

              <div style={{ marginTop: "1rem" }} className="table-container">
                {loadingDelegations ? (
                  <p style={{ textAlign: "center", color: "var(--text-soft)", fontSize: "0.8rem", padding: "1rem" }}>
                    Cargando delegaciones...
                  </p>
                ) : delegations.length === 0 ? (
                  <p style={{ textAlign: "center", color: "var(--text-soft)", fontSize: "0.8rem", padding: "1.5rem" }}>
                    No hay delegaciones de aprobación registradas.
                  </p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                        <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "var(--text-soft)", fontWeight: 600 }}>Proyecto</th>
                        <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "var(--text-soft)", fontWeight: 600 }}>Delegado Por</th>
                        <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "var(--text-soft)", fontWeight: 600 }}>Delegado A</th>
                        <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "var(--text-soft)", fontWeight: 600 }}>Rango</th>
                        <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "var(--text-soft)", fontWeight: 600, textAlign: "right" }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {delegations.map((d) => {
                        const project = projects.find(p => p.id === d.projectId);
                        const startFormatted = new Date(d.startDate).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
                        const endFormatted = new Date(d.endDate).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
                        return (
                          <tr key={d.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "var(--text-strong)", fontWeight: 600 }}>{project ? project.name : d.projectId}</td>
                            <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "var(--text-normal)" }}>{d.fromUserEmail}</td>
                            <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "var(--text-normal)", fontWeight: 600 }}>{d.toUserEmail}</td>
                            <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "var(--text-soft)" }}>{startFormatted} al {endFormatted}</td>
                            <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem", textAlign: "right" }}>
                              <button
                                type="button"
                                className="ghost"
                                onClick={() => handleDeleteDelegation(d.id)}
                                style={{
                                  color: "#ef4444",
                                  padding: "0.25rem 0.5rem",
                                  fontSize: "0.75rem",
                                  border: "none",
                                  background: "none",
                                  cursor: "pointer"
                                }}
                              >
                                🗑️ Eliminar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
