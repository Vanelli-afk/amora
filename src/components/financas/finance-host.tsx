"use client";

import { AnimatePresence } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { financeOptions, loadTransaction } from "@/actions/finance";
import { useApp } from "@/components/shell/app-context";
import { useToast } from "@/components/ui/toast";
import { closeOverlay } from "@/components/ui/url-state";
import { TxModal, type Options, type TxDraft } from "./forms";

const UUID = /^[0-9a-f-]{36}$/i;

/** Abre o lançamento por `?novo=lancamento` ou `?lancamento=<id>`, em qualquer tela do app. */
export function FinanceHost() {
  const params = useSearchParams();
  const novo = params.get("novo") === "lancamento";
  const editId = params.get("lancamento");
  const id = editId && UUID.test(editId) ? editId : null;
  const active = novo || id !== null;
  const { today } = useApp();
  const toast = useToast();
  const [state, setState] = useState<{ key: string; options: Options; draft: TxDraft } | null>(null);
  const key = active ? (id ?? "novo") : "";

  useEffect(() => {
    if (!key) { setState(null); return; }
    let alive = true;
    (async () => {
      const [opts, tx] = await Promise.all([financeOptions({}), id ? loadTransaction({ id }) : Promise.resolve(null)]);
      if (!alive) return;
      if (!opts.ok || (tx && !tx.ok)) {
        toast(!opts.ok ? opts.error : "Lançamento não encontrado.", { tone: "error" });
        closeOverlay(["novo", "lancamento"]);
        return;
      }
      const t = tx && tx.ok ? tx.data : null;
      const first = opts.data.accounts[0]?.id ?? "";
      setState({
        key,
        options: opts.data,
        draft: t
          ? { id: t.id, type: t.type, amountCents: t.amountCents, date: t.date, accountId: t.accountId, categoryId: t.categoryId, payMethod: t.payMethod, description: t.description, note: t.note }
          : { id: null, type: "expense", amountCents: 0, date: today, accountId: first, categoryId: null, payMethod: "pix", description: "", note: null },
      });
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando muda o lançamento aberto
  }, [key]);

  return (
    <AnimatePresence>
      {active && state && state.key === key ? (
        <TxModal key={key} draft={state.draft} today={today} options={state.options} onClose={() => closeOverlay(["novo", "lancamento"])} />
      ) : null}
    </AnimatePresence>
  );
}
