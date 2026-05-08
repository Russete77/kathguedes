"use client";

import Link from "next/link";
import Image from "next/image";
import { UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart2,
  PlayCircle,
  Tag,
  ShoppingBag,
  Users,
  MessageCircle,
  Bell,
  Settings2,
  LayoutTemplate,
  Menu,
  X,
  Bike,
  Sparkles,
  Calendar,
  Gift,
  Image as ImageIcon,
  Clock,
  ChevronDown,
  Banknote,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  items: NavItem[];
}

const appNav: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: BarChart2 },
  { href: "/admin/treinos", label: "Treinos", icon: PlayCircle },
  { href: "/admin/cupons", label: "Cupons", icon: Tag },
  { href: "/admin/afiliados", label: "Afiliados", icon: ShoppingBag },
  { href: "/admin/assinantes", label: "Assinantes", icon: Users },
  { href: "/admin/consultorias", label: "Consultorias", icon: Settings2 },
  { href: "/admin/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/admin/loja", label: "Loja", icon: ShoppingBag },
  { href: "/admin/chat", label: "Chat VIP", icon: MessageCircle },
  { href: "/admin/push", label: "Push", icon: Bell },
  { href: "/admin/financeiro", label: "Financeiro", icon: Banknote },
  { href: "/admin/plans", label: "Planos", icon: Tag },
  { href: "/admin/team", label: "Equipe", icon: Users },
];

const navGroups: NavGroup[] = [
  {
    id: "estetica",
    label: "Estética Moto",
    icon: Bike,
    items: [
      { href: "/admin/kath-estetica/servicos", label: "Serviços", icon: Sparkles },
      { href: "/admin/kath-estetica/agendamentos", label: "Agendamentos", icon: Calendar },
      { href: "/admin/kath-estetica/fidelidade", label: "Fidelidade", icon: Gift },
      { href: "/admin/kath-estetica/portfolio", label: "Portfólio", icon: ImageIcon },
      { href: "/admin/kath-estetica/horarios", label: "Horários", icon: Clock },
    ],
  },
];

export function AdminSidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((g) => {
      initial[g.id] = g.items.some((i) => pathname.startsWith(i.href));
    });
    return initial;
  });

  const closeSidebar = () => setSidebarOpen(false);
  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const isNavItemActive = (href: string) => pathname === href;

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-bg-1 border-b border-gray-4 flex items-center justify-between px-4 z-30">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-gray-2 hover:text-white transition-colors"
          aria-label="Toggle menu"
        >
          <Menu size={24} />
        </button>
        <Image
          src="/icons/logo-navbar.png"
          alt="KathApp Admin"
          width={36}
          height={36}
          className="rounded-lg"
        />
        <UserButton />
      </div>

      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-[260px] bg-bg-1 border-r border-gray-4 p-5 flex flex-col shrink-0 z-50 transform transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={closeSidebar}
          className="absolute top-4 right-4 lg:hidden text-gray-2 hover:text-white transition-colors"
          aria-label="Close menu"
        >
          <X size={24} />
        </button>

        <Link href="/admin/dashboard" className="mb-8 flex items-center gap-3">
          <Image
            src="/icons/logo-navbar.png"
            alt="KathApp"
            width={44}
            height={44}
            className="rounded-lg"
          />
          <div>
            <span className="font-display text-[22px] tracking-wide text-white block leading-none">
              KATH<span className="text-pink">APP</span>
            </span>
            <div className="font-mono text-[10px] text-gray-3 tracking-[0.12em] uppercase mt-0.5">
              Admin Panel
            </div>
          </div>
        </Link>

        <nav className="flex flex-col gap-1 flex-1 overflow-y-auto pr-1">
          <div className="font-mono text-[10px] text-gray-3 tracking-[0.12em] uppercase px-3 py-2 mt-1">
            KathApp
          </div>
          {appNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeSidebar}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[14px] transition-all duration-150 group ${
                isNavItemActive(item.href)
                  ? "bg-bg-2 text-white"
                  : "text-gray-2 hover:text-white hover:bg-bg-2"
              }`}
            >
              <item.icon
                size={18}
                strokeWidth={1.6}
                className={`transition-colors ${
                  isNavItemActive(item.href)
                    ? "stroke-pink"
                    : "stroke-gray-2 group-hover:stroke-pink"
                }`}
              />
              {item.label}
            </Link>
          ))}

          {navGroups.map((group) => {
            const open = openGroups[group.id];
            const hasActive = group.items.some((i) => isNavItemActive(i.href));
            return (
              <div key={group.id} className="mt-3">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[14px] transition-all duration-150 group ${
                    hasActive
                      ? "bg-bg-2 text-white"
                      : "text-gray-2 hover:text-white hover:bg-bg-2"
                  }`}
                >
                  <group.icon
                    size={18}
                    strokeWidth={1.6}
                    className={`transition-colors ${
                      hasActive ? "stroke-pink" : "stroke-gray-2 group-hover:stroke-pink"
                    }`}
                  />
                  <span className="flex-1 text-left">{group.label}</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 stroke-gray-3 ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {open && (
                  <div className="ml-4 mt-1 border-l border-gray-4 pl-3 flex flex-col gap-0.5">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeSidebar}
                        className={`flex items-center gap-2 px-3 py-2 rounded-[6px] text-[13px] transition-all duration-150 group/sub ${
                          isNavItemActive(item.href)
                            ? "bg-bg-2 text-white"
                            : "text-gray-3 hover:text-white hover:bg-bg-2"
                        }`}
                      >
                        <item.icon
                          size={14}
                          strokeWidth={1.6}
                          className={`transition-colors ${
                            isNavItemActive(item.href)
                              ? "stroke-pink"
                              : "stroke-gray-3 group-hover/sub:stroke-pink"
                          }`}
                        />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="pt-4 border-t border-gray-4 flex items-center gap-3 hidden lg:flex">
          <UserButton />
          <span className="text-[13px] text-gray-2">Kath Guedes</span>
        </div>
      </aside>
    </>
  );
}
