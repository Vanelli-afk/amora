"use client";

import { AnimatePresence } from "motion/react";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  addTransaction, deleteAccount, payBills, removeBill, removeCategory, removeRecurring, removeTransaction, saveAccount, saveBill, saveBudget,
  saveCategory, saveFinanceGoals, saveRecurring, saveTransaction, unpayBill,
} from "@/actions/finance";
import { FieldError } from "@/components/auth/fields";
import { Icon } from "@/components/ui/icon";
import { Overlay } from "@/components/ui/overlay";
import { ColorPicker } from "@/components/ui/pickers";
import { useToast } from "@/components/ui/toast";
import { addDays, formatDayMonth } from "@/lib/dates";
import {
  ACCOUNT_KINDS, CATEGORY_ICONS, PAY_METHODS, RECURRING_KINDS, billBadge, type AccountKind, type PayMethod, type RecurringKind,
} from "@/lib/finance-meta";
import { formatBRL, formatCents, parseBRL } from "@/lib/money";
import type { ColorId } from "@/lib/palette";
import { Badge, CatBubble } from "./ui";

/* ---------- Tipos que as páginas entregam (só dados simples) ---------- */

export type AccountOpt = { id: string; name: string; kind: AccountKind; openingCents: number; balanceCents: number };
export type CategoryOpt = { id: string; parentId: string | null; type: "expense" | "income"; name: string; color: ColorId; icon: string };
export type Options = { accounts: AccountOpt[]; categories: CategoryOpt[] };

export type BillItem = { id: string; name: string; dueDate: string; amountCents: number; categoryId: string | null; recurring: boolean; paidOn: string | null };
export type RecurringItem = {
  id: string; type: "expense" | "income"; kind: RecurringKind; name: string; amountCents: number; dayOfMonth: number;
  categoryId: string | null; accountId: string | null; payMethod: PayMethod; startsOn: string; endsOn: string | null; active: boolean;
};

/* ---------- Peças comuns ---------- */

export function useRun() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  function run(action: () => Promise<{ ok: boolean; error?: string }>, message: string, done?: () => void) {
    setError(undefined);
    start(async () => {
      const result = await action();
      if (!result.ok) { setError(result.error); return; }
      toast(message);
      done?.();
    });
  }
  return { run, pending, error, setError, toast, start };
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Overlay label={title} variant="modal" narrow onClose={onClose}>
      <div className="row jb" style={{ marginBottom: 14 }}>
        <h2 className="ser" style={{ fontSize: 26, fontWeight: 600 }}>{title}</h2>
        <button type="button" className="btn btn-g btn-ic" aria-label="Fechar" onClick={onClose}><Icon name="close" /></button>
      </div>
      {children}
    </Overlay>
  );
}

export function Opener({ trigger, title, children }: { trigger: (open: () => void) => ReactNode; title: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger(() => setOpen(true))}
      <AnimatePresence>
        {open ? <Sheet key="sheet" title={title} onClose={() => setOpen(false)}>{children(() => setOpen(false))}</Sheet> : null}
      </AnimatePresence>
    </>
  );
}

export function Footer({ error, pending, onCancel, save, extra }: { error?: string; pending: boolean; onCancel: () => void; save: string; extra?: ReactNode }) {
  return (
    <div className="fx-foot">
      {error ? <FieldError message={error} /> : null}
      <div className="row g8 wrap" style={{ justifyContent: "flex-end" }}>
        {extra ? <div style={{ marginRight: "auto" }}>{extra}</div> : null}
        <button type="button" className="btn btn-s" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn-p" disabled={pending}>{pending ? "Salvando…" : save}</button>
      </div>
    </div>
  );
}

export function MoneyField({ id, label, value, onChange, big, optional }: { id: string; label: string; value: string; onChange: (v: string) => void; big?: boolean; optional?: boolean }) {
  return (
    <div>
      <label className="lbl" htmlFor={id}>{label}</label>
      <input id={id} className={`inp num${big ? " money-inp" : ""}`} inputMode="decimal" autoComplete="off" placeholder="0,00" value={value} onChange={(e) => onChange(e.target.value)} required={!optional} />
    </div>
  );
}

