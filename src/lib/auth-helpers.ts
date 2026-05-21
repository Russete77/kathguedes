import { auth } from "@clerk/nextjs/server";

/**
 * Helper centralizado para verificar role de admin.
 * Padroniza o check que estava inconsistente entre middleware e API routes.
 */
export async function isAdmin(): Promise<boolean> {
  const { sessionClaims } = await auth();
  // Checa ambos os formatos para compatibilidade
  const role =
    (sessionClaims?.metadata as { role?: string })?.role ||
    (sessionClaims as Record<string, unknown>)?.["user_role"];
  return role === "admin";
}

export async function requireAdmin(): Promise<void> {
  const admin = await isAdmin();
  if (!admin) {
    throw new Error("Acesso negado: apenas admin");
  }
}
