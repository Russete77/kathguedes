import { SignUp } from "@clerk/nextjs";

export const metadata = {
  title: "Criar Conta Grátis",
  description: "Crie sua conta grátis no KathApp — treinos em vídeo, consultoria fitness personalizada e cupons exclusivos da Kath Guedes.",
  alternates: { canonical: "https://www.kathguedes.com.br/registro" },
  openGraph: {
    title: "Criar Conta Grátis — KathApp",
    description: "Junte-se a milhares de mulheres que treinam com a Kath. Plano free disponível.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

export default function RegistroPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base p-4">
      <SignUp
        path="/registro"
        routing="path"
        signInUrl="/login"
        fallbackRedirectUrl="/dashboard"
      />
    </main>
  );
}
