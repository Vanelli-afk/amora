import { z } from "zod";
import { isValidDay, isValidMonth, isValidTime, isValidTimezone } from "./dates";

export const zId = z.uuid("Identificador inválido.");
export const zDay = z.string().refine(isValidDay, "Data inválida.");
export const zMonth = z.string().refine(isValidMonth, "Mês inválido.");
export const zTime = z.string().refine(isValidTime, "Horário inválido.");
export const zTimezone = z.string().max(64).refine(isValidTimezone, "Fuso inválido.");
export const zColor = z.enum(["sky", "lav", "peach", "sage", "rose", "sand"]);
export const zNoteColor = z.enum(["y", "p", "m", "b", "l", "paper"]);

export const zTitle = z.string().trim().min(1, "Dê um título.").max(200, "Título longo demais.");

/** Texto livre opcional: string vazia vira null. */
export const zText = (max: number) =>
  z.string().max(max, "Texto longo demais.").transform((v) => (v.trim() ? v : null)).nullable();

export const zOptionalDay = zDay.nullable();
export const zOptionalTime = zTime.nullable();
