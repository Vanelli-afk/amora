import type { Pet, PetsOverview } from "@/data/pets";
import { getSettings } from "@/data/settings";
import { formatDayMonth, todayIn, type Day } from "@/lib/dates";
import type { Tone } from "@/lib/finance-meta";
import { requireUser } from "@/lib/session";

export async function petContext() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  return { userId: user.id, today: todayIn(settings.timezone) };
}

/** O que mais merece atenção em cada pet: vacina pendente, depois o próximo compromisso. */
export function petStatus(pet: Pet, o: Pick<PetsOverview, "pendingVaccines" | "upcoming">, today: Day): { label: string; tone: Tone } {
  const pending = o.pendingVaccines.filter((v) => v.petId === pet.id);
  if (pending.length) return { label: `${pending.length} vacina${pending.length > 1 ? "s" : ""} pendente${pending.length > 1 ? "s" : ""}`, tone: "warn" };
  const next = o.upcoming.find((e) => e.petId === pet.id && e.date >= today);
  if (next) return { label: `${next.title} em ${formatDayMonth(next.date)}`, tone: "info" };
  return { label: "Tudo em dia", tone: "ok" };
}