function CategorySelect({ id, label, value, onChange, categories, type }: { id: string; label: string; value: string; onChange: (v: string) => void; categories: CategoryOpt[]; type?: "expense" | "income" }) {
  const list = categories.filter((c) => !type || c.type === type);
  const tops = list.filter((c) => !c.parentId);
  return (
    <div>
      <label className="lbl" htmlFor={id}>{label}</label>
      <select id={id} className="inp" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sem categoria</option>
        {tops.map((top) => {
          const subs = list.filter((c) => c.parentId === top.id);
          return subs.length ? (
            <optgroup key={top.id} label={top.name}>
              <option value={top.id}>{top.name} (geral)</option>
              {subs.map((s) => <option key={s.id} value={s.id}>{top.name} › {s.name}</option>)}
            </optgroup>
          ) : <option key={top.id} value={top.id}>{top.name}</option>;
        })}
      </select>
    </div>
  );
}

export function ConfirmDelete({ title, text, confirm, pending, error, onBack, onConfirm }: { title: string; text: string; confirm: string; pending: boolean; error?: string; onBack: () => void; onConfirm: () => void }) {
  return (
    <div className="col g12" role="alertdialog" aria-label={title}>
      <h3 className="h2">{title}</h3>
      <p className="t2">{text}</p>
      {error ? <FieldError message={error} /> : null}
      <button type="button" className="btn btn-danger btn-w" disabled={pending} onClick={onConfirm}>{confirm}</button>
      <button type="button" className="btn btn-s btn-w" onClick={onBack}>Manter</button>
    </div>
  );
}

/* ---------- Lançamento (novo, editar, excluir) ---------- */

export type TxDraft = {
  id: string | null; type: "expense" | "income"; amountCents: number; date: string; accountId: string; categoryId: string | null;
  payMethod: PayMethod; description: string; note: string | null;
};

