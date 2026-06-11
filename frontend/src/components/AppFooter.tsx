/**
 * AppFooter — Footer corporativo de la plataforma.
 * Incluye: brand + tagline, navegación rápida y barra de estado técnico.
 * Se coloca al fondo del shell, fuera del app-body.
 */

import type { TabId } from "../types";

const NAV_LINKS: { label: string; tab: TabId }[] = [
  { label: "Dashboard",    tab: "dashboard" },
  { label: "Proyectos",    tab: "projects" },
  { label: "Portafolio",   tab: "portfolio" },
  { label: "Consultores",  tab: "consultants" },
  { label: "Gastos",       tab: "expenses" },
  { label: "Ingresos",     tab: "revenue" },
  { label: "Proyecciones", tab: "forecasts" },
  { label: "Capacidad",    tab: "capacity" },
];

export interface AppFooterProps {
  onNavigate: (tab: TabId) => void;
  backendOk?: boolean;
  appVersion?: string;
  environment?: string;
  onOpenFeedback?: () => void;
}

function PyramidLogoSmall() {
  return (
    <svg
      width={28}
      height={26}
      viewBox="0 0 100 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <polygon points="50,0 0,90 50,90" fill="#E8A020" />
      <polygon points="50,0 50,90 100,90" fill="#7A3C10" />
    </svg>
  );
}

export function AppFooter({
  onNavigate,
  backendOk,
  appVersion = "1.0.0",
  environment = "Demo",
  onOpenFeedback,
}: AppFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer" role="contentinfo">
      {/* ── Top section ──────────────────────────────────────────────── */}
      <div className="app-footer__top">

        {/* Brand */}
        <div className="app-footer__brand">
          <div className="app-footer__logo">
            <PyramidLogoSmall />
          </div>
          <div>
            <p className="app-footer__app-name">App Gestión Demo</p>
            <p className="app-footer__tagline">
              Plataforma integral de gestión de proyectos, horas, gastos y proyecciones financieras.
            </p>
            <p className="app-footer__copy">
              &copy; {year} Synaptica. Todos los derechos reservados.
            </p>
          </div>
        </div>

        {/* Nav rápida */}
        <nav className="app-footer__nav" aria-label="Navegación del pie de página">
          <p className="app-footer__nav-title">Navegación rápida</p>
          <ul className="app-footer__nav-list">
            {NAV_LINKS.map(({ label, tab }) => (
              <li key={tab}>
                <button
                  type="button"
                  className="app-footer__nav-link"
                  onClick={() => onNavigate(tab)}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* ── Bottom status bar ─────────────────────────────────────────── */}
      <div className="app-footer__bar">
        <div className="app-footer__bar-left">
          <span className="app-footer__badge">
            v{appVersion}
          </span>
          <span className="app-footer__badge app-footer__badge--env">
            {environment}
          </span>
          <span
            className={`app-footer__badge ${
              backendOk === undefined
                ? "app-footer__badge--neutral"
                : backendOk
                ? "app-footer__badge--ok"
                : "app-footer__badge--error"
            }`}
          >
            {backendOk === undefined
              ? "⋯ Verificando backend"
              : backendOk
              ? "✓ Backend activo"
              : "✕ Backend inactivo"}
          </span>
        </div>
        <p className="app-footer__bar-right">
          {onOpenFeedback && (
            <button
              type="button"
              onClick={onOpenFeedback}
              className="app-footer__feedback-btn"
            >
              💬 Enviar Feedback
            </button>
          )}
          <span>Construido con React + TypeScript · Synaptica {year}</span>
        </p>
      </div>
    </footer>
  );
}
