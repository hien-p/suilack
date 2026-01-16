/**
 * SuiNS Subdomain Creation Utilities
 */

import { Transaction } from "@mysten/sui/transactions";
import { SUINS_CONFIG } from "@/config/suins";

export interface CreateLeafSubdomainParams {
  subdomain: string;
  targetAddress: string;
}

export interface CreateNodeSubdomainParams {
  subdomain: string;
  expirationMs: number;
  recipientAddress: string;
}

/**
 * Build transaction to create a leaf subdomain (no NFT, just points to address)
 */
export function buildCreateLeafSubdomainTx(
  params: CreateLeafSubdomainParams
): Transaction {
  const { subdomain, targetAddress } = params;
  const tx = new Transaction();

  const fullSubdomainName = `${subdomain}.${SUINS_CONFIG.parentDomain}`;

  tx.moveCall({
    target: `${SUINS_CONFIG.subdomainsPackageId}::subdomains::new_leaf`,
    arguments: [
      tx.object(SUINS_CONFIG.suinsObjectId),
      tx.object(SUINS_CONFIG.parentNftId),
      tx.object("0x6"), // Clock
      tx.pure.string(fullSubdomainName),
      tx.pure.address(targetAddress),
    ],
  });

  return tx;
}

/**
 * Build transaction to create a node subdomain (with NFT)
 */
export function buildCreateNodeSubdomainTx(
  params: CreateNodeSubdomainParams
): Transaction {
  const { subdomain, expirationMs, recipientAddress } = params;
  const tx = new Transaction();

  const fullSubdomainName = `${subdomain}.${SUINS_CONFIG.parentDomain}`;

  const subdomainNft = tx.moveCall({
    target: `${SUINS_CONFIG.subdomainsPackageId}::subdomains::new`,
    arguments: [
      tx.object(SUINS_CONFIG.suinsObjectId),
      tx.object(SUINS_CONFIG.parentNftId),
      tx.object("0x6"), // Clock
      tx.pure.string(fullSubdomainName),
      tx.pure.u64(expirationMs),
      tx.pure.bool(true), // allow_creation
      tx.pure.bool(true), // allow_time_extension
    ],
  });

  tx.transferObjects([subdomainNft], tx.pure.address(recipientAddress));

  return tx;
}

/**
 * Validate subdomain name for team channels
 * Format: team-{number} where number is 0-1000
 */
export function validateTeamSubdomain(subdomain: string): {
  valid: boolean;
  error?: string;
  teamNumber?: number;
} {
  const match = subdomain.match(/^team-(\d+)$/);

  if (!match) {
    return {
      valid: false,
      error: "Subdomain must be in format: team-{number} (e.g., team-42)",
    };
  }

  const teamNumber = parseInt(match[1], 10);

  if (teamNumber < 0 || teamNumber > SUINS_CONFIG.maxTeamNumber) {
    return {
      valid: false,
      error: `Team number must be between 0 and ${SUINS_CONFIG.maxTeamNumber}`,
    };
  }

  return { valid: true, teamNumber };
}

/**
 * Generate full subdomain name
 */
export function getFullSubdomainName(subdomain: string): string {
  return `${subdomain}.${SUINS_CONFIG.parentDomain}`;
}
