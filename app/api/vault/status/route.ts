/**
 * POST /api/vault/status
 *
 * Returns whether a session token is still valid.
 * Does NOT return the credentials — just a boolean.
 */

import { NextRequest, NextResponse } from "next/server";
import { hasCredentials } from "@/lib/credential-vault";

type StatusPayload = {
  sessionToken?: string;
};

export async function POST(req: NextRequest) {
  let body: StatusPayload;
  try {
    body = (await req.json()) as StatusPayload;
  } catch {
    return NextResponse.json({ ok: false, valid: false }, { status: 400 });
  }

  const { sessionToken } = body;

  if (!sessionToken) {
    return NextResponse.json({ ok: true, valid: false });
  }

  return NextResponse.json({ ok: true, valid: hasCredentials(sessionToken) });
}
