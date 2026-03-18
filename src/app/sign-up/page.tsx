"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!agreeTerms) {
      setError("Please agree to the terms and conditions");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // On success, show confirmation message (don't redirect)
    setSuccess(true);
    setLoading(false);
  };

  const handleGoogleSignUp = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="min-h-screen bg-background-light flex items-center justify-center px-4">
      <div className="w-full max-w-md mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8 md:mb-10">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="font-display font-bold text-2xl tracking-tight text-text-main-light">
            ClearDebt
          </span>
        </div>

        {/* Card */}
        <div className="bg-surface-light border border-border-light rounded-[24px] p-6 md:p-8 shadow-sm">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-text-main-light mb-2 text-center">
            Get started
          </h1>
          <p className="text-text-muted-light text-center mb-6 md:mb-8 text-sm md:text-base">
            Start your debt-free journey today
          </p>

          {/* Google OAuth */}
          <button
            onClick={handleGoogleSignUp}
            className="w-full flex items-center justify-center gap-3 px-4 h-12 md:h-12 rounded-xl border-2 border-border-light text-text-main-light font-medium hover:bg-background-light transition-colors mb-6 text-sm md:text-base"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-border-light" />
            <span className="text-sm text-text-muted-light">or</span>
            <div className="flex-1 h-px bg-border-light" />
          </div>

          {/* Sign Up Form */}
          {success ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
              <h3 className="text-green-800 font-bold mb-2">Check your email</h3>
              <p className="text-green-700 text-sm">
                We&apos;ve sent a confirmation link to <strong>{email}</strong>. Check your email to confirm your account.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-1.5 block">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  required
                  className="w-full px-4 h-12 md:h-12 rounded-xl border border-border-light bg-background-light text-text-main-light placeholder:text-text-muted-light/50 outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-1.5 block">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 h-12 md:h-12 rounded-xl border border-border-light bg-background-light text-text-main-light placeholder:text-text-muted-light/50 outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-1.5 block">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  minLength={8}
                  className="w-full px-4 h-12 md:h-12 rounded-xl border border-border-light bg-background-light text-text-main-light placeholder:text-text-muted-light/50 outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                />
              </div>

              {/* Terms checkbox */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  required
                  className="mt-1 w-4 h-4 rounded border-border-light text-primary focus:ring-primary/30 accent-primary"
                />
                <span className="text-sm text-text-muted-light leading-snug">
                  I agree to the terms of service
                </span>
              </label>

              {/* Error */}
              {error && (
                <div className="text-primary text-sm bg-primary/10 px-4 py-2.5 rounded-xl">
                  {error}
                </div>
              )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 md:h-12 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm md:text-base"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
          )}
        </div>

        {/* Footer link */}
        <p className="text-center mt-6 text-text-muted-light text-sm pb-8">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
