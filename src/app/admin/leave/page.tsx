"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Filter,
  RefreshCw,
  Mail,
  User2,
  CalendarDays,
  Clock,
  Info,
} from "lucide-react";
import { LeaveItem } from "../types/type.leave";

// Shared filters used across component & self-tests
export type RoleFilter = "all" | "teacher" | "student";
export type StatusFilter = "pending" | "approved" | "rejected" | "cancelled" | "all";

/** Build admin list URL for any status (pending uses legacy endpoint). */
export function buildAdminListUrl(base: string, role: RoleFilter, status: StatusFilter): string {
  // Normalize base without trailing slash
  const b = (base || "").replace(/\/$/, "");
  if (status === "pending") {
    const qs = role === "all" ? "" : `?role=${role}`;
    return `${b}/admin/pending${qs}`;
  }
  const params = new URLSearchParams();
  if (role !== "all") params.set("role", role);
  if (status !== "all") params.set("status", status);
  return `${b}/admin/requests${params.toString() ? `?${params.toString()}` : ""}`;
}

/* --------------------------- utilities --------------------------- */

/** Safely read a backend base URL without throwing in browsers when `process` is undefined. */
function getBackendBase(): string {
  // 1) Environment (if Next inlines it or `process` exists)
  const envBase =
    typeof process !== "undefined" && (process as any).env
      ? (process as any).env.NEXT_PUBLIC_BACKEND_URL
      : undefined;

  // 2) window-injected global (optional: set `window.__BACKEND_URL__` in _document or a script)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const winBase: string | undefined = typeof window !== "undefined" ? (window as any).__BACKEND_URL__ : undefined;

  // 3) <meta name="backend-url" content="https://api.example.com"/>
  const metaBase: string | null =
    typeof document !== "undefined"
      ? document.querySelector('meta[name="backend-url"]')?.getAttribute("content") || null
      : null;

  const chosen = (envBase || winBase || metaBase || "").toString().trim();
  return chosen.replace(/\/$/, "");
}

function getApiBase(backendBase: string): string {
  return backendBase ? `${backendBase}/leave` : "/leave"; // fallback to same-origin path
}

function getAuthToken(): string | null {
  const candidates = [
    "token",
    "authToken",
    "admin_token",
    "teacher_token",
    "token_admin",
    "CMS_token",
    "token_student",
  ];
  for (const k of candidates) {
    const v = typeof window !== "undefined" ? localStorage.getItem(k) : null;
    if (v) return v;
  }
  return null;
}

/**
 * Return a concrete `Headers` object (avoids TS union issues with optional `Authorization`).
 */
function authHeaders(): Headers {
  const h = new Headers({ "Content-Type": "application/json" });
  const t = getAuthToken();
  if (t) h.set("Authorization", `Bearer ${t}`);
  return h;
}

function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

function dayPartLabel(p: LeaveItem["dayPart"]) {
  if (p === "first_half") return "First Half";
  if (p === "second_half") return "Second Half";
  return "Full Day";
}

function typeLabel(t: string) {
  const map: Record<string, string> = {
    sick: "Sick Leave",
    emergency: "Emergency Leave",
    function: "Function/Program",
    puja: "Puja/Worship",
    personal: "Personal Work",
    other: "Other",
  };
  return map[t] || t;
}