export function TxModal({ draft, today, options, onClose }: { draft: TxDraft; today: string; options: Options; onClose: () => void }) {
  const { run, pending, error, setError, toast, start } = useRun();
  const [type, setType] = useState(draft.type);
  const [amount, setAmount] = useState(draft.amountCents ? formatCents(draft.amountCents) : "");
  const [description, setDescription] = useState(draft.description);
  const [categoryId, setCategoryId] = useState(draft.categoryId ?? "");
  const [date, setDate] = useState(draft.date);
  const [accountId, setAccountId] = useState(draft.accountId);
  const [payMethod, setPayMethod] = useState<PayMethod>(draft.payMethod);
  const [repeat, setRepeat] = useState(false);
  const [note, setNote] = useState(draft.note ?? "");
  const [confirming, setConfirming] = useState(false);
  const editing = Boolean(draft.id);

  function build() {
    const cents = parseBRL(amount);
    if (!cents) { setError("Informe um valor válido."); return null; }
    return { type, amountCents: cents, date, accountId, categoryId: categoryId || null, payMethod, description, note: note || null };
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const input = build();
    if (!input) return;
    if (draft.id) run(() => saveTransaction({ id: draft.id as string, input }), "Alterações salvas", onClose);
    else run(() => addTransaction({ ...input, repeatMonthly: repeat }), type === "income" ? "Receita salva" : "Despesa salva", onClose);
  }

  function remove() {
    if (!draft.id) return;
    const snapshot = { type, amountCents: draft.amountCents, date, accountId, categoryId: categoryId || null, payMethod, description, note: note || null, repeatMonthly: false };
    start(async () => {
      const result = await removeTransaction({ id: draft.id as string });
      if (!result.ok) { setError(result.error); return; }
      toast("Lançamento excluído", { action: { label: "Desfazer", run: () => void addTransaction(snapshot) } });
      onClose();
    });
  }

  const heading = editing ? "Editar lançamento" : "Novo lançamento";
  return (
    <Overlay label={heading} variant="modal" narrow onClose={onClose}>
      <div className="row jb" style={{ marginBottom: 14 }}>
        <h2 className="ser" style={{ fontSize: 26, fontWeight: 600 }}>{heading}</h2>
        <button type="button" className="btn btn-g btn-ic" aria-label="Fechar" onClick={onClose}><Icon name="close" /></button>
      </div>
      {confirming ? (
        <ConfirmDelete
          title="Excluir este lançamento?"
          text={`“${description}”, de ${formatBRL(draft.amountCents)}, será removido e o saldo da conta será ajustado. Essa ação não pode ser desfeita.`}
          confirm="Sim, excluir" pending={pending} error={error} onBack={() => setConfirming(false)} onConfirm={remove}
        />
      ) : (
        <form className="fx-form" onSubmit={submit}>
          <div className="tabs fx-seg2" role="tablist" aria-label="Tipo">
            {(["expense", "income"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={type === t} className={`tab${type === t ? " on" : ""}`} onClick={() => { setType(t); setCategoryId(""); }}>
                {t === "expense" ? "Despesa" : "Receita"}
              </button>
            ))}
          </div>
          <MoneyField id="fx-valor" label="Valor" value={amount} onChange={setAmount} big />
          <div>
            <label className="lbl" htmlFor="fx-desc">Descrição</label>
            <input id="fx-desc" className="inp" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} required placeholder="Ex.: Mercado do bairro" />
          </div>
          <CategorySelect id="fx-cat" label="Categoria" value={categoryId} onChange={setCategoryId} categories={options.categories} type={type} />
          <div>
            <label className="lbl" htmlFor="fx-data">Data</label>
            <input id="fx-data" className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <div className="row g8" style={{ marginTop: 8 }}>
              <button type="button" className={`chip${date === today ? " on" : ""}`} onClick={() => setDate(today)}>Hoje</button>
              <button type="button" className={`chip${date === addDays(today, -1) ? " on" : ""}`} onClick={() => setDate(addDays(today, -1))}>Ontem</button>
            </div>
          </div>
          <div className="two">
            <div>
              <label className="lbl" htmlFor="fx-conta">Conta</label>
              <select id="fx-conta" className="inp" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
                {options.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="fx-pag">Forma de pagamento</label>
              <select id="fx-pag" className="inp" value={payMethod} onChange={(e) => setPayMethod(e.target.value as PayMethod)}>
                {PAY_METHODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>
          {!editing ? (
            <div className="row jb" style={{ gap: 12 }}>
              <div className="col"><b>Repetir todo mês</b><span className="sm t2">Cria {type === "expense" ? "uma despesa" : "uma receita"} recorrente a partir do mês que vem</span></div>
              <button type="button" role="switch" aria-checked={repeat} aria-label="Repetir todo mês" className={`tg${repeat ? " on" : ""}`} onClick={() => setRepeat(!repeat)}><i /></button>
            </div>
          ) : null}
          <div>
            <label className="lbl" htmlFor="fx-obs">Observação <span className="t3">(opcional)</span></label>
            <textarea id="fx-obs" className="inp" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Ex.: compra do mês" />
          </div>
          <Footer error={error} pending={pending} onCancel={onClose} save={editing ? "Salvar alterações" : type === "income" ? "Salvar receita" : "Salvar despesa"}
            extra={editing ? <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}><Icon name="trash" size="s" />Excluir</button> : null} />
        </form>
      )}
    </Overlay>
  );
}

/* ---------- Contas bancárias ---------- */

export function AccountsButton({ accounts }: { accounts: AccountOpt[] }) {
  return (
    <Opener title="Contas" trigger={(open) => <button type="button" className="btn btn-s" onClick={open}><Icon name="wallet" size="s" />Gerenciar contas</button>}>
      {(close) => <AccountsEditor accounts={accounts} onDone={close} />}
    </Opener>
  );
}

