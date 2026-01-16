import { NextRequest, NextResponse } from "next/server";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";

const client = new SuiClient({ url: getFullnodeUrl("testnet") });

// SuiNS Configuration for channel lookup
const SUINS_CONFIG = {
  parentDomain: "fmsprint.sui",
  suinsPackageId: "0x22fa05f21b1ad71442491220bb9338f7b7095fe35000ef88d5400d28523bdd93",
  registryTableId: "0xb120c0d55432630fce61f7854795a3463deb6e3b443cc4ae72e1282073ff56e4",
};

// Get approved leaders from environment
function getApprovedLeaders(): string[] {
  const leaders = process.env.APPROVED_LEADERS || "";
  return leaders.split(",").map((addr) => addr.trim().toLowerCase()).filter(Boolean);
}

// Get sponsor (admin) keypair from environment
function getSponsorKeypair(): Ed25519Keypair {
  const privateKey = process.env.ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("ADMIN_PRIVATE_KEY not configured");
  }
  const { secretKey } = decodeSuiPrivateKey(privateKey);
  return Ed25519Keypair.fromSecretKey(secretKey);
}

// Check if address is an approved leader
function isApprovedLeader(address: string): boolean {
  const leaders = getApprovedLeaders();
  return leaders.includes(address.toLowerCase());
}

// Check if address is a channel leader (owns a team subdomain)
async function isChannelLeader(address: string): Promise<boolean> {
  try {
    // Check team numbers 0-100 for any owned by this address
    const checkNumbers = Array.from({ length: 101 }, (_, i) => i);

    for (const num of checkNumbers) {
      try {
        const subdomain = `team-${num}`;
        const result = await client.getDynamicFieldObject({
          parentId: SUINS_CONFIG.registryTableId,
          name: {
            type: `${SUINS_CONFIG.suinsPackageId}::domain::Domain`,
            value: {
              labels: ["sui", "fmsprint", subdomain],
            },
          },
        });

        if (result.data?.content && "fields" in result.data.content) {
          const fields = result.data.content.fields as Record<string, unknown>;
          if (fields.value && typeof fields.value === "object") {
            const valueFields = (fields.value as Record<string, unknown>).fields as Record<string, unknown>;
            const targetAddress = valueFields?.target_address as string;
            if (targetAddress?.toLowerCase() === address.toLowerCase()) {
              return true;
            }
          }
        }
      } catch {
        // Subdomain doesn't exist, continue
      }
    }
    return false;
  } catch {
    return false;
  }
}

// Verify sender is authorized for sponsorship
async function isAuthorizedForSponsorship(address: string): Promise<{ authorized: boolean; reason: string }> {
  // Check if approved leader first (fast check)
  if (isApprovedLeader(address)) {
    return { authorized: true, reason: "approved_leader" };
  }

  // Check if channel leader (owns a team subdomain)
  if (await isChannelLeader(address)) {
    return { authorized: true, reason: "channel_leader" };
  }

  return { authorized: false, reason: "not_authorized" };
}

interface SponsorRequest {
  txBytes: string; // Base64 encoded transaction bytes
  sender: string;
}

// POST - Sponsor a transaction (admin pays gas) - ONLY for authorized addresses
export async function POST(request: NextRequest) {
  try {
    const body: SponsorRequest = await request.json();
    const { txBytes, sender } = body;

    if (!txBytes || !sender) {
      return NextResponse.json(
        { error: "txBytes and sender are required" },
        { status: 400 }
      );
    }

    // Security check: Only sponsor for authorized addresses
    const authCheck = await isAuthorizedForSponsorship(sender);
    if (!authCheck.authorized) {
      return NextResponse.json(
        {
          error: "Address not authorized for sponsored transactions",
          reason: authCheck.reason,
          message: "Only approved leaders and channel leaders can use gas-free messaging"
        },
        { status: 403 }
      );
    }

    const sponsorKeypair = getSponsorKeypair();
    const sponsorAddress = sponsorKeypair.toSuiAddress();

    // Decode the transaction bytes
    const txBytesArray = Uint8Array.from(atob(txBytes), c => c.charCodeAt(0));

    // Deserialize the transaction
    const tx = Transaction.from(txBytesArray);

    // Set the gas owner to sponsor (admin pays gas)
    tx.setSender(sender);
    tx.setGasOwner(sponsorAddress);

    // Build and get the transaction bytes for signing
    const builtTx = await tx.build({ client });

    // Sign the transaction as sponsor (for gas payment)
    const sponsorSignature = await sponsorKeypair.signTransaction(builtTx);

    return NextResponse.json({
      success: true,
      sponsoredTxBytes: Buffer.from(builtTx).toString("base64"),
      sponsorSignature: sponsorSignature.signature,
      sponsorAddress,
      authorizedAs: authCheck.reason,
    });
  } catch (error) {
    console.error("Error sponsoring transaction:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sponsor transaction" },
      { status: 500 }
    );
  }
}

// GET - Check if sponsorship is available and get sponsor balance
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const checkAddress = searchParams.get("address");

  try {
    const sponsorKeypair = getSponsorKeypair();
    const sponsorAddress = sponsorKeypair.toSuiAddress();

    // Get sponsor balance
    const balance = await client.getBalance({
      owner: sponsorAddress,
    });

    const balanceSui = Number(balance.totalBalance) / 1_000_000_000;
    const hasBalance = balanceSui > 0.1;

    // If address provided, check if they're authorized
    let addressAuthorized = false;
    let authReason = "";
    if (checkAddress) {
      const authCheck = await isAuthorizedForSponsorship(checkAddress);
      addressAuthorized = authCheck.authorized;
      authReason = authCheck.reason;
    }

    return NextResponse.json({
      available: hasBalance && (checkAddress ? addressAuthorized : true),
      sponsorAddress,
      balanceSui: balanceSui.toFixed(4),
      message: !hasBalance
        ? "Sponsor balance low - users may need to pay their own gas"
        : checkAddress && !addressAuthorized
        ? "Address not authorized for sponsored transactions"
        : "Sponsored transactions are available - messages are gas-free!",
      ...(checkAddress && {
        addressAuthorized,
        authReason,
      }),
    });
  } catch (error) {
    return NextResponse.json({
      available: false,
      message: "Sponsorship not configured",
    });
  }
}
