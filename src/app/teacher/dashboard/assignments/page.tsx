"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Filter,
  RefreshCcw,
  Download,
  Search,
  Calendar,
  BookOpenCheck,
  Users,
  ListChecks,
  Sparkles,
  TrendingUp,
  Clock,
  Target,
  Award,
  BarChart3,
  AlertCircle,
  XCircle,
  Activity,
  Zap,
  Crown,
} from "lucide-react";
import { useUser } from "../teacherContext";

type ItemType = "assignment" | "groupAssignment" | "question" | "quiz";

type ItemRow = {
  id: string;
  type: ItemType;
  title: string;
  courseInstanceId: string | null;
  maxPoints: number;
  topic?: unknown | null; // string or populated object
  dueAt?: string | null;
  assignedCount: number;
  submittedCount: number;
  gradedCount?: number;
  gradedGroupCount?: number;
  submittedGroupCount?: number;
  submissionRate: number;
};

type TeacherItemsResponse = {
  teacherId: string;
  courseInstances: string[];
  rosterSizeByCI: Record<string, number>;
  courseLabelByCI?: Record<string, string>;
  items: ItemRow[];
  totals: { items: number; assigned: number; submitted: number; graded: number };
};

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "";

/** 5-star rating (visual only) */
function StarRating({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent || 0));
  const stars = Math.round(clamped / 20);

  const getStarColor = (index: number) => {
    if (index < stars) {
      if (clamped >= 90) return "text-emerald-500";
      if (clamped >= 80) return "text-blue-500";
      if (clamped >= 70) return "text-yellow-500";
      if (clamped >= 60) return "text-orange-500";
      return "text-red-500";
    }
    return "text-gray-300";
  };

  return (
    <div className="flex items-center gap-0.5" title={`${clamped.toFixed(1)}%`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`text-lg transition-all duration-300 hover:scale-110 ${getStarColor(i)}`}
          style={{
            filter: i < stars ? "drop-shadow(0 0 2px currentColor)" : "none",
            animationDelay: `${i * 100}ms`,
          }}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
      <span className="sr-only">{stars} out of 5 stars</span>
    </div>
  );
}

const TYPE_LABEL: Record<ItemType, string> = {
  assignment: "Assignment",
  groupAssignment: "Group Assignment",
  question: "Question",
  quiz: "Quiz",
};

const TYPE_CONFIG: Record<
  ItemType,
  {
    gradient: string;
    icon: React.ComponentType<any>;
    lightBg: string;
    darkText: string;
  }
> = {
  assignment: {
    gradient: "from-blue-500 to-cyan-600",
    icon: BookOpenCheck,
    lightBg: "bg-blue-50",
    darkText: "text-blue-700",
  },
  groupAssignment: {
    gradient: "from-purple-500 to-pink-600",
    icon: Users,
    lightBg: "bg-purple-50",
    darkText: "text-purple-700",
  },
  question: {
    gradient: "from-emerald-500 to-green-600",
    icon: ListChecks,
    lightBg: "bg-emerald-50",
    darkText: "text-emerald-700",
  },
  quiz: {
    gradient: "from-amber-500 to-orange-600",
    icon: Sparkles,
    lightBg: "bg-amber-50",
    darkText: "text-amber-700",
  },
};

const getSubmissionRateColor = (rate: number) => {
  if (rate >= 0.9) return "from-emerald-500 to-green-600";
  if (rate >= 0.8) return "from-blue-500 to-cyan-600";
  if (rate >= 0.7) return "from-yellow-500 to-orange-500";
  if (rate >= 0.6) return "from-orange-500 to-red-500";
  return "from-red-500 to-rose-600";
};

/** Helpers to avoid showing ObjectId-looking topic values */
const isObjectIdLike = (v: unknown) =>
  typeof v === "string" && /^[0-9a-f]{24}$/i.test(v);

/** Return a human-friendly topic label if available; otherwise null */
const topicText = (t: unknown): string | null => {
  if (!t) return null;
  if (typeof t === "string") return isObjectIdLike(t) ? null : t;
  if (typeof t === "object") {
    const anyT = t as any;
    return anyT?.name || anyT?.title || anyT?.label || null;
  }
  return null;
};

