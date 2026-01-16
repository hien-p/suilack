"use client";

import { useState, useRef } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, FileText, Image as ImageIcon, File, X } from "lucide-react";
import { WALRUS_CONFIG } from "@/config/messaging";

interface FileUploadProps {
  teamNumber: string;
  onUploadComplete?: (blobId: string, fileName: string, fileSize: number) => void;
}

interface UploadedFile {
  blobId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

export function FileUpload({ teamNumber, onUploadComplete }: FileUploadProps) {
  const account = useCurrentAccount();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB for hackathon demo)
      if (file.size > 10 * 1024 * 1024) {
        setError("File too large. Max 10MB.");
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) {
      return <ImageIcon className="w-4 h-4" />;
    }
    if (mimeType.includes("text") || mimeType.includes("json")) {
      return <FileText className="w-4 h-4" />;
    }
    return <File className="w-4 h-4" />;
  };

  const handleUpload = async () => {
    if (!selectedFile || !account?.address) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await selectedFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // Upload to Walrus
      const response = await fetch(
        `${WALRUS_CONFIG.publisher}/v1/store?epochs=${WALRUS_CONFIG.epochs}`,
        {
          method: "PUT",
          body: bytes,
          headers: {
            "Content-Type": "application/octet-stream",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to upload to Walrus");
      }

      const result = await response.json();
      const blobId =
        result.newlyCreated?.blobObject?.blobId ||
        result.alreadyCertified?.blobId;

      if (!blobId) {
        throw new Error("No blob ID returned");
      }

      // Register blob with channel
      const registerRes = await fetch(`/api/channels/team-${teamNumber}/blobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blobId,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type,
          uploaderAddress: account.address,
        }),
      });

      if (!registerRes.ok) {
        console.warn("Failed to register blob with channel, but upload succeeded");
      }

      // Notify parent
      onUploadComplete?.(blobId, selectedFile.name, selectedFile.size);

      // Reset
      setSelectedFile(null);
      setIsOpen(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (!account) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="w-4 h-4" />
          Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload File to Walrus</DialogTitle>
          <DialogDescription>
            Share files with your team via decentralized storage
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Input */}
          <div className="space-y-2">
            <Label>Select File</Label>
            <Input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">Max 10MB</p>
          </div>

          {/* Selected File Preview */}
          {selectedFile && (
            <div className="p-3 bg-secondary rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getFileIcon(selectedFile.type)}
                <div>
                  <p className="text-sm font-medium truncate max-w-[200px]">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Error */}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Info */}
          <div className="p-3 bg-blue-950/30 border border-blue-800 rounded-lg">
            <p className="text-xs text-blue-400">
              Files are stored on Walrus decentralized storage for{" "}
              {WALRUS_CONFIG.epochs} epoch(s). Blob IDs will be recorded
              on-chain for verification.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Upload
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
