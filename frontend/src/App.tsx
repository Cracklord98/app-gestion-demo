import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { env } from "./config/env";
import { apiTokenRequest, loginRequest } from "./auth/msal";
import {
  getHealth, getMe, setApiAccessToken, sendFeedback,
  type AuthUser, type HealthResponse, type FxConfig,
} from "./services/api";
import { useProjects } from "./hooks/useProjects";
import { useConsultants } from "./hooks/useConsultants";
import { useTimeEntries } from "./hooks/useTimeEntries";
import { useExpenses } from "./hooks/useExpenses";
import { useForecasts } from "./hooks/useForecasts";
import { useRevenue } from "./hooks/useRevenue";
import { useFxConfigs } from "./hooks/useFxConfigs";
import { useAdminUsers } from "./hooks/useAdminUsers";
import { useStats } from "./hooks/useStats";
import { useAlerts } from "./hooks/useAlerts";
import { useToastController } from "./hooks/useToast";
import { DashboardTab } from "./features/dashboard/DashboardTab";
import { ProjectsTab } from "./features/projects/ProjectsTab";
import { ProjectDetailTab } from "./features/projects/ProjectDetailTab";
import { ConsultantsTab } from "./features/consultants/ConsultantsTab";
import { TimeEntriesTab } from "./features/timeEntries/TimeEntriesTab";
import { ExpensesTab } from "./features/expenses/ExpensesTab";
import { ForecastsTab } from "./features/forecasts/ForecastsTab";
import { RevenueTab } from "./features/revenue/RevenueTab";
import { FxTab } from "./features/fx/FxTab";
import { AdminTab } from "./features/admin/AdminTab";
import { AuditTab } from "./features/audit/AuditTab";
import { CapacityTab } from "./features/capacity/CapacityTab";
import { PortfolioTab } from "./features/portfolio/PortfolioTab";
import { AlertsPanel } from "./components/AlertsPanel";
import { AlertsTab } from "./features/alerts/AlertsTab";
import { ToastContainer } from "./components/Toast";
import { AppFooter } from "./components/AppFooter";
import { ProfileTab } from "./features/profile/ProfileTab";
import { ExtraHoursTab } from "./features/extraHours/ExtraHoursTab";
import { EstimationCalculatorTab } from "./features/estimations/EstimationCalculatorTab";
import { ActivitiesTab } from "./features/activities/ActivitiesTab";
import type { TabId } from "./types";
import { RagChat } from "./components/RagChat";
import "./App.css";

// ── Logo ─────────────────────────────────────────────────────────────────────

function PyramidLogo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 90" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Logo">
      <polygon points="50,0 0,90 50,90" fill="#E8A020" />
      <polygon points="50,0 50,90 100,90" fill="#7A3C10" />
    </svg>
  );
}

// ── Sidebar config ──────────────────────────────────────────────────────────

const SIDEBAR_GROUPS: {
  label: string;
  tabs: { id: TabId; label: string; icon: string; permission?: string }[];
}[] = [
  {
    label: "Gobierno",
    tabs: [
      { id: "dashboard",  label: "Dashboard",   icon: "▦",  permission: "stats:read" },
      { id: "portfolio",  label: "Portafolio",  icon: "◈",  permission: "stats:read" },
      { id: "projects",   label: "Proyectos",   icon: "◻",  permission: "projects:read" },
      { id: "capacity",   label: "Capacidad",   icon: "◉",  permission: "capacity:read" },
    ],
  },
  {
    label: "Operación",
    tabs: [
      { id: "consultants",  label: "Consultores",   icon: "◐", permission: "consultants:read" },
      { id: "timeEntries",  label: "Horas",          icon: "⊙", permission: "time:read" },
      { id: "activities",   label: "Actividades",   icon: "▤", permission: "time:read" },
      { id: "extraHours",   label: "Horas Extra",    icon: "⧗", permission: "extrahours:read" },
      { id: "expenses",     label: "Gastos",         icon: "⊟", permission: "expenses:read" },
    ],
  },
  {
    label: "Financiero",
    tabs: [
      { id: "revenue",    label: "Ingresos",      icon: "⊕", permission: "revenue:read" },
      { id: "forecasts",  label: "Proyecciones",  icon: "◷", permission: "forecasts:read" },
      { id: "estimations", label: "Estimaciones",  icon: "⚖", permission: "estimations:read" },
      { id: "fx",         label: "Tasas FX",      icon: "⊗", permission: "fx:read" },
    ],
  },
  {
    label: "Administración",
    tabs: [
      { id: "admin", label: "Usuarios",  icon: "◐", permission: "users:manage" },
      { id: "extraHoursConfig", label: "Config. Horas Extra", icon: "⚙", permission: "extrahours:config" },
      { id: "audit", label: "Auditoría", icon: "⊛", permission: "users:manage" },
    ],
  },
];

// ── Auth helpers ────────────────────────────────────────────────────────────

async function getAccessToken(
  instance: ReturnType<typeof useMsal>["instance"],
  account: ReturnType<typeof useMsal>["accounts"][number],
): Promise<string | null> {
  const preferAccessToken = Boolean(env.azureApiScope);
  try {
    const result = await instance.acquireTokenSilent({ ...apiTokenRequest, account });
    return preferAccessToken ? result.accessToken || result.idToken : result.idToken || result.accessToken;
  } catch {
    await instance.acquireTokenRedirect({
      ...apiTokenRequest, account,
      redirectStartPage: `${window.location.origin}/dashboard`,
    });
    return null;
  }
}

