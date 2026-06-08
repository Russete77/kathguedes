"use client";

import { useState } from "react";
import { MessageCircle, ArrowRight } from "lucide-react";
import { ChatModal } from "@/components/chat/chat-modal";

/** Item de menu do perfil que abre o chat como MODAL (sem redirecionar p/ /chat). */
export function ChatMenuItem({ canChat }: { canChat: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left flex items-center justify-between px-5 py-4 hover:bg-bg-2 transition-colors border-b border-gray-4/50"
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-2">
            <MessageCircle size={18} />
          </span>
          <span className="text-[14px] text-gray-1">Chat com a Kath</span>
        </div>
        <ArrowRight size={14} className="stroke-gray-3" />
      </button>
      <ChatModal open={open} onOpenChange={setOpen} canChat={canChat} />
    </>
  );
}
