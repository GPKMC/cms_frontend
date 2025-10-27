"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@/app/student/dashboard/studentContext";
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
  Info,
  Filter,
  ArrowUpDown,
} from "lucide-react";

// ===================== Types =====================

type Status = "graded" | "submitted" | "missing";

interface RowItem {
  assignmentId: string;
  title: string;
  topic: string | null;
  dueAt: string | null;
  maxPoints: number;
  my: {
    score: number | null;
    percentage: number | null; // 0..100
    status: Status;
    gradedAt: string | null;
    feedback: string | null;
  };
}

interface ListResponse {
  courseInstanceId: string;
  items: RowItem[];
  summary: { earned: number; possible: number };
  policies: { scheme: string; treatMissingAsZero: boolean };
}

interface SingleResponse {
  assignmentId: string;
  title: string;
  topic: string | null;
  dueAt: string | null;
  maxPoints: number;
  my: RowItem["my"];
}

// ===================== Helpers =====================

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || ""; // e.g., https://api.yourdomain.com

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pct(n: number) {
  if (!Number.isFinite(n)) return 0;
  const v = Math.max(0, Math.min(100, n));
  return Math.round(v * 10) / 10; // 1 decimal
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

// ===================== Small UI bits =====================

function StatusBadge({ status }: { status: Status }) {
  if (status === "graded") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-800 px-2.5 py-1 text-xs font-medium">
        <CheckCircle2 className="h-4 w-4" /> Graded
      </span>
    );
  }
  if (status === "submitted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-1 text-xs font-medium">
        <Clock className="h-4 w-4" /> Submitted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-800 px-2.5 py-1 text-xs font-medium">
      <XCircle className="h-4 w-4" /> Missing
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full">
      <div className="h-2 w-full rounded-full bg-gray-200">
        <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${v}%` }} />
      </div>
      <div className="mt-1 text-xs text-gray-600">{pct(v)}%</div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 w-40 rounded bg-gray-200" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-gray-200" /></td>
      <td className="px-4 py-3"><div className="h-4 w-28 rounded bg-gray-200" /></td>
      <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-gray-200" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-gray-200" /></td>
      <td className="px-4 py-3"><div className="h-4 w-10 rounded bg-gray-200" /></td>
    </tr>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        "inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs",
        active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-700 hover:bg-gray-50"
      )}
    >
      {children}
    </button>
  );
}

// ===================== Main Component =====================

export default function StudentAssignmentGrades() {
  // ✅ Minimal param & user usage as you asked
  const { courseInstanceId } = useParams() as { courseInstanceId?: string };
  const { user, token: ctxToken } = useUser() as any;
  const userId = user?._id || user?.id || "";

  // token from context first, then common fallbacks
  const token = useMemo(
    () =>
      ctxToken ||
      localStorage.getItem("token_student") ||
      sessionStorage.getItem("token_student") ||
      localStorage.getItem("token") ||
      "",
    [ctxToken]
  );

  // data
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [topicFilter, setTopicFilter] = useState("All topics");
  const [sortBy, setSortBy] = useState<"due" | "title" | "score">("due");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, SingleResponse | "loading" | "error">>({});

  // fetch list
useEffect(() => {
  if (!courseInstanceId || !token) return;

  const ctrl = new AbortController();
  let ignore = false;

  (async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `${BACKEND}/grade/courseInstance/${courseInstanceId}/my/assignments`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          signal: ctrl.signal,
          cache: "no-store",
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ListResponse;
      if (!ignore) setData(json);
    } catch (e: any) {
      // 👇 Ignore aborts so you don't show the red banner
      if (ctrl.signal.aborted || e?.name === "AbortError" || /aborted/i.test(e?.message)) {
        return;
      }
      setError(e?.message || "Failed to load");
    } finally {
      if (!ctrl.signal.aborted && !ignore) setLoading(false);
    }
  })();

  return () => {
    ignore = true;
    ctrl.abort("effect-cleanup"); // optional reason
  };
}, [courseInstanceId, token]);


  // derived
  const topics = useMemo(() => {
    const t = new Set<string>();
    (data?.items || []).forEach((r) => r.topic && t.add(r.topic));
    return ["All topics", ...Array.from(t)];
  }, [data]);

  const counts = useMemo(() => {
    const all = data?.items.length || 0;
    const graded = data?.items.filter((r) => r.my.status === "graded").length || 0;
    const submitted = data?.items.filter((r) => r.my.status === "submitted").length || 0;
    const missing = data?.items.filter((r) => r.my.status === "missing").length || 0;
    return { all, graded, submitted, missing };
  }, [data]);

  const processed = useMemo(() => {
    let rows = [...(data?.items || [])];
    if (statusFilter !== "all") rows = rows.filter((r) => r.my.status === statusFilter);
    if (topicFilter !== "All topics") rows = rows.filter((r) => (r.topic || "") === topicFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter((r) => r.title.toLowerCase().includes(q) || (r.topic || "").toLowerCase().includes(q));
    }
    rows.sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "score") {
        const as = a.my.score ?? -Infinity;
        const bs = b.my.score ?? -Infinity;
        return bs - as;
      }
      const da = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const db = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      return da - db;
    });
    return rows;
  }, [data, query, statusFilter, topicFilter, sortBy]);

  const overallPct = useMemo(() => {
    if (!data) return 0;
    const { earned, possible } = data.summary || { earned: 0, possible: 0 };
    return possible > 0 ? (earned / possible) * 100 : 0;
  }, [data]);

  async function toggleRow(assignmentId: string) {
    setExpanded((cur) => (cur === assignmentId ? null : assignmentId));
    if (!detail[assignmentId]) {
      setDetail((d) => ({ ...d, [assignmentId]: "loading" }));
      try {
        const res = await fetch(`${BACKEND}/grade/assignment/${assignmentId}/my`, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as SingleResponse;
        setDetail((d) => ({ ...d, [assignmentId]: json }));
      } catch (e) {
        setDetail((d) => ({ ...d, [assignmentId]: "error" }));
      }
    }
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("all");
    setTopicFilter("All topics");
    setSortBy("due");
  }

  const showing = processed.length;
  const total = data?.items.length || 0;

  // ===================== Render =====================

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Assignment Grades</h1>
          {/* <div className="mt-1 text-sm text-gray-600">
            Course Instance: <span className="font-mono">{courseInstanceId || "—"}</span>
          </div> */}
        </div>
        <div className="rounded-2xl border p-4 shadow-sm bg-white">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Info className="h-4 w-4" /> Overall Progress
          </div>
          <div className="mt-2 flex items-center gap-4">
            <div className="w-48">
              <ProgressBar value={overallPct} />
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Earned / Possible</div>
              <div className="text-sm font-medium">
                {(data?.summary.earned ?? 0).toFixed(1)} / {(data?.summary.possible ?? 0).toFixed(1)} pts
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-3 flex items-center gap-3 text-sm text-gray-700">
        <Filter className="h-4 w-4" /> Filters
        <span className="text-gray-400">|</span>
        <span>
          Showing <span className="font-medium text-gray-900">{showing}</span> of {total}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
        <div className="sm:col-span-5">
          <label className="mb-1 block text-xs font-medium text-gray-600">Search</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assignments…"
            className="w-full rounded-xl border bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="sm:col-span-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">Topic</label>
          <select
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="w-full rounded-xl border bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3">
          <label className="mb-1 block text-xs font-medium text-gray-600">Sort by</label>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full appearance-none rounded-xl border bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="due">Due date (soonest)</option>
              <option value="title">Title A→Z</option>
              <option value="score">Score (highest)</option>
            </select>
            <ArrowUpDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Status pills */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
          All ({counts.all})
        </Pill>
        <Pill active={statusFilter === "graded"} onClick={() => setStatusFilter("graded")}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Graded ({counts.graded})
        </Pill>
        <Pill active={statusFilter === "submitted"} onClick={() => setStatusFilter("submitted")}>
          <Clock className="h-3.5 w-3.5" /> Submitted ({counts.submitted})
        </Pill>
        <Pill active={statusFilter === "missing"} onClick={() => setStatusFilter("missing")}>
          <XCircle className="h-3.5 w-3.5" /> Missing ({counts.missing})
        </Pill>
        <button
          onClick={resetFilters}
          className="ml-auto inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs hover:bg-white"
        >
          <RefreshCcw className="h-3.5 w-3.5" /> Reset
        </button>
      </div>

      {/* Error / Loading */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
            <tr>
              <th className="px-4 py-3">Assignment</th>
              <th className="px-4 py-3">Topic</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3 text-right">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            )}

            {!loading && processed.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  No assignments match your filters.
                  <button
                    onClick={resetFilters}
                    className="ml-3 rounded-lg border px-3 py-1 text-xs hover:bg-white"
                  >
                    Reset filters
                  </button>
                </td>
              </tr>
            )}

            {!loading &&
              processed.map((r) => {
                const isOpen = expanded === r.assignmentId;
                return (
                  <React.Fragment key={r.assignmentId}>
                    <tr className="border-t hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{r.title}</div>
                        <div className="text-[11px] text-gray-500">Max: {r.maxPoints} pts</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{r.topic ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-700">{fmtDate(r.dueAt)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.my.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {r.my.score != null ? (
                          <div className="flex items-center gap-3">
                            <span className="font-semibold">{r.my.score}</span>
                            <span className="text-xs text-gray-500">/ {r.maxPoints}</span>
                            <span className="text-xs text-gray-600">({pct(r.my.percentage ?? 0)}%)</span>
                          </div>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => toggleRow(r.assignmentId)}
                          className="inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-medium hover:bg-white"
                        >
                          {isOpen ? (
                            <>
                              Hide <ChevronUp className="h-4 w-4" />
                            </>
                          ) : (
                            <>
                              View <ChevronDown className="h-4 w-4" />
                            </>
                          )}
                        </button>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="border-t bg-gray-50/60">
                        <td colSpan={6} className="px-6 py-4">
                          {detail[r.assignmentId] === "loading" && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Clock className="h-4 w-4 animate-spin" /> Loading details...
                            </div>
                          )}
                          {detail[r.assignmentId] === "error" && (
                            <div className="flex items-center gap-2 text-sm text-rose-700">
                              <AlertTriangle className="h-4 w-4" /> Failed to load details.
                            </div>
                          )}
                          {typeof detail[r.assignmentId] === "object" && detail[r.assignmentId] && (
                            <DetailCard data={detail[r.assignmentId] as SingleResponse} />
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Tip: status reflects your own submission/grade and only counts assignments you're eligible to see.
      </p>

      {/* no token / no user guard */}
      {!token && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm">
          Missing auth token. Ensure your student session provides a token in context or storage.
        </div>
      )}
      {!userId && (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm">
          Missing user ID. Check your student context provider.
        </div>
      )}
    </div>
  );
}

// ===================== Detail Card =====================

function DetailCard({ data }: { data: SingleResponse }) {
  const pctVal =
    data.my.percentage ?? (data.maxPoints > 0 && data.my.score != null ? (data.my.score / data.maxPoints) * 100 : 0);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="sm:col-span-2 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="mb-2 text-sm font-semibold text-gray-900">{data.title}</div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-gray-500">Topic</dt>
            <dd className="text-gray-900">{data.topic ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Due</dt>
            <dd className="text-gray-900">{fmtDate(data.dueAt)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Score</dt>
            <dd className="text-gray-900">
              {data.my.score != null ? (
                <>
                  <span className="font-semibold">{data.my.score}</span>
                  <span className="text-xs text-gray-500"> / {data.maxPoints}</span>
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Status</dt>
            <dd className="text-gray-900">
              <StatusBadge status={data.my.status} />
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Last Updated</dt>
            <dd className="text-gray-900">{fmtDate(data.my.gradedAt)}</dd>
          </div>
        </dl>

        {data.my.feedback && (
          <div className="mt-4">
            <div className="text-sm font-semibold text-gray-900">Feedback</div>
            <p className="mt-1 whitespace-pre-wrap rounded-xl border bg-gray-50 p-3 text-sm text-gray-800">
              {data.my.feedback}
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-sm text-gray-600">
          <Info className="h-4 w-4" /> Your Percentage
        </div>
        <ProgressBar value={pct(pctVal)} />
        <p className="mt-2 text-xs text-gray-500">Calculated from your score / max points.</p>
      </div>
    </div>
  );
}
