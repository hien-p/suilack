// Messaging SDK Configuration for Suilack
import { TESTNET_MESSAGING_PACKAGE_CONFIG } from "@mysten/messaging";

export const MESSAGING_CONFIG = {
  network: "testnet" as const,
  packageConfig: TESTNET_MESSAGING_PACKAGE_CONFIG,
};

// Walrus Storage Configuration for Testnet
export const WALRUS_CONFIG = {
  publisher: "https://publisher.walrus-testnet.walrus.space",
  aggregator: "https://aggregator.walrus-testnet.walrus.space",
  epochs: 1, // Store for 1 epoch (short-term for hackathon demo)
};

// SEAL Key Server Configuration for Testnet
// Using verified Mysten Labs key servers for reliability
// KeyServerConfig requires objectId and weight (URL is derived from the object on-chain)
export const SEAL_KEY_SERVERS = [
  {
    objectId:
      "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75", // Mysten Labs - mysten-testnet-1
    weight: 1,
  },
  {
    objectId:
      "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8", // Mysten Labs - mysten-testnet-2
    weight: 1,
  },
];
