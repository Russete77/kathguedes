"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/dashboard", label: "Home" },
  { href: "/fitness", label: "Biblioteca de Vídeos" },
  // Afiliados e Cupons ocultos temporariamente (reativar em breve) — rotas mantidas.
  { href: "/loja", label: "Loja" },
  { href: "/loja/pedidos", label: "Pedidos" },
  { href: "/consultoria", label: "Consultoria" },
];

export function Navbar() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="hidden md:flex bg-bg-1 border border-gray-4 rounded-full px-6 items-center justify-between h-16 max-w-4xl mx-auto">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center shrink-0">
        <Image
          src="/icons/logo-navbar.png"
          alt="KathApp"
          width={40}
          height={40}
          className="rounded-lg"
          priority
        />
      </Link>

      {/* Links */}
      <div className="flex gap-8">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "text-[14px] font-medium transition-colors duration-150",
              isActive(link.href)
                ? "text-white relative after:absolute after:bottom-[-4px] after:left-0 after:right-0 after:h-0.5 after:bg-pink after:rounded-full"
                : "text-gray-2 hover:text-white"
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
