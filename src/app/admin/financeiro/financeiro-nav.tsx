import Link from "next/link";

export function FinanceiroNav({
  active,
}: {
  active: "overview" | "comissoes" | "afiliado-externo";
}) {
  const items = [
    { id: "overview", label: "Visão geral", href: "/admin/financeiro" },
    { id: "comissoes", label: "Comissões", href: "/admin/financeiro/comissoes" },
    { id: "afiliado-externo", label: "Afiliados externos", href: "/admin/financeiro/afiliado-externo" },
  ] as const;
  return (
    <nav className="flex gap-2 flex-wrap text-sm">
      {items.map((it) => (
        <Link
          key={it.id}
          href={it.href}
          className={`px-4 py-2 rounded-full transition-all ${
            active === it.id
              ? "bg-pink text-white"
              : "bg-bg-2 text-gray-2 hover:text-white border border-gray-4"
          }`}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
