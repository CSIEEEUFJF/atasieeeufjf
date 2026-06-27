import "./globals.css";

export const metadata = {
  title: "Sistema Interno - IEEE UFJF",
  description: "Sistema interno do Ramo Estudantil IEEE UFJF.",
  icons: {
    icon: [
      { url: "/ramo-ieee-ufjf-blue.svg", type: "image/svg+xml" },
      { url: "/ramo-ieee-ufjf.png", type: "image/png" },
    ],
    apple: "/ramo-ieee-ufjf.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
