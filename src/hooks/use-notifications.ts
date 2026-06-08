"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useSupabase } from "@/lib/supabase/client";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  icon: string | null;
  url: string | null;
  is_read: boolean;
  created_at: string;
}

export function useNotifications(userId: string) {
  const { isLoaded, isSignedIn } = useAuth();
  const supabase = useSupabase();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch inicial: aguarda Clerk carregar o JWT antes de fazer a request.
  // Sem este guard, o primeiro render dispara com token null -> 401 do Supabase RLS.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) {
          setNotifications(data as AppNotification[]);
          setUnreadCount(data.filter((n) => !n.is_read).length);
        }
      });
  }, [supabase, userId, isLoaded, isSignedIn]);

  // Realtime — novas notificações
  useEffect(() => {
    const channel = supabase
      .channel(`notif-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as AppNotification;
          setNotifications((prev) => [n, ...prev].slice(0, 20));
          setUnreadCount((c) => c + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  async function markAsRead(id: string) {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  return { notifications, unreadCount, markAsRead, markAllRead };
}
