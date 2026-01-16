"use client";

import { useState } from "react";
import { useRegisterPackage } from "@/hooks/use-register-package";
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
import { Loader2, Package, CheckCircle, XCircle, ExternalLink } from "lucide-react";

interface RegisterPackageProps {
  channelId: string;
  memberCapId: string;
}

export function RegisterPackage({ channelId, memberCapId }: RegisterPackageProps) {
  const [packageId, setPackageId] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    digest?: string;
  } | null>(null);

  const { registerPackage, isLoading, error } = useRegisterPackage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    if (!packageId.startsWith("0x") || packageId.length !== 66) {
      setResult({
        success: false,
        message: "Invalid package ID. Must be 0x followed by 64 hex characters.",
      });
      return;
    }

    const txResult = await registerPackage({
      channelId,
      memberCapId,
      packageId,
      description: description || "No description",
    });

    if (txResult) {
      setResult({
        success: true,
        message: "Package registered successfully!",
        digest: txResult.digest,
      });
      setPackageId("");
      setDescription("");
    } else {
      setResult({
        success: false,
        message: error || "Failed to register package",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          Register Deployed Package
        </CardTitle>
        <CardDescription>
          Register a package you deployed for judge verification
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="packageId">Package ID</Label>
            <Input
              id="packageId"
              placeholder="0x..."
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="What does this package do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button type="submit" disabled={isLoading || !packageId} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Registering...
              </>
            ) : (
              "Register Package"
            )}
          </Button>
        </form>

        {result && (
          <div
            role="alert"
            className={`mt-4 p-3 rounded-md ${
              result.success
                ? "bg-green-950 border border-green-800"
                : "bg-red-950 border border-red-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="w-4 h-4 text-green-400" aria-hidden="true" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" aria-hidden="true" />
              )}
              <span className={result.success ? "text-green-300" : "text-red-300"}>
                {result.message}
              </span>
            </div>
            {result.digest && (
              <a
                href={`https://suiscan.xyz/testnet/tx/${result.digest}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline mt-2"
              >
                View Transaction <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
