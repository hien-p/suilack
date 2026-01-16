"use client";

import { useState, useEffect, use } from "react";
import { useCurrentAccount, ConnectButton } from "@mysten/dapp-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Crown,
  Hash,
  ArrowLeft,
  MessageSquare,
  Lock,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { ChannelChat } from "@/components/chat/channel-chat";
import { useCreateMessagingChannel } from "@/hooks/use-create-messaging-channel";
import { useMessaging } from "@/providers/messaging-provider";
import { HackathonPanel } from "@/components/hackathon/hackathon-panel";

interface ChannelMembers {
  channelId: string;
  fullName: string;
  leader: string;
  members: string[];
  memberCount: number;
  maxMembers: number;
  messagingChannelId: string | null;
  creatorCapId: string | null;
  creatorMemberCapId: string | null; // The creator's MemberCap ID (for hackathon features)
  memberCapIds?: Record<string, string>; // address -> memberCapId mapping
}

export default function ChannelPage({
  params,
}: {
  params: Promise<{ teamNumber: string }>;
}) {
  const { teamNumber } = use(params);
  const account = useCurrentAccount();
  const { isInitialized: messagingReady } = useMessaging();
  const { createChannel, isPending: isCreatingChannel, error: createError } = useCreateMessagingChannel();

  const [channelData, setChannelData] = useState<ChannelMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMemberAddress, setNewMemberAddress] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  const channelId = `team-${teamNumber}`;
  const isLeader = account && channelData?.leader.toLowerCase() === account.address.toLowerCase();
  const isMember = account && channelData?.members.some(
    (m) => m.toLowerCase() === account.address.toLowerCase()
  );

  const loadChannelData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/channels/${channelId}/members`);
      if (res.ok) {
        const data = await res.json();
        setChannelData(data);
      } else {
        setChannelData(null);
      }
    } catch (error) {
      console.error("Failed to load channel:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChannelData();
  }, [channelId]);

  const addMember = async () => {
    if (!newMemberAddress || !account || !isLeader) return;

    setAddingMember(true);
    try {
      const res = await fetch(`/api/channels/${channelId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberAddress: newMemberAddress,
          leaderAddress: account.address,
          teamNumber: parseInt(teamNumber),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setNewMemberAddress("");
        loadChannelData();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert("Failed to add member");
    } finally {
      setAddingMember(false);
    }
  };

  const removeMember = async (memberAddress: string) => {
    if (!account || !isLeader) return;
    if (!confirm(`Remove ${memberAddress.slice(0, 8)}...?`)) return;

    try {
      const res = await fetch(`/api/channels/${channelId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberAddress,
          leaderAddress: account.address,
        }),
      });

      if (res.ok) {
        loadChannelData();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (error) {
      alert("Failed to remove member");
    }
  };

  const initializeMessagingChannel = async () => {
    if (!account || !isLeader || !channelData) return;

    try {
      // Get all member addresses (excluding leader who will be automatically included)
      const memberAddresses = channelData.members.filter(
        (m) => m.toLowerCase() !== account.address.toLowerCase()
      );

      const result = await createChannel({
        initialMembers: memberAddresses,
      });

      if (result) {
        // Save the messaging channel ID to the backend
        await fetch(`/api/channels/${channelId}/members`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messagingChannelId: result.channelId,
            creatorCapId: result.creatorCapId,
            creatorMemberCapId: result.creatorMemberCapId, // Save the MemberCap ID for hackathon features
            leaderAddress: account.address,
          }),
        });

        // Reload channel data
        loadChannelData();
      }
    } catch (error) {
      console.error("Failed to initialize messaging channel:", error);
      alert("Failed to initialize messaging channel");
    }
  };

  if (!account) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Connect Wallet</CardTitle>
            <CardDescription>
              Connect your wallet to access {channelId}.fmsprint.sui
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <ConnectButton />
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to Home
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Hash className="w-5 h-5 text-primary" />
                {channelId}.fmsprint.sui
              </h1>
              <p className="text-sm text-muted-foreground">Team #{teamNumber}</p>
            </div>
          </div>
          <ConnectButton />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : !channelData && !isLeader ? (
          <Card className="max-w-lg mx-auto">
            <CardHeader>
              <CardTitle>Channel Not Found</CardTitle>
              <CardDescription>
                This channel hasn&apos;t been set up yet or you don&apos;t have access.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/">
                <Button variant="outline" className="w-full">
                  ← Back to Home
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Members Panel */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Team Members
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={loadChannelData}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
                <CardDescription>
                  {channelData?.memberCount || 0} / {channelData?.maxMembers || 5} members
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add Member (Leader only) */}
                {isLeader && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="0x... teammate address"
                        value={newMemberAddress}
                        onChange={(e) => setNewMemberAddress(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        onClick={addMember}
                        disabled={addingMember || !newMemberAddress || (channelData?.memberCount || 0) >= 5}
                      >
                        {addingMember ? <Loader2 className="animate-spin" /> : <Plus className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Invite teammates by their wallet address
                    </p>
                  </div>
                )}

                {/* Members List */}
                <div className="space-y-2">
                  {channelData?.members.map((member) => (
                    <div
                      key={member}
                      className="flex items-center justify-between p-2 bg-secondary/50 rounded"
                    >
                      <div className="flex items-center gap-2">
                        {member.toLowerCase() === channelData.leader.toLowerCase() && (
                          <Crown className="w-4 h-4 text-yellow-500" />
                        )}
                        <code className="text-xs">
                          {member.slice(0, 8)}...{member.slice(-6)}
                        </code>
                        {member.toLowerCase() === account.address.toLowerCase() && (
                          <span className="text-xs text-primary">(you)</span>
                        )}
                      </div>
                      {isLeader && member.toLowerCase() !== channelData.leader.toLowerCase() && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMember(member)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {!isMember && !isLeader && (
                  <div className="p-4 bg-yellow-950/50 border border-yellow-800 rounded text-center">
                    <p className="text-sm text-yellow-400">
                      You are not a member of this channel
                    </p>
                  </div>
                )}

                {/* Messaging Channel Status */}
                {(isMember || isLeader) && (
                  <div className="pt-4 border-t border-border space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Lock className="w-4 h-4" />
                      <span className="font-medium">SEAL Encryption</span>
                    </div>
                    {channelData?.messagingChannelId ? (
                      <p className="text-xs text-green-500 flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        Messaging channel active
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Messaging not initialized yet
                        </p>
                        {isLeader && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={initializeMessagingChannel}
                            disabled={isCreatingChannel || !messagingReady}
                            className="w-full"
                          >
                            {isCreatingChannel ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <Lock className="w-4 h-4 mr-2" />
                            )}
                            {isCreatingChannel ? "Creating..." : "Initialize Encrypted Chat"}
                          </Button>
                        )}
                        {createError && (
                          <p className="text-xs text-destructive">{createError}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Chat Area */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      Team Chat
                    </CardTitle>
                    <CardDescription>
                      SEAL-encrypted messaging with Walrus storage
                    </CardDescription>
                  </div>
                  {/* Hackathon Panel for Judge Verification */}
                  {(isMember || isLeader) && channelData?.messagingChannelId && channelData?.creatorMemberCapId && (
                    <HackathonPanel
                      channelId={channelData.messagingChannelId}
                      memberCapId={
                        account?.address && channelData.memberCapIds?.[account.address.toLowerCase()]
                          ? channelData.memberCapIds[account.address.toLowerCase()]
                          : channelData.creatorMemberCapId // Fallback to creatorMemberCapId for leader
                      }
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isMember || isLeader ? (
                  channelData?.messagingChannelId ? (
                    <ChannelChat
                      channelId={channelData.messagingChannelId}
                      leader={channelData.leader}
                      members={channelData.members}
                      teamNumber={teamNumber}
                    />
                  ) : (
                    <div className="h-96 flex items-center justify-center border border-dashed border-border rounded-lg">
                      <div className="text-center space-y-2">
                        <Lock className="w-12 h-12 mx-auto text-muted-foreground" />
                        <p className="text-muted-foreground">
                          {isLeader
                            ? "Initialize the encrypted chat to start messaging"
                            : "Waiting for team leader to initialize chat"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Chat will be end-to-end encrypted with SEAL
                        </p>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="h-96 flex items-center justify-center">
                    <p className="text-muted-foreground">
                      Only team members can view the chat
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
