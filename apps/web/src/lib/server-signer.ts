import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { SealClient } from "@mysten/seal";
import {
  messaging,
  TESTNET_MESSAGING_PACKAGE_CONFIG,
} from "@mysten/messaging";
import { WALRUS_CONFIG, SEAL_KEY_SERVERS } from "@/config/messaging";

// Server keypair for automatic channel management
// In production, use secure key management (e.g., KMS)
const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY;

let cachedKeypair: Ed25519Keypair | null = null;
let cachedClient: ReturnType<typeof createMessagingClient> | null = null;

function getServerKeypair(): Ed25519Keypair {
  if (cachedKeypair) return cachedKeypair;

  if (SERVER_PRIVATE_KEY) {
    // Use provided private key
    cachedKeypair = Ed25519Keypair.fromSecretKey(
      Buffer.from(SERVER_PRIVATE_KEY, "base64")
    );
  } else {
    // Generate a deterministic keypair for development
    // In production, always use a securely stored private key
    console.warn(
      "[ServerSigner] No SERVER_PRIVATE_KEY set, using development keypair"
    );
    // Use a fixed seed for development consistency
    const seed = new Uint8Array(32);
    seed.fill(1); // Simple deterministic seed for dev
    cachedKeypair = Ed25519Keypair.fromSecretKey(seed);
  }

  console.log("[ServerSigner] Server address:", cachedKeypair.getPublicKey().toSuiAddress());
  return cachedKeypair;
}

function createMessagingClient(serverAddress: string) {
  const suiClient = new SuiClient({
    url: getFullnodeUrl("testnet"),
    mvr: {
      overrides: {
        packages: {
          "@local-pkg/sui-stack-messaging": TESTNET_MESSAGING_PACKAGE_CONFIG.packageId,
        },
      },
    },
  });

  const extendedClient = suiClient
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
          address: serverAddress,
          ttlMin: 30,
        },
        sealConfig: {
          threshold: 1,
        },
      })
    );

  return extendedClient;
}

function getMessagingClient() {
  const keypair = getServerKeypair();
  const address = keypair.getPublicKey().toSuiAddress();

  if (!cachedClient) {
    cachedClient = createMessagingClient(address);
  }

  return { client: cachedClient, keypair, address };
}

export async function serverAddMembers(
  channelId: string,
  creatorCapId: string,
  adminMemberCapId: string,
  newMemberAddresses: string[]
): Promise<{ digest: string; success: boolean }> {
  const { client, keypair } = getMessagingClient();

  try {
    // Access messaging methods
    const messagingMethods = (client as unknown as { messaging: typeof client }).messaging;

    // Build the add members transaction
    const tx = await messagingMethods.addMembersTransaction({
      channelId,
      memberCapId: adminMemberCapId,
      newMemberAddresses,
      creatorCapId,
    });

    // Sign and execute with server keypair
    const suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });
    const result = await suiClient.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
    });

    await suiClient.waitForTransaction({
      digest: result.digest,
    });

    return { digest: result.digest, success: true };
  } catch (error) {
    console.error("[ServerSigner] Failed to add members:", error);
    throw error;
  }
}

export function getServerAddress(): string {
  return getServerKeypair().getPublicKey().toSuiAddress();
}
