"use client";

import Image from "next/image";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Loader2, Mail, Shield, User2 } from "lucide-react";
import { useUser } from "../studentContext";

/** ======== Config & helpers ======== */
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL|| "http://localhost:5000";
const EP = {
  announcementList: `${API_BASE}/announcement`,
};
const LAST_SEEN_KEY = "student_notif_last_seen";

const getToken = (): string =>
  (typeof window !== "undefined" &&
    (localStorage.getItem("token_student") ||
      sessionStorage.getItem("token_student"))) ||
  "";

/** ======== Types ======== */
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

type AnnLite = {
  _id: string;
  createdAt?: string | null;
  publishAt?: string | null;
  published?: boolean;
  myState?: { archived?: boolean; readAt?: string | null };
};

export default function Navbarteacher() {
  const { user } = useUser();
  const router = useRouter();

  const [openProfile, setOpenProfile] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [details, setDetails] = useState<UserDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  // hover-intent timer so the popover doesn't close when traversing the gap
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- NEW: announcement badge state ---
  const [newCount, setNewCount] = useState(0);
  const [lastSeen, setLastSeen] = useState<string>("");

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
    if (!user?._id && !user?.id) return;
    if (details || loadingProfile) return;
    try {
      setError(null);
      setLoadingProfile(true);
      const res = await fetch(
        `${API_BASE}/user-api/student/${user?._id || user?.id}`,
        {
          headers: { Authorization: `Bearer ${getToken()}` },
          cache: "no-store",
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          json?.error || json?.message || "Failed to fetch profile"
        );
      setDetails((json?.user as UserDoc) || (json as UserDoc));
    } catch (e: any) {
      setError(e?.message || "Failed to load profile");
    } finally {
      setLoadingProfile(false);
    }
  }

  const openWithData = () => {
    if (!openProfile) setOpenProfile(true);
    void ensureDetailsLoaded();
  };

  const handleEnter = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    openWithData();
  };

  const handleLeave = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenProfile(false), 120);
  };

  // ======== NEW: Fetch & compute new announcements count ========
  const refreshNewCount = async (seenIso: string) => {
    try {
      const token = getToken();
      if (!token) {
        setNewCount(0);
        return;
      }
      const qs = new URLSearchParams({
        page: "1",
        limit: "200", // pull a decent chunk; server filters to visible items for students
      }).toString();

      const res = await fetch(`${EP.announcementList}?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const json = await res.json().catch(() => ({}));
      const items: AnnLite[] = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json)
        ? json
        : [];

      const seenTs = seenIso ? Date.parse(seenIso) : 0;

      // Count announcements that are not archived and created/published after last seen.
      // For students, the list already respects visibility (published & within time window).
      const count = items.reduce((acc, a) => {
        if (a?.myState?.archived) return acc;
        const t = Date.parse(a.publishAt || a.createdAt || "");
        if (!Number.isFinite(t)) return acc;
        return t > seenTs ? acc + 1 : acc;
        // If you prefer "unread" instead of "new since visit", swap for:
        // return !a?.myState?.readAt && !a?.myState?.archived ? acc + 1 : acc;
      }, 0);

      setNewCount(count > 999 ? 999 : count);
    } catch {
      // On error, don't break the UI
      setNewCount(0);
    }
  };

  // Load last seen & compute on mount
  useEffect(() => {
    const seen =
      (typeof window !== "undefined" && localStorage.getItem(LAST_SEEN_KEY)) ||
      "";
    setLastSeen(seen || "");
    void refreshNewCount(seen || "");
  }, []);

  // Recompute when window regains focus (helpful if new items appear)
  useEffect(() => {
    const onFocus = () => void refreshNewCount(lastSeen);
    if (typeof window !== "undefined") {
      window.addEventListener("focus", onFocus);
      return () => window.removeEventListener("focus", onFocus);
    }
  }, [lastSeen]);

  // Keep in sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LAST_SEEN_KEY) {
        const seen = e.newValue || "";
        setLastSeen(seen);
        void refreshNewCount(seen);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }
  }, []);

  const goToNotifications = () => {
    const nowIso = new Date().toISOString();
    if (typeof window !== "undefined") {
      localStorage.setItem(LAST_SEEN_KEY, nowIso);
    }
    setLastSeen(nowIso);
    setNewCount(0); // immediately zero the badge per your requirement
    router.push("/student/dashboard/notification");
  };

  return (
    <div className="fixed top-0 left-0 w-full z-50 flex items-center py-4 px-4 bg-[#2E3094] gap-4">
      <button
        type="button"
        onClick={() => router.push("/student/dashboard")}
        aria-label="Go to home dashboard"
        title="Go to home dashboard"
      >
        <Image
          src="/images/gpkoiralalogo.svg"
          width={60}
          height={60}
          alt="logo"
          className="cursor-pointer"
          priority
        />
      </button>
      {user && (
        <span className="text-white/90 font-medium whitespace-nowrap">
          Welcome, {user.username}!
        </span>
      )}

      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Notifications with badge positioned at top-right of bell */}
        <div className="relative">
          <button
            type="button"
            className="p-2 rounded-full hover:bg-white/10 text-white transition"
            aria-label="Notifications"
            title="Notifications"
            onClick={goToNotifications}
          >
            <Bell className="h-5 w-5" />
          </button>
          {newCount > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] text-[10px] leading-none px-1 py-0.5 rounded-full bg-red-500 text-white font-semibold select-none flex items-center justify-center"
              aria-label={`${newCount} new announcements`}
              title={`${newCount} new announcements`}
            >
              {newCount > 99 ? "99+" : newCount}
            </span>
          )}
        </div>

        {/* Profile popover */}
        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full hover:bg-white/10 text-white transition"
            aria-haspopup="dialog"
            aria-expanded={openProfile}
            title="Profile"
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            onFocus={handleEnter}
            onBlur={handleLeave}
            onClick={() =>
              openProfile ? setOpenProfile(false) : openWithData()
            }
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
            <div
              className="absolute right-0 top-full translate-y-2 w-80 rounded-xl bg-white shadow-xl border border-gray-200 overflow-hidden"
              role="dialog"
              tabIndex={-1}
              onMouseEnter={handleEnter}
              onMouseLeave={handleLeave}
              onFocus={handleEnter}
              onBlur={handleLeave}
            >
              {/* Header */}
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
                    <Row
                      label="Role"
                      value={details?.role || user?.role || "student"}
                    />
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
                        Secure account • signed in as student
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-end gap-2">
                <button
                  onClick={() => router.push(`/student/dashboard/myProfile`)}
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
