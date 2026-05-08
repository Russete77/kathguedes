import type { Metadata } from "next";
import { AdminSidebar } from "./admin-sidebar";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg-base flex flex-col lg:flex-row">
      <AdminSidebar />
      <main className="flex-1 p-8 overflow-auto lg:pt-8 pt-24">{children}</main>
    </div>
  );
}
