import { redirect } from "next/navigation";

import AccessDeniedPage from "../../../components/AccessDeniedPage";
import MembershipControlPage from "../../../components/MembershipControlPage";
import { canManageMembers, getCurrentUser } from "../../../lib/auth";

export const metadata = {
  title: "Membresias | Diretoria - Sistema Interno IEEE UFJF",
};

export default async function DiretoriaMembresiasPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/diretoria/membresias");
  }

  if (!canManageMembers(user)) {
    return <AccessDeniedPage />;
  }

  return <MembershipControlPage user={{ name: user.name || user.username || "Diretoria" }} />;
}
