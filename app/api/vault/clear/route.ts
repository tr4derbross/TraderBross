/**
 * DELETE /api/vault/clear
 *
 * Removes a session's credentials from the server-side vault.
 * Call this when the user explicitly removes credentials or logs out.
 */

import { NextRequest, NextResponse } from "next/server";
import { clearCredentials } from "@/lib/credential-vault";

type ClearPayload = {
  sessionToken?: string;
};

export async function DELETE(req: NextRequest) {
  let body: ClearPayload;
  try {
    body = (await req.json()) as ClearPayload;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }

  const { sessionToken } = body;

  if (!sessionToken) {
    return NextResponse.json({ ok: false, message: "sessionToken is required." }, { status: 400 });
  }

  clearCredentials(sessionToken);
  return NextResponse.json({ ok: true });
}
