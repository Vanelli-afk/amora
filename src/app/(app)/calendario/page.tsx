import { redirect } from "next/navigation";
import { getSettings } from "@/data/settings";
import { monthOf, todayIn } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export default async function CalendarioPage() {
  const user = await requireUser();
  const { timezone } = await getSettings(user.id);
  redirect(`/calendario/mes/${monthOf(todayIn(timezone))}`);
}
