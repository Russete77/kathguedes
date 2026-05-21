import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/fitness(.*)",
  "/kath-estetica(.*)",
  "/afiliados(.*)",
  "/cupons(.*)",
  "/consultoria(.*)",
  "/calculadora(.*)",
  "/desafio(.*)",
  "/loja(.*)",
  "/perfil(.*)",
  "/chat(.*)",
  "/planos(.*)",
  "/onboarding(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

// Rotas que NÃO devem redirecionar para onboarding (evita loop)
const isOnboardingExempt = createRouteMatcher([
  "/onboarding(.*)",
  "/api(.*)",
  "/login(.*)",
  "/registro(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Admin: verificar role via publicMetadata nos sessionClaims
  if (isAdminRoute(req)) {
    const session = await auth();
    if (session.sessionClaims?.metadata?.role !== "admin") {
      const url = new URL("/dashboard", req.url);
      return NextResponse.redirect(url);
    }
  }

  // Rotas protegidas: exigir autenticação
  if (isProtectedRoute(req)) {
    await auth.protect();

    // Forçar onboarding: se logado mas sem onboarding completo, redirecionar
    if (!isOnboardingExempt(req) && !isAdminRoute(req)) {
      const session = await auth();
      const metadata = session.sessionClaims?.metadata as
        | { role?: string; onboarding_completed?: boolean }
        | undefined;

      // Se não tem flag de onboarding completo, redirecionar
      // (Admins são isentos)
      if (metadata?.role !== "admin" && !metadata?.onboarding_completed) {
        const url = new URL("/onboarding", req.url);
        return NextResponse.redirect(url);
      }
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
