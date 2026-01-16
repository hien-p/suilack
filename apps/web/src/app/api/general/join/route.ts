import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { SealClient } from "@mysten/seal";
import {
  messaging,
  TESTNET_MESSAGING_PACKAGE_CONFIG,
} from "@mysten/messaging";
import { WALRUS_CONFIG, SEAL_KEY_SERVERS } from "@/config/messaging";

const DATA_DIR = join(process.cwd(), "data");
const GENERAL_FILE = join(DATA_DIR, "general-channel.json");

interface GeneralChannelData {
  messagingChannelId: string | null;
  creatorCapId: string | null;
  serverMemberCapId: string | null;
  members: string[];
  createdAt: string;
  updatedAt: string;
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Server keypair for automatic member addition
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

function getGeneralData(): GeneralChannelData {
  ensureDataDir();

  if (!existsSync(GENERAL_FILE)) {
    const defaultData: GeneralChannelData = {
      messagingChannelId: null,
      creatorCapId: null,
      serverMemberCapId: null,
      members: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeFileSync(GENERAL_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }

  try {
    return JSON.parse(readFileSync(GENERAL_FILE, "utf-8"));
  } catch {
    const defaultData: GeneralChannelData = {
      messagingChannelId: null,
      creatorCapId: null,
      serverMemberCapId: null,
      members: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return defaultData;
  }
}

function saveGeneralData(data: GeneralChannelData) {
  ensureDataDir();
  data.updatedAt = new Date().toISOString();
  writeFileSync(GENERAL_FILE, JSON.stringify(data, null, 2));
}

async function addMemberOnChain(
  channelId: string,
  serverMemberCapId: string,
  newMemberAddress: string
): Promise<{ digest: string }> {
  const keypair = getServerKeypair();
  const serverAddress = keypair.getPublicKey().toSuiAddress();

  console.log("[JoinAPI] Adding member on-chain:", newMemberAddress);
  console.log("[JoinAPI] Server address:", serverAddress);
  console.log("[JoinAPI] Server memberCapId:", serverMemberCapId);

  // Create SuiClient with MVR config
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

  // Create extended client with messaging
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

  // Build add members transaction
  const messagingMethods = (extendedClient as unknown as { messaging: typeof extendedClient }).messaging;
  const tx = await messagingMethods.addMembersTransaction({
    channelId,
    memberCapId: serverMemberCapId,
    newMemberAddresses: [newMemberAddress],
  });

  // Sign and execute
  const result = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
  });

  await suiClient.waitForTransaction({ digest: result.digest });

  console.log("[JoinAPI] Member added on-chain, digest:", result.digest);
  return { digest: result.digest };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address } = body;

    if (!address) {
      return NextResponse.json({ error: "Address required" }, { status: 400 });
    }

    // Validate address format
    if (!address.startsWith("0x") || address.length !== 66) {
      return NextResponse.json(
        { error: "Invalid address format" },
        { status: 400 }
      );
    }

    const data = getGeneralData();

    if (!data.messagingChannelId) {
      return NextResponse.json(
        { error: "General channel not initialized yet" },
        { status: 400 }
      );
    }

    const normalizedAddress = address.toLowerCase();

    // Check if already a member in backend
    if (data.members.includes(normalizedAddress)) {
      return NextResponse.json(
        { error: "Already a member" },
        { status: 400 }
      );
    }

    // Check if server can add members on-chain
    if (data.serverMemberCapId) {
      try {
        // Add member on-chain using server's memberCap
        const result = await addMemberOnChain(
          data.messagingChannelId,
          data.serverMemberCapId,
          normalizedAddress
        );

        // Add to backend members list
        data.members.push(normalizedAddress);
        saveGeneralData(data);

        return NextResponse.json({
          success: true,
          memberCount: data.members.length,
          onChain: true,
          digest: result.digest,
        });
      } catch (error) {
        console.error("[JoinAPI] Failed to add member on-chain:", error);
        // Fall through to backend-only addition with error info
        return NextResponse.json(
          {
            error: "Failed to add member on-chain. Server bot may need to be set up.",
            details: error instanceof Error ? error.message : "Unknown error"
          },
          { status: 500 }
        );
      }
    } else {
      // Server not set up yet - just add to backend (admin will need to add on-chain)
      data.members.push(normalizedAddress);
      saveGeneralData(data);

      return NextResponse.json({
        success: true,
        memberCount: data.members.length,
        onChain: false,
        message: "Added to pending list. Admin needs to set up server bot to enable automatic on-chain membership.",
      });
    }
  } catch (error) {
    console.error("Error joining general channel:", error);
    return NextResponse.json(
      { error: "Failed to join channel" },
      { status: 500 }
    );
  }
}
