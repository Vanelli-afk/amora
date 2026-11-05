"use client";

import { AnimatePresence } from "motion/react";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import { useApp } from "@/components/shell/app-context";
import { closeOverlay } from "@/components/ui/url-state";
import { isValidDay } from "@/lib/dates";

// Só baixados quando abertos: a primeira carga fica leve.
const ItemModal = dynamic(() => import("./item-modal").then((m) => m.ItemModal), { ssr: false });
const EventDrawer = dynamic(() => import("./event-drawer").then((m) => m.EventDrawer), { ssr: false });

const KINDS = ["compromisso", "tarefa", "nota", "lembrete"] as const;
export type ItemKind = (typeof KINDS)[number];

const UUID = /^[0-9a-f-]{36}$/i;

/** Lê os painéis da URL. `?novo=tarefa`, `?evento=<id>&data=<dia>`. */
export function ItemHost() {
  const params = useSearchParams();
  const pathname = usePathname();
  const { today } = useApp();

  const novo = params.get("novo");
  const kind = KINDS.find((k) => k === novo);
  const editId = params.get("editar");
  const eventId = params.get("evento");
  const dataParam = params.get("data");
  const pathDay = pathname.startsWith("/dia/") ? pathname.slice(5) : null;
  const day = dataParam && isValidDay(dataParam) ? dataParam : pathDay && isValidDay(pathDay) ? pathDay : today;

  const closeNew = () => closeOverlay(["novo", "editar", "data"]);
  const closeEvent = () => closeOverlay(["evento", "data"]);

  return (
    <AnimatePresence>
      {kind ? (
        <ItemModal
          key="item-modal"
          kind={kind}
          date={day}
          editId={editId && UUID.test(editId) ? editId : null}
          onClose={closeNew}
        />
      ) : null}
      {!kind && eventId && UUID.test(eventId) ? (
        <EventDrawer key="event-drawer" id={eventId} occurrence={day} onClose={closeEvent} />
      ) : null}
    </AnimatePresence>
  );
}