/** Centralized route builder — now receives courseInstanceId */
const getItemUrl = (
  type: ItemType,
  id: string,
  courseInstanceId?: string | null
) => {
  // Adjust this base to match your file-system routes exactly
  const ci = courseInstanceId ? encodeURIComponent(courseInstanceId) : null;
  const base = ci
    ? `/teacher/dashboard/class/${ci}/Details`
    : `/teacher/dashboard`; // fallback if CI missing

  const map: Record<ItemType, string> = {
    assignment: "Assignment",
    groupAssignment: "groupAssignment",
    question: "question",
    quiz: "quiz",
  };

  return ci
    ? `${base}/${map[type]}/${encodeURIComponent(id)}`
    : `${base}/${map[type]}/${encodeURIComponent(id)}`;
};

export default function TeacherItemsPage() {
  const router = useRouter();
  const { user } = useUser();
  const teacherId = (user as any)?._id || (user as any)?.id;

  const [items, setItems] = useState<ItemRow[]>([]);
  const [courseInstances, setCourseInstances] = useState<string[]>([]);
  const [rosterSizeByCI, setRosterSizeByCI] = useState<Record<string, number>>({});
  const [courseLabelByCI, setCourseLabelByCI] = useState<Record<string, string>>({});
  const [totals, setTotals] = useState<TeacherItemsResponse["totals"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [typeFilters, setTypeFilters] = useState<Record<ItemType, boolean>>({
    assignment: true,
    groupAssignment: true,
    question: true,
    quiz: true,
  });
  const [ciFilter, setCiFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const typesParam = useMemo(() => {
    const active = (Object.keys(typeFilters) as ItemType[]).filter((t) => typeFilters[t]);
    return active.length ? active.join(",") : "assignment,groupAssignment,question,quiz";
  }, [typeFilters]);

  const getToken = () =>
    (typeof window !== "undefined" &&
      (localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher"))) ||
    "";

  const fetchData = async (signal?: AbortSignal) => {
    if (!teacherId) return;
    if (!API) {
      setErr("NEXT_PUBLIC_BACKEND_URL is not set");
      setLoading(false);
      return;
    }

    setErr(null);
    setLoading(true);

    const token = getToken();

    try {
      // Adjust this path if your server mounts the router elsewhere
      const url = `${API}/overallAssignment/teacher/${encodeURIComponent(
        teacherId as string
      )}/items?types=${encodeURIComponent(typesParam)}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
      }

      const json: TeacherItemsResponse = await res.json();

      setItems(json.items || []);
      setCourseInstances(json.courseInstances || []);
      setRosterSizeByCI(json.rosterSizeByCI || {});
      setCourseLabelByCI(json.courseLabelByCI || {});
      setTotals(json.totals || null);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setErr(e?.message || "Failed to load");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!teacherId) return;
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [teacherId, typesParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = async () => {
    setRefreshing(true);
    const controller = new AbortController();
    await fetchData(controller.signal);
    setRefreshing(false);
  };

  const displayCourse = (ciId?: string | null) =>
    ciId ? courseLabelByCI[ciId] || ciId : "—";

  const filtered = useMemo(() => {
    let rows = items;
    if (ciFilter !== "all") rows = rows.filter((r) => r.courseInstanceId === ciFilter);
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((r) => (r.title || "").toLowerCase().includes(q));
    rows = [...rows].sort((a, b) => {
      const at = a.dueAt ? new Date(a.dueAt).getTime() : -1;
      const bt = b.dueAt ? new Date(b.dueAt).getTime() : -1;
      return bt - at;
    });
    return rows;
  }, [items, ciFilter, search]);

  const exportCSV = () => {
    const headers = [
      "Title",
      "Type",
      "Course",
      "CourseInstanceId",
      "DueAt",
      "MaxPoints",
      "Assigned",
      "Submitted",
      "Graded/GradedGroups",
      "SubmissionRate(%)",
    ];
    const rows = filtered.map((r) => [
      r.title || "",
      TYPE_LABEL[r.type],
      displayCourse(r.courseInstanceId),
      r.courseInstanceId || "",
      r.dueAt || "",
      String(r.maxPoints ?? 0),
      String(r.assignedCount ?? 0),
      String(r.submittedCount ?? 0),
      r.type === "groupAssignment" ? String(r.gradedGroupCount ?? 0) : String(r.gradedCount ?? 0),
      ((r.submissionRate || 0) * 100).toFixed(1),
    ]);
    const csv =
      [headers, ...rows]
        .map((row) =>
          row
            .map((v) => {
              const s = String(v ?? "");
              return s.includes(",") || s.includes('"') || s.includes("\n")
                ? `"${s.replace(/"/g, '""')}"` // escape
                : s;
            })
            .join(",")
        )
        .join("\n") + "\n";

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "teacher-items.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!teacherId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-rose-100">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-rose-600/20 rounded-3xl blur-xl"></div>
            <div className="relative bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8 max-w-md text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-red-500 to-rose-600 rounded-full flex items-center justify-center">
                <XCircle className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
              <p className="text-gray-600">Please log in with a teacher account to view course items.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
              <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
              <div
                className="absolute inset-0 rounded-full border-2 border-purple-400 border-b-transparent animate-spin animate-reverse"
                style={{ animationDuration: "3s" }}
              ></div>
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              Loading Course Items
            </h2>
            <p className="text-gray-600 text-lg">Gathering your teaching data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-rose-100">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-rose-600/20 rounded-3xl blur-xl"></div>
            <div className="relative bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8 max-w-md text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-red-500 to-rose-600 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Loading Failed</h2>
              <p className="text-gray-600 mb-6">{err}</p>
              <button
                onClick={onRefresh}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              >
                <RefreshCcw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-[1400px] mx-auto p-6">
        {/* Header */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/70 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-2xl">
                    <Crown className="w-8 h-8" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                      Course Dashboard
                    </h1>
                    <p className="text-gray-600 text-lg mt-2">
                      Managing {courseInstances.length} course instance{courseInstances.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                {totals && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 to-cyan-600/30 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                      <div className="relative bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-2xl p-6 shadow-2xl transform group-hover:scale-105 transition-all duration-300">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-blue-100 text-sm font-medium mb-1">Total Items</div>
                            <div className="text-3xl font-bold">{totals.items}</div>
                          </div>
                          <div className="w-12 h-12 bg-blue-400/20 rounded-2xl flex items-center justify-center">
                            <ListChecks className="w-7 h-7 text-blue-100" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/30 to-green-600/30 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                      <div className="relative bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-2xl p-6 shadow-2xl transform group-hover:scale-105 transition-all duration-300">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-emerald-100 text-sm font-medium mb-1">Assigned</div>
                            <div className="text-3xl font-bold">{totals.assigned}</div>
                          </div>
                          <div className="w-12 h-12 bg-emerald-400/20 rounded-2xl flex items-center justify-center">
                            <Target className="w-7 h-7 text-emerald-100" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/30 to-orange-600/30 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                      <div className="relative bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl p-6 shadow-2xl transform group-hover:scale-105 transition-all duration-300">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-amber-100 text-sm font-medium mb-1">Submitted</div>
                            <div className="text-3xl font-bold">{totals.submitted}</div>
                          </div>
                          <div className="w-12 h-12 bg-amber-400/20 rounded-2xl flex items-center justify-center">
                            <Activity className="w-7 h-7 text-amber-100" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/30 to-pink-600/30 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                      <div className="relative bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-2xl p-6 shadow-2xl transform group-hover:scale-105 transition-all duration-300">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-purple-100 text-sm font-medium mb-1">Graded</div>
                            <div className="text-3xl font-bold">{totals.graded}</div>
                          </div>
                          <div className="w-12 h-12 bg-purple-400/20 rounded-2xl flex items-center justify-center">
                            <Award className="w-7 h-7 text-purple-100" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-4">
                <button
                  onClick={exportCSV}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 font-medium"
                >
                  <Download className="w-5 h-5" />
                  Export CSV
                </button>
                <button
                  onClick={onRefresh}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white/50 backdrop-blur-sm border border-white/30 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 hover:bg-white/70"
                >
                  <RefreshCcw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-white/40 to-blue-100/40 rounded-2xl blur-xl"></div>
          <div className="relative bg-white/80 backdrop-blur-xl border border-white/30 rounded-2xl shadow-lg p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-gray-600" />
                  <span className="font-semibold text-gray-900">Filter by type:</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {(Object.keys(typeFilters) as ItemType[]).map((t) => {
                    const config = TYPE_CONFIG[t];
                    const IconComponent = config.icon;
                    return (
                      <label
                        key={t}
                        className={`inline-flex items-center gap-3 px-4 py-2 rounded-2xl border cursor-pointer transition-all duration-200 transform hover:scale-105 ${
                          typeFilters[t]
                            ? `bg-gradient-to-r ${config.gradient} text-white border-transparent shadow-lg`
                            : `bg-white/70 ${config.darkText} border-gray-200 shadow-sm hover:shadow-md`
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={typeFilters[t]}
                          onChange={() =>
                            setTypeFilters((prev) => ({ ...prev, [t]: !prev[t] }))
                          }
                          className="sr-only"
                        />
                        <IconComponent className="w-5 h-5" />
                        <span className="font-medium">{TYPE_LABEL[t]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search titles..."
                    className="pl-10 pr-4 py-3 w-64 bg-white/50 backdrop-blur border border-white/30 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-lg transition-all duration-200 hover:bg-white/70"
                  />
                </div>
                <select
                  value={ciFilter}
                  onChange={(e) => setCiFilter(e.target.value)}
                  className="px-4 py-3 bg-white/50 backdrop-blur border border-white/30 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-lg appearance-none cursor-pointer transition-all duration-200 hover:bg-white/70"
                  title="Filter by Course Instance"
                >
                  <option value="all">All Course Instances</option>
                  {courseInstances.map((cid) => (
                    <option key={cid} value={cid}>
                      {displayCourse(cid)} {rosterSizeByCI[cid] ? `· ${rosterSizeByCI[cid]} students` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl blur-xl bg-gradient-to-r from-white/40 to-blue-100/40"></div>
          <div className="relative overflow-hidden bg-white/80 backdrop-blur-xl border border-white/30 rounded-3xl shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-100/80 to-blue-100/80 backdrop-blur-sm">
                    <th className="text-left px-6 py-4 font-bold text-gray-800 border-b border-white/30">Title</th>
                    <th className="text-left px-6 py-4 font-bold text-gray-800 border-b border-white/30">Type</th>
                    <th className="text-left px-6 py-4 font-bold text-gray-800 border-b border-white/30">Course</th>
                    <th className="text-left px-6 py-4 font-bold text-gray-800 border-b border-white/30">
                      <div className="inline-flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Due Date
                      </div>
                    </th>
                    <th className="text-center px-6 py-4 font-bold text-gray-800 border-b border-white/30">Points</th>
                    <th className="text-center px-6 py-4 font-bold text-gray-800 border-b border-white/30">Assigned</th>
                    <th className="text-center px-6 py-4 font-bold text-gray-800 border-b border-white/30">Submitted</th>
                    <th className="text-center px-6 py-4 font-bold text-gray-800 border-b border-white/30">Graded</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                            <Search className="w-8 h-8 text-gray-400" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">No items found</h3>
                            <p className="text-gray-600">Try adjusting your filters or search terms.</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r, index) => {
                      const config = TYPE_CONFIG[r.type];
                      const IconComponent = config.icon;
                      const graded =
                        r.type === "groupAssignment" ? r.gradedGroupCount ?? 0 : r.gradedCount ?? 0;
                      const dueDate = r.dueAt ? new Date(r.dueAt) : null;
                      const isOverdue = dueDate && dueDate < new Date();
                      const rowUrl = getItemUrl(r.type, r.id, r.courseInstanceId);

                      const onRowClick = () => router.push(rowUrl);

                      return (
                        <tr
                          key={`${r.type}:${r.id}`}
                          onClick={onRowClick}
                          className={`cursor-pointer border-b border-white/20 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 transition-all duration-200 ${
                            index % 2 === 0 ? "bg-white/40" : "bg-slate-50/40"
                          }`}
                          title="Open details"
                        >
                          {/* Title (also a direct link for accessibility) */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-2xl bg-gradient-to-r ${config.gradient} text-white flex items-center justify-center shadow-lg`}
                              >
                                <IconComponent className="w-5 h-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <Link
                                  href={rowUrl}
                                  onClick={(e) => e.stopPropagation()}
                                  className="font-bold text-gray-900 truncate text-base hover:underline"
                                >
                                  {r.title}
                                </Link>
                                {topicText(r.topic) && (
                                  <div className="text-sm text-gray-600 mt-1">
                                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                                      {topicText(r.topic)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Type */}
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-3 py-2 rounded-2xl text-sm font-bold ${config.lightBg} ${config.darkText} border border-current/20 shadow-sm`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <IconComponent className="w-4 h-4 mr-2" />
                              {TYPE_LABEL[r.type]}
                            </span>
                          </td>

                          {/* Course */}
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="font-semibold text-gray-900">{displayCourse(r.courseInstanceId)}</div>
                              {r.courseInstanceId && rosterSizeByCI[r.courseInstanceId] != null && (
                                <div className="flex items-center gap-1 text-sm text-gray-600">
                                  <Users className="w-3.5 h-3.5" />
                                  <span>{rosterSizeByCI[r.courseInstanceId]} students</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Due Date */}
                          <td className="px-6 py-4">
                            {dueDate ? (
                              <div
                                className={`inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-medium ${
                                  isOverdue
                                    ? "bg-red-50 text-red-700 border border-red-200"
                                    : "bg-blue-50 text-blue-700 border border-blue-200"
                                }`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div>
                                  <div className="font-bold">{dueDate.toLocaleDateString()}</div>
                                  <div className="text-xs">
                                    {dueDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">No due date</span>
                            )}
                          </td>

                          {/* Points */}
                          <td className="px-6 py-4 text-center">
                            <div
                              className="inline-flex items-center gap-1 px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl shadow-lg font-bold"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Award className="w-4 h-4" />
                              {r.maxPoints ?? 0}
                            </div>
                          </td>

                          {/* Assigned */}
                          <td className="px-6 py-4 text-center">
                            <div
                              className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-2xl shadow-lg font-bold text-lg"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {r.assignedCount ?? 0}
                            </div>
                          </td>

                          {/* Submitted */}
                          <td className="px-6 py-4 text-center">
                            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl shadow-lg font-bold text-lg">
                                {r.submittedCount ?? 0}
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full bg-gradient-to-r ${getSubmissionRateColor(
                                    r.submissionRate
                                  )} transition-all duration-500`}
                                  style={{ width: `${Math.min((r.submissionRate || 0) * 100, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>

                          {/* Graded */}
                          <td className="px-6 py-4 text-center">
                            <div
                              className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-2xl shadow-lg font-bold text-lg"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {graded}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer note */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-slate-100/50 to-blue-100/50 backdrop-blur-sm"></div>
              <div className="relative px-6 py-4 border-t border-white/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <BarChart3 className="w-4 h-4" />
                    <span className="font-medium">
                      <strong>Graded</strong> shows individual submissions for assignments/questions, and group
                      submissions for group assignments.
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-500 to-green-600"></div>
                      <span>90%+ submission rate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500"></div>
                      <span>70-89% submission rate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-rose-600"></div>
                      <span>Below 70% submission rate</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
            <div className="relative bg-white/70 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Average Completion</h3>
                  <p className="text-3xl font-bold text-blue-600">
                    {filtered.length > 0
                      ? `${(
                          (filtered.reduce((sum, item) => sum + (item.submissionRate || 0), 0) /
                            filtered.length) *
                          100
                        ).toFixed(1)}%`
                      : "0%"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
            <div className="relative bg-white/70 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Total Students</h3>
                  <p className="text-3xl font-bold text-purple-600">
                    {Object.values(rosterSizeByCI).reduce((sum, size) => sum + size, 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative group md:col-span-2 lg:col-span-1">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-green-600/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
            <div className="relative bg-white/70 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">High Performers</h3>
                  <p className="text-3xl font-bold text-emerald-600">
                    {filtered.filter((item) => (item.submissionRate || 0) >= 0.9).length}
                  </p>
                  <p className="text-sm text-gray-600">Items with 90%+ completion</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
