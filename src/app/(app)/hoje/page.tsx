import type { Metadata } from "next";
import { DayView } from "@/components/dia/day-view";
import { getSettings } from "@/data/settings";
import { todayIn } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Hoje" };

export default async function HojePage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  return <DayView userId={user.id} date={todayIn(settings.timezone)} settings={settings} />;
}
