"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { useCurrentAccount, useSignPersonalMessage } from "@mysten/dapp-kit";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { SealClient } from "@mysten/seal";
import {
  messaging,
  TESTNET_MESSAGING_PACKAGE_CONFIG,
  WalrusStorageAdapter,
} from "@mysten/messaging";
import { WALRUS_CONFIG, SEAL_KEY_SERVERS } from "@/config/messaging";

// Wallet signer wrapper that implements the signer interface for SEAL SessionKey
class WalletSigner {
  private signFn: ((message: Uint8Array) => Promise<{ signature: string }>) | null = null;
  private address: string;

  constructor(address: string) {
    this.address = address;
  }

  setSignFunction(fn: (message: Uint8Array) => Promise<{ signature: string }>) {
    this.signFn = fn;
  }

  async signPersonalMessage(message: Uint8Array): Promise<{ signature: string }> {
    if (!this.signFn) {
      throw new Error("Sign function not set");
    }
    return this.signFn(message);
  }

  getPublicKey() {
    // Return a mock public key object that matches the address
    // This is used for address validation in SessionKey
    return {
      toSuiAddress: () => this.address,
    };
  }
}

// Type for the extended client with messaging
type ExtendedMessagingClient = ReturnType<
  ReturnType<typeof SuiClient.prototype.$extend>["$extend"]
>;

interface MessagingContextValue {
  messagingClient: ExtendedMessagingClient | null;
  isInitialized: boolean;
  error: string | null;
}

const MessagingContext = createContext<MessagingContextValue | null>(null);

export function MessagingProvider({ children }: { children: ReactNode }) {
  const account = useCurrentAccount();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [messagingClient, setMessagingClient] =
    useState<ExtendedMessagingClient | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store the signer ref so it persists across renders
  const signerRef = useRef<WalletSigner | null>(null);

  // Create a stable sign function that uses the wallet
  const signFn = useCallback(async (message: Uint8Array) => {
    const result = await signPersonalMessage({ message });
    return { signature: result.signature };
  }, [signPersonalMessage]);

  // Initialize Messaging client with proper $extend pattern
  useEffect(() => {
    if (!account?.address) {
      setMessagingClient(null);
      setIsInitialized(false);
      signerRef.current = null;
      return;
    }

    const initializeClients = async () => {
      try {
        console.log("[MessagingProvider] Initializing for address:", account.address);

        // Create wallet signer
        const walletSigner = new WalletSigner(account.address);
        walletSigner.setSignFunction(signFn);
        signerRef.current = walletSigner;
        console.log("[MessagingProvider] Wallet signer created");

        // Create SuiClient with MVR configuration for the messaging package
        const suiClient = new SuiClient({
          url: getFullnodeUrl("testnet"),
          mvr: {
            overrides: {
              packages: {
                "@local-pkg/sui-stack-messaging": TESTNET_MESSAGING_PACKAGE_CONFIG.packageId,
              },
            },
          },
        });
        console.log("[MessagingProvider] SuiClient created with MVR config");

        // Extend with SEAL client
        const withSeal = suiClient.$extend(
          SealClient.asClientExtension({
            serverConfigs: SEAL_KEY_SERVERS,
          })
        );
        console.log("[MessagingProvider] SEAL extension added");

        // Extend with messaging client with signer for SEAL session key authentication
        const extendedClient = withSeal.$extend(
          messaging({
            packageConfig: TESTNET_MESSAGING_PACKAGE_CONFIG,
            walrusStorageConfig: {
              publisher: WALRUS_CONFIG.publisher,
              aggregator: WALRUS_CONFIG.aggregator,
              epochs: WALRUS_CONFIG.epochs,
            },
            sessionKeyConfig: {
              address: account.address,
              ttlMin: 30,
              signer: walletSigner, // Provide signer for SEAL session key authentication
            },
            // Set threshold to 1 for compatibility (existing channel was created with 1 server)
            sealConfig: {
              threshold: 1,
            },
          })
        );
        console.log("[MessagingProvider] Messaging extension added");

        setMessagingClient(extendedClient as ExtendedMessagingClient);
        setIsInitialized(true);
        setError(null);
        console.log("[MessagingProvider] Initialization complete");
      } catch (err) {
        console.error("[MessagingProvider] Failed to initialize:", err);
        setError(
          err instanceof Error ? err.message : "Failed to initialize messaging"
        );
        setIsInitialized(false);
      }
    };

    initializeClients();
  }, [account?.address, signFn]);

  const value: MessagingContextValue = {
    messagingClient,
    isInitialized,
    error,
  };

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging() {
  const context = useContext(MessagingContext);
  if (!context) {
    throw new Error("useMessaging must be used within MessagingProvider");
  }
  return context;
}
