import type { Metadata } from "next";
import { financeContext } from "@/components/financas/context";
import { AnalysisSection } from "@/components/financas/panels";
import { MonthNav, NewTxButton, PageHead } from "@/components/financas/ui";
import { loadOverview } from "@/data/finance-overview";

export const metadata: Metadata = { title: "Análises · Finanças" };

export default async function AnalisesPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const { userId, settings, today, month } = await financeContext(mes);
  const overview = await loadOverview(userId, month, today, settings.budgetAlertPct);
  return (
    <>
      <PageHead title="Análises" sub="Para onde vai o dinheiro">
        <MonthNav month={month} today={today} path="/financas/analises" />
        <NewTxButton />
      </PageHead>
      <AnalysisSection o={overview} savingsGoalPct={settings.savingsGoalPct} />
    </>
  );
}
