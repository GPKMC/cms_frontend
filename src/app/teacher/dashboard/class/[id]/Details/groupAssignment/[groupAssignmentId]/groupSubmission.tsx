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
  TrendingUp,
  Activity,
  BookOpen,
  Download,
  Copy,
  PlayCircle,
} from "lucide-react";

/* =====================
   Types
===================== */
type UserLite = { _id: string; username?: string; email?: string };

type FileObj = {
  url: string;
  originalname: string;
  filetype?: string;
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
      await fetchGroups();
      await fetchGroupSubs(groupId);
    } catch (e) {
      console.error(e);
      alert("Failed to update grade/feedback");
    } finally {
      setRefreshing(false);
    }
  }

  async function toggleAcceptingSubmissions(newState: boolean) {
    if (!backendUrl) return;
    try {
      setRefreshing(true);
      setData((prev) =>
        prev
          ? {
              ...prev,
              assignment: {
                ...prev.assignment,
                acceptingSubmissions: newState,
              },
            }
          : prev
      );

      const res = await fetch(
        `${backendUrl}/groupassignmentgrading/group-assignments/${groupAssignmentId}/accepting`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({ acceptingSubmissions: newState }),
        }
      );
      if (!res.ok) throw new Error(await res.text());

      const json = await res.json();
      if (json?.assignment) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                assignment: {
                  ...prev.assignment,
                  acceptingSubmissions: !!json.assignment.acceptingSubmissions,
                  closeAt:
                    json.assignment.closeAt !== undefined
                      ? json.assignment.closeAt
                      : prev.assignment.closeAt,
                  title: json.assignment.title ?? prev.assignment.title,
                },
              }
            : prev
        );
      } else {
        await fetchGroups();
      }
    } catch (e) {
      console.error(e);
      alert("Failed to update submission status");
      setData((prev) =>
        prev
          ? {
              ...prev,
              assignment: {
                ...prev.assignment,
                acceptingSubmissions: !newState,
              },
            }
          : prev
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function closeNow() {
    if (!backendUrl) return;
    try {
      setRefreshing(true);
      setData((prev) =>
        prev
          ? {
              ...prev,
              assignment: {
                ...prev.assignment,
                acceptingSubmissions: false,
                closeAt: new Date().toISOString(),
              },
            }
          : prev
      );

      const res = await fetch(
        `${backendUrl}/groupassignmentgrading/group-assignments/${groupAssignmentId}/accepting`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({ closeNow: true }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      if (json?.assignment) {
        setData((prev) =>
          prev
            ? { ...prev, assignment: { ...prev.assignment, ...json.assignment } }
            : prev
        );
      } else {
        await fetchGroups();
      }
    } catch (e) {
      console.error(e);
      alert("Failed to close now");
      setData((prev) =>
        prev
          ? {
              ...prev,
              assignment: { ...prev.assignment, acceptingSubmissions: true },
            }
          : prev
      );
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchGroups();
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
      <div className="relative min-h-screen  overflow-hidden">
        {/* Animated particles */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute h-2 w-2  rounded-full animate-pulse opacity-60"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
              }}
            />
          ))}
        </div>

        {/* Main loading content */}
        <div className="relative z-10 flex min-h-screen items-center justify-center p-8">
          <div className="text-center">
            <div className="relative mb-8">
              <div className="mx-auto h-32 w-32 rounded-full  p-1 shadow-2xl">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-900">
                  <RefreshCcw className="h-16 w-16 animate-spin text-white" />
                </div>
              </div>
              <div className="absolute inset-0 rounded-full animate-ping opacity-20"></div>
            </div>
            <h2 className="mb-4 text-4xl font-black bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent">
              Loading Assignment Dashboard
            </h2>
            <p className="text-slate-300 text-lg">Fetching groups and submissions...</p>
            <div className="mt-8 flex justify-center">
              <div className="flex space-x-2">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-3 w-3  rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  ></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-rose-900 to-pink-900">
        <div className="flex min-h-screen items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="relative mb-8">
              <div className="mx-auto h-24 w-24 rounded-full bg-gradient-to-r from-red-500 to-rose-500 p-6 shadow-2xl">
                <AlertTriangle className="h-full w-full text-white" />
              </div>
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500 to-rose-500 animate-ping opacity-20"></div>
            </div>
            <h2 className="mb-6 text-3xl font-black text-white">
              Unable to Load Groups
            </h2>
            <p className="mb-8 text-lg text-red-200">{String(error)}</p>
            <button
              onClick={fetchGroups}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-500 to-rose-500 px-8 py-4 font-bold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-rose-400 translate-x-[-100%] transition-transform duration-500 group-hover:translate-x-0"></div>
              <span className="relative">Try Again</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const accepting = !!data.assignment.acceptingSubmissions;

  return (
    <div className="relative min-h-screen bg-primary/80 rounded-4xl overflow-hidden">
      {/* Enhanced background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-0 top-0 h-96 w-96 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute right-0 top-1/3 h-80 w-80 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-0 left-1/2 h-72 w-72 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl space-y-8 p-6">
        {/* Enhanced Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-2xl border border-white/20 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-transparent to-cyan-500/10"></div>
          
          <div className="relative p-8">
            <div className="flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-8">
                {/* Title Section */}
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-500 p-5 shadow-2xl">
                      <GraduationCap className="h-full w-full text-white" />
                    </div>
                    <div className="absolute -right-2 -top-2 h-8 w-8 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 flex items-center justify-center shadow-lg">
                      <Star className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold text-purple-300">
                      <Sparkles className="h-4 w-4" />
                      Assignment Dashboard
                    </div>
                    <h1 className="text-4xl font-black text-transparent bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text leading-tight">
                      {data.assignment.title}
                    </h1>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {typeof data.assignment.points === "number" && (
                    <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 p-6 transition-all duration-500 hover:scale-105 hover:bg-amber-500/25">
                      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent"></div>
                      <div className="relative flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                            Maximum Points
                          </div>
                          <div className="mt-1 text-3xl font-black text-white">
                            {data.assignment.points}
                          </div>
                        </div>
                        <div className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 p-3 shadow-lg">
                          <Target className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status Card with Actions */}
                  <div className={`group relative overflow-hidden rounded-2xl border p-6 transition-all duration-500 hover:scale-105 ${
                    accepting
                      ? "bg-gradient-to-br from-emerald-500/20 to-green-500/20 border-emerald-500/30 hover:bg-emerald-500/25"
                      : "bg-gradient-to-br from-rose-500/20 to-red-500/20 border-rose-500/30 hover:bg-rose-500/25"
                  }`}>
                    <div className="relative">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className={`text-xs font-bold uppercase tracking-wide ${
                            accepting ? "text-emerald-300" : "text-rose-300"
                          }`}>
                            Status
                          </div>
                          <div className="mt-1 text-2xl font-black text-white">
                            {accepting ? "Active" : "Closed"}
                          </div>
                        </div>
                        <div className={`rounded-xl p-3 shadow-lg ${
                          accepting
                            ? "bg-gradient-to-r from-emerald-400 to-green-400"
                            : "bg-gradient-to-r from-rose-400 to-red-400"
                        }`}>
                          {accepting ? (
                            <Zap className="h-6 w-6 text-white" />
                          ) : (
                            <XCircle className="h-6 w-6 text-white" />
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="space-y-2">
                        <button
                          onClick={() => toggleAcceptingSubmissions(!accepting)}
                          disabled={refreshing}
                          className={`w-full rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300 ${
                            accepting
                              ? "bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600"
                              : "bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600"
                          } text-white shadow-lg hover:shadow-xl disabled:opacity-50`}
                        >
                          {refreshing ? "Updating..." : accepting ? "Close Submissions" : "Open Submissions"}
                        </button>

                        {accepting && (
                          <button
                            onClick={closeNow}
                            disabled={refreshing}
                            className="w-full rounded-xl bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 transition-all duration-300 disabled:opacity-50"
                          >
                            {refreshing ? "Closing..." : "Close Now"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 p-6 transition-all duration-500 hover:scale-105 hover:bg-blue-500/25">
                    <div className="relative flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-blue-300 uppercase tracking-wide">
                          Total Groups
                        </div>
                        <div className="mt-1 text-3xl font-black text-white">
                          {data.groupsCount}
                        </div>
                      </div>
                      <div className="rounded-xl bg-gradient-to-r from-blue-400 to-indigo-400 p-3 shadow-lg">
                        <Users className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </div>

                  {typeof data.assignment.points === "number" && (
                    <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 p-6 transition-all duration-500 hover:scale-105 hover:bg-purple-500/25">
                      <div className="relative flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-purple-300 uppercase tracking-wide">
                            Graded
                          </div>
                          <div className="mt-1 text-3xl font-black text-white">
                            {data.groups.filter((g) => g.marks != null).length}
                          </div>
                        </div>
                        <div className="rounded-xl bg-gradient-to-r from-purple-400 to-pink-400 p-3 shadow-lg">
                          <Trophy className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </div>
                  )}

                  {data.assignment.closeAt && (
                    <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-500/20 to-gray-500/20 border border-slate-500/30 p-6 transition-all duration-500 hover:scale-105 hover:bg-slate-500/25 sm:col-span-2 lg:col-span-4">
                      <div className="relative flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                            Submission Deadline
                          </div>
                          <div className="mt-1 text-xl font-black text-white">
                            {new Date(data.assignment.closeAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="rounded-xl bg-gradient-to-r from-slate-400 to-gray-400 p-3 shadow-lg">
                          <Calendar className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Search and Actions */}
              <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center xl:flex-col xl:items-stretch">
                <div className="relative group">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search groups..."
                    className="w-full rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 px-14 py-4 text-white placeholder-white/60 focus:bg-white/15 focus:border-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-400/25 transition-all duration-300 sm:w-80"
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 p-2">
                    <Search className="h-4 w-4 text-white" />
                  </div>
                </div>

                <button
                  onClick={fetchGroups}
                  className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 px-8 py-4 font-bold text-white shadow-lg transition-all duration-500 hover:scale-105 hover:shadow-2xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 translate-x-[-100%] transition-transform duration-500 group-hover:translate-x-0"></div>
                  <div className="relative flex items-center gap-3">
                    <RefreshCcw className="h-5 w-5 transition-transform duration-300 group-hover:rotate-180" />
                    <span>Refresh</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Groups Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 2xl:grid-cols-2">
          {filteredGroups.map((g, index) => (
            <GroupCard
              key={g._id}
              group={g}
              points={data.assignment.points}
              expanded={expandedGroupId === g._id}
              onToggle={() => toggleExpand(g._id)}
              subsResponse={subs[g._id]}
              onUpdate={(grade, feedback) => updateGroupGrade(g._id, grade, feedback)}
              refreshing={refreshing}
              backendUrl={backendUrl}
              index={index}
            />
          ))}
        </div>

        {filteredGroups.length === 0 && (
          <div className="py-20 text-center">
            <div className="mx-auto max-w-lg rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 p-16 shadow-2xl">
              <div className="mx-auto mb-8 h-24 w-24 rounded-3xl bg-gradient-to-r from-slate-400 to-gray-400 flex items-center justify-center">
                <Search className="h-12 w-12 text-white" />
              </div>
              <h3 className="mb-6 text-3xl font-black text-white">
                No Groups Found
              </h3>
              <p className="text-slate-300 text-lg">
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
   Enhanced Group Card
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
    "from-blue-500/20 to-indigo-600/20",
    "from-purple-500/20 to-pink-600/20",
    "from-emerald-500/20 to-teal-600/20",
    "from-orange-500/20 to-red-600/20",
    "from-cyan-500/20 to-blue-600/20",
    "from-violet-500/20 to-purple-600/20",
    "from-rose-500/20 to-pink-600/20",
    "from-amber-500/20 to-orange-600/20",
  ];

  const borderGradients = [
    "border-blue-500/30",
    "border-purple-500/30",
    "border-emerald-500/30",
    "border-orange-500/30",
    "border-cyan-500/30",
    "border-violet-500/30",
    "border-rose-500/30",
    "border-amber-500/30",
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
  const borderColor = borderGradients[index % borderGradients.length];
  const iconColor = iconColors[index % iconColors.length];

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return "from-emerald-400 to-green-500";
    if (percentage >= 80) return "from-blue-400 to-indigo-500";
    if (percentage >= 70) return "from-amber-400 to-orange-500";
    return "from-red-400 to-rose-500";
  };

  // File helpers
  function absoluteFileUrl(pathOrUrl: string) {
    if (!pathOrUrl) return "";
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    if (backendUrl) {
      return `${backendUrl.replace(/\/+$/, "")}/${pathOrUrl.replace(/^\/+/, "")}`;
    }
    return pathOrUrl;
  }

  function extOf(name: string) {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    return ext;
  }

  function extPalette(ext: string) {
    if (["pdf"].includes(ext)) return "from-red-400/70 to-red-500/70";
    if (["doc", "docx"].includes(ext)) return "from-blue-400/70 to-indigo-500/70";
    if (["xls", "xlsx", "csv"].includes(ext)) return "from-emerald-400/70 to-teal-500/70";
    if (["ppt", "pptx"].includes(ext)) return "from-orange-400/70 to-red-500/70";
    if (["zip", "rar", "7z"].includes(ext)) return "from-slate-400/70 to-gray-500/70";
    if (["png","jpg","jpeg","gif","webp","svg"].includes(ext)) return "from-purple-400/70 to-pink-500/70";
    if (["js","ts","tsx","py","java","c","cpp","rb","go","php"].includes(ext)) return "from-violet-400/70 to-purple-500/70";
    return "from-slate-400/70 to-slate-500/70";
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
        className="group relative"
        style={{
          animation: `fadeInUp 0.6s ease-out ${index * 120}ms both`,
        }}
      >
        <div className={`relative overflow-hidden rounded-3xl  backdrop-blur-xl border shadow-2xl transition-all duration-700 hover:scale-[1.02] hover:shadow-3xl`}>
          
          {/* Floating Grade Badge */}
          {group.marks != null && gradePercentage != null && (
            <div className="absolute right-6 top-6 z-10">
              <div className={`rounded-2xl bg-gradient-to-r ${getGradeColor(gradePercentage)} px-4 py-2 text-white shadow-xl border border-white/20`}>
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  <span className="font-bold">{gradePercentage}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Header Section */}
          <div
            className="group/header relative cursor-pointer overflow-hidden p-8 transition-all duration-500 hover:bg-white/5"
            onClick={onToggle}
          >
            <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-white/0 via-white/10 to-white/0 transition-transform duration-1000 group-hover/header:translate-x-[100%]" />

            <div className="relative z-10 flex items-start justify-between">
              <div className="min-w-0 flex-1 pr-6">
                <div className="mb-6 flex items-center gap-5">
                  <div className="relative">
                    <div className={`rounded-2xl bg-gradient-to-br ${iconColor} p-4 text-white shadow-xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-2xl`}>
                      <Users className="h-8 w-8" />
                    </div>
                    <div className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 text-xs font-bold text-white shadow-lg">
                      {group.members.length}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold text-purple-300">
                      <Lightbulb className="h-4 w-4" />
                      Group Project
                    </div>
                    <h3 className="text-2xl font-black leading-tight text-white">
                      {group.name || "Unnamed Group"}
                    </h3>
                    {group.marks != null && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-sm text-slate-300">Grade:</span>
                        <span className="text-xl font-extrabold text-white">
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
                  <div className="mb-6 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-4">
                    <div className="mb-2 text-xs font-medium text-slate-300 uppercase tracking-wide">
                      Project Description
                    </div>
                    <p className="line-clamp-3 leading-relaxed text-sm text-white/90">
                      {group.task}
                    </p>
                  </div>
                )}

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 p-4 text-center transition-all duration-300 hover:bg-white/15">
                    <div className="mb-2 flex items-center justify-center">
                      <div className="rounded-lg bg-gradient-to-r from-blue-400 to-indigo-400 p-2">
                        <FileText className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <div className="text-xs text-slate-300">Submissions</div>
                    <div className="text-xl font-extrabold text-white">
                      {group.submissionCount}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 p-4 text-center transition-all duration-300 hover:bg-white/15">
                    <div className="mb-2 flex items-center justify-center">
                      <div className="rounded-lg bg-gradient-to-r from-purple-400 to-pink-400 p-2">
                        <Users className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <div className="text-xs text-slate-300">Members</div>
                    <div className="text-xl font-extrabold text-white">
                      {group.members.length}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 p-4 text-center transition-all duration-300 hover:bg-white/15">
                    <div className="mb-2 flex items-center justify-center">
                      <div className={`rounded-lg p-2 ${
                        group.marks != null
                          ? "bg-gradient-to-r from-emerald-400 to-green-400"
                          : "bg-gradient-to-r from-slate-400 to-gray-400"
                      }`}>
                        {group.marks != null ? (
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        ) : (
                          <Clock className="h-4 w-4 text-white" />
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-slate-300">Status</div>
                    <div className="text-sm font-extrabold text-white">
                      {group.marks != null ? "Graded" : "Pending"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="ml-4 flex shrink-0 flex-col items-center">
                <div className="rounded-full bg-white/10 border border-white/20 p-3 shadow-lg transition-all duration-300 hover:bg-white/15">
                  {expanded ? (
                    <ChevronUp className="h-5 w-5 text-white" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-white" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Expanded Content */}
          {expanded && (
            <div className="border-t border-white/20 bg-black/20 p-8">
              {/* Team Members */}
              <div className="mb-8">
                <div className="mb-5 flex items-center gap-3 text-base font-bold text-white">
                  <Users className="h-5 w-5" />
                  Team Members ({group.members.length})
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {group.members.map((member) => (
                    <div
                      key={member._id}
                      className="flex items-center gap-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-4 transition-all duration-300 hover:bg-white/15"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-purple-400 to-pink-400 text-base font-bold text-white shadow-lg">
                        {(member.username || member.email || "U")
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-white">
                          {member.username || "Unknown User"}
                        </div>
                        {member.email && (
                          <div className="truncate text-xs text-slate-300">
                            {member.email}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {group.members.length === 0 && (
                    <div className="col-span-full py-6 text-center text-slate-300">
                      No members assigned to this group yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Grade & Feedback */}
              <div className="mb-8 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xl font-bold text-white">
                    <div className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 p-2.5">
                      <Award className="h-5 w-5 text-white" />
                    </div>
                    Group Assessment
                  </div>
                  <button
                    onClick={() => setEditing((v) => !v)}
                    className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-medium transition-all duration-300 ${
                      editing
                        ? "bg-white/20 text-white hover:bg-white/25"
                        : "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg hover:from-purple-600 hover:to-pink-600 hover:shadow-xl"
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
                        <label className="mb-2 block text-sm font-medium text-slate-200">
                          Grade {typeof points === "number" ? `(0 - ${points})` : ""}
                        </label>
                        <input
                          value={grade}
                          onChange={(e) => setGrade(e.target.value)}
                          placeholder="e.g., 95"
                          className="w-full rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-3 text-lg text-white placeholder-white/60 focus:bg-white/15 focus:border-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-400/25"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-slate-200">
                          Feedback
                        </label>
                        <textarea
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="Provide detailed feedback for the group's work..."
                          rows={4}
                          className="w-full rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-3 text-white placeholder-white/60 focus:bg-white/15 focus:border-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-400/25"
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
                        className="rounded-xl bg-white/20 hover:bg-white/25 px-6 py-3 font-medium text-white transition-all duration-300"
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
                      <div className="text-sm text-slate-300">Current Grade:</div>
                      <div className="flex items-center gap-2">
                        <span className="text-3xl font-extrabold text-white">
                          {group.marks != null ? group.marks : "—"}
                        </span>
                        {typeof points === "number" && (
                          <span className="text-lg text-slate-400">/ {points}</span>
                        )}
                        {gradePercentage != null && (
                          <span className={`ml-3 rounded-full px-3 py-1 text-sm font-bold text-white ${
                            gradePercentage >= 90
                              ? "bg-gradient-to-r from-emerald-500 to-green-500"
                              : gradePercentage >= 80
                              ? "bg-gradient-to-r from-blue-500 to-indigo-500"
                              : gradePercentage >= 70
                              ? "bg-gradient-to-r from-amber-500 to-orange-500"
                              : "bg-gradient-to-r from-red-500 to-rose-500"
                          }`}>
                            {gradePercentage}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 text-sm text-slate-300">Feedback:</div>
                      <div className="rounded-xl bg-black/20 border border-white/10 p-4">
                        {group.feedback ? (
                          <p className="leading-relaxed text-white/90">
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

              {/* Submissions */}
              <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                <div className="flex items-center gap-3 border-b border-white/20 p-6 text-xl font-bold text-white">
                  <div className="rounded-xl bg-gradient-to-r from-blue-400 to-indigo-400 p-2.5">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  Submissions from {group.name || "Group"}
                </div>

                <div className="divide-y divide-white/10">
                  {subsResponse?.submissions?.length ? (
                    subsResponse.submissions.map((submission) => (
                      <div key={submission._id} className="p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="mb-3 flex flex-wrap items-center gap-3">
                              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-sm font-medium text-emerald-300">
                                <CheckCircle2 className="h-4 w-4" />
                                {submission.status || "Submitted"}
                              </span>
                              {typeof submission.plagiarismPercentage === "number" && (
                                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${
                                  submission.plagiarismPercentage > 20
                                    ? "bg-red-500/20 border-red-400/30 text-red-300"
                                    : submission.plagiarismPercentage > 10
                                    ? "bg-amber-500/20 border-amber-400/30 text-amber-300"
                                    : "bg-green-500/20 border-green-400/30 text-green-300"
                                }`}>
                                  <AlertTriangle className="h-4 w-4" />
                                  Similarity: {Math.round(submission.plagiarismPercentage)}%
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-slate-300">
                              {submission.submittedAt
                                ? `Submitted on ${new Date(submission.submittedAt).toLocaleDateString()} at ${new Date(submission.submittedAt).toLocaleTimeString()}`
                                : "No submission timestamp available"}
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <div className="text-sm text-slate-300">Group Grade</div>
                            <div className="text-xl font-extrabold text-white">
                              {group.marks != null ? group.marks : "—"}
                              {typeof points === "number" && (
                                <span className="ml-1 text-sm text-slate-400">
                                  / {points}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Files */}
                        {submission.files?.length ? (
                          <div className="mt-5">
                            <div className="mb-3 text-sm font-medium text-slate-200">
                              Submitted Files ({submission.files.length})
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                              {submission.files.map((file, fileIdx) => {
                                const ext = extOf(file.originalname);
                                const ring = extPalette(ext);
                                const absUrl = absoluteFileUrl(file.url);
                                const maybePreview = getPreviewUrl(file);
                                return (
                                  <div
                                    key={fileIdx}
                                    className="group relative rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-4 transition-all duration-300 hover:bg-white/10 hover:scale-[1.02]"
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className={`shrink-0 rounded-lg bg-gradient-to-br ${ring} p-2.5 text-white shadow-lg`}>
                                        <FileText className="h-4 w-4" />
                                      </div>

                                      <div className="min-w-0 flex-1">
                                        <div className="truncate font-semibold text-white group-hover:text-white">
                                          {file.originalname}
                                        </div>

                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                          <span className="inline-flex items-center rounded-full bg-white/10 border border-white/20 px-2.5 py-0.5 text-xs font-medium text-slate-300">
                                            .{ext || "file"}
                                          </span>
                                          {file.filetype && (
                                            <span className="inline-flex items-center rounded-full bg-white/10 border border-white/20 px-2.5 py-0.5 text-xs font-medium text-slate-300">
                                              {file.filetype}
                                            </span>
                                          )}
                                        </div>

                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                          <a
                                            href={absUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/15"
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
                                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/25"
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
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/15"
                                          >
                                            <Copy className="h-3.5 w-3.5" />
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
                          <div className="mt-5 rounded-xl bg-black/20 border border-white/10 p-5 text-center text-slate-300">
                            No files submitted with this entry.
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-12 text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
                        <FileText className="h-8 w-8 text-slate-400" />
                      </div>
                      <p className="text-lg text-slate-300">
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
    className="fixed inset-0 z-[9999] grid place-items-center p-6 bg-black/80 backdrop-blur-md"
    role="dialog"
    aria-modal="true"
  >
    <div className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-slate-900 border border-white/20 shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/20 p-4">
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold text-white">
            Preview: {previewName}
          </div>
          <p className="text-xs text-slate-400">
            Uses Microsoft Office Web Viewer for Word/Excel/PPT, native for PDFs.
          </p>
        </div>
        <button
          onClick={() => setPreviewUrl(null)}
          className="rounded-lg bg-white/10 hover:bg-white/15 p-2 text-white transition-colors duration-200"
          aria-label="Close preview"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>
      <div className="h-[65vh] w-full bg-slate-800">
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


      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
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