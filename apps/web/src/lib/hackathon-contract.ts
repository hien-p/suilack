/**
 * Hackathon-specific contract interactions
 * Package ID: 0xfae5c4c31b09ba88594758d8d2f0eaf768315a7ca806b66ea2d4c8fdccdf2902
 */

import { Transaction } from "@mysten/sui/transactions";

// Our deployed hackathon package ID
export const HACKATHON_PACKAGE_ID =
  "0xfae5c4c31b09ba88594758d8d2f0eaf768315a7ca806b66ea2d4c8fdccdf2902";

/**
 * Build a transaction to register a deployed package for judge verification
 */
export function buildRegisterPackageTransaction(
  tx: Transaction,
  channelId: string,
  memberCapId: string,
  packageId: string,
  description: string
): Transaction {
  tx.moveCall({
    target: `${HACKATHON_PACKAGE_ID}::channel::register_package`,
    arguments: [
      tx.object(channelId), // channel: &mut Channel
      tx.object(memberCapId), // member_cap: &MemberCap
      tx.pure.address(packageId), // package_id: address
      tx.pure.string(description), // description: String
      tx.object("0x6"), // clock: &Clock
    ],
  });
  return tx;
}

/**
 * Build a transaction to register a Walrus blob for judge verification
 */
export function buildRegisterBlobTransaction(
  tx: Transaction,
  channelId: string,
  memberCapId: string,
  blobId: string,
  fileName: string,
  fileSize: number
): Transaction {
  tx.moveCall({
    target: `${HACKATHON_PACKAGE_ID}::channel::register_blob`,
    arguments: [
      tx.object(channelId), // channel: &mut Channel
      tx.object(memberCapId), // member_cap: &MemberCap
      tx.pure.string(blobId), // blob_id: String
      tx.pure.string(fileName), // file_name: String
      tx.pure.u64(fileSize), // file_size: u64
      tx.object("0x6"), // clock: &Clock
    ],
  });
  return tx;
}

/**
 * Build a transaction to set the SuiNS subdomain name for a channel
 */
export function buildSetSubdomainNameTransaction(
  tx: Transaction,
  channelId: string,
  creatorCapId: string,
  subdomainName: string
): Transaction {
  tx.moveCall({
    target: `${HACKATHON_PACKAGE_ID}::channel::set_subdomain_name`,
    arguments: [
      tx.object(channelId), // channel: &mut Channel
      tx.object(creatorCapId), // creator_cap: &CreatorCap
      tx.pure.string(subdomainName), // name: String
      tx.object("0x6"), // clock: &Clock
    ],
  });
  return tx;
}

/**
 * Types for registered packages and blobs
 */
export interface RegisteredPackage {
  packageId: string;
  registeredBy: string;
  registeredAtMs: number;
  description: string;
}

export interface RegisteredBlob {
  blobId: string;
  fileName: string;
  fileSize: number;
  registeredBy: string;
  registeredAtMs: number;
}

/**
 * Parse registered packages from channel object
 */
export function parseRegisteredPackages(
  channelData: any
): RegisteredPackage[] {
  if (!channelData?.registered_packages) return [];

  return channelData.registered_packages.map((pkg: any) => ({
    packageId: pkg.package_id,
    registeredBy: pkg.registered_by,
    registeredAtMs: Number(pkg.registered_at_ms),
    description: pkg.description,
  }));
}

/**
 * Parse registered blobs from channel object
 */
export function parseRegisteredBlobs(channelData: any): RegisteredBlob[] {
  if (!channelData?.registered_blobs) return [];

  return channelData.registered_blobs.map((blob: any) => ({
    blobId: blob.blob_id,
    fileName: blob.file_name,
    fileSize: Number(blob.file_size),
    registeredBy: blob.registered_by,
    registeredAtMs: Number(blob.registered_at_ms),
  }));
}