function statusBadge(s: LeaveItem["status"]) {
  const cfg: Record<LeaveItem["status"], { bg: string; text: string; ring: string }> = {
    pending: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200" },
    approved: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
    rejected: { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-200" },
    cancelled: { bg: "bg-zinc-50", text: "text-zinc-700", ring: "ring-zinc-200" },
  };
  const c = cfg[s];
  return (
    <span
      className={classNames(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
        c.bg,
        c.text,
        c.ring
      )}
    >
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

/* ---------------------------- components ---------------------------- */

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 p-10 text-center">
      <CalendarDays className="h-8 w-8 text-zinc-400" />
      <p className="mt-3 text-sm text-zinc-600">{text}</p>
    </div>
  );
}

function InlineToast({ kind = "info", message }: { kind?: "info" | "success" | "error"; message: string }) {
  const styles = {
    info: "bg-blue-50 text-blue-700 ring-blue-200",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    error: "bg-rose-50 text-rose-700 ring-rose-200",
  } as const;
  return (
    <div className={classNames("mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1", styles[kind])}>
      {kind === "success" ? <CheckCircle2 className="h-4 w-4" /> : kind === "error" ? <XCircle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
      <span>{message}</span>
    </div>
  );
}

function ConfirmRejectModal({
  open,
  onClose,
  onConfirm,
  defaultReason,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  defaultReason?: string;
}) {
  const [value, setValue] = useState<string>(defaultReason || "");
  useEffect(() => {
    setValue(defaultReason || "");
  }, [defaultReason, open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold">Reject Request</h3>
        <p className="mt-1 text-sm text-zinc-600">Please provide a short reason. This will be emailed to the requester.</p>
        <textarea
          className="mt-3 w-full rounded-lg border border-zinc-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
          rows={4}
          placeholder="e.g., Not enough prior notice; classes need coverage."
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50">Cancel</button>
          <button
            onClick={() => onConfirm(value.trim())}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
          >
            <XCircle className="h-4 w-4" /> Reject
          </button>
        </div>
      </div>
    </div>
  );
}

function DiagnosticsBar({ apiBase, tokenPresent }: { apiBase: string; tokenPresent: boolean }) {
  const [show, setShow] = useState<boolean>(false);
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const fromQuery = params.get("debug") === "1";
    const fromLs = typeof window !== "undefined" && localStorage.getItem("admin_debug") === "1";
    setShow(Boolean(fromQuery || fromLs));
  }, []);
  if (!show) return null;
  return (
    <div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
      <div className="font-medium">Diagnostics</div>
      <div className="mt-1">API Base: <code className="font-mono">{apiBase}</code></div>
      <div>Auth Token Present: {tokenPresent ? "yes" : "no"}</div>
      <div className="mt-1 text-amber-700">Tip: set <code>window.__BACKEND_URL__</code> or a <code>&lt;meta name="backend-url"&gt;</code> if you can't use env vars in the browser.</div>
    </div>
  );
}

/* ------------------------------ page ------------------------------ */

export default function AdminLeavePage() {
  const backendBase = useMemo(() => getBackendBase(), []);
  const API_BASE = useMemo(() => getApiBase(backendBase), [backendBase]);
  const headers = useMemo(() => authHeaders(), []); // Headers object (no TS union issues)

  const [roleFilter, setRoleFilter] = useState<"all" | "teacher" | "student">("all");
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "cancelled" | "all">("pending");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [items, setItems] = useState<LeaveItem[]>([]);
  const [toast, setToast] = useState<{ kind: "info" | "success" | "error"; message: string } | null>(null);

  // Reject modal state
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectDefault, setRejectDefault] = useState<string>("");

  async function fetchRequests() {
    setLoading(true);
    setError("");
    try {
      const url = buildAdminListUrl(API_BASE, roleFilter, statusFilter);
      const res = await fetch(url, { headers, cache: "no-store" });
      if (!res.ok) {
        // If backend doesn't have /admin/requests yet, soft-fallback for approved/rejected to empty state
        if (statusFilter !== "pending" && res.status === 404) {
          setItems([]);
          setToast({ kind: "info", message: "History endpoint not found — pending still works." });
        } else {
          throw new Error(`Failed to load (${res.status})`);
        }
      } else {
        const json = await res.json();
        setItems(json.items || []);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runSelfTests();
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, statusFilter, API_BASE]);

  function onApproveLocal(id: string) {
    setItems((prev) => prev.filter((x) => x._id !== id));
    setToast({ kind: "success", message: "Request approved" });
  }
  function onRejectLocal(id: string) {
    setItems((prev) => prev.filter((x) => x._id !== id));
    setToast({ kind: "success", message: "Request rejected" });
  }

  async function approve(id: string) {
    try {
      const res = await fetch(`${API_BASE}/admin/${id}/approve`, { method: "PATCH", headers });
      if (!res.ok) throw new Error("Approve failed");
      onApproveLocal(id);
    } catch (e: any) {
      setToast({ kind: "error", message: e.message || "Approve failed" });
    }
  }

  async function reject(id: string, reason: string) {
    if (!reason) {
      setToast({ kind: "error", message: "Rejection reason is required" });
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/${id}/reject`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Reject failed");
      onRejectLocal(id);
    } catch (e: any) {
      setToast({ kind: "error", message: e.message || "Reject failed" });
    }
  }

  const tokenPresent = useMemo(() => !!getAuthToken(), []);

  const statusTabs = [
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "cancelled", label: "Cancelled" },
  ] as const;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Leave Requests</h1>
          <p className="mt-1 text-sm text-zinc-600">Admin view: filter by role & status.</p>
          {toast && <InlineToast kind={toast.kind} message={toast.message} />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Role filter */}
          <div className="inline-flex overflow-hidden rounded-lg ring-1 ring-zinc-200">
            {([
              { key: "all", label: "All" },
              { key: "teacher", label: "Teachers" },
              { key: "student", label: "Students" },
            ] as const).map((b, i) => (
              <button
                key={b.key}
                className={classNames(
                  "px-3 py-1.5 text-sm",
                  roleFilter === (b.key as any) ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50",
                  i !== 0 && "border-l border-zinc-200"
                )}
                onClick={() => setRoleFilter(b.key as any)}
              >
                <Filter className="mr-1 inline h-3.5 w-3.5" /> {b.label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="inline-flex overflow-hidden rounded-lg ring-1 ring-zinc-200">
            {statusTabs.map((b, i) => (
              <button
                key={b.key}
                className={classNames(
                  "px-3 py-1.5 text-sm",
                  statusFilter === (b.key as any) ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50",
                  i !== 0 && "border-l border-zinc-200"
                )}
                onClick={() => setStatusFilter(b.key as any)}
              >
                {b.label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchRequests}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            <RefreshCw className={classNames("h-4 w-4", loading && "animate-spin")} /> Refresh
          </button>
        </div>
      </div>

      <DiagnosticsBar apiBase={API_BASE} tokenPresent={tokenPresent} />

      <section className="rounded-xl border border-zinc-200 bg-white">
        <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div className="text-sm text-zinc-600">Showing <span className="font-medium text-zinc-900">{items.length}</span> {statusFilter} request(s)</div>
        </header>

        {error && (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center gap-3 p-6 text-zinc-600"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-6"><EmptyState text={`No ${statusFilter} requests found.`} /></div>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {items.map((it) => (
              <li key={it._id} className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[1.6fr_1fr_1fr_1fr_auto] md:items-center">
                {/* Who */}
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-zinc-100 text-zinc-700">
                    <User2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium text-zinc-900">{it.user?.username || "Unknown User"}</div>
                    <div className="flex items-center gap-2 text-xs text-zinc-600">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{it.user?.email || "—"}</span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-600">Role: <span className="font-medium">{it.role}</span></div>
                  </div>
                </div>

                {/* Date */}
                <div className="text-sm">
                  <div className="flex items-center gap-2 font-medium text-zinc-900"><CalendarDays className="h-4 w-4" /> {it.leaveDate}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-600"><Clock className="h-3.5 w-3.5" /> {dayPartLabel(it.dayPart)}</div>
                </div>

                {/* Type & Status */}
                <div className="text-sm">
                  <div className="font-medium text-zinc-900">{typeLabel(it.type)}</div>
                  <div className="mt-0.5 text-xs text-zinc-600">{statusBadge(it.status)}</div>
                </div>

                {/* Reason / Moderation info */}
                <div className="text-sm">
                  {it.status === "rejected" && it.rejectionReason ? (
                    <div className="text-zinc-700"><span className="font-medium">Reason:</span> {it.rejectionReason}</div>
                  ) : (
                    <div className="line-clamp-3 text-zinc-700">{it.reason || <span className="italic text-zinc-400">No reason provided</span>}</div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-start gap-2 md:justify-end">
                  {statusFilter === "pending" ? (
                    <>
                      <button
                        onClick={() => approve(it._id)}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Approve
                      </button>
                      <button
                        onClick={() => {
                          setRejectId(it._id);
                          setRejectDefault("");
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
                      >
                        <XCircle className="h-4 w-4" /> Reject
                      </button>
                    </>
                  ) : (
                    <div className="text-xs italic text-zinc-500">No actions for {statusFilter} items</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmRejectModal
        open={!!rejectId}
        defaultReason={rejectDefault}
        onClose={() => setRejectId(null)}
        onConfirm={(reason) => {
          if (!rejectId) return;
          const id = rejectId;
          setRejectId(null);
          reject(id, reason);
        }}
      />
    </main>
  );
}

/* ---------------------------- self tests ---------------------------- */

function runSelfTests() {
  try {
    const isProd = typeof process !== "undefined" && (process as any).env && (process as any).env.NODE_ENV === "production";
    if (isProd) return;

    const tests: { name: string; pass: boolean; info?: string }[] = [];

    // Env guards
    let envOk = true; try { void (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_BACKEND_URL); } catch { envOk = false; }
    tests.push({ name: "safe env access", pass: envOk });

    const bb = getBackendBase();
    tests.push({ name: "getBackendBase string", pass: typeof bb === "string", info: bb });

    const api = getApiBase(bb);
    tests.push({ name: "API base formatted", pass: typeof api === "string" && (api === "/leave" || /\/leave$/.test(api)), info: api });

    const h = authHeaders();
    tests.push({ name: "headers has content-type", pass: h.has("Content-Type") || h.has("content-type") });

    // New tests: URL builder for each status
    const roles: ("all"|"teacher"|"student")[] = ["all","teacher","student"];
    const statuses: ("pending"|"approved"|"rejected"|"cancelled"|"all")[] = ["pending","approved","rejected","cancelled","all"];
    const built: string[] = [];
    for (const r of roles) for (const s of statuses) built.push(buildAdminListUrl(api, r, s));
    const allStrings = built.every((u) => typeof u === "string" && u.length > 0);
    const hasPending = built.some((u) => /\/admin\/pending/.test(u));
    const hasRequests = built.some((u) => /\/admin\/requests/.test(u));
    tests.push({ name: "url builder returns strings", pass: allStrings });
    tests.push({ name: "url builder covers pending", pass: hasPending });
    tests.push({ name: "url builder covers requests", pass: hasRequests });

    if (typeof console !== "undefined") {
      // eslint-disable-next-line no-console
      console.table(tests);
    }
  } catch {
    // swallow
  }

  
}
