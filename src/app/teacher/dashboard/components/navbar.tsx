"use client";

import Image from "next/image";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Loader2, Mail, Shield, User2 } from "lucide-react";
import { useUser } from "../teacherContext";

/** ======== Config & helpers (same as profile page should use) ======== */
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

const getToken = (): string =>
  (typeof window !== "undefined" &&
    (localStorage.getItem("token_teacher") ||
      sessionStorage.getItem("token_teacher"))) ||
  "";

/** ======== Types (optional but nice) ======== */
type Role = "student" | "teacher" | "admin" | "superadmin";
type UserDoc = {
  _id?: string;
  id?: string;
  username: string;
  email: string;
  role: Role;
  isActive?: boolean;
  isVerified?: boolean;
  department?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function Navbarteacher() {
  const { user } = useUser();
  const router = useRouter();

  const [openProfile, setOpenProfile] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [details, setDetails] = useState<UserDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  // initials for avatar
  const initials = useMemo(() => {
    const n = user?.username || "";
    return n
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("");
  }, [user]);

  async function ensureDetailsLoaded() {
    if (!user?._id || details || loadingProfile) return;
    try {
      setError(null);
      setLoadingProfile(true);
      const res = await fetch(`${API_BASE}/user-api/teacher/${user._id || user?.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.message || "Failed to fetch profile");
      setDetails((json?.user as UserDoc) || (json as UserDoc));
    } catch (e: any) {
      setError(e?.message || "Failed to load profile");
    } finally {
      setLoadingProfile(false);
    }
  }

  return (
    <div className="fixed top-0 left-0 w-full z-50 flex items-center py-4 px-4 bg-[#2E3094] gap-4">
      <Image src="/images/gpkoiralalogo.svg" width={60} height={60} alt="logo" />

      {/* welcome (optional) */}
      {user && (
        <span className="text-white/90 font-medium whitespace-nowrap">
          Welcome, {user.username}!
        </span>
      )}

      {/* spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Notifications (stub – you’ll wire this later) */}
        <button
          type="button"
          className="relative p-2 rounded-full hover:bg-white/10 text-white transition"
          aria-label="Notifications"
          title="Notifications"
          onClick={()=>router.push("/teacher/dashboard/notification")}
        >
          <Bell className="h-5 w-5" />
          {/* Example unread dot:
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-red-500 rounded-full" />
          */}
        </button>

        {/* Profile popover */}
        <div
          className="relative"
          onMouseEnter={() => {
            setOpenProfile(true);
            void ensureDetailsLoaded();
          }}
          onMouseLeave={() => setOpenProfile(false)}
        >
          <button
            type="button"
            className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full hover:bg-white/10 text-white transition"
            aria-haspopup="dialog"
            aria-expanded={openProfile}
            title="Profile"
          >
            <div className="h-8 w-8 rounded-full bg-white/20 grid place-items-center overflow-hidden">
              {initials ? (
                <span className="text-sm font-semibold">{initials}</span>
              ) : (
                <User2 className="h-5 w-5" />
              )}
            </div>
            <span className="hidden sm:block text-sm font-medium">
              {user?.username || "Profile"}
            </span>
          </button>

          {openProfile && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white shadow-xl border border-gray-200 overflow-hidden">
              {/* Header row */}
              <div className="px-4 py-3 bg-gray-50 border-b">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-indigo-600 text-white grid place-items-center">
                    {initials ? (
                      <span className="text-sm font-semibold">{initials}</span>
                    ) : (
                      <User2 className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">
                      {details?.username || user?.username || "—"}
                    </div>
                    <div className="text-xs text-gray-600 truncate flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {details?.email || user?.email || "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="px-4 py-3 space-y-1 text-sm">
                {loadingProfile ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : error ? (
                  <div className="text-red-600">{error}</div>
                ) : (
                  <>
                    <Row label="Role" value={details?.role || user?.role || "teacher"} />
                    {/* <Row label="User ID" value={details?._id || user?._id || "—"} mono /> */}
                    {details?.department && (
                      <Row label="Department" value={details.department} />
                    )}
                    {typeof details?.isVerified === "boolean" && (
                      <Row
                        label="Verified"
                        value={details.isVerified ? "Yes" : "No"}
                      />
                    )}
                    {details?.createdAt && (
                      <Row
                        label="Joined"
                        value={new Date(details.createdAt).toLocaleDateString()}
                      />
                    )}
                    <div className="flex items-center gap-2 pt-1 text-gray-600">
                      <Shield className="h-4 w-4" />
                      <span className="text-xs">
                        Secure account • signed in as teacher
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Footer actions */}
              <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-end gap-2">
                <button
                  onClick={() => router.push(`/teacher/dashboard/myProfile`)} // adjust route if different
                  className="px-3 py-1.5 rounded-lg bg-[#2E3094] text-white text-sm hover:opacity-90"
                >
                  View Profile
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Small row renderer for popover */
function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-24 text-gray-500">{label}</span>
      <span
        className={`flex-1 ${
          mono ? "font-mono text-[12px]" : ""
        } text-gray-800 truncate`}
      >
        {value}
      </span>
    </div>
  );
}
