"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Users,
  FileText,
  RefreshCcw,
  XCircle,
  Calendar,
  PencilLine,
  Award,
  Search,
  Clock,
  AlertTriangle,
  Sparkles,
  Star,
  Target,
  Zap,
  GraduationCap,
  Trophy,
  Lightbulb,
  CheckCircle2,
  X as XIcon,
  ExternalLink,
  Eye,
} from "lucide-react";

/* =====================
   Types
===================== */
type UserLite = { _id: string; username?: string; email?: string };

type FileObj = {
  url: string;
  originalname: string;
  filetype?: string;         // e.g., "application/pdf"
  extractedText?: string;
  combinedText?: string;
};

type Submission = {
  _id: string;
  submittedBy?: UserLite;
  files: FileObj[];
  submittedAt: string | null;
  grade?: number | null;
  feedback?: string;
  plagiarismPercentage?: number;
  status?: string;
};

type GroupLite = {
  _id: string;
  name?: string;
  task?: string;
  members: UserLite[];
  submissionCount: number;
  marks?: number | null;
  feedback?: string;
};

type GroupsResponse = {
  assignment: {
    _id: string;
    title: string;
    points?: number;
    acceptingSubmissions?: boolean;
    closeAt?: string | null;
  };
  groupsCount: number;
  groups: GroupLite[];
};

type GroupSubmissionsResponse = {
  assignment: GroupsResponse["assignment"];
  group: {
    _id: string;
    name?: string;
    task?: string;
    members: UserLite[];
    marks?: number | null;
    feedback?: string;
  };
  count: number;
  submissions: Submission[];
};

