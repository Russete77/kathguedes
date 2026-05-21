import { redirect } from "next/navigation";

// /admin redireciona para /admin/dashboard
export default function AdminPage() {
  redirect("/admin/dashboard");
}
