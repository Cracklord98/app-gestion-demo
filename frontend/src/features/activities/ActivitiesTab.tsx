import React, { useState, useEffect, useCallback, useMemo } from "react";
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

type ActivitiesTabProps = {
  projects: Project[];
  consultants: Consultant[];
  authUser: AuthUser | null;
  onError: (msg: string) => void;
};

export function ActivitiesTab({ projects, consultants, authUser, onError }: ActivitiesTabProps) {
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
  
  // Activity Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

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

  // Loading/submitting states
  const [submitting, setSubmitting] = useState(false);

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
    setFormConsultantId(myConsultant?.id || filterConsultantId || "");
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
        icon="📅"
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
      <div className="card glass-card" style={{ padding: "1rem", borderRadius: "12px", border: "1px solid #f4d4b6", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        {(authUser?.roles.includes("ADMIN") || authUser?.roles.includes("PM") || authUser?.roles.includes("FINANCE")) ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "180px" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-soft)" }}>Filtrar por Consultor</label>
            <select
              value={filterConsultantId}
              onChange={(e) => setFilterConsultantId(e.target.value)}
              style={{ padding: "0.4rem", borderRadius: "6px" }}
            >
              <option value="">-- Todos los Consultores --</option>
              {consultants.map((c) => (
                <option key={c.id} value={c.id}>{c.fullName}</option>
              ))}
            </select>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "180px" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-soft)" }}>Consultor</label>
            <input
              type="text"
              readOnly
              value={myConsultant ? myConsultant.fullName : authUser?.displayName || ""}
              style={{ padding: "0.4rem", borderRadius: "6px", background: "#f3f4f6", border: "1px solid #d1d5db" }}
            />
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "180px" }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-soft)" }}>Filtrar por Proyecto</label>
          <select
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
            style={{ padding: "0.4rem", borderRadius: "6px" }}
          >
            <option value="">-- Todos los Proyectos --</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
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
                const dayActivities = activitiesByDate.get(dateKey) || [];
                const totalActualHours = dayActivities.reduce((sum, a) => sum + Number(a.actualHours), 0);
                const isOvertime = totalActualHours > 8 || day.getDay() === 0 || day.getDay() === 6;

                return (
                  <div
                    key={dateKey}
                    style={{
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
                      display: "flex",
                      flexDirection: "column",
                      minHeight: "350px",
                      padding: "0.75rem"
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
                      <div style={{ marginTop: "0.3rem", display: "flex", justifyContent: "center", gap: "0.4rem", alignItems: "center" }}>
                        <span style={{ fontSize: "0.7rem", padding: "0.1rem 0.3rem", borderRadius: "4px", background: "#f3f4f6" }}>
                          ⏱️ {totalActualHours}h
                        </span>
                        {isOvertime && totalActualHours > 0 && (
                          <span
                            title="Supera las 8h o es fin de semana. Aplica a horas extra."
                            style={{ cursor: "help", fontSize: "0.7rem", padding: "0.1rem 0.3rem", borderRadius: "4px", background: "#fef3c7", color: "#d97706", fontWeight: 700 }}
                          >
                            ⚠️ HE
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
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => handleOpenAddModal(dateKey)}
                      style={{ width: "100%", padding: "0.25rem", fontSize: "0.72rem", marginTop: "0.5rem", borderColor: "#e5e7eb" }}
                    >
                      + Registrar
                    </button>
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
                        background: !currentMonth 
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
                <select value={formProjectId} onChange={(e) => setFormProjectId(e.target.value)}>
                  <option value="">-- No vincular a proyecto --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {(authUser?.roles.includes("ADMIN") || authUser?.roles.includes("PM")) ? (
                <div>
                  <label className="form-label">Consultor *</label>
                  <select value={formConsultantId} onChange={(e) => setFormConsultantId(e.target.value)} required>
                    {consultants.map((c) => (
                      <option key={c.id} value={c.id}>{c.fullName}</option>
                    ))}
                  </select>
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
                  border: "1px solid #fde68a",
                  borderRadius: "10px",
                  padding: "0.75rem",
                  marginTop: "0.5rem"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="checkbox"
                      id="applyForExtraHours"
                      checked={applyForExtraHours}
                      onChange={(e) => setApplyForExtraHours(e.target.checked)}
                      style={{ cursor: "pointer", width: "16px", height: "16px" }}
                    />
                    <label htmlFor="applyForExtraHours" style={{ fontSize: "0.85rem", fontWeight: 700, color: "#b45309", cursor: "pointer" }}>
                      ⏰ Reportar automáticamente Solicitud de Horas Extras
                    </label>
                  </div>
                  <p style={{ margin: "0.2rem 0 0.5rem 1.4rem", fontSize: "0.72rem", color: "#b45309" }}>
                    Hemos detectado que esta actividad excede la jornada estándar de 8h o se reporta en fin de semana.
                  </p>

                  {applyForExtraHours && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem", paddingLeft: "1.4rem" }}>
                      <div>
                        <label style={{ fontSize: "0.7rem", color: "var(--text-soft)", display: "block" }}>Hora Inicio Horas Extras</label>
                        <input
                          type="time"
                          value={extraHoursStartTime}
                          onChange={(e) => setExtraHoursStartTime(e.target.value)}
                          style={{ padding: "0.25rem", fontSize: "0.8rem" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.7rem", color: "var(--text-soft)", display: "block" }}>Hora Fin Horas Extras</label>
                        <input
                          type="time"
                          value={extraHoursEndTime}
                          onChange={(e) => setExtraHoursEndTime(e.target.value)}
                          style={{ padding: "0.25rem", fontSize: "0.8rem" }}
                        />
                      </div>
                      <div style={{ gridColumn: "span 2" }}>
                        <label style={{ fontSize: "0.7rem", color: "var(--text-soft)", display: "block" }}>Nota de Justificación Horas Extras</label>
                        <input
                          type="text"
                          value={extraHoursNote}
                          onChange={(e) => setExtraHoursNote(e.target.value)}
                          placeholder="Justificación para aprobación..."
                          style={{ padding: "0.25rem", fontSize: "0.8rem", width: "100%" }}
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
