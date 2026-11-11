import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { petContext } from "@/components/pets/context";
import { PetForm } from "@/components/pets/forms";
import { getPet } from "@/data/pets";
import { formatWeight } from "@/lib/pet-meta";

export const metadata: Metadata = { title: "Editar pet" };

export default async function EditarPetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { userId } = await petContext();
  const pet = await getPet(userId, id);
  if (!pet) notFound();
  return (
    <>
      <div className="dtop"><div className="col"><h1 className="page-title">Editar {pet.name}</h1></div></div>
      <PetForm draft={{
        id: pet.id, name: pet.name, species: pet.species, color: pet.color, breed: pet.breed ?? "", birthDate: pet.birthDate ?? "",
        weight: pet.weightGrams ? formatWeight(pet.weightGrams).replace(" kg", "") : "", neuteredOn: pet.neuteredOn ?? "",
        microchip: pet.microchip ?? "", allergies: pet.allergies ?? "", vet: pet.vet ?? "", notes: pet.notes ?? "", avatarFileId: pet.avatarFileId,
      }} />
    </>
  );
}
