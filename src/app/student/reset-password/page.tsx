"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const emailFromUrl = searchParams?.get("email") ?? "";
  const [email, setEmail] = useState(emailFromUrl);

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [status, setStatus] =
    useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    if (!email) {
      setStatus("error");
      setMessage("Email is missing. Go back and request a new code.");
      return;
    }

    if (!code.trim()) {
      setStatus("error");
      setMessage("Please enter the reset code.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setStatus("error");
      setMessage("Password must be at least 6 characters long.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/userAuth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Something went wrong.");
      }

      setStatus("success");
      setMessage(
        data.message || "Password reset successfully. You can log in now."
      );

      setCode("");
      setNewPassword("");
      setConfirmPassword("");

      router.push("/");
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Failed to reset password.");
    }
  }

  const isLoading = status === "loading";

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="w-full max-w-md sm:max-w-lg bg-white rounded-2xl shadow-md sm:shadow-lg p-5 sm:p-7 md:p-8 space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-slate-900">
            Reset Password
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Enter the 6-digit code you received, then choose a new password.
          </p>
        </div>

        {/* Show which email we are resetting for */}
        {email ? (
          <p className="text-xs sm:text-sm text-center text-slate-500">
            Resetting password for{" "}
            <span className="font-semibold text-slate-700 break-all">
              {email}
            </span>
          </p>
        ) : (
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
        )}

        <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
          {/* CODE FIRST */}
          <div className="space-y-1">
            <label
              htmlFor="code"
              className="block text-sm font-medium text-slate-700"
            >
              Reset code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 tracking-[0.35em]"
              placeholder="••••••"
            />
          </div>

          {/* New password with show/hide */}
          <div className="space-y-1">
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-slate-700"
            >
              New password
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 pr-12 py-2 text-sm sm:text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-xs sm:text-sm text-slate-500 hover:text-slate-700"
              >
                {showNewPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Confirm password with show/hide */}
          <div className="space-y-1">
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-slate-700"
            >
              Confirm new password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 pr-12 py-2 text-sm sm:text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-xs sm:text-sm text-slate-500 hover:text-slate-700"
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
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
            disabled={
              isLoading ||
              !email.trim() ||
              !code.trim() ||
              !newPassword ||
              !confirmPassword
            }
            className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm sm:text-base font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? "Resetting password..." : "Reset password"}
          </button>
        </form>

        <div className="text-center text-xs sm:text-sm text-slate-600 space-x-1">
          <span>Remember your password?</span>
          <Link href="/" className="font-medium text-sky-600 hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
