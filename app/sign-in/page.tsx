import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import SignInForm from "@/components/auth/SignInForm";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWalletSessionCookieName, verifyWalletSessionToken } from "@/lib/wallet-auth";

export default async function SignInPage() {
  const cookieStore = await cookies();
  const walletToken = cookieStore.get(getWalletSessionCookieName())?.value || "";
  const walletSession = verifyWalletSessionToken(walletToken);
  if (walletSession) {
    redirect("/terminal");
  }

  if (hasSupabasePublicEnv()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/terminal");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4">
      <SignInForm />
    </main>
  );
}
