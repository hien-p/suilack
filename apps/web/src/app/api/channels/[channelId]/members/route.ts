import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data", "channels");
const MAX_MEMBERS = 5;

interface ChannelData {
  channelId: string;
  teamNumber: number;
  fullName: string;
  leader: string;
  members: string[];
  messagingChannelId?: string; // On-chain messaging channel ID
  creatorCapId?: string; // Creator cap for the messaging channel
  creatorMemberCapId?: string; // Creator's MemberCap ID (for hackathon features)
  createdAt: string;
  updatedAt: string;
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getChannelFilePath(channelId: string): string {
  return join(DATA_DIR, `${channelId}.json`);
}

function getChannelData(channelId: string): ChannelData | null {
  ensureDataDir();
  const filePath = getChannelFilePath(channelId);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function saveChannelData(data: ChannelData) {
  ensureDataDir();
  const filePath = getChannelFilePath(data.channelId);
  data.updatedAt = new Date().toISOString();
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Initialize channel data if not exists
function initChannelIfNeeded(
  channelId: string,
  teamNumber: number,
  leader: string
): ChannelData {
  let data = getChannelData(channelId);

  if (!data) {
    data = {
      channelId,
      teamNumber,
      fullName: `team-${teamNumber}.fmsprint.sui`,
      leader: leader.toLowerCase(),
      members: [leader.toLowerCase()], // Leader is always a member
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveChannelData(data);
  }

  return data;
}

// GET - Get channel members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const data = getChannelData(channelId);

  if (!data) {
    return NextResponse.json(
      { error: "Channel not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    channelId: data.channelId,
    fullName: data.fullName,
    leader: data.leader,
    members: data.members,
    memberCount: data.members.length,
    maxMembers: MAX_MEMBERS,
    messagingChannelId: data.messagingChannelId || null,
    creatorCapId: data.creatorCapId || null,
    creatorMemberCapId: data.creatorMemberCapId || null,
  });
}

// POST - Add a member (only leader can do this)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
    const body = await request.json();
    const { memberAddress, leaderAddress, teamNumber } = body;

    if (!memberAddress || !leaderAddress) {
      return NextResponse.json(
        { error: "memberAddress and leaderAddress required" },
        { status: 400 }
      );
    }

    // Validate address format
    if (!memberAddress.startsWith("0x") || memberAddress.length !== 66) {
      return NextResponse.json(
        { error: "Invalid member address format" },
        { status: 400 }
      );
    }

    // Initialize channel if needed
    let data = getChannelData(channelId);
    if (!data && teamNumber !== undefined) {
      data = initChannelIfNeeded(channelId, teamNumber, leaderAddress);
    }

    if (!data) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 }
      );
    }

    // Check if requester is the leader
    if (data.leader.toLowerCase() !== leaderAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "Only the channel leader can add members" },
        { status: 403 }
      );
    }

    // Check member limit
    if (data.members.length >= MAX_MEMBERS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_MEMBERS} members allowed per channel` },
        { status: 400 }
      );
    }

    // Check if already a member
    const normalizedMember = memberAddress.toLowerCase();
    if (data.members.includes(normalizedMember)) {
      return NextResponse.json(
        { error: "Address is already a member" },
        { status: 400 }
      );
    }

    // Add member
    data.members.push(normalizedMember);
    saveChannelData(data);

    return NextResponse.json({
      success: true,
      channelId: data.channelId,
      addedMember: normalizedMember,
      members: data.members,
      memberCount: data.members.length,
    });
  } catch (error) {
    console.error("Error adding member:", error);
    return NextResponse.json(
      { error: "Failed to add member" },
      { status: 500 }
    );
  }
}

// PATCH - Update messaging channel ID (only leader can do this)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
    const body = await request.json();
    const { messagingChannelId, creatorCapId, creatorMemberCapId, leaderAddress } = body;

    if (!leaderAddress) {
      return NextResponse.json(
        { error: "leaderAddress required" },
        { status: 400 }
      );
    }

    const data = getChannelData(channelId);
    if (!data) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 }
      );
    }

    // Check if requester is the leader
    if (data.leader.toLowerCase() !== leaderAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "Only the channel leader can update messaging channel" },
        { status: 403 }
      );
    }

    // Update messaging channel info
    if (messagingChannelId) {
      data.messagingChannelId = messagingChannelId;
    }
    if (creatorCapId) {
      data.creatorCapId = creatorCapId;
    }
    if (creatorMemberCapId) {
      data.creatorMemberCapId = creatorMemberCapId;
    }

    saveChannelData(data);

    return NextResponse.json({
      success: true,
      channelId: data.channelId,
      messagingChannelId: data.messagingChannelId,
      creatorCapId: data.creatorCapId,
      creatorMemberCapId: data.creatorMemberCapId,
    });
  } catch (error) {
    console.error("Error updating messaging channel:", error);
    return NextResponse.json(
      { error: "Failed to update messaging channel" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a member (only leader can do this)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
    const body = await request.json();
    const { memberAddress, leaderAddress } = body;

    if (!memberAddress || !leaderAddress) {
      return NextResponse.json(
        { error: "memberAddress and leaderAddress required" },
        { status: 400 }
      );
    }

    const data = getChannelData(channelId);
    if (!data) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 }
      );
    }

    // Check if requester is the leader
    if (data.leader.toLowerCase() !== leaderAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "Only the channel leader can remove members" },
        { status: 403 }
      );
    }

    // Cannot remove the leader
    const normalizedMember = memberAddress.toLowerCase();
    if (normalizedMember === data.leader.toLowerCase()) {
      return NextResponse.json(
        { error: "Cannot remove the leader from the channel" },
        { status: 400 }
      );
    }

    // Check if member exists
    const index = data.members.indexOf(normalizedMember);
    if (index === -1) {
      return NextResponse.json(
        { error: "Address is not a member" },
        { status: 404 }
      );
    }

    // Remove member
    data.members.splice(index, 1);
    saveChannelData(data);

    return NextResponse.json({
      success: true,
      channelId: data.channelId,
      removedMember: normalizedMember,
      members: data.members,
      memberCount: data.members.length,
    });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
