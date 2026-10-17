import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Octubre Rosa",
  description: "Tres preguntas con tarjetas raspables.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
