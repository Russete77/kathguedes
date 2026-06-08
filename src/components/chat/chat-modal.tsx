"use client";

import Link from "next/link";
import { MessageCircle, Crown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChatRoom } from "@/app/(app)/chat/chat-room";

/**
 * Chat da Kath como modal/overlay — abre por cima de qualquer tela (inclusive
 * do player de vídeo) sem redirecionar para /chat. Reusa o ChatRoom.
 */
export function ChatModal({
  open,
  onOpenChange,
  canChat,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canChat: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-bg-1 border-gray-4 max-w-lg w-full h-[80dvh] max-h-[80dvh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-white">
            CHAT COM A <span className="text-pink">KATH</span>
          </DialogTitle>
        </DialogHeader>

        {canChat ? (
          <ChatRoom />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
            <MessageCircle size={44} className="stroke-gray-3 mb-4" />
            <h3 className="font-display text-2xl text-white mb-2">
              CHAT <span className="text-pink">EXCLUSIVO</span>
            </h3>
            <p className="text-gray-2 text-sm mb-6 max-w-xs">
              O chat direto com a Kath é dos planos Saúde Completa e Atleta.
            </p>
            <Link href="/planos">
              <Button size="lg" onClick={() => onOpenChange(false)}>
                <Crown size={16} />
                Ver planos
              </Button>
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
