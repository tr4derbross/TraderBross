import { redirect } from "next/navigation";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import TierPassportCard from "@/components/account/TierPassportCard";

export default async function AccountPage() {
  if (!hasSupabasePublicEnv()) {
    redirect("/sign-in");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username,full_name,avatar_url,created_at")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10 text-zinc-100">
      <h1 className="text-2xl font-semibold">Account</h1>
      <p className="mt-1 text-sm text-zinc-400">Supabase identity and profile state.</p>

      <section className="mt-6 rounded-xl border border-white/10 bg-zinc-950/70 p-5">
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-zinc-400">User ID</dt>
            <dd className="font-mono text-xs">{user.id}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-zinc-400">Email</dt>
            <dd>{user.email || "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-zinc-400">Username</dt>
            <dd>{profile?.username || "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-zinc-400">Full name</dt>
            <dd>{profile?.full_name || "-"}</dd>
          </div>
        </dl>
      </section>

      <TierPassportCard />
    </main>
  );
}
