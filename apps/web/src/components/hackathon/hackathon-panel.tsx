"use client";

import { useState } from "react";
import { RegisterPackage } from "./register-package";
import { RegisterBlob } from "./register-blob";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Package, FileText, Trophy } from "lucide-react";

interface HackathonPanelProps {
  channelId: string;
  memberCapId: string;
}

export function HackathonPanel({ channelId, memberCapId }: HackathonPanelProps) {
  const [activeTab, setActiveTab] = useState<"package" | "blob">("package");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Trophy className="w-4 h-4" />
          Judge Verification
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Register for Judge Verification
          </DialogTitle>
          <DialogDescription>
            Register your deployed packages and Walrus uploads so judges can verify your work.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Buttons */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={activeTab === "package" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("package")}
            className="flex-1 gap-2"
          >
            <Package className="w-4 h-4" />
            Package
          </Button>
          <Button
            variant={activeTab === "blob" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("blob")}
            className="flex-1 gap-2"
          >
            <FileText className="w-4 h-4" />
            Walrus Blob
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === "package" ? (
          <RegisterPackage channelId={channelId} memberCapId={memberCapId} />
        ) : (
          <RegisterBlob channelId={channelId} memberCapId={memberCapId} />
        )}
      </DialogContent>
    </Dialog>
  );
}
