/**
 * useToast.ts + ToastContainer.tsx
 * Sistema di notifiche toast leggero, senza dipendenze esterne.
 * Sostituisce i console.error silenziosi con feedback visivo per l'utente.
 *
 * Utilizzo:
 *   const { toast } = useToast();
 *   toast.success("Fumetto salvato!");
 *   toast.error("Errore di connessione");
 *   toast.info("Sincronizzati 3 fumetti");
 */

import React, { useState, useCallback, useRef, useEffect, createContext, useContext } from "react";

// --- Types -------------------------------------------------------------------

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number; // ms, default 4000
}

// --- Context -----------------------------------------------------------------

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, type: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// --- Provider ----------------------------------------------------------------

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType, duration = 4000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => {
        // Evita duplicati consecutivi identici
        if (prev.length > 0 && prev[prev.length - 1].message === message) return prev;
        return [...prev.slice(-4), { id, message, type, duration }]; // max 5 toast visibili
      });
      if (duration > 0) {
        timers.current.set(id, setTimeout(() => removeToast(id), duration));
      }
    },
    [removeToast]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    const t = timers.current;
    return () => { t.forEach(clearTimeout); t.clear(); };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

// --- Hook --------------------------------------------------------------------

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");

  const toast = {
    success: (msg: string, duration?: number) => ctx.addToast(msg, "success", duration),
    error: (msg: string, duration?: number) => ctx.addToast(msg, "error", duration ?? 6000),
    info: (msg: string, duration?: number) => ctx.addToast(msg, "info", duration),
    warning: (msg: string, duration?: number) => ctx.addToast(msg, "warning", duration),
  };

  return { toast, toasts: ctx.toasts, removeToast: ctx.removeToast };
}

// --- ToastContainer ----------------------------------------------------------

const ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "i",
  warning: "⚠",
};

const COLORS: Record<ToastType, { border: string; icon: string; text: string }> = {
  success: { border: "#22c55e", icon: "#22c55e", text: "#dcfce7" },
  error:   { border: "#ef4444", icon: "#ef4444", text: "#fee2e2" },
  info:    { border: "#f59e0b", icon: "#f59e0b", text: "#fef3c7" },
  warning: { border: "#f97316", icon: "#f97316", text: "#ffedd5" },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [visible, setVisible] = useState(false);
  const c = COLORS[toast.type];

  useEffect(() => {
    // Breve delay per trigger CSS transition all'entrata
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      onClick={onRemove}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        background: "#0f172a",
        border: `1px solid ${c.border}30`,
        borderLeft: `3px solid ${c.border}`,
        borderRadius: "10px",
        padding: "12px 14px",
        cursor: "pointer",
        maxWidth: "360px",
        width: "100%",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(20px)",
        transition: "opacity 0.2s ease, transform 0.2s ease",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          background: `${c.icon}20`,
          color: c.icon,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "11px",
          fontWeight: 700,
          marginTop: "1px",
        }}
      >
        {ICONS[toast.type]}
      </span>
      <span style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: "1.5", flex: 1 }}>
        {toast.message}
      </span>
    </div>
  );
}

function ToastContainer() {
  const ctx = useContext(ToastContext);
  if (!ctx || ctx.toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      {ctx.toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: "auto" }}>
          <ToastItem toast={t} onRemove={() => ctx.removeToast(t.id)} />
        </div>
      ))}
    </div>
  );
}
