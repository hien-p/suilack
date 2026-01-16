"use client";

import { useState, useCallback, useRef } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useMessaging } from "@/providers/messaging-provider";
import type { EncryptedSymmetricKey } from "@mysten/messaging";

interface SendMessageParams {
  channelId: string;
  memberCapId: string;
  message: string;
  encryptedKey: EncryptedSymmetricKey;
  attachments?: File[];
}

interface SendMessageResult {
  digest: string;
  success: boolean;
}

export function useSendMessage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { messagingClient } = useMessaging();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent concurrent sends - use ref to track send in progress
  const sendingRef = useRef(false);

  const sendMessage = useCallback(
    async (params: SendMessageParams): Promise<SendMessageResult | null> => {
      // Prevent concurrent sends
      if (sendingRef.current) {
        console.log("[SendMessage] Already sending, skipping");
        return null;
      }

      if (!messagingClient || !account?.address) {
        setError("Not connected or messaging not initialized");
        return null;
      }

      sendingRef.current = true;
      setIsPending(true);
      setError(null);

      try {
        const { channelId, memberCapId, message, encryptedKey, attachments } =
          params;

        // Access messaging methods via the .messaging property on the extended client
        const messaging = (messagingClient as unknown as { messaging: typeof messagingClient }).messaging;

        // Build fresh transaction
        const tx = new Transaction();
        const sendMessageTxBuilder = await messaging.sendMessage(
          channelId,
          memberCapId,
          account.address,
          message,
          encryptedKey,
          attachments
        );
        await sendMessageTxBuilder(tx);

        // Sign and execute immediately
        const result = await signAndExecuteTransaction({
          transaction: tx,
        });

        // Wait for transaction to be confirmed
        await suiClient.waitForTransaction({
          digest: result.digest,
          options: { showEffects: true },
        });

        // Add a small delay to ensure state is updated on chain
        await new Promise((resolve) => setTimeout(resolve, 500));

        return {
          digest: result.digest,
          success: true,
        };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to send message";
        setError(errorMessage);
        console.error("Send message error:", err);
        return null;
      } finally {
        sendingRef.current = false;
        setIsPending(false);
      }
    },
    [messagingClient, account?.address, signAndExecuteTransaction, suiClient]
  );

  return {
    sendMessage,
    isPending,
    error,
  };
}
