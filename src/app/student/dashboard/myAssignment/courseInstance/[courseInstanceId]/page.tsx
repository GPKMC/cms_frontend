"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  FileText,
  Users,
  Star,
  MessageCircle,
  ArrowLeft,
  TrendingUp,
  Award,
  Target,
  Zap,
  BookOpen,
  AlertTriangle,
  Trophy,
  BookOpenCheck,
  HelpCircle,
  ListChecks,
  Users as Users2Icon,
} from "lucide-react";

/* =======================
   Types
======================= */

type FeedType = "assignment" | "groupAssignment" | "quiz" | "question" | "material";

type FeedItem = {
  _id: string;
  type: FeedType;
  title: string;
  content?: string;
  postedBy?: { username?: string };
  topic?: { title?: string } | null;
  createdAt?: string;
  updatedAt?: string;
  dueDate?: string | null;
  score?: number | null;
  attemptCount?: number;
  submissionId?: string | null;
  submitted?: boolean;
  submittedAt?: string | null;
  courseInstance?: {
    _id: string;
    name?: string;
    batch?: string | number;
    semester?: string | number;
  } | null;
  documents?: unknown[];
  media?: unknown[];
  youtubeLinks?: unknown[];
  links?: unknown[];
  groups?: unknown[];
  questions?: unknown[];
};

type Meta = {
  courseInstances?: string[];
  courseInstance?: {
    _id: string;
    name?: string;
    code?: string;
    batch?: string | number;
    semester?: string | number;
  };
  total?: number;
  submittedCount?: number;
  pendingCount?: number;
  lastSubmittedAt?: string | null;
  recent?: FeedItem[];
};

type DataResponse = {
  meta: Meta;
  items: FeedItem[];
};

/* =======================
   Helpers
======================= */

const typeIcon: Record<Exclude<FeedType, "material">, JSX.Element> = {
  assignment: <FileText className="w-5 h-5 text-blue-600" />,
  groupAssignment: <Users className="w-5 h-5 text-green-600" />,
  quiz: <Star className="w-5 h-5 text-yellow-500" />,
  question: <MessageCircle className="w-5 h-5 text-purple-600" />,
};

const typeColors: Record<FeedType, string> = {
  assignment: "from-blue-500 to-blue-600",
  groupAssignment: "from-green-500 to-green-600",
  quiz: "from-yellow-500 to-yellow-600",
  question: "from-purple-500 to-purple-600",
  material: "from-blue-500 to-blue-600",
};

// Route + icon mapping (used for navigation on click)
const typeMeta: Record<
  FeedType,
  { icon: JSX.Element; route: string }
> = {
  assignment: {
    icon: <FileText className="h-5 w-5 text-pink-600" />,
    route: "assignment",
  },
  groupAssignment: {
    icon: <Users2Icon className="h-5 w-5 text-yellow-300" />,
    route: "group-assignments",
  },
  material: {
    icon: <BookOpenCheck className="h-5 w-5 text-blue-600" />,
    route: "materials",
  },
  quiz: {
    icon: <ListChecks className="h-5 w-5 text-yellow-600" />,
    route: "quizzes",
  },
  question: {
    icon: <HelpCircle className="h-5 w-5 text-emerald-600" />,
    route: "questions",
  },
};

function fmtDateTime(d?: string | null) {
  if (!d) return "-";
  const t = new Date(d);
  return isNaN(t.getTime()) ? "-" : t.toLocaleString();
}

function fmtDate(d?: string | null) {
  if (!d) return "-";
  const t = new Date(d);
  return isNaN(t.getTime()) ? "-" : t.toLocaleDateString();
}

function getTimeUntilDue(dueDate: string) {
  const now = new Date();
  const due = new Date(dueDate);
  const diff = due.getTime() - now.getTime();

  if (diff < 0) return "Overdue";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return "Due soon";
}

/* =======================
   Component
======================= */

