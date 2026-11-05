"use client";

import { domMax, LazyMotion, MotionConfig } from "motion/react";
import { createContext, useContext, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";

type App = { today: string; timezone: string };

const Context = createContext<App>({ today: "", timezone: "America/Sao_Paulo" });

export const useApp = () => useContext(Context);

export function AppProviders({ today, timezone, children }: App & { children: ReactNode }) {
  return (
    <Context.Provider value={{ today, timezone }}>
      <LazyMotion features={domMax} strict>
        <MotionConfig reducedMotion="user">
          <ToastProvider>{children}</ToastProvider>
        </MotionConfig>
      </LazyMotion>
    </Context.Provider>
  );
}
