import AtaApp from "../../components/AtaApp";

export const metadata = {
  title: "Demo | Sistema Interno - IEEE UFJF",
  description: "Modo demonstracao isolado do sistema interno IEEE UFJF.",
};

export default function DemoPage() {
  return <AtaApp demoMode />;
}
