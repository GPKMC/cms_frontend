"use client";

import { useState, useEffect, FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

/* ---------- Toast ---------- */
function Toast({
  type = "info",
  message,
  onClose,
}: {
  type?: "error" | "success" | "info";
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      className={`
        fixed top-8 right-8 z-50 min-w-[260px] max-w-[350px]
        flex items-center gap-3 px-6 py-4 rounded-lg shadow-xl border
        ${
          type === "error"
            ? "bg-red-600 text-white border-red-700"
            : type === "success"
            ? "bg-green-600 text-white border-green-700"
            : "bg-blue-600 text-white border-blue-700"
        }
        animate-toast-slide-in
      `}
      style={{ animation: "toast-slide-in .4s" }}
    >
      <span className="flex-1">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-white/80 hover:text-white text-lg font-bold focus:outline-none"
        aria-label="Close"
      >
        ×
      </button>
      <style jsx>{`
        @keyframes toast-slide-in {
          0% {
            transform: translateY(-30px) scale(0.97);
            opacity: 0.1;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

/* ---------- Types ---------- */
type LoginResponse = {
  message: string;
  token?: string;
  user?: {
    id: string;
    username: string;
    email: string;
    role: "student" | "teacher" | "admin" | "superadmin";
  };
};

export default function StudentLogin() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [remember, setRemember] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingGoogle, setLoadingGoogle] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const baseurl = process.env.NEXT_PUBLIC_BACKEND_URL;

  // Auto-close toast after 5s
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError("");
        setSuccess("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`${baseurl}/userAuth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role: "student" }),
      });

      const data: LoginResponse = await res.json();

      if (!res.ok) {
        setError(data.message || "Login failed");
      } else {
        setSuccess("Login successful");
        if (data.token) {
          if (remember) localStorage.setItem("token_student", data.token);
          else sessionStorage.setItem("token_student", data.token);
        }
        setTimeout(() => {
          window.location.href = "/student/dashboard";
        }, 900);
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setLoadingGoogle(true);
    setError("");
    setSuccess("");

    // Stash “remember me” + intended fallback route so google-success can respect it
    try {
      localStorage.setItem("oauth_remember", remember ? "1" : "0");
      // default target if role cannot be fetched (rare): student dashboard
      localStorage.setItem("oauth_return", "/student/dashboard");
    } catch {
      /* ignore storage errors */
    }

    // Kick off OAuth with backend (mounted at /api/auth)
    window.location.href = `${baseurl}/api/auth/google`;
  };

  return (
    <div className="min-h-screen w-full bg-primary flex relative overflow-hidden">
      {/* Toast */}
      {(!!error || !!success) && (
        <Toast
          type={error ? "error" : "success"}
          message={error || success}
          onClose={() => {
            setError("");
            setSuccess("");
          }}
        />
      )}

      {/* Left Panel */}
      <div className="flex flex-col justify-center w-[50%] min-w-[420px] px-16 py-12 z-20">
        {/* Logo + College Name */}
        <div className="flex items-center gap-5 mb-8">
          <img
            src="/images/gpkoiralalogo.svg"
            alt="G.P.Koirala Memorial College Logo"
            className="h-20 w-20 object-contain"
          />
          <div>
            <div className="font-bold text-xl leading-5 mb-1 text-white">
              G.P.Koirala Memorial <br /> College
            </div>
            <div className="text-sm text-[#ececec] font-medium">Sifal, Kathmandu</div>
          </div>
        </div>

        {/* Login Heading */}
        <div className="mb-10">
          <h2 className="text-2xl font-semibold mb-2 text-white tracking-wide">
            Log in to your account
          </h2>
          <p className="text-white/80 text-base">Student Portal</p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className="py-10 rounded-2xl bg-transparent w-full max-w-md flex flex-col items-center"
        >
          {/* Email */}
          <div className="w-full mb-6">
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Username"
              className="w-full text-lg px-2 py-3 bg-transparent text-start border-0 border-b-2 border-white focus:border-white focus:outline-none text-white placeholder-white/80 transition"
              required
              autoComplete="username"
              style={{ letterSpacing: 1 }}
            />
          </div>

          {/* Password */}
          <div className="w-full mb-8 relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full text-lg px-2 py-3 bg-transparent text-start border-0 border-b-2 border-white focus:border-white focus:outline-none text-white placeholder-white/80 transition"
              required
              autoComplete="current-password"
              style={{ letterSpacing: 1 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute text-white right-2 top-1/2 -translate-y-1/2 hover:text-white/40 "
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
            </button>
          </div>

          {/* Remember + Submit */}
          <div className="w-full flex items-center justify-between mb-3">
            <label className="flex items-center text-white text-sm gap-2 select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="accent-blue-500"
              />
              Remember me
            </label>
            <button
              type="submit"
              className="px-8 py-2 rounded-full bg-[#F9D92F] text-white text-base font-semibold shadow hover:bg-secondary transition-all disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </div>

          <div className="w-full text-left mt-1">
            <Link href="/student/forgot-password" className="text-white/80 text-sm hover:underline">
              Forgot password?
            </Link>
          </div>
        </form>

        {/* Google login */}
        <button
          onClick={handleGoogleLogin}
          className="flex items-center justify-center mt-8 py-3 rounded-xl border-2 border-white text-white font-semibold text-lg w-full max-w-md bg-transparent hover:bg-white hover:text-[#2E2EAD] transition disabled:opacity-60"
          disabled={loadingGoogle}
        >
          <img
            src="https://www.svgrepo.com/show/475656/google-color.svg"
            alt="Google"
            className="h-7 w-7 mr-3"
          />
          {loadingGoogle ? "Redirecting…" : "Continue with Google"}
        </button>
      </div>

      {/* Right Panel */}
      <div className="hidden md:block w-[50%] min-w-[420px] h-full overflow-hidden">
        <div
          className="absolute top-20 right-[7%] h-[90%] w-[45%] bg-[#F9D92F] flex flex-col items-center justify-center"
          style={{ transform: "skewX(-20deg) skewY(10deg)" }}
        />
        <div className="absolute transform right-30 bottom-0">
          <Image
            src="/images/loginphoto.png"
            alt="Login Illustration"
            width={800}
            height={600}
            className="max-w-full h-auto object-contain"
          />
        </div>
      </div>
    </div>
  );
}
