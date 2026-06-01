import { useCallback, useEffect, useRef, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

let _showToast: ((message: string, type?: ToastType) => void) | null = null;

export function useToastController() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const show = useCallback((message: string, type: ToastType = "success") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, 3500);
    timers.current.set(id, timer);
  }, []);

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    _showToast = show;
    return () => {
      if (_showToast === show) _showToast = null;
    };
  }, [show]);

  return { toasts, show, dismiss };
}

/** Call from any component — fires the nearest ToastContainer */
export function useToast() {
  const show = useCallback((message: string, type: ToastType = "success") => {
    _showToast?.(message, type);
  }, []);
  return { showToast: show };
}
