"use client";

import { animate, m, type PanInfo, useDragControls, useMotionValue, useTransform } from "motion/react";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, type PointerEvent, type ReactNode } from "react";

// Sobrevive à troca de página para o novo dia entrar pelo lado certo.
let lastDirection = 0;

const THRESHOLD_PX = 90;
const THRESHOLD_VELOCITY = 500;

const isTyping = (el: EventTarget | null) => {
  const node = el as HTMLElement | null;
  return !!node && (node.tagName === "INPUT" || node.tagName === "TEXTAREA" || node.tagName === "SELECT" || node.isContentEditable);
};

export function DaySwiper({ prevHref, nextHref, children }: { prevHref: string; nextHref: string; children: ReactNode }) {
  const router = useRouter();
  const controls = useDragControls();
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-260, 0, 260], [0.35, 1, 0.35]);
  const entering = useRef(lastDirection);
  const leaving = useRef(false);

  useEffect(() => {
    lastDirection = 0;
  }, []);

  function go(direction: 1 | -1) {
    if (leaving.current) return;
    leaving.current = true;
    lastDirection = direction;
    const href = direction === 1 ? nextHref : prevHref;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      startTransition(() => router.push(href));
      return;
    }
    animate(x, direction * -Math.min(window.innerWidth, 420), { duration: 0.16, ease: "easeIn" });
    startTransition(() => router.push(href));
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go só depende das props, recriadas a cada dia
  }, [prevHref, nextHref]);

  // Gesto só no toque: com mouse, arrastar continua selecionando texto.
  function onPointerDown(event: PointerEvent) {
    if (event.pointerType !== "touch" || isTyping(event.target)) return;
    if ((event.target as HTMLElement).closest("[data-no-swipe]")) return;
    controls.start(event);
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -THRESHOLD_PX || info.velocity.x < -THRESHOLD_VELOCITY) go(1);
    else if (info.offset.x > THRESHOLD_PX || info.velocity.x > THRESHOLD_VELOCITY) go(-1);
    else animate(x, 0, { type: "spring", stiffness: 420, damping: 36 });
  }

  return (
    <m.div
      className="swiper day-swap"
      style={{ x, opacity }}
      initial={entering.current ? { x: entering.current * 56, opacity: 0 } : false}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
      drag="x"
      dragControls={controls}
      dragListener={false}
      dragDirectionLock
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.55}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      onPointerDown={onPointerDown}
    >
      {children}
    </m.div>
  );
}
