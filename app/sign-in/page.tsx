import { redirect } from "next/navigation";
import SignInForm from "@/components/auth/SignInForm";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SignInPage() {
  if (!hasSupabasePublicEnv()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="w-full max-w-md rounded-xl border border-red-500/20 bg-zinc-950/80 p-6 text-sm text-zinc-200">
          Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` in environment.
        </div>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/terminal");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4">
      <SignInForm />
    </main>
  );
}
