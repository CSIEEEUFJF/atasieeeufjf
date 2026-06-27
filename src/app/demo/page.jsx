import HomeDashboard from "../../components/HomeDashboard";

export const metadata = {
  title: "Demo | Sistema Interno - IEEE UFJF",
  description: "Modo demonstracao isolado do sistema interno IEEE UFJF.",
};

export default function DemoPage() {
  return <HomeDashboard demoMode />;
}
