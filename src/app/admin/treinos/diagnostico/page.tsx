import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-helpers";

export const metadata = { title: "Diagnóstico — Treinos" };
export const dynamic = "force-dynamic";

interface WorkoutLite {
  id: string;
  title: string;
  required_plan: string;
  is_published: boolean;
  published_at: string | null;
}

export default async function DiagnosticoTreinosPage() {
  await requireAdmin();

  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-white">
        Sem sessão. Faça login.
      </div>
    );
  }

  // ── 1. View ADMIN (bypass RLS — verdade absoluta do banco) ────────────────
  const admin = createAdminSupabaseClient();

  const [{ count: totalCount }, { count: publishedCount }, { data: lastRaw }] = await Promise.all([
    admin.from("workout_videos").select("id", { count: "exact", head: true }),
    admin
      .from("workout_videos")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true),
    admin
      .from("workout_videos")
      .select("id, title, required_plan, is_published, published_at")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(8),
  ]);

  const last = (lastRaw ?? []) as unknown as WorkoutLite[];

  // Distribuição por required_plan (apenas publicados)
  const { data: distRaw } = await admin
    .from("workout_videos")
    .select("required_plan")
    .eq("is_published", true);
  const distribution = new Map<string, number>();
  ((distRaw ?? []) as Array<{ required_plan: string }>).forEach((r) => {
    distribution.set(r.required_plan, (distribution.get(r.required_plan) ?? 0) + 1);
  });

  // ── 2. Profile do user atual ──────────────────────────────────────────────
  const { data: profileRaw } = await admin
    .from("profiles")
    .select("id, plan_tier, onboarding_completed, full_name")
    .eq("id", userId)
    .maybeSingle();
  const profile = profileRaw as unknown as {
    id: string;
    plan_tier: string | null;
    onboarding_completed: boolean | null;
    full_name: string | null;
  } | null;

  // ── 3. Plan tier level do user via função SQL ─────────────────────────────
  const { data: levelRaw } = await admin.rpc("plan_tier_level", {
    tier: profile?.plan_tier ?? "start",
  });
  const userLevel = (levelRaw as number | null) ?? 0;

  // ── 4. View AS USER (com RLS aplicada via JWT Clerk) ──────────────────────
  // Esse é o teste real: o que o /fitness retorna pra esse mesmo user.
  let userVisibleCount: number | null = null;
  let userVisibleError: string | null = null;
  let userJwtSub: string | null = null;
  try {
    const userClient = await createServerSupabaseClient();
    const { count, error } = await userClient
      .from("workout_videos")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true);
    if (error) userVisibleError = error.message;
    else userVisibleCount = count ?? 0;

    // Sonda: o que o JWT realmente envia para o Postgres?
    const { data: subRaw } = await userClient.rpc("plan_tier_level", { tier: "start" });
    if (subRaw === null) {
      userJwtSub = "(rpc retornou null — possível ausência de JWT no banco)";
    }
  } catch (e) {
    userVisibleError = e instanceof Error ? e.message : String(e);
  }

  // ── 5. Resolver o diagnóstico final ───────────────────────────────────────
  const total = totalCount ?? 0;
  const published = publishedCount ?? 0;
  const visible = userVisibleCount ?? 0;

  const role = (sessionClaims?.metadata as { role?: string })?.role ?? null;

  let veredito = "";
  let veredictoColor = "text-gray-2";
  if (total === 0) {
    veredito = "Banco vazio — inserts nunca aconteceram. Verifique se admin form ainda usa Start/Pro/VIP.";
    veredictoColor = "text-red-400";
  } else if (published === 0) {
    veredito = "Há vídeos no banco, mas nenhum com is_published=true. Marque-os como publicados.";
    veredictoColor = "text-yellow-400";
  } else if (visible === 0 && published > 0) {
    veredito = "RLS está bloqueando. Causas prováveis: (a) JWT Clerk→Supabase não configurado em produção; (b) seu profile.plan_tier é null/incompatível.";
    veredictoColor = "text-red-400";
  } else if (visible < published) {
    veredito = `Você vê ${visible} de ${published} publicados. Os ${published - visible} restantes exigem plano acima do seu (level ${userLevel}).`;
    veredictoColor = "text-yellow-400";
  } else {
    veredito = "Tudo correto. /fitness deve mostrar todos os vídeos publicados.";
    veredictoColor = "text-green-400";
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 text-white">
      <div>
        <h1 className="font-display text-3xl">DIAGNÓSTICO · BIBLIOTECA DE VÍDEOS</h1>
        <p className="text-gray-2 text-sm mt-1">
          Por que vídeos podem não aparecer em /fitness.
        </p>
      </div>

      <div className={`border rounded-[16px] p-4 ${veredictoColor.replace("text-", "border-")}/40 bg-bg-1`}>
        <div className="text-xs uppercase tracking-wider text-gray-3 mb-1">Veredito</div>
        <div className={`${veredictoColor} font-semibold leading-snug`}>{veredito}</div>
      </div>

      <Section title="1 · Banco (visão admin, sem RLS)">
        <Row label="Total workouts" value={String(total)} />
        <Row label="Publicados (is_published=true)" value={String(published)} />
        <Row label="Rascunhos" value={String(total - published)} />
        <Row
          label="Distribuição por plano (publicados)"
          value={
            distribution.size === 0
              ? "(vazio)"
              : Array.from(distribution.entries())
                  .map(([k, v]) => `${k}=${v}`)
                  .join(" · ")
          }
        />
      </Section>

      <Section title="2 · Últimos 8 vídeos (mais recente primeiro)">
        {last.length === 0 ? (
          <div className="text-gray-3 text-sm">Nenhum vídeo no banco.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="text-[11px] text-gray-3 uppercase">
              <tr>
                <th className="text-left py-1 pr-2">Título</th>
                <th className="text-left py-1 pr-2">Plano</th>
                <th className="text-left py-1 pr-2">Pub?</th>
                <th className="text-left py-1">Publicado em</th>
              </tr>
            </thead>
            <tbody className="text-gray-1">
              {last.map((w) => (
                <tr key={w.id} className="border-t border-gray-4">
                  <td className="py-1.5 pr-2 truncate max-w-[260px]">{w.title}</td>
                  <td className="py-1.5 pr-2 font-mono text-pink">{w.required_plan}</td>
                  <td className="py-1.5 pr-2">
                    {w.is_published ? (
                      <span className="text-green-400">sim</span>
                    ) : (
                      <span className="text-red-400">não</span>
                    )}
                  </td>
                  <td className="py-1.5 text-[12px] text-gray-3">
                    {w.published_at ?? "(null)"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Section>

      <Section title="3 · Você (admin logado)">
        <Row label="Clerk user_id" value={userId} mono />
        <Row label="Role no sessionClaims" value={role ?? "(ausente)"} />
        <Row label="profiles.id encontrado" value={profile ? "sim" : "NÃO (sem row em profiles)"} />
        <Row label="profiles.plan_tier" value={profile?.plan_tier ?? "(null)"} />
        <Row label="plan_tier_level (DB)" value={String(userLevel)} />
        <Row label="profiles.onboarding_completed" value={String(profile?.onboarding_completed ?? false)} />
      </Section>

      <Section title="4 · O que /fitness retorna pra você (RLS aplicada)">
        <Row
          label="Workouts visíveis"
          value={
            userVisibleError
              ? `ERRO: ${userVisibleError}`
              : `${visible} de ${published} publicados`
          }
        />
        {userJwtSub && <Row label="JWT sonda" value={userJwtSub} />}
        <Row
          label="Diferença"
          value={
            published - visible === 0
              ? "0 — você vê tudo que pode"
              : `${published - visible} ocultos (exigem plano > ${profile?.plan_tier ?? "start"})`
          }
        />
      </Section>

      <Section title="5 · Causas comuns + checklist">
        <ul className="space-y-1.5 text-sm text-gray-1 list-disc list-inside">
          <li>
            Se <b>total = 0</b>: insert falhou. O form antigo enviava
            `required_plan=start/pro/vip` que Zod rejeita. Verifique se o deploy
            atual tem o patch (slugs corretos).
          </li>
          <li>
            Se <b>published = 0</b>: marca como publicado no /admin/treinos.
          </li>
          <li>
            Se <b>visível = 0</b> e <b>published &gt; 0</b>: JWT do Clerk não
            está chegando ao Supabase com `sub`. Verificar painel Supabase
            → Authentication → Third-party Auth → Clerk habilitado.
          </li>
          <li>
            Se <b>visível &lt; published</b>: vídeos com required_plan acima
            do seu plano não aparecem por design. Republique como `free` se
            quiser testar acesso geral.
          </li>
          <li>
            Se <b>plan_tier = null</b>: webhook Clerk não criou row em profiles.
            Onboarding manual no /onboarding ou rodar o webhook.
          </li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-bg-1 border border-gray-4 rounded-[16px] p-4 space-y-2">
      <h2 className="text-xs uppercase tracking-wider text-pink">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-gray-4/50 last:border-b-0 py-1.5">
      <span className="text-gray-3 text-xs">{label}</span>
      <span className={`text-white text-sm ${mono ? "font-mono text-[12px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}
