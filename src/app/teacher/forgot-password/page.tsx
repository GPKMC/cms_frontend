"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [status, setStatus] =
    useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch(`${API_BASE_URL}/userAuth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Something went wrong.");
      }

      setStatus("success");
      // go directly to reset page with email in URL
      router.push(
        `/teacher/reset-password?email=${encodeURIComponent(email)}`
      );
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Failed to send reset code.");
    }
  }

  const isLoading = status === "loading";

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="w-full max-w-md sm:max-w-lg bg-white rounded-2xl shadow-md sm:shadow-lg p-5 sm:p-7 md:p-8 space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-slate-900">
            Forgot Password
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Enter your email and we&apos;ll send you a 6-digit reset code.
          </p>
        </div>

        <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              placeholder="you@example.com"
            />
          </div>

          {message && (
            <p
              className={`text-xs sm:text-sm ${
                status === "success" ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm sm:text-base font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? "Sending code..." : "Send reset code"}
          </button>
        </form>

        <div className="text-center text-xs sm:text-sm text-slate-600 space-x-1">
          <span>Remember your password?</span>
          <Link
            href="/teacher/login"
            className="font-medium text-sky-600 hover:underline"
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
