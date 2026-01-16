import { NextRequest, NextResponse } from "next/server";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { TESTNET_MESSAGING_PACKAGE_CONFIG } from "@mysten/messaging";

const client = new SuiClient({ url: getFullnodeUrl("testnet") });

// Messaging package ID for SEAL usage tracking
const MESSAGING_PACKAGE_ID = TESTNET_MESSAGING_PACKAGE_CONFIG.packageId;

interface ChannelStats {
  channelName: string;
  teamNumber: number;
  members: string[];
  stats: {
    totalTransactions: number;
    packageDeployments: number;
    functionCalls: number;
    walrusBlobCount: number;
    sealMessageCount: number;
    sealChannelsCreated: number;
    gasUsed: string;
    lastActivityAt: string | null;
  };
  transactions: TransactionSummary[];
  uploadedBlobs: BlobInfo[];
}

interface TransactionSummary {
  digest: string;
  sender: string;
  timestamp: string;
  kind: string;
  gasUsed: string;
  packageId?: string;
  isSealTx?: boolean;
}

interface BlobInfo {
  blobId: string;
  fileName: string;
  fileSize: number;
  uploaderAddress: string;
  uploadedAt: string;
}

// Get uploaded blobs for a channel from local storage
function getChannelBlobs(channelId: string): BlobInfo[] {
  const blobsDir = join(process.cwd(), "data", "blobs");
  const filePath = join(blobsDir, `${channelId}.json`);

  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    return data.blobs || [];
  } catch {
    return [];
  }
}

// Get transactions for an address
async function getAddressTransactions(address: string, limit = 50) {
  try {
    const txns = await client.queryTransactionBlocks({
      filter: { FromAddress: address },
      options: {
        showEffects: true,
        showInput: true,
      },
      limit,
      order: "descending",
    });
    return txns.data;
  } catch (error) {
    console.error(`Error fetching txns for ${address}:`, error);
    return [];
  }
}

// Get objects owned by address (for Walrus blobs)
async function getWalrusBlobs(address: string) {
  try {
    const objects = await client.getOwnedObjects({
      owner: address,
      filter: {
        StructType: "0xd84704c17fc870b8764832c535aa6b11f21a95cd6f5bb38a9b07d2cf42220c66::blob::Blob",
      },
      options: { showContent: true },
    });
    return objects.data;
  } catch (error) {
    console.error(`Error fetching blobs for ${address}:`, error);
    return [];
  }
}

// Get packages deployed by address
async function getDeployedPackages(address: string) {
  try {
    const objects = await client.getOwnedObjects({
      owner: address,
      filter: {
        StructType: "0x2::package::UpgradeCap",
      },
      options: { showContent: true },
    });
    return objects.data;
  } catch (error) {
    console.error(`Error fetching packages for ${address}:`, error);
    return [];
  }
}

