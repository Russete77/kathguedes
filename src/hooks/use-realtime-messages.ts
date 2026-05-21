"use client";

import { useEffect, useState } from "react";
import { useSupabase } from "@/lib/supabase/client";

export type MessageSenderRole = "user" | "kath" | "sidney" | "admin";

export interface Message {
  id: string;
  user_id: string;
  body: string;
  sender_role: MessageSenderRole;
  is_read: boolean;
  created_at: string;
}

/**
 * Hook para mensagens em tempo real via Supabase Realtime.
 * Escuta INSERT na tabela messages filtrado por user_id.
 */
export function useRealtimeMessages(userId: string) {
  const supabase = useSupabase();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  // Buscar histórico inicial
  useEffect(() => {
    async function fetchMessages() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (data) setMessages(data as Message[]);
      setLoading(false);
    }
    fetchMessages();
  }, [supabase, userId]);

  // Escutar novos mensagens em tempo real
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            // Evitar duplicata
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  // Enviar mensagem
  async function sendMessage(body: string) {
    const { error } = await supabase.from("messages").insert({
      user_id: userId,
      body,
      sender_role: "user",
    });
    if (error) throw new Error(error.message);

    // Notificar admins (fire-and-forget — não bloqueia UX).
    // Mantém o insert via Supabase JS pra preservar o realtime; só dispara
    // o push em paralelo via API route.
    fetch("/api/chat/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }).catch(() => {});
  }

  return { messages, loading, sendMessage };
}
