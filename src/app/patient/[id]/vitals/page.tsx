import type { Metadata } from "next";
import ObservationsView from "@/components/ObservationsView";

export const metadata: Metadata = { title: "Vitals" };

export default async function Page({ params }: PageProps<"/patient/[id]/vitals">) {
  const { id } = await params;
  return <ObservationsView id={id} category="vital-signs" title="Vitals" />;
}
