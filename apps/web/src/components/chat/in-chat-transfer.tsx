"use client";

import { useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Send, Coins, Image as ImageIcon, Package } from "lucide-react";

interface InChatTransferProps {
  members: string[];
  onTransferComplete?: (digest: string, recipientAddress: string) => void;
}

type TransferType = "sui" | "token" | "nft";

export function InChatTransfer({ members, onTransferComplete }: InChatTransferProps) {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [isOpen, setIsOpen] = useState(false);
  const [transferType, setTransferType] = useState<TransferType>("sui");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [objectId, setObjectId] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter out current user from recipients
  const availableRecipients = members.filter(
    (m) => m.toLowerCase() !== account?.address?.toLowerCase()
  );

  const handleTransfer = async () => {
    if (!account?.address || !recipientAddress) {
      setError("Missing recipient address");
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      const tx = new Transaction();

      if (transferType === "sui") {
        // Transfer SUI
        const amountMist = BigInt(parseFloat(amount) * 1_000_000_000); // Convert SUI to MIST
        const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);
        tx.transferObjects([coin], tx.pure.address(recipientAddress));
      } else if (transferType === "token") {
        // Transfer fungible token (requires objectId of the coin)
        if (!objectId) {
          setError("Object ID required for token transfer");
          setIsPending(false);
          return;
        }
        const amountU64 = BigInt(parseFloat(amount));
        const [splitCoin] = tx.splitCoins(tx.object(objectId), [
          tx.pure.u64(amountU64),
        ]);
        tx.transferObjects([splitCoin], tx.pure.address(recipientAddress));
      } else if (transferType === "nft") {
        // Transfer NFT (single object)
        if (!objectId) {
          setError("Object ID required for NFT transfer");
          setIsPending(false);
          return;
        }
        tx.transferObjects([tx.object(objectId)], tx.pure.address(recipientAddress));
      }

      const result = await signAndExecute({
        transaction: tx,
      });

      await suiClient.waitForTransaction({
        digest: result.digest,
      });

      // Reset form
      setAmount("");
      setObjectId("");
      setRecipientAddress("");
      setIsOpen(false);

      // Notify parent
      onTransferComplete?.(result.digest, recipientAddress);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setIsPending(false);
    }
  };

  if (!account || availableRecipients.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Coins className="w-4 h-4" />
          Transfer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send to Team Member</DialogTitle>
          <DialogDescription>
            Transfer SUI, tokens, or NFTs to a team member
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Transfer Type */}
          <div className="space-y-2">
            <Label>Transfer Type</Label>
            <Select
              value={transferType}
              onValueChange={(v) => setTransferType(v as TransferType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sui">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4" />
                    SUI
                  </div>
                </SelectItem>
                <SelectItem value="token">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Token (Coin Object)
                  </div>
                </SelectItem>
                <SelectItem value="nft">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    NFT / Object
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Recipient */}
          <div className="space-y-2">
            <Label>Recipient</Label>
            <Select value={recipientAddress} onValueChange={setRecipientAddress}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {availableRecipients.map((member) => (
                  <SelectItem key={member} value={member}>
                    <code className="text-xs">
                      {member.slice(0, 8)}...{member.slice(-6)}
                    </code>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount (for SUI and Token) */}
          {(transferType === "sui" || transferType === "token") && (
            <div className="space-y-2">
              <Label>Amount {transferType === "sui" ? "(SUI)" : ""}</Label>
              <Input
                type="number"
                step="0.000000001"
                min="0"
                placeholder={transferType === "sui" ? "0.1" : "1000000000"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          )}

          {/* Object ID (for Token and NFT) */}
          {(transferType === "token" || transferType === "nft") && (
            <div className="space-y-2">
              <Label>Object ID</Label>
              <Input
                placeholder="0x..."
                value={objectId}
                onChange={(e) => setObjectId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {transferType === "token"
                  ? "The Coin object ID to split and transfer"
                  : "The NFT or object ID to transfer"}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={
              isPending ||
              !recipientAddress ||
              (transferType !== "nft" && !amount) ||
              (transferType !== "sui" && !objectId)
            }
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
