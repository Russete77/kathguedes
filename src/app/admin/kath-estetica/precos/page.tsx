import { redirect } from "next/navigation";

export const metadata = { title: "Kath Estética · Preços" };

/**
 * /admin/kath-estetica/precos foi unificado em /admin/kath-estetica/servicos:
 * cada card de serviço já tem matriz de preços + payment_rule inline.
 * Mantemos a rota como redirect pra não quebrar bookmarks/links da nav antiga.
 */
export default function AdminEsteticaPrecosPage() {
  redirect("/admin/kath-estetica/servicos");
}
