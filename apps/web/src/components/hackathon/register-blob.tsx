"use client";

import { useState } from "react";
import { useRegisterBlob } from "@/hooks/use-register-blob";
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
import { Loader2, FileText, CheckCircle, XCircle, ExternalLink } from "lucide-react";

interface RegisterBlobProps {
  channelId: string;
  memberCapId: string;
}

export function RegisterBlob({ channelId, memberCapId }: RegisterBlobProps) {
  const [blobId, setBlobId] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    digest?: string;
  } | null>(null);

  const { registerBlob, isLoading, error } = useRegisterBlob();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    if (!blobId) {
      setResult({
        success: false,
        message: "Blob ID is required",
      });
      return;
    }

    const size = parseInt(fileSize, 10);
    if (isNaN(size) || size < 0) {
      setResult({
        success: false,
        message: "Invalid file size",
      });
      return;
    }

    const txResult = await registerBlob({
      channelId,
      memberCapId,
      blobId,
      fileName: fileName || "unnamed",
      fileSize: size,
    });

    if (txResult) {
      setResult({
        success: true,
        message: "Blob registered successfully!",
        digest: txResult.digest,
      });
      setBlobId("");
      setFileName("");
      setFileSize("");
    } else {
      setResult({
        success: false,
        message: error || "Failed to register blob",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Register Walrus Blob
        </CardTitle>
        <CardDescription>
          Register a file you uploaded to Walrus for judge verification
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="blobId">Walrus Blob ID</Label>
            <Input
              id="blobId"
              placeholder="Enter the Walrus blob ID"
              value={blobId}
              onChange={(e) => setBlobId(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fileName">File Name</Label>
            <Input
              id="fileName"
              placeholder="myfile.rs"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fileSize">File Size (bytes)</Label>
            <Input
              id="fileSize"
              type="number"
              min="0"
              placeholder="1024"
              value={fileSize}
              onChange={(e) => setFileSize(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button type="submit" disabled={isLoading || !blobId || !fileSize} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Registering...
              </>
            ) : (
              "Register Blob"
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
