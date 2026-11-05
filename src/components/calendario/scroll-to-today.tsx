"use client";

import { useEffect, useRef } from "react";

/** No celular a semana rola de lado; abre já na coluna de hoje, em vez de no domingo. */
export function ScrollToToday() {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const scroller = marker.current?.parentElement;
    const today = scroller?.querySelector<HTMLElement>(".week-col.today");
    const gutter = scroller?.querySelector<HTMLElement>(".week-hours");
    if (!scroller || !today || scroller.scrollWidth <= scroller.clientWidth) return;
    scroller.scrollLeft = today.offsetLeft - (gutter?.offsetWidth ?? 0);
  }, []);

  return <span ref={marker} hidden />;
}
