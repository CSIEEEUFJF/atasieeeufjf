import { redirect } from "next/navigation";

import MembersPage from "../../components/MembersPage";
import { getCurrentUser } from "../../lib/auth";

export const metadata = {
  title: "Membros | Atas IEEE",
};

export default async function MembrosPage() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    redirect("/");
  }

  return <MembersPage />;
}
