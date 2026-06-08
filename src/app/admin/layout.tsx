import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminSidebar } from "./admin-sidebar";
import { AdminBackButton } from "./admin-back-button";
import { isAdmin } from "@/lib/auth-helpers";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Segunda barreira (alem do middleware) para o caso de dev — o middleware
  // deixa passar quando ADMIN_EMAILS esta setado, e aqui validamos o email
  // de fato. Em prod, ambos os checks alinham (Clerk metadata.role = admin).
  const admin = await isAdmin();
  if (!admin) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-bg-base flex flex-col lg:flex-row">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto lg:pt-8 pt-24">
        <AdminBackButton />
        {children}
      </main>
    </div>
  );
}
