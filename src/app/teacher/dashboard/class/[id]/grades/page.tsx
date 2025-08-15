"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Filter,
  Search,
  Download,
  TrendingUp,
  Users,
  BookOpen,
  Calendar,
  Award,
  AlertCircle,
  RefreshCcw,
} from "lucide-react";

type ItemType = "assignment" | "groupAssignment" | "question";

type RosterRow = {
  _id: string;
  username?: string;
  email?: string;
};

type Item = {
  id: string;
  type: ItemType;
  title: string;
  maxPoints: number;
  dueAt?: string | null;
  topic?: string | null;
  // you can add: visibleTo?: string[]  (optional if API sends it)
};

type GradeCell = {
  studentId: string;
  itemId: string;
  type: ItemType;
  score: number | null;
  maxPoints: number;
  status: "missing" | "submitted" | "graded";
  gradedAt: string | null;
};

type GradebookResponse = {
  roster: RosterRow[];
  items: Item[];
  grades: GradeCell[];
  policies: { scheme: "points" | "weighted"; treatMissingAsZero?: boolean };
  summary?: { classAvg: number; median: number; submittedRate: number; gradedRate: number };
};

type FilterKind = "all" | "ungraded" | "missing";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "";

/** 5-star rating based on percentage (0–100) → stars (0–5) */
function StarRating({ percent, className = "" }: { percent: number; className?: string }) {
  const safe = Math.max(0, Math.min(100, percent || 0));
  const stars = Math.round(safe / 20); // 0..5
  return (
    <div className={`flex items-center gap-1 ${className}`} title={`${safe.toFixed(1)}%`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`text-base leading-none ${i < stars ? "text-yellow-500" : "text-gray-300"}`}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
      <span className="sr-only">{stars} out of 5 stars</span>
    </div>
  );
}

