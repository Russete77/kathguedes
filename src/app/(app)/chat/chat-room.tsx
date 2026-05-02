"use client";

import { useRef, useEffect, useState } from "react";
import { useRealtimeMessages } from "@/hooks/use-realtime-messages";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatRoomProps {
  userId: string;
}

export function ChatRoom({ userId }: ChatRoomProps) {
  const { messages, loading, sendMessage } = useRealtimeMessages(userId);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
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
      await sendMessage(body);
    } catch {
      setInput(body); // Restore on error
    } finally {
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

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "max-w-[80%] px-4 py-3 rounded-[18px]",
              msg.is_from_kath
                ? "bg-bg-1 border border-gray-4 mr-auto rounded-bl-[4px]"
                : "bg-pink text-white ml-auto rounded-br-[4px]"
            )}
          >
            {msg.is_from_kath && (
              <div className="font-mono text-[10px] text-pink tracking-[0.1em] uppercase mb-1">
                Kath
              </div>
            )}
            <p className="text-[14px] leading-relaxed">{msg.body}</p>
            <div
              className={cn(
                "font-mono text-[10px] mt-1",
                msg.is_from_kath ? "text-gray-3" : "text-white/60"
              )}
            >
              {new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="mt-4 flex gap-2 items-end"
      >
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
