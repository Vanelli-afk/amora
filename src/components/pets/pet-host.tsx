"use client";

import { AnimatePresence } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { petOptions } from "@/actions/pets";
import { useApp } from "@/components/shell/app-context";
import { useToast } from "@/components/ui/toast";
import { closeOverlay } from "@/components/ui/url-state";
import { AppointmentModal, type PetOpt } from "./forms";

/** Abre o compromisso de pet por `?novo=pet-compromisso`, em qualquer tela do app. */
export function PetHost() {
  const open = useSearchParams().get("novo") === "pet-compromisso";
  const { today } = useApp();
  const toast = useToast();
  const [pets, setPets] = useState<PetOpt[] | null>(null);

  useEffect(() => {
    if (!open) { setPets(null); return; }
    let alive = true;
    (async () => {
      const result = await petOptions({});
      if (!alive) return;
      if (!result.ok) { toast(result.error, { tone: "error" }); closeOverlay(["novo"]); return; }
      setPets(result.data);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez a cada abertura
  }, [open]);

  return (
    <AnimatePresence>
      {open && pets ? <AppointmentModal key="pet-appointment" pets={pets} today={today} onClose={() => closeOverlay(["novo"])} /> : null}
    </AnimatePresence>
  );
}
