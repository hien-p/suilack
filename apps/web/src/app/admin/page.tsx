"use client";

import { useState, useEffect } from "react";
import { useCurrentAccount, ConnectButton } from "@mysten/dapp-kit";
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
import {
  Loader2,
  Plus,
  Trash2,
  RefreshCw,
  Users,
  Activity,
  Package,
  Database,
  ExternalLink,
  Shield,
  ShieldX,
  Wallet,
  Hash,
  List,
  Lock,
  MessageSquare,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { isAdminAddress } from "@/config/admin";

interface Channel {
  name: string;
  fullName: string;
  teamNumber: number;
  targetAddress: string | null;
}

interface ChannelStats {
  channelName: string;
  teamNumber: number;
  members: string[];
  stats: {
    totalTransactions: number;
    packageDeployments: number;
    functionCalls: number;
    walrusBlobCount: number;
    sealMessageCount: number;
    sealChannelsCreated: number;
    gasUsed: string;
    lastActivityAt: string | null;
  };
  transactions: Array<{
    digest: string;
    sender: string;
    timestamp: string;
    kind: string;
    gasUsed: string;
    isSealTx?: boolean;
  }>;
  uploadedBlobs: Array<{
    blobId: string;
    fileName: string;
    fileSize: number;
    uploaderAddress: string;
    uploadedAt: string;
  }>;
}

export default function AdminPage() {
  const account = useCurrentAccount();
  const isAdmin = isAdminAddress(account?.address);

  // Leaders Management State
  const [leaders, setLeaders] = useState<string[]>([]);
  const [newLeaderAddress, setNewLeaderAddress] = useState("");
  const [loadingLeaders, setLoadingLeaders] = useState(false);
  const [addingLeader, setAddingLeader] = useState(false);

  // Channel Creation State
  const [teamNumber, setTeamNumber] = useState("");
  const [leaderForChannel, setLeaderForChannel] = useState("");
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [channelResult, setChannelResult] = useState<{
    success: boolean;
    message: string;
    txDigest?: string;
  } | null>(null);

  // Channels List State
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);

  // Judge Dashboard State
  const [judgeAddresses, setJudgeAddresses] = useState("");
  const [judgeTeamNumber, setJudgeTeamNumber] = useState("");
  const [channelStats, setChannelStats] = useState<ChannelStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Load leaders and channels on mount (only if admin)
  useEffect(() => {
    if (isAdmin) {
      loadLeaders();
      loadChannels();
    }
  }, [isAdmin]);

  const loadChannels = async () => {
    setLoadingChannels(true);
    try {
      const res = await fetch("/api/channels");
      const data = await res.json();
      setChannels(data.channels || []);
    } catch (error) {
      console.error("Failed to load channels:", error);
    } finally {
      setLoadingChannels(false);
    }
  };

  const loadLeaders = async () => {
    setLoadingLeaders(true);
    try {
      const res = await fetch("/api/admin/leaders");
      const data = await res.json();
      setLeaders(data.leaders || []);
    } catch (error) {
      console.error("Failed to load leaders:", error);
    } finally {
      setLoadingLeaders(false);
    }
  };

  const addLeader = async () => {
    if (!newLeaderAddress) return;
    setAddingLeader(true);
    try {
      const res = await fetch("/api/admin/leaders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: newLeaderAddress }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewLeaderAddress("");
        loadLeaders();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert("Failed to add leader");
    } finally {
      setAddingLeader(false);
    }
  };

  const removeLeader = async (address: string) => {
    if (!confirm(`Remove ${address.slice(0, 8)}... as leader?`)) return;
    try {
      const res = await fetch("/api/admin/leaders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (res.ok) {
        loadLeaders();
      }
    } catch (error) {
      alert("Failed to remove leader");
    }
  };

  const createChannel = async () => {
    if (!teamNumber || !leaderForChannel) return;
    setCreatingChannel(true);
    setChannelResult(null);
    try {
      const res = await fetch("/api/channel/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamNumber: parseInt(teamNumber),
          leaderAddress: leaderForChannel,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setChannelResult({
          success: true,
          message: `Created ${data.subdomain}`,
          txDigest: data.txDigest,
        });
        setTeamNumber("");
      } else {
        setChannelResult({
          success: false,
          message: data.error,
        });
      }
    } catch (error) {
      setChannelResult({
        success: false,
        message: "Failed to create channel",
      });
    } finally {
      setCreatingChannel(false);
    }
  };

  const loadChannelStats = async () => {
    if (!judgeAddresses) return;
    setLoadingStats(true);
    try {
      const params = new URLSearchParams({
        addresses: judgeAddresses,
        ...(judgeTeamNumber && { team: judgeTeamNumber }),
      });
      const res = await fetch(`/api/admin/channel-stats?${params}`);
      const data = await res.json();
      if (res.ok) {
        setChannelStats(data);
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert("Failed to load stats");
    } finally {
      setLoadingStats(false);
    }
  };

  const formatGas = (gas: string) => {
    const mist = BigInt(gas);
    const sui = Number(mist) / 1e9;
    return `${sui.toFixed(4)} SUI`;
  };

  // Not connected - show connect wallet
  if (!account) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Shield className="w-12 h-12 text-primary" />
            </div>
            <CardTitle>Admin Access Required</CardTitle>
            <CardDescription>
              Connect your wallet to access the admin dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <ConnectButton />
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to App
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Connected but not admin - show access denied
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md border-red-800">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <ShieldX className="w-12 h-12 text-red-500" />
            </div>
            <CardTitle className="text-red-400">Access Denied</CardTitle>
            <CardDescription>
              Your wallet is not authorized to access the admin dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-secondary/50 rounded-md text-center">
              <p className="text-xs text-muted-foreground mb-1">Connected wallet:</p>
              <code className="text-sm">{account.address.slice(0, 10)}...{account.address.slice(-6)}</code>
            </div>
            <div className="flex flex-col items-center gap-2">
              <ConnectButton />
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
                ← Back to App
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin - show full dashboard
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">Suilack Admin</h1>
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-4">
            <ConnectButton />
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to App
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Leaders Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Manage Leaders
              </CardTitle>
              <CardDescription>
                Add or remove addresses that can create team channels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Leader */}
              <div className="flex gap-2">
                <Input
                  placeholder="0x... (Sui address)"
                  value={newLeaderAddress}
                  onChange={(e) => setNewLeaderAddress(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={addLeader} disabled={addingLeader || !newLeaderAddress}>
                  {addingLeader ? <Loader2 className="animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>

              {/* Leaders List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {leaders.length} approved leaders
                  </span>
                  <Button variant="ghost" size="sm" onClick={loadLeaders} disabled={loadingLeaders}>
                    <RefreshCw className={`w-4 h-4 ${loadingLeaders ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {leaders.map((addr) => (
                    <div
                      key={addr}
                      className="flex items-center justify-between p-2 bg-secondary/50 rounded text-sm"
                    >
                      <code className="text-xs">{addr.slice(0, 10)}...{addr.slice(-6)}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLeader(addr)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Create Channel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Create Team Channel
              </CardTitle>
              <CardDescription>
                Create a SuiNS subdomain for a team leader
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Team Number (0-1000)</Label>
                <Input
                  type="number"
                  min="0"
                  max="1000"
                  placeholder="42"
                  value={teamNumber}
                  onChange={(e) => setTeamNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Leader Address</Label>
                <Input
                  placeholder="0x... (must be approved leader)"
                  value={leaderForChannel}
                  onChange={(e) => setLeaderForChannel(e.target.value)}
                />
              </div>
              <Button
                onClick={createChannel}
                disabled={creatingChannel || !teamNumber || !leaderForChannel}
                className="w-full"
              >
                {creatingChannel ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Channel"
                )}
              </Button>
              {channelResult && (
                <div
                  className={`p-3 rounded ${
                    channelResult.success
                      ? "bg-green-950 border border-green-800 text-green-300"
                      : "bg-red-950 border border-red-800 text-red-300"
                  }`}
                >
                  <p className="text-sm">{channelResult.message}</p>
                  {channelResult.txDigest && (
                    <a
                      href={`https://suiscan.xyz/testnet/tx/${channelResult.txDigest}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline mt-1"
                    >
                      View Tx <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Created Channels List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <List className="w-5 h-5" />
                  Created Channels
                </CardTitle>
                <CardDescription>
                  All team channels created on {`fmsprint.sui`}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={loadChannels} disabled={loadingChannels}>
                <RefreshCw className={`w-4 h-4 ${loadingChannels ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingChannels ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : channels.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2">Team #</th>
                      <th className="text-left py-2 px-2">Subdomain</th>
                      <th className="text-left py-2 px-2">Leader Address</th>
                      <th className="text-left py-2 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.map((channel) => (
                      <tr key={channel.fullName} className="border-b border-border/50 hover:bg-secondary/30">
                        <td className="py-2 px-2 font-mono">{channel.teamNumber}</td>
                        <td className="py-2 px-2">
                          <span className="font-mono text-primary">{channel.fullName}</span>
                        </td>
                        <td className="py-2 px-2 font-mono text-xs">
                          {channel.targetAddress
                            ? `${channel.targetAddress.slice(0, 8)}...${channel.targetAddress.slice(-6)}`
                            : "-"}
                        </td>
                        <td className="py-2 px-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (channel.targetAddress) {
                                setJudgeAddresses(channel.targetAddress);
                                setJudgeTeamNumber(channel.teamNumber.toString());
                              }
                            }}
                          >
                            <Activity className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No channels created yet
              </p>
            )}
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Total channels: <span className="text-foreground font-medium">{channels.length}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Judge Verification Dashboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Judge Verification Dashboard
            </CardTitle>
            <CardDescription>
              Query on-chain activity for team members to verify authentic building
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Query Form */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label>Team Member Addresses (comma-separated)</Label>
                <Input
                  placeholder="0x..., 0x..., 0x..."
                  value={judgeAddresses}
                  onChange={(e) => setJudgeAddresses(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Team Number (optional)</Label>
                <Input
                  type="number"
                  placeholder="42"
                  value={judgeTeamNumber}
                  onChange={(e) => setJudgeTeamNumber(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={loadChannelStats} disabled={loadingStats || !judgeAddresses}>
              {loadingStats ? (
                <>
                  <Loader2 className="animate-spin" />
                  Loading Stats...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Query On-Chain Activity
                </>
              )}
            </Button>

            {/* Stats Display */}
            {channelStats && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="p-4 bg-secondary/50 rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Activity className="w-4 h-4" />
                      <span className="text-xs">Transactions</span>
                    </div>
                    <p className="text-2xl font-bold">{channelStats.stats.totalTransactions}</p>
                  </div>
                  <div className="p-4 bg-secondary/50 rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Package className="w-4 h-4" />
                      <span className="text-xs">Packages</span>
                    </div>
                    <p className="text-2xl font-bold">{channelStats.stats.packageDeployments}</p>
                  </div>
                  <div className="p-4 bg-secondary/50 rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Database className="w-4 h-4" />
                      <span className="text-xs">Walrus Blobs</span>
                    </div>
                    <p className="text-2xl font-bold">{channelStats.stats.walrusBlobCount}</p>
                  </div>
                  <div className="p-4 bg-blue-950/50 rounded-lg border border-blue-800">
                    <div className="flex items-center gap-2 text-blue-400 mb-1">
                      <Lock className="w-4 h-4" />
                      <span className="text-xs">SEAL Messages</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-400">{channelStats.stats.sealMessageCount}</p>
                  </div>
                  <div className="p-4 bg-purple-950/50 rounded-lg border border-purple-800">
                    <div className="flex items-center gap-2 text-purple-400 mb-1">
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-xs">Channels</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-400">{channelStats.stats.sealChannelsCreated}</p>
                  </div>
                  <div className="p-4 bg-secondary/50 rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <span className="text-xs">Gas Used</span>
                    </div>
                    <p className="text-lg font-bold">{formatGas(channelStats.stats.gasUsed)}</p>
                  </div>
                </div>

                {/* Team Info */}
                <div className="p-4 bg-card border border-border rounded-lg">
                  <h3 className="font-semibold mb-2">Team Info</h3>
                  <p className="text-sm text-muted-foreground">
                    Channel: <span className="text-foreground font-mono">{channelStats.channelName}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Members: {channelStats.members.length}
                  </p>
                  {channelStats.stats.lastActivityAt && (
                    <p className="text-sm text-muted-foreground">
                      Last Activity: {new Date(channelStats.stats.lastActivityAt).toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Recent Transactions */}
                <div>
                  <h3 className="font-semibold mb-3">Recent Transactions</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-2">Digest</th>
                          <th className="text-left py-2 px-2">Sender</th>
                          <th className="text-left py-2 px-2">Type</th>
                          <th className="text-left py-2 px-2">Time</th>
                          <th className="text-left py-2 px-2">Gas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {channelStats.transactions.map((tx) => (
                          <tr key={tx.digest} className="border-b border-border/50 hover:bg-secondary/30">
                            <td className="py-2 px-2">
                              <a
                                href={`https://suiscan.xyz/testnet/tx/${tx.digest}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline font-mono text-xs"
                              >
                                {tx.digest.slice(0, 8)}...
                              </a>
                            </td>
                            <td className="py-2 px-2 font-mono text-xs">
                              {tx.sender.slice(0, 6)}...{tx.sender.slice(-4)}
                            </td>
                            <td className="py-2 px-2">
                              {tx.isSealTx ? (
                                <span className="inline-flex items-center gap-1 text-xs text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded">
                                  <Lock className="w-3 h-3" />
                                  SEAL
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Standard</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-muted-foreground text-xs">
                              {new Date(tx.timestamp).toLocaleString()}
                            </td>
                            <td className="py-2 px-2 text-xs">{formatGas(tx.gasUsed)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Uploaded Files */}
                {channelStats.uploadedBlobs && channelStats.uploadedBlobs.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Uploaded Files (Walrus)
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-2">File Name</th>
                            <th className="text-left py-2 px-2">Blob ID</th>
                            <th className="text-left py-2 px-2">Size</th>
                            <th className="text-left py-2 px-2">Uploader</th>
                            <th className="text-left py-2 px-2">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {channelStats.uploadedBlobs.map((blob) => (
                            <tr key={blob.blobId} className="border-b border-border/50 hover:bg-secondary/30">
                              <td className="py-2 px-2 text-xs max-w-[150px] truncate">
                                {blob.fileName}
                              </td>
                              <td className="py-2 px-2 font-mono text-xs">
                                <a
                                  href={`https://aggregator.walrus-testnet.walrus.space/v1/${blob.blobId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:underline"
                                >
                                  {blob.blobId.slice(0, 12)}...
                                </a>
                              </td>
                              <td className="py-2 px-2 text-xs text-muted-foreground">
                                {(blob.fileSize / 1024).toFixed(1)} KB
                              </td>
                              <td className="py-2 px-2 font-mono text-xs">
                                {blob.uploaderAddress.slice(0, 6)}...{blob.uploaderAddress.slice(-4)}
                              </td>
                              <td className="py-2 px-2 text-muted-foreground text-xs">
                                {new Date(blob.uploadedAt).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
