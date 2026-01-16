import { NextRequest, NextResponse } from "next/server";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";

// SuiNS Testnet Configuration
const SUINS_CONFIG = {
  parentDomain: "fmsprint.sui",
  parentNftId: "0x3fa88ffd62758f0f8721d6d471fbacc5ccde437639f70191953bf8c81ef39e8b",
  subdomainsPackageId: "0x3c272bc45f9157b7818ece4f7411bdfa8af46303b071aca4e18c03119c9ff636",
  suinsObjectId: "0x300369e8909b9a6464da265b9a5a9ab6fe2158a040e84e808628cde7a07ee5a3",
};

// Get admin keypair from environment
function getAdminKeypair(): Ed25519Keypair {
  const privateKey = process.env.ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("ADMIN_PRIVATE_KEY not configured");
  }
  const { secretKey } = decodeSuiPrivateKey(privateKey);
  return Ed25519Keypair.fromSecretKey(secretKey);
}

// Get approved leaders from file or environment
function getApprovedLeaders(): string[] {
  const { existsSync, readFileSync } = require("fs");
  const { join } = require("path");

  const leadersFile = join(process.cwd(), "data", "leaders.json");

  if (existsSync(leadersFile)) {
    try {
      const data = JSON.parse(readFileSync(leadersFile, "utf-8"));
      return data.leaders || [];
    } catch {
      // Fall back to env
    }
  }

  // Fallback to environment variable
  const leaders = process.env.APPROVED_LEADERS || "";
  return leaders.split(",").map((addr) => addr.trim().toLowerCase()).filter(Boolean);
}

// Validate team number
function validateTeamNumber(num: number): boolean {
  return Number.isInteger(num) && num >= 0 && num <= 1000;
}

// Validate Sui address format (0x + 64 hex chars = 66 total)
function isValidSuiAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(address);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamNumber, leaderAddress } = body;

    // Validate input
    if (typeof teamNumber !== "number" || !validateTeamNumber(teamNumber)) {
      return NextResponse.json(
        { error: "Invalid team number. Must be 0-1000." },
        { status: 400 }
      );
    }

    if (!leaderAddress || typeof leaderAddress !== "string") {
      return NextResponse.json(
        { error: "Leader address is required" },
        { status: 400 }
      );
    }

    // Validate Sui address format
    if (!isValidSuiAddress(leaderAddress)) {
      return NextResponse.json(
        { error: "Invalid Sui address format. Must be 0x followed by 64 hex characters." },
        { status: 400 }
      );
    }

    // Check if leader is approved
    const approvedLeaders = getApprovedLeaders();
    const normalizedLeader = leaderAddress.toLowerCase();

    if (!approvedLeaders.includes(normalizedLeader)) {
      return NextResponse.json(
        { error: "Address not approved as leader. Contact admin." },
        { status: 403 }
      );
    }

    // Initialize Sui client
    const client = new SuiClient({ url: getFullnodeUrl("testnet") });

    // Get admin keypair
    const adminKeypair = getAdminKeypair();
    const adminAddress = adminKeypair.getPublicKey().toSuiAddress();

    // Build subdomain name
    const subdomain = `team-${teamNumber}`;
    const fullSubdomainName = `${subdomain}.${SUINS_CONFIG.parentDomain}`;

    // Build transaction
    const tx = new Transaction();
    tx.setSender(adminAddress);

    tx.moveCall({
      target: `${SUINS_CONFIG.subdomainsPackageId}::subdomains::new_leaf`,
      arguments: [
        tx.object(SUINS_CONFIG.suinsObjectId),
        tx.object(SUINS_CONFIG.parentNftId),
        tx.object("0x6"), // Clock
        tx.pure.string(fullSubdomainName),
        tx.pure.address(leaderAddress), // Point subdomain to leader's address
      ],
    });

    // Sign and execute
    const result = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: adminKeypair,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    await client.waitForTransaction({ digest: result.digest });

    // Check result
    if (result.effects?.status?.status !== "success") {
      const errorMessage = result.effects?.status?.error || "Transaction failed";

      // Provide user-friendly error messages for common cases
      let userFriendlyError = errorMessage;
      if (errorMessage.includes("remove_existing_record_if_exists_and_expired")) {
        userFriendlyError = `Subdomain ${fullSubdomainName} already exists. Please choose a different team number.`;
      } else if (errorMessage.includes("ESubdomainOfSubdomain")) {
        userFriendlyError = "Cannot create a subdomain of an existing subdomain.";
      } else if (errorMessage.includes("EInvalidParent")) {
        userFriendlyError = "Invalid parent domain. Contact admin.";
      }

      return NextResponse.json(
        {
          error: userFriendlyError,
          details: errorMessage
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      subdomain: fullSubdomainName,
      leaderAddress,
      txDigest: result.digest,
      explorerUrl: `https://suiscan.xyz/testnet/tx/${result.digest}`,
    });

  } catch (error: unknown) {
    console.error("Error creating channel:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// GET endpoint to check if an address is an approved leader
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "Address parameter required" },
      { status: 400 }
    );
  }

  const approvedLeaders = getApprovedLeaders();
  const isApproved = approvedLeaders.includes(address.toLowerCase());

  return NextResponse.json({
    address,
    isApproved,
  });
}
