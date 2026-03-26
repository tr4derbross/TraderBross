import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function sanitizeRelativeRedirectPath(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return "/terminal";
  if (!raw.startsWith("/")) return "/terminal";
  if (raw.startsWith("//")) return "/terminal";
  if (raw.includes("\\") || raw.includes("\0")) return "/terminal";
  return raw;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeRelativeRedirectPath(url.searchParams.get("next") || "/terminal");
  const origin = url.origin;

  if (!hasSupabasePublicEnv()) {
    return NextResponse.redirect(`${origin}/sign-in?error=supabase_not_configured`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
