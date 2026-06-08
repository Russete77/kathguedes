import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/fitness(.*)",
  "/afiliados(.*)",
  "/cupons(.*)",
  "/consultoria(.*)",
  "/calculadora(.*)",
  "/desafio(.*)",
  "/loja(.*)",
  "/perfil(.*)",
  "/chat(.*)",
  "/planos(.*)",
  "/motivacional(.*)",
  "/onboarding(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // Admin: verificar role via publicMetadata nos sessionClaims.
  // Em prod o middleware eh o gate. Em dev, se ADMIN_EMAILS estiver setado e o role
  // do Clerk nao for admin, deixamos passar — o layout faz a checagem completa por
  // email (currentUser()), que em middleware sairia caro.
  if (isAdminRoute(req)) {
    const session = await auth();
    if (session.sessionClaims?.metadata?.role !== "admin") {
      // Produção = NODE_ENV apenas (não depender de VERCEL_ENV — em prod fora da
      // Vercel o bypass por ADMIN_EMAILS ficaria ativo).
      const isProd = process.env.NODE_ENV === "production";
      const hasDevAdminAllowlist =
        !isProd && (process.env.ADMIN_EMAILS ?? "").trim().length > 0;
      if (!hasDevAdminAllowlist) {
        const url = new URL("/dashboard", req.url);
        return NextResponse.redirect(url);
      }
    }
  }

  // Rotas protegidas: exigir autenticação. Onboarding foi removido (app unificou
  // em "só treinos") — phone/CPF agora são coletados no checkout.
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
