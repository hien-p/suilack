import { WalletButton } from "@/components/wallet-button";
import { MyChannels } from "@/components/my-channels";
import { CreateSubdomain } from "@/components/create-subdomain";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg" />
            <h1 className="text-xl font-bold">Suilack</h1>
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
              Testnet
            </span>
          </div>
          <WalletButton />
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold tracking-tight">
              Hackathon Collaboration
              <br />
              <span className="text-primary">On-Chain</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Create team channels with SuiNS subdomains.
              Chat, share code, and transfer assets - all verified on Sui.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-8">
            <div className="p-4 rounded-lg border border-border bg-card">
              <div className="text-2xl mb-2">🔗</div>
              <h3 className="font-semibold mb-1">SuiNS Channels</h3>
              <p className="text-sm text-muted-foreground">
                Each team gets team-XX.fmsprint.sui
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card">
              <div className="text-2xl mb-2">🔒</div>
              <h3 className="font-semibold mb-1">SEAL Encrypted</h3>
              <p className="text-sm text-muted-foreground">
                Only team members can read messages
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card">
              <div className="text-2xl mb-2">📊</div>
              <h3 className="font-semibold mb-1">Judge Dashboard</h3>
              <p className="text-sm text-muted-foreground">
                Verify on-chain activity per team
              </p>
            </div>
          </div>

          {/* General Channel Banner */}
          <Link
            href="/general"
            className="block p-4 rounded-lg border border-green-800 bg-green-950/30 hover:bg-green-950/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center text-xl">
                  🌐
                </div>
                <div>
                  <h3 className="font-semibold text-green-400">general.fmsprint.sui</h3>
                  <p className="text-sm text-muted-foreground">
                    Public hackathon channel - announcements, Q&A, networking
                  </p>
                </div>
              </div>
              <span className="text-green-400">→</span>
            </div>
          </Link>

          {/* My Channels */}
          <div className="flex justify-center">
            <MyChannels />
          </div>

          {/* Create Channel - for approved leaders */}
          <div className="flex justify-center pt-4">
            <CreateSubdomain />
          </div>

          {/* Admin Link */}
          <div className="text-center pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground mb-2">Are you a hackathon admin?</p>
            <Link
              href="/admin"
              className="text-sm text-primary hover:underline"
            >
              Go to Admin Dashboard →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
