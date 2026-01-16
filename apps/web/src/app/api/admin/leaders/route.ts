import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

// Store leaders in a JSON file (for demo - in production use DB)
const LEADERS_FILE = join(process.cwd(), "data", "leaders.json");

interface LeadersData {
  leaders: string[];
  updatedAt: string;
}

function ensureDataDir() {
  const dataDir = join(process.cwd(), "data");
  if (!existsSync(dataDir)) {
    const { mkdirSync } = require("fs");
    mkdirSync(dataDir, { recursive: true });
  }
}

function getLeaders(): string[] {
  ensureDataDir();

  if (!existsSync(LEADERS_FILE)) {
    // Initialize with env variable leaders
    const envLeaders = process.env.APPROVED_LEADERS || "";
    const leaders = envLeaders.split(",").map(a => a.trim()).filter(Boolean);
    saveLeaders(leaders);
    return leaders;
  }

  try {
    const data: LeadersData = JSON.parse(readFileSync(LEADERS_FILE, "utf-8"));
    return data.leaders;
  } catch {
    return [];
  }
}

function saveLeaders(leaders: string[]) {
  ensureDataDir();
  const data: LeadersData = {
    leaders: leaders.map(l => l.toLowerCase()),
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(LEADERS_FILE, JSON.stringify(data, null, 2));
}

// GET - List all leaders
export async function GET() {
  const leaders = getLeaders();
  return NextResponse.json({ leaders, count: leaders.length });
}

// POST - Add a new leader
export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();

    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "Valid address required" },
        { status: 400 }
      );
    }

    // Validate address format (basic check)
    if (!address.startsWith("0x") || address.length !== 66) {
      return NextResponse.json(
        { error: "Invalid Sui address format" },
        { status: 400 }
      );
    }

    const leaders = getLeaders();
    const normalizedAddress = address.toLowerCase();

    if (leaders.includes(normalizedAddress)) {
      return NextResponse.json(
        { error: "Address already a leader" },
        { status: 400 }
      );
    }

    leaders.push(normalizedAddress);
    saveLeaders(leaders);

    return NextResponse.json({
      success: true,
      address: normalizedAddress,
      totalLeaders: leaders.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to add leader" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a leader
export async function DELETE(request: NextRequest) {
  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json(
        { error: "Address required" },
        { status: 400 }
      );
    }

    const leaders = getLeaders();
    const normalizedAddress = address.toLowerCase();
    const index = leaders.indexOf(normalizedAddress);

    if (index === -1) {
      return NextResponse.json(
        { error: "Address not found in leaders" },
        { status: 404 }
      );
    }

    leaders.splice(index, 1);
    saveLeaders(leaders);

    return NextResponse.json({
      success: true,
      removed: normalizedAddress,
      totalLeaders: leaders.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to remove leader" },
      { status: 500 }
    );
  }
}
