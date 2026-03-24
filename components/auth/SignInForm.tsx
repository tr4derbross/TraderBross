"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignInForm() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handlePasswordSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    window.location.href = "/terminal";
  }

  async function handleMagicLink() {
    if (!email.trim()) {
      setError("Please enter your email first.");
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    const redirectTo = `${window.location.origin}/auth/callback?next=/terminal`;
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });

    setLoading(false);

    if (otpError) {
      setError(otpError.message);
      return;
    }

    setMessage("Magic link sent. Check your inbox.");
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-white/10 bg-zinc-950/80 p-6">
      <h1 className="text-xl font-semibold text-white">Sign in</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Use email/password or request a magic link.
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        Plans: Free (news + paper), DEX ($20/mo), Full ($50/mo) — <a href="/pricing" className="text-amber-300 hover:text-amber-200">see pricing</a>.
      </p>

      <form onSubmit={handlePasswordSignIn} className="mt-5 space-y-3">
        <label className="block space-y-1">
          <span className="text-xs text-zinc-400">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-white/15 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
            placeholder="you@example.com"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-zinc-400">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-white/15 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
            placeholder="Your password"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-amber-400 px-3 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in with password"}
        </button>
      </form>

      <button
        type="button"
        onClick={handleMagicLink}
        disabled={loading}
        className="mt-3 w-full rounded-md border border-white/20 px-3 py-2 text-sm text-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Please wait..." : "Send magic link"}
      </button>

      {message ? <p className="mt-3 text-sm text-emerald-400">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
