"use client";

import { useState, FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

type LoginResponse = {
  message: string;
  token?: string;
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
};

export default function TeacherLogin() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [remember, setRemember] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    const baseurl = process.env.NEXT_PUBLIC_BACKEND_URL;

    try {
      const res = await fetch(`${baseurl}/userAuth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, role: "teacher" }),
      });

      const data: LoginResponse = await res.json();

      if (!res.ok) {
        setError(data.message || "Login failed");
      } else {
        setSuccess("Login successful");
        if (data.token) {
          // Remember me logic
          if (remember) {
            localStorage.setItem("token", data.token);       // persists after browser close
          } else {
            sessionStorage.setItem("token", data.token);     // session-only, gone after close
          }
        }
        window.location.href = "/teacher/dashboard";
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#2E3094] to-[#F9D92F] relative">
      {/* Top-left logo and college info */}
      <div className="absolute top-7 left-10 flex items-center gap-4">
        <Image
          src="/images/gpkoiralalogo.svg" // or "/college-logo.png" if you use another location
          alt="College Logo"
          width={70}
          height={70}
          className="rounded-full shadow-md bg-white"
        />
        <div>
          <div className="text-xl md:text-2xl font-semibold text-white drop-shadow-md leading-tight">
            G.P.Koirala Memorial <br /> College
          </div>
          <div className="text-sm text-white/90 mt-1">Sifal , Kathmandu</div>
        </div>
      </div>

      {/* Centered Login Form */}
      <div className="flex flex-1 items-center justify-center">
        <form
          onSubmit={handleSubmit}
          className="bg-white/10 backdrop-blur-sm px-12 py-10 rounded-2xl shadow-2xl w-full max-w-md flex flex-col items-center"
        >
          {/* User Icon */}
          <div className="bg-gradient-to-br from-[#41ead4] to-[#2d9fff] p-2 rounded-full shadow-lg mb-8">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" width={100} height={100} viewBox="0 0 24 24" stroke="white">
              <circle cx="12" cy="8" r="4" stroke="white" strokeWidth="2" />
              <path d="M4 20c0-4 8-4 8-4s8 0 8 4" stroke="white" strokeWidth="2" />
            </svg>
          </div>

          {/* Username */}
          <div className="w-full mb-6">
            <input
              type="email"
              id="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Username"
              className="w-full text-lg px-2 py-3 bg-transparent text-center border-0 border-b-2 border-white focus:border-white focus:outline-none text-white placeholder-white/80 transition"
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
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full text-lg px-2 py-3 bg-transparent text-center border-0 border-b-2 border-white focus:border-white focus:outline-none text-white placeholder-white/80 transition"
              required
              autoComplete="current-password"
              style={{ letterSpacing: 1 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 hover:text-yellow-400 "
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
            </button>
          </div>

          {/* Error / Success */}
          {error && <p className="text-red-300 text-sm mb-2">{error}</p>}
          {success && <p className="text-green-200 text-sm mb-2">{success}</p>}

          {/* Remember me + Login button */}
          <div className="w-full flex items-center justify-between mb-3">
            <label className="flex items-center text-white text-sm gap-2 select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="accent-blue-500"
              />
              Remember me
            </label>
            <button
              type="submit"
              className="px-8 py-2 rounded-full bg-[#2E3094] text-white text-base font-semibold shadow hover:bg-[#201f74] transition-all"
              disabled={loading}
            >
              {loading ? "Logging in as teacher" : "Login"}
            </button>
          </div>
          <div>
            <p className="text-white/80 text-sm">
              <Link href="/teacher/forgot-password">
                Forgot password?
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
