/**
 * SuiNS Configuration for Testnet
 */

export const SUINS_CONFIG = {
  // Network
  network: "testnet" as const,

  // Parent domain owned by the user
  parentDomain: "fmsprint.sui",
  parentNftId: "0x3fa88ffd62758f0f8721d6d471fbacc5ccde437639f70191953bf8c81ef39e8b",

  // SuiNS Testnet Package IDs
  suinsPackageId: "0x22fa05f21b1ad71442491220bb9338f7b7095fe35000ef88d5400d28523bdd93",
  subdomainsPackageId: "0x3c272bc45f9157b7818ece4f7411bdfa8af46303b071aca4e18c03119c9ff636",
  suinsObjectId: "0x300369e8909b9a6464da265b9a5a9ab6fe2158a040e84e808628cde7a07ee5a3",

  // Team configuration
  maxTeamNumber: 1000,
  maxTeamMembers: 5,
};

export type SubdomainType = "leaf" | "node";
