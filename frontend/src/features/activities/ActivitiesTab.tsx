import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useMsal } from "@azure/msal-react";
import {
  listActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  createExtraHour,
  type Project,
  type Consultant,
  type AuthUser,
  type Activity,
  type ActivityType,
  type ActivityPriority,
  type ActivityStatus,
} from "../../services/api";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PageHeader } from "../../components/PageHeader";
import { SearchableSelect } from "../../components/SearchableSelect";
import { listCustomHolidays, type CustomHoliday } from "../../services/api";
import type { TabId } from "../../types";

type ActivitiesTabProps = {
  projects: Project[];
  consultants: Consultant[];
  authUser: AuthUser | null;
  onError: (msg: string) => void;
  onDrillTo?: (tabId: TabId) => void;
};

export function ActivitiesTab({ projects, consultants, authUser, onError, onDrillTo }: ActivitiesTabProps) {
  const [view, setView] = useState<"week" | "month" | "list">("week");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const myConsultant = consultants.find((c) => c.email?.toLowerCase() === authUser?.email?.toLowerCase());
  const [filterConsultantId, setFilterConsultantId] = useState(myConsultant?.id || "");
  const [filterProjectId, setFilterProjectId] = useState("");
  const [filterType, setFilterType] = useState<string>("");

  // Navigation states
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  // Date helper utilities
  const getDaysOfWeek = (baseDate: Date) => {
    const date = new Date(baseDate);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday is start
    const monday = new Date(date.setDate(diff));

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(monday);
      nextDay.setDate(monday.getDate() + i);
      weekDays.push(nextDay);
    }
    return weekDays;
  };

  const weekDays = useMemo(() => getDaysOfWeek(selectedDate), [selectedDate]);
  
  // Activity Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [teamsModalOpen, setTeamsModalOpen] = useState(false);

  // Activity Form Fields
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formConsultantId, setFormConsultantId] = useState(myConsultant?.id || "");
  const [formProjectId, setFormProjectId] = useState("");
  const [formType, setFormType] = useState<ActivityType>("project");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [formDueDate, setFormDueDate] = useState("");
  const [formEstimatedHours, setFormEstimatedHours] = useState("2");
  const [formActualHours, setFormActualHours] = useState("0");
  const [formStatus, setFormStatus] = useState<ActivityStatus>("pending");
  const [formPriority, setFormPriority] = useState<ActivityPriority>("medium");
  const [formComments, setFormComments] = useState("");

  // Extra Hours integration fields
  const [isExtraHoursEligible, setIsExtraHoursEligible] = useState(false);
  const [applyForExtraHours, setApplyForExtraHours] = useState(false);
  const [extraHoursStartTime, setExtraHoursStartTime] = useState("18:00");
  const [extraHoursEndTime, setExtraHoursEndTime] = useState("20:00");
  const [extraHoursNote, setExtraHoursNote] = useState("");

  // Teams synchronization states
  const [syncEvents, setSyncEvents] = useState<any[]>([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncSelectedIds, setSyncSelectedIds] = useState<string[]>([]);
  const [syncProjectId, setSyncProjectId] = useState("");
  const [syncingInProgress, setSyncingInProgress] = useState(false);

  const { instance, accounts } = useMsal();

  const loadTeamsEvents = useCallback(async () => {
    setSyncLoading(true);
    setSyncSelectedIds([]);
    try {
      const startISO = weekDays[0].toISOString();
      const endISO = weekDays[6].toISOString();

      let fetchedEvents: any[] = [];
      let isRealMsal = false;

      // Try calling MS Graph if authenticated and scopes available
      if (accounts.length > 0) {
        try {
          const tokenResponse = await instance.acquireTokenSilent({
            scopes: ["Calendars.Read"],
            account: accounts[0]
          });
          const token = tokenResponse.accessToken;
          
          const response = await fetch(
            `https://graph.microsoft.com/v1.0/me/calendar/events?$orderby=start/dateTime&$filter=start/dateTime ge '${startISO}' and end/dateTime le '${endISO}'&$select=id,subject,start,end,bodyPreview`,
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );
          if (response.ok) {
            const data = await response.json();
            fetchedEvents = (data.value || []).map((ev: any) => {
              const start = new Date(ev.start.dateTime);
              const end = new Date(ev.end.dateTime);
              const duration = Math.max(0.5, Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 2) / 2);
              return {
                id: ev.id,
                subject: ev.subject,
                start: ev.start.dateTime,
                end: ev.end.dateTime,
                bodyPreview: ev.bodyPreview || "",
                duration
              };
            });
            isRealMsal = true;
          }
        } catch (err) {
          console.warn("MSAL Silent Token acquisition for Graph failed, using mock data.", err);
        }
      }

      if (!isRealMsal) {
        // Fallback to high-fidelity mock events
        const mockMeetings = [
          {
            id: "mock-1",
            subject: "Daily Standup - Synaptica",
            start: new Date(weekDays[0].getTime()).toISOString().replace(/T.*/, "T09:00:00.000Z"),
            end: new Date(weekDays[0].getTime()).toISOString().replace(/T.*/, "T09:30:00.000Z"),
            bodyPreview: "Sincronización diaria del equipo de desarrollo y revisión de tableros.",
            duration: 0.5
          },
          {
            id: "mock-2",
            subject: "Diseño de Arquitectura ERP",
            start: new Date(weekDays[0].getTime()).toISOString().replace(/T.*/, "T14:00:00.000Z"),
            end: new Date(weekDays[0].getTime()).toISOString().replace(/T.*/, "T15:30:00.000Z"),
            bodyPreview: "Discusión sobre el modelo de datos, diagrama entidad-relación y flujo de caja.",
            duration: 1.5
          },
          {
            id: "mock-3",
            subject: "Demo de Avance Sprint 3",
            start: new Date(weekDays[1].getTime()).toISOString().replace(/T.*/, "T10:00:00.000Z"),
            end: new Date(weekDays[1].getTime()).toISOString().replace(/T.*/, "T11:00:00.000Z"),
            bodyPreview: "Presentación de los entregables a los stakeholders y feedback inicial.",
            duration: 1.0
          },
          {
            id: "mock-4",
            subject: "Reunión Técnica con Cliente",
            start: new Date(weekDays[2].getTime()).toISOString().replace(/T.*/, "T15:00:00.000Z"),
            end: new Date(weekDays[2].getTime()).toISOString().replace(/T.*/, "T16:30:00.000Z"),
            bodyPreview: "Resolver dudas sobre la integración con Microsoft Entra ID y seguridad de base de datos.",
            duration: 1.5
          },
          {
            id: "mock-5",
            subject: "Capacitación: Seguridad en la Nube",
            start: new Date(weekDays[3].getTime()).toISOString().replace(/T.*/, "T11:00:00.000Z"),
            end: new Date(weekDays[3].getTime()).toISOString().replace(/T.*/, "T12:00:00.000Z"),
            bodyPreview: "Buenas prácticas en IAM, rotación de secretos y configuración de VPC.",
            duration: 1.0
          },
          {
            id: "mock-6",
            subject: "Sprint Planning & Retrospective",
            start: new Date(weekDays[4].getTime()).toISOString().replace(/T.*/, "T14:00:00.000Z"),
            end: new Date(weekDays[4].getTime()).toISOString().replace(/T.*/, "T16:00:00.000Z"),
            bodyPreview: "Planificación de las metas del próximo Sprint y lecciones aprendidas.",
            duration: 2.0
          }
        ];
        fetchedEvents = mockMeetings;
      }

      // Check if any event has already been imported
      const enrichedEvents = fetchedEvents.map(ev => {
        const isImported = activities.some(act => 
          act.title.toLowerCase() === ev.subject.toLowerCase() && 
          act.scheduledDate.slice(0, 10) === ev.start.slice(0, 10)
        );
        return { ...ev, isImported };
      });

      setSyncEvents(enrichedEvents);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al cargar reuniones de Teams");
    } finally {
      setSyncLoading(false);
    }
  }, [weekDays, activities, accounts, instance, onError]);

  useEffect(() => {
    if (teamsModalOpen) {
      void loadTeamsEvents();
    }
  }, [teamsModalOpen, loadTeamsEvents]);

  const handleImportMeetings = async () => {
    if (syncSelectedIds.length === 0) {
      onError("Por favor selecciona al menos una reunión.");
      return;
    }
    const consultantId = filterConsultantId || myConsultant?.id || consultants[0]?.id;
    if (!consultantId) {
      onError("No hay un consultor activo para asignar estas reuniones.");
      return;
    }

    setSyncingInProgress(true);
    try {
      const selectedEvents = syncEvents.filter(ev => syncSelectedIds.includes(ev.id));
      for (const ev of selectedEvents) {
        await createActivity({
          title: ev.subject,
          description: ev.bodyPreview ? ev.bodyPreview.slice(0, 200) : "Importado desde Microsoft Teams",
          consultantId,
          projectId: syncProjectId || null,
          activityType: "meeting",
          scheduledDate: new Date(ev.start).toISOString(),
          dueDate: new Date(ev.end).toISOString(),
          estimatedHours: ev.duration,
          actualHours: ev.duration,
          status: "completed",
          priority: "medium",
          comments: "Importado automáticamente de Teams"
        });
      }
      
      setTeamsModalOpen(false);
      await loadActivities();
      setSuccessMessage(`¡Se importaron ${selectedEvents.length} reuniones como actividades exitosamente!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al importar reuniones");
    } finally {
      setSyncingInProgress(false);
    }
  };

  const formatMeetingTime = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const weekday = start.toLocaleDateString("es-CO", { weekday: "short" });
    const day = start.getDate();
    const month = start.toLocaleDateString("es-CO", { month: "short" });
    const startTimeStr = start.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });
    const endTimeStr = end.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${weekday} ${day} de ${month}, ${startTimeStr} - ${endTimeStr}`;
  };

  // Loading/submitting states
  const [submitting, setSubmitting] = useState(false);
  const [holidays, setHolidays] = useState<CustomHoliday[]>([]);

  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const data = await listCustomHolidays();
        setHolidays(data);
      } catch (err) {
        // fail silently
      }
    };
    void fetchHolidays();
  }, []);

  // Helper to check if a YYYY-MM-DD date string is a weekend or holiday
  const checkIsWeekendOrHoliday = useCallback((dateStr: string) => {
    if (!dateStr) return { isWeekend: false, isHoliday: false, isWeekendOrHoliday: false, label: "" };
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Match date part only
    const isHoliday = holidays.some((h) => h.date.slice(0, 10) === dateStr);
    const holidayName = holidays.find((h) => h.date.slice(0, 10) === dateStr)?.name || "";
    
    return {
      isWeekend,
      isHoliday,
      isWeekendOrHoliday: isWeekend || isHoliday,
      label: isWeekend ? (dayOfWeek === 0 ? "Domingo" : "Sábado") : (isHoliday ? `Festivo: ${holidayName}` : "")
    };
  }, [holidays]);

  // Success message and confirmation states
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<string | null>(null);

  // Fetch activities
  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listActivities({
        consultantId: filterConsultantId || undefined,
        projectId: filterProjectId || undefined,
      });
      setActivities(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al cargar actividades");
    } finally {
      setLoading(false);
    }
  }, [filterConsultantId, filterProjectId, onError]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  // Set default consultant if loaded
  useEffect(() => {
    if (myConsultant && !filterConsultantId) {
      setFilterConsultantId(myConsultant.id);
    }
    if (myConsultant && !formConsultantId) {
      setFormConsultantId(myConsultant.id);
    }
  }, [consultants, myConsultant, filterConsultantId, formConsultantId]);

  // Date helper utilities (moved above)

  // Change selected week
  const navigateWeek = (weeks: number) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + weeks * 7);
      return next;
    });
  };

  // Change selected month
  const navigateMonth = (months: number) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + months);
      return next;
    });
  };

  // Group activities by date key YYYY-MM-DD
  const activitiesByDate = useMemo(() => {
    const map = new Map<string, Activity[]>();
    activities.forEach((act) => {
      const dateKey = act.scheduledDate.slice(0, 10);
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(act);
    });
    return map;
  }, [activities]);

  // Handle open modal for creation
  const handleOpenAddModal = (dateStr?: string) => {
    setEditingActivity(null);
    setFormTitle("");
    setFormDescription("");
    setFormConsultantId(myConsultant?.id || filterConsultantId || consultants[0]?.id || "");
    setFormProjectId("");
    setFormType("project");
    setFormDate(dateStr || new Date().toISOString().split("T")[0]);
    setFormDueDate("");
    setFormEstimatedHours("2");
    setFormActualHours("0");
    setFormStatus("pending");
    setFormPriority("medium");
    setFormComments("");
    setIsExtraHoursEligible(false);
    setApplyForExtraHours(false);
    setExtraHoursNote("");
    setModalOpen(true);
  };

  // Handle open modal for edit
  const handleOpenEditModal = (act: Activity) => {
    setEditingActivity(act);
    setFormTitle(act.title);
    setFormDescription(act.description || "");
    setFormConsultantId(act.consultantId);
    setFormProjectId(act.projectId || "");
    setFormType(act.activityType);
    setFormDate(act.scheduledDate.slice(0, 10));
    setFormDueDate(act.dueDate ? act.dueDate.slice(0, 10) : "");
    setFormEstimatedHours(Number(act.estimatedHours).toString());
    setFormActualHours(Number(act.actualHours).toString());
    setFormStatus(act.status);
    setFormPriority(act.priority);
    setFormComments(act.comments || "");
    setIsExtraHoursEligible(false);
    setApplyForExtraHours(false);
    setExtraHoursNote("");
    setModalOpen(true);
  };

  // Extra hours eligibility live check
  useEffect(() => {
    const actual = Number(formActualHours || 0);
    const dateObj = new Date(formDate);
    // Date standard getDay() returns 0 for Sunday, 6 for Saturday.
    const isSatOrSun = dateObj.getUTCDay() === 0 || dateObj.getUTCDay() === 6;
    
    // Check if eligible: actual > 8 OR weekend OR is training/support that might apply
    if (actual > 8 || isSatOrSun) {
      setIsExtraHoursEligible(true);
      // Pre-fill extra hours note
      setExtraHoursNote(`Horas extras automáticas de la actividad: ${formTitle || "Registro de actividad"}`);
      // Calculate default end time based on actual hours (e.g. 18:00 to 18:00 + actualHours - 8)
      if (actual > 8) {
        const extraHours = actual - 8;
        setExtraHoursStartTime("18:00");
        const endHour = 18 + extraHours;
        setExtraHoursEndTime(`${endHour.toString().padStart(2, "0")}:00`);
      } else {
        setExtraHoursStartTime("08:00");
        const endHour = 8 + actual;
        setExtraHoursEndTime(`${endHour.toString().padStart(2, "0")}:00`);
      }
    } else {
      setIsExtraHoursEligible(false);
      setApplyForExtraHours(false);
    }
  }, [formActualHours, formDate, formTitle]);

  // Handle submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      onError("Por favor ingresa un título.");
      return;
    }
    if (!formConsultantId) {
      onError("Por favor selecciona un consultor.");
      return;
    }

    // Weekend and Holiday validation
    const dateCheck = checkIsWeekendOrHoliday(formDate);
    const selectedConsultant = consultants.find((c) => c.id === formConsultantId);
    if (dateCheck.isWeekendOrHoliday) {
      const isAdminOrPM = authUser?.roles.includes("ADMIN") || authUser?.roles.includes("PM");
      const hasWeekendPermission = selectedConsultant?.allowWeekendWork === true || isAdminOrPM;
      
      if (!hasWeekendPermission) {
        onError(`El consultor ${selectedConsultant?.fullName || ""} no está autorizado para registrar actividades en fines de semana o festivos (${dateCheck.label}).`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        consultantId: formConsultantId,
        projectId: formProjectId || null,
        activityType: formType,
        scheduledDate: new Date(formDate).toISOString(),
        dueDate: formDueDate ? new Date(formDueDate).toISOString() : null,
        completedDate: formStatus === "completed" ? new Date().toISOString() : null,
        estimatedHours: Number(formEstimatedHours),
        actualHours: Number(formActualHours),
        status: formStatus,
        priority: formPriority,
        comments: formComments.trim() || null,
      };

      if (editingActivity) {
        await updateActivity(editingActivity.id, payload);
      } else {
        await createActivity(payload);
      }

      // If user opted to submit extra hours automatically
      if (applyForExtraHours && formProjectId) {
        // Validate project allows extra hours
        const selectedProj = projects.find((p) => p.id === formProjectId);
        if (selectedProj && selectedProj.allowExtraHours !== false) {
          await createExtraHour({
            projectId: formProjectId,
            consultantId: formConsultantId,
            date: formDate,
            startTime: extraHoursStartTime,
            endTime: extraHoursEndTime,
            observations: extraHoursNote.trim() || undefined
          });
        }
      }

      setModalOpen(false);
      await loadActivities();
      setSuccessMessage(applyForExtraHours 
        ? "¡Actividad y solicitud de horas extras registradas con éxito!" 
        : "Actividad guardada con éxito."
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al guardar actividad");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete activity click
  const handleDeleteClick = (id: string) => {
    setActivityToDelete(id);
    setDeleteConfirmOpen(true);
  };

  // Handle confirm delete
  const handleConfirmDelete = async () => {
    if (!activityToDelete) return;
    try {
      await deleteActivity(activityToDelete);
      setSuccessMessage("Actividad eliminada con éxito.");
      setTimeout(() => setSuccessMessage(null), 4000);
      await loadActivities();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al eliminar actividad");
    } finally {
      setDeleteConfirmOpen(false);
      setActivityToDelete(null);
    }
  };

  // Monthly calendar days rendering helper
  const monthDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    // Adjust for Monday as 1st day of week:
    // Sunday (0) -> index 6
    // Monday (1) -> index 0, Tuesday (2) -> index 1 etc.
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    
    const lastDay = new Date(year, month + 1, 0).getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days = [];
    
    // Previous month padding days
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({ date: d, currentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= lastDay; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, currentMonth: true });
    }

    // Next month padding days to make it multiples of 7 (full week rows)
    const remaining = 42 - days.length; // standard 6 rows of 7 days
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, currentMonth: false });
    }

    return days;
  }, [selectedDate]);

  const monthLabel = selectedDate.toLocaleString("es-CO", { month: "long", year: "numeric" });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent": return { label: "Urgente", bg: "#fecaca", color: "#b91c1c" };
      case "high": return { label: "Alta", bg: "#fef3c7", color: "#d97706" };
      case "medium": return { label: "Media", bg: "#dbeafe", color: "#2563eb" };
      case "low": return { label: "Baja", bg: "#f3f4f6", color: "#374151" };
      default: return { label: priority, bg: "#e5e7eb", color: "#1f2937" };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed": return { label: "Completado", bg: "#dcfce7", color: "#15803d" };
      case "in_progress": return { label: "En Progreso", bg: "#dbeafe", color: "#1d4ed8" };
      case "pending": return { label: "Pendiente", bg: "#fef3c7", color: "#b45309" };
      case "blocked": return { label: "Bloqueado", bg: "#fee2e2", color: "#b91c1c" };
      case "cancelled": return { label: "Cancelado", bg: "#f3f4f6", color: "#4b5563" };
      default: return { label: status, bg: "#f3f4f6", color: "#374151" };
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "project": return "💻 Proyecto";
      case "personal": return "👤 Personal";
      case "meeting": return "🤝 Reunión";
      case "training": return "📚 Capacitación";
      case "support": return "🔧 Soporte";
      default: return "📝 Otros";
    }
  };

  // Filter list activities in frontend too for search filters
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      if (filterType && act.activityType !== filterType) return false;
      return true;
    });
  }, [activities, filterType]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", padding: "1rem 2rem" }}>
      
      <PageHeader
        icon="▤"
        title="Registro de Actividades"
        description="Realiza el tracking de tus actividades del día o semana, con alertas integradas de horas extras."
        actions={
          <>
            {/* View Toggle */}
            <div style={{ display: "flex", background: "#f3f4f6", padding: "0.2rem", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <button
                type="button"
                className={view === "week" ? "" : "ghost"}
                onClick={() => setView("week")}
                style={{ fontSize: "0.82rem", padding: "0.3rem 0.6rem", border: "none" }}
              >
                Semana
              </button>
              <button
                type="button"
                className={view === "month" ? "" : "ghost"}
                onClick={() => setView("month")}
                style={{ fontSize: "0.82rem", padding: "0.3rem 0.6rem", border: "none" }}
              >
                Mes
              </button>
              <button
                type="button"
                className={view === "list" ? "" : "ghost"}
                onClick={() => setView("list")}
                style={{ fontSize: "0.82rem", padding: "0.3rem 0.6rem", border: "none" }}
              >
                Lista
              </button>
            </div>

            <button
              type="button"
              onClick={() => onDrillTo && onDrillTo("extraHours")}
              style={{
                background: "#fef3c7",
                color: "#d97706",
                border: "1px solid #fcd34d",
                fontSize: "0.85rem",
                padding: "0.5rem 1rem",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem"
              }}
            >
              ⏳ Solicitar Horas Extra
            </button>

            <button
              type="button"
              onClick={() => setTeamsModalOpen(true)}
              style={{
                background: "#e0e7ff",
                color: "#4f46e5",
                border: "1px solid #c7d2fe",
                fontSize: "0.85rem",
                padding: "0.5rem 1rem",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem"
              }}
            >
              👥 Sincronizar Teams
            </button>

            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              style={{
                background: "linear-gradient(135deg, #ff9c2c, #9a4f0f)",
                color: "#fff",
                border: "none",
                fontSize: "0.85rem",
                padding: "0.5rem 1rem",
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(154, 79, 15, 0.2)",
                cursor: "pointer"
              }}
            >
              ➕ Registrar Actividad
            </button>
          </>
        }
      />

      {/* Global Filters Panel */}
      <div className="card glass-card" style={{ position: "relative", zIndex: 20, padding: "1rem", borderRadius: "12px", border: "1px solid #f4d4b6", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        {(authUser?.roles.includes("ADMIN") || authUser?.roles.includes("PM") || authUser?.roles.includes("FINANCE")) ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "220px" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-soft)" }}>Filtrar por Consultor</label>
            <SearchableSelect
              options={consultants.map((c) => ({ value: c.id, label: c.fullName }))}
              value={filterConsultantId}
              onChange={(val) => setFilterConsultantId(val)}
              placeholder="Buscar consultor..."
              emptyLabel="-- Todos los Consultores --"
            />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "180px" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-soft)" }}>Consultor</label>
            <input
              type="text"
              readOnly
              value={myConsultant ? myConsultant.fullName : authUser?.displayName || ""}
              style={{ padding: "0.6rem 0.75rem", borderRadius: "10px", background: "#f3f4f6", border: "1px solid #d1d5db", fontSize: "0.88rem" }}
            />
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "220px" }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-soft)" }}>Filtrar por Proyecto</label>
          <SearchableSelect
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            value={filterProjectId}
            onChange={(val) => setFilterProjectId(val)}
            placeholder="Buscar proyecto..."
            emptyLabel="-- Todos los Proyectos --"
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "150px" }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-soft)" }}>Tipo Actividad</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ padding: "0.4rem", borderRadius: "6px" }}
          >
            <option value="">-- Todos --</option>
            <option value="project">Proyecto</option>
            <option value="personal">Personal</option>
            <option value="meeting">Reunión</option>
            <option value="training">Capacitación</option>
            <option value="support">Soporte</option>
            <option value="other">Otros</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => { setFilterProjectId(""); setFilterType(""); setFilterConsultantId(myConsultant?.id || ""); setSelectedDate(new Date()); }}
          className="ghost"
          style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem" }}
        >
          Limpiar filtros
        </button>
      </div>

      {/* --- WEEK CALENDAR VIEW --- */}
      {view === "week" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          
          {/* Week Selector Controls */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fdf8f5", padding: "0.75rem 1rem", borderRadius: "10px", border: "1px solid #f4d4b6" }}>
            <button type="button" className="ghost" onClick={() => navigateWeek(-1)} style={{ padding: "0.3rem 0.6rem" }}>◀ Semana anterior</button>
            <strong style={{ fontSize: "1rem", color: "var(--text-strong)" }}>
              Semana del {weekDays[0].toLocaleDateString("es-CO", { day: "numeric", month: "short" })} al {weekDays[6].toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
            </strong>
            <button type="button" className="ghost" onClick={() => navigateWeek(1)} style={{ padding: "0.3rem 0.6rem" }}>Semana siguiente ▶</button>
          </div>

          {loading ? (
            <p className="loading">Cargando actividades...</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1rem", overflowX: "auto", minWidth: "900px", alignItems: "start" }}>
              {weekDays.map((day) => {
                const dateKey = day.toISOString().slice(0, 10);
                const dayCheck = checkIsWeekendOrHoliday(dateKey);
                const isWeekendOrHoli = dayCheck.isWeekendOrHoliday;
                const activeConsultantId = filterConsultantId || myConsultant?.id || "";
                const activeConsultant = consultants.find((c) => c.id === activeConsultantId);
                const isAdminOrPM = authUser?.roles.includes("ADMIN") || authUser?.roles.includes("PM");
                const isDayBlocked = isWeekendOrHoli && !(activeConsultant?.allowWeekendWork || isAdminOrPM);

                const dayActivities = activitiesByDate.get(dateKey) || [];
                const totalActualHours = dayActivities.reduce((sum, a) => sum + Number(a.actualHours), 0);
                const isOvertime = totalActualHours > 8 || isWeekendOrHoli;

                return (
                  <div
                    key={dateKey}
                    style={{
                      background: isDayBlocked ? "#f9fafb" : "#fff",
                      border: isDayBlocked ? "1px dashed #d1d5db" : "1px solid #e5e7eb",
                      borderRadius: "12px",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
                      display: "flex",
                      flexDirection: "column",
                      minHeight: "350px",
                      padding: "0.75rem",
                      opacity: isDayBlocked ? 0.75 : 1,
                      position: "relative"
                    }}
                  >
                    {/* Day Header */}
                    <div style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: "0.5rem", marginBottom: "0.75rem", textAlign: "center" }}>
                      <span style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-soft)" }}>
                        {day.toLocaleString("es-CO", { weekday: "short" })}
                      </span>
                      <strong style={{ display: "block", fontSize: "1.3rem", color: "var(--text-strong)" }}>
                        {day.getDate()}
                      </strong>
                      
                      {/* Day Stats */}
                      <div style={{ marginTop: "0.3rem", display: "flex", justifyContent: "center", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.7rem", padding: "0.1rem 0.3rem", borderRadius: "4px", background: "#f3f4f6" }}>
                          ⏱️ {totalActualHours}h
                        </span>
                        {isOvertime && totalActualHours > 0 && (
                          <span
                            title={dayCheck.isHoliday ? `Festivo: ${dayCheck.label}` : "Supera las 8h o es fin de semana. Aplica a horas extra."}
                            style={{ cursor: "help", fontSize: "0.7rem", padding: "0.1rem 0.3rem", borderRadius: "4px", background: "#fef3c7", color: "#d97706", fontWeight: 700 }}
                          >
                            ⚠️ HE
                          </span>
                        )}
                        {dayCheck.isHoliday && (
                          <span
                            title={dayCheck.label}
                            style={{ cursor: "help", fontSize: "0.7rem", padding: "0.1rem 0.3rem", borderRadius: "4px", background: "#fee2e2", color: "#b91c1c", fontWeight: 700 }}
                          >
                            🎉 Festivo
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Day Activities List */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flexGrow: 1, overflowY: "auto", maxHeight: "250px" }}>
                      {dayActivities.length === 0 ? (
                        <span style={{ color: "#9ca3af", fontStyle: "italic", fontSize: "0.72rem", textAlign: "center", marginTop: "2rem", display: "block" }}>
                          Sin actividades
                        </span>
                      ) : (
                        dayActivities.map((act) => {
                          const prio = getPriorityBadge(act.priority);
                          return (
                            <div
                              key={act.id}
                              onClick={() => handleOpenEditModal(act)}
                              style={{
                                background: act.activityType === "personal" ? "#faf5ff" : "#fffbeb",
                                border: `1px solid ${act.activityType === "personal" ? "#e9d5ff" : "#fde68a"}`,
                                borderRadius: "8px",
                                padding: "0.5rem",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                position: "relative"
                              }}
                              className="activity-card"
                            >
                              <strong style={{ display: "block", fontSize: "0.75rem", color: "var(--text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {act.title}
                              </strong>
                              <span style={{ fontSize: "0.68rem", color: "var(--text-soft)" }}>
                                {act.project?.name || getTypeLabel(act.activityType)}
                              </span>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.3rem" }}>
                                <span style={{ fontSize: "0.65rem", padding: "0.05rem 0.25rem", borderRadius: "3px", background: prio.bg, color: prio.color }}>
                                  {prio.label}
                                </span>
                                <span style={{ fontSize: "0.7rem", fontWeight: 700 }}>
                                  {Number(act.actualHours).toFixed(1)}h
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Add Activity Button per Day */}
                    {isDayBlocked ? (
                      <div style={{
                        width: "100%",
                        padding: "0.4rem 0.25rem",
                        fontSize: "0.72rem",
                        marginTop: "0.5rem",
                        textAlign: "center",
                        color: "#ef4444",
                        background: "#fee2e2",
                        border: "1px solid #fca5a5",
                        borderRadius: "6px",
                        fontWeight: 600
                      }}>
                        🔒 Bloqueado
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => handleOpenAddModal(dateKey)}
                        style={{ width: "100%", padding: "0.25rem", fontSize: "0.72rem", marginTop: "0.5rem", borderColor: "#e5e7eb" }}
                      >
                        + Registrar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- MONTH SUMMARY CALENDAR VIEW --- */}
      {view === "month" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          
          {/* Month Navigator */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fdf8f5", padding: "0.75rem 1rem", borderRadius: "10px", border: "1px solid #f4d4b6" }}>
            <button type="button" className="ghost" onClick={() => navigateMonth(-1)} style={{ padding: "0.3rem 0.6rem" }}>◀ Mes anterior</button>
            <strong style={{ fontSize: "1rem", color: "var(--text-strong)", textTransform: "capitalize" }}>
              {monthLabel}
            </strong>
            <button type="button" className="ghost" onClick={() => navigateMonth(1)} style={{ padding: "0.3rem 0.6rem" }}>Mes siguiente ▶</button>
          </div>

          {loading ? (
            <p className="loading">Cargando...</p>
          ) : (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden", background: "#fff" }}>
              {/* Day header names */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", textAlign: "center", padding: "0.5rem 0" }}>
                {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((dayName) => (
                  <span key={dayName} style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-soft)" }}>
                    {dayName}
                  </span>
                ))}
              </div>

              {/* Grid of days */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridAutoRows: "100px" }}>
                {monthDays.map(({ date, currentMonth }, idx) => {
                  const dateKey = date.toISOString().slice(0, 10);
                  const dayCheck = checkIsWeekendOrHoliday(dateKey);
                  const activeConsultantId = filterConsultantId || myConsultant?.id || "";
                  const activeConsultant = consultants.find((c) => c.id === activeConsultantId);
                  const isAdminOrPM = authUser?.roles.includes("ADMIN") || authUser?.roles.includes("PM");
                  const isDayBlocked = dayCheck.isWeekendOrHoliday && !(activeConsultant?.allowWeekendWork || isAdminOrPM);

                  const dayActivities = activitiesByDate.get(dateKey) || [];
                  const totalEst = dayActivities.reduce((sum, a) => sum + Number(a.estimatedHours), 0);
                  const totalAct = dayActivities.reduce((sum, a) => sum + Number(a.actualHours), 0);

                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const isHighWork = totalAct > 8;

                  return (
                    <div
                      key={`${dateKey}-${idx}`}
                      onClick={() => {
                        setSelectedDate(date);
                        setView("week");
                      }}
                      style={{
                        borderRight: "1px solid #e5e7eb",
                        borderBottom: "1px solid #e5e7eb",
                        padding: "0.4rem",
                        cursor: "pointer",
                        background: isDayBlocked 
                          ? "#fdf2f2" 
                          : !currentMonth 
                            ? "#f9fafb" 
                            : isWeekend 
                              ? "#fffcf9" 
                              : "#fff",
                        opacity: currentMonth ? 1 : 0.4,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        transition: "all 0.15s ease",
                      }}
                      className="month-day-cell"
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <span style={{
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            color: isHighWork ? "#d97706" : "var(--text-strong)",
                            background: isHighWork ? "#fef3c7" : "transparent",
                            padding: isHighWork ? "0.1rem 0.25rem" : 0,
                            borderRadius: "4px"
                          }}>
                            {date.getDate()}
                          </span>
                          {isDayBlocked && (
                            <span style={{ fontSize: "0.7rem", color: "#ef4444" }} title={dayCheck.label}>🔒</span>
                          )}
                          {dayCheck.isHoliday && !isDayBlocked && (
                            <span style={{ fontSize: "0.7rem", color: "#b91c1c" }} title={dayCheck.label}>🎉</span>
                          )}
                        </div>
                        
                        {dayActivities.length > 0 && (
                          <span style={{ fontSize: "0.65rem", padding: "0.05rem 0.2rem", background: "#f3f4f6", borderRadius: "3px", color: "var(--text-soft)" }}>
                            {dayActivities.length} {dayActivities.length === 1 ? "act" : "acts"}
                          </span>
                        )}
                      </div>

                      {totalAct > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", fontSize: "0.68rem", textAlign: "right" }}>
                          <span style={{ color: "var(--text-soft)" }}>Est: {totalEst}h</span>
                          <strong style={{ color: isHighWork ? "#b45309" : "#16a34a" }}>
                            Real: {totalAct}h {isHighWork && "⚠️"}
                          </strong>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- LIST TABLE VIEW --- */}
      {view === "list" && (
        <div className="card" style={{ padding: "1.5rem", borderRadius: "14px", border: "1px solid #f4d4b6", background: "#fff" }}>
          <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.05rem", color: "var(--text-strong)", fontFamily: "var(--display)" }}>
            Listado de Actividades Registradas
          </h3>

          {loading ? (
            <p className="loading">Cargando...</p>
          ) : filteredActivities.length === 0 ? (
            <p style={{ fontStyle: "italic", color: "var(--text-soft)", fontSize: "0.85rem" }}>No se encontraron registros con los filtros activos.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Título</th>
                    <th>Tipo</th>
                    <th>Proyecto</th>
                    <th>Consultor</th>
                    <th>Horas</th>
                    <th>Estado</th>
                    <th>Prioridad</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivities.map((act) => {
                    const status = getStatusLabel(act.status);
                    const prio = getPriorityBadge(act.priority);
                    const isOwn = act.consultantId === myConsultant?.id || authUser?.roles.includes("ADMIN");

                    return (
                      <tr key={act.id} style={{ cursor: "pointer" }} onClick={() => handleOpenEditModal(act)}>
                        <td>{act.scheduledDate.slice(0, 10)}</td>
                        <td>
                          <strong>{act.title}</strong>
                          {act.description && (
                            <span style={{ display: "block", fontSize: "0.7rem", color: "#6b7280", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {act.description}
                            </span>
                          )}
                        </td>
                        <td>{getTypeLabel(act.activityType)}</td>
                        <td>{act.project?.name || <span style={{ color: "#aaa" }}>—</span>}</td>
                        <td>{act.consultant?.fullName}</td>
                        <td>
                          <div style={{ fontSize: "0.8rem" }}>
                            Est: <strong>{Number(act.estimatedHours).toFixed(1)}h</strong>
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "#16a34a" }}>
                            Real: <strong>{Number(act.actualHours).toFixed(1)}h</strong>
                          </div>
                        </td>
                        <td>
                          <span className="pill" style={{ background: status.bg, color: status.color, fontSize: "0.7rem", padding: "0.15rem 0.45rem", fontWeight: 700 }}>
                            {status.label}
                          </span>
                        </td>
                        <td>
                          <span className="pill" style={{ background: prio.bg, color: prio.color, fontSize: "0.7rem", padding: "0.15rem 0.45rem", fontWeight: 700 }}>
                            {prio.label}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "0.4rem" }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => handleOpenEditModal(act)}
                              style={{ padding: "0.2rem 0.4rem", fontSize: "0.75rem" }}
                            >
                              Editar
                            </button>
                            {isOwn && (
                              <button
                                type="button"
                                onClick={() => handleDeleteClick(act.id)}
                                style={{ padding: "0.2rem 0.4rem", fontSize: "0.75rem", background: "#ef4444", color: "#fff", border: "none" }}
                              >
                                🗑
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- CREATE / EDIT MODAL --- */}
      {modalOpen && (
        <div className="modal-overlay" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <form onSubmit={handleSubmit} className="modal-card" style={{ maxWidth: "600px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="modal-header">
              <h3>{editingActivity ? "✍️ Editar Actividad" : "➕ Registrar Nueva Actividad"}</h3>
              <button type="button" className="ghost" onClick={() => setModalOpen(false)} style={{ padding: "0.25rem 0.5rem" }}>✕</button>
            </div>

            <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem", padding: "0.5rem 0" }}>
              
              <div style={{ gridColumn: "span 2" }}>
                <label className="form-label">Título de la Actividad *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Diseño de base de datos, Reunión con cliente..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              <div style={{ gridColumn: "span 2" }}>
                <label className="form-label">Descripción</label>
                <textarea
                  rows={2}
                  placeholder="Detalles adicionales del trabajo realizado..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Tipo de Actividad *</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value as ActivityType)} required>
                  <option value="project">Proyecto</option>
                  <option value="personal">Personal / Bench</option>
                  <option value="meeting">Reunión</option>
                  <option value="training">Capacitación / Formación</option>
                  <option value="support">Soporte</option>
                  <option value="other">Otros</option>
                </select>
              </div>

              <div>
                <label className="form-label">Proyecto Vincular (Opcional)</label>
                <SearchableSelect
                  options={projects.map((p) => ({ value: p.id, label: p.name }))}
                  value={formProjectId}
                  onChange={(val) => setFormProjectId(val)}
                  placeholder="Buscar proyecto..."
                  emptyLabel="-- No vincular a proyecto --"
                />
              </div>

              {(authUser?.roles.includes("ADMIN") || authUser?.roles.includes("PM")) ? (
                <div>
                  <label className="form-label">Consultor *</label>
                  <SearchableSelect
                    options={consultants.map((c) => ({ value: c.id, label: c.fullName }))}
                    value={formConsultantId}
                    onChange={(val) => setFormConsultantId(val)}
                    placeholder="Buscar consultor..."
                    emptyLabel=""
                  />
                </div>
              ) : (
                <div>
                  <label className="form-label">Consultor</label>
                  <input
                    type="text"
                    readOnly
                    value={myConsultant ? myConsultant.fullName : authUser?.displayName || ""}
                    style={{ background: "#f3f4f6", cursor: "not-allowed" }}
                  />
                </div>
              )}

              <div>
                <label className="form-label">Fecha Planificada *</label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Horas Estimadas *</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  required
                  value={formEstimatedHours}
                  onChange={(e) => setFormEstimatedHours(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Horas Reales (Ejecutadas) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  required
                  value={formActualHours}
                  onChange={(e) => setFormActualHours(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Prioridad *</label>
                <select value={formPriority} onChange={(e) => setFormPriority(e.target.value as ActivityPriority)} required>
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>

              <div>
                <label className="form-label">Estado *</label>
                <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as ActivityStatus)} required>
                  <option value="pending">Pendiente</option>
                  <option value="in_progress">En Progreso</option>
                  <option value="completed">Completado</option>
                  <option value="blocked">Bloqueado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              <div style={{ gridColumn: "span 2" }}>
                <label className="form-label">Comentarios / Notas internas</label>
                <textarea
                  rows={2}
                  placeholder="Observaciones de avance, impedimentos, etc..."
                  value={formComments}
                  onChange={(e) => setFormComments(e.target.value)}
                />
              </div>

              {/* AUTOMATIC EXTRA HOURS DETECTOR BOX */}
              {isExtraHoursEligible && formProjectId && (
                <div style={{
                  gridColumn: "span 2",
                  background: "#fffbeb",
                  border: "1px solid #fcd34d",
                  borderRadius: "12px",
                  padding: "1rem",
                  marginTop: "0.5rem",
                  boxShadow: "0 4px 6px -1px rgba(217, 119, 6, 0.05)"
                }}>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <span style={{ fontSize: "1.5rem" }}>⏱️</span>
                    <div>
                      <strong style={{ display: "block", fontSize: "0.9rem", color: "#92400e", marginBottom: "0.25rem" }}>
                        Sugerencia de Horas Extras
                      </strong>
                      <p style={{ margin: 0, fontSize: "0.78rem", color: "#b45309", lineHeight: "1.3" }}>
                        Esta actividad supera las 8 horas diarias estándar o se ha programado para un fin de semana/festivo. Puedes solicitar la aprobación de horas extras aquí.
                      </p>
                      
                      <button
                        type="button"
                        onClick={() => setApplyForExtraHours(!applyForExtraHours)}
                        style={{
                          background: applyForExtraHours ? "#b45309" : "linear-gradient(135deg, #f59e0b, #d97706)",
                          color: "#fff",
                          border: "none",
                          padding: "0.4rem 0.8rem",
                          fontSize: "0.78rem",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          boxShadow: "0 2px 4px rgba(217, 119, 6, 0.15)",
                          transition: "all 0.2s ease",
                          marginTop: "0.75rem"
                        }}
                      >
                        {applyForExtraHours ? "✕ Cancelar Solicitud" : "➕ Solicitar Hora Extra"}
                      </button>
                    </div>
                  </div>

                  {applyForExtraHours && (
                    <div style={{ 
                      display: "grid", 
                      gridTemplateColumns: "1fr 1fr", 
                      gap: "0.75rem", 
                      marginTop: "1rem", 
                      borderTop: "1px solid #fde68a", 
                      paddingTop: "1rem",
                      animation: "fadeIn 0.25s ease-out" 
                    }}>
                      <div>
                        <label style={{ fontSize: "0.75rem", color: "#92400e", display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Hora Inicio Horas Extras</label>
                        <input
                          type="time"
                          value={extraHoursStartTime}
                          onChange={(e) => setExtraHoursStartTime(e.target.value)}
                          style={{ padding: "0.4rem 0.5rem", fontSize: "0.82rem", borderRadius: "6px", border: "1px solid #fde68a" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.75rem", color: "#92400e", display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Hora Fin Horas Extras</label>
                        <input
                          type="time"
                          value={extraHoursEndTime}
                          onChange={(e) => setExtraHoursEndTime(e.target.value)}
                          style={{ padding: "0.4rem 0.5rem", fontSize: "0.82rem", borderRadius: "6px", border: "1px solid #fde68a" }}
                        />
                      </div>
                      <div style={{ gridColumn: "span 2" }}>
                        <label style={{ fontSize: "0.75rem", color: "#92400e", display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Nota de Justificación Horas Extras</label>
                        <input
                          type="text"
                          value={extraHoursNote}
                          onChange={(e) => setExtraHoursNote(e.target.value)}
                          placeholder="Motivo o justificación de las horas extras..."
                          style={{ padding: "0.4rem 0.5rem", fontSize: "0.82rem", width: "100%", borderRadius: "6px", border: "1px solid #fde68a" }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: "1rem", display: "flex", justifyContent: "space-between", width: "100%" }}>
              <div>
                {editingActivity && (
                  <button
                    type="button"
                    onClick={() => {
                      setModalOpen(false);
                      handleDeleteClick(editingActivity.id);
                    }}
                    style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: "6px", fontSize: "0.85rem", padding: "0.5rem 1rem" }}
                  >
                    🗑 Eliminar Actividad
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" className="ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ background: "linear-gradient(135deg, #ff9c2c, #9a4f0f)", border: "none" }}
                >
                  {submitting ? "Guardando..." : "Guardar Actividad"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* --- TEAMS SYNC MODAL --- */}
      {teamsModalOpen && (
        <div className="modal-overlay" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div className="modal-card" style={{ maxWidth: "680px", width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", gap: "1rem", overflow: "hidden", padding: "1.5rem", borderRadius: "16px" }}>
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #fdecd8", paddingBottom: "0.75rem" }}>
              <h3 style={{ margin: 0, color: "#5f2f00", fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                👥 Sincronizar Eventos de Microsoft Teams
              </h3>
              <button type="button" className="ghost" onClick={() => setTeamsModalOpen(false)} style={{ padding: "0.25rem 0.5rem" }}>✕</button>
            </div>

            <div style={{ display: "flex", gap: "0.4rem", background: "#fdf8f5", padding: "0.75rem", borderRadius: "10px", border: "1px solid #f4d4b6", fontSize: "0.82rem", color: "#9a4f0f" }}>
              <span>ℹ️</span>
              <span>
                Mostrando reuniones para la semana del <strong>{weekDays[0].toLocaleDateString("es-CO")}</strong> al <strong>{weekDays[6].toLocaleDateString("es-CO")}</strong>. 
                {accounts.length > 0 ? " Conectado a tu cuenta de Microsoft." : " Usando datos de simulación local (modo demo)."}
              </span>
            </div>

            {/* Default Project selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-soft)" }}>Asociar actividades importadas al Proyecto:</label>
              <SearchableSelect
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
                value={syncProjectId}
                onChange={(val) => setSyncProjectId(val)}
                placeholder="Buscar proyecto..."
                emptyLabel="-- No vincular a proyecto --"
              />
            </div>

            {/* List of events */}
            <div style={{ flex: 1, overflowY: "auto", minHeight: "220px", border: "1px solid #e5e7eb", borderRadius: "12px", background: "#fffdfa" }}>
              {syncLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem", gap: "0.5rem" }}>
                  <span className="loading" style={{ margin: 0 }}>Cargando eventos de Microsoft...</span>
                </div>
              ) : syncEvents.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "#9ca3af", fontStyle: "italic", fontSize: "0.85rem" }}>
                  No se encontraron eventos en tu calendario para esta semana.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#fdf8f5" }}>
                      <th style={{ width: "40px", textAlign: "center", padding: "0.5rem" }}>
                        <input
                          type="checkbox"
                          checked={syncSelectedIds.length === syncEvents.filter(ev => !ev.isImported).length && syncEvents.filter(ev => !ev.isImported).length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSyncSelectedIds(syncEvents.filter(ev => !ev.isImported).map(ev => ev.id));
                            } else {
                              setSyncSelectedIds([]);
                            }
                          }}
                          disabled={syncEvents.filter(ev => !ev.isImported).length === 0}
                          style={{ width: "16px", height: "16px", cursor: "pointer" }}
                        />
                      </th>
                      <th style={{ padding: "0.5rem" }}>Reunión / Evento</th>
                      <th style={{ padding: "0.5rem", width: "80px", textAlign: "center" }}>Duración</th>
                      <th style={{ padding: "0.5rem", width: "120px", textAlign: "center" }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncEvents.map((ev) => (
                      <tr 
                        key={ev.id} 
                        style={{ 
                          borderBottom: "1px solid #f3f4f6", 
                          background: ev.isImported ? "#f9fafb" : "transparent",
                          opacity: ev.isImported ? 0.75 : 1
                        }}
                      >
                        <td style={{ textAlign: "center", padding: "0.75rem 0.5rem" }}>
                          <input
                            type="checkbox"
                            checked={syncSelectedIds.includes(ev.id)}
                            disabled={ev.isImported}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSyncSelectedIds(prev => [...prev, ev.id]);
                              } else {
                                setSyncSelectedIds(prev => prev.filter(id => id !== ev.id));
                              }
                            }}
                            style={{ width: "16px", height: "16px", cursor: ev.isImported ? "not-allowed" : "pointer" }}
                          />
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem" }}>
                          <strong style={{ display: "block", fontSize: "0.82rem", color: ev.isImported ? "var(--text-soft)" : "var(--text-strong)" }}>
                            {ev.subject}
                          </strong>
                          <span style={{ fontSize: "0.72rem", color: "#6b7280" }}>
                            {formatMeetingTime(ev.start, ev.end)}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem", textAlign: "center", fontWeight: 700, fontSize: "0.82rem" }}>
                          {ev.duration.toFixed(1)}h
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>
                          {ev.isImported ? (
                            <span className="pill ok" style={{ fontSize: "0.65rem", padding: "0.1rem 0.4rem" }}>✓ Importado</span>
                          ) : (
                            <span className="pill neutral" style={{ fontSize: "0.65rem", padding: "0.1rem 0.4rem", background: "#f3f4f6", color: "#6b7280" }}>Pendiente</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="modal-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #fdecd8", paddingTop: "0.75rem", marginTop: "auto" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-soft)" }}>
                {syncSelectedIds.length} seleccionados para importar
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" className="ghost" onClick={() => setTeamsModalOpen(false)}>Cancelar</button>
                <button 
                  type="button" 
                  disabled={syncSelectedIds.length === 0 || syncingInProgress}
                  onClick={handleImportMeetings}
                  style={{ background: "linear-gradient(135deg, #4f46e5, #3730a3)", border: "none" }}
                >
                  {syncingInProgress ? "Importando..." : "Importar seleccionados"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast de Éxito */}
      {successMessage && (
        <div style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          backgroundColor: "#ecfdf5",
          border: "1px solid #10b981",
          borderRadius: "8px",
          padding: "1rem 1.5rem",
          color: "#065f46",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          animation: "slideIn 0.3s ease-out"
        }}>
          <span style={{ fontSize: "1.2rem" }}>✅</span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <strong style={{ fontSize: "0.9rem" }}>Éxito</strong>
            <span style={{ fontSize: "0.80rem" }}>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            style={{
              background: "none",
              border: "none",
              color: "#059669",
              cursor: "pointer",
              fontSize: "1.1rem",
              padding: "0 0 0 0.5rem"
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Confirmar Eliminación */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Eliminar Actividad"
        message="¿Está seguro de que desea eliminar esta actividad? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        danger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setActivityToDelete(null);
        }}
      />
    </div>
  );
}
