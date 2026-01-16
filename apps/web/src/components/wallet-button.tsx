"use client";

import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { Button } from "@/components/ui/button";

export function WalletButton() {
  const account = useCurrentAccount();

  if (account) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {account.address.slice(0, 6)}...{account.address.slice(-4)}
        </span>
        <ConnectButton />
      </div>
    );
  }

  return <ConnectButton />;
}
