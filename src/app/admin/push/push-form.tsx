"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, Bell, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Target = "broadcast" | "user";

export function PushForm() {
  const [target, setTarget] = useState<Target>("broadcast");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!title.trim() || !body.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          url: url || undefined,
          userId: target === "user" ? userId : undefined,
        }),
      });

      if (res.ok) {
        toast.success("Notificação enviada!", {
          description: target === "broadcast" ? "Enviado para todos" : `Enviado para ${userId}`,
          style: { borderLeft: "3px solid #00FF88" },
        });
        setTitle("");
        setBody("");
        setUrl("");
        setUserId("");
      } else {
        const data = await res.json();
        toast.error(data.error || "Erro ao enviar");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Target selector */}
      <div className="flex gap-3">
        <button
          onClick={() => setTarget("broadcast")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 p-4 rounded-[14px] border transition-all",
            target === "broadcast"
              ? "bg-pink-dim border-pink/40 text-pink"
              : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
          )}
        >
          <Users size={20} />
          <div>
            <div className="font-bold text-[14px]">Todos</div>
            <div className="text-[11px] text-gray-3">Broadcast</div>
          </div>
        </button>
        <button
          onClick={() => setTarget("user")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 p-4 rounded-[14px] border transition-all",
            target === "user"
              ? "bg-pink-dim border-pink/40 text-pink"
              : "bg-bg-1 border-gray-4 text-gray-2 hover:border-gray-3"
          )}
        >
          <User size={20} />
          <div>
            <div className="font-bold text-[14px]">Usuário</div>
            <div className="text-[11px] text-gray-3">Individual</div>
          </div>
        </button>
      </div>

      {/* Form */}
      <div className="bg-bg-1 border border-gray-4 rounded-[22px] p-6 space-y-4">
        {target === "user" && (
          <Input
            label="User ID (Clerk)"
            placeholder="user_2x..."
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        )}

        <Input
          label="Título"
          placeholder="Ex: Novo treino disponível!"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="flex flex-col gap-2">
          <label className="text-[12px] font-semibold text-gray-2 tracking-[0.06em] uppercase">
            Mensagem
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Ex: Kath publicou um novo treino de glúteos — confira agora!"
            rows={3}
            className="bg-bg-2 border border-gray-4 rounded-[8px] text-white font-body text-[15px] px-4 py-3 outline-none resize-none focus:border-pink focus:ring-[3px] focus:ring-pink-dim placeholder:text-gray-3"
          />
        </div>

        <Input
          label="URL (opcional)"
          placeholder="/fitness ou /cupons"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          hint="Deep link — abre essa página quando o usuário clicar na notificação"
        />

        {/* Preview */}
        {(title || body) && (
          <div className="bg-bg-2 border border-gray-4 rounded-[14px] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell size={14} className="stroke-pink" />
              <span className="font-mono text-[10px] text-gray-3 tracking-[0.1em] uppercase">
                Preview
              </span>
            </div>
            <div className="text-white text-[14px] font-bold">{title || "Título..."}</div>
            <div className="text-gray-2 text-[13px] mt-0.5">{body || "Mensagem..."}</div>
            {url && (
              <div className="font-mono text-[11px] text-pink mt-1">{url}</div>
            )}
          </div>
        )}

        <Button
          size="lg"
          className="w-full"
          onClick={handleSend}
          disabled={loading || !title.trim() || !body.trim() || (target === "user" && !userId.trim())}
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
          {loading ? "Enviando..." : target === "broadcast" ? "Enviar para Todos" : "Enviar para Usuário"}
        </Button>
      </div>

      {/* Info */}
      <div className="bg-bg-1 border border-gray-4 rounded-[14px] p-4 space-y-2">
        <div className="font-mono text-[11px] text-gray-3 tracking-[0.1em] uppercase mb-2">
          Notificações automáticas ativas
        </div>
        {[
          "Novo treino publicado → todos com plano elegível",
          "Novo cupom criado → todos com plano elegível",
          "Consultoria entregue → assinante específico",
          "Pedido enviado → assinante específico",
          "Pagamento confirmado → assinante específico",
          "Pagamento atrasado → assinante específico",
          "Mensagem da Kath → assinante VIP",
        ].map((text, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px] text-gray-2">
            <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
            {text}
          </div>
        ))}
      </div>
    </div>
  );
}
