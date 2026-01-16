import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data", "blobs");

interface BlobData {
  blobId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploaderAddress: string;
  channelId: string;
  uploadedAt: string;
}

interface ChannelBlobsData {
  channelId: string;
  blobs: BlobData[];
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getBlobsFilePath(channelId: string): string {
  return join(DATA_DIR, `${channelId}.json`);
}

function getChannelBlobs(channelId: string): ChannelBlobsData {
  ensureDataDir();
  const filePath = getBlobsFilePath(channelId);

  if (!existsSync(filePath)) {
    return {
      channelId,
      blobs: [],
    };
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return {
      channelId,
      blobs: [],
    };
  }
}

function saveChannelBlobs(data: ChannelBlobsData) {
  ensureDataDir();
  const filePath = getBlobsFilePath(data.channelId);
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// GET - Get all blobs for a channel
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const data = getChannelBlobs(channelId);

  return NextResponse.json({
    channelId: data.channelId,
    blobs: data.blobs,
    totalSize: data.blobs.reduce((sum, b) => sum + b.fileSize, 0),
    count: data.blobs.length,
  });
}

// POST - Register a new blob
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
    const body = await request.json();
    const { blobId, fileName, fileSize, mimeType, uploaderAddress } = body;

    if (!blobId || !fileName || !uploaderAddress) {
      return NextResponse.json(
        { error: "blobId, fileName, and uploaderAddress required" },
        { status: 400 }
      );
    }

    const data = getChannelBlobs(channelId);

    // Check if blob already registered
    if (data.blobs.some((b) => b.blobId === blobId)) {
      return NextResponse.json(
        { error: "Blob already registered" },
        { status: 400 }
      );
    }

    // Add blob
    const newBlob: BlobData = {
      blobId,
      fileName,
      fileSize: fileSize || 0,
      mimeType: mimeType || "application/octet-stream",
      uploaderAddress: uploaderAddress.toLowerCase(),
      channelId,
      uploadedAt: new Date().toISOString(),
    };

    data.blobs.push(newBlob);
    saveChannelBlobs(data);

    return NextResponse.json({
      success: true,
      blob: newBlob,
    });
  } catch (error) {
    console.error("Error registering blob:", error);
    return NextResponse.json(
      { error: "Failed to register blob" },
      { status: 500 }
    );
  }
}
