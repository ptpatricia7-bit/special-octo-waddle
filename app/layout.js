import "./globals.css";

export const metadata = {
  title: "Workspace — vídeos sociais com IA",
  description: "Crie vídeos sociais com IA",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
