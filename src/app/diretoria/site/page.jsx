import { redirect } from "next/navigation";

import AccessDeniedPage from "../../../components/AccessDeniedPage";
import SiteAdminPage from "../../../components/SiteAdminPage";
import { canManageMembers, getCurrentUser } from "../../../lib/auth";

export const metadata = {
  title: "Site do Ramo | Diretoria - Sistema Interno IEEE UFJF",
};

export default async function DiretoriaSitePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/diretoria/site");
  }

  if (!canManageMembers(user)) {
    return <AccessDeniedPage />;
  }

  return <SiteAdminPage user={{ name: user.name || user.username || "Diretoria", username: user.username || "" }} />;
}
