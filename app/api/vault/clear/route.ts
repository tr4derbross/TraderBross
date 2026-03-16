/**
 * DELETE /api/vault/clear
 *
 * Removes a session's credentials from the server-side vault.
 * Call this when the user explicitly removes credentials or logs out.
 */

import { NextRequest, NextResponse } from "next/server";
import { clearCredentials } from "@/lib/credential-vault";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

type ClearPayload = {
  sessionToken?: string;
};

export async function DELETE(req: NextRequest) {
  // Rate limit: 10 clears per minute per IP
  const { allowed } = rateLimit(`vault-clear:${getClientIp(req)}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many requests." },
      { status: 429 },
    );
  }

  let body: ClearPayload;
  try {
    body = (await req.json()) as ClearPayload;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }

  const { sessionToken } = body;

  if (!sessionToken || typeof sessionToken !== "string") {
    return NextResponse.json({ ok: false, message: "sessionToken is required." }, { status: 400 });
  }

  clearCredentials(sessionToken);
  return NextResponse.json({ ok: true });
}