// ── FX Converter (drawer content) ──────────────────────────────────────────

const CURRENCY_OPTIONS = ["COP", "USD", "EUR", "MXN", "PEN", "CLP"];

function numberish(v: string | null | undefined) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function FxDrawer({ open, onClose, fxConfigs }: { open: boolean; onClose: () => void; fxConfigs: FxConfig[] }) {
  const [conv, setConv] = useState(() => {
    const first = fxConfigs[0];
    return { from: first?.baseCode ?? "USD", to: first?.quoteCode ?? "COP", amount: "1", rate: first?.rate ?? "4000" };
  });

  const result = useMemo(() => {
    const a = numberish(conv.amount);
    const r = numberish(conv.rate);
    if (r <= 0) return null;
    return a * r;
  }, [conv.amount, conv.rate]);

  return (
    <>
      {open && (
        <div aria-hidden="true" onClick={onClose}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.25)", zIndex: 300 }} />
      )}
      <div className={`fx-drawer${open ? " open" : ""}`} role="dialog" aria-label="Conversor FX" aria-modal="true">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "1rem", color: "#5f2f00" }}>⊗ Conversor de divisas</h2>
          <button type="button" className="ghost" onClick={onClose} aria-label="Cerrar conversor" style={{ padding: "0.25rem 0.5rem" }}>✕</button>
        </div>

        <div className="form-grid converter-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <select value={conv.from} onChange={(e) => setConv((p) => ({ ...p, from: e.target.value }))}>
            {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>Desde {c}</option>)}
          </select>
          <select value={conv.to} onChange={(e) => setConv((p) => ({ ...p, to: e.target.value }))}>
            {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>Hacia {c}</option>)}
          </select>
          <div>
            <label style={{ fontSize: "0.7rem", color: "#6b7280", display: "block", marginBottom: "0.2rem" }}>Cantidad</label>
            <input type="number" min="0" step="0.01" value={conv.amount}
              onChange={(e) => setConv((p) => ({ ...p, amount: e.target.value }))} placeholder="Cantidad" />
          </div>
          <div>
            <label style={{ fontSize: "0.7rem", color: "#6b7280", display: "block", marginBottom: "0.2rem" }}>
              Tasa {conv.from}→{conv.to}
            </label>
            <input type="number" min="0" step="0.0001" value={conv.rate}
              onChange={(e) => setConv((p) => ({ ...p, rate: e.target.value }))} />
          </div>
        </div>

        <div style={{ background: "#fff8f0", border: "1px solid #f4d4b6", borderRadius: "10px", padding: "0.75rem" }}>
          {result === null
            ? <p style={{ color: "#9ca3af", fontSize: "0.85rem", margin: 0 }}>Define una tasa mayor a 0</p>
            : <p style={{ color: "#5f2f00", fontWeight: 800, fontSize: "1.1rem", margin: 0 }}>
                {conv.from} {Number(conv.amount).toLocaleString("es-CO")}
                <span style={{ color: "#9a4f0f", fontSize: "0.85rem", fontWeight: 600, margin: "0 0.4rem" }}>→</span>
                {conv.to} {result.toLocaleString("es-CO", { maximumFractionDigits: 2 })}
              </p>
          }
        </div>

        {fxConfigs.length > 0 && (
          <div>
            <p style={{ fontSize: "0.7rem", color: "#9a4f0f", fontWeight: 700, marginBottom: "0.4rem" }}>
              Tasas configuradas
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              {fxConfigs.map((fx) => (
                <div key={fx.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#5f2f00" }}>
                  <span>{fx.baseCode} → {fx.quoteCode}</span>
                  <strong>{Number(fx.rate).toLocaleString("es-CO", { maximumFractionDigits: 4 })}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Special tabs accessible outside the sidebar (e.g., from dropdown)
const NON_SIDEBAR_TABS: TabId[] = ["profile"];

// ── Tab Path Mapping ────────────────────────────────────────────────────────

const TAB_PATH_MAP: Record<TabId, string> = {
  dashboard: "/dashboard",
  portfolio: "/portfolio",
  projects: "/projects",
  capacity: "/capacity",
  consultants: "/consultants",
  timeEntries: "/time-entries",
  activities: "/activities",
  extraHours: "/extra-hours",
  expenses: "/expenses",
  revenue: "/revenue",
  forecasts: "/forecasts",
  estimations: "/estimations",
  fx: "/fx",
  admin: "/admin",
  extraHoursConfig: "/extra-hours-config",
  audit: "/audit",
  profile: "/profile",
  alerts: "/alerts",
};

const PATH_TAB_MAP: Record<string, TabId> = Object.fromEntries(
  Object.entries(TAB_PATH_MAP).map(([tab, path]) => [path, tab as TabId])
);

// ── Landing Page ────────────────────────────────────────────────────────────

function LandingPage({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <>
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <div className="landing-container" style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at 10% 20%, rgb(255, 252, 243) 0%, rgb(255, 240, 220) 90%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        color: "#2a1e12",
        fontFamily: "'Outfit', 'Inter', sans-serif",
      }}>
        <div className="landing-card" style={{
          maxWidth: "900px",
          background: "rgba(255, 255, 255, 0.75)",
          backdropFilter: "blur(20px)",
          borderRadius: "30px",
          padding: "3.5rem 2.5rem",
          boxShadow: "0 20px 50px rgba(122, 60, 16, 0.08)",
          border: "1px solid rgba(244, 212, 182, 0.6)",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          animation: "slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both"
        }}>
          <div style={{
            background: "linear-gradient(135deg, #fff3e3, #ffdcb5)",
            borderRadius: "50%",
            padding: "1.5rem",
            display: "inline-block",
            marginBottom: "1.5rem",
            boxShadow: "inset 0 2px 5px rgba(255,255,255,0.8), 0 10px 20px rgba(154, 79, 15, 0.05)"
          }}>
            <PyramidLogo size={72} />
          </div>
          
          <h1 style={{
            fontSize: "3rem",
            fontWeight: 800,
            background: "linear-gradient(135deg, #7a3c10 0%, #d97706 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            margin: "0 0 1rem 0",
            letterSpacing: "-0.03em"
          }}>
            Plataforma de Gestión Demo
          </h1>
          
          <p style={{
            fontSize: "1.2rem",
            color: "#5f4530",
            maxWidth: "600px",
            lineHeight: "1.6",
            margin: "0 0 2.5rem 0",
          }}>
            La consola ejecutiva para el control financiero, aprobaciones inteligentes y proyección de recursos de Synaptica.
          </p>

          <button 
            onClick={onLoginClick}
            style={{
              background: "linear-gradient(135deg, #ff9c2c, #9a4f0f)",
              color: "#fff",
              border: "none",
              borderRadius: "50px",
              padding: "1.2rem 3rem",
              fontSize: "1.1rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 10px 25px rgba(154, 79, 15, 0.25)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              marginBottom: "3.5rem"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 15px 30px rgba(154, 79, 15, 0.35)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "0 10px 25px rgba(154, 79, 15, 0.25)";
            }}
          >
            Ingresar a la Plataforma
          </button>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1.5rem",
            width: "100%",
            textAlign: "left"
          }}>
            <div style={{
              background: "rgba(255, 255, 255, 0.5)",
              padding: "1.5rem",
              borderRadius: "20px",
              border: "1px solid rgba(244, 212, 182, 0.4)"
            }}>
              <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "0.5rem" }}>📊</span>
              <h3 style={{ margin: "0 0 0.5rem 0", color: "#7a3c10", fontSize: "1.05rem" }}>Control Financiero</h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b5440", lineHeight: "1.5" }}>
                Monitoreo en tiempo real de presupuestos, márgenes brutos y rentabilidad del portafolio.
              </p>
            </div>

            <div style={{
              background: "rgba(255, 255, 255, 0.5)",
              padding: "1.5rem",
              borderRadius: "20px",
              border: "1px solid rgba(244, 212, 182, 0.4)"
            }}>
              <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "0.5rem" }}>⚡</span>
              <h3 style={{ margin: "0 0 0.5rem 0", color: "#7a3c10", fontSize: "1.05rem" }}>Flujo de Aprobaciones</h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b5440", lineHeight: "1.5" }}>
                Validación secuencial de horas extra (Nivel 1: PM, Nivel 2: Nómina/Financiero) y notificaciones automáticas.
              </p>
            </div>

            <div style={{
              background: "rgba(255, 255, 255, 0.5)",
              padding: "1.5rem",
              borderRadius: "20px",
              border: "1px solid rgba(244, 212, 182, 0.4)"
            }}>
              <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "0.5rem" }}>🔮</span>
              <h3 style={{ margin: "0 0 0.5rem 0", color: "#7a3c10", fontSize: "1.05rem" }}>Planificación de Recursos</h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b5440", lineHeight: "1.5" }}>
                Cálculo inteligente de capacidad, proyecciones mensuales y tasas FX bimoneda integradas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── App ─────────────────────────────────────────────────────────────────────

