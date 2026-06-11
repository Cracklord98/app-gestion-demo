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
  isOpen: boolean;
  onClose: () => void;
};

export function RagChat({ projects, fxConfigs, isOpen, onClose }: RagChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial",
      sender: "bot",
      text: "¡Hola! Soy el asistente RAG de Synaptica. Puedo responder tus preguntas sobre los proyectos, presupuestos o tasas de cambio de esta demo. Intenta preguntar por 'proyectos', 'presupuesto' o 'tasas de cambio'.",
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

      if (query.includes("proyecto") || query.includes("cuántos") || query.includes("lista")) {
        const count = projects.length;
        const activeCount = projects.filter(p => p.status === "ACTIVE").length;
        botText = `Actualmente hay ${count} proyectos en el sistema, de los cuales ${activeCount} están activos.`;
        if (projects.length > 0) {
          botText += ` Algunos proyectos destacados son: ${projects.slice(0, 3).map(p => p.name).join(", ")}.`;
        }
        sources = ["Base de datos: Tabla Project", "Controlador: listProjects"];
      } else if (query.includes("presupuesto") || query.includes("costo") || query.includes("budget")) {
        const totalBudget = projects.reduce((acc, p) => acc + Number(p.budget), 0);
        botText = `El presupuesto total consolidado de todos los proyectos registrados es de $${totalBudget.toLocaleString("es-CO")} ${projects[0]?.currency || "USD"}.`;
        sources = ["Modelo Prisma: Project.budget", "Cálculo en vivo de Agregación"];
      } else if (query.includes("tasa") || query.includes("dolar") || query.includes("divisa") || query.includes("cambio") || query.includes("fx")) {
        if (fxConfigs.length === 0) {
          botText = "No hay tasas de cambio (FX) configuradas actualmente.";
        } else {
          botText = `Las tasas de cambio configuradas son:\n` + 
            fxConfigs.map(fx => `• ${fx.baseCode} a ${fx.quoteCode}: ${Number(fx.rate).toLocaleString("es-CO")}`).join("\n");
        }
        sources = ["Base de datos: Tabla FxConfig", "Módulo Financiero"];
      } else if (query.includes("ayuda") || query.includes("hola") || query.includes("qué haces")) {
        botText = "Puedo ayudarte con información consolidada sobre tus proyectos. Prueba a preguntar:\n" +
          "1. ¿Cuántos proyectos hay registrados?\n" +
          "2. ¿Cuál es el presupuesto total consolidado?\n" +
          "3. Ver tasas de cambio configuradas.";
        sources = ["Documentación del Asistente RAG"];
      } else {
        botText = "Lo siento, no encontré documentos específicos con esa palabra clave en esta demo. Intenta preguntar sobre 'proyectos', 'presupuesto' o 'tasas de cambio'.";
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
        <button
          type="button"
          onClick={onClose}
          style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "1rem" }}
        >
          ✕
        </button>
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
