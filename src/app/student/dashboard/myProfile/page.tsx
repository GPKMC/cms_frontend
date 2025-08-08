"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User as UserIcon,
  Mail,
  Shield,
  GraduationCap,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Calendar,
  MapPin,
  Settings,
  Bell,
} from "lucide-react";
import { useUser } from "../studentContext";

/* =======================
   Types
======================= */
type Role = "student" | "teacher" | "admin" | "superadmin";
type BatchRef = { _id: string; batchname?: string } | string | null | undefined;

type UserDoc = {
  _id?: string;
  id?: string;
  username: string;
  email: string;
  role: Role;
  isActive?: boolean;
  isVerified?: boolean;
  batch?: BatchRef; // for students
  createdAt?: string;
  updatedAt?: string;
};

/* =======================
   Helpers
======================= */
const PASSWORD_HINT =
  "Must start with an uppercase letter, contain at least one number, one special character, and be 7+ characters.";
const passwordRegex = /^[A-Z](?=.*\d)(?=.*[@#$%^&+=!*]).{6,}$/;

function getUserId(u?: { _id?: string; id?: string } | null) {
  return u?._id || u?.id || "";
}

/* =======================
   Page
======================= */
export default function ProfilePage() {
  const router = useRouter();
  const { user: sessionUser } = useUser(); // from your context
  const sessionUserId = getUserId(sessionUser);
  const baseurl = process.env.NEXT_PUBLIC_BACKEND_URL as string;

  const [activeTab, setActiveTab] = useState<"profile" | "security">("profile");

  // profile data
  const [user, setUser] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // show/hide
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // stay-or-logout modal
  const [showStayOrLogout, setShowStayOrLogout] = useState(false);

  // fetch own profile from your real API
  useEffect(() => {
    if (!sessionUserId) {
      setErr("No user in session. Please sign in again.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const token =
          localStorage.getItem("token_student") ||
          sessionStorage.getItem("token_student") ||
          "";

        const res = await fetch(`${baseurl}/user-api/student/${sessionUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || j?.message || "Failed to fetch profile");
        }

        const j = (await res.json()) as { user: UserDoc };
        if (!cancelled) setUser(j.user);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionUserId, baseurl]);

  const batchDisplay = useMemo(() => {
    const b = user?.batch;
    if (!b) return "-";
    if (typeof b === "string") return b;
    return b.batchname || b._id || "-";
  }, [user?.batch]);

  // change password via your real API
  const submitChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPwMessage({ type: "error", text: "Please fill in all password fields." });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPwMessage({ type: "error", text: "New password and Confirm new password do not match." });
      return;
    }
    if (!passwordRegex.test(newPassword)) {
      setPwMessage({ type: "error", text: PASSWORD_HINT });
      return;
    }

    try {
      setIsSubmitting(true);

      const token =
        localStorage.getItem("token_student") ||
        sessionStorage.getItem("token_student") ||
        "";

      const res = await fetch(`${baseurl}/user-api/users/me/password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const j = await res.json().catch(() => ({}));

      if (!res.ok) {
        setPwMessage({ type: "error", text: j?.message || j?.error || "Failed to change password." });
        return;
      }

      setPwMessage({ type: "success", text: j?.message || "Password updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");

      // open Stay / Sign out modal
      setShowStayOrLogout(true);
    } catch (e: any) {
      setPwMessage({ type: "error", text: e?.message || "Failed to change password." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const signOutNow = async () => {
    try {
      // Optionally call an API to revoke tokens here
      // const token = localStorage.getItem("token_student") || sessionStorage.getItem("token_student") || "";
      // await fetch(`${baseurl}/auth/logout-all`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });

      localStorage.removeItem("token_student");
      sessionStorage.removeItem("token_student");
    } catch {
      // ignore
    } finally {
      router.push("/");
    }
  };

  /* ===== Render ===== */
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/30 flex items-center justify-center relative overflow-hidden">
        <div className="fixed inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.1),transparent_50%)]" />
        <div className="fixed inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.08),transparent_50%)]" />
        <div className="relative z-10 flex items-center gap-4 p-8 rounded-3xl bg-white/80 backdrop-blur-sm border border-white/60 shadow-xl">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <span className="text-lg font-medium text-gray-800">Loading profile…</span>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center relative overflow-hidden">
        <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(239,68,68,0.1),transparent_70%)]" />
        <div className="relative z-10 text-center p-8 rounded-3xl bg-white/90 backdrop-blur-sm border border-red-100 shadow-xl max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 font-semibold text-lg mb-6">{err}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 text-white font-medium hover:from-red-600 hover:to-red-700 transition-all duration-300 hover:scale-105 hover:shadow-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center text-gray-600 p-8 rounded-3xl bg-white/80 backdrop-blur-sm border border-gray-200 shadow-lg">
          <div className="text-lg font-medium">No user found.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/30 relative overflow-hidden">
      {/* Background decoration */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.1),transparent_50%)]" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.08),transparent_50%)]" />
      
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        {/* top bar */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.back()}
            className="group inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/80 backdrop-blur-sm border border-white/60 text-indigo-600 hover:bg-white hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform duration-300" />
            <span className="font-medium">Back</span>
          </button>

          <div className="flex gap-2 bg-white/80 backdrop-blur-sm rounded-2xl p-1.5 border border-white/60 shadow-lg">
            <button
              onClick={() => setActiveTab("profile")}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                activeTab === "profile"
                  ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-200/50 scale-105"
                  : "text-gray-700 hover:text-indigo-600 hover:bg-indigo-50/50"
              }`}
            >
              <UserIcon className="w-4 h-4" />
              Profile
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                activeTab === "security"
                  ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-200/50 scale-105"
                  : "text-gray-700 hover:text-indigo-600 hover:bg-indigo-50/50"
              }`}
            >
              <KeyRound className="w-4 h-4" />
              Security
            </button>
          </div>
        </div>

        {/* PROFILE */}
        {activeTab === "profile" && (
          <div className="group relative overflow-hidden bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/50 rounded-3xl border border-indigo-100/50 shadow-xl p-8 transition-all duration-700 hover:shadow-2xl hover:shadow-indigo-200/20">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/3 to-purple-600/3 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-gradient-to-br from-indigo-400/10 to-purple-400/10 rounded-full blur-2xl opacity-60" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-gradient-to-tr from-purple-400/8 to-pink-400/8 rounded-full blur-3xl opacity-40" />
            
            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300">
                      <UserIcon className="w-10 h-10 text-white" />
                    </div>
                    {user.isActive && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-3 border-white shadow-lg">
                        <div className="w-full h-full bg-green-400 rounded-full animate-pulse" />
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                        My Profile
                      </h1>
                      {user.isVerified && (
                        <div className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-600 text-xs font-medium flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Verified
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">User ID: {user._id || "-"}</p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button className="p-3 rounded-xl bg-gray-100/80 hover:bg-gray-200/80 transition-all duration-300 hover:scale-105">
                    <Bell className="w-5 h-5 text-gray-600" />
                  </button>
                  <button className="p-3 rounded-xl bg-gray-100/80 hover:bg-gray-200/80 transition-all duration-300 hover:scale-105">
                    <Settings className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Profile Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {[
                  { icon: UserIcon, label: "Username", value: user.username, color: "indigo" },
                  { icon: Mail, label: "Email", value: user.email, color: "blue" },
                  { icon: Shield, label: "Role", value: user.role, color: "purple" },
                  ...(user.role === "student"
                    ? [{ icon: GraduationCap, label: "Batch", value: batchDisplay, color: "emerald" }]
                    : []),
                ].map((item, idx) => (
                  <div 
                    key={idx}
                    className="group/item relative p-6 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/80 hover:bg-white/80 transition-all duration-500 hover:scale-105 hover:shadow-lg"
                    style={{ 
                      animationDelay: `${idx * 100}ms`,
                      animation: 'slideInUp 0.6s ease-out forwards'
                    }}
                  >
                    <div className={`p-3 rounded-xl bg-${item.color}-50 border border-${item.color}-100 w-fit mb-4 group-hover/item:scale-110 transition-transform duration-300`}>
                      <item.icon className={`h-5 w-5 text-${item.color}-600`} />
                    </div>
                    <div className="text-xs uppercase tracking-wider text-gray-500 mb-2 font-medium">{item.label}</div>
                    <div className="text-gray-900 font-semibold break-all leading-relaxed">
                      {item.value}
                    </div>
                    <div className={`absolute inset-0 bg-gradient-to-r from-${item.color}-500/0 to-${item.color}-500/5 rounded-2xl opacity-0 group-hover/item:opacity-100 transition-opacity duration-300`} />
                  </div>
                ))}
              </div>

              {/* Additional Info */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-gray-50/80 to-indigo-50/80 border border-gray-200/50 backdrop-blur-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-3 text-gray-600">
                    <div className="p-2 rounded-lg bg-indigo-100">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                    </div>
                    <span>
                      Joined: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600">
                    <div className="p-2 rounded-lg bg-green-100">
                      <MapPin className="w-4 h-4 text-green-600" />
                    </div>
                    <span>Status: {user.isActive ? "Active" : "Inactive"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECURITY */}
        {activeTab === "security" && (
          <div className="group relative overflow-hidden bg-gradient-to-br from-amber-50/50 via-white to-orange-50/50 rounded-3xl border border-amber-100/50 shadow-xl p-8 transition-all duration-700 hover:shadow-2xl hover:shadow-amber-200/20">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-600/3 to-orange-600/3 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="absolute -top-6 -right-6 w-20 h-20 bg-gradient-to-br from-amber-400/10 to-orange-400/10 rounded-full blur-xl opacity-50" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200">
                  <KeyRound className="h-7 w-7 text-amber-600" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                  Change Password
                </h2>
              </div>

              <form onSubmit={submitChangePassword} className="space-y-6">
                {/* Current */}
                <div className="group/field">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      className="w-full rounded-2xl border-2 border-gray-200 px-4 py-4 pr-12 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all duration-300 bg-white/80 backdrop-blur-sm group-hover/field:bg-white text-gray-900"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                      onClick={() => setShowCurrentPassword((s) => !s)}
                    >
                      {showCurrentPassword ? <EyeOff className="w-5 h-5 text-gray-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
                    </button>
                  </div>
                </div>

                {/* New */}
                <div className="group/field">
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      className="w-full rounded-2xl border-2 border-gray-200 px-4 py-4 pr-12 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all duration-300 bg-white/80 backdrop-blur-sm group-hover/field:bg-white text-gray-900"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                      onClick={() => setShowNewPassword((s) => !s)}
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5 text-gray-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{PASSWORD_HINT}</p>
                </div>

                {/* Confirm */}
                <div className="group/field">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      className="w-full rounded-2xl border-2 border-gray-200 px-4 py-4 pr-12 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all duration-300 bg-white/80 backdrop-blur-sm group-hover/field:bg-white text-gray-900"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Re-enter new password"
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                      onClick={() => setShowConfirmPassword((s) => !s)}
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5 text-gray-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group/btn relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:from-amber-600 hover:to-orange-600 disabled:opacity-60 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-amber-200/50"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500 rounded-2xl" />
                    {isSubmitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 group-hover/btn:rotate-12 transition-transform duration-300" />
                    )}
                    <span className="relative z-10">
                      {isSubmitting ? "Updating..." : "Update Password"}
                    </span>
                  </button>

                  {pwMessage && (
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl backdrop-blur-sm border transition-all duration-300 ${
                      pwMessage.type === "success" 
                        ? "bg-green-50/80 border-green-200 text-green-700" 
                        : "bg-red-50/80 border-red-200 text-red-700"
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        pwMessage.type === "success" ? "bg-green-500" : "bg-red-500"
                      } animate-pulse`} />
                      <span className="text-sm font-medium">{pwMessage.text}</span>
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Stay signed in / Sign out now modal — matches current design */}
      {showStayOrLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Password updated
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Do you want to stay signed in, or sign out now?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowStayOrLogout(false)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Stay signed in
              </button>
              <button
                onClick={signOutNow}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700"
              >
                Sign out now
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
