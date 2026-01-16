"use client";

import { useState, useCallback } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { SealClient } from "@mysten/seal";
import {
  messaging,
  TESTNET_MESSAGING_PACKAGE_CONFIG,
} from "@mysten/messaging";
import { WALRUS_CONFIG, SEAL_KEY_SERVERS } from "@/config/messaging";

interface CreateChannelParams {
  initialMembers?: string[];
}

interface CreateChannelResult {
  channelId: string;
  creatorCapId: string;
  creatorMemberCapId: string; // The creator's MemberCap ID (needed for hackathon features)
  digest: string;
}

export function useCreateMessagingChannel() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createChannel = useCallback(
    async (
      params: CreateChannelParams = {}
    ): Promise<CreateChannelResult | null> => {
      if (!account?.address) {
        setError("Not connected");
        return null;
      }

      setIsPending(true);
      setError(null);

      try {
        const { initialMembers } = params;

        console.log("[CreateChannel] Starting channel creation for:", account.address);
        console.log("[CreateChannel] Initial members:", initialMembers);

        // Create SuiClient with MVR configuration
        const mvrClient = new SuiClient({
          url: getFullnodeUrl("testnet"),
          mvr: {
            overrides: {
              packages: {
                "@local-pkg/sui-stack-messaging": TESTNET_MESSAGING_PACKAGE_CONFIG.packageId,
              },
            },
          },
        });
        console.log("[CreateChannel] MVR Client created");

        // Extend with SEAL and messaging
        const extendedClient = mvrClient
          .$extend(SealClient.asClientExtension({ serverConfigs: SEAL_KEY_SERVERS }))
          .$extend(
            messaging({
              packageConfig: TESTNET_MESSAGING_PACKAGE_CONFIG,
              walrusStorageConfig: {
                publisher: WALRUS_CONFIG.publisher,
                aggregator: WALRUS_CONFIG.aggregator,
                epochs: WALRUS_CONFIG.epochs,
              },
              sessionKeyConfig: {
                address: account.address,
                ttlMin: 30,
              },
              // Threshold 1 means only 1 key server needs to respond for encryption/decryption
              sealConfig: {
                threshold: 1,
              },
            })
          );
        console.log("[CreateChannel] Extended client created");

        // Create the channel flow
        const flow = extendedClient.messaging.createChannelFlow({
          creatorAddress: account.address,
          initialMemberAddresses: initialMembers,
        });
        console.log("[CreateChannel] Flow created");

        // Step 1: Build and execute channel creation transaction
        const channelTx = flow.build();
        console.log("[CreateChannel] Transaction built, executing...");

        const channelResult = await signAndExecute({
          transaction: channelTx,
        });
        console.log("[CreateChannel] Step 1 complete, digest:", channelResult.digest);

        await suiClient.waitForTransaction({
          digest: channelResult.digest,
        });
        console.log("[CreateChannel] Step 1 confirmed");

        // Step 2: Get the generated caps
        console.log("[CreateChannel] Getting generated caps...");
        const { creatorCap, creatorMemberCap } = await flow.getGeneratedCaps({
          digest: channelResult.digest,
        });
        console.log("[CreateChannel] Step 2 complete, creatorCap:", creatorCap?.id?.id);

        // Step 3: Generate and attach encryption key
        console.log("[CreateChannel] Generating encryption key...");
        const attachKeyTx = await flow.generateAndAttachEncryptionKey({
          creatorMemberCap,
        });
        console.log("[CreateChannel] Executing encryption key transaction...");
        const keyResult = await signAndExecute({
          transaction: attachKeyTx,
        });
        console.log("[CreateChannel] Step 3 complete, digest:", keyResult.digest);

        await suiClient.waitForTransaction({
          digest: keyResult.digest,
        });
        console.log("[CreateChannel] Step 3 confirmed");

        // Step 4: Get the final result
        console.log("[CreateChannel] Getting final result...");
        const { channelId } = flow.getGeneratedEncryptionKey();
        console.log("[CreateChannel] Channel created:", channelId);
        console.log("[CreateChannel] Creator MemberCap ID:", creatorMemberCap?.id?.id);

        return {
          channelId,
          creatorCapId: creatorCap.id.id,
          creatorMemberCapId: creatorMemberCap.id.id, // Include the MemberCap ID for hackathon features
          digest: keyResult.digest,
        };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create channel";
        setError(errorMessage);
        console.error("Create channel error:", err);
        return null;
      } finally {
        setIsPending(false);
      }
    },
    [account?.address, signAndExecute, suiClient]
  );

  return {
    createChannel,
    isPending,
    error,
  };
}
