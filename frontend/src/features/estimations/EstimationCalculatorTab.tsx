import { useState, useEffect, useMemo, useCallback } from "react";
import { PageHeader } from "../../components/PageHeader";
import { 
  createEstimation, 
  listEstimations, 
  deleteEstimation, 
  type Project, 
  type Estimation 
} from "../../services/api";
import { ConfirmDialog } from "../../components/ConfirmDialog";

type EstimationCalculatorTabProps = {
  projects: Project[];
  canWrite: boolean;
  onError: (msg: string) => void;
};

type TaskInput = {
  id: number;
  name: string;
  idealHours: number;
  complexity: "routine" | "known_unknowns" | "unknown_unknowns";
  experience: "senior" | "mid" | "junior" | "mixed";
  techDebt: "clean" | "moderate" | "heavy" | "legacy";
  dependencies: "none" | "internal" | "external" | "multiple";
  hasCodeReview: boolean;
  hasTesting: boolean;
  hasDocumentation: boolean;
  meetingsPerDay: number;
  contextSwitching: boolean;
  notes: string;
};

const COMPLEXITY_LEVELS = [
  {
    key: "routine", label: "Rutinaria (x1.3)", uFactor: 1.3, color: "#22c55e", icon: "✅",
    desc: "Trabajo estándar repetido muchas veces. CRUD básico, queries simples o componentes comunes.",
    examples: ["CRUD básico", "Componente UI estándar", "Endpoint REST común"]
  },
  {
    key: "known_unknowns", label: "Incógnitas Conocidas (x2.0)", uFactor: 2.0, color: "#eab308", icon: "⚠️",
    desc: "Hay dependencias de terceros, APIs de otros equipos o código legacy sin pruebas automatizadas.",
    examples: ["Integración API externa", "Refactorizar módulo legacy", "Feature multi-servicio"]
  },
  {
    key: "unknown_unknowns", label: "Territorio Inexplorado (x3.5)", uFactor: 3.5, color: "#ef4444", icon: "🔴",
    desc: "Tecnología nueva o inestable para el equipo, requisitos sumamente ambiguos o sin documentación.",
    examples: ["Integración IA desde cero", "Protocolo de red propietario", "Cambio de arquitectura core"]
  }
];

const TEAM_EXPERIENCE = [
  { key: "senior", label: "Senior 5+ años (x1.0)", factor: 1.0, color: "#22c55e" },
  { key: "mid", label: "Mid-Level 2-5 años (x1.25)", factor: 1.25, color: "#eab308" },
  { key: "junior", label: "Junior <2 años (x1.6)", factor: 1.6, color: "#ef4444" },
  { key: "mixed", label: "Equipo Mixto (x1.3)", factor: 1.3, color: "#3b82f6" }
];

const TECH_DEBT = [
  { key: "clean", label: "Código Limpio (x1.0)", factor: 1.0, desc: "Bases de código estables, buena cobertura de tests, CI/CD fluido." },
  { key: "moderate", label: "Moderada (x1.3)", factor: 1.3, desc: "Algunas deficiencias arquitectónicas y tests escasos pero comprensible." },
  { key: "heavy", label: "Pesada (x1.6)", factor: 1.6, desc: "Sin pruebas automatizadas, alto acoplamiento, alta fricción al compilar." },
  { key: "legacy", label: "Legacy Crítico (x2.0)", factor: 2.0, desc: "Monolito obsoleto, miedo a introducir cambios, sin soporte." }
];

const DEPENDENCIES = [
  { key: "none", label: "Sin dependencias (x1.0)", factor: 1.0, desc: "El equipo tiene control total de la entrega." },
  { key: "internal", label: "Interna – Otro equipo (x1.2)", factor: 1.2, desc: "Bloqueos por prioridades cruzadas dentro de la empresa." },
  { key: "external", label: "Externa – Proveedor / API (x1.4)", factor: 1.4, desc: "Dependes de tiempos de respuesta de un tercero o pasarela externa." },
  { key: "multiple", label: "Múltiples bloqueantes (x1.6)", factor: 1.6, desc: "Múltiples dependencias cruzadas simultáneas." }
];

const INITIAL_TASK = (index: number): TaskInput => ({
  id: Date.now() + index,
  name: `Tarea ${index + 1}`,
  idealHours: 8,
  complexity: "routine",
  experience: "senior",
  techDebt: "clean",
  dependencies: "none",
  hasCodeReview: true,
  hasTesting: true,
  hasDocumentation: false,
  meetingsPerDay: 1,
  contextSwitching: false,
  notes: ""
});

