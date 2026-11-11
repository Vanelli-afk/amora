import type { Metadata } from "next";
import { AnalysisSection, SummarySection } from "@/components/financas/panels";
import { financeContext, toOptions } from "@/components/financas/context";
import { MonthNav, NewTxButton, PageHead } from "@/components/financas/ui";
import { loadOverview } from "@/data/finance-overview";
import { formatLongDay } from "@/lib/dates";

export const metadata: Metadata = { title: "Finanças" };

export default async function FinancasPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const { userId, settings, today, month } = await financeContext(mes);
  const overview = await loadOverview(userId, month, today, settings.budgetAlertPct);
  return (
    <>
      <PageHead title="Finanças" sub={formatLongDay(today)}>
        <MonthNav month={month} today={today} path="/financas" />
        <NewTxButton />
      </PageHead>
      <div className="fx-stack">
        <SummarySection o={overview} accountsOpt={toOptions(overview.accounts, overview.categories).accounts} />
        {/* No celular as análises ficam em /financas/analises, como no design. */}
        <div className="fx-desk"><AnalysisSection o={overview} savingsGoalPct={settings.savingsGoalPct} /></div>
      </div>
    </>
  );
}
