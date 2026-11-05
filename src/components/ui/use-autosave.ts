"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "saving" | "saved" | "error";

/**
 * Salva `delay` ms depois da última alteração e, ao sair da página ou desmontar, envia o
 * que estiver pendente para não perder o que acabou de ser digitado.
 */
export function useAutosave<T>(save: (value: T) => Promise<boolean>, delay = 700) {
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ value: T } | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const current = pending.current;
    if (!current) return;
    pending.current = null;
    setStatus("saving");
    const ok = await saveRef.current(current.value);
    setStatus(ok ? "saved" : "error");
  }, []);

  const schedule = useCallback((value: T) => {
    pending.current = { value };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, delay);
  }, [delay, flush]);

  useEffect(() => {
    const onHide = () => { void flush(); };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      void flush();
    };
  }, [flush]);

  return { schedule, flush, status };
}
