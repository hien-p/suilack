"use client";

import { cn } from "@/lib/utils";
import { Crown } from "lucide-react";

interface ChatMessageProps {
  sender: string;
  text: string;
  createdAtMs: string;
  isCurrentUser: boolean;
  isLeader: boolean;
  showSender?: boolean;
}

export function ChatMessage({
  sender,
  text,
  createdAtMs,
  isCurrentUser,
  isLeader,
  showSender = true,
}: ChatMessageProps) {
  const timestamp = new Date(parseInt(createdAtMs));
  const timeString = timestamp.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const shortAddress = `${sender.slice(0, 6)}...${sender.slice(-4)}`;

  return (
    <div
      className={cn(
        "flex flex-col gap-1 max-w-[80%]",
        isCurrentUser ? "ml-auto items-end" : "mr-auto items-start"
      )}
    >
      {showSender && !isCurrentUser && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {isLeader && <Crown className="w-3 h-3 text-yellow-500" />}
          <span className="font-mono">{shortAddress}</span>
        </div>
      )}
      <div
        className={cn(
          "rounded-lg px-3 py-2 text-sm",
          isCurrentUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{text}</p>
      </div>
      <span className="text-xs text-muted-foreground">{timeString}</span>
    </div>
  );
}
