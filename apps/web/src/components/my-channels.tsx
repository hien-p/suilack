"use client";

import { useState, useEffect } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, RefreshCw, Hash, Users, ExternalLink, MessageSquare } from "lucide-react";
import Link from "next/link";

interface Channel {
  name: string;
  fullName: string;
  teamNumber: number;
  targetAddress: string | null;
}

export function MyChannels() {
  const account = useCurrentAccount();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);

  const loadChannels = async () => {
    if (!account) return;

    setLoading(true);
    try {
      // Load channels where this address is the leader
      const res = await fetch(`/api/channels?leader=${account.address}`);
      const data = await res.json();
      setChannels(data.channels || []);

      // Also load all channels for reference
      const allRes = await fetch("/api/channels");
      const allData = await allRes.json();
      setAllChannels(allData.channels || []);
    } catch (error) {
      console.error("Failed to load channels:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (account?.address) {
      loadChannels();
    }
  }, [account?.address]);

  if (!account) {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>My Team Channels</CardTitle>
          <CardDescription>
            Connect your wallet to view your team channels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">
            Connect your wallet to get started
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Hash className="w-5 h-5" />
              My Team Channels
            </CardTitle>
            <CardDescription>
              Channels where you are the team leader
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={loadChannels} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : channels.length > 0 ? (
          <div className="space-y-3">
            {channels.map((channel) => (
              <div
                key={channel.fullName}
                className="p-4 bg-secondary/50 rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-primary font-mono">
                      {channel.fullName}
                    </h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                      <Users className="w-4 h-4" />
                      Team #{channel.teamNumber}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="default" size="sm" asChild>
                      <Link href={`/channel/${channel.teamNumber}`}>
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Open
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={`https://suins.io/name/${channel.fullName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">No channels assigned yet</p>
            <p className="text-sm text-muted-foreground">
              Contact the hackathon admin to create a channel for your team
            </p>
          </div>
        )}

        {/* Show all channels count */}
        <div className="pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Total channels created: <span className="text-foreground font-medium">{allChannels.length}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
