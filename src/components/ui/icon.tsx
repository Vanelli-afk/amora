import type { CSSProperties, ReactNode } from "react";

const PATHS = {
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14.5" rx="3" /><path d="M8 3.5v4M16 3.5v4M4 10h16" /></>,
  tasks: <path d="M10 7h9M10 12h9M10 17h9M4.5 7l1.2 1.2L8 6M4.5 12l1.2 1.2L8 11M4.5 17l1.2 1.2L8 16" />,
  note: <path d="M5 5.5A1.5 1.5 0 016.5 4h11A1.5 1.5 0 0119 5.5V14l-5 5H6.5A1.5 1.5 0 015 17.5v-12zM14 19v-3.5a1.5 1.5 0 011.5-1.5H19" />,
  book: <path d="M5 4.5A1.5 1.5 0 016.5 3H19v15H6.5A1.5 1.5 0 005 19.5v-15zM5 19.5A1.5 1.5 0 006.5 21H19v-3" />,
  user: <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>,
  left: <path d="M15 5l-7 7 7 7" />,
  right: <path d="M9 5l7 7-7 7" />,
  down: <path d="M6 9l6 6 6-6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  edit: <path d="M4 20l1-4.5L16.5 4a2 2 0 013 3L8 18.5 4 20zM14.5 6l3.5 3.5" />,
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5M14 11v5" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  repeat: <path d="M4 11V9.5A2.5 2.5 0 016.5 7H19l-3-3M20 13v1.5a2.5 2.5 0 01-2.5 2.5H5l3 3" />,
  bell: <><path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 1.5h-15z" /><path d="M10 20.5a2.2 2.2 0 004 0" /></>,
  place: <><path d="M12 21s6.5-5.4 6.5-10.5a6.5 6.5 0 00-13 0C5.5 15.6 12 21 12 21z" /><circle cx="12" cy="10.5" r="2.3" /></>,
  pin: <path d="M7 4h10v3l-2 3v4l3 3H6l3-3v-4L7 7V4zM12 17v4" />,
  mail: <><rect x="3.5" y="5.5" width="17" height="13" rx="3" /><path d="M4.5 8l7.5 5.5L19.5 8" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="9.5" rx="3" /><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  eyeOff: <path d="M4 4l16 16M9.900 5.800A9.500 9.500 0 0112 5.500c6 0 9.500 6.500 9.500 6.500a17 17 0 01-3.200 3.900M6.300 7.700A16.500 16.500 0 002.500 12S6 18.500 12 18.500a9.300 9.300 0 004-.9" />,
  coffee: <path d="M5 9h11v5a4 4 0 01-4 4H9a4 4 0 01-4-4V9zM16 10.5h1.5a2.5 2.5 0 010 5H16M8 3.5V6M11.5 3.5V6" />,
  steps: <path d="M8 4c2 0 3 1.500 3 4s-1 3.500-3 3.500S5 10 5 8s1-4 3-4zM6 14.500h5V16a2.500 2.500 0 01-5 0zM16 9c2 0 3 1.500 3 4s-1 3.500-3 3.500-3-1.500-3-3.500 1-4 3-4z" />,
  moon: <path d="M19.5 14.5A8 8 0 019.500 4.500a8 8 0 1010 10z" />,
  flame: <path d="M12 3.500c.5 3-2 4.500-3.500 6.500A6 6 0 0012 20.500a6 6 0 003.500-10.500c-.5 1-1 1.500-1.800 1.800.3-2.800-.5-5.800-1.700-8.300z" />,
  list: <path d="M9 7h11M9 12h11M9 17h11M4.500 7h.01M4.500 12h.01M4.500 17h.01" style={{ strokeWidth: 2.6 }} />,
  grip: <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" style={{ strokeWidth: 3 }} />,
  upload: <path d="M12 16V5M7.500 9.500L12 5l4.500 4.500M5 16.500V19h14v-2.500" />,
  download: <path d="M12 5v11M7.500 11.500L12 16l4.500-4.500M5 19h14" />,
  camera: <><path d="M4 8.500A1.500 1.500 0 015.500 7H8l1.200-2h5.600L16 7h2.500A1.500 1.500 0 0120 8.500V17a1.500 1.500 0 01-1.500 1.500h-13A1.500 1.500 0 014 17V8.500z" /><circle cx="12" cy="12.500" r="3.200" /></>,
  globe: <><circle cx="12" cy="12" r="8.500" /><path d="M3.500 12h17M12 3.500c2.500 2.500 3.500 5.500 3.500 8.500s-1 6-3.500 8.500c-2.500-2.500-3.500-5.500-3.500-8.500S9.500 6 12 3.500z" /></>,
  logout: <path d="M10 4.500H6.500A1.500 1.500 0 005 6v12a1.500 1.500 0 001.500 1.500H10M14 8l4 4-4 4M18 12H9.500" />,
  star: <path d="M12 3.800l2.500 5.200 5.700.8-4.100 4 1 5.700-5.100-2.700-5.100 2.700 1-5.700-4.100-4 5.700-.8z" />,
  bookmark: <path d="M7 4h10v16l-5-3.500L7 20z" />,
  more: <path d="M6 12h.01M12 12h.01M18 12h.01" style={{ strokeWidth: 3 }} />,
  shield: <path d="M12 3.500l7 2.500v5.500c0 4.500-3 7.500-7 9-4-1.500-7-4.500-7-9V6l7-2.500z" />,
  warn: <><path d="M12 4.500l8.500 15h-17z" /><path d="M12 10v4M12 17h.01" /></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

type Props = { name: IconName; size?: "s" | "l" | "xl"; className?: string; style?: CSSProperties };

export function Icon({ name, size, className, style }: Props) {
  const classes = ["i", size, className].filter(Boolean).join(" ");
  return (
    <svg className={classes} style={style} viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

export function SparkleArt({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 2l2 7 7 3-7 3-2 7-2-7-7-3 7-3z" fill="#F0B93A" />
    </svg>
  );
}

export function PlantArt({ width = 64, height = 80 }: { width?: number; height?: number }) {
  return (
    <svg viewBox="0 0 64 80" width={width} height={height} aria-hidden="true">
      <path d="M32 52C32 38 26 30 14 26c-1 12 5 22 18 26z" fill="#9CBF93" />
      <path d="M32 52c0-16 7-26 20-30 1 14-6 26-20 30z" fill="#7FA877" />
      <path d="M32 52c-1-12 1-22 6-32-7 6-9 18-6 32z" fill="#B7D3AE" />
      <path d="M18 52h28l-3 22a4 4 0 01-4 3.500H25a4 4 0 01-4-3.500L18 52z" fill="#E3A07E" />
      <rect x="15" y="48" width="34" height="8" rx="3" fill="#D98F6B" />
    </svg>
  );
}

export function RainbowArt() {
  return (
    <svg viewBox="0 0 48 28" width="52" height="30" aria-hidden="true" style={{ flex: "none" }}>
      <path d="M4 26a20 20 0 0140 0" fill="none" stroke="#F2A09A" strokeWidth="4" strokeLinecap="round" />
      <path d="M10 26a14 14 0 0128 0" fill="none" stroke="#F6D07E" strokeWidth="4" strokeLinecap="round" />
      <path d="M16 26a8 8 0 0116 0" fill="none" stroke="#9CCBEA" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
