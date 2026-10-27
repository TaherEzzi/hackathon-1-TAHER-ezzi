"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { sanitizeAuthRedirect } from "@/lib/auth/sanitize-redirect.mjs";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const next = sanitizeAuthRedirect(nextPath);
    try {
      const supabase = createBrowserSupabaseClient();
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Account created. You can sign in now.");
        setMode("signin");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push(next);
      router.refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Sign-in failed";
      setMessage(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="login-form">
      <label className="login-label">
        Email
        <input
          className="login-input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="login-label">
        Password
        <input
          className="login-input"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {message ? <p className="login-msg">{message}</p> : null}
      <button className="login-submit" type="submit" disabled={busy}>
        {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
      </button>
      <button
        className="login-toggle"
        type="button"
        disabled={busy}
        onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
      >
        {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
      </button>
      <style>{`
        .login-form { display: flex; flex-direction: column; gap: 1rem; }
        .login-label {
          display: flex; flex-direction: column; gap: 0.35rem;
          font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #5e7094;
        }
        .login-input {
          height: 46px; border: 1px solid rgba(21, 44, 82, 0.16);
          background: #fff; padding: 0 0.75rem; font-size: 15px; color: #00173a;
        }
        .login-input:focus { outline: 2px solid #152c52; outline-offset: 0; }
        .login-submit {
          height: 46px; border: 0; background: #152c52; color: #fbf6ee;
          font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; cursor: pointer;
        }
        .login-submit:disabled { opacity: 0.6; cursor: wait; }
        .login-toggle {
          background: transparent; border: 0; color: #3f5e95; font-size: 13px; cursor: pointer; text-align: left;
        }
        .login-msg { font-size: 0.875rem; color: #2f4e84; margin: 0; }
      `}</style>
    </form>
  );
}
