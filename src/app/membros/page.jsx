import { redirect } from "next/navigation";

import MembersPage from "../../components/MembersPage";
import { canManageMembers, getCurrentUser } from "../../lib/auth";

export const metadata = {
  title: "Membros | Sistema de Atas - IEEE UFJF",
};

export default async function MembrosPage() {
  const user = await getCurrentUser();
  if (!canManageMembers(user)) {
    redirect("/");
  }

  return <MembersPage />;
}