export default function GradesPage() {
  const params = useParams();
  const courseInstanceId = params?.id as string;

  const [data, setData] = useState<GradebookResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterKind>("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Endpoints (fallbacks cover different mount points)
  const gradebookUrls = useMemo(
    () => [
      `${API}/grades/courseInstance/${courseInstanceId}/gradebook`,
      `${API}/courseInstance/${courseInstanceId}/gradebook`,
      `${API}/grade/courseInstance/${courseInstanceId}/gradebook`,
    ],
    [courseInstanceId]
  );

  const getToken = () =>
    (typeof window !== "undefined" &&
      (localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher"))) ||
    "";

  const fetchWithFallback = async (urls: string[], init: RequestInit) => {
    let lastErr: any = null;
    for (const url of urls) {
      try {
        const res = await fetch(url, init);
        if (res.ok) return res;
        if (res.status !== 404 && res.status !== 405) {
          const text = await res.text();
          throw new Error(text || `Request failed (${res.status})`);
        }
        lastErr = new Error(`Endpoint not found at ${url}`);
      } catch (e: any) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("All endpoints failed");
  };

  const load = async () => {
    if (!courseInstanceId) return;
    setLoading(true);
    setErr(null);
    const token = getToken();

    try {
      const res = await fetchWithFallback(gradebookUrls, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const json: GradebookResponse = await res.json();
      setData(json);
    } catch (e: any) {
      setErr(e?.message || "Failed to load gradebook");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseInstanceId]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Derived data
  const items = data?.items ?? [];
  const roster = useMemo(() => {
    const list = data?.roster ?? [];
    const q = search.trim().toLowerCase();
    const filtered =
      q.length === 0
        ? list
        : list.filter(
            (r) =>
              (r.username || "").toLowerCase().includes(q) ||
              (r.email || "").toLowerCase().includes(q)
          );
    return filtered.sort((a, b) => (a.username || "").localeCompare(b.username || ""));
  }, [data?.roster, search]);

  // sid||iid -> GradeCell
  const gradeMap = useMemo(() => {
    const m = new Map<string, GradeCell>();
    (data?.grades ?? []).forEach((g) => {
      m.set(`${g.studentId}||${g.itemId}`, g);
    });
    return m;
  }, [data?.grades]);

  // Column filter (uses only existing cells; "not assigned" cells are undefined and ignored)
  const visibleItems = useMemo(() => {
    if (!data || filter === "all") return items;

    const includeItem = (it: Item) => {
      for (const r of data.roster) {
        const cell = gradeMap.get(`${r._id}||${it.id}`);
        if (!cell) continue; // if not assigned to this student, skip for this check
        if (
          (filter === "missing" && cell.status === "missing") ||
          (filter === "ungraded" && (cell.status === "submitted" || cell.score === null))
        ) {
          return true;
        }
      }
      return false;
    };

    return items.filter(includeItem);
  }, [data, items, gradeMap, filter]);

  // Row totals — IMPORTANT: only count items that have a GradeCell.
  // That way, "not assigned" cells (no GradeCell) do not affect totals or star ratings.
  const rowTotals = useMemo(() => {
    const map = new Map<string, { earned: number; possible: number; percent: number }>();
    roster.forEach((r) => {
      let earned = 0;
      let possible = 0;
      visibleItems.forEach((it) => {
        const cell = gradeMap.get(`${r._id}||${it.id}`);
        if (!cell) return; // NOT ASSIGNED → ignore entirely
        if (cell.maxPoints) possible += cell.maxPoints;
        if (typeof cell.score === "number") earned += cell.score;
      });
      const percent = possible > 0 ? (earned / possible) * 100 : 0;
      map.set(r._id, { earned, possible, percent });
    });
    return map;
  }, [roster, visibleItems, gradeMap]);

  // UI helpers
  const getGradeColor = (percent: number) => {
    if (percent >= 90) return "from-emerald-500 to-green-600";
    if (percent >= 80) return "from-blue-500 to-cyan-600";
    if (percent >= 70) return "from-yellow-500 to-orange-500";
    if (percent >= 60) return "from-orange-500 to-red-500";
    return "from-red-500 to-rose-600";
  };

  const statusChip = (cell?: GradeCell) => {
    if (!cell) return null;
    if (cell.status === "missing")
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-sm">
          <XCircle className="w-3 h-3 mr-1" />
          Missing
        </span>
      );
    if (cell.status === "submitted" || cell.score == null)
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-sm">
          <AlertCircle className="w-3 h-3 mr-1" />
          Pending
        </span>
      );
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-gradient-to-r from-emerald-400 to-green-500 text-white shadow-sm">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Graded
      </span>
    );
  };

  // Export CSV (empty cells => not assigned)
  const exportCSV = React.useCallback(() => {
    if (!data) return;
    const headers = [
      "Student",
      "Email",
      ...visibleItems.map((i) => `${i.title} (${i.maxPoints})`),
      "Total",
      "Out of",
      "%",
    ];
    const rows = roster.map((r) => {
      const cells = visibleItems.map((it) => {
        const c = gradeMap.get(`${r._id}||${it.id}`);
        if (!c) return ""; // not assigned
        return typeof c.score === "number" ? `${c.score}` : "";
      });
      const tot = rowTotals.get(r._id);
      return [
        r.username || "",
        r.email || "",
        ...cells,
        String(tot?.earned ?? 0),
        String(tot?.possible ?? 0),
        (tot ? tot.percent.toFixed(1) : "0.0") + "%",
      ];
    });
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((v) => {
            const s = String(v ?? "");
            return s.includes(",") || s.includes('"') || s.includes("\n")
              ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gradebook.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [data, visibleItems, roster, gradeMap, rowTotals]);

  // Screens
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto p-8 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
              <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading Gradebook</h2>
            <p className="text-gray-600">Fetching your class data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-rose-100">
        <div className="max-w-4xl mx-auto p-8 flex items-center justify-center min-h-screen">
          <div className="bg-white rounded-3xl shadow-2xl p-12 text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-red-500 to-rose-600 rounded-full flex items-center justify-center">
              <XCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong</h2>
            <p className="text-gray-600">{err}</p>
            <button
              onClick={refresh}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
            >
              <RefreshCcw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-[1400px] mx-auto p-6">
        {/* Header */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/70 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                      Class Gradebook
                    </h1>
                    <p className="text-gray-600">Track student progress and manage grades</p>
                  </div>
                </div>

                {data.summary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-r from-blue-500 to-cyan-600 rounded-2xl p-4 text-white shadow-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-blue-100 text-sm font-medium">Class Average</p>
                          <p className="text-2xl font-bold">{data.summary.classAvg.toFixed(1)}%</p>
                          <StarRating percent={data.summary.classAvg} className="mt-1" />
                        </div>
                        <TrendingUp className="w-8 h-8 text-blue-200" />
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-4 text-white shadow-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-purple-100 text-sm font-medium">Median</p>
                          <p className="text-2xl font-bold">{data.summary.median.toFixed(1)}%</p>
                        </div>
                        <Award className="w-8 h-8 text-purple-200" />
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl p-4 text-white shadow-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-emerald-100 text-sm font-medium">Submitted</p>
                          <p className="text-2xl font-bold">
                            {Math.round((data.summary.submittedRate || 0) * 100)}%
                          </p>
                        </div>
                        <CheckCircle2 className="w-8 h-8 text-emerald-200" />
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-4 text-white shadow-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-amber-100 text-sm font-medium">Graded</p>
                          <p className="text-2xl font-bold">
                            {Math.round((data.summary.gradedRate || 0) * 100)}%
                          </p>
                        </div>
                        <Calendar className="w-8 h-8 text-amber-200" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 pr-4 py-3 w-64 bg-white/50 backdrop-blur border border-white/30 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-lg transition-all duration-200 hover:bg-white/70"
                    />
                  </div>
                  <div className="relative">
                    <Filter className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value as FilterKind)}
                      className="pl-10 pr-10 py-3 bg-white/50 backdrop-blur border border-white/30 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-lg appearance-none cursor-pointer transition-all duration-200 hover:bg-white/70"
                    >
                      <option value="all">All items</option>
                      <option value="ungraded">Ungraded work</option>
                      <option value="missing">Missing work</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportCSV}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 font-medium"
                  >
                    <Download className="w-5 h-5" />
                    Export CSV
                  </button>
                  <button
                    onClick={refresh}
                    className="inline-flex items-center justify-center gap-2 px-3 py-3 bg-white/60 border border-white/30 rounded-2xl hover:bg-white/80 shadow-lg"
                    title="Refresh"
                  >
                    <RefreshCcw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-white/40 to-blue-100/40 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/80 backdrop-blur-xl border border-white/30 rounded-3xl shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[1200px] w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-100/80 to-blue-100/80 backdrop-blur-sm">
                    <th className="sticky left-0 z-20 bg-gradient-to-r from-slate-100/90 to-blue-100/90 backdrop-blur-sm text-left px-6 py-4 font-semibold text-gray-800 border-b border-white/30">
                      Student
                    </th>
                    {visibleItems.map((it) => (
                      <th
                        key={it.id}
                        className="px-6 py-4 font-semibold text-gray-800 border-b border-white/30 text-left min-w-[200px]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {it.type === "assignment" && <BookOpen className="w-4 h-4 text-blue-600" />}
                            {it.type === "groupAssignment" && <Users className="w-4 h-4 text-purple-600" />}
                            {it.type === "question" && <Award className="w-4 h-4 text-emerald-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 truncate">{it.title}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                                {it.maxPoints} pts
                              </span>
                              {it.type === "groupAssignment" && (
                                <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                                  Group
                                </span>
                              )}
                              {(it as any).topicName && (
                                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                                  {(it as any).topicName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </th>
                    ))}
                    <th className="px-6 py-4 font-semibold text-gray-800 border-b border-white/30 text-center min-w-[120px]">
                      Total Score
                    </th>
                    <th className="px-6 py-4 font-semibold text-gray-800 border-b border-white/30 text-center min-w-[140px]">
                      Grade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((r, rowIndex) => {
                    const total = rowTotals.get(r._id);
                    const gradePercent = total?.percent ?? 0;
                    return (
                      <tr
                        key={r._id}
                        className={`transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 ${
                          rowIndex % 2 === 0 ? "bg-white/40" : "bg-slate-50/40"
                        }`}
                      >
                        <td className="sticky left-0 z-10 bg-white/90 backdrop-blur-sm border-b border-white/20 px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full bg-gradient-to-r ${getGradeColor(
                                gradePercent
                              )} flex items-center justify-center text-white font-bold text-sm shadow-lg`}
                            >
                              {(r.username || "U").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900 truncate">{r.username || "Unnamed"}</div>
                              <div className="text-xs text-gray-500 truncate">{r.email}</div>
                            </div>
                          </div>
                        </td>

                        {visibleItems.map((it) => {
                          const k = `${r._id}||${it.id}`;
                          const cell = gradeMap.get(k);

                          return (
                            <td key={it.id} className="border-b border-white/20 px-6 py-4 align-top">
                              {!cell ? (
                                <div className="space-y-2">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-lg font-bold text-gray-400">—</span>
                                    <span className="text-sm text-gray-400">/ {it.maxPoints}</span>
                                  </div>
                                  <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800 shadow-sm">
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Not assigned
                                  </span>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-lg font-bold text-gray-900">
                                      {typeof cell.score === "number" ? cell.score : "—"}
                                    </span>
                                    <span className="text-sm text-gray-500">/ {cell.maxPoints}</span>
                                    {cell.type === "groupAssignment" && (
                                      <span
                                        className="ml-2 text-[10px] text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full"
                                        title="Group grade"
                                      >
                                        Group
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-between">{statusChip(cell)}</div>

                                  {typeof cell.score === "number" && (
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div
                                        className={`h-2 rounded-full bg-gradient-to-r ${getGradeColor(
                                          (cell.score / cell.maxPoints) * 100
                                        )} transition-all duration-500`}
                                        style={{
                                          width: `${Math.min((cell.score / cell.maxPoints) * 100, 100)}%`,
                                        }}
                                      ></div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}

                        <td className="border-b border-white/20 px-6 py-4 text-center">
                          <div className="space-y-2">
                            <div className="text-lg font-bold text-gray-900">
                              {Math.round(total?.earned ?? 0)} / {Math.round(total?.possible ?? 0)}
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div
                                className={`h-3 rounded-full bg-gradient-to-r ${getGradeColor(
                                  gradePercent
                                )} transition-all duration-500`}
                                style={{ width: `${Math.min(gradePercent, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>

                        <td className="border-b border-white/20 px-6 py-4 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <div
                              className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r ${getGradeColor(
                                gradePercent
                              )} text-white shadow-lg`}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="font-bold">{gradePercent.toFixed(1)}%</span>
                            </div>
                            {/* Stars use rowTotals percent, which ignores "not assigned" cells */}
                            <StarRating percent={gradePercent} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer note */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-slate-100/50 to-blue-100/50 backdrop-blur-sm"></div>
              <div className="relative px-6 py-4 border-t border-white/30">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">Group Assignment Grading</h3>
                    <div className="text-sm text-gray-600 space-y-2">
                      <p className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                        Group cells are read-only here. If you want inline editing for groups, include a{" "}
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">groupId</code> in each group grade cell
                        and wire up the{" "}
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                          /grades/group/:groupAssignmentId/group/:groupId
                        </code>{" "}
                        endpoint.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={refresh}
                    className="self-start inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/70 border border-white/30 hover:bg-white"
                  >
                    <RefreshCcw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mt-8 grid grid-cols-1 md-grid-cols-3 md:grid-cols-3 gap-6">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
            <div className="relative bg-white/70 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Active Students</h3>
                  <p className="text-2xl font-bold text-blue-600">{roster.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
            <div className="relative bg-white/70 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Total Items</h3>
                  <p className="text-2xl font-bold text-purple-600">{visibleItems.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-green-600/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
            <div className="relative bg-white/70 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Total Points</h3>
                  <p className="text-2xl font-bold text-emerald-600">
                    {visibleItems.reduce((sum, item) => sum + item.maxPoints, 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
