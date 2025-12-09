import type { Context, Config } from "@netlify/functions";
import Ably from "ably";

export default async (req: Request, context: Context) => {
  const ablyApiKey = Netlify.env.get("ABLY_API_KEY");

  if (!ablyApiKey) {
    return new Response(
      JSON.stringify({ error: "ABLY_API_KEY not configured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId") || `player-${Date.now()}`;

    const ably = new Ably.Rest({ key: ablyApiKey });
    const tokenRequest = await ably.auth.createTokenRequest({
      clientId: clientId,
      capability: {
        "game:*": ["publish", "subscribe", "presence", "presence-subscribe"],
        "lobby": ["publish", "subscribe", "presence", "presence-subscribe"],
      },
    });

    return new Response(JSON.stringify(tokenRequest), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Ably auth error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create token" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

export const config: Config = {
  path: "/api/ably-auth",
};
