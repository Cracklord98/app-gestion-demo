import { useCallback, useEffect, useMemo, useState } from "react";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { env } from "./config/env";
import { apiTokenRequest, loginRequest } from "./auth/msal";
import {
  getHealth, getMe, setApiAccessToken,
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
import type { TabId } from "./types";
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
      { id: "alerts",     label: "Alertas PMO", icon: "🔔", permission: "stats:read" },
    ],
  },
  {
    label: "Operación",
    tabs: [
      { id: "consultants",  label: "Consultores",   icon: "◐", permission: "consultants:read" },
      { id: "timeEntries",  label: "Horas",          icon: "⊙", permission: "time:read" },
      { id: "expenses",     label: "Gastos",         icon: "⊟", permission: "expenses:read" },
    ],
  },
  {
    label: "Financiero",
    tabs: [
      { id: "revenue",    label: "Ingresos",      icon: "⊕", permission: "revenue:read" },
      { id: "forecasts",  label: "Proyecciones",  icon: "◷", permission: "forecasts:read" },
      { id: "fx",         label: "Tasas FX",      icon: "⊗", permission: "fx:read" },
    ],
  },
  {
    label: "Administración",
    tabs: [
      { id: "admin", label: "Usuarios",  icon: "◐", permission: "users:manage" },
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
      redirectStartPage: `${window.location.origin}/home`,
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

// ── App ─────────────────────────────────────────────────────────────────────

function App() {
  const microsoftConfigured = Boolean(env.azureClientId && env.azureTenantId);
  const authWithMicrosoftEnabled = microsoftConfigured && !env.forceLocalAuth;
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [currentPath, setCurrentPath] = useState(() => (window.location.pathname || "/").toLowerCase());
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [fxDrawerOpen, setFxDrawerOpen] = useState(false);

  const { toasts, show: showToast, dismiss } = useToastController();

  const permissions = useMemo(() => authUser?.permissions ?? [], [authUser?.permissions]);
  const can = useCallback((p: string) => permissions.includes(p), [permissions]);

  // Domain hooks
  const projectsHook    = useProjects(!!authUser && can("projects:read"));
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

  const goTo = useCallback((path: "/login" | "/home", replace = false) => {
    if (replace) window.history.replaceState({}, "", path);
    else window.history.pushState({}, "", path);
    setCurrentPath(path);
  }, []);

  useEffect(() => {
    const onPopState = () => setCurrentPath((window.location.pathname || "/").toLowerCase());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (currentPath !== "/login" && currentPath !== "/home") {
      goTo(authUser ? "/home" : "/login", true);
    }
  }, [currentPath, authUser, goTo]);

  useEffect(() => {
    if (!allVisibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab(allVisibleTabs[0]?.id ?? "dashboard");
    }
  }, [allVisibleTabs, activeTab]);

  const bootstrap = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const healthResult = await getHealth();
      setHealth(healthResult);
      if (authWithMicrosoftEnabled) {
        if (!isAuthenticated || !accounts[0]) {
          setAuthUser(null);
          if (currentPath !== "/login") goTo("/login", true);
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
      setAuthUser(me);
      if (currentPath !== "/home") goTo("/home", true);
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
    setAuthUser(null);
    goTo("/login", true);
    if (authWithMicrosoftEnabled) {
      await instance.logoutRedirect({ postLogoutRedirectUri: `${window.location.origin}/login` });
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
                <button type="button"
                  onClick={() => void instance.loginRedirect({ ...loginRequest, redirectStartPage: `${window.location.origin}/home` })}>
                  Iniciar sesión con Microsoft
                </button>
              </>
            )
          ) : (
            <p>Modo demo activo sin login Microsoft.</p>
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
          <span className="pill neutral" style={{ fontSize: "0.72rem" }}>
            {authUser.displayName} ({authUser.roles.join(", ")})
          </span>
          <button type="button" className="ghost" onClick={() => setFxDrawerOpen(true)}
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
          <button type="button" className="ghost" onClick={() => void logout()}>
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* FX Drawer */}
      <FxDrawer open={fxDrawerOpen} onClose={() => setFxDrawerOpen(false)} fxConfigs={fxHook.fxConfigs} />

      {/* Body */}
      <div className="app-body">
        {/* Sidebar */}
        <nav className={`sidebar${sidebarCollapsed ? " collapsed" : ""}`} aria-label="Navegación principal">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
            title={sidebarCollapsed ? "Expandir" : "Colapsar"}
          >
            {sidebarCollapsed ? "→" : "←"}
          </button>

          {visibleGroups.map((group) => (
            <div className="sidebar-group" key={group.label}>
              <span className="sidebar-group-label">{group.label}</span>
              {group.tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`sidebar-tab${activeTab === tab.id ? " active" : ""}`}
                  onClick={() => { setActiveTab(tab.id); if (tab.id !== "projects") setOpenProjectId(null); }}
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
          {error && <p className="error-banner">{error}</p>}
          {loading && <p className="loading">Cargando datos…</p>}

          {!loading && activeTab === "dashboard" && (
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

          {!loading && activeTab === "portfolio" && (
            <PortfolioTab canWrite={can("projects:write")} onOpenProject={openProject} />
          )}

          {!loading && activeTab === "projects" && (
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

          {!loading && activeTab === "consultants" && (
            <ConsultantsTab
              consultants={consultantsHook.consultants}
              loading={consultantsHook.loading}
              canWrite={can("consultants:write")}
              onReload={consultantsHook.reload}
              onError={handleError}
            />
          )}

          {!loading && activeTab === "timeEntries" && (
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

          {!loading && activeTab === "expenses" && (
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

          {!loading && activeTab === "forecasts" && (
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

          {!loading && activeTab === "revenue" && (
            <RevenueTab
              revenueEntries={revenueHook.revenueEntries}
              projects={projectsHook.projects}
              loading={revenueHook.loading}
              canWrite={can("revenue:write")}
              onReload={revenueHook.reload}
              onError={handleError}
            />
          )}

          {!loading && activeTab === "capacity" && (
            <CapacityTab
              projects={projectsHook.projects}
              consultants={consultantsHook.consultants}
              canWrite={can("assignments:write")}
              onError={handleError}
            />
          )}

          {!loading && activeTab === "fx" && (
            <FxTab
              fxConfigs={fxHook.fxConfigs}
              loading={fxHook.loading}
              canWrite={can("fx:write") || can("users:manage")}
              onReload={fxHook.reload}
              onError={handleError}
            />
          )}

          {!loading && activeTab === "admin" && (
            <AdminTab
              adminUsers={adminHook.adminUsers}
              loading={adminHook.loading}
              onReload={adminHook.reload}
              onError={handleError}
            />
          )}

          {!loading && activeTab === "audit" && <AuditTab onError={handleError} />}

          {!loading && activeTab === "alerts" && (
            <AlertsTab
              alerts={alertsHook.alerts}
              unreadCount={alertsHook.unreadCount}
              loading={alertsHook.loading}
              canRun={can("users:manage")}
              onReload={alertsHook.reload}
              onError={handleError}
            />
          )}
        </main>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

export default App;
