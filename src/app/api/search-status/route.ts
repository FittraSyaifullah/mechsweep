import { NextResponse } from "next/server";
import { verifyExaConnection } from "@/lib/exa";
import { describeWebSearchSetup, exaSearchEnabled } from "@/lib/search-provider";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const setup = describeWebSearchSetup();
  let exaLive: { ok: boolean; resultCount?: number; error?: string } = {
    ok: false,
  };

  if (exaSearchEnabled()) {
    try {
      const verified = await verifyExaConnection();
      exaLive = { ok: true, resultCount: verified.resultCount };
    } catch (error) {
      exaLive = {
        ok: false,
        error: error instanceof Error ? error.message : "Exa verification failed",
      };
    }
  } else if (!setup.exaConfigured) {
    exaLive = { ok: false, error: "EXA_API_KEY is not configured" };
  } else {
    exaLive = {
      ok: false,
      error: `SEARCH_PROVIDER is set to ${setup.primaryProvider}, not exa`,
    };
  }

  return NextResponse.json({
    ...setup,
    exaLive,
    ready: setup.primaryProvider === "exa" && exaLive.ok,
  });
}