export default function StudentProgressPage() {
  const router = useRouter();
  const params = useParams() as { courseInstanceId?: string | string[] };
  const courseInstanceId = Array.isArray(params.courseInstanceId)
    ? params.courseInstanceId[0]
    : params.courseInstanceId;

  const [data, setData] = useState<DataResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!courseInstanceId) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const token =
          localStorage.getItem("token_student") ||
          sessionStorage.getItem("token_student");
        const baseurl = process.env.NEXT_PUBLIC_BACKEND_URL;

        const res = await fetch(
          `${baseurl}/assignmentFeed/student/progress?courseInstanceId=${courseInstanceId}`,
          { headers: { Authorization: `Bearer ${token || ""}` } }
        );

        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as any;
          throw new Error(j?.error || j?.message || "Failed to load progress");
        }

        const j = (await res.json()) as DataResponse;
        if (!cancelled) setData(j);
      } catch (e) {
        if (!cancelled) {
          const msg =
            e instanceof Error ? e.message : typeof e === "string" ? e : "Failed";
          setErr(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseInstanceId]);

  const items: FeedItem[] = data?.items ?? [];

  const submitted = useMemo<FeedItem[]>(
    () => items.filter((i) => !!i.submitted),
    [items]
  );

  const pending = useMemo<FeedItem[]>(
    () => items.filter((i) => !i.submitted),
    [items]
  );

  // Due date calculations
  const nowMs = Date.now();
  const pendingWithDue = useMemo<FeedItem[]>(
    () => pending.filter((i) => !!i.dueDate),
    [pending]
  );

  const upcoming = useMemo<FeedItem[]>(() => {
    return [...pendingWithDue]
      .filter((i) => new Date(i.dueDate as string).getTime() >= nowMs)
      .sort(
        (a: FeedItem, b: FeedItem) =>
          new Date(a.dueDate as string).getTime() -
          new Date(b.dueDate as string).getTime()
      );
  }, [pendingWithDue, nowMs]);

  const overdue = useMemo<FeedItem[]>(() => {
    return [...pendingWithDue]
      .filter((i) => new Date(i.dueDate as string).getTime() < nowMs)
      .sort(
        (a: FeedItem, b: FeedItem) =>
          new Date(b.dueDate as string).getTime() -
          new Date(a.dueDate as string).getTime()
      );
  }, [pendingWithDue, nowMs]);

  const nextDue: string | null = upcoming[0]?.dueDate ?? null;

  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const upcoming7 = useMemo<FeedItem[]>(() => {
    return upcoming.filter(
      (i) => new Date(i.dueDate as string).getTime() - nowMs <= SEVEN_DAYS
    );
  }, [upcoming, nowMs]);

  const handleNavigate = (item: FeedItem) => {
    const meta = typeMeta[item.type];
    if (!meta) return;
    router.push(
      `/student/dashboard/class/course-instance/${courseInstanceId}/${meta.route}/${item._id}`
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-3"></div>
          <p className="text-gray-600">Loading your progress…</p>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
          <div className="text-lg font-semibold text-red-600">{err}</div>
          <button
            onClick={() => location.reload()}
            className="mt-4 px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const meta: Meta = data?.meta ?? {};
  const completionRate = meta.total ? Math.round(((meta.submittedCount ?? 0) / meta.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back to Course</span>
        </button>

        {/* Hero Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Trophy className="h-10 w-10 text-yellow-500" />
            <h1 className="text-4xl font-bold text-gray-900">Academic Progress</h1>
            <Zap className="h-10 w-10 text-blue-500" />
          </div>
          <p className="text-base text-gray-600 mb-1">Track your learning journey and achievements</p>
          <p className="text-sm text-gray-500">
            Course:{" "}
            <span className="font-semibold">
              {meta.courseInstance?.name || meta.courseInstance?.code || courseInstanceId}
            </span>
          </p>
        </div>

        {/* Progress Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center shadow-sm">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl mb-4">
              <BookOpen className="h-7 w-7 text-white" />
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{meta.total ?? 0}</div>
            <div className="text-gray-600 text-sm font-medium">Total Tasks</div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center shadow-sm">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r from-green-500 to-green-600 rounded-xl mb-4">
              <CheckCircle2 className="h-7 w-7 text-white" />
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{meta.submittedCount ?? 0}</div>
            <div className="text-gray-600 text-sm font-medium">Completed</div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center shadow-sm">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl mb-4">
              <Clock className="h-7 w-7 text-white" />
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{meta.pendingCount ?? 0}</div>
            <div className="text-gray-600 text-sm font-medium">Pending</div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center shadow-sm">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl mb-4">
              <TrendingUp className="h-7 w-7 text-white" />
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{completionRate}%</div>
            <div className="text-gray-600 text-sm font-medium">Completion</div>
          </div>
        </div>

        {/* Progress Ring and Stats */}
        <div className="bg-white rounded-3xl border border-gray-200 p-8 mb-10 shadow-sm">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="relative">
              <svg className="w-40 h-40 transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-200"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="url(#gradient)"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 70}`}
                  strokeDashoffset={`${2 * Math.PI * 70 * (1 - completionRate / 100)}`}
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">{completionRate}%</div>
                  <div className="text-gray-500 text-sm">Complete</div>
                </div>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg mb-3">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div className="text-gray-500 text-sm mb-1">Next Due</div>
                <div className="text-gray-900 font-semibold">{fmtDate(nextDue)}</div>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg mb-3">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
                <div className="text-gray-500 text-sm mb-1">Overdue</div>
                <div className="text-gray-900 font-semibold">{overdue.length} tasks</div>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg mb-3">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <div className="text-gray-500 text-sm mb-1">Last Activity</div>
                <div className="text-gray-900 font-semibold">{fmtDate(meta.lastSubmittedAt)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Submissions */}
        <div className="bg-white rounded-3xl border border-gray-200 p-8 mb-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg">
              <Award className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Recent Achievements</h2>
          </div>
          {meta.recent?.length ? (
            <div className="grid md:grid-cols-2 gap-4">
              {meta.recent.map((i) => (
                <div
                  key={i._id}
                  onClick={() => handleNavigate(i)}
                  className="cursor-pointer bg-white border border-gray-200 rounded-2xl p-6 hover:shadow transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 bg-gradient-to-r ${typeColors[i.type]} rounded-xl`}>
                      {typeMeta[i.type]?.icon ?? typeIcon[i.type as Exclude<FeedType, "material">]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
                          {i.type === "groupAssignment" ? "Group Assignment" : i.type.charAt(0).toUpperCase() + i.type.slice(1)}
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-900 mb-2">{i.title}</h3>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div>Submitted: {fmtDateTime(i.submittedAt)}</div>
                        {typeof i.score === "number" && (
                          <div className="flex items-center gap-2">
                            <span>Score:</span>
                            <span
                              className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                                i.score >= 90
                                  ? "bg-green-100 text-green-700"
                                  : i.score >= 80
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {i.score}%
                            </span>
                          </div>
                        )}
                        {i.topic?.title && <div>Topic: {i.topic.title}</div>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Trophy className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500">No recent submissions to showcase yet.</p>
            </div>
          )}
        </div>

        {/* Upcoming & Overdue Grid */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Upcoming */}
          <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Upcoming This Week</h3>
            </div>
            {!upcoming7.length ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-4" />
                <p className="text-gray-500">All caught up! Nothing due this week.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {upcoming7.map((i) => (
                  <div
                    key={i._id}
                    onClick={() => handleNavigate(i)}
                    className="cursor-pointer bg-white border border-gray-200 rounded-xl p-4 hover:shadow transition-all"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 bg-gradient-to-r ${typeColors[i.type]} rounded-lg`}>
                          {typeMeta[i.type]?.icon ?? typeIcon[i.type as Exclude<FeedType, "material">]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
                              {i.type === "groupAssignment" ? "Group Assignment" : i.type.charAt(0).toUpperCase() + i.type.slice(1)}
                            </span>
                          </div>
                          <h4 className="font-semibold text-gray-900">{i.title}</h4>
                          {i.topic?.title && (
                            <div className="text-xs text-gray-600">{i.topic.title}</div>
                          )}
                        </div>
                      </div>
                      {i.dueDate && (
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-500 text-white">
                          {getTimeUntilDue(i.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Overdue */}
          <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Needs Attention</h3>
            </div>
            {!overdue.length ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-4" />
                <p className="text-green-700">Excellent! No overdue tasks.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {overdue.map((i) => (
                  <div
                    key={i._id}
                    onClick={() => handleNavigate(i)}
                    className="cursor-pointer bg-red-50 border border-red-200 rounded-xl p-4 hover:shadow transition-all"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 bg-gradient-to-r ${typeColors[i.type]} rounded-lg`}>
                          {typeMeta[i.type]?.icon ?? typeIcon[i.type as Exclude<FeedType, "material">]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                              {i.type === "groupAssignment" ? "Group Assignment" : i.type.charAt(0).toUpperCase() + i.type.slice(1)}
                            </span>
                          </div>
                          <h4 className="font-semibold text-gray-900">{i.title}</h4>
                          {i.topic?.title && (
                            <div className="text-xs text-gray-600">{i.topic.title}</div>
                          )}
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-red-600 text-white">
                        Overdue
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* All Tasks Overview */}
        <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg">
              <Target className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">All Tasks Overview</h3>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Completed Tasks */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Completed ({submitted.length})
              </h4>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {submitted.map((i) => (
                  <div
                    key={i._id}
                    onClick={() => handleNavigate(i)}
                    className="cursor-pointer bg-green-50 border border-green-200 rounded-xl p-4 hover:shadow transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-gradient-to-r ${typeColors[i.type]} rounded-lg`}>
                        {typeMeta[i.type]?.icon ?? typeIcon[i.type as Exclude<FeedType, "material">]}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
                            {i.type === "groupAssignment" ? "Group Assignment" : i.type.charAt(0).toUpperCase() + i.type.slice(1)}
                          </span>
                        </div>
                        <h5 className="font-semibold text-gray-900 text-sm">{i.title}</h5>
                        <div className="text-xs text-gray-600">
                          {i.topic?.title} • Submitted {fmtDate(i.submittedAt)}
                          {typeof i.score === "number" && (
                            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded font-semibold">
                              {i.score}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending Tasks */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-600" />
                Pending ({pending.length})
              </h4>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {pending.map((i) => {
                  const isOverdue = i.dueDate && new Date(i.dueDate).getTime() < nowMs;
                  return (
                    <div
                      key={i._id}
                      onClick={() => handleNavigate(i)}
                      className={`cursor-pointer border rounded-xl p-4 hover:shadow transition-all ${
                        isOverdue ? "bg-red-50 border-red-200" : "bg-orange-50 border-orange-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 bg-gradient-to-r ${typeColors[i.type]} rounded-lg`}>
                            {typeMeta[i.type]?.icon ?? typeIcon[i.type as Exclude<FeedType, "material">]}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
                                {i.type === "groupAssignment"
                                  ? "Group Assignment"
                                  : i.type.charAt(0).toUpperCase() + i.type.slice(1)}
                              </span>
                            </div>
                            <h5 className="font-semibold text-gray-900 text-sm">{i.title}</h5>
                            {i.topic?.title && (
                              <div className="text-xs text-gray-600">{i.topic.title}</div>
                            )}
                          </div>
                        </div>

                        {i.dueDate && (
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              isOverdue ? "bg-red-600 text-white" : "bg-orange-500 text-white"
                            }`}
                          >
                            {isOverdue ? "Overdue" : getTimeUntilDue(i.dueDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-8 text-gray-500">
          <p>
            Keep up the great work! Your progress is tracked across assignments, group assignments,
            quizzes, and questions.
          </p>
        </div>
      </div>
    </div>
  );
}
