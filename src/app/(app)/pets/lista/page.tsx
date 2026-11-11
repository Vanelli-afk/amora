import type { Metadata } from "next";
import { Badge } from "@/components/financas/ui";
import { petContext, petStatus } from "@/components/pets/context";
import { NoPets, PetAvatar } from "@/components/pets/ui";
import { Icon } from "@/components/ui/icon";
import { TransitionLink } from "@/components/ui/links";
import { loadPetsOverview } from "@/data/pets";
import { formatWeight, petAge, speciesLabel } from "@/lib/pet-meta";

export const metadata: Metadata = { title: "Meus pets" };

export default async function ListaPage() {
  const { userId, today } = await petContext();
  const o = await loadPetsOverview(userId, today);
  return (
    <>
      <div className="dtop">
        <div className="col"><h1 className="page-title">Meus pets</h1><span className="sm t2 b">{o.pets.length} na família</span></div>
        <TransitionLink className="btn btn-p" href="/pets/novo"><Icon name="plus" size="s" />Cadastrar pet</TransitionLink>
      </div>
      {!o.pets.length ? <NoPets /> : (
        <div className="pet-cards">
          {o.pets.map((pet) => {
            const status = petStatus(pet, o, today);
            return (
              <article key={pet.id} className="pet-card">
                <div className="row g12">
                  <PetAvatar pet={pet} size={64} />
                  <div className="col"><b className="h3">{pet.name}</b><span className="sm t2">{[speciesLabel(pet.species), pet.breed].filter(Boolean).join(" · ")}</span><span className="sm t2">{[petAge(pet.birthDate, today), formatWeight(pet.weightGrams)].filter(Boolean).join(" · ")}</span></div>
                </div>
                <Badge tone={status.tone}>{status.label}</Badge>
                <div className="row g8">
                  <TransitionLink className="btn btn-p" href={`/pets/${pet.id}`}>Ver perfil</TransitionLink>
                  <TransitionLink className="btn btn-s" href={`/pets/${pet.id}/editar`}>Editar</TransitionLink>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
