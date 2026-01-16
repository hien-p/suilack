import { NextRequest, NextResponse } from "next/server";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SealClient } from "@mysten/seal";
import { toB64 } from "@mysten/sui/utils";
import {
  messaging,
  TESTNET_MESSAGING_PACKAGE_CONFIG,
} from "@mysten/messaging";
import { getEnokiClient } from "@/lib/enoki-client";
import { WALRUS_CONFIG, SEAL_KEY_SERVERS } from "@/config/messaging";

// Server keypair for signing transactions
function getServerKeypair(): Ed25519Keypair {
  const privateKey = process.env.SERVER_PRIVATE_KEY;
  if (privateKey) {
    return Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, "base64"));
  }
  // Development: use deterministic keypair
  const seed = new Uint8Array(32);
  seed.fill(1);
  return Ed25519Keypair.fromSecretKey(seed);
}

interface SendMessageRequest {
  channelId: string;
  memberCapId: string;
  senderAddress: string;
  message: string;
  encryptedKeyBytes: number[];
  encryptedKeyVersion: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: SendMessageRequest = await request.json();
    const {
      channelId,
      memberCapId,
      senderAddress,
      message,
      encryptedKeyBytes,
      encryptedKeyVersion,
    } = body;

    if (!channelId || !memberCapId || !senderAddress || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log("[SendMessage API] Processing message for:", senderAddress);

    // Create SuiClient with MVR config
    const suiClient = new SuiClient({
      url: getFullnodeUrl("testnet"),
      mvr: {
        overrides: {
          packages: {
            "@local-pkg/sui-stack-messaging":
              TESTNET_MESSAGING_PACKAGE_CONFIG.packageId,
          },
        },
      },
    });

    // Create extended client with messaging
    const serverKeypair = getServerKeypair();
    const serverAddress = serverKeypair.getPublicKey().toSuiAddress();

    const extendedClient = suiClient
      .$extend(
        SealClient.asClientExtension({ serverConfigs: SEAL_KEY_SERVERS })
      )
      .$extend(
        messaging({
          packageConfig: TESTNET_MESSAGING_PACKAGE_CONFIG,
          walrusStorageConfig: {
            publisher: WALRUS_CONFIG.publisher,
            aggregator: WALRUS_CONFIG.aggregator,
            epochs: WALRUS_CONFIG.epochs,
          },
          sessionKeyConfig: {
            address: senderAddress,
            ttlMin: 30,
          },
          sealConfig: {
            threshold: 1,
          },
        })
      );

    // Access messaging methods
    const messagingMethods = (
      extendedClient as unknown as { messaging: typeof extendedClient }
    ).messaging;

    // Build the encrypted key object
    const encryptedKey = {
      $kind: "Encrypted" as const,
      encryptedBytes: new Uint8Array(encryptedKeyBytes),
      version: encryptedKeyVersion,
    };

    // Build send message transaction
    const tx = new Transaction();
    const sendMessageTxBuilder = await messagingMethods.sendMessage(
      channelId,
      memberCapId,
      senderAddress,
      message,
      encryptedKey
    );
    await sendMessageTxBuilder(tx);

    // Build transaction bytes for Enoki sponsorship
    const txBytes = await tx.build({
      client: suiClient,
      onlyTransactionKind: true,
    });

    // Get Enoki client and create sponsored transaction
    const enokiClient = getEnokiClient();

    console.log("[SendMessage API] Creating sponsored transaction...");

    const sponsored = await enokiClient.createSponsoredTransaction({
      network: "testnet",
      transactionKindBytes: toB64(txBytes),
      sender: senderAddress,
    });

    console.log("[SendMessage API] Sponsored tx created:", sponsored.digest);

    // Sign with server keypair (user doesn't need to sign)
    // Note: This requires the server to be authorized to act on behalf of the user
    // For messaging, we use the memberCapId to authorize the action
    const { signature } = await serverKeypair.signTransaction(
      Buffer.from(sponsored.bytes, "base64")
    );

    // Execute the sponsored transaction
    const result = await enokiClient.executeSponsoredTransaction({
      digest: sponsored.digest,
      signature,
    });

    console.log("[SendMessage API] Transaction executed:", result.digest);

    return NextResponse.json({
      success: true,
      digest: result.digest,
    });
  } catch (error) {
    console.error("[SendMessage API] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to send message",
      },
      { status: 500 }
    );
  }
}
