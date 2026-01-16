import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { ADMIN_ADDRESSES } from "@/config/admin";

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

function saveGeneralData(data: GeneralChannelData) {
  ensureDataDir();
  data.updatedAt = new Date().toISOString();
  writeFileSync(GENERAL_FILE, JSON.stringify(data, null, 2));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminAddress, serverMemberCapId } = body;

    if (!adminAddress) {
      return NextResponse.json(
        { error: "Admin address required" },
        { status: 400 }
      );
    }

    // Check if requester is admin
    const isAdmin = ADMIN_ADDRESSES.some(
      (addr) => addr.toLowerCase() === adminAddress.toLowerCase()
    );

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Only admin can setup server bot" },
        { status: 403 }
      );
    }

    if (!serverMemberCapId) {
      return NextResponse.json(
        { error: "Server member cap ID required" },
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

    // Store server's memberCapId
    data.serverMemberCapId = serverMemberCapId;
    saveGeneralData(data);

    return NextResponse.json({
      success: true,
      serverMemberCapId: data.serverMemberCapId,
    });
  } catch (error) {
    console.error("Error setting up server bot:", error);
    return NextResponse.json(
      { error: "Failed to setup server bot" },
      { status: 500 }
    );
  }
}
