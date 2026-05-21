import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ChatRoom } from "./chat-room";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Chat VIP",
  description: "Chat direto com a Kath Guedes — tire dúvidas, peça ajustes no plano e converse em tempo real. Exclusivo para assinantes VIP.",
};

export default async function ChatPage() {
  const { userId } = await auth();
  const supabase = await createServerSupabaseClient();

  // Verificar se é VIP
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", userId!)
    .single();

  if (profile?.plan_tier !== "vip") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 text-center py-20">
        <MessageCircle size={48} className="stroke-gray-3 mx-auto mb-4" />
        <h2 className="font-display text-3xl text-white mb-2">
          CHAT <span className="text-pink">EXCLUSIVO VIP</span>
        </h2>
        <p className="text-gray-2 mb-6">
          O chat direto com a Kath é exclusivo para assinantes VIP.
          Faça upgrade para ter acesso.
        </p>
        <Link href="/planos">
          <Button size="lg">Ver Planos</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 h-[calc(100vh-120px)] flex flex-col">
      <div className="mb-4">
        <h1 className="font-display text-3xl text-white">
          CHAT COM A <span className="text-pink">KATH</span>
        </h1>
        <p className="text-gray-3 text-sm mt-1">
          Mensagens exclusivas — resposta em até 24h.
        </p>
      </div>

      <ChatRoom userId={userId!} />
    </div>
  );
}
