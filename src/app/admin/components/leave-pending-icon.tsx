"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange } from "lucide-react";

/* ---------- safe helpers (no top-level process usage) ---------- */
function getBackendBase(): string {
  const envBase =
    typeof process !== "undefined" && (process as any).env
      ? (process as any).env.NEXT_PUBLIC_BACKEND_URL
      : undefined;
  // ts-expect-error optional window injection
  const winBase: string | undefined = typeof window !== "undefined" ? (window as any).__BACKEND_URL__ : undefined;
  const metaBase: string | null =
    typeof document !== "undefined"
      ? document.querySelector('meta[name="backend-url"]')?.getAttribute("content") || null
      : null;
  const chosen = (envBase || winBase || metaBase || "").toString().trim();
  return chosen.replace(/\/$/, "");
}
function getApiBase(base: string) {
  return base ? `${base}/leave` : "/leave";
}
function getAuthToken(): string | null {
  const keys = ["token", "authToken", "admin_token", "teacher_token", "token_admin", "CMS_token", "token_student"];
  for (const k of keys) {
    const v = typeof window !== "undefined" ? localStorage.getItem(k) : null;
    if (v) return v;
  }
  return null;
}
function authHeaders(): Headers {
  const h = new Headers({ "Content-Type": "application/json" });
  const t = getAuthToken();
  if (t) h.set("Authorization", `Bearer ${t}`);
  return h;
}

/* ---------- icon with badge ---------- */
export function LeavePendingIcon({
  className = "h-5 w-5",
  role = "all",            // "all" | "teacher" | "student"
  pollMs = 60000,          // refresh every 60s
  max = 99,                // clamp to "99+"
  showZero = false,        // if true, shows a small dot when count === 0
}: {
  className?: string;
  role?: "all" | "teacher" | "student";
  pollMs?: number;
  max?: number;
  showZero?: boolean;
}) {
  const API_BASE = useMemo(() => getApiBase(getBackendBase()), []);
  const headers = useMemo(() => authHeaders(), []);
  const [count, setCount] = useState<number>(0);

  async function fetchCount() {
    try {
      const qs = role === "all" ? "" : `?role=${role}`;
      // Preferred lightweight endpoint
      let res = await fetch(`${API_BASE}/admin/pending/count${qs}`, { headers, cache: "no-store" });
      if (!res.ok && res.status === 404) {
        // Fallback to list length if /count not implemented yet
        res = await fetch(`${API_BASE}/admin/pending${qs}`, { headers, cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          setCount(Array.isArray(json?.items) ? json.items.length : 0);
          return;
        }
      }
      if (res.ok) {
        const json = await res.json();
        setCount(Number(json?.count) || 0);
      }
    } catch {
      // keep last count
    }
  }

  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, pollMs);

    // live refresh when admin approves/rejects inside the page
    const onChanged = () => fetchCount();
    if (typeof window !== "undefined") {
      window.addEventListener("leave:pending-changed", onChanged);
    }
    return () => {
      clearInterval(id);
      if (typeof window !== "undefined") {
        window.removeEventListener("leave:pending-changed", onChanged);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE, role, pollMs]);

  const showBadge = showZero ? count >= 0 : count > 0;
  const label = count > max ? `${max}+` : String(count);

  return (
    <span className="relative inline-flex">
      <CalendarRange className={className} />
      {showBadge && (
        <span
          className="
            absolute -top-1.5 -right-1.5 min-w-[18px] px-1.5 py-[2px]
            rounded-full bg-rose-600 text-white text-[10px] leading-none
            font-semibold text-center shadow-sm
          "
          aria-label={`${count} pending leave request${count === 1 ? "" : "s"}`}
        >
          {count > 0 ? label : ""}
        </span>
      )}
    </span>
  );
}
