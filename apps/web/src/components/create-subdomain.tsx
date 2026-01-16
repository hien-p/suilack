"use client";

import { useState, useEffect } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SUINS_CONFIG } from "@/config/suins";
import { Loader2, CheckCircle, XCircle, ExternalLink, ShieldCheck, ShieldX } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

interface TxResult {
  subdomain: string;
  txDigest: string;
  status: Status;
  error?: string;
}

export function CreateSubdomain() {
  const account = useCurrentAccount();
  const [teamNumber, setTeamNumber] = useState("");
  const [txResult, setTxResult] = useState<TxResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApprovedLeader, setIsApprovedLeader] = useState<boolean | null>(null);
  const [checkingApproval, setCheckingApproval] = useState(false);

  const subdomain = teamNumber ? `team-${teamNumber}` : "";
  const fullName = subdomain ? `${subdomain}.${SUINS_CONFIG.parentDomain}` : "";

  // Check if connected wallet is an approved leader
  useEffect(() => {
    async function checkLeaderStatus() {
      if (!account?.address) {
        setIsApprovedLeader(null);
        return;
      }

      setCheckingApproval(true);
      try {
        const res = await fetch(`/api/channel/create?address=${account.address}`);
        const data = await res.json();
        setIsApprovedLeader(data.isApproved);
      } catch {
        setIsApprovedLeader(false);
      } finally {
        setCheckingApproval(false);
      }
    }

    checkLeaderStatus();
  }, [account?.address]);

  const handleCreate = async () => {
    if (!account || !isApprovedLeader) return;

    const num = parseInt(teamNumber, 10);
    if (isNaN(num) || num < 0 || num > 1000) {
      setTxResult({
        subdomain: "",
        txDigest: "",
        status: "error",
        error: "Team number must be between 0 and 1000",
      });
      return;
    }

    setIsLoading(true);
    setTxResult(null);

    try {
      const res = await fetch("/api/channel/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamNumber: num,
          leaderAddress: account.address,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create channel");
      }

      setTxResult({
        subdomain: data.subdomain,
        txDigest: data.txDigest,
        status: "success",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setTxResult({
        subdomain: "",
        txDigest: "",
        status: "error",
        error: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Create Team Channel</CardTitle>
        <CardDescription>
          Create a SuiNS subdomain for your hackathon team channel.
          <br />
          Parent domain: <span className="font-mono text-primary">{SUINS_CONFIG.parentDomain}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!account ? (
          <div className="text-center py-4 text-muted-foreground">
            Connect your wallet to create a subdomain
          </div>
        ) : (
          <>
            {/* Leader Status Badge */}
            <div className="flex items-center gap-2 p-3 rounded-md bg-secondary/50" role="status" aria-live="polite">
              {checkingApproval ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span className="text-sm">Checking leader status...</span>
                </>
              ) : isApprovedLeader ? (
                <>
                  <ShieldCheck className="w-5 h-5 text-green-500" aria-hidden="true" />
                  <span className="text-sm text-green-400">Approved Leader</span>
                </>
              ) : (
                <>
                  <ShieldX className="w-5 h-5 text-yellow-500" aria-hidden="true" />
                  <span className="text-sm text-yellow-400">Not an approved leader</span>
                </>
              )}
            </div>

            {!isApprovedLeader && !checkingApproval && (
              <p className="text-sm text-muted-foreground">
                Contact the hackathon admin to get approved as a team leader.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="teamNumber">Team Number (0-1000)</Label>
              <div className="flex gap-2 items-center">
                <span className="text-muted-foreground">team-</span>
                <Input
                  id="teamNumber"
                  type="number"
                  min="0"
                  max="1000"
                  placeholder="42"
                  value={teamNumber}
                  onChange={(e) => setTeamNumber(e.target.value)}
                  className="flex-1"
                  disabled={!isApprovedLeader}
                />
              </div>
              {fullName && (
                <p className="text-sm">
                  Subdomain:{" "}
                  <span className="font-mono text-primary">{fullName}</span>
                </p>
              )}
            </div>

            <Button
              onClick={handleCreate}
              disabled={isLoading || !isApprovedLeader || !teamNumber}
              className="w-full"
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Creating Channel...
                </>
              ) : (
                "Create Team Channel"
              )}
            </Button>

            {txResult && (
              <div
                role="alert"
                aria-live="assertive"
                className={`p-4 rounded-md ${
                  txResult.status === "success"
                    ? "bg-green-950 border border-green-800"
                    : "bg-red-950 border border-red-800"
                }`}
              >
                {txResult.status === "success" ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-5 h-5" aria-hidden="true" />
                      <span className="font-medium">Channel Created!</span>
                    </div>
                    <p className="text-sm text-green-300">
                      <span className="font-mono">{txResult.subdomain}</span> is now your team channel
                    </p>
                    <div className="flex flex-col gap-2 pt-2">
                      <a
                        href={`/channel/${teamNumber}`}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors"
                      >
                        Open Channel <ExternalLink className="w-3 h-3" />
                      </a>
                      <a
                        href={`https://suiscan.xyz/testnet/tx/${txResult.txDigest}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1 text-sm text-blue-400 hover:underline"
                      >
                        View Transaction on Explorer <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-red-400">
                      <XCircle className="w-5 h-5" aria-hidden="true" />
                      <span className="font-medium">Failed to Create Channel</span>
                    </div>
                    <p className="text-sm text-red-300">
                      {txResult.error?.includes("remove_existing_record_if_exists_and_expired") ||
                       txResult.error?.includes("already exists")
                        ? `Channel team-${teamNumber}.${SUINS_CONFIG.parentDomain} already exists. Please choose a different team number.`
                        : txResult.error}
                    </p>
                    {txResult.error?.includes("remove_existing_record_if_exists_and_expired") && (
                      <p className="text-xs text-yellow-400 mt-2">
                        Tip: This subdomain was previously created. Try a different team number.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
