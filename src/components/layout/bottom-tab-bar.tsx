"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart2, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Home", icon: Home, href: "/dashboard" },
  { label: "Biblioteca", icon: BarChart2, href: "/fitness" },
  { label: "Loja", icon: ShoppingBag, href: "/loja" },
  { label: "Perfil", icon: User, href: "/perfil" },
];

export function BottomTabBar() {
  const pathname = usePathname();

  // Esconde no player imersivo de treino e em chat (mobile UX intencional).
  // /fitness/[id] usa o player com botões flutuantes próprios; /chat ocupa
  // a viewport inteira por padrão.
  const isImmersive =
    /^\/fitness\/[^/]+$/.test(pathname ?? "") ||
    (pathname ?? "").startsWith("/motivacional/");

  if (isImmersive) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[rgba(22,22,22,0.95)] backdrop-blur-xl border border-gray-4 rounded-[28px] px-2 py-3 flex justify-around w-[360px] max-w-[calc(100vw-2rem)]">
      {tabs.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex flex-col items-center gap-1 px-4 py-1.5 rounded-[14px]",
              "text-[10px] font-semibold tracking-[0.06em] uppercase transition-all duration-150",
              active
                ? "text-pink bg-pink-dim"
                : "text-gray-3 hover:text-white"
            )}
          >
            <tab.icon
              size={20}
              strokeWidth={active ? 2 : 1.6}
              className={cn(
                "transition-all duration-150",
                active ? "stroke-pink scale-110" : "stroke-gray-3"
              )}
            />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