/* =====================
   Main Component
===================== */
export default function GroupAssignmentGroupsPanel({
  groupAssignmentId,
  token,
  backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL,
}: {
  groupAssignmentId: string;
  token?: string;
  backendUrl?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GroupsResponse | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [subs, setSubs] = useState<Record<string, GroupSubmissionsResponse>>({});
  const [search, setSearch] = useState("");

  const authToken = useMemo(() => {
    if (token) return token;
    if (typeof window !== "undefined")
      return (
        localStorage.getItem("token_teacher") ||
        sessionStorage.getItem("token_teacher") ||
        undefined
      );
    return undefined;
  }, [token]);

  // ---- API calls ----
  async function fetchGroups() {
    if (!backendUrl) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `${backendUrl}/groupassignmentgrading/group-assignments/${groupAssignmentId}/groups`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          cache: "no-store",
        }
      );
      if (!res.ok) throw new Error(await res.text());
      const json: GroupsResponse = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Failed to load groups");
    } finally {
      setLoading(false);
    }
  }

  async function fetchGroupSubs(groupId: string) {
    if (!backendUrl) return;
    try {
      const res = await fetch(
        `${backendUrl}/groupassignmentgrading/group-assignments/${groupAssignmentId}/groups/${groupId}/submissions`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
        }
      );
      if (!res.ok) throw new Error(await res.text());
      const json: GroupSubmissionsResponse = await res.json();
      setSubs((prev) => ({ ...prev, [groupId]: json }));
    } catch (e) {
      console.error(e);
    }
  }

  async function updateGroupGrade(
    groupId: string,
    grade: number | null,
    feedback: string
  ) {
    if (!backendUrl) return;
    try {
      setRefreshing(true);
      const res = await fetch(
        `${backendUrl}/groupassignmentgrading/group-assignments/${groupAssignmentId}/groups/${groupId}/grade`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({ grade, feedback }),
        }
      );
      if (!res.ok) throw new Error(await res.text());

      // refresh parent groups
      await fetchGroups();
      // refresh this group's submissions mirror
      await fetchGroupSubs(groupId);
    } catch (e) {
      console.error(e);
      alert("Failed to update grade/feedback");
    } finally {
      setRefreshing(false);
    }
  }

  // initial load
  useEffect(() => {
    fetchGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupAssignmentId, backendUrl, authToken]);

  const filteredGroups = useMemo(() => {
    if (!data) return [] as GroupLite[];
    const q = search.trim().toLowerCase();
    if (!q) return data.groups;
    return data.groups.filter((g) => (g.name || "").toLowerCase().includes(q));
  }, [data, search]);

  const toggleExpand = (groupId: string) => {
    setExpandedGroupId((prev) => (prev === groupId ? null : groupId));
    if (!subs[groupId]) fetchGroupSubs(groupId);
  };

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-violet-50 via-sky-50 to-cyan-50">
        <div className="absolute inset-0">
          <div className="absolute left-10 top-20 h-[30rem] w-[30rem] animate-pulse rounded-full bg-gradient-to-r from-purple-400/30 to-pink-400/30 blur-3xl" />
          <div className="absolute right-20 top-40 h-[24rem] w-[24rem] animate-pulse rounded-full bg-gradient-to-r from-blue-400/30 to-indigo-400/30 blur-3xl delay-1000" />
        </div>
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center p-8">
          <div className="rounded-[2.25rem] border border-white/50 bg-white/85 p-16 text-center shadow-2xl backdrop-blur-xl">
            <div className="relative mb-8">
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-2xl">
                <RefreshCcw className="h-12 w-12 animate-spin text-white" />
              </div>
            </div>
            <h2 className="mb-2 bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-3xl font-black text-transparent">
              Loading Assignment Dashboard
            </h2>
            <p className="text-slate-600">Fetching groups and submissions…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-rose-50 to-pink-50">
        <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center p-8">
          <div className="max-w-md rounded-[2rem] border border-red-100 bg-white/90 p-16 text-center shadow-2xl backdrop-blur-xl">
            <div className="mb-8 mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-2xl">
              <AlertTriangle className="h-12 w-12" />
            </div>
            <h2 className="mb-6 text-3xl font-black text-red-800">
              Unable to Load Groups
            </h2>
            <p className="mb-8 text-lg text-red-600">{String(error)}</p>
            <button
              onClick={fetchGroups}
              className="rounded-2xl bg-gradient-to-r from-red-500 to-rose-500 px-10 py-4 font-bold text-white shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-3xl"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-violet-50 via-sky-50 to-cyan-50">
      {/* Background accents */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-10 top-24 h-[28rem] w-[28rem] rounded-full bg-gradient-to-r from-purple-400/25 to-pink-400/25 blur-3xl" />
        <div className="absolute right-16 top-56 h-[22rem] w-[22rem] rounded-full bg-gradient-to-r from-blue-400/25 to-indigo-400/25 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl space-y-10 p-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-[2.75rem] border border-white/50 bg-white/75 p-12 shadow-2xl backdrop-blur-xl">
          <div className="absolute left-0 top-0 h-2 w-full bg-gradient-to-r from-indigo-500 via-purple-500 via-pink-500 to-rose-500" />
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5" />

          <div className="relative">
            <div className="flex flex-col gap-10 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-8">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="rounded-[2.25rem] bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-7 text-white shadow-2xl">
                      <GraduationCap className="h-12 w-12" />
                    </div>
                    <div className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-400 shadow-lg">
                      <Star className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold text-indigo-600">
                      <Sparkles className="h-4 w-4" />
                      Assignment Dashboard
                    </div>
                    <h1 className="bg-gradient-to-r from-slate-900 via-slate-700 to-slate-600 bg-clip-text text-transparent text-5xl font-black leading-tight">
                      {data.assignment.title}
                    </h1>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {typeof data.assignment.points === "number" && (
                    <div className="group relative overflow-hidden rounded-3xl border border-amber-200/60 bg-gradient-to-br from-amber-50/90 to-orange-50/90 p-7 backdrop-blur-sm transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl">
                      <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-amber-400 to-orange-400" />
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-amber-600">
                            Maximum Points
                          </div>
                          <div className="mt-1 text-3xl font-black text-amber-900">
                            {data.assignment.points}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 p-3 text-white shadow-lg">
                          <Target className="h-7 w-7" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div
                    className={`group relative overflow-hidden rounded-3xl border p-7 backdrop-blur-sm transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl ${
                      data.assignment.acceptingSubmissions
                        ? "border-emerald-200/60 bg-gradient-to-br from-emerald-50/90 to-green-50/90"
                        : "border-rose-200/60 bg-gradient-to-br from-rose-50/90 to-red-50/90"
                    }`}
                  >
                    <div
                      className={`absolute bottom-0 left-0 h-1 w-full ${
                        data.assignment.acceptingSubmissions
                          ? "bg-gradient-to-r from-emerald-400 to-green-400"
                          : "bg-gradient-to-r from-rose-400 to-red-400"
                      }`}
                    />
                    <div className="flex items-center justify-between">
                      <div>
                        <div
                          className={`text-xs font-bold ${
                            data.assignment.acceptingSubmissions
                              ? "text-emerald-600"
                              : "text-rose-600"
                          }`}
                        >
                          Status
                        </div>
                        <div
                          className={`mt-1 text-2xl font-black ${
                            data.assignment.acceptingSubmissions
                              ? "text-emerald-900"
                              : "text-rose-900"
                          }`}
                        >
                          {data.assignment.acceptingSubmissions
                            ? "Active"
                            : "Closed"}
                        </div>
                      </div>
                      <div
                        className={`rounded-2xl p-3 text-white shadow-lg ${
                          data.assignment.acceptingSubmissions
                            ? "bg-gradient-to-r from-emerald-400 to-green-400"
                            : "bg-gradient-to-r from-rose-400 to-red-400"
                        }`}
                      >
                        {data.assignment.acceptingSubmissions ? (
                          <Zap className="h-7 w-7" />
                        ) : (
                          <XCircle className="h-7 w-7" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="group relative overflow-hidden rounded-3xl border border-blue-200/60 bg-gradient-to-br from-blue-50/90 to-indigo-50/90 p-7 backdrop-blur-sm transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl">
                    <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-blue-400 to-indigo-400" />
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-blue-600">
                          Total Groups
                        </div>
                        <div className="mt-1 text-3xl font-black text-blue-900">
                          {data.groupsCount}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-gradient-to-r from-blue-400 to-indigo-400 p-3 text-white shadow-lg">
                        <Users className="h-7 w-7" />
                      </div>
                    </div>
                  </div>

                  <div className="group relative overflow-hidden rounded-3xl border border-purple-200/60 bg-gradient-to-br from-purple-50/90 to-pink-50/90 p-7 backdrop-blur-sm transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl">
                    <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-purple-400 to-pink-400" />
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-purple-600">
                          Graded
                        </div>
                        <div className="mt-1 text-3xl font-black text-purple-900">
                          {data.groups.filter((g) => g.marks != null).length}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-gradient-to-r from-purple-400 to-pink-400 p-3 text-white shadow-lg">
                        <Trophy className="h-7 w-7" />
                      </div>
                    </div>
                  </div>

                  {data.assignment.closeAt && (
                    <div className="group relative overflow-hidden rounded-3xl border border-slate-200/60 bg-gradient-to-br from-slate-50/90 to-gray-50/90 p-7 backdrop-blur-sm transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl sm:col-span-2 lg:col-span-4">
                      <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-slate-400 to-gray-400" />
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-600">
                            Submission Deadline
                          </div>
                          <div className="mt-1 text-xl font-black text-slate-900">
                            {new Date(data.assignment.closeAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-gradient-to-r from-slate-400 to-gray-400 p-3 text-white shadow-lg">
                          <Calendar className="h-7 w-7" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-stretch gap-6 sm:flex-row sm:items-center xl:flex-col xl:items-stretch">
                <div className="group relative">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search groups..."
                    className="w-full rounded-2xl border-0 bg-white/85 px-16 py-5 text-lg font-medium shadow-xl backdrop-blur-xl transition-all duration-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/25 sm:w-96"
                  />
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 p-2">
                    <Search className="h-5 w-5 text-white" />
                  </div>
                </div>

                <button
                  onClick={fetchGroups}
                  className="group relative flex items-center justify-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-10 py-5 font-bold text-white shadow-2xl transition-all duration-500 hover:scale-105 hover:shadow-3xl"
                  title="Refresh Data"
                >
                  <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-white/0 via-white/30 to-white/0 transition-transform duration-1000 group-hover:translate-x-[100%]" />
                  <RefreshCcw className="h-6 w-6 transition-all duration-300 group-hover:rotate-180" />
                  <span className="text-lg">Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Groups Grid */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 2xl:grid-cols-2">
          {filteredGroups.map((g, index) => (
            <GroupCard
              key={g._id}
              group={g}
              points={data.assignment.points}
              expanded={expandedGroupId === g._id}
              onToggle={() => toggleExpand(g._id)}
              subsResponse={subs[g._id]}
              onUpdate={(grade, feedback) =>
                updateGroupGrade(g._id, grade, feedback)
              }
              refreshing={refreshing}
              backendUrl={backendUrl}
              index={index}
            />
          ))}
        </div>

        {filteredGroups.length === 0 && (
          <div className="py-20 text-center">
            <div className="mx-auto max-w-lg rounded-[2rem] border border-white/50 bg-white/75 p-20 shadow-2xl backdrop-blur-2xl">
              <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-r from-slate-300 to-gray-400">
                <Search className="h-14 w-14 text-white" />
              </div>
              <h3 className="mb-6 bg-gradient-to-r from-slate-700 to-slate-500 bg-clip-text text-4xl font-black text-transparent">
                No Groups Found
              </h3>
              <p className="text-xl text-slate-600">
                Try adjusting your search criteria to find more groups.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =====================
   Group Card (bigger, beautiful + Preview modal)
===================== */
function GroupCard({
  group,
  points,
  expanded,
  onToggle,
  subsResponse,
  onUpdate,
  refreshing,
  backendUrl,
  index,
}: {
  group: GroupLite;
  points?: number;
  expanded: boolean;
  onToggle: () => void;
  subsResponse?: GroupSubmissionsResponse;
  onUpdate: (grade: number | null, feedback: string) => void;
  refreshing: boolean;
  backendUrl?: string;
  index: number;
}) {
  const [editing, setEditing] = useState(false);
  const [grade, setGrade] = useState<string>(
    group.marks != null ? String(group.marks) : ""
  );
  const [feedback, setFeedback] = useState<string>(group.feedback || "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");

  useEffect(() => {
    setGrade(group.marks != null ? String(group.marks) : "");
    setFeedback(group.feedback || "");
  }, [group.marks, group.feedback]);

  // Close modal on ESC
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setPreviewUrl(null);
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  const validGradeNum = useMemo(() => {
    if (grade === "") return null;
    const num = Number(grade);
    return Number.isFinite(num) ? num : null;
  }, [grade]);

  const gradePercentage = useMemo(() => {
    if (group.marks == null || points == null) return null;
    return Math.round((group.marks / points) * 100);
  }, [group.marks, points]);

  const cardGradients = [
    "from-blue-500 to-indigo-600",
    "from-purple-500 to-pink-600",
    "from-emerald-500 to-teal-600",
    "from-orange-500 to-red-600",
    "from-cyan-500 to-blue-600",
    "from-violet-500 to-purple-600",
    "from-rose-500 to-pink-600",
    "from-amber-500 to-orange-600",
  ];

  const iconColors = [
    "from-blue-400 to-indigo-500",
    "from-purple-400 to-pink-500",
    "from-emerald-400 to-teal-500",
    "from-orange-400 to-red-500",
    "from-cyan-400 to-blue-500",
    "from-violet-400 to-purple-500",
    "from-rose-400 to-pink-500",
    "from-amber-400 to-orange-500",
  ];

  const gradientColor = cardGradients[index % cardGradients.length];
  const iconColor = iconColors[index % iconColors.length];

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return "from-emerald-500 to-green-500";
    if (percentage >= 80) return "from-blue-500 to-indigo-500";
    if (percentage >= 70) return "from-amber-500 to-orange-500";
    return "from-red-500 to-rose-500";
  };

  // -------- File helpers (attractive cards + preview handling) --------
  function absoluteFileUrl(pathOrUrl: string) {
    if (!pathOrUrl) return "";
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    if (backendUrl) {
      // ensure single slash
      return `${backendUrl.replace(/\/+$/, "")}/${pathOrUrl.replace(/^\/+/, "")}`;
    }
    return pathOrUrl; // fallback
  }

  function extOf(name: string) {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    return ext;
  }
  function extPalette(ext: string) {
    if (["pdf"].includes(ext)) return "from-rose-400/70 to-red-400/70";
    if (["doc", "docx"].includes(ext)) return "from-indigo-400/70 to-blue-400/70";
    if (["xls", "xlsx", "csv"].includes(ext)) return "from-emerald-400/70 to-teal-400/70";
    if (["ppt", "pptx"].includes(ext)) return "from-amber-400/70 to-orange-400/70";
    if (["zip", "rar", "7z"].includes(ext)) return "from-slate-400/70 to-gray-400/70";
    if (["png","jpg","jpeg","gif","webp","svg"].includes(ext)) return "from-fuchsia-400/70 to-pink-400/70";
    if (["js","ts","tsx","py","java","c","cpp","rb","go","php"].includes(ext)) return "from-violet-400/70 to-purple-400/70";
    return "from-slate-300/70 to-slate-400/70";
  }

  function isOfficeExt(ext: string) {
    return ["doc","docx","xls","xlsx","ppt","pptx"].includes(ext);
  }
  function isPdfExt(ext: string) {
    return ext === "pdf";
  }
  function buildOfficeViewerUrl(rawUrl: string) {
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(rawUrl)}`;
  }
  function getPreviewUrl(file: FileObj) {
    const ext = extOf(file.originalname);
    const abs = absoluteFileUrl(file.url);
    if (isOfficeExt(ext)) return buildOfficeViewerUrl(abs);
    if (isPdfExt(ext)) return abs;
    return null;
  }

  return (
    <>
      <div
        className="group relative animate-fadeIn"
        style={{
          animationDelay: `${index * 120}ms`,
          animationFillMode: "both",
        }}
      >
        <div className="relative overflow-hidden rounded-[2.5rem] border border-white/60 bg-white/85 shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur-xl transition-all duration-700 hover:-translate-y-2 hover:shadow-[0_30px_80px_rgba(0,0,0,0.12)]">
          {/* Dynamic Gradient Top Border */}
          <div
            className={`absolute left-0 top-0 h-2 w-full bg-gradient-to-r ${gradientColor}`}
          />

          {/* Floating Grade Badge */}
          {group.marks != null && gradePercentage != null && (
            <div className="absolute right-5 top-7 z-10">
              <div
                className={`rounded-2xl bg-gradient-to-r ${getGradeColor(
                  gradePercentage
                )} px-4 py-2 text-white shadow-xl`}
              >
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  <span className="font-bold">{gradePercentage}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Header Section */}
          <div
            className="group/header relative cursor-pointer overflow-hidden p-10 transition-all duration-500 hover:bg-gradient-to-r hover:from-indigo-50/40 hover:to-purple-50/40"
            onClick={onToggle}
          >
            <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-white/0 via-white/10 to-white/0 transition-transform duration-1000 group-hover/header:translate-x-[100%]" />

            <div className="relative z-10 flex items-start justify-between">
              <div className="min-w-0 flex-1 pr-5">
                <div className="mb-7 flex items-center gap-5">
                  <div className="relative">
                    <div
                      className={`rounded-3xl bg-gradient-to-br ${iconColor} p-5 text-white shadow-xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-2xl`}
                    >
                      <Users className="h-8 w-8" />
                    </div>
                    <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 text-xs font-bold text-white shadow-lg">
                      {group.members.length}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold text-indigo-600">
                      <Lightbulb className="h-4 w-4" />
                      Group Project
                    </div>
                    <h3 className="text-3xl font-black leading-tight text-slate-800">
                      {group.name || "Unnamed Group"}
                    </h3>
                    {group.marks != null && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-sm text-slate-600">Grade:</span>
                        <span className="text-xl font-extrabold">
                          {group.marks}
                        </span>
                        {typeof points === "number" && (
                          <span className="text-slate-400">/ {points}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Task Preview */}
                {group.task && (
                  <div className="mb-7 rounded-2xl bg-white/70 p-5 backdrop-blur-sm">
                    <div className="mb-2 text-xs font-medium text-slate-500">
                      PROJECT DESCRIPTION
                    </div>
                    <p className="line-clamp-3 leading-relaxed text-[15px] text-slate-700">
                      {group.task}
                    </p>
                  </div>
                )}

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-5">
                  <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-5 text-center transition-all duration-300 hover:bg-white hover:shadow-lg">
                    <div className="mb-2 flex items-center justify-center">
                      <div className="rounded-lg bg-gradient-to-r from-blue-400 to-indigo-400 p-2.5">
                        <FileText className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">Submissions</div>
                    <div className="text-2xl font-extrabold text-slate-900">
                      {group.submissionCount}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-5 text-center transition-all duration-300 hover:bg-white hover:shadow-lg">
                    <div className="mb-2 flex items-center justify-center">
                      <div className="rounded-lg bg-gradient-to-r from-purple-400 to-pink-400 p-2.5">
                        <Users className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">Members</div>
                    <div className="text-2xl font-extrabold text-slate-900">
                      {group.members.length}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-5 text-center transition-all duration-300 hover:bg-white hover:shadow-lg">
                    <div className="mb-2 flex items-center justify-center">
                      <div
                        className={`rounded-lg p-2.5 ${
                          group.marks != null
                            ? "bg-gradient-to-r from-emerald-400 to-green-400"
                            : "bg-gradient-to-r from-slate-400 to-gray-400"
                        }`}
                      >
                        {group.marks != null ? (
                          <CheckCircle2 className="h-5 w-5 text-white" />
                        ) : (
                          <Clock className="h-5 w-5 text-white" />
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">Status</div>
                    <div className="text-sm font-extrabold text-slate-900">
                      {group.marks != null ? "Graded" : "Pending"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="ml-4 flex shrink-0 flex-col items-center gap-2">
                <div className="rounded-full bg-white/85 p-3 shadow-lg">
                  {expanded ? (
                    <ChevronUp className="h-6 w-6 text-slate-600" />
                  ) : (
                    <ChevronDown className="h-6 w-6 text-slate-600" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Expanded Content */}
          {expanded && (
            <div className="border-t border-slate-200/60 bg-slate-50/50 p-10">
              {/* Team Members */}
              <div className="mb-10">
                <div className="mb-5 flex items-center gap-3 text-base font-bold text-slate-700">
                  <Users className="h-5 w-5" />
                  Team Members ({group.members.length})
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {group.members.map((member) => (
                    <div
                      key={member._id}
                      className="flex items-center gap-4 rounded-2xl border border-white/60 bg-white/85 p-4 transition-all duration-300 hover:bg-white hover:shadow-lg"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-indigo-400 to-purple-400 text-base font-bold text-white">
                        {(member.username || member.email || "U")
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-slate-800">
                          {member.username || "Unknown User"}
                        </div>
                        {member.email && (
                          <div className="truncate text-xs text-slate-500">
                            {member.email}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {group.members.length === 0 && (
                    <div className="col-span-full py-6 text-center text-slate-500">
                      No members assigned to this group yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Grade & Feedback */}
              <div className="mb-10 rounded-2xl border border-white/60 bg-white/85 p-7">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xl font-bold text-slate-800">
                    <div className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 p-2.5">
                      <Award className="h-5 w-5 text-white" />
                    </div>
                    Group Assessment
                  </div>
                  <button
                    onClick={() => setEditing((v) => !v)}
                    className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-medium transition-all duration-300 ${
                      editing
                        ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                        : "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg hover:from-indigo-600 hover:to-purple-600 hover:shadow-xl"
                    }`}
                  >
                    <PencilLine className="h-4 w-4" />
                    {editing ? "Cancel" : "Edit Grade"}
                  </button>
                </div>

                {editing ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Grade {typeof points === "number" ? `(0 - ${points})` : ""}
                        </label>
                        <input
                          value={grade}
                          onChange={(e) => setGrade(e.target.value)}
                          placeholder="e.g., 95"
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Feedback
                        </label>
                        <textarea
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="Provide detailed feedback for the group's work..."
                          rows={4}
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => {
                          setGrade(group.marks != null ? String(group.marks) : "");
                          setFeedback(group.feedback || "");
                          setEditing(false);
                        }}
                        className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-medium text-slate-700 transition-all duration-300 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          onUpdate(validGradeNum, feedback);
                          setEditing(false);
                        }}
                        disabled={refreshing || (grade !== "" && validGradeNum === null)}
                        className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-8 py-3 font-bold text-white shadow-lg transition-all duration-300 hover:from-emerald-600 hover:to-green-600 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {refreshing ? (
                          <div className="flex items-center gap-2">
                            <RefreshCcw className="h-4 w-4 animate-spin" />
                            Saving...
                          </div>
                        ) : (
                          "Save Changes"
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-slate-600">Current Grade:</div>
                      <div className="flex items-center gap-2">
                        <span className="text-3xl font-extrabold text-slate-900">
                          {group.marks != null ? group.marks : "—"}
                        </span>
                        {typeof points === "number" && (
                          <span className="text-lg text-slate-400">/ {points}</span>
                        )}
                        {gradePercentage != null && (
                          <span
                            className={`ml-3 rounded-full px-3 py-1 text-sm font-bold text-white ${
                              gradePercentage >= 90
                                ? "bg-gradient-to-r from-emerald-500 to-green-500"
                                : gradePercentage >= 80
                                ? "bg-gradient-to-r from-blue-500 to-indigo-500"
                                : gradePercentage >= 70
                                ? "bg-gradient-to-r from-amber-500 to-orange-500"
                                : "bg-gradient-to-r from-red-500 to-rose-500"
                            }`}
                          >
                            {gradePercentage}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 text-sm text-slate-600">Feedback:</div>
                      <div className="rounded-xl bg-slate-50 p-4">
                        {group.feedback ? (
                          <p className="leading-relaxed text-slate-700">
                            {group.feedback}
                          </p>
                        ) : (
                          <p className="italic text-slate-400">
                            No feedback provided yet.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Submissions (attractive file cards) */}
              <div className="rounded-2xl border border-white/60 bg-white/85">
                <div className="flex items-center gap-3 border-b border-slate-200/60 p-7 text-xl font-bold text-slate-800">
                  <div className="rounded-xl bg-gradient-to-r from-blue-400 to-indigo-400 p-2.5">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  Submissions from {group.name || "Group"}
                </div>

                <div className="divide-y divide-slate-200/60">
                  {subsResponse?.submissions?.length ? (
                    subsResponse.submissions.map((submission) => (
                      <div key={submission._id} className="p-7">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="mb-3 flex flex-wrap items-center gap-3">
                              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                                <CheckCircle2 className="h-4 w-4" />
                                {submission.status || "Submitted"}
                              </span>
                              {typeof submission.plagiarismPercentage === "number" && (
                                <span
                                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
                                    submission.plagiarismPercentage > 20
                                      ? "bg-red-100 text-red-700"
                                      : submission.plagiarismPercentage > 10
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-green-100 text-green-700"
                                  }`}
                                >
                                  <AlertTriangle className="h-4 w-4" />
                                  Similarity: {Math.round(submission.plagiarismPercentage)}%
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-slate-600">
                              {submission.submittedAt
                                ? `Submitted on ${new Date(
                                    submission.submittedAt
                                  ).toLocaleDateString()} at ${new Date(
                                    submission.submittedAt
                                  ).toLocaleTimeString()}`
                                : "No submission timestamp available"}
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <div className="text-sm text-slate-600">Group Grade</div>
                            <div className="text-xl font-extrabold text-slate-900">
                              {group.marks != null ? group.marks : "—"}
                              {typeof points === "number" && (
                                <span className="ml-1 text-sm text-slate-400">
                                  / {points}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Files (glassy attractive mini-cards) */}
                        {submission.files?.length ? (
                          <div className="mt-5">
                            <div className="mb-3 text-sm font-medium text-slate-700">
                              Submitted Files ({submission.files.length})
                            </div>

                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                              {submission.files.map((file, fileIdx) => {
                                const ext = extOf(file.originalname);
                                const ring = extPalette(ext);
                                const absUrl = absoluteFileUrl(file.url);
                                const maybePreview = getPreviewUrl(file);
                                return (
                                  <div
                                    key={fileIdx}
                                    className="group relative rounded-2xl bg-white/90 p-5 shadow-sm ring-1 ring-slate-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                                  >
                                    {/* Gradient ring glow */}
                                    <div
                                      className={`pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br ${ring} opacity-0 blur-[10px] transition-opacity duration-300 group-hover:opacity-60`}
                                    />
                                    <div className="relative z-10 flex items-start gap-4">
                                      {/* Icon bubble */}
                                      <div className={`shrink-0 rounded-xl bg-gradient-to-br ${ring} p-3 text-white shadow-md`}>
                                        <FileText className="h-5 w-5" />
                                      </div>

                                      {/* Meta + Actions */}
                                      <div className="min-w-0 flex-1">
                                        <div className="truncate font-semibold text-slate-800 group-hover:text-slate-900">
                                          {file.originalname}
                                        </div>

                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                                            .{ext || "file"}
                                          </span>
                                          {file.filetype && (
                                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                                              {file.filetype}
                                            </span>
                                          )}
                                        </div>

                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                          <a
                                            href={absUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                                            title="Open / Download"
                                          >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                            Open
                                          </a>

                                          {maybePreview && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setPreviewName(file.originalname);
                                                setPreviewUrl(maybePreview);
                                              }}
                                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                                              title="Preview"
                                            >
                                              <Eye className="h-3.5 w-3.5" />
                                              Preview
                                            </button>
                                          )}

                                          <button
                                            type="button"
                                            onClick={async () => {
                                              try {
                                                await navigator.clipboard.writeText(absUrl);
                                              } catch {}
                                            }}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                                            title="Copy link"
                                          >
                                            <svg
                                              className="h-3.5 w-3.5"
                                              viewBox="0 0 24 24"
                                              fill="none"
                                              stroke="currentColor"
                                              strokeWidth="2"
                                            >
                                              <path d="M10 13a5 5 0 0 0 7.07 0l1.17-1.17a5 5 0 0 0-7.07-7.07L10 5" />
                                              <path d="M14 11a5 5 0 0 0-7.07 0L5.76 12.17a5 5 0 1 0 7.07 7.07L14 19" />
                                            </svg>
                                            Copy
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-5 rounded-xl bg-slate-50 p-5 text-center text-slate-500">
                            No files submitted with this entry.
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-12 text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                        <FileText className="h-8 w-8 text-slate-400" />
                      </div>
                      <p className="text-lg text-slate-500">
                        No submissions yet for this group.
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        Submissions will appear here when students upload their work.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setPreviewUrl(null)}
          />
          <div className="relative z-10 flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-4">
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold text-slate-800">
                  Preview: {previewName}
                </div>
                <p className="text-xs text-slate-500">
                  Uses Microsoft Office Web Viewer for Word/Excel/PPT, native for PDFs.
                </p>
              </div>
              <button
                onClick={() => setPreviewUrl(null)}
                className="rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
                aria-label="Close preview"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="h-[75vh] w-full bg-slate-50">
              <iframe
                src={previewUrl}
                title="File preview"
                className="h-full w-full"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* Animations */}
      <style jsx>{`
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out forwards;
          opacity: 0;
          transform: translateY(20px);
        }
        @keyframes fadeIn {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </>
  );
}
