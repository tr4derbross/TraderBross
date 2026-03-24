"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";

export default function AccessPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password.trim()) {
      setError("Please enter the access password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiFetch<{ ok: boolean }>("/api/site-access", {
        method: "POST",
        body: JSON.stringify({ password: password.trim() }),
      });
      window.location.href = "/terminal";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Access denied.");
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-md rounded-xl border border-amber-400/20 bg-zinc-950/80 p-6">
        <h1 className="text-xl font-semibold text-white">Private Access</h1>
        <p className="mt-1 text-sm text-zinc-400">
          This environment is private. Enter the team password to continue.
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Access password"
            className="w-full rounded-md border border-white/15 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-amber-400 px-3 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Checking..." : "Enter"}
          </button>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </form>
      </div>
    </main>
  );
}
