import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DayView } from "@/components/dia/day-view";
import { getPageSettings } from "@/data/settings";
import { formatLongDay, isValidDay } from "@/lib/dates";
import { requireUser } from "@/lib/session";

type Props = { params: Promise<{ date: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  return { title: isValidDay(date) ? formatLongDay(date) : "Dia" };
}

export default async function DiaPage({ params }: Props) {
  const { date } = await params;
  if (!isValidDay(date)) notFound();
  const user = await requireUser();
  const settings = await getPageSettings(user.id);
  return <DayView userId={user.id} date={date} settings={settings} />;
}
