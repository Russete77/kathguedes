import { auth, currentUser } from "@clerk/nextjs/server";

/**
 * Helper centralizado para verificar role de admin.
 * Padroniza o check que estava inconsistente entre middleware e API routes.
 *
 * Em dev/preview eh possivel adicionar emails ao env `ADMIN_EMAILS` (CSV) para
 * obter acesso admin sem precisar setar publicMetadata.role no dashboard do
 * Clerk dev. Esse bypass NUNCA aplica em producao (NODE_ENV=production +
 * VERCEL_ENV=production) — la a fonte de verdade segue sendo o Clerk.
 */
export async function isAdmin(): Promise<boolean> {
  const { sessionClaims } = await auth();
  const role =
    (sessionClaims?.metadata as { role?: string })?.role ||
    (sessionClaims as Record<string, unknown>)?.["user_role"];
  if (role === "admin") return true;

  // Bypass de dev: ADMIN_EMAILS=email1,email2
  // Produção é determinada por NODE_ENV apenas — NÃO depender de VERCEL_ENV,
  // senão em prod fora da Vercel (self-host/Docker) o bypass por ADMIN_EMAILS
  // ficaria ativo. O bypass só vale quando NÃO estamos em produção.
  if (process.env.NODE_ENV === "production") return false;

  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length === 0) return false;

  try {
    const user = await currentUser();
    const emails = (user?.emailAddresses ?? []).map((e) =>
      e.emailAddress.toLowerCase(),
    );
    return emails.some((e) => allowlist.includes(e));
  } catch {
    return false;
  }
}

export async function requireAdmin(): Promise<void> {
  const admin = await isAdmin();
  if (!admin) {
    throw new Error("Acesso negado: apenas admin");
  }
}
