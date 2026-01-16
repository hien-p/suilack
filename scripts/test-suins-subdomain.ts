/**
 * Test script for creating SuiNS subdomains
 * Creates a subdomain like testtest-team-1.fmsprint.sui
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { execSync } from "child_process";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";

// Configuration
const NETWORK = "testnet";
const PARENT_DOMAIN = "fmsprint.sui";
const PARENT_NFT_ID = "0x3fa88ffd62758f0f8721d6d471fbacc5ccde437639f70191953bf8c81ef39e8b";

// SuiNS Testnet Package IDs
const SUINS_PACKAGE_ID = "0x22fa05f21b1ad71442491220bb9338f7b7095fe35000ef88d5400d28523bdd93";
const SUBDOMAINS_PACKAGE_ID = "0x3c272bc45f9157b7818ece4f7411bdfa8af46303b071aca4e18c03119c9ff636";
const SUINS_OBJECT_ID = "0x300369e8909b9a6464da265b9a5a9ab6fe2158a040e84e808628cde7a07ee5a3";

// Get keypair from Sui CLI
function getKeypairFromCli(): Ed25519Keypair {
  const output = execSync("sui keytool export --key-identity 0x010030a0afc40b6d8fe99cee368cab5652baa0d36b7be60a9b017d5228c0bdfd --json", {
    encoding: "utf8",
  });
  const parsed = JSON.parse(output);
  const { secretKey } = decodeSuiPrivateKey(parsed.exportedPrivateKey);
  return Ed25519Keypair.fromSecretKey(secretKey);
}

// Alternative: Get active address
function getActiveAddress(): string {
  return execSync("sui client active-address", { encoding: "utf8" }).trim();
}

async function createLeafSubdomain(
  client: SuiClient,
  signer: Ed25519Keypair,
  subdomain: string,
  targetAddress: string
) {
  console.log(`\n📝 Creating leaf subdomain: ${subdomain}.${PARENT_DOMAIN}`);
  console.log(`   Target address: ${targetAddress}`);

  const tx = new Transaction();

  // Call suins_subdomains::subdomains::new_leaf
  // public fun new_leaf(
  //   suins: &mut SuiNS,
  //   parent: &SuinsRegistration,
  //   clock: &Clock,
  //   subdomain_name: String,
  //   target: address,
  //   ctx: &mut TxContext
  // )
  tx.moveCall({
    target: `${SUBDOMAINS_PACKAGE_ID}::subdomains::new_leaf`,
    arguments: [
      tx.object(SUINS_OBJECT_ID), // suins: &mut SuiNS
      tx.object(PARENT_NFT_ID),   // parent: &SuinsRegistration
      tx.object("0x6"),           // clock: &Clock
      tx.pure.string(`${subdomain}.${PARENT_DOMAIN}`), // subdomain_name
      tx.pure.address(targetAddress), // target address
    ],
  });

  console.log("   Executing transaction...");

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: {
      showEffects: true,
      showObjectChanges: true,
    },
  });

  await client.waitForTransaction({ digest: result.digest });

  console.log(`   ✅ Transaction digest: ${result.digest}`);
  console.log(`   Status: ${result.effects?.status?.status}`);

  if (result.effects?.status?.status === "failure") {
    console.error(`   ❌ Error: ${result.effects?.status?.error}`);
  }

  return result;
}

async function createNodeSubdomain(
  client: SuiClient,
  signer: Ed25519Keypair,
  subdomain: string,
  expirationMs: number,
  recipientAddress: string
) {
  console.log(`\n📝 Creating node subdomain: ${subdomain}.${PARENT_DOMAIN}`);
  console.log(`   Recipient: ${recipientAddress}`);
  console.log(`   Expiration: ${new Date(expirationMs).toISOString()}`);

  const tx = new Transaction();

  // Call suins_subdomains::subdomains::new
  // public fun new(
  //   suins: &mut SuiNS,
  //   parent: &SuinsRegistration,
  //   clock: &Clock,
  //   subdomain_name: String,
  //   expiration_timestamp_ms: u64,
  //   allow_creation: bool,
  //   allow_time_extension: bool,
  //   ctx: &mut TxContext
  // ): SubDomainRegistration
  const subdomainNft = tx.moveCall({
    target: `${SUBDOMAINS_PACKAGE_ID}::subdomains::new`,
    arguments: [
      tx.object(SUINS_OBJECT_ID), // suins: &mut SuiNS
      tx.object(PARENT_NFT_ID),   // parent: &SuinsRegistration
      tx.object("0x6"),           // clock: &Clock
      tx.pure.string(`${subdomain}.${PARENT_DOMAIN}`), // subdomain_name
      tx.pure.u64(expirationMs),  // expiration_timestamp_ms
      tx.pure.bool(true),         // allow_creation
      tx.pure.bool(true),         // allow_time_extension
    ],
  });

  // Transfer the subdomain NFT to recipient
  tx.transferObjects([subdomainNft], tx.pure.address(recipientAddress));

  console.log("   Executing transaction...");

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: {
      showEffects: true,
      showObjectChanges: true,
    },
  });

  await client.waitForTransaction({ digest: result.digest });

  console.log(`   ✅ Transaction digest: ${result.digest}`);
  console.log(`   Status: ${result.effects?.status?.status}`);

  if (result.effects?.status?.status === "failure") {
    console.error(`   ❌ Error: ${result.effects?.status?.error}`);
  }

  // Find the created subdomain NFT
  const createdObjects = result.objectChanges?.filter(
    (change) => change.type === "created"
  );
  console.log("   Created objects:", createdObjects?.map((o: any) => o.objectId));

  return result;
}

async function resolveSubdomain(client: SuiClient, name: string) {
  console.log(`\n🔍 Resolving: ${name}`);

  // Query SuiNS registry for the name record
  const result = await client.getDynamicFieldObject({
    parentId: SUINS_OBJECT_ID,
    name: {
      type: `${SUINS_PACKAGE_ID}::domain::Domain`,
      value: {
        labels: name.replace(".sui", "").split(".").reverse(),
      },
    },
  });

  if (result.data) {
    console.log("   ✅ Found:", JSON.stringify(result.data.content, null, 2));
  } else {
    console.log("   ❌ Not found");
  }

  return result;
}

async function main() {
  console.log("🚀 SuiNS Subdomain Test Script");
  console.log("================================");
  console.log(`Network: ${NETWORK}`);
  console.log(`Parent Domain: ${PARENT_DOMAIN}`);
  console.log(`Parent NFT ID: ${PARENT_NFT_ID}`);

  // Initialize client
  const client = new SuiClient({ url: getFullnodeUrl(NETWORK) });

  // Get keypair
  let signer: Ed25519Keypair;
  try {
    signer = getKeypairFromCli();
    console.log(`\n🔑 Signer address: ${signer.getPublicKey().toSuiAddress()}`);
  } catch (error) {
    console.error("❌ Failed to get keypair from CLI. Make sure sui keytool is configured.");
    console.error("   You may need to run: sui keytool export --key-identity <address>");
    process.exit(1);
  }

  const myAddress = signer.getPublicKey().toSuiAddress();

  // Test subdomain name - use timestamp to ensure unique name
  const timestamp = Date.now();
  const testSubdomain = `test-team-${timestamp}`;

  try {
    // Option 1: Create as leaf subdomain (no NFT, just points to address)
    console.log("\n--- Test 1: Create Leaf Subdomain ---");
    await createLeafSubdomain(client, signer, testSubdomain, myAddress);

    // Wait a bit then verify
    console.log("\n⏳ Waiting 2 seconds for indexing...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Resolve the subdomain
    await resolveSubdomain(client, `${testSubdomain}.${PARENT_DOMAIN}`);

    console.log("\n✅ Test completed successfully!");
    console.log(`   Subdomain created: ${testSubdomain}.${PARENT_DOMAIN}`);

  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    if (error.cause) {
      console.error("   Cause:", JSON.stringify(error.cause, null, 2));
    }
    process.exit(1);
  }
}

main();