function App() {
  const microsoftConfigured = Boolean(env.azureClientId && env.azureTenantId);
  const authWithMicrosoftEnabled = microsoftConfigured && !env.forceLocalAuth;
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [currentPath, setCurrentPath] = useState(() => (window.location.pathname || "/").toLowerCase());
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const path = (window.location.pathname || "/").toLowerCase();
    return PATH_TAB_MAP[path] || "dashboard";
  });
  const [preselectedCapacityConsultantId, setPreselectedCapacityConsultantId] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [originalUser, setOriginalUser] = useState<AuthUser | null>(null);

  const handleSwitchRole = useCallback((role: "ADMIN" | "PM" | "CONSULTANT" | "FINANCE") => {
    if (!originalUser) return;
    const rolePermissionsMap: Record<string, string[]> = {
      ADMIN: [
        "projects:read", "projects:write", "consultants:read", "consultants:write",
        "time:read", "time:write", "time:review", "expenses:read", "expenses:write",
        "forecasts:read", "forecasts:write", "revenue:read", "revenue:write",
        "fx:read", "fx:write", "stats:read", "assignments:read", "assignments:write",
        "capacity:read", "snapshots:close", "alerts:read", "alerts:resolve",
        "audit:read", "users:manage", "extrahours:read", "extrahours:write",
        "extrahours:review", "extrahours:config", "estimations:write", "estimations:read"
      ],
      PM: [
        "projects:read", "projects:write", "consultants:read", "consultants:write",
        "time:read", "time:write", "time:review", "expenses:read", "expenses:write",
        "forecasts:read", "forecasts:write", "revenue:read", "revenue:write",
        "fx:read", "stats:read", "assignments:read", "assignments:write",
        "capacity:read", "alerts:read", "alerts:resolve", "extrahours:read",
        "extrahours:write", "extrahours:review", "estimations:write", "estimations:read"
      ],
      CONSULTANT: [
        "time:read", "time:write", "alerts:read", "extrahours:read", "extrahours:write", "estimations:read"
      ],
      FINANCE: [
        "extrahours:read", "extrahours:review"
      ]
    };
    setAuthUser({
      ...originalUser,
      roles: [role],
      permissions: rolePermissionsMap[role]
    });
  }, [originalUser]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => typeof window !== "undefined" && window.innerWidth <= 860);
  const [fxDrawerOpen, setFxDrawerOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Global Feedback States ---
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState("BUG");
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);

  // --- RAG Chatbot State ---
  const [chatOpen, setChatOpen] = useState(false);

  // --- Keyboard Shortcuts Help State ---
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  const { toasts, show: showToast, dismiss } = useToastController();

  // --- Feedback Submit Handler ---
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackNotes.trim()) return;
    setSendingFeedback(true);
    try {
      await sendFeedback({
        category: feedbackCategory as "BUG" | "SUGGESTION" | "AESTHETIC" | "OTHER",
        notes: feedbackNotes,
      });
      showToast("¡Gracias por tus comentarios! Feedback registrado.", "success");
      setFeedbackNotes("");
      setFeedbackOpen(false);
    } catch (err) {
      handleError(err instanceof Error ? err.message : "Error al enviar el feedback");
    } finally {
      setSendingFeedback(false);
    }
  };

  // --- Global Keyboard Shortcuts Hook ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Alt modifier
      if (e.altKey) {
        const key = e.key.toLowerCase();
        if (key === "n") {
          e.preventDefault();
          setActiveTab("dashboard");
        } else if (key === "h") {
          e.preventDefault();
          setActiveTab("timeEntries");
        } else if (key === "f") {
          e.preventDefault();
          setActiveTab("forecasts");
        } else if (key === "c") {
          e.preventDefault();
          setActiveTab("consultants");
        }
      }
      // Check for Ctrl+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setChatOpen((o) => !o);
      }
      // Check for ESC
      if (e.key === "Escape") {
        setFeedbackOpen(false);
        setShortcutsHelpOpen(false);
        setChatOpen(false);
      }
      // Check for "?"
      if (e.key === "?") {
        const activeElem = document.activeElement;
        const isInput = activeElem && (
          activeElem.tagName === "INPUT" ||
          activeElem.tagName === "TEXTAREA" ||
          activeElem.getAttribute("contenteditable") === "true"
        );
        if (!isInput) {
          e.preventDefault();
          setShortcutsHelpOpen((o) => !o);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const permissions = useMemo(() => authUser?.permissions ?? [], [authUser?.permissions]);
  const can = useCallback((p: string) => permissions.includes(p), [permissions]);

  // Domain hooks
  const projectsHook    = useProjects(!!authUser && (can("projects:read") || can("estimations:read")));
  const consultantsHook = useConsultants(!!authUser && can("consultants:read"));
  const timeEntriesHook = useTimeEntries(!!authUser && can("time:read"));
  const expensesHook    = useExpenses(!!authUser && can("expenses:read"));
  const forecastsHook   = useForecasts(!!authUser && can("forecasts:read"));
  const revenueHook     = useRevenue(!!authUser && can("revenue:read"));
  const fxHook          = useFxConfigs(!!authUser && can("fx:read"));
  const adminHook       = useAdminUsers(!!authUser && can("users:manage"));
  const statsHook       = useStats(!!authUser && can("stats:read"));
  const alertsHook      = useAlerts(!!authUser && (can("stats:read") || can("projects:read")));

  // Visible tabs per permission
  const visibleGroups = useMemo(() =>
    SIDEBAR_GROUPS.map((g) => ({
      ...g,
      tabs: g.tabs.filter((t) => !t.permission || permissions.includes(t.permission)),
    })).filter((g) => g.tabs.length > 0),
  [permissions]);

  const allVisibleTabs = useMemo(() => visibleGroups.flatMap((g) => g.tabs), [visibleGroups]);

  const goTo = useCallback((path: string, replace = false) => {
    if (replace) window.history.replaceState({}, "", path);
    else window.history.pushState({}, "", path);
    setCurrentPath(path.toLowerCase());
  }, []);

  // Synchronize path and active tab when back/forward button is clicked (popstate)
  useEffect(() => {
    const onPopState = () => {
      const path = (window.location.pathname || "/").toLowerCase();
      setCurrentPath(path);
      const tab = PATH_TAB_MAP[path];
      if (tab) {
        setActiveTab(tab);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Sync browser URL when active tab changes
  useEffect(() => {
    if (authUser) {
      const path = TAB_PATH_MAP[activeTab];
      if (path && window.location.pathname !== path) {
        window.history.pushState({}, "", path);
        setCurrentPath(path);
      }
    }
  }, [activeTab, authUser]);

  // Handle URL routing redirections based on authentication state
  useEffect(() => {
    const isTabPath = currentPath in PATH_TAB_MAP;
    const isPublicPath = ["/", "/landing", "/login"].includes(currentPath);

    if (authUser) {
      if (isPublicPath) {
        const path = TAB_PATH_MAP[activeTab] || "/dashboard";
        goTo(path, true);
      } else if (!isTabPath) {
        goTo("/dashboard", true);
      }
    } else {
      if (isTabPath) {
        goTo("/", true);
      }
    }
  }, [currentPath, authUser, goTo, activeTab]);

  useEffect(() => {
    if (!NON_SIDEBAR_TABS.includes(activeTab) && !allVisibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab(allVisibleTabs[0]?.id ?? "dashboard");
    }
  }, [allVisibleTabs, activeTab]);

  useEffect(() => {
    setError(null);
  }, [activeTab, openProjectId]);

  const bootstrap = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const healthResult = await getHealth();
      setHealth(healthResult);
      if (authWithMicrosoftEnabled) {
        if (!isAuthenticated || !accounts[0]) {
          setAuthUser(null);
          const isPublic = ["/", "/landing", "/login"].includes(currentPath);
          if (!isPublic) {
            goTo("/", true);
          }
          setLoading(false);
          return;
        }
        const token = await getAccessToken(instance, accounts[0]);
        if (!token) return;
        setApiAccessToken(token);
      } else {
        setApiAccessToken(null);
      }
      const me = await getMe();
      setOriginalUser(me);
      setAuthUser(me);
      const isPublic = ["/", "/landing", "/login"].includes(currentPath);
      if (isPublic) {
        goTo("/dashboard", true);
      }
    } catch (err) {
      setAuthUser(null);
      setError(err instanceof Error ? err.message : "Error inicializando la aplicación");
    } finally {
      setLoading(false);
    }
  }, [accounts, authWithMicrosoftEnabled, currentPath, goTo, instance, isAuthenticated]);

  useEffect(() => { void bootstrap(); }, [bootstrap, microsoftConfigured]);

  async function logout() {
    setApiAccessToken(null);
    setOriginalUser(null);
    setAuthUser(null);
    goTo("/", true);
    if (authWithMicrosoftEnabled) {
      await instance.logoutRedirect({ postLogoutRedirectUri: `${window.location.origin}/` });
    }
  }

  function handleError(msg: string) {
    setError(msg);
    showToast(msg, "error");
  }

  function openProject(id: string) {
    setOpenProjectId(id);
    setActiveTab("projects");
  }

  /** Drill-through: navigate to another tab from a KPI click */
  function drillTo(tab: TabId) {
    setActiveTab(tab);
  }

  // ── Not authenticated ────────────────────────────────────────────────────
  if (!authUser) {
    if (loading) {
      return (
        <main className="auth-shell">
          <section className="auth-card">
            <div className="logo-slot"><PyramidLogo /></div>
            <h1>App Gestion Demo</h1>
            <p>Inicializando sesión…</p>
          </section>
        </main>
      );
    }

    if (currentPath === "/" || currentPath === "/landing") {
      return <LandingPage onLoginClick={() => goTo("/login")} />;
    }

    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="logo-slot"><PyramidLogo /></div>
          <h1>App Gestion Demo</h1>
          {error && <p className="error-banner">{error}</p>}
          {authWithMicrosoftEnabled ? (
            isAuthenticated ? (
              <>
                <p>Tu sesión Microsoft está activa, pero no fue posible validar permisos.</p>
                <div className="inline-actions">
                  <button type="button" onClick={() => void bootstrap()}>Reintentar</button>
                  <button type="button" className="ghost" onClick={() => void logout()}>Cerrar sesión</button>
                </div>
              </>
            ) : (
              <>
                <p>Ingresa con Microsoft para continuar.</p>
                <div className="inline-actions" style={{ flexDirection: "column", gap: "0.5rem" }}>
                  <button type="button"
                    onClick={() => void instance.loginRedirect({ ...loginRequest, redirectStartPage: `${window.location.origin}/home` })}>
                    Iniciar sesión con Microsoft
                  </button>
                  <button type="button" className="ghost" onClick={() => goTo("/")}>Volver al Inicio</button>
                </div>
              </>
            )
          ) : (
            <>
              <p>Modo demo activo sin login Microsoft.</p>
              <button type="button" className="ghost" onClick={() => goTo("/")}>Volver al Inicio</button>
            </>
          )}
        </section>
      </main>
    );
  }

  // ── Timestamp ────────────────────────────────────────────────────────────
  const lastUpdatedLabel = statsHook.lastUpdated
    ? `Actualizado ${statsHook.lastUpdated.toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
    : null;

  // ── Authenticated ────────────────────────────────────────────────────────
  return (
    <div className="shell">
      {/* Header */}
      <header className="hero">
        <div className="hero-left">
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label="Menú principal"
            title="Menú principal"
          >
            ☰
          </button>
          <div className="logo-slot"><PyramidLogo /></div>
          <div>
            <h1>App Gestion Demo</h1>
            <p>Gestión integral de proyectos, horas, gastos y proyecciones</p>
            {lastUpdatedLabel && (
              <div className="hero-meta">
                <span className={`pill ${health?.ok ? "ok" : "error"}`} style={{ fontSize: "0.65rem", padding: "0.15rem 0.5rem" }}>
                  {health?.ok ? "● Backend activo" : "● Backend no disponible"}
                </span>
                <span>🕐 {lastUpdatedLabel}</span>
              </div>
            )}
            {!lastUpdatedLabel && (
              <div className="hero-meta">
                <span className={`pill ${health?.ok ? "ok" : "error"}`} style={{ fontSize: "0.65rem", padding: "0.15rem 0.5rem" }}>
                  {health?.ok ? "● Backend activo" : "● Backend no disponible"}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="badges">
          {authUser && originalUser?.roles.includes("ADMIN") && (
            <div className="role-switcher" style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(154, 79, 15, 0.08)",
              border: "1px solid #f4d4b6",
              borderRadius: "20px",
              padding: "2px",
              marginRight: "0.5rem"
            }}>
              <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#9a4f0f", padding: "0 6px 0 10px" }}>VISTA:</span>
              {(["ADMIN", "PM", "CONSULTANT", "FINANCE"] as const).map((r) => {
                const isActive = authUser.roles.includes(r) && authUser.roles.length === 1;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleSwitchRole(r)}
                    style={{
                      background: isActive ? "linear-gradient(135deg, #ff9c2c, #9a4f0f)" : "none",
                      color: isActive ? "#fff" : "#9a4f0f",
                      border: "none",
                      borderRadius: "16px",
                      padding: "4px 10px",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                  >
                    {r === "ADMIN" ? "Admin" : r === "PM" ? "PM" : r === "CONSULTANT" ? "Consultor" : "Financiero"}
                  </button>
                );
              })}
            </div>
          )}
          <button type="button" className="ghost fx-toggle-btn" onClick={() => setFxDrawerOpen(true)}
            title="Conversor de divisas" style={{ fontSize: "0.82rem" }}>
            ⊗ FX
          </button>
          <AlertsPanel
            alerts={alertsHook.alerts}
            unreadCount={alertsHook.unreadCount}
            canRun={can("users:manage")}
            onReload={alertsHook.reload}
            onError={handleError}
          />
          
          {/* Avatar interactivo dropdown */}
          <div ref={profileDropdownRef} style={{ position: "relative", display: "inline-block" }}>
            <button
              type="button"
              onClick={() => setProfileDropdownOpen((o) => !o)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                display: "flex",
                alignItems: "center"
              }}
              aria-expanded={profileDropdownOpen}
              aria-haspopup="menu"
              aria-label="Menú de usuario"
            >
              <div style={{
                width: "38px",
                height: "38px",
                borderRadius: "50%",
                overflow: "hidden",
                background: "linear-gradient(135deg, #ff9c2c, #9a4f0f)",
                color: "#fff",
                fontWeight: 800,
                display: "grid",
                placeItems: "center",
                fontSize: "0.9rem",
                boxShadow: "0 2px 8px rgba(154, 79, 15, 0.2)",
                border: "2px solid #fff"
              }}>
                {authUser.photoUrl ? (
                  <img
                    src={authUser.photoUrl}
                    alt={authUser.displayName}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : null}
                <span>{authUser.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}</span>
              </div>
            </button>

            {profileDropdownOpen && (
              <div
                  style={{
                    position: "absolute",
                    top: "45px",
                    right: 0,
                    width: "220px",
                    background: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid #f4d4b6",
                    borderRadius: "12px",
                    boxShadow: "0 8px 30px rgba(154, 79, 15, 0.15)",
                    padding: "0.75rem",
                    zIndex: 300,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem"
                  }}
                >
                  <div style={{ padding: "0.25rem 0.5rem 0.5rem 0.5rem", borderBottom: "1px dashed #f4d4b6" }}>
                    <strong style={{ fontSize: "0.85rem", color: "var(--text-strong)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {authUser.displayName}
                    </strong>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-soft)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {authUser.email}
                    </span>
                    <span className="pill neutral" style={{ display: "inline-block", fontSize: "0.62rem", marginTop: "0.3rem", padding: "0.1rem 0.35rem" }}>
                      {authUser.roles.join(", ")}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setActiveTab("profile");
                      setOpenProjectId(null);
                      setProfileDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      padding: "0.4rem 0.5rem",
                      fontSize: "0.82rem",
                      color: "#9a4f0f",
                      cursor: "pointer",
                      borderRadius: "6px"
                    }}
                  >
                    👤 Ver mi Perfil
                  </button>

                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      void logout();
                      setProfileDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      padding: "0.4rem 0.5rem",
                      fontSize: "0.82rem",
                      color: "#dc2626",
                      cursor: "pointer",
                      borderRadius: "6px"
                    }}
                  >
                    🚪 Cerrar Sesión
                  </button>
                </div>
            )}
          </div>
        </div>
      </header>

      {/* FX Drawer */}
      <FxDrawer open={fxDrawerOpen} onClose={() => setFxDrawerOpen(false)} fxConfigs={fxHook.fxConfigs} />

      {/* Body */}
      <div className="app-body">
        {/* Mobile sidebar backdrop */}
        {!sidebarCollapsed && (
          <div
            className="sidebar-backdrop"
            aria-hidden="true"
            onClick={() => setSidebarCollapsed(true)}
          />
        )}

        {/* Sidebar */}
        <nav className={`sidebar${sidebarCollapsed ? " collapsed" : ""}`} aria-label="Navegación principal">
          <div className="sidebar-header">
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
              title={sidebarCollapsed ? "Expandir" : "Colapsar"}
            >
              {sidebarCollapsed ? "→" : "←"}
            </button>
            <button
              type="button"
              className="sidebar-close-mobile"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Cerrar menú"
            >
              ✕
            </button>
          </div>

          {visibleGroups.map((group) => (
            <div className="sidebar-group" key={group.label}>
              <span className="sidebar-group-label">{group.label}</span>
              {group.tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`sidebar-tab${activeTab === tab.id ? " active" : ""}`}
                  onClick={() => { setActiveTab(tab.id); setSidebarCollapsed(true); if (tab.id !== "projects") setOpenProjectId(null); }}
                  title={tab.label}
                  aria-current={activeTab === tab.id ? "page" : undefined}
                >
                  <span className="sidebar-icon" aria-hidden="true">{tab.icon}</span>
                  <span className="sidebar-label">{tab.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Main content */}
        <main className="main-content">
          {error && (
            <div className="error-banner" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
              <span>{error}</span>
              <button
                type="button"
                className="ghost"
                onClick={() => setError(null)}
                style={{
                  padding: "0.15rem 0.45rem",
                  fontSize: "0.75rem",
                  color: "#b91c1c",
                  borderColor: "#fecaca",
                  background: "#fff1f2",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>
          )}
          {loading && <p className="loading">Cargando datos…</p>}

          {!loading && (
            <div key={activeTab + (openProjectId || "")} className="fade-in-section">
              {activeTab === "dashboard" && (
                <DashboardTab
                  projects={projectsHook.projects}
                  timeEntries={timeEntriesHook.timeEntries}
                  expenses={expensesHook.expenses}
                  forecasts={forecastsHook.forecasts}
                  fxConfigs={fxHook.fxConfigs}
                  initialStats={statsHook.stats}
                  initialBaseCurrency="USD"
                  onError={handleError}
                  onDrillTo={drillTo}
                />
              )}

              {activeTab === "portfolio" && (
                <PortfolioTab canWrite={can("projects:write")} onOpenProject={openProject} />
              )}

              {activeTab === "projects" && (
                openProjectId ? (
                  <ProjectDetailTab
                    projectId={openProjectId}
                    canWrite={can("projects:write")}
                    onBack={() => setOpenProjectId(null)}
                    onError={handleError}
                  />
                ) : (
                  <ProjectsTab
                    projects={projectsHook.projects}
                    loading={projectsHook.loading}
                    canWrite={can("projects:write")}
                    onReload={projectsHook.reload}
                    onError={handleError}
                    statsProjects={statsHook.stats?.projects}
                    onOpenProject={setOpenProjectId}
                  />
                )
              )}

              {activeTab === "consultants" && (
                <ConsultantsTab
                  consultants={consultantsHook.consultants}
                  loading={consultantsHook.loading}
                  canWrite={can("consultants:write")}
                  onReload={consultantsHook.reload}
                  onError={handleError}
                  onAssignConsultant={(id) => {
                    setPreselectedCapacityConsultantId(id);
                    setActiveTab("capacity");
                  }}
                />
              )}

              {activeTab === "timeEntries" && (
                <TimeEntriesTab
                  timeEntries={timeEntriesHook.timeEntries}
                  projects={projectsHook.projects}
                  consultants={consultantsHook.consultants}
                  loading={timeEntriesHook.loading}
                  canWrite={can("time:write")}
                  canReview={can("time:review")}
                  reviewerName={authUser.displayName}
                  onReload={timeEntriesHook.reload}
                  onError={handleError}
                />
              )}

              {activeTab === "expenses" && (
                <ExpensesTab
                  expenses={expensesHook.expenses}
                  projects={projectsHook.projects}
                  forecasts={forecastsHook.forecasts}
                  loading={expensesHook.loading}
                  canWrite={can("expenses:write")}
                  onReload={expensesHook.reload}
                  onError={handleError}
                  fxConfigs={fxHook.fxConfigs}
                  baseCurrency="USD"
                />
              )}

              {activeTab === "forecasts" && (
                <ForecastsTab
                  forecasts={forecastsHook.forecasts}
                  projects={projectsHook.projects}
                  consultants={consultantsHook.consultants}
                  loading={forecastsHook.loading}
                  canWrite={can("forecasts:write")}
                  onReload={forecastsHook.reload}
                  onError={handleError}
                />
              )}

              {activeTab === "revenue" && (
                <RevenueTab
                  revenueEntries={revenueHook.revenueEntries}
                  projects={projectsHook.projects}
                  loading={revenueHook.loading}
                  canWrite={can("revenue:write")}
                  onReload={revenueHook.reload}
                  onError={handleError}
                />
              )}

              {activeTab === "capacity" && (
                <CapacityTab
                  projects={projectsHook.projects}
                  consultants={consultantsHook.consultants}
                  canWrite={can("assignments:write")}
                  onError={handleError}
                  preselectedConsultantId={preselectedCapacityConsultantId}
                  onClearPreselectedConsultant={() => setPreselectedCapacityConsultantId(null)}
                />
              )}

              {activeTab === "fx" && (
                <FxTab
                  fxConfigs={fxHook.fxConfigs}
                  loading={fxHook.loading}
                  canWrite={can("fx:write") || can("users:manage")}
                  onReload={fxHook.reload}
                  onError={handleError}
                />
              )}

              {activeTab === "admin" && (
                <AdminTab
                  adminUsers={adminHook.adminUsers}
                  loading={adminHook.loading}
                  onReload={adminHook.reload}
                  onError={handleError}
                />
              )}

              {activeTab === "audit" && <AuditTab onError={handleError} />}

              {activeTab === "profile" && (
                <ProfileTab
                  authUser={authUser}
                  onRefreshAuth={bootstrap}
                  onError={handleError}
                />
              )}

              {activeTab === "extraHours" && (
                <ExtraHoursTab
                  projects={projectsHook.projects}
                  consultants={consultantsHook.consultants}
                  authUser={authUser}
                  can={can}
                  onError={handleError}
                />
              )}

              {activeTab === "extraHoursConfig" && (
                <ExtraHoursTab
                  projects={projectsHook.projects}
                  consultants={consultantsHook.consultants}
                  authUser={authUser}
                  can={can}
                  onError={handleError}
                  configModeOnly={true}
                />
              )}

              {activeTab === "estimations" && (
                <EstimationCalculatorTab
                  projects={projectsHook.projects}
                  canWrite={can("estimations:write")}
                  onError={handleError}
                />
              )}

              {activeTab === "activities" && (
                <ActivitiesTab
                  projects={projectsHook.projects}
                  consultants={consultantsHook.consultants}
                  authUser={authUser}
                  onError={handleError}
                  onDrillTo={drillTo}
                />
              )}

              {activeTab === "alerts" && (
                <AlertsTab
                  alerts={alertsHook.alerts}
                  unreadCount={alertsHook.unreadCount}
                  loading={alertsHook.loading}
                  canRun={can("users:manage")}
                  onReload={alertsHook.reload}
                  onError={handleError}
                />
              )}
            </div>
          )}
        </main>
      </div>

      <AppFooter
        onNavigate={setActiveTab}
        backendOk={health?.ok === true}
        appVersion="1.0.0"
        environment={import.meta.env.MODE === "production" ? "Producción" : "Demo"}
        onOpenFeedback={() => setFeedbackOpen(true)}
      />

      <RagChat
        projects={projectsHook.projects}
        statsProjects={statsHook.stats?.projects}
        fxConfigs={fxHook.fxConfigs}
        consultants={consultantsHook.consultants}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />

      {/* Shortcuts Help Modal */}
      {shortcutsHelpOpen && (
        <div className="modal-overlay" style={{ zIndex: 10001 }}>
          <div className="modal-card" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>⌨️ Atajos de Teclado</h3>
              <button type="button" className="ghost" onClick={() => setShortcutsHelpOpen(false)} style={{ padding: "0.2rem 0.5rem" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.85rem", padding: "0.5rem 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed #e2e8f0", paddingBottom: "0.3rem" }}>
                <strong>Alt + N</strong> <span>Dashboard</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed #e2e8f0", paddingBottom: "0.3rem" }}>
                <strong>Alt + H</strong> <span>Horas</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed #e2e8f0", paddingBottom: "0.3rem" }}>
                <strong>Alt + F</strong> <span>Proyecciones</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed #e2e8f0", paddingBottom: "0.3rem" }}>
                <strong>Alt + C</strong> <span>Consultores</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed #e2e8f0", paddingBottom: "0.3rem" }}>
                <strong>Ctrl + K</strong> <span>Abrir Asistente RAG</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed #e2e8f0", paddingBottom: "0.3rem" }}>
                <strong>Esc</strong> <span>Cerrar diálogos flotantes</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>?</strong> <span>Mostrar esta ayuda</span>
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: "1rem" }}>
              <button type="button" onClick={() => setShortcutsHelpOpen(false)} style={{ width: "100%", background: "linear-gradient(135deg, #ff9c2c, #9a4f0f)", border: "none" }}>Entendido</button>
            </div>
          </div>
        </div>
      )}

      {/* Global RAG Chat FAB */}
      <button
        type="button"
        onClick={() => setChatOpen((o) => !o)}
        className={`rag-chat-fab${chatOpen ? " is-open" : ""}`}
        title="Preguntar al Asistente IA (Ctrl+K)"
        aria-label="Preguntar al Asistente IA"
      >
        <span>🤖</span>
        <strong>Preguntar a la IA</strong>
      </button>

      {/* Feedback Modal */}
      {feedbackOpen && (
        <div className="modal-overlay" style={{ zIndex: 10001 }}>
          <form onSubmit={handleFeedbackSubmit} className="modal-card" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <h3>💬 Enviar Feedback del Sistema</h3>
              <button type="button" className="ghost" onClick={() => setFeedbackOpen(false)} style={{ padding: "0.2rem 0.5rem" }}>✕</button>
            </div>
            <div className="form-grid" style={{ gap: "0.8rem" }}>
              <div>
                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Categoría *</label>
                <select value={feedbackCategory} onChange={(e) => setFeedbackCategory(e.target.value)}>
                  <option value="BUG">Bug / Error de Sistema</option>
                  <option value="SUGGESTION">Sugerencia de Mejora</option>
                  <option value="AESTHETIC">UI/UX o Aspecto Estético</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Observaciones y Comentarios *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe detalladamente qué problema encontraste o qué mejora sugieres..."
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: "1rem" }}>
              <button type="button" className="ghost" onClick={() => setFeedbackOpen(false)}>Cancelar</button>
              <button type="submit" disabled={sendingFeedback} style={{ background: "linear-gradient(135deg, #ff9c2c, #9a4f0f)", border: "none" }}>
                {sendingFeedback ? "Enviando..." : "Enviar Comentarios"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

export default App;
