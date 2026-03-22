import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type WatchlistSymbol = {
  symbol: string;
  sort_order?: number;
};

function normalizeSymbols(input: unknown): WatchlistSymbol[] {
  if (!Array.isArray(input)) return [];

  const unique = new Set<string>();
  const output: WatchlistSymbol[] = [];

  input.forEach((item, index) => {
    const symbol =
      typeof item === "string"
        ? item.toUpperCase().trim()
        : String((item as WatchlistSymbol)?.symbol || "")
            .toUpperCase()
            .trim();

    if (!symbol || symbol.length > 20 || unique.has(symbol)) return;
    unique.add(symbol);
    output.push({ symbol, sort_order: index });
  });

  return output.slice(0, 100);
}

export async function GET() {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_watchlist_items")
    .select("symbol,sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function PUT(request: Request) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const items = normalizeSymbols(body?.items);

  const { error: deleteError } = await supabase
    .from("user_watchlist_items")
    .delete()
    .eq("user_id", user.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (items.length > 0) {
    const payload = items.map((item) => ({
      user_id: user.id,
      symbol: item.symbol,
      sort_order: item.sort_order ?? 0,
    }));
    const { error: insertError } = await supabase
      .from("user_watchlist_items")
      .insert(payload);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, count: items.length });
}
