import { NextRequest, NextResponse } from "next/server";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

const client = new SuiClient({ url: getFullnodeUrl("testnet") });

// SuiNS Configuration
const SUINS_CONFIG = {
  parentDomain: "fmsprint.sui",
  // The parent domain NFT
  parentNftId: "0x3fa88ffd62758f0f8721d6d471fbacc5ccde437639f70191953bf8c81ef39e8b",
  subdomainsPackageId: "0x3c272bc45f9157b7818ece4f7411bdfa8af46303b071aca4e18c03119c9ff636",
  suinsPackageId: "0x22fa05f21b1ad71442491220bb9338f7b7095fe35000ef88d5400d28523bdd93",
  suinsObjectId: "0x300369e8909b9a6464da265b9a5a9ab6fe2158a040e84e808628cde7a07ee5a3",
  // The registry Table where all domains are stored
  registryTableId: "0xb120c0d55432630fce61f7854795a3463deb6e3b443cc4ae72e1282073ff56e4",
};

interface Channel {
  name: string;
  fullName: string;
  teamNumber: number;
  targetAddress: string | null;
  createdAt?: string;
}

// Scan registry table for team subdomains
async function querySubdomains(): Promise<Channel[]> {
  const channels: Channel[] = [];

  try {
    // Query dynamic fields of the registry table
    let cursor: string | null = null;
    let hasMore = true;

    while (hasMore) {
      const response = await client.getDynamicFields({
        parentId: SUINS_CONFIG.registryTableId,
        cursor,
        limit: 50,
      });

      for (const field of response.data) {
        try {
          // Check if it's a Domain type
          const nameField = field.name;
          if (nameField && typeof nameField === "object" && "value" in nameField) {
            const domainValue = nameField.value as { labels?: string[] };

            if (domainValue.labels && Array.isArray(domainValue.labels)) {
              const labels = domainValue.labels;

              // Check if it's a subdomain of fmsprint.sui (labels: ["sui", "fmsprint", "team-X"])
              if (labels.length === 3 && labels[0] === "sui" && labels[1] === "fmsprint") {
                const subdomain = labels[2];
                const match = subdomain.match(/^team-(\d+)$/);

                if (match) {
                  // Get full object for target address
                  const domainData = await client.getDynamicFieldObject({
                    parentId: SUINS_CONFIG.registryTableId,
                    name: field.name,
                  });

                  let targetAddress: string | null = null;
                  if (domainData.data?.content && "fields" in domainData.data.content) {
                    const fields = domainData.data.content.fields as Record<string, unknown>;
                    if (fields.value && typeof fields.value === "object") {
                      const valueFields = (fields.value as Record<string, unknown>).fields as Record<string, unknown>;
                      targetAddress = (valueFields?.target_address as string) || null;
                    }
                  }

                  channels.push({
                    name: subdomain,
                    fullName: `${subdomain}.${SUINS_CONFIG.parentDomain}`,
                    teamNumber: parseInt(match[1]),
                    targetAddress,
                  });
                }
              }
            }
          }
        } catch {
          // Skip invalid entries
          continue;
        }
      }

      cursor = response.nextCursor ?? null;
      hasMore = response.hasNextPage;
    }
  } catch (error) {
    console.error("Error querying subdomains:", error);
  }

  // Sort by team number
  channels.sort((a, b) => a.teamNumber - b.teamNumber);

  return channels;
}

// Query by checking known team numbers in the SuiNS registry table
async function queryKnownTeamChannels(): Promise<Channel[]> {
  const channels: Channel[] = [];

  // Check team numbers 0-100 (can be expanded)
  const checkNumbers = Array.from({ length: 101 }, (_, i) => i);

  const batchSize = 10;
  for (let i = 0; i < checkNumbers.length; i += batchSize) {
    const batch = checkNumbers.slice(i, i + batchSize);

    const promises = batch.map(async (num) => {
      try {
        const subdomain = `team-${num}`;
        const fullName = `${subdomain}.${SUINS_CONFIG.parentDomain}`;

        // Query the registry table for this subdomain
        // Domain format: { labels: ["sui", "fmsprint", "team-X"] }
        const result = await client.getDynamicFieldObject({
          parentId: SUINS_CONFIG.registryTableId,
          name: {
            type: `${SUINS_CONFIG.suinsPackageId}::domain::Domain`,
            value: {
              labels: ["sui", "fmsprint", subdomain],
            },
          },
        });

        if (result.data?.content && "fields" in result.data.content) {
          const fields = result.data.content.fields as Record<string, unknown>;

          let targetAddress: string | null = null;

          // The value is a NameRecord with target_address field
          if (fields.value && typeof fields.value === "object") {
            const valueFields = (fields.value as Record<string, unknown>).fields as Record<string, unknown>;
            if (valueFields?.target_address) {
              targetAddress = valueFields.target_address as string;
            }
          }

          return {
            name: subdomain,
            fullName,
            teamNumber: num,
            targetAddress,
          };
        }
      } catch {
        // Subdomain doesn't exist
      }
      return null;
    });

    const results = await Promise.all(promises);
    for (const result of results) {
      if (result) {
        channels.push(result);
      }
    }
  }

  return channels.sort((a, b) => a.teamNumber - b.teamNumber);
}

// GET - List all created channels
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const leader = searchParams.get("leader"); // Filter by leader address
  const method = searchParams.get("method") || "known"; // "known" or "scan"

  try {
    let channels: Channel[];

    if (method === "scan") {
      channels = await querySubdomains();
    } else {
      channels = await queryKnownTeamChannels();
    }

    // Filter by leader if specified
    if (leader) {
      channels = channels.filter(
        (ch) => ch.targetAddress?.toLowerCase() === leader.toLowerCase()
      );
    }

    return NextResponse.json({
      channels,
      count: channels.length,
      parentDomain: SUINS_CONFIG.parentDomain,
    });
  } catch (error) {
    console.error("Error listing channels:", error);
    return NextResponse.json(
      { error: "Failed to list channels" },
      { status: 500 }
    );
  }
}
