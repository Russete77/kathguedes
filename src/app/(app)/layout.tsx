import { auth, currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { BackButton } from "@/components/layout/back-button";
import { NotificationBell } from "@/components/layout/notification-bell";
import { PushPrompt } from "@/components/layout/push-prompt";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  // ── Onboarding gate + sync de identidade Clerk → Supabase
  // FONTE DE VERDADE: o `middleware.ts` lê `sessionClaims.metadata.onboarding_completed`
  // (Clerk) e redireciona /onboarding antes desta layout rodar. Aqui:
  //   1) Garantimos que existe profile correspondente no Supabase (1a passada
  //      pos-signup do Clerk caso o webhook nao tenha chegado).
  //   2) Best-effort sync de `full_name` e `avatar_url` se o user mudou no Clerk
  //      e o webhook user.updated nao chegou (acontece em dev local sem tunel).
  const supabase = createAdminSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("id", userId)
    .single();

  // currentUser() bate na API do Clerk; pode falhar com 500 se a chave da
  // Vercel estiver inconsistente com a instancia (dev vs prod) ou se o
  // Clerk estiver com instabilidade. Defensivo: sem dados do Clerk seguimos
  // sem sincronizar full_name/avatar (o profile no Supabase ja tem).
  let clerkUser: Awaited<ReturnType<typeof currentUser>> | null = null;
  try {
    clerkUser = await currentUser();
  } catch (e) {
    console.error("[(app)/layout] currentUser() falhou:", e);
  }
  const clerkFullName =
    `${clerkUser?.firstName || ""} ${clerkUser?.lastName || ""}`.trim();
  const clerkAvatar = clerkUser?.imageUrl ?? null;

  if (!profile) {
    await supabase.from("profiles").insert({
      id: userId,
      full_name: clerkFullName || "Usuário",
      avatar_url: clerkAvatar,
      plan_tier: "start",
      // canceled ate pagar; UI gateia "Plano Atual" pelo subscription_status
      subscription_status: "canceled",
      onboarding_completed: true,
    });
    // Sem redirect to /onboarding — fluxo unificado em app de treinos.
    // Segue o render normal; sync abaixo é skip porque profile é null aqui.
  } else {
    // Sync best-effort: so atualiza se mudou e tem valor novo. Nao bloqueia.
    const patch: Record<string, string> = {};
    if (clerkFullName && clerkFullName !== profile.full_name) {
      patch.full_name = clerkFullName;
    }
    if (clerkAvatar && clerkAvatar !== profile.avatar_url) {
      patch.avatar_url = clerkAvatar;
    }
    if (Object.keys(patch).length > 0) {
      await supabase.from("profiles").update(patch).eq("id", userId);
    }
  }

  return (
    <div className="min-h-screen bg-bg-base">
      <header className="sticky top-0 z-40 bg-bg-base/80 backdrop-blur-xl border-b border-gray-4/50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BackButton />
            <Link href="/dashboard" className="flex items-center">
              <Image
                src="/icons/logo-navbar.png"
                alt="KathApp"
                width={36}
                height={36}
                className="rounded-lg"
                priority
              />
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell userId={userId} />
            <UserButton
              appearance={{
                elements: { avatarBox: "w-8 h-8" },
              }}
            />
          </div>
        </div>
      </header>

      <main className="pb-28">{children}</main>

      <BottomTabBar />
      <PushPrompt />
    </div>
  );
}
