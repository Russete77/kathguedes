"use client";

import { useState, useRef, useEffect } from "react";
import { useNotifications } from "@/hooks/use-notifications";
import { Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function NotificationBell({ userId }: { userId: string }) {
  const { notifications, unreadCount, markAsRead, markAllRead } =
    useNotifications(userId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full bg-bg-2 border border-gray-4 hover:border-pink hover:text-pink transition-all"
      >
        <Bell size={20} strokeWidth={1.6} className="stroke-gray-2" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-pink text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-[0_0_8px_#FF0080]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-12 w-[340px] bg-bg-1 border border-gray-4 rounded-[14px] shadow-card z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-4">
            <span className="font-bold text-white text-[14px]">
              Notificações
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] text-pink hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-3 text-sm">
                Nenhuma notificação.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "px-4 py-3 border-b border-gray-4/50 hover:bg-bg-2 transition-colors cursor-pointer flex gap-3",
                    !n.is_read && "bg-pink/5"
                  )}
                  onClick={() => {
                    if (!n.is_read) markAsRead(n.id);
                    if (n.url) window.location.href = n.url;
                    setOpen(false);
                  }}
                >
                  {/* Dot */}
                  <div className="mt-1.5 shrink-0">
                    {!n.is_read ? (
                      <span className="block w-2 h-2 rounded-full bg-pink shadow-[0_0_6px_#FF0080]" />
                    ) : (
                      <Check size={12} className="stroke-gray-3" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-white font-medium line-clamp-1">
                      {n.title}
                    </div>
                    <div className="text-[12px] text-gray-2 line-clamp-2">
                      {n.body}
                    </div>
                    <div className="font-mono text-[10px] text-gray-3 mt-1">
                      {formatTimeAgo(n.created_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
