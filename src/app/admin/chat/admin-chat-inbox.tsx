"use client";

import { useState, useRef, useEffect } from "react";
import { useSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, MessageCircle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/hooks/use-realtime-messages";

interface Conversation {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  last_message: string;
  last_at: string;
  is_from_kath: boolean;
  unread: number;
}

export function AdminChatInbox({
  conversations,
}: {
  conversations: Conversation[];
}) {
  const [selected, setSelected] = useState<string | null>(null);

  if (!conversations.length) {
    return (
      <div className="text-center py-16">
        <MessageCircle size={48} className="stroke-gray-3 mx-auto mb-4" />
        <p className="text-gray-2">Nenhuma conversa VIP ainda.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)]">
      {/* Sidebar — conversation list */}
      <div
        className={cn(
          "w-[300px] bg-bg-1 border border-gray-4 rounded-[14px] overflow-y-auto shrink-0",
          selected && "hidden lg:block"
        )}
      >
        {conversations.map((c) => (
          <button
            key={c.user_id}
            onClick={() => setSelected(c.user_id)}
            className={cn(
              "w-full text-left px-4 py-3 border-b border-gray-4/50 hover:bg-bg-2 transition-colors",
              selected === c.user_id && "bg-bg-2 border-l-2 border-l-pink"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-white font-medium text-[14px] truncate">
                {c.full_name}
              </span>
              {c.unread > 0 && (
                <Badge variant="solid" className="text-[10px] px-1.5 py-0.5">
                  {c.unread}
                </Badge>
              )}
            </div>
            <p className="text-gray-3 text-[12px] truncate mt-0.5">
              {c.is_from_kath ? "Você: " : ""}
              {c.last_message}
            </p>
            <span className="font-mono text-[10px] text-gray-3">
              {new Date(c.last_at).toLocaleDateString("pt-BR")}
            </span>
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div
        className={cn(
          "flex-1 flex flex-col",
          !selected && "hidden lg:flex"
        )}
      >
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-3">Selecione uma conversa</p>
          </div>
        ) : (
          <AdminChatThread
            userId={selected}
            userName={
              conversations.find((c) => c.user_id === selected)?.full_name || ""
            }
            onBack={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
}

function AdminChatThread({
  userId,
  userName,
  onBack,
}: {
  userId: string;
  userName: string;
  onBack: () => void;
}) {
  const supabase = useSupabase();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  useEffect(() => {
    setLoading(true);
    supabase
      .from("messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data as Message[]);
        setLoading(false);
      });
  }, [supabase, userId]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`admin-chat-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = input.trim();
    if (!body) return;

    setSending(true);
    setInput("");
    try {
      await supabase.from("messages").insert({
        user_id: userId,
        body,
        is_from_kath: true,
      });

      // Push notification para o assinante
      fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          title: "Nova mensagem da Kath",
          body: body.length > 60 ? body.slice(0, 60) + "..." : body,
          url: "/chat",
        }),
      }).catch(() => {});
    } catch {
      setInput(body);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-gray-4 mb-3">
        <button
          onClick={onBack}
          className="lg:hidden text-gray-2 hover:text-white"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="text-white font-bold text-[15px]">{userName}</div>
          <div className="font-mono text-[10px] text-pink tracking-[0.1em] uppercase">
            VIP
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-pink" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-gray-3 text-sm text-center py-12">
            Sem mensagens.
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "max-w-[80%] px-4 py-3 rounded-[18px]",
                msg.is_from_kath
                  ? "bg-pink text-white ml-auto rounded-br-[4px]"
                  : "bg-bg-1 border border-gray-4 mr-auto rounded-bl-[4px]"
              )}
            >
              <p className="text-[14px] leading-relaxed">{msg.body}</p>
              <div
                className={cn(
                  "font-mono text-[10px] mt-1",
                  msg.is_from_kath ? "text-white/60" : "text-gray-3"
                )}
              >
                {new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="mt-3 flex gap-2 items-end">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Responder como Kath..."
          disabled={sending}
          className="flex-1 bg-bg-1 border border-gray-4 rounded-[14px] text-white font-body text-[15px] px-4 py-3 outline-none transition-all placeholder:text-gray-3 focus:border-pink focus:ring-[3px] focus:ring-pink-dim"
        />
        <Button
          type="submit"
          variant="icon"
          size="icon"
          disabled={sending || !input.trim()}
          className="shrink-0"
        >
          {sending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </Button>
      </form>
    </>
  );
}
