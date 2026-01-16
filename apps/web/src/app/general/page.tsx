"use client";

import { useState, useEffect, useCallback } from "react";
import { useCurrentAccount, ConnectButton } from "@mysten/dapp-kit";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  Users,
  Hash,
  ArrowLeft,
  MessageSquare,
  Lock,
  Globe,
  RefreshCw,
  Zap,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { ChannelChat } from "@/components/chat/channel-chat";
import { useMessaging } from "@/providers/messaging-provider";
import { useCreateMessagingChannel } from "@/hooks/use-create-messaging-channel";
import { useAddChannelMembers } from "@/hooks/use-add-channel-members";
import { isAdminAddress } from "@/config/admin";

interface GeneralChannelData {
  messagingChannelId: string | null;
  creatorCapId: string | null;
  serverMemberCapId: string | null;
  serverBotReady: boolean;
  serverAddress: string;
  memberCount: number;
  members: string[];
}

export default function GeneralChannelPage() {
  const account = useCurrentAccount();
  const { isInitialized: messagingReady, messagingClient } = useMessaging();
  const { createChannel, isPending: isCreatingChannel, error: createError } = useCreateMessagingChannel();
  const { addMembers, isPending: isAddingMembers, error: addMembersError } = useAddChannelMembers();

  const [channelData, setChannelData] = useState<GeneralChannelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingMembers, setPendingMembers] = useState<string[]>([]);
  const [checkingMembers, setCheckingMembers] = useState(false);
  const [settingUpServer, setSettingUpServer] = useState(false);

  const isAdmin = isAdminAddress(account?.address);

  const loadChannelData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/general/info");
      if (res.ok) {
        const data = await res.json();
        setChannelData(data);
      } else {
        setChannelData(null);
      }
    } catch (err) {
      console.error("Failed to load general channel:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChannelData();
  }, []);

  const isMember = account && channelData?.members.some(
    (m) => m.toLowerCase() === account.address.toLowerCase()
  );

  // Check which backend members don't have on-chain MemberCap
  const checkPendingMembers = useCallback(async () => {
    if (!messagingClient || !channelData?.messagingChannelId || !channelData.members.length) {
      return;
    }

    setCheckingMembers(true);
    try {
      const messaging = (messagingClient as unknown as { messaging: typeof messagingClient }).messaging;
      const pending: string[] = [];

      for (const memberAddress of channelData.members) {
        try {
          const memberCap = await messaging.getUserMemberCap(memberAddress, channelData.messagingChannelId);
          if (!memberCap) {
            pending.push(memberAddress);
          }
        } catch {
          // If error checking, assume they need to be added
          pending.push(memberAddress);
        }
      }

      setPendingMembers(pending);
    } catch (err) {
      console.error("Error checking pending members:", err);
    } finally {
      setCheckingMembers(false);
    }
  }, [messagingClient, channelData?.messagingChannelId, channelData?.members]);

  // Admin function to add pending members on-chain
  const addPendingMembersOnChain = async () => {
    if (!isAdmin || !channelData?.messagingChannelId || !channelData.creatorCapId || pendingMembers.length === 0) {
      return;
    }

    setError(null);
    try {
      // Get admin's member cap
      const messaging = (messagingClient as unknown as { messaging: typeof messagingClient }).messaging;
      const adminMemberCap = await messaging.getUserMemberCap(account!.address, channelData.messagingChannelId);

      if (!adminMemberCap) {
        setError("Admin member cap not found");
        return;
      }

      const result = await addMembers({
        channelId: channelData.messagingChannelId,
        memberCapId: adminMemberCap.id.id,
        newMemberAddresses: pendingMembers,
        creatorCapId: channelData.creatorCapId,
      });

      if (result) {
        // Clear pending members and reload
        setPendingMembers([]);
        await loadChannelData();
        await checkPendingMembers();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add members on-chain");
    }
  };

  // Admin function to set up server bot (add server as a member)
  const setupServerBot = async () => {
    if (!isAdmin || !channelData?.messagingChannelId || !channelData.creatorCapId || !channelData.serverAddress) {
      return;
    }

    setSettingUpServer(true);
    setError(null);

    try {
      // Get admin's member cap
      const messaging = (messagingClient as unknown as { messaging: typeof messagingClient }).messaging;
      const adminMemberCap = await messaging.getUserMemberCap(account!.address, channelData.messagingChannelId);

      if (!adminMemberCap) {
        setError("Admin member cap not found");
        setSettingUpServer(false);
        return;
      }

      // Add server address as a member
      const result = await addMembers({
        channelId: channelData.messagingChannelId,
        memberCapId: adminMemberCap.id.id,
        newMemberAddresses: [channelData.serverAddress],
        creatorCapId: channelData.creatorCapId,
      });

      if (result) {
        // Get the server's new memberCapId
        const serverMemberCap = await messaging.getUserMemberCap(
          channelData.serverAddress,
          channelData.messagingChannelId
        );

        if (serverMemberCap) {
          // Store the server's memberCapId
          const res = await fetch("/api/general/setup-server", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              adminAddress: account!.address,
              serverMemberCapId: serverMemberCap.id.id,
            }),
          });

          if (!res.ok) {
            throw new Error("Failed to save server member cap");
          }

          // Reload channel data
          await loadChannelData();
        } else {
          throw new Error("Server member cap not found after adding");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to setup server bot");
    } finally {
      setSettingUpServer(false);
    }
  };

  // Check pending members when channel data changes
  useEffect(() => {
    if (messagingReady && channelData?.messagingChannelId && isAdmin) {
      checkPendingMembers();
    }
  }, [messagingReady, channelData?.messagingChannelId, isAdmin, checkPendingMembers]);

  // Initialize public channel (admin only)
  const initializeChannel = async () => {
    if (!account || !isAdmin) return;

    setInitializing(true);
    setError(null);

    try {
      // Create on-chain messaging channel
      const result = await createChannel({
        initialMembers: [], // Public channel starts empty, people join
      });

      if (!result) {
        throw new Error(createError || "Failed to create messaging channel");
      }

      // Save to backend
      const res = await fetch("/api/general/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messagingChannelId: result.channelId,
          creatorCapId: result.creatorCapId,
          adminAddress: account.address,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save channel");
      }

      // Reload channel data
      await loadChannelData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize channel");
    } finally {
      setInitializing(false);
    }
  };

  const joinChannel = async () => {
    if (!account?.address || !channelData?.messagingChannelId) {
      return;
    }

    setJoining(true);
    setError(null);

    try {
      // Add user as member in the backend
      const res = await fetch("/api/general/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: account.address }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to join");
      }

      // Reload channel data
      await loadChannelData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join channel");
    } finally {
      setJoining(false);
    }
  };

  if (!account) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Connect Wallet</CardTitle>
            <CardDescription>
              Connect your wallet to access general.fmsprint.sui
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
                <Globe className="w-5 h-5 text-green-500" />
                general.fmsprint.sui
              </h1>
              <p className="text-sm text-muted-foreground">Public Hackathon Channel</p>
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
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Info Panel */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-green-500" />
                    Public Channel
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={loadChannelData}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
                <CardDescription>
                  Open to all hackathon participants
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Channel Info */}
                <div className="p-4 bg-green-950/30 border border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 text-green-400 mb-2">
                    <Globe className="w-4 h-4" />
                    <span className="font-medium">Public Channel</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This channel is open to all hackathon participants.
                    Announcements, Q&A, and networking.
                  </p>
                </div>

                {/* Member Count */}
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4" />
                  <span>{channelData?.memberCount || 0} participants joined</span>
                </div>

                {/* Server Bot Status (Admin Only) */}
                {isAdmin && channelData?.messagingChannelId && (
                  <div className="p-3 border border-border rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Zap className="w-4 h-4" />
                      Server Bot
                    </div>
                    {channelData.serverBotReady ? (
                      <p className="text-xs text-green-400">
                        Active - Auto-join enabled
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-yellow-400">
                          Not set up - Users need admin approval to join
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Server: {channelData.serverAddress?.slice(0, 10)}...
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={setupServerBot}
                          disabled={settingUpServer || isAddingMembers}
                          className="w-full"
                        >
                          {settingUpServer ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <UserPlus className="w-4 h-4 mr-2" />
                          )}
                          {settingUpServer ? "Setting up..." : "Setup Auto-Join"}
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* Pending Members (Admin Only) */}
                {isAdmin && pendingMembers.length > 0 && (
                  <div className="p-3 border border-yellow-800 bg-yellow-950/20 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-yellow-400">
                      <Users className="w-4 h-4" />
                      {pendingMembers.length} Pending Member{pendingMembers.length > 1 ? "s" : ""}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      These users joined but need on-chain access
                    </p>
                    {pendingMembers.slice(0, 3).map((addr) => (
                      <p key={addr} className="text-xs font-mono text-muted-foreground">
                        {addr.slice(0, 10)}...{addr.slice(-6)}
                      </p>
                    ))}
                    {pendingMembers.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{pendingMembers.length - 3} more
                      </p>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={addPendingMembersOnChain}
                      disabled={isAddingMembers || !channelData?.creatorCapId}
                      className="w-full"
                    >
                      {isAddingMembers ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <UserPlus className="w-4 h-4 mr-2" />
                      )}
                      {isAddingMembers ? "Adding..." : "Add All On-Chain"}
                    </Button>
                  </div>
                )}

                {/* Join Button */}
                {!isMember && channelData?.messagingChannelId && (
                  <Button
                    onClick={joinChannel}
                    disabled={joining || !messagingReady}
                    className="w-full"
                  >
                    {joining ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Users className="w-4 h-4 mr-2" />
                    )}
                    {joining ? "Joining..." : "Join Channel"}
                  </Button>
                )}

                {isMember && (
                  <div className="p-3 bg-green-950/30 border border-green-800 rounded text-center">
                    <p className="text-sm text-green-400">You are a member</p>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                {/* On-chain Info */}
                <div className="pt-4 border-t border-border space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4" />
                    <span className="font-medium">Fully On-Chain</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Messages stored on Sui blockchain. Gas-free with sponsored transactions.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Chat Area */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  General Chat
                </CardTitle>
                <CardDescription>
                  Hackathon announcements and discussions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {channelData?.messagingChannelId ? (
                  isMember ? (
                    <ChannelChat
                      channelId={channelData.messagingChannelId}
                      leader="" // No specific leader for public channel
                      members={channelData.members}
                    />
                  ) : (
                    <div className="h-96 flex items-center justify-center border border-dashed border-border rounded-lg">
                      <div className="text-center space-y-2">
                        <Users className="w-12 h-12 mx-auto text-muted-foreground" />
                        <p className="text-muted-foreground">
                          Join the channel to view and send messages
                        </p>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="h-96 flex items-center justify-center border border-dashed border-border rounded-lg">
                    <div className="text-center space-y-4">
                      <Lock className="w-12 h-12 mx-auto text-muted-foreground" />
                      <p className="text-muted-foreground">
                        Channel not initialized yet
                      </p>
                      {isAdmin ? (
                        <>
                          <Button
                            onClick={initializeChannel}
                            disabled={initializing || isCreatingChannel}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {initializing || isCreatingChannel ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <Zap className="w-4 h-4 mr-2" />
                            )}
                            {initializing || isCreatingChannel ? "Initializing..." : "Initialize Public Channel"}
                          </Button>
                          {(error || createError) && (
                            <p className="text-xs text-destructive">{error || createError}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Admin needs to initialize the public channel
                        </p>
                      )}
                    </div>
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
