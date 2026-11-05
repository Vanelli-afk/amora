// Fora de módulos "use client": constantes de lá não podem ser lidas por Server Components.
export const COLORS = [
  { id: "sky", label: "Azul-céu", category: "Reuniões" },
  { id: "lav", label: "Lavanda", category: "Foco" },
  { id: "peach", label: "Pêssego", category: "Refeições" },
  { id: "sage", label: "Verde-sálvia", category: "Saúde" },
  { id: "rose", label: "Rosa", category: "Pessoas" },
  { id: "sand", label: "Areia", category: "Casa" },
] as const;

export type ColorId = (typeof COLORS)[number]["id"];

export const colorMeta = (id: ColorId) => COLORS.find((c) => c.id === id) ?? COLORS[0];