function AccountsEditor({ accounts, onDone }: { accounts: AccountOpt[]; onDone: () => void }) {
  const { run, pending, error, setError } = useRun();
  const [editing, setEditing] = useState<AccountOpt | "new" | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("checking");
  const [opening, setOpening] = useState("");

  function edit(target: AccountOpt | "new") {
    setEditing(target);
    setError(undefined);
    setName(target === "new" ? "" : target.name);
    setKind(target === "new" ? "checking" : target.kind);
    setOpening(target === "new" || !target.openingCents ? "" : formatCents(target.openingCents));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const negative = opening.trim().startsWith("-");
    const parsed = opening.trim() ? parseBRL(opening.replace("-", "")) : 0;
    if (parsed === null) { setError("Saldo inicial inválido."); return; }
    run(() => saveAccount({ id: editing === "new" || !editing ? null : editing.id, input: { name, kind, openingCents: negative ? -parsed : parsed } }), "Conta salva", () => setEditing(null));
  }

  if (!editing) {
    return (
      <div className="col g12">
        <ul>
          {accounts.map((a) => (
            <li key={a.id}>
              <button type="button" className="fx-row" onClick={() => edit(a)}>
                <span className="ibub"><Icon name="wallet" /></span>
                <span className="grow"><b>{a.name}</b><span className="sm t2">{ACCOUNT_KINDS.find((k) => k.id === a.kind)?.label}</span></span>
                <span className="amt">{formatBRL(a.balanceCents)}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-s btn-w" onClick={() => edit("new")}><Icon name="plus" size="s" />Nova conta</button>
        <button type="button" className="btn btn-p btn-w" onClick={onDone}>Pronto</button>
      </div>
    );
  }
  return (
    <form className="fx-form" onSubmit={submit}>
      <div><label className="lbl" htmlFor="ac-nome">Nome</label><input id="ac-nome" className="inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required /></div>
      <div className="two">
        <div>
          <label className="lbl" htmlFor="ac-tipo">Tipo</label>
          <select id="ac-tipo" className="inp" value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
            {ACCOUNT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </div>
        <MoneyField id="ac-saldo" label="Saldo inicial" value={opening} onChange={setOpening} optional />
      </div>
      <Footer error={error} pending={pending} onCancel={() => setEditing(null)} save="Salvar"
        extra={editing !== "new" ? (
          <button type="button" className="btn btn-danger" disabled={pending} onClick={() => run(() => deleteAccount({ id: (editing as AccountOpt).id }), "Conta removida", () => setEditing(null))}>
            <Icon name="trash" size="s" />Remover
          </button>
        ) : null} />
    </form>
  );
}

/* ---------- Orçamento ---------- */

export function BudgetButton({ categories, current, categoryId, label, className = "btn btn-s" }: {
  categories: CategoryOpt[]; current: Record<string, number>; categoryId?: string; label: ReactNode; className?: string;
}) {
  return (
    <Opener title="Definir limite" trigger={(open) => <button type="button" className={className} onClick={open}>{label}</button>}>
      {(close) => <BudgetForm categories={categories} current={current} categoryId={categoryId} onDone={close} />}
    </Opener>
  );
}

function BudgetForm({ categories, current, categoryId, onDone }: { categories: CategoryOpt[]; current: Record<string, number>; categoryId?: string; onDone: () => void }) {
  const tops = categories.filter((c) => !c.parentId && c.type === "expense");
  const { run, pending, error, setError } = useRun();
  const [id, setId] = useState(categoryId ?? tops[0]?.id ?? "");
  const [limit, setLimit] = useState(current[categoryId ?? tops[0]?.id ?? ""] ? formatCents(current[categoryId ?? tops[0]?.id ?? ""] as number) : "");

  function submit(event: FormEvent) {
    event.preventDefault();
    const cents = parseBRL(limit);
    if (!cents) { setError("Informe um limite válido."); return; }
    run(() => saveBudget({ categoryId: id, limitCents: cents }), "Limite salvo", onDone);
  }

  return (
    <form className="fx-form" onSubmit={submit}>
      <div>
        <label className="lbl" htmlFor="bd-cat">Categoria</label>
        <select id="bd-cat" className="inp" value={id} onChange={(e) => { setId(e.target.value); setLimit(current[e.target.value] ? formatCents(current[e.target.value] as number) : ""); }} disabled={Boolean(categoryId)}>
          {tops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <MoneyField id="bd-limite" label="Limite mensal" value={limit} onChange={setLimit} big />
      <Footer error={error} pending={pending} onCancel={onDone} save="Salvar limite"
        extra={current[id] ? <button type="button" className="btn btn-danger" disabled={pending} onClick={() => run(() => saveBudget({ categoryId: id, limitCents: null }), "Limite removido", onDone)}>Remover limite</button> : null} />
    </form>
  );
}

export function GoalsForm({ alertPct, savingsPct }: { alertPct: number; savingsPct: number }) {
  const { run, pending, error } = useRun();
  const [alert, setAlert] = useState(String(alertPct));
  const [savings, setSavings] = useState(String(savingsPct));
  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => saveFinanceGoals({ budgetAlertPct: Number(alert), savingsGoalPct: Number(savings) }), "Metas salvas");
  }
  return (
    <form className="fx-form card" onSubmit={submit}>
      <h3 className="h3">Metas do mês</h3>
      <div className="two">
        <div><label className="lbl" htmlFor="gl-alerta">Avisar em (%)</label><input id="gl-alerta" className="inp num" type="number" min={50} max={100} value={alert} onChange={(e) => setAlert(e.target.value)} /></div>
        <div><label className="lbl" htmlFor="gl-econ">Meta de economia (%)</label><input id="gl-econ" className="inp num" type="number" min={0} max={90} value={savings} onChange={(e) => setSavings(e.target.value)} /></div>
      </div>
      {error ? <FieldError message={error} /> : null}
      <button type="submit" className="btn btn-s" disabled={pending}>Salvar metas</button>
    </form>
  );
}

/* ---------- Categorias ---------- */

export function CategoryButton({ category, parent, type = "expense", label, className = "btn btn-s" }: {
  category?: CategoryOpt; parent?: CategoryOpt; type?: "expense" | "income"; label: ReactNode; className?: string;
}) {
  const title = category ? (category.parentId ? "Editar subcategoria" : "Editar categoria") : parent ? "Nova subcategoria" : "Nova categoria";
  return (
    <Opener title={title} trigger={(open) => <button type="button" className={className} onClick={open}>{label}</button>}>
      {(close) => <CategoryForm category={category} parent={parent} type={type} onDone={close} />}
    </Opener>
  );
}

function CategoryForm({ category, parent, type, onDone }: { category?: CategoryOpt; parent?: CategoryOpt; type: "expense" | "income"; onDone: () => void }) {
  const { run, pending, error } = useRun();
  const isSub = Boolean(parent ?? category?.parentId);
  const [name, setName] = useState(category?.name ?? "");
  const [color, setColor] = useState<ColorId>(category?.color ?? "sky");
  const [icon, setIcon] = useState(category?.icon ?? "grid");

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => saveCategory({ id: category?.id ?? null, input: { name, color, icon, type: category?.type ?? type, parentId: parent?.id ?? category?.parentId ?? null } }), "Categoria salva", onDone);
  }

  return (
    <form className="fx-form" onSubmit={submit}>
      <div><label className="lbl" htmlFor="ct-nome">Nome</label><input id="ct-nome" className="inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoFocus /></div>
      {!isSub ? (
        <>
          <div><span className="lbl">Cor</span><ColorPicker value={color} onChange={setColor} /></div>
          <div>
            <span className="lbl">Ícone</span>
            <div className="row g8 wrap" role="radiogroup" aria-label="Ícone">
              {CATEGORY_ICONS.map((key) => (
                <button key={key} type="button" role="radio" aria-checked={icon === key} aria-label={key} className={`btn btn-ic ${icon === key ? "btn-p" : "btn-s"}`} onClick={() => setIcon(key)}>
                  <Icon name={key} />
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
      <Footer error={error} pending={pending} onCancel={onDone} save="Salvar"
        extra={category ? (
          <button type="button" className="btn btn-danger" disabled={pending} onClick={() => run(() => removeCategory({ id: category.id }), "Categoria removida", onDone)}>
            <Icon name="trash" size="s" />Excluir
          </button>
        ) : null} />
      {category && !isSub ? <p className="hint">As subcategorias também serão excluídas; os lançamentos ficam, sem categoria.</p> : null}
    </form>
  );
}

/* ---------- Contas a pagar ---------- */

export function BillButton({ bill, categories, label, className = "btn btn-s" }: { bill?: BillItem; categories: CategoryOpt[]; label: ReactNode; className?: string }) {
  return (
    <Opener title={bill ? "Editar conta" : "Nova conta a pagar"} trigger={(open) => <button type="button" className={className} onClick={open}>{label}</button>}>
      {(close) => <BillForm bill={bill} categories={categories} onDone={close} />}
    </Opener>
  );
}

function BillForm({ bill, categories, onDone }: { bill?: BillItem; categories: CategoryOpt[]; onDone: () => void }) {
  const { run, pending, error, setError } = useRun();
  const [name, setName] = useState(bill?.name ?? "");
  const [amount, setAmount] = useState(bill ? formatCents(bill.amountCents) : "");
  const [due, setDue] = useState(bill?.dueDate ?? "");
  const [categoryId, setCategoryId] = useState(bill?.categoryId ?? "");

  function submit(event: FormEvent) {
    event.preventDefault();
    const cents = parseBRL(amount);
    if (!cents) { setError("Informe um valor válido."); return; }
    run(() => saveBill({ id: bill?.id ?? null, input: { name, amountCents: cents, dueDate: due, categoryId: categoryId || null } }), "Conta salva", onDone);
  }

  return (
    <form className="fx-form" onSubmit={submit}>
      <div><label className="lbl" htmlFor="bl-nome">Nome</label><input id="bl-nome" className="inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required placeholder="Ex.: Energia elétrica" /></div>
      <div className="two">
        <MoneyField id="bl-valor" label="Valor" value={amount} onChange={setAmount} />
        <div><label className="lbl" htmlFor="bl-venc">Vencimento</label><input id="bl-venc" className="inp" type="date" value={due} onChange={(e) => setDue(e.target.value)} required /></div>
      </div>
      <CategorySelect id="bl-cat" label="Categoria" value={categoryId} onChange={setCategoryId} categories={categories} type="expense" />
      <Footer error={error} pending={pending} onCancel={onDone} save="Salvar"
        extra={bill ? <button type="button" className="btn btn-danger" disabled={pending} onClick={() => run(() => removeBill({ id: bill.id }), "Conta excluída", onDone)}><Icon name="trash" size="s" />Excluir</button> : null} />
    </form>
  );
}

/** Lista selecionável das contas abertas, com o botão fixo para pagar várias de uma vez. */
export function BillList({ bills, today, categories }: { bills: BillItem[]; today: string; categories: CategoryOpt[] }) {
  const { run, pending, error } = useRun();
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const total = bills.filter((b) => picked.includes(b.id)).reduce((s, b) => s + b.amountCents, 0);
  const catById = new Map(categories.map((c) => [c.id, c]));

  return (
    <>
      <ul>
        {bills.map((bill) => {
          const badge = billBadge(bill.dueDate, today, false);
          const cat = bill.categoryId ? catById.get(bill.categoryId) : undefined;
          return (
            <li key={bill.id} className="fx-row">
              <input type="checkbox" className="chk" aria-label={`Selecionar ${bill.name}`} checked={picked.includes(bill.id)} onChange={() => toggle(bill.id)} />
              <CatBubble color={cat?.color ?? "sand"} icon={cat?.icon ?? "receipt"} />
              <BillButton bill={bill} categories={categories} className="grow" label={<span className="col" style={{ textAlign: "left" }}><b>{bill.name}</b><span className="sm t2">Vence em {formatDayMonth(bill.dueDate)}{bill.recurring ? " · recorrente" : ""}</span></span>} />
              <span className="end"><span className="amt">{formatBRL(bill.amountCents)}</span><Badge tone={badge.tone}>{badge.label}</Badge></span>
            </li>
          );
        })}
      </ul>
      {picked.length ? (
        <div className="fx-sticky">
          <div className="card row g12" style={{ boxShadow: "var(--sh2)" }}>
            <span className="sm b">{picked.length} selecionada(s) · {formatBRL(total)}</span>
            <button type="button" className="btn btn-p" disabled={pending} onClick={() => run(() => payBills({ ids: picked }), "Marcada como paga", () => setPicked([]))}>
              <Icon name="check" size="s" />Marcar como paga
            </button>
          </div>
          {error ? <FieldError message={error} /> : null}
        </div>
      ) : null}
    </>
  );
}

export function UnpayButton({ id }: { id: string }) {
  const { run, pending } = useRun();
  return <button type="button" className="btn btn-g" disabled={pending} onClick={() => run(() => unpayBill({ id }), "Conta reaberta")}>Desfazer</button>;
}

/* ---------- Recorrentes ---------- */

export function RecurringButton({ item, options, today, label, className = "btn btn-s" }: { item?: RecurringItem; options: Options; today: string; label: ReactNode; className?: string }) {
  return (
    <Opener title={item ? "Editar recorrente" : "Nova recorrente"} trigger={(open) => <button type="button" className={className} onClick={open}>{label}</button>}>
      {(close) => <RecurringForm item={item} options={options} today={today} onDone={close} />}
    </Opener>
  );
}

function RecurringForm({ item, options, today, onDone }: { item?: RecurringItem; options: Options; today: string; onDone: () => void }) {
  const { run, pending, error, setError } = useRun();
  const [type, setType] = useState(item?.type ?? "expense");
  const [kind, setKind] = useState<RecurringKind>(item?.kind ?? "fixed");
  const [name, setName] = useState(item?.name ?? "");
  const [amount, setAmount] = useState(item ? formatCents(item.amountCents) : "");
  const [day, setDay] = useState(String(item?.dayOfMonth ?? Number(today.slice(8, 10))));
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? "");
  const [accountId, setAccountId] = useState(item?.accountId ?? options.accounts[0]?.id ?? "");
  const [payMethod, setPayMethod] = useState<PayMethod>(item?.payMethod ?? "auto_debit");
  const [endsOn, setEndsOn] = useState(item?.endsOn ?? "");
  const [active, setActive] = useState(item?.active ?? true);

  function submit(event: FormEvent) {
    event.preventDefault();
    const cents = parseBRL(amount);
    if (!cents) { setError("Informe um valor válido."); return; }
    run(() => saveRecurring({
      id: item?.id ?? null,
      input: {
        type, kind, name, amountCents: cents, dayOfMonth: Number(day), categoryId: categoryId || null, accountId: accountId || null,
        payMethod, startsOn: item?.startsOn ?? today, endsOn: endsOn || null, active,
      },
    }), "Recorrente salva", onDone);
  }

  return (
    <form className="fx-form" onSubmit={submit}>
      <div className="tabs fx-seg2" role="tablist" aria-label="Tipo">
        {(["expense", "income"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={type === t} className={`tab${type === t ? " on" : ""}`} onClick={() => { setType(t); setCategoryId(""); }}>{t === "expense" ? "Despesa" : "Receita"}</button>
        ))}
      </div>
      <div><label className="lbl" htmlFor="rc-nome">Nome</label><input id="rc-nome" className="inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required placeholder="Ex.: Aluguel" /></div>
      <div className="two">
        <MoneyField id="rc-valor" label="Valor" value={amount} onChange={setAmount} />
        <div><label className="lbl" htmlFor="rc-dia">Todo dia</label><input id="rc-dia" className="inp num" type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} required /></div>
      </div>
      {type === "expense" ? (
        <div>
          <label className="lbl" htmlFor="rc-tipo">Grupo</label>
          <select id="rc-tipo" className="inp" value={kind} onChange={(e) => setKind(e.target.value as RecurringKind)}>
            {RECURRING_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </div>
      ) : null}
      <CategorySelect id="rc-cat" label="Categoria" value={categoryId} onChange={setCategoryId} categories={options.categories} type={type} />
      <div className="two">
        <div>
          <label className="lbl" htmlFor="rc-conta">Conta</label>
          <select id="rc-conta" className="inp" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {options.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="lbl" htmlFor="rc-pag">Pagamento</label>
          <select id="rc-pag" className="inp" value={payMethod} onChange={(e) => setPayMethod(e.target.value as PayMethod)}>
            {PAY_METHODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
      </div>
      <div><label className="lbl" htmlFor="rc-fim">Termina em <span className="t3">(opcional)</span></label><input id="rc-fim" className="inp" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} /></div>
      <div className="row jb">
        <div className="col"><b>Ativa</b><span className="sm t2">Pausada, não gera novas contas</span></div>
        <button type="button" role="switch" aria-checked={active} aria-label="Ativa" className={`tg${active ? " on" : ""}`} onClick={() => setActive(!active)}><i /></button>
      </div>
      <Footer error={error} pending={pending} onCancel={onDone} save="Salvar"
        extra={item ? <button type="button" className="btn btn-danger" disabled={pending} onClick={() => run(() => removeRecurring({ id: item.id }), "Recorrente excluída", onDone)}><Icon name="trash" size="s" />Excluir</button> : null} />
    </form>
  );
}
