"use client";

import { AnimatePresence, m } from "motion/react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icon";

type Toast = { id: number; message: string; tone: "ok" | "error"; action?: { label: string; run: () => void } };
type Show = (message: string, options?: { tone?: Toast["tone"]; action?: Toast["action"] }) => void;

const Context = createContext<Show>(() => {});

export const useToast = () => useContext(Context);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const show = useCallback<Show>((message, options) => {
    const id = nextId.current++;
    setToasts((all) => [...all.slice(-2), { id, message, tone: options?.tone ?? "ok", action: options?.action }]);
    setTimeout(() => dismiss(id), options?.action ? 6000 : 3500);
  }, [dismiss]);

  const value = useMemo(() => show, [show]);

  return (
    <Context.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <m.div
              key={toast.id}
              className="toast"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
            >
              <Icon name={toast.tone === "error" ? "warn" : "check"} size="s" />
              <span className="f1">{toast.message}</span>
              {toast.action ? (
                <button type="button" onClick={() => { toast.action?.run(); dismiss(toast.id); }}>{toast.action.label}</button>
              ) : null}
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </Context.Provider>
  );
}
