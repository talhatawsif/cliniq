import type { Metadata } from "next";
import ObservationsView from "@/components/ObservationsView";

export const metadata: Metadata = { title: "Pathology" };

export default async function Page({ params }: PageProps<"/patient/[id]/pathology">) {
  const { id } = await params;
  return <ObservationsView id={id} category="laboratory" title="Pathology" />;
}
