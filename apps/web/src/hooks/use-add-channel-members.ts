"use client";

import { useState, useCallback } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { useMessaging } from "@/providers/messaging-provider";

interface AddMembersParams {
  channelId: string;
  memberCapId: string;
  newMemberAddresses: string[];
  creatorCapId?: string;
}

interface AddMembersResult {
  digest: string;
  addedMembers: Array<{
    memberCapId: string;
    ownerAddress: string;
  }>;
}

export function useAddChannelMembers() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { messagingClient } = useMessaging();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addMembers = useCallback(
    async (params: AddMembersParams): Promise<AddMembersResult | null> => {
      if (!messagingClient || !account?.address) {
        setError("Not connected or messaging not initialized");
        return null;
      }

      setIsPending(true);
      setError(null);

      try {
        const { channelId, memberCapId, newMemberAddresses, creatorCapId } =
          params;

        // Access messaging methods via the .messaging property on the extended client
        const messaging = (messagingClient as unknown as { messaging: typeof messagingClient }).messaging;

        // Build the add members transaction
        const tx = await messaging.addMembersTransaction({
          channelId,
          memberCapId,
          newMemberAddresses,
          creatorCapId,
          address: creatorCapId ? undefined : account.address,
        });

        // Sign and execute with wallet
        const result = await signAndExecute({
          transaction: tx,
        });

        await suiClient.waitForTransaction({
          digest: result.digest,
        });

        // Note: Getting added members info would require parsing effects
        // For now, return basic success info
        return {
          digest: result.digest,
          addedMembers: newMemberAddresses.map((addr) => ({
            memberCapId: "", // Would need to parse from effects
            ownerAddress: addr,
          })),
        };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to add members";
        setError(errorMessage);
        console.error("Add members error:", err);
        return null;
      } finally {
        setIsPending(false);
      }
    },
    [messagingClient, account?.address, signAndExecute, suiClient]
  );

  return {
    addMembers,
    isPending,
    error,
  };
}
