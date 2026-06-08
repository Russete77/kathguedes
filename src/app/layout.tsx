import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Space_Grotesk, DM_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { ptBR } from "@clerk/localizations";
import { Toaster } from "sonner";
import { PwaRegister } from "@/components/pwa-register";
import { ChunkReloadGuard } from "@/components/chunk-reload-guard";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
});

const dmMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.kathguedes.com.br"),
  title: {
    default: "KathApp — Treinos e Consultoria Fitness com Kath Guedes",
    template: "%s | KathApp",
  },
  description:
    "O app fitness da Kath Guedes: treinos em vídeo para glúteos, pernas e corpo todo, consultoria personalizada de treino e dieta, loja fitness com suplementos e cupons exclusivos. Resultados reais com acompanhamento profissional.",
  keywords: [
    "treinos fitness",
    "kath guedes",
    "treino online",
    "consultoria fitness",
    "dieta personalizada",
    "treino de glúteos",
    "treino feminino",
    "app de treino",
    "personal trainer online",
    "treino em casa",
    "suplementos fitness",
    "plano de dieta",
  ],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "mask-icon", url: "/icons/icon-512.png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KathApp",
    startupImage: [
      { url: "/icons/icon-512.png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    alternateLocale: ["pt_PT"],
    url: "https://www.kathguedes.com.br",
    siteName: "KathApp",
    title: "KathApp — Treinos e Consultoria Fitness com Kath Guedes",
    description:
      "Treinos em vídeo, consultoria personalizada de treino e dieta, loja fitness e cupons exclusivos. Resultados reais com acompanhamento profissional.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "KathApp — Treinos e Consultoria Fitness com Kath Guedes",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KathApp — Treinos e Consultoria Fitness com Kath Guedes",
    description:
      "Treinos em vídeo, consultoria personalizada de treino e dieta, loja fitness e cupons exclusivos.",
    images: ["/og-image.png"],
    creator: "@kathguedes",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://www.kathguedes.com.br",
    languages: {
      "pt-BR": "https://www.kathguedes.com.br",
      "x-default": "https://www.kathguedes.com.br",
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  },
  category: "fitness",
};

export const viewport: Viewport = {
  themeColor: "#080808",
  width: "device-width",
  initialScale: 1,
  // A11y/SEO: NUNCA bloqueie zoom — Google Lighthouse penaliza userScalable=false.
  // Mantemos maximumScale=5 (default Safari) e userScalable=true (default).
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      localization={ptBR}
      appearance={{
        baseTheme: dark,
      }}
    >
      <html
        lang="pt-BR"
        className={`dark ${bebasNeue.variable} ${spaceGrotesk.variable} ${dmMono.variable}`}
      >
        <body className="bg-background text-foreground font-body antialiased">
          {children}
          <PwaRegister />
          <ChunkReloadGuard />
          <Toaster
            position="top-right"
            toastOptions={{
              className:
                "bg-bg-2 border border-gray-4 text-white font-body",
              style: { borderRadius: "14px" },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
