import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { TransitionLink } from "@/components/ui/links";
import type { Pet } from "@/data/pets";
import { formatWeight, petAge, speciesLabel, type Species } from "@/lib/pet-meta";
import type { ColorId } from "@/lib/palette";

function Face({ species }: { species: Species }) {
  const ink = "var(--tx)";
  return (
    <svg viewBox="0 0 48 48" width="62%" height="62%" aria-hidden="true" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {species === "dog" ? <path d="M12 16c-4 1-6 8-4 14 1 3 4 3 5 0l1-8M36 16c4 1 6 8 4 14-1 3-4 3-5 0l-1-8M14 14c3-3 17-3 20 0 2 2 3 8 3 14 0 7-6 11-13 11S11 35 11 28c0-6 1-12 3-14z" /> : null}
      {species === "cat" ? <path d="M10 8l7 7c4-1 10-1 14 0l7-7c1 5 1 10 0 14 1 3 1 6 0 8-3 7-9 9-14 9s-11-2-14-9c-1-2-1-5 0-8-1-4-1-9 0-14z" /> : null}
      {species === "rabbit" ? <path d="M17 6c-3 0-4 8-3 14M31 6c3 0 4 8 3 14M14 24c0-5 4-8 10-8s10 3 10 8c0 8-4 14-10 14s-10-6-10-14z" /> : null}
      {species === "other" ? <path d="M24 12c-5 0-9 4-9 10 0 9 4 14 9 14s9-5 9-14c0-6-4-10-9-10z" /> : null}
      <circle cx="19" cy="25" r="1.4" fill={ink} stroke="none" />
      <circle cx="29" cy="25" r="1.4" fill={ink} stroke="none" />
      <path d="M22 30c1 1.2 3 1.2 4 0" />
    </svg>
  );
}

export function PetAvatar({ pet, size = 56 }: { pet: Pick<Pet, "name" | "species" | "color" | "avatarFileId">; size?: number }) {
  return (
    <span className={`pet-av c-${pet.color}`} style={{ width: size, height: size }} role="img" aria-label={`Foto de ${pet.name}`}>
      {pet.avatarFileId ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagem privada, servida com checagem de dono
        <img src={`/api/arquivos/${pet.avatarFileId}`} alt="" />
      ) : <Face species={pet.species} />}
    </span>
  );
}

export function PetDot({ color }: { color: ColorId }) {
  return <i className={`c-${color}`} style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "var(--ce)", marginRight: 6 }} />;
}

export function PetHead({ pet, today, children }: { pet: Pet; today: string; children?: ReactNode }) {
  const bits = [speciesLabel(pet.species), pet.breed].filter(Boolean).join(" · ");
  const sub = [petAge(pet.birthDate, today), formatWeight(pet.weightGrams)].filter(Boolean).join(" · ");
  return (
    <div className="pet-hero" style={{ marginBottom: 16 }}>
      <PetAvatar pet={pet} size={84} />
      <div className="col" style={{ flex: 1, minWidth: 180 }}>
        <h1 className="page-title">{pet.name}</h1>
        <span className="sm t2 b">{bits}</span>
        {sub ? <span className="sm t2">{sub}</span> : null}
      </div>
      {children ? <div className="row g8 wrap">{children}</div> : null}
    </div>
  );
}

const TABS = [
  { id: "perfil", label: "Perfil" },
  { id: "saude", label: "Saúde" },
  { id: "rotina", label: "Rotina" },
  { id: "gastos", label: "Gastos" },
] as const;
export type PetTab = (typeof TABS)[number]["id"];
export const parseTab = (value: string | undefined): PetTab => TABS.find((t) => t.id === value)?.id ?? "perfil";

export function PetTabs({ petId, active }: { petId: string; active: PetTab }) {
  return (
    <nav className="tabs" aria-label="Seções do pet" style={{ overflowX: "auto" }}>
      {TABS.map((t) => (
        <TransitionLink key={t.id} href={t.id === "perfil" ? `/pets/${petId}` : `/pets/${petId}?aba=${t.id}`} className={`tab${t.id === active ? " on" : ""}`} aria-current={t.id === active ? "page" : undefined}>
          {t.label}
        </TransitionLink>
      ))}
    </nav>
  );
}

export function PetFilter({ pets, active, base }: { pets: Pick<Pet, "id" | "name" | "color">[]; active: string | null; base: string }) {
  return (
    <div className="fx-chips" role="group" aria-label="Filtrar por pet">
      <TransitionLink className={`chip${!active ? " on" : ""}`} href={base}>Todos</TransitionLink>
      {pets.map((p) => (
        <TransitionLink key={p.id} className={`chip${active === p.id ? " on" : ""}`} href={`${base}?pet=${p.id}`}><PetDot color={p.color} />{p.name}</TransitionLink>
      ))}
    </div>
  );
}

export function NoPets() {
  return (
    <div className="empty">
      <Icon name="paw" size="xl" />
      <b>Nenhum pet por aqui ainda</b>
      <p>Cadastre o primeiro para guardar vacinas, rotina e gastos.</p>
      <TransitionLink className="btn btn-p" href="/pets/novo"><Icon name="plus" size="s" />Cadastrar pet</TransitionLink>
    </div>
  );
}
