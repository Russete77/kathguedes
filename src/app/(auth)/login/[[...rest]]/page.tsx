import { SignIn } from "@clerk/nextjs";

export const metadata = {
  title: "Entrar",
  description: "Faça login na sua conta KathApp para acessar treinos, consultoria fitness e cupons exclusivos.",
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base p-4">
      <SignIn
        path="/login"
        routing="path"
        signUpUrl="/registro"
        fallbackRedirectUrl="/dashboard"
      />
    </main>
  );
}