// GET - Get stats for a team/channel
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const teamNumber = searchParams.get("team");
  const addresses = searchParams.get("addresses"); // Comma-separated

  if (!addresses) {
    return NextResponse.json(
      { error: "Addresses parameter required (comma-separated)" },
      { status: 400 }
    );
  }

  const memberAddresses = addresses.split(",").map(a => a.trim()).filter(Boolean);

  if (memberAddresses.length === 0) {
    return NextResponse.json(
      { error: "At least one address required" },
      { status: 400 }
    );
  }

  try {
    // Aggregate stats for all team members
    let totalTransactions = 0;
    let totalGasUsed = BigInt(0);
    let packageDeployments = 0;
    let walrusBlobCount = 0;
    let sealMessageCount = 0;
    let sealChannelsCreated = 0;
    let lastActivityAt: string | null = null;
    const allTransactions: TransactionSummary[] = [];
    const deployedPackageIds: string[] = [];

    for (const address of memberAddresses) {
      // Get transactions
      const txns = await getAddressTransactions(address);
      totalTransactions += txns.length;

      for (const tx of txns) {
        const gasUsed = tx.effects?.gasUsed;
        if (gasUsed) {
          totalGasUsed += BigInt(gasUsed.computationCost || 0);
          totalGasUsed += BigInt(gasUsed.storageCost || 0);
        }

        // Track latest activity
        const timestamp = tx.timestampMs;
        if (timestamp && (!lastActivityAt || timestamp > lastActivityAt)) {
          lastActivityAt = timestamp;
        }

        // Check for package publish
        const isPublish = tx.transaction?.data?.transaction?.kind === "ProgrammableTransaction";

        // Check if transaction involves SEAL/messaging package
        const txInputs = tx.transaction?.data?.transaction;
        let isSealTx = false;
        if (txInputs && "kind" in txInputs && txInputs.kind === "ProgrammableTransaction") {
          const pt = txInputs as { inputs?: unknown[]; transactions?: unknown[] };
          const transactions = pt.transactions || [];
          for (const t of transactions) {
            if (t && typeof t === "object" && "MoveCall" in t) {
              const moveCall = (t as { MoveCall: { package?: string; module?: string; function?: string } }).MoveCall;
              if (moveCall.package === MESSAGING_PACKAGE_ID) {
                isSealTx = true;
                // Track specific SEAL operations
                if (moveCall.function === "send_message") {
                  sealMessageCount++;
                } else if (moveCall.module === "channel" && moveCall.function === "share") {
                  sealChannelsCreated++;
                }
              }
            }
          }
        }

        allTransactions.push({
          digest: tx.digest,
          sender: address,
          timestamp: timestamp ? new Date(parseInt(timestamp)).toISOString() : "unknown",
          kind: isPublish ? "ProgrammableTransaction" : "Unknown",
          gasUsed: gasUsed ? (BigInt(gasUsed.computationCost || 0) + BigInt(gasUsed.storageCost || 0)).toString() : "0",
          isSealTx,
        });
      }

      // Get deployed packages
      const packages = await getDeployedPackages(address);
      packageDeployments += packages.length;

      for (const pkg of packages) {
        const content = pkg.data?.content;
        if (content && "fields" in content) {
          const fields = content.fields as Record<string, unknown>;
          if (fields.package && typeof fields.package === "string") {
            deployedPackageIds.push(fields.package);
          }
        }
      }

      // Get Walrus blobs
      const blobs = await getWalrusBlobs(address);
      walrusBlobCount += blobs.length;
    }

    // Sort transactions by timestamp
    allTransactions.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Count function calls (transactions that call functions)
    const functionCalls = allTransactions.filter(t => t.kind === "ProgrammableTransaction").length;

    // Get uploaded blobs from local storage
    const channelId = teamNumber ? `team-${teamNumber}` : "";
    const uploadedBlobs = channelId ? getChannelBlobs(channelId) : [];

    const stats: ChannelStats = {
      channelName: teamNumber ? `team-${teamNumber}.fmsprint.sui` : "Unknown",
      teamNumber: teamNumber ? parseInt(teamNumber) : -1,
      members: memberAddresses,
      stats: {
        totalTransactions,
        packageDeployments,
        functionCalls,
        walrusBlobCount: walrusBlobCount + uploadedBlobs.length, // Combine on-chain and local blobs
        sealMessageCount,
        sealChannelsCreated,
        gasUsed: totalGasUsed.toString(),
        lastActivityAt: lastActivityAt ? new Date(parseInt(lastActivityAt)).toISOString() : null,
      },
      transactions: allTransactions.slice(0, 20), // Latest 20
      uploadedBlobs: uploadedBlobs.slice(0, 10), // Latest 10 uploaded blobs
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching channel stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch channel stats" },
      { status: 500 }
    );
  }
}

// POST - Get stats for multiple addresses with more options
export async function POST(request: NextRequest) {
  try {
    const { addresses, packageIds } = await request.json();

    if (!addresses || !Array.isArray(addresses)) {
      return NextResponse.json(
        { error: "Addresses array required" },
        { status: 400 }
      );
    }

    // Similar logic but with package ID filtering
    const stats = {
      addresses,
      packageIds: packageIds || [],
      message: "Detailed stats with package filtering coming soon",
    };

    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
