"use client";

import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { buildRegisterBlobTransaction } from "@/lib/hackathon-contract";

interface RegisterBlobOptions {
  channelId: string;
  memberCapId: string;
  blobId: string;
  fileName: string;
  fileSize: number;
}

export function useRegisterBlob() {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registerBlob = async (options: RegisterBlobOptions) => {
    if (!account) {
      setError("Wallet not connected");
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tx = new Transaction();
      buildRegisterBlobTransaction(
        tx,
        options.channelId,
        options.memberCapId,
        options.blobId,
        options.fileName,
        options.fileSize
      );

      const result = await signAndExecute({
        transaction: tx,
      });

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to register blob";
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    registerBlob,
    isLoading,
    error,
  };
}
