import InternalDashboard from "../../../components/InternalDashboard";

export const metadata = {
  title: "Calendário demo | Sistema Interno - IEEE UFJF",
};

export default function DemoCalendarPage() {
  return <InternalDashboard page="calendar" demoMode />;
}
