"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  listUserMessages,
  pollUserMessages,
  sendUserMessage,
  type ChatMessage,
} from "./actions";

const POLL_MS = 4000;

export function ChatRoom() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  // Mensagens otimistas aguardando confirmação do servidor ("enviando…").
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSeenIso = useRef<string | null>(null);

  const mergeNew = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const merged = [...prev];
      for (const m of incoming) if (!seen.has(m.id)) merged.push(m);
      return merged;
    });
    lastSeenIso.current = incoming[incoming.length - 1]!.created_at;
  }, []);

  // Carga inicial
  useEffect(() => {
    let cancelled = false;
    listUserMessages()
      .then((data) => {
        if (cancelled) return;
        setMessages(data);
        if (data.length) {
          lastSeenIso.current = data[data.length - 1]!.created_at;
        }
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Polling 4s — substitui o realtime, que dependia de RLS em dev (quebrado
  // pela Clerk dev/prod separation). Em prod tambem funciona normalmente.
  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const fresh = await pollUserMessages(lastSeenIso.current);
        if (!cancelled && fresh.length) mergeNew(fresh);
      } catch {
        // silencia — proxima janela tenta de novo
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [mergeNew]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = input.trim();
    if (!body) return;

    // Otimista: a mensagem aparece imediatamente como "enviando…" e é
    // substituída pela versão do servidor (ou removida em caso de erro).
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      user_id: "",
      body,
      sender_role: "user",
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setPendingIds((prev) => new Set(prev).add(tempId));
    setInput("");
    setSending(true);
    try {
      const inserted = await sendUserMessage({ body });
      setMessages((prev) => prev.map((m) => (m.id === tempId ? inserted : m)));
      lastSeenIso.current = inserted.created_at;
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(body); // restore on error
      toast.error(err instanceof Error ? err.message : "Erro ao enviar", {
        duration: 6000,
      });
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(tempId);
        return next;
      });
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-pink" />
      </div>
    );
  }

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-3 text-sm">
              Nenhuma mensagem ainda. Mande um oi para a Kath!
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const incoming = msg.sender_role !== "user";
          const senderName =
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
                incoming
                  ? "bg-bg-1 border border-gray-4 mr-auto rounded-bl-[4px]"
                  : "bg-pink text-white ml-auto rounded-br-[4px]",
              )}
            >
              {incoming && senderName && (
                <div className="font-mono text-[10px] text-pink tracking-[0.1em] uppercase mb-1">
                  {senderName}
                </div>
              )}
              <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
                {msg.body}
              </p>
              <div
                className={cn(
                  "font-mono text-[10px] mt-1",
                  incoming ? "text-gray-3" : "text-white/60",
                )}
              >
                {pendingIds.has(msg.id)
                  ? "enviando…"
                  : new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="mt-4 flex gap-2 items-end">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite sua mensagem..."
          disabled={sending}
          className="flex-1 bg-bg-1 border border-gray-4 rounded-[14px] text-white font-body text-[15px] px-4 py-3 outline-none transition-all placeholder:text-gray-3 focus:border-pink focus:ring-[3px] focus:ring-pink-dim disabled:opacity-50"
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
