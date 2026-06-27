import InternalDashboard from "../../../components/InternalDashboard";

export const metadata = {
  title: "Tarefas demo | Sistema Interno - IEEE UFJF",
};

export default function DemoTasksPage() {
  return <InternalDashboard page="tasks" demoMode />;
}
