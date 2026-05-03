import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { AdminChatInbox } from "./admin-chat-inbox";

export const metadata = { title: "Chat VIP" };

export default async function AdminChatPage() {
  const supabase = createAdminSupabaseClient();

  // Buscar todas as conversas VIP agrupadas por user_id
  // Pega a última mensagem de cada usuário + dados do perfil
  const { data: conversations } = await supabase
    .from("messages")
    .select("user_id, body, sender_role, is_read, created_at, profiles(full_name, avatar_url)")
    .order("created_at", { ascending: false });

  // Agrupar por user_id — pegar apenas a última mensagem de cada
  const grouped = new Map<
    string,
    {
      user_id: string;
      full_name: string;
      avatar_url: string | null;
      last_message: string;
      last_at: string;
      last_from_team: boolean;
      unread: number;
    }
  >();

  if (conversations) {
    for (const msg of conversations) {
      const fromTeam = (msg as unknown as { sender_role: string }).sender_role !== "user";
      if (!grouped.has(msg.user_id)) {
        const profile = msg.profiles as unknown as { full_name: string; avatar_url: string | null } | null;
        grouped.set(msg.user_id, {
          user_id: msg.user_id,
          full_name: profile?.full_name || "Assinante",
          avatar_url: profile?.avatar_url || null,
          last_message: msg.body,
          last_at: msg.created_at,
          last_from_team: fromTeam,
          unread: 0,
        });
      }
      // Contar não lidas (mensagens do user que a equipe não leu)
      if (!fromTeam && !msg.is_read) {
        const conv = grouped.get(msg.user_id)!;
        conv.unread++;
      }
    }
  }

  const convList = Array.from(grouped.values()).sort(
    (a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime()
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-4xl text-white">
          INBOX <span className="text-pink">VIP</span>
        </h1>
        <p className="text-gray-2 text-sm mt-1">
          Conversas com assinantes VIP — responda em tempo real.
        </p>
      </div>

      <AdminChatInbox conversations={convList} />
    </div>
  );
}
