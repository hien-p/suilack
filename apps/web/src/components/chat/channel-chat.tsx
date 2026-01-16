"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Lock, AlertCircle, RefreshCw } from "lucide-react";
import { ChatMessage } from "./chat-message";
import { InChatTransfer } from "./in-chat-transfer";
import { FileUpload } from "./file-upload";
import { useMessaging } from "@/providers/messaging-provider";
import { useSendMessage } from "@/hooks/use-send-message";
import type { DecryptedMessage, EncryptedSymmetricKey } from "@mysten/messaging";

interface ChannelChatProps {
  channelId: string; // On-chain messaging channel ID
  leader: string;
  members: string[];
  teamNumber?: string; // For blob registration
  onMessagingChannelCreated?: (channelId: string) => void;
}

export function ChannelChat({
  channelId,
  leader,
  members,
  teamNumber,
}: ChannelChatProps) {
  const account = useCurrentAccount();
  const { messagingClient, isInitialized, error: initError } = useMessaging();
  const { sendMessage, isPending: isSending, error: sendError } = useSendMessage();

  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [memberCapId, setMemberCapId] = useState<string | null>(null);
  const [encryptedKey, setEncryptedKey] = useState<EncryptedSymmetricKey | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isLeader = account?.address?.toLowerCase() === leader.toLowerCase();
  const isMember = members.some(
    (m) => m.toLowerCase() === account?.address?.toLowerCase()
  );

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize channel data and load messages
  const loadChannelData = useCallback(async () => {
    if (!messagingClient || !account?.address || !channelId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Access messaging methods via the .messaging property on the extended client
      const messaging = (messagingClient as unknown as { messaging: typeof messagingClient }).messaging;

      // Get user's member cap
      const memberCap = await messaging.getUserMemberCap(
        account.address,
        channelId
      );

      if (!memberCap) {
        setError("You don't have access to this channel");
        setLoading(false);
        return;
      }

      setMemberCapId(memberCap.id.id);

      // Get channel data to get encryption key
      const channelObjects = await messaging.getChannelObjectsByChannelIds({
        channelIds: [channelId],
        userAddress: account.address,
        memberCapIds: [memberCap.id.id],
      });

      if (channelObjects.length === 0) {
        setError("Channel not found");
        setLoading(false);
        return;
      }

      const channel = channelObjects[0];
      const key: EncryptedSymmetricKey = {
        $kind: "Encrypted",
        encryptedBytes: new Uint8Array(channel.encryption_key_history.latest),
        version: channel.encryption_key_history.latest_version,
      };
      setEncryptedKey(key);

      // Load messages
      const messagesResponse = await messaging.getChannelMessages({
        channelId,
        userAddress: account.address,
        limit: 50,
        direction: "backward",
      });

      // Sort by timestamp to show oldest first
      const sortedMessages = [...messagesResponse.messages].sort(
        (a, b) => a.createdAtMs - b.createdAtMs
      );
      setMessages(sortedMessages);
    } catch (err) {
      console.error("Failed to load channel data:", err);
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [messagingClient, account?.address, channelId]);

  // Load data when ready
  useEffect(() => {
    if (isInitialized && channelId) {
      loadChannelData();
    }
  }, [isInitialized, channelId, loadChannelData]);

  // Poll for new messages every 5 seconds
  useEffect(() => {
    if (!isInitialized || !channelId || !memberCapId) return;

    const interval = setInterval(() => {
      loadChannelData();
    }, 5000);

    return () => clearInterval(interval);
  }, [isInitialized, channelId, memberCapId, loadChannelData]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !encryptedKey || isSending || !messagingClient || !account?.address) {
      return;
    }

    // Fetch fresh memberCapId before sending to avoid stale object version
    const messaging = (messagingClient as unknown as { messaging: typeof messagingClient }).messaging;
    const freshMemberCap = await messaging.getUserMemberCap(account.address, channelId);

    if (!freshMemberCap) {
      setError("Failed to get member cap");
      return;
    }

    const result = await sendMessage({
      channelId,
      memberCapId: freshMemberCap.id.id, // Use fresh ID
      message: messageText.trim(),
      encryptedKey,
    });

    if (result?.success) {
      setMessageText("");
      // Reload messages to show the new one
      loadChannelData();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Not initialized yet
  if (!isInitialized) {
    return (
      <div className="h-96 flex items-center justify-center border border-dashed border-border rounded-lg">
        <div className="text-center space-y-2">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Initializing SEAL encryption...</p>
          {initError && (
            <p className="text-xs text-destructive">{initError}</p>
          )}
        </div>
      </div>
    );
  }

  // No channel ID yet (needs to be created)
  if (!channelId) {
    return (
      <div className="h-96 flex items-center justify-center border border-dashed border-border rounded-lg">
        <div className="text-center space-y-2">
          <Lock className="w-12 h-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">
            Messaging channel not initialized
          </p>
          <p className="text-xs text-muted-foreground">
            Create a messaging channel to start chatting
          </p>
        </div>
      </div>
    );
  }

  // Not a member
  if (!isMember && !isLeader) {
    return (
      <div className="h-96 flex items-center justify-center border border-dashed border-border rounded-lg">
        <div className="text-center space-y-2">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">
            Only team members can view the chat
          </p>
        </div>
      </div>
    );
  }

  // Error state - special handling for "no access" when user is in members list
  if (error) {
    const isPendingMember = error.includes("don't have access") && isMember;

    return (
      <div className="h-96 flex items-center justify-center border border-dashed border-border rounded-lg">
        <div className="text-center space-y-2">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
          {isPendingMember ? (
            <>
              <p className="text-yellow-400">Pending on-chain access</p>
              <p className="text-sm text-muted-foreground">
                Your membership is pending. Admin needs to set up auto-join or manually add you on-chain.
              </p>
            </>
          ) : (
            <p className="text-destructive">{error}</p>
          )}
          <Button variant="outline" size="sm" onClick={loadChannelData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px] border border-border rounded-lg overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">
                No messages yet. Start the conversation!
              </p>
              <p className="text-xs text-muted-foreground">
                Messages are end-to-end encrypted with SEAL
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <ChatMessage
                key={`${msg.sender}-${msg.createdAtMs}-${idx}`}
                sender={msg.sender}
                text={msg.text}
                createdAtMs={msg.createdAtMs}
                isCurrentUser={
                  msg.sender.toLowerCase() === account?.address?.toLowerCase()
                }
                isLeader={msg.sender.toLowerCase() === leader.toLowerCase()}
                showSender={
                  idx === 0 ||
                  messages[idx - 1].sender.toLowerCase() !==
                    msg.sender.toLowerCase()
                }
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4 bg-card">
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isSending || !memberCapId}
            className="flex-1"
          />
          <InChatTransfer
            members={members}
            onTransferComplete={(digest, recipient) => {
              // Send a message about the transfer
              if (memberCapId && encryptedKey) {
                const shortRecipient = `${recipient.slice(0, 6)}...${recipient.slice(-4)}`;
                sendMessage({
                  channelId,
                  memberCapId,
                  message: `Sent a transfer to ${shortRecipient} (tx: ${digest.slice(0, 8)}...)`,
                  encryptedKey,
                }).then(() => loadChannelData());
              }
            }}
          />
          {teamNumber && (
            <FileUpload
              teamNumber={teamNumber}
              onUploadComplete={(blobId, fileName) => {
                // Send a message about the upload
                if (memberCapId && encryptedKey) {
                  sendMessage({
                    channelId,
                    memberCapId,
                    message: `Uploaded file: ${fileName} (blob: ${blobId.slice(0, 12)}...)`,
                    encryptedKey,
                  }).then(() => loadChannelData());
                }
              }}
            />
          )}
          <Button
            onClick={handleSendMessage}
            disabled={isSending || !messageText.trim() || !memberCapId}
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        {sendError && (
          <p className="text-xs text-destructive mt-2">{sendError}</p>
        )}
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <Lock className="w-3 h-3" />
          End-to-end encrypted with SEAL
        </p>
      </div>
    </div>
  );
}
