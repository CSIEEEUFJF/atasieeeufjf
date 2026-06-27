import AccessDeniedPage from "../../../components/AccessDeniedPage";
import MembersPage from "../../../components/MembersPage";
import { canManageMembers, getCurrentUser } from "../../../lib/auth";

export const metadata = {
  title: "Membros | Diretoria - Sistema Interno IEEE UFJF",
};

export default async function DiretoriaMembrosPage() {
  const user = await getCurrentUser();
  if (!canManageMembers(user)) {
    return <AccessDeniedPage />;
  }

  return <MembersPage />;
}
