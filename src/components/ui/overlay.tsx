"use client";

import { m, type PanInfo, useDragControls } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}

const SPRING = { type: "spring", stiffness: 380, damping: 36, mass: 0.9 } as const;

type Props = {
  label: string;
  /** No celular, modal e drawer viram folha deslizante. */
  variant: "modal" | "drawer" | "palette";
  narrow?: boolean;
  onClose: () => void;
  children: ReactNode;
};

/**
 * O <dialog> nativo já resolve foco preso, Esc e fundo inerte. Fica montado durante a
 * saída (AnimatePresence no chamador) para a animação terminar antes de sumir.
 */
export function Overlay({ label, variant, narrow, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const mobile = useIsMobile();
  const dragControls = useDragControls();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
      if (dialog.open) dialog.close();
      previous?.focus?.();
    };
  }, []);

  const asSheet = mobile && variant !== "palette";

  const panel = asSheet
    ? {
        className: "sheet",
        initial: { y: "100%" },
        animate: { y: 0 },
        exit: { y: "100%" },
      }
    : variant === "drawer"
      ? {
          className: "drawer",
          initial: { x: "100%" },
          animate: { x: 0 },
          exit: { x: "100%" },
        }
      : {
          className: `modal${narrow ? " narrow" : ""}${variant === "palette" ? " palette" : ""}`,
          initial: { opacity: 0, y: 14, scale: 0.97 },
          animate: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: 8, scale: 0.98 },
        };

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 110 || info.velocity.y > 600) onClose();
  }

  const body = (
    <m.section
      {...panel}
      transition={SPRING}
      role="document"
      aria-label={label}
      {...(asSheet ? {
        drag: "y" as const,
        dragControls,
        dragListener: false,
        dragConstraints: { top: 0, bottom: 0 },
        dragElastic: { top: 0, bottom: 0.7 },
        onDragEnd,
      } : {})}
    >
      {asSheet ? (
        <div className="grab-zone" onPointerDown={(event) => dragControls.start(event)}>
          <div className="grab" />
        </div>
      ) : null}
      {children}
    </m.section>
  );

  return (
    <dialog
      ref={ref}
      className="host"
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <m.div className="dim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={onClose} />
      {asSheet || variant === "drawer" ? body : (
        <div className={`host-center${variant === "palette" ? " pal" : ""}`}>{body}</div>
      )}
    </dialog>
  );
}
