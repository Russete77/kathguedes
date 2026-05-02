import { auth, currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { NotificationBell } from "@/components/layout/notification-bell";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  // Verificar se profile existe no Supabase
  const supabase = createAdminSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, phone")
    .eq("id", userId)
    .single();

  // Sem profile → criar e redirecionar pra onboarding
  if (!profile) {
    const user = await currentUser();
    await supabase.from("profiles").insert({
      id: userId,
      full_name: `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Usuário",
      plan_tier: "free",
      subscription_status: "active",
    });
    redirect("/onboarding");
  }

  // Profile existe mas sem telefone → onboarding incompleto
  if (!profile.phone) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen bg-bg-base">
      <header className="sticky top-0 z-40 bg-bg-base/80 backdrop-blur-xl border-b border-gray-4/50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
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
    </div>
  );
}
