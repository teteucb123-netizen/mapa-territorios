import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mapa de Territórios",
  description: "Mapeamento de regiões de atuação, unidades, distâncias e rotas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full h-full flex flex-col bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
