import { redirect } from "next/navigation";

// The signed-out landing page arrives with sign-in (M6); until then the worklist is the front door.
export default function Home() {
  redirect("/patients");
}
