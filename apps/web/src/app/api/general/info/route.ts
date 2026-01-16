import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

// Get server address for display
function getServerAddress(): string {
  const privateKey = process.env.SERVER_PRIVATE_KEY;
  let keypair: Ed25519Keypair;
  if (privateKey) {
    keypair = Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, "base64"));
  } else {
    const seed = new Uint8Array(32);
    seed.fill(1);
    keypair = Ed25519Keypair.fromSecretKey(seed);
  }
  return keypair.getPublicKey().toSuiAddress();
}

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

export async function GET() {
  const data = getGeneralData();

  return NextResponse.json({
    messagingChannelId: data.messagingChannelId,
    creatorCapId: data.creatorCapId,
    serverMemberCapId: data.serverMemberCapId,
    serverBotReady: !!data.serverMemberCapId,
    serverAddress: getServerAddress(),
    memberCount: data.members.length,
    members: data.members,
  });
}
