/**
 * POST /api/vault/status
 *
 * Returns whether a session token is still valid.
 * Does NOT return the credentials — just a boolean.
 */

import { NextRequest, NextResponse } from "next/server";
import { hasCredentials } from "@/lib/credential-vault";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

type StatusPayload = {
  sessionToken?: string;
};

export async function POST(req: NextRequest) {
  // Rate limit: 20 checks per minute per IP
  const { allowed } = rateLimit(`vault-status:${getClientIp(req)}`, 20, 60_000);
  if (!allowed) {
    return NextResponse.json({ ok: false, valid: false }, { status: 429 });
  }

  let body: StatusPayload;
  try {
    body = (await req.json()) as StatusPayload;
  } catch {
    return NextResponse.json({ ok: false, valid: false }, { status: 400 });
  }

  const { sessionToken } = body;

  if (!sessionToken || typeof sessionToken !== "string") {
    return NextResponse.json({ ok: true, valid: false });
  }

  return NextResponse.json({ ok: true, valid: hasCredentials(sessionToken) });
}
