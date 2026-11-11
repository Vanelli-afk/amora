import type { Metadata } from "next";
import { PetForm } from "@/components/pets/forms";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Cadastrar pet" };

export default async function NovoPetPage() {
  await requireUser();
  return (
    <>
      <div className="dtop"><div className="col"><h1 className="page-title">Cadastrar pet</h1><span className="sm t2 b">Quem entra para a família?</span></div></div>
      <PetForm draft={{
        id: null, name: "", species: "dog", color: "peach", breed: "", birthDate: "", weight: "", neuteredOn: "",
        microchip: "", allergies: "", vet: "", notes: "", avatarFileId: null,
      }} />
    </>
  );
}