export function EstimationCalculatorTab({ projects, canWrite, onError }: EstimationCalculatorTabProps) {
  const [tasks, setTasks] = useState<TaskInput[]>(() => [INITIAL_TASK(0)]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [estimationContext, setEstimationContext] = useState<string>("");
  const [hoursPerDay, setHoursPerDay] = useState<number>(8);
  const [sprintDays, setSprintDays] = useState<number>(10);
  const [bufferPercentage, setBufferPercentage] = useState<number>(15);
  const [includeWeekends, setIncludeWeekends] = useState<boolean>(false);

  const [estimations, setEstimations] = useState<Estimation[]>([]);
  const [loadingEstimations, setLoadingEstimations] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTaskIndex, setActiveTaskIndex] = useState<number>(0);
  const [showEducation, setShowEducation] = useState(true);
  
  // Custom dialog state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const loadEstimations = useCallback(async () => {
    setLoadingEstimations(true);
    try {
      const data = await listEstimations();
      setEstimations(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al cargar estimaciones");
    } finally {
      setLoadingEstimations(false);
    }
  }, [onError]);

  useEffect(() => {
    void loadEstimations();
  }, [loadEstimations]);

  const calculateTask = useCallback((task: TaskInput) => {
    const comp = COMPLEXITY_LEVELS.find((c) => c.key === task.complexity) || COMPLEXITY_LEVELS[0];
    const exp = TEAM_EXPERIENCE.find((e) => e.key === task.experience) || TEAM_EXPERIENCE[0];
    const debt = TECH_DEBT.find((t) => t.key === task.techDebt) || TECH_DEBT[0];
    const dep = DEPENDENCIES.find((d) => d.key === task.dependencies) || DEPENDENCIES[0];

    const uFactor = comp.uFactor;
    const expFactor = exp.factor;
    const debtFactor = debt.factor;
    const depFactor = dep.factor;

    // Ceremonias
    const codeReviewHours = task.hasCodeReview ? task.idealHours * 0.15 : 0;
    const testingHours = task.hasTesting ? task.idealHours * 0.25 : 0;
    const documentationHours = task.hasDocumentation ? task.idealHours * 0.1 : 0;

    // Reuniones y Contexto
    const effectiveHoursPerDay = hoursPerDay - task.meetingsPerDay * 0.75;
    const switchingPenalty = task.contextSwitching ? 1.15 : 1.0;

    // Esfuerzo Ajustado
    const baseEffort = task.idealHours * uFactor;
    const adjustedEffort = baseEffort * expFactor * debtFactor * depFactor * switchingPenalty;
    const totalEffort = adjustedEffort + codeReviewHours + testingHours + documentationHours;

    const realDays = totalEffort / Math.max(effectiveHoursPerDay, 1);
    const withBuffer = realDays * (1 + bufferPercentage / 100);

    let calendarDays = withBuffer;
    if (!includeWeekends) {
      calendarDays = Math.ceil(withBuffer / 5) * 7 - 2;
      calendarDays = Math.max(calendarDays, withBuffer);
    }

    const combinedFactor = uFactor * expFactor * debtFactor * depFactor * switchingPenalty;
    const riskLevel = combinedFactor > 4 ? "crítico" : combinedFactor > 2.5 ? "alto" : combinedFactor > 1.5 ? "medio" : "bajo";
    const confidence = Math.max(15, Math.min(95, Math.round(100 / combinedFactor)));

    return {
      totalEffort,
      realDays,
      withBuffer,
      calendarDays: Math.ceil(calendarDays),
      combinedFactor,
      riskLevel,
      confidence,
      breakdown: {
        base: task.idealHours,
        uncertainty: baseEffort - task.idealHours,
        ceremonies: codeReviewHours + testingHours + documentationHours,
        context: adjustedEffort - baseEffort
      }
    };
  }, [hoursPerDay, bufferPercentage, includeWeekends]);

  const taskResults = useMemo(() => {
    return tasks.map((t) => ({
      task: t,
      res: calculateTask(t)
    }));
  }, [tasks, calculateTask]);

  const totals = useMemo(() => {
    const sumIdeal = tasks.reduce((sum, t) => sum + t.idealHours, 0);
    const sumAdjusted = taskResults.reduce((sum, r) => sum + r.res.totalEffort, 0);
    const sumRealDays = taskResults.reduce((sum, r) => sum + r.res.realDays, 0);
    const sumWithBuffer = taskResults.reduce((sum, r) => sum + r.res.withBuffer, 0);
    const sumCalendarDays = taskResults.reduce((sum, r) => sum + r.res.calendarDays, 0);

    const highestRisk = taskResults.reduce((highest, r) => {
      const scale: Record<string, number> = { bajo: 1, medio: 2, alto: 3, crítico: 4 };
      return scale[r.res.riskLevel] > scale[highest] ? r.res.riskLevel : highest;
    }, "bajo");

    const avgConfidence = taskResults.length > 0
      ? Math.round(taskResults.reduce((sum, r) => sum + r.res.confidence, 0) / taskResults.length)
      : 100;

    return {
      idealHours: sumIdeal,
      adjustedHours: sumAdjusted,
      realDays: sumRealDays,
      withBuffer: sumWithBuffer,
      calendarDays: sumCalendarDays,
      riskLevel: highestRisk,
      confidence: avgConfidence
    };
  }, [tasks, taskResults]);

  const handleAddTask = () => {
    setTasks((prev) => [...prev, INITIAL_TASK(prev.length)]);
    setActiveTaskIndex(tasks.length);
  };

  const handleRemoveTask = (id: number) => {
    if (tasks.length <= 1) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setActiveTaskIndex(0);
  };

  const handleUpdateTask = (id: number, field: keyof TaskInput, value: string | number | boolean) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const handleExportCSV = () => {
    const headers = [
      "Tarea",
      "Horas Ideales",
      "Complejidad",
      "Experiencia",
      "Deuda Tecnica",
      "Factor Combinado",
      "Horas Ajustadas",
      "Dias Reales",
      "Dias con Buffer",
      "Riesgo",
      "Confianza (%)",
      "Notas"
    ];

    const rows = taskResults.map((tr) => [
      `"${tr.task.name}"`,
      tr.task.idealHours,
      tr.task.complexity,
      tr.task.experience,
      tr.task.techDebt,
      tr.res.combinedFactor.toFixed(2),
      tr.res.totalEffort.toFixed(1),
      tr.res.realDays.toFixed(1),
      tr.res.withBuffer.toFixed(1),
      tr.res.riskLevel,
      tr.res.confidence,
      `"${tr.task.notes.replace(/"/g, '""')}"`
    ]);

    rows.push([]);
    rows.push(["Resumen Total"]);
    rows.push(["Horas Ideales", totals.idealHours]);
    rows.push(["Horas Ajustadas", totals.adjustedHours.toFixed(1)]);
    rows.push(["Dias Reales", totals.realDays.toFixed(1)]);
    rows.push(["Dias con Buffer", totals.withBuffer.toFixed(1)]);
    rows.push(["Dias Calendario", totals.calendarDays]);
    rows.push(["Nivel de Riesgo", totals.riskLevel]);
    rows.push(["Confianza Promedio", `${totals.confidence}%`]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    const selectedProject = projects.find((p) => p.id === selectedProjectId);
    const projName = selectedProject ? selectedProject.name : "Estimacion";
    const ctxName = estimationContext.trim() ? `-${estimationContext.trim()}` : "";
    link.download = `U-Factor-${projName}${ctxName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    const selectedProject = projects.find((p) => p.id === selectedProjectId);
    if (!selectedProject && !estimationContext.trim()) {
      onError("Debes seleccionar un proyecto vinculado o ingresar un contexto/sprint para guardar.");
      return;
    }

    setSaving(true);
    try {
      const finalProjectName = selectedProject 
        ? (estimationContext.trim() ? `${selectedProject.name} (${estimationContext.trim()})` : selectedProject.name)
        : estimationContext.trim();

      await createEstimation({
        projectId: selectedProjectId || null,
        projectName: finalProjectName,
        totalIdealHours: totals.idealHours,
        totalAdjustedHours: totals.adjustedHours,
        bufferPercentage: bufferPercentage,
        riskLevel: totals.riskLevel,
        confidenceLevel: totals.confidence,
        rawDataJson: JSON.stringify({
          tasks,
          hoursPerDay,
          sprintDays,
          bufferPercentage,
          includeWeekends,
          totals,
          estimationContext,
          selectedProjectId
        })
      });
      await loadEstimations();
      showSuccess("¡Estimación guardada con éxito!");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al guardar la estimación");
    } finally {
      setSaving(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  const executeDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteEstimation(deleteTargetId);
      await loadEstimations();
      showSuccess("Estimación eliminada correctamente.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al eliminar estimación");
    } finally {
      setDeleteTargetId(null);
    }
  };

  const loadSavedData = (est: Estimation) => {
    try {
      const raw = JSON.parse(est.rawDataJson);
      if (raw.tasks) setTasks(raw.tasks);
      if (raw.hoursPerDay) setHoursPerDay(raw.hoursPerDay);
      if (raw.sprintDays) setSprintDays(raw.sprintDays);
      if (raw.bufferPercentage) setBufferPercentage(raw.bufferPercentage);
      if (raw.includeWeekends !== undefined) setIncludeWeekends(raw.includeWeekends);
      
      if (raw.estimationContext) setEstimationContext(raw.estimationContext);
      else setEstimationContext(est.projectName || "");
      
      if (raw.selectedProjectId) setSelectedProjectId(raw.selectedProjectId);
      else if (est.projectId) setSelectedProjectId(est.projectId);
      
      showSuccess("Estimación cargada correctamente.");
    } catch {
      onError("No se pudo cargar la data cruda de la estimación.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem", padding: "1rem 2rem" }}>
      
      <PageHeader
        icon="⚖"
        title="Calculadora de Estimaciones"
        description="Herramienta interactiva para estimar el esfuerzo, horas y costos de desarrollo por tareas utilizando el método PERT."
        actions={
          <>
            <button type="button" onClick={() => setShowEducation((v) => !v)} className="ghost" style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", borderRadius: "8px", borderColor: "#c4b5fd", color: "#7c3aed" }}>
              {showEducation ? "🎓 Ocultar Guía Educativa" : "🎓 Mostrar Guía Educativa"}
            </button>
            <button type="button" onClick={handleExportCSV} className="ghost" style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", borderRadius: "8px", borderColor: "#ff9c2c", color: "#9a4f0f" }}>
              ⬇ Exportar CSV
            </button>
            {canWrite && (
              <button type="button" onClick={handleSave} disabled={saving} style={{ fontSize: "0.85rem", padding: "0.5rem 1.25rem", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, #ff9c2c, #9a4f0f)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                {saving ? "Guardando..." : "💾 Guardar Estimación"}
              </button>
            )}
          </>
        }
      />

      {successBanner && (
        <div style={{ padding: "0.75rem 1rem", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", borderRadius: "10px", fontWeight: 600, fontSize: "0.9rem" }}>
          ✓ {successBanner}
        </div>
      )}

      {/* Educational Guide Drawer / Panel */}
      {showEducation && (
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", 
          gap: "1rem", 
          background: "#fff9f2", 
          border: "1px solid #ffd8a8", 
          borderRadius: "14px", 
          padding: "1.5rem" 
        }}>
          <div>
            <h4 style={{ margin: "0 0 0.5rem 0", color: "#9a4f0f", display: "flex", alignItems: "center", gap: "0.3rem" }}>🧠 ¿Qué es U-Factor?</h4>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#7a3c10", lineHeight: 1.45 }}>
              El <strong>U-Factor (Uncertainty Factor)</strong> es un multiplicador que convierte el tiempo estimado optimista (horas ideales) en tiempo real estimado, compensando la falta de especificaciones claras y el riesgo tecnológico.
            </p>
          </div>
          <div>
            <h4 style={{ margin: "0 0 0.5rem 0", color: "#9a4f0f", display: "flex", alignItems: "center", gap: "0.3rem" }}>📐 Fórmula Científica</h4>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#7a3c10", lineHeight: 1.45, fontFamily: "monospace", background: "#fff", padding: "0.4rem", borderRadius: "6px", border: "1px solid #f4d4b6" }}>
              T_Real = T_Ideal × Complejidad × Seniority × Deuda × Deps × Switch + Ceremonias(QA, CR, Docs)
            </p>
          </div>
          <div>
            <h4 style={{ margin: "0 0 0.5rem 0", color: "#9a4f0f", display: "flex", alignItems: "center", gap: "0.3rem" }}>⚡ Penalización por Contexto</h4>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#7a3c10", lineHeight: 1.45 }}>
              El <strong>Context Switching</strong> añade un recargo del <strong>+15%</strong> al esfuerzo base. Trabajar en múltiples tareas simultáneamente degrada la productividad cognitiva y alarga los plazos reales.
            </p>
          </div>
          <div>
            <h4 style={{ margin: "0 0 0.5rem 0", color: "#9a4f0f", display: "flex", alignItems: "center", gap: "0.3rem" }}>🛡️ Ley de Ceremonias Ágiles</h4>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#7a3c10", lineHeight: 1.45 }}>
              Las tareas de calidad son indispensables: se agrega <strong>+25%</strong> para Testing/QA, <strong>+15%</strong> para Code Review y <strong>+10%</strong> para Documentación técnica sobre las horas ideales.
            </p>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.85fr 1.15fr", gap: "2rem", alignItems: "start" }} className="responsive-grid">
        
        {/* Left column: Parameters & Vertical Task Accordions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* Global Config Card */}
          <div className="card glass-card" style={{ padding: "1.5rem", borderRadius: "14px", border: "1px solid #f4d4b6", background: "rgba(255, 255, 255, 0.5)" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem", color: "var(--text-strong)", fontFamily: "var(--display)" }}>
              ⚙ Parámetros Globales de Estimación
            </h3>
            <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
              
              <div>
                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Proyecto Vinculado</label>
                <select 
                  value={selectedProjectId} 
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  style={{ width: "100%", padding: "0.55rem", borderRadius: "6px", border: "1px solid #f4d4b6", background: "#fff" }}
                >
                  <option value="">-- Sin Vincular / Personal --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  Nombre de la Estimación / Contexto
                  <span style={{ cursor: "help", color: "#9a4f0f" }} title="Si no seleccionas un proyecto, este campo actuará directamente como el nombre con el que se guardará la estimación.">ℹ</span>
                </label>
                <input 
                  type="text" 
                  value={estimationContext} 
                  onChange={(e) => setEstimationContext(e.target.value)} 
                  placeholder="Ej. Sprint 3 - Integración de Pagos"
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #f4d4b6", background: "#fff" }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Horas Productivas Diarias</label>
                <input 
                  type="number" 
                  min={1} 
                  max={12} 
                  value={hoursPerDay} 
                  onChange={(e) => setHoursPerDay(Number(e.target.value) || 8)} 
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #f4d4b6" }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Duración Sprint (Días Hábiles)</label>
                <input 
                  type="number" 
                  min={1} 
                  max={30} 
                  value={sprintDays} 
                  onChange={(e) => setSprintDays(Number(e.target.value) || 10)} 
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #f4d4b6" }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Colchón de Imprevistos (%)</label>
                <input 
                  type="number" 
                  min={0} 
                  max={100} 
                  value={bufferPercentage} 
                  onChange={(e) => setBufferPercentage(Number(e.target.value) || 0)} 
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #f4d4b6" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1.2rem" }}>
                <input 
                  type="checkbox" 
                  id="includeWeekends" 
                  checked={includeWeekends} 
                  onChange={(e) => setIncludeWeekends(e.target.checked)} 
                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                />
                <label htmlFor="includeWeekends" style={{ fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}>Incluir Fines de Semana</label>
              </div>

            </div>
          </div>

          {/* Tasks Vertical Accordions Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--text-strong)", fontFamily: "var(--display)" }}>
                Desglose de Tareas Estimadas ({tasks.length})
              </h3>
              <button 
                type="button" 
                onClick={handleAddTask} 
                style={{ 
                  padding: "0.4rem 1rem", 
                  borderRadius: "8px", 
                  border: "1px solid #f4d4b6", 
                  background: "#ffe8cc", 
                  color: "#9a4f0f", 
                  fontWeight: 700, 
                  fontSize: "0.82rem",
                  cursor: "pointer" 
                }}
              >
                ➕ Agregar Tarea
              </button>
            </div>

            {/* Vertical Accordion List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "550px", overflowY: "auto", paddingRight: "0.4rem" }}>
              {tasks.map((task, idx) => {
                const tr = taskResults.find((r) => r.task.id === task.id)!;
                const isOpen = activeTaskIndex === idx;
                const riskColor = tr.res.riskLevel === "crítico" || tr.res.riskLevel === "alto" ? "#ef4444" : tr.res.riskLevel === "medio" ? "#eab308" : "#22c55e";

                return (
                  <div 
                    key={task.id} 
                    style={{ 
                      border: "1px solid #f4d4b6", 
                      borderRadius: "12px", 
                      overflow: "hidden", 
                      background: isOpen ? "#fffdfa" : "#fff",
                      boxShadow: isOpen ? "0 4px 16px rgba(154, 79, 15, 0.06)" : "none",
                      transition: "all 0.2s ease"
                    }}
                  >
                    
                    {/* Header Acordeón */}
                    <div 
                      onClick={() => setActiveTaskIndex(isOpen ? -1 : idx)}
                      style={{ 
                        padding: "0.9rem 1.2rem", 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center", 
                        cursor: "pointer",
                        background: isOpen ? "rgba(255, 156, 44, 0.04)" : "#fff",
                        borderBottom: isOpen ? "1px solid #f4d4b6" : "none",
                        userSelect: "none"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span style={{ 
                          width: "24px", 
                          height: "24px", 
                          borderRadius: "50%", 
                          background: isOpen ? "#ff9c2c" : "#f3f4f6", 
                          color: isOpen ? "#fff" : "#6b7280", 
                          display: "inline-grid", 
                          placeItems: "center", 
                          fontSize: "0.8rem", 
                          fontWeight: 700 
                        }}>
                          {idx + 1}
                        </span>
                        <strong style={{ fontSize: "0.92rem", color: isOpen ? "#9a4f0f" : "var(--text-strong)" }}>
                          {task.name || `Tarea ${idx + 1}`}
                        </strong>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }} onClick={(e) => e.stopPropagation()}>
                        {/* Summary metrics inside header */}
                        <span style={{ 
                          fontSize: "0.78rem", 
                          padding: "0.15rem 0.5rem", 
                          borderRadius: "4px", 
                          background: `${riskColor}12`, 
                          color: riskColor, 
                          fontWeight: 700, 
                          borderLeft: `2.5px solid ${riskColor}` 
                        }}>
                          {tr.res.totalEffort.toFixed(1)}h (~{tr.res.withBuffer.toFixed(1)}d)
                        </span>

                        {/* Accordion toggle icon */}
                        <span 
                          onClick={() => setActiveTaskIndex(isOpen ? -1 : idx)}
                          style={{ color: "var(--text-soft)", fontSize: "0.75rem", cursor: "pointer", padding: "0 0.25rem" }}
                        >
                          {isOpen ? "▼" : "▶"}
                        </span>

                        {tasks.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => handleRemoveTask(task.id)}
                            style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", fontSize: "0.85rem" }}
                            title="Eliminar tarea"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Accordion Body (Expanded Form fields) */}
                    {isOpen && (
                      <div style={{ padding: "1.5rem", background: "#fffdfa" }}>
                        
                        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ gridColumn: "span 2" }}>
                            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Nombre de la Tarea</label>
                            <input 
                              type="text" 
                              value={task.name} 
                              onChange={(e) => handleUpdateTask(task.id, "name", e.target.value)} 
                              placeholder="Ej. Integración pasarela PSE"
                              style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #f4d4b6", background: "#fff" }}
                            />
                          </div>

                          <div>
                            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Esfuerzo Ideal (Horas)</label>
                            <input 
                              type="number" 
                              min={0.5} 
                              step={0.5}
                              value={task.idealHours} 
                              onChange={(e) => handleUpdateTask(task.id, "idealHours", Number(e.target.value) || 1)} 
                              style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #f4d4b6", background: "#fff" }}
                            />
                          </div>

                          <div>
                            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Complejidad (Coeficiente U-Factor)</label>
                            <select 
                              value={task.complexity} 
                              onChange={(e) => handleUpdateTask(task.id, "complexity", e.target.value)}
                              style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #f4d4b6", background: "#fff" }}
                            >
                              {COMPLEXITY_LEVELS.map((c) => (
                                <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
                              ))}
                            </select>
                            {(() => {
                              const sel = COMPLEXITY_LEVELS.find((c) => c.key === task.complexity);
                              return sel ? (
                                <div style={{ marginTop: "0.3rem", padding: "0.4rem 0.6rem", background: `${sel.color}08`, border: `1px solid ${sel.color}18`, borderRadius: "6px", fontSize: "0.72rem", color: "#4b5563" }}>
                                  <strong>{sel.icon} Detalle:</strong> {sel.desc}
                                  <div style={{ marginTop: "0.2rem", display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                                    {sel.examples?.map((ex, i) => (
                                      <span key={i} style={{ padding: "0.05rem 0.35rem", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "4px", fontSize: "0.68rem" }}>{ex}</span>
                                    ))}
                                  </div>
                                </div>
                              ) : null;
                            })()}
                          </div>

                          <div>
                            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Experiencia del Desarrollador</label>
                            <select 
                              value={task.experience} 
                              onChange={(e) => handleUpdateTask(task.id, "experience", e.target.value)}
                              style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #f4d4b6", background: "#fff" }}
                            >
                              {TEAM_EXPERIENCE.map((e) => (
                                <option key={e.key} value={e.key}>{e.label}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Deuda Técnica del Entorno</label>
                            <select 
                              value={task.techDebt} 
                              onChange={(e) => handleUpdateTask(task.id, "techDebt", e.target.value)}
                              style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #f4d4b6", background: "#fff" }}
                            >
                              {TECH_DEBT.map((d) => (
                                <option key={d.key} value={d.key}>{d.label}</option>
                              ))}
                            </select>
                            {(() => {
                              const sel = TECH_DEBT.find((d) => d.key === task.techDebt);
                              return sel ? (
                                <div style={{ marginTop: "0.25rem", fontSize: "0.7rem", color: "var(--text-soft)", fontStyle: "italic" }}>
                                  ℹ {sel.desc}
                                </div>
                              ) : null;
                            })()}
                          </div>

                          <div>
                            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Dependencias Externas</label>
                            <select 
                              value={task.dependencies} 
                              onChange={(e) => handleUpdateTask(task.id, "dependencies", e.target.value)}
                              style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #f4d4b6", background: "#fff" }}
                            >
                              {DEPENDENCIES.map((d) => (
                                <option key={d.key} value={d.key}>{d.label}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Reuniones al día (Promedio)</label>
                            <select 
                              value={task.meetingsPerDay} 
                              onChange={(e) => handleUpdateTask(task.id, "meetingsPerDay", Number(e.target.value))}
                              style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #f4d4b6", background: "#fff" }}
                            >
                              <option value={0}>0 (Sin interrupciones)</option>
                              <option value={1}>1 (~45 min ocupados)</option>
                              <option value={2}>2 (~1.5 horas ocupadas)</option>
                              <option value={3}>3 (~2.2 horas ocupadas)</option>
                              <option value={4}>4 (~3 horas ocupadas)</option>
                            </select>
                          </div>

                          <div style={{ gridColumn: "span 2", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", margin: "0.5rem 0" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <input 
                                type="checkbox" 
                                id={`hasCodeReview-${task.id}`}
                                checked={task.hasCodeReview}
                                onChange={(e) => handleUpdateTask(task.id, "hasCodeReview", e.target.checked)}
                                style={{ width: "16px", height: "16px", cursor: "pointer" }}
                              />
                              <label htmlFor={`hasCodeReview-${task.id}`} style={{ fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}>Requiere Code Review (+15%)</label>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <input 
                                type="checkbox" 
                                id={`hasTesting-${task.id}`}
                                checked={task.hasTesting}
                                onChange={(e) => handleUpdateTask(task.id, "hasTesting", e.target.checked)}
                                style={{ width: "16px", height: "16px", cursor: "pointer" }}
                              />
                              <label htmlFor={`hasTesting-${task.id}`} style={{ fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}>Requiere Testing/QA (+25%)</label>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <input 
                                type="checkbox" 
                                id={`hasDocumentation-${task.id}`}
                                checked={task.hasDocumentation}
                                onChange={(e) => handleUpdateTask(task.id, "hasDocumentation", e.target.checked)}
                                style={{ width: "16px", height: "16px", cursor: "pointer" }}
                              />
                              <label htmlFor={`hasDocumentation-${task.id}`} style={{ fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}>Requiere Documentación (+10%)</label>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <input 
                                type="checkbox" 
                                id={`contextSwitching-${task.id}`}
                                checked={task.contextSwitching}
                                onChange={(e) => handleUpdateTask(task.id, "contextSwitching", e.target.checked)}
                                style={{ width: "16px", height: "16px", cursor: "pointer" }}
                              />
                              <label htmlFor={`contextSwitching-${task.id}`} style={{ fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}>Context Switching (+15%)</label>
                            </div>
                          </div>

                          <div style={{ gridColumn: "span 2" }}>
                            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Notas / Riesgos Identificados</label>
                            <textarea 
                              rows={2} 
                              value={task.notes} 
                              onChange={(e) => handleUpdateTask(task.id, "notes", e.target.value)}
                              placeholder="Ej. VPN de terceros inestable, requiere aprobación del arquitecto principal..."
                              style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #f4d4b6", background: "#fff", resize: "vertical" }}
                            />
                          </div>
                        </div>

                        {/* Individual Task Result Breakdown rendered INSIDE expanded accordion */}
                        <div style={{ marginTop: "1.5rem", padding: "1rem", background: "#fff3e6", border: "1px solid #ffd8a8", borderRadius: "10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", color: "#9a4f0f", fontWeight: 700, marginBottom: "0.5rem" }}>
                            <span>Cálculo Científico de Esfuerzo (U-Factor):</span>
                            <span>Riesgo Tarea: <strong style={{ color: riskColor, textTransform: "uppercase" }}>{tr.res.riskLevel}</strong></span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem", textAlign: "center", fontSize: "0.78rem" }}>
                            <div style={{ background: "#fff", padding: "0.5rem", borderRadius: "6px", border: "1px solid #f4d4b6" }}>
                              <span style={{ color: "var(--text-soft)", display: "block", fontSize: "0.7rem", marginBottom: "0.15rem" }}>Esfuerzo Ideal</span>
                              <strong>{task.idealHours}h</strong>
                            </div>
                            <div style={{ background: "#fff", padding: "0.5rem", borderRadius: "6px", border: "1px solid #f4d4b6" }}>
                              <span style={{ color: "var(--text-soft)", display: "block", fontSize: "0.7rem", marginBottom: "0.15rem" }}>Factor Total</span>
                              <strong style={{ color: "#b45309" }}>x{tr.res.combinedFactor.toFixed(2)}</strong>
                            </div>
                            <div style={{ background: "#fff", padding: "0.5rem", borderRadius: "6px", border: "1px solid #f4d4b6" }}>
                              <span style={{ color: "var(--text-soft)", display: "block", fontSize: "0.7rem", marginBottom: "0.15rem" }}>Esfuerzo Real</span>
                              <strong>{tr.res.totalEffort.toFixed(1)}h</strong>
                            </div>
                            <div style={{ background: "#fff", padding: "0.5rem", borderRadius: "6px", border: "1px solid #f4d4b6" }}>
                              <span style={{ color: "var(--text-soft)", display: "block", fontSize: "0.7rem", marginBottom: "0.15rem" }}>Días con Buffer</span>
                              <strong style={{ color: "#9a4f0f" }}>{tr.res.withBuffer.toFixed(1)}d</strong>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column: Consolidation, Metrics & Saved Estimations */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* Resumen Total Card */}
          <div className="card" style={{ padding: "1.75rem", borderRadius: "14px", border: "2px solid #ff9c2c", background: "linear-gradient(135deg, #fffcf9, #fff6ee)", boxShadow: "0 4px 20px rgba(154, 79, 15, 0.05)" }}>
            <h3 style={{ margin: "0 0 1.25rem 0", color: "#5f2f00", fontFamily: "var(--display)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              📊 Consolidado del Proyecto
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f4d4b6", paddingBottom: "0.5rem" }}>
                <span style={{ color: "var(--text-soft)" }}>Horas Ideales Estimadas:</span>
                <strong style={{ fontSize: "1.1rem" }}>{totals.idealHours}h</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f4d4b6", paddingBottom: "0.5rem" }}>
                <span style={{ color: "var(--text-soft)" }}>Esfuerzo Real Calculado (U-Factor):</span>
                <strong style={{ fontSize: "1.1rem", color: "#b45309" }}>{totals.adjustedHours.toFixed(1)}h</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f4d4b6", paddingBottom: "0.5rem" }}>
                <span style={{ color: "var(--text-soft)" }}>Días Hábiles con Buffer:</span>
                <strong style={{ fontSize: "1.3rem", color: "#9a4f0f" }}>{totals.withBuffer.toFixed(1)} días</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f4d4b6", paddingBottom: "0.5rem" }}>
                <span style={{ color: "var(--text-soft)" }}>Días Calendario Aproximados:</span>
                <strong style={{ fontSize: "1.1rem" }}>~{totals.calendarDays} días</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f4d4b6", paddingBottom: "0.5rem", alignItems: "center" }}>
                <span style={{ color: "var(--text-soft)" }}>Confianza de la Estimación:</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <strong style={{ color: totals.confidence > 60 ? "#22c55e" : totals.confidence > 35 ? "#eab308" : "#ef4444" }}>{totals.confidence}%</strong>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-soft)" }}>Nivel de Riesgo del Proyecto:</span>
                <span style={{ padding: "0.2rem 0.6rem", borderRadius: "9999px", background: totals.riskLevel === "crítico" || totals.riskLevel === "alto" ? "#fee2e2" : "#f0fdf4", color: totals.riskLevel === "crítico" || totals.riskLevel === "alto" ? "#ef4444" : "#22c55e", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase" }}>
                  {totals.riskLevel}
                </span>
              </div>
            </div>

            <div style={{ background: "rgba(255, 156, 44, 0.08)", border: "1px dashed #f0b07d", borderRadius: "8px", padding: "1rem", marginTop: "1rem", fontSize: "0.85rem", color: "#7a3c10", lineHeight: "140%" }}>
              💡 <strong>Recomendación Comercial:</strong> Al negociar o armar la propuesta, comunica un rango de <strong>{totals.realDays.toFixed(0)} a {totals.withBuffer.toFixed(0)} días hábiles</strong>. Nunca des una sola cifra rígida.
            </div>

            {/* Comparación visual de Ideal vs Ajustada */}
            <div style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1px solid #f4d4b6" }}>
              <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "#5f2f00", fontWeight: 700 }}>
                Comparación: Ideal vs. Realidad Calculada
              </h4>
              <div style={{ display: "flex", height: "24px", background: "#f3f4f6", borderRadius: "6px", overflow: "hidden", margin: "0.5rem 0" }}>
                <div style={{
                  width: `${Math.max(15, Math.min(85, (totals.idealHours / Math.max(totals.adjustedHours, 1)) * 100))}%`,
                  background: "#3b82f6",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.72rem",
                  fontWeight: "bold",
                  transition: "width 0.3s ease"
                }}>
                  {totals.idealHours}h Ideal
                </div>
                <div style={{
                  flexGrow: 1,
                  background: "#ff9c2c",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.72rem",
                  fontWeight: "bold",
                  transition: "width 0.3s ease"
                }}>
                  {totals.adjustedHours.toFixed(1)}h Real
                </div>
              </div>
              <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--text-soft)", lineHeight: 1.4, display: "flex", alignItems: "flex-start", gap: "0.3rem" }}>
                <span>💡</span>
                <span>
                  {totals.adjustedHours > totals.idealHours * 2.5 ? (
                    <>Tu estimación ideal subestima el esfuerzo real en un <strong>{Math.round(((totals.adjustedHours - totals.idealHours) / totals.idealHours) * 100)}%</strong>. Comunica esto al negocio con datos.</>
                  ) : totals.adjustedHours > totals.idealHours * 1.5 ? (
                    <>Hay un recargo del <strong>{Math.round(((totals.adjustedHours - totals.idealHours) / totals.idealHours) * 100)}%</strong> sobre el ideal debido a la complejidad y riesgos detectados.</>
                  ) : (
                    <>La diferencia es del <strong>{Math.round(((totals.adjustedHours - totals.idealHours) / totals.idealHours) * 100)}%</strong>. Tareas rutinarias con baja fricción. Buen escenario.</>
                  )}
                </span>
              </p>
            </div>
          </div>

          {/* Saved Estimations List */}
          <div className="card" style={{ padding: "1.5rem", borderRadius: "14px", border: "1px solid #f4d4b6", background: "#fff" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem", color: "var(--text-strong)", fontFamily: "var(--display)" }}>
              💾 Estimaciones Guardadas en Sistema ({estimations.length})
            </h3>
            {loadingEstimations ? (
              <p className="loading">Cargando...</p>
            ) : estimations.length === 0 ? (
              <p style={{ color: "var(--text-soft)", fontSize: "0.85rem", fontStyle: "italic" }}>No hay estimaciones guardadas todavía.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "300px", overflowY: "auto" }}>
                {estimations.map((est) => (
                  <div 
                    key={est.id} 
                    style={{ 
                      padding: "0.75rem", 
                      borderRadius: "8px", 
                      border: "1px solid #f4d4b6", 
                      background: "#fffdfa", 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center" 
                    }}
                  >
                    <div style={{ cursor: "pointer", flex: 1 }} onClick={() => loadSavedData(est)}>
                      <strong style={{ fontSize: "0.85rem", color: "#9a4f0f", display: "block" }}>{est.projectName}</strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-soft)" }}>
                        {Number(est.totalAdjustedHours).toFixed(1)}h | Riesgo: {est.riskLevel.toUpperCase()}
                      </span>
                    </div>
                    
                    <button 
                      type="button" 
                      onClick={() => setDeleteTargetId(est.id)} 
                      style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", fontSize: "0.9rem" }}
                      title="Eliminar estimación"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      <ConfirmDialog
        open={deleteTargetId !== null}
        title="Eliminar Estimación"
        message="¿Está seguro de que desea eliminar permanentemente esta estimación?"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        danger={true}
        onConfirm={executeDelete}
        onCancel={() => setDeleteTargetId(null)}
      />

    </div>
  );
}
