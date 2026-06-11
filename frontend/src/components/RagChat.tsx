import React, { useState, useEffect, useRef } from "react";
import { type Project, type FxConfig } from "../services/api";

type Message = {
  id: string;
  sender: "user" | "bot";
  text: string;
  sources?: string[];
  timestamp: Date;
};

type RagChatProps = {
  projects: Project[];
  fxConfigs: FxConfig[];
  consultants?: any[];
  isOpen: boolean;
  onClose: () => void;
};

export function RagChat({ projects, fxConfigs, consultants = [], isOpen, onClose }: RagChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial",
      sender: "bot",
      text: "¡Hola! Soy el asistente inteligente de Synaptica. Puedo responder tus preguntas sobre los proyectos, presupuestos, consultores o tasas de cambio de esta demo. Intenta preguntar por 'proyectos en riesgo', el nombre de algún proyecto o un consultor.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    const userMsg: Message = {
      id: Math.random().toString(),
      sender: "user",
      text: userText,
      timestamp: new Date()
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate RAG retrieval and generation
    setTimeout(() => {
      let botText = "";
      let sources: string[] = [];

      const query = userText.toLowerCase();

      // 1. Check if user is asking about a specific project
      let matchedProject = null;
      for (const p of projects) {
        if (query.includes(p.name.toLowerCase()) || (p.code && query.includes(p.code.toLowerCase()))) {
          matchedProject = p;
          break;
        }
      }

      // 2. Check if user is asking about a specific consultant
      let matchedConsultant = null;
      if (consultants && consultants.length > 0) {
        for (const c of consultants) {
          const nameLower = c.fullName.toLowerCase();
          const first = nameLower.split(" ")[0];
          if (query.includes(nameLower) || (first && first.length > 2 && query.includes(first))) {
            matchedConsultant = c;
            break;
          }
        }
      }

      if (matchedProject) {
        const dc = matchedProject.displayCurrency || "USD";
        const budgetVal = Number(matchedProject.budget || 0).toLocaleString("es-CO");
        const spentVal = Number(matchedProject.spent || 0).toLocaleString("es-CO");
        const remVal = Number(matchedProject.remainingBudget || 0).toLocaleString("es-CO");
        const statusText = matchedProject.status === "ACTIVE" ? "Activo 🟢" : "Completado 🔵";

        botText = `Encontré información del proyecto **${matchedProject.name}**:\n\n` +
          `• **Código**: ${matchedProject.code || "—"}\n` +
          `• **Cliente**: ${matchedProject.clientName || matchedProject.company || "—"}\n` +
          `• **Estado**: ${statusText}\n` +
          `• **Presupuesto**: $${budgetVal} ${dc}\n` +
          `• **Gastado**: $${spentVal} ${dc}\n` +
          `• **Disponible**: $${remVal} ${dc}\n\n` +
          `${matchedProject.remainingBudget < 0 ? "⚠️ ¡Atención! El proyecto ha superado su presupuesto." : "El presupuesto se encuentra dentro de los límites normales."}`;
        
        sources = [`Base de datos: Tabla Project (ID: ${matchedProject.id})`, `Campos: budget, spent, remainingBudget`];

      } else if (matchedConsultant) {
        const rateVal = Number(matchedConsultant.hourlyRate || 0).toLocaleString("es-CO");
        const emailText = matchedConsultant.email || "Sin correo registrado";
        botText = `Aquí tienes los detalles del consultor **${matchedConsultant.fullName}**:\n\n` +
          `• **Rol/Nivel**: ${matchedConsultant.role || "Consultor"}\n` +
          `• **Especialidad**: ${matchedConsultant.specialization || "General"}\n` +
          `• **Correo**: ${emailText}\n` +
          `• **Tarifa Estándar**: $${rateVal} COP/hora\n` +
          `• **Estado**: Activo en plataforma`;
        
        sources = [`Base de datos: Tabla Consultant (ID: ${matchedConsultant.id})`, `Campos: fullName, role, hourlyRate`];

      } else if (query.includes("alerta") || query.includes("riesgo") || query.includes("excedido") || query.includes("limite")) {
        const projectsInRisk = projects.filter(p => p.alertLevel === "warn" || p.alertLevel === "exceeded" || p.remainingBudget < 0);
        if (projectsInRisk.length === 0) {
          botText = "¡Excelentes noticias! Actualmente no hay proyectos registrados con nivel de alerta crítica o presupuesto excedido.";
        } else {
          botText = `Se detectaron **${projectsInRisk.length} proyectos en riesgo**:\n\n` +
            projectsInRisk.map(p => {
              const statusSymbol = p.alertLevel === "exceeded" || p.remainingBudget < 0 ? "🔴 EXCEDIDO" : "🟡 ADVERTENCIA";
              const pctText = p.projectedPct ? `(${p.projectedPct.toFixed(1)}% del presupuesto)` : "";
              return `• **${p.name}**: ${statusSymbol} ${pctText}`;
            }).join("\n");
        }
        sources = ["Motor de Reglas Financieras", "Cálculo de Proyecciones de Costo"];

      } else if (query.includes("proyecto") || query.includes("cuántos") || query.includes("lista")) {
        const count = projects.length;
        const activeCount = projects.filter(p => p.status === "ACTIVE").length;
        botText = `Actualmente hay **${count} proyectos** registrados en total, de los cuales **${activeCount}** se encuentran en estado activo.\n\n` +
          `Algunos proyectos en curso:\n` +
          projects.slice(0, 4).map(p => `• ${p.name} (Cliente: ${p.company || "—"})`).join("\n");
        sources = ["Base de datos: Tabla Project", "Controlador: listProjects"];

      } else if (query.includes("presupuesto") || query.includes("costo") || query.includes("budget")) {
        const totalBudget = projects.reduce((acc, p) => acc + Number(p.budget || 0), 0);
        const totalSpent = projects.reduce((acc, p) => acc + Number(p.spent || 0), 0);
        botText = `El resumen financiero consolidado de todo el portafolio es:\n\n` +
          `• **Presupuesto Total**: $${totalBudget.toLocaleString("es-CO")} USD\n` +
          `• **Gasto Real Acumulado**: $${totalSpent.toLocaleString("es-CO")} USD\n` +
          `• **Eficiencia General**: ${totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}% ejecutado.`;
        sources = ["Agregación de Presupuestos BAC/spent", "Módulo Financiero"];

      } else if (query.includes("tasa") || query.includes("dolar") || query.includes("divisa") || query.includes("cambio") || query.includes("fx")) {
        if (fxConfigs.length === 0) {
          botText = "No hay tasas de cambio (FX) configuradas actualmente en el sistema.";
        } else {
          botText = `Las tasas de cambio (FX) configuradas son:\n\n` +
            fxConfigs.map(fx => `• **1 ${fx.baseCode}** = ${Number(fx.rate).toLocaleString("es-CO", { maximumFractionDigits: 4 })} ${fx.quoteCode}`).join("\n");
        }
        sources = ["Base de datos: Tabla FxConfig", "Módulo de Conversión Multimoneda"];

      } else if (query.includes("ayuda") || query.includes("hola") || query.includes("qué haces") || query.includes("buenos dias")) {
        botText = "¡Hola! Soy el asistente inteligente de Synaptica. Puedo consultar en tiempo real los datos del portafolio. Intenta preguntarme cosas como:\n\n" +
          "• *'¿Qué proyectos están en riesgo?'*\n" +
          "• *'Presupuesto de [nombre del proyecto]'*\n" +
          "• *'¿Cuánto es el presupuesto total consolidado?'*\n" +
          "• *'Información sobre el consultor [nombre]'*\n" +
          "• *'Ver tasas de cambio (FX) configuradas'*";
        sources = ["Documentación del Asistente RAG"];

      } else {
        botText = "Lo siento, no encontré registros específicos para esa consulta en la base de datos de esta demo.\n\n" +
          "Intenta preguntar sobre 'proyectos en riesgo', el nombre de un proyecto (ej. 'Portal Clientes'), o un consultor (ej. 'Sandra' o 'Carlos').";
        sources = ["Búsqueda Semántica Vacía"];
      }

      const botMsg: Message = {
        id: Math.random().toString(),
        sender: "bot",
        text: botText,
        sources,
        timestamp: new Date()
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <div style={{
      position: "fixed",
      bottom: "85px",
      right: "20px",
      width: "350px",
      height: "450px",
      background: "rgba(255, 255, 255, 0.95)",
      backdropFilter: "blur(12px)",
      border: "1px solid #f4d4b6",
      borderRadius: "16px",
      boxShadow: "0 8px 32px rgba(154, 79, 15, 0.18)",
      display: "flex",
      flexDirection: "column",
      zIndex: 10000,
      overflow: "hidden",
      animation: "fadeInUp 0.25s ease forwards"
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #ff9c2c, #9a4f0f)",
        color: "#fff",
        padding: "0.85rem 1rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.2rem" }}>🤖</span>
          <div>
            <h4 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700 }}>Asistente RAG</h4>
            <span style={{ fontSize: "0.65rem", opacity: 0.9 }}>Búsqueda Semántica Demo</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <button
            type="button"
            onClick={() => {
              setMessages([
                {
                  id: "initial",
                  sender: "bot",
                  text: "Conversación reiniciada. ¿En qué puedo ayudarte hoy?",
                  timestamp: new Date()
                }
              ]);
            }}
            title="Limpiar conversación"
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontSize: "0.95rem",
              padding: "0.2rem",
              opacity: 0.8,
              display: "flex",
              alignItems: "center"
            }}
          >
            🗑️
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontSize: "1rem",
              padding: "0.2rem",
              display: "flex",
              alignItems: "center"
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          padding: "1rem",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          background: "#fff9f2"
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              display: "flex",
              flexDirection: "column",
              gap: "0.2rem"
            }}
          >
            <div style={{
              background: msg.sender === "user" ? "linear-gradient(135deg, #ff9c2c, #9a4f0f)" : "#fff",
              color: msg.sender === "user" ? "#fff" : "var(--text-strong)",
              padding: "0.65rem 0.85rem",
              borderRadius: msg.sender === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
              fontSize: "0.8rem",
              border: msg.sender === "user" ? "none" : "1px solid #f4d4b6",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
              whiteSpace: "pre-line"
            }}>
              {msg.text}
            </div>

            {msg.sources && msg.sources.length > 0 && (
              <div style={{
                fontSize: "0.62rem",
                color: "#9a4f0f",
                fontStyle: "italic",
                alignSelf: "flex-start",
                paddingLeft: "4px"
              }}>
                Fuentes: {msg.sources.join(" | ")}
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div style={{ alignSelf: "flex-start", background: "#fff", border: "1px solid #f4d4b6", padding: "0.5rem 0.85rem", borderRadius: "12px 12px 12px 2px", fontSize: "0.8rem", color: "var(--text-soft)" }}>
            Generando respuesta... ⏳
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} style={{ display: "flex", padding: "0.5rem", borderTop: "1px solid #f4d4b6", background: "#fff" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe una pregunta (Ctrl+K)..."
          style={{
            flex: 1,
            border: "1px solid #cbd5e1",
            borderRadius: "20px",
            padding: "0.45rem 0.85rem",
            fontSize: "0.8rem",
            outline: "none"
          }}
        />
        <button
          type="submit"
          style={{
            background: "linear-gradient(135deg, #ff9c2c, #9a4f0f)",
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            marginLeft: "0.4rem",
            display: "grid",
            placeItems: "center",
            cursor: "pointer"
          }}
        >
          ➔
        </button>
      </form>
    </div>
  );
}
