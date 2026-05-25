"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, MessageCircle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listAdminThreadMessages,
  pollAdminThreadMessages,
  sendAdminMessage,
  markThreadAsRead,
} from "./actions";

interface Conversation {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  last_message: string;
  last_at: string;
  last_from_team: boolean;
  unread: number;
}

interface Message {
  id: string;
  user_id: string;
  body: string;
  sender_role: string;
  is_read: boolean;
  created_at: string;
}

const POLL_MS = 4000;

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
              {c.last_from_team ? "Você: " : ""}
              {c.last_message}
            </p>
            <span className="font-mono text-[10px] text-gray-3">
              {new Date(c.last_at).toLocaleDateString("pt-BR")}
            </span>
          </button>
        ))}
      </div>

      <div className={cn("flex-1 flex flex-col", !selected && "hidden lg:flex")}>
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [senderRole, setSenderRole] = useState<"kath" | "sidney">("kath");
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSeenIso = useRef<string | null>(null);

  const mergeNew = useCallback((incoming: Message[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const merged = [...prev];
      for (const m of incoming) {
        if (!seen.has(m.id)) merged.push(m);
      }
      return merged;
    });
    lastSeenIso.current = incoming[incoming.length - 1]!.created_at;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessages([]);
    lastSeenIso.current = null;
    listAdminThreadMessages(userId)
      .then((data) => {
        if (cancelled) return;
        setMessages(data);
        if (data.length) {
          lastSeenIso.current = data[data.length - 1]!.created_at;
        }
        return markThreadAsRead({ userId }).catch(() => {});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const fresh = await pollAdminThreadMessages(userId, lastSeenIso.current);
        if (!cancelled && fresh.length) {
          mergeNew(fresh);
          markThreadAsRead({ userId }).catch(() => {});
        }
      } catch {
        // silencia — proxima janela tenta de novo
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId, mergeNew]);

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
      const inserted = await sendAdminMessage({
        userId,
        body,
        senderRole,
      });
      mergeNew([inserted]);

      const senderName = senderRole === "kath" ? "Kath" : "Sidney";
      fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          title: `Nova mensagem da ${senderName}`,
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
          messages.map((msg) => {
            const fromTeam = msg.sender_role !== "user";
            const senderLabel =
              msg.sender_role === "kath"
                ? "Kath"
                : msg.sender_role === "sidney"
                ? "Sidney"
                : msg.sender_role === "admin"
                ? "Equipe"
                : "";
            return (
              <div
                key={msg.id}
                className={cn(
                  "max-w-[80%] px-4 py-3 rounded-[18px]",
                  fromTeam
                    ? "bg-pink text-white ml-auto rounded-br-[4px]"
                    : "bg-bg-1 border border-gray-4 mr-auto rounded-bl-[4px]"
                )}
              >
                {fromTeam && senderLabel && (
                  <div className="font-mono text-[10px] text-white/80 tracking-[0.1em] uppercase mb-1">
                    {senderLabel}
                  </div>
                )}
                <p className="text-[14px] leading-relaxed">{msg.body}</p>
                <div
                  className={cn(
                    "font-mono text-[10px] mt-1",
                    fromTeam ? "text-white/60" : "text-gray-3"
                  )}
                >
                  {new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="mt-3 flex gap-2 items-end">
        <select
          value={senderRole}
          onChange={(e) => setSenderRole(e.target.value as "kath" | "sidney")}
          disabled={sending}
          className="bg-bg-1 border border-gray-4 rounded-[14px] text-white text-[13px] px-3 py-3 outline-none focus:border-pink"
          aria-label="Responder como"
        >
          <option value="kath">Kath</option>
          <option value="sidney">Sidney</option>
        </select>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Responder como ${senderRole === "kath" ? "Kath" : "Sidney"}...`}
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
