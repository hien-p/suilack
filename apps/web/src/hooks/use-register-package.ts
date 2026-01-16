"use client";

import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { buildRegisterPackageTransaction } from "@/lib/hackathon-contract";

interface RegisterPackageOptions {
  channelId: string;
  memberCapId: string;
  packageId: string;
  description: string;
}

export function useRegisterPackage() {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registerPackage = async (options: RegisterPackageOptions) => {
    if (!account) {
      setError("Wallet not connected");
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tx = new Transaction();
      buildRegisterPackageTransaction(
        tx,
        options.channelId,
        options.memberCapId,
        options.packageId,
        options.description
      );

      const result = await signAndExecute({
        transaction: tx,
      });

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to register package";
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    registerPackage,
    isLoading,
    error,
  };
}
