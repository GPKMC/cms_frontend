"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpenCheck,
  Users,
  ListChecks,
  Sparkles,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Save,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Coffee,
  Star,
  Activity,
  BookOpen,
  PlusCircle,
  X,
  Send,
} from "lucide-react";
import { useUser } from "./teacherContext";
import TiptapEditor from "./components/tiptap";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
type ItemType = "Assignment" | "groupAssignment" | "Question" | "quiz";

type ItemRow = {
  id: string;
  type: string; // keep runtime flexible; we’ll normalize it
  title: string;
  courseInstanceId: string | null;
  dueAt?: string | null;
};

type Holiday = {
  name: string;
  description: string;
  date: string;
  type: string[];
};

type CourseInstance = {
  _id: string;
  course: { name: string };
  studentCount: number;
};

type LeaveItem = {
  _id: string;
  leaveDate: string; // YYYY-MM-DD
  dayPart: "full" | "first_half" | "second_half";
  type: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reason?: string;
  rejectionReason?: string;
  createdAt?: string;
};

type LeaveTypeTpl = { id: string; label: string; defaultReason?: string };

// ──────────────────────────────────────────────────────────────────────────────
const TYPE_LABEL: Record<ItemType, string> = {
  Assignment: "Assignment",
  groupAssignment: "Group Assignment",
  Question: "Question",
  quiz: "Quiz",
};

const TYPE_CONFIG: Record<
  ItemType,
  { icon: React.ComponentType<any>; color: string; bgColor: string }
> = {
  Assignment: { icon: BookOpenCheck, color: "text-blue-600", bgColor: "bg-blue-100" },
  groupAssignment: { icon: Users, color: "text-green-600", bgColor: "bg-green-100" },
  Question: { icon: ListChecks, color: "text-purple-600", bgColor: "bg-purple-100" },
  quiz: { icon: Sparkles, color: "text-yellow-600", bgColor: "bg-yellow-100" },
};

const DEFAULT_CONFIG = {
  icon: Sparkles,
  color: "text-gray-600",
  bgColor: "bg-gray-100",
};

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "";
const TZ = "Asia/Kathmandu";
const ymdNepal = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // YYYY-MM-DD

const getTimeBasedGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 6) return { greeting: "Good Night", icon: Moon, color: "from-indigo-600 to-purple-600" };
  if (hour < 12) return { greeting: "Good Morning", icon: Sunrise, color: "from-orange-500 to-pink-500" };
  if (hour < 17) return { greeting: "Good Afternoon", icon: Sun, color: "from-yellow-500 to-orange-500" };
  if (hour < 21) return { greeting: "Good Evening", icon: Sunset, color: "from-orange-600 to-red-500" };
  return { greeting: "Good Night", icon: Moon, color: "from-indigo-600 to-purple-600" };
};

// Normalize any backend/legacy values into your display keys
const normalizeToDisplayType = (t: string): ItemType => {
  const s = String(t || "").trim();
  if (/^assignments?$/i.test(s)) return "Assignment";           // "assignment" or "Assignments"
  if (/^question$/i.test(s)) return "Question";                 // "question" or "Question"
  if (/^group[-_ ]?assignment$/i.test(s)) return "groupAssignment";
  if (/^quiz$/i.test(s)) return "quiz";
  // default to Assignment if unknown
  return "Assignment";
};

// Map display type to your route segment rules without changing your routes
const routeTypeFor = (displayType: ItemType) => {
  if (displayType === "Assignment") return "Assignment"; // keep route as "Assignments"
  return displayType; // "Question", "quiz", "groupAssignment" stay as-is (per your note)
};

// Mock schedule (replace with your ScheduleEvent fetch)
const mockSchedule = [
  { subject: "Advanced Mathematics", time: "10:00 AM", room: "Room 101", status: "upcoming", color: "bg-blue-500" },
  { subject: "Physics Lab", time: "01:00 PM", room: "Lab 205", status: "current", color: "bg-green-500" },
  { subject: "English Literature", time: "03:00 PM", room: "Room 303", status: "upcoming", color: "bg-purple-500" },
];

// Small helpers
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const htmlIsEmpty = (html?: string) => !stripHtml(html || "").length;

// ──────────────────────────────────────────────────────────────────────────────
export default function TeacherDashboard() {
  const router = useRouter();
  const { user } = useUser();
  const teacherId = (user as any)?._id || (user as any)?.id;

  const [items, setItems] = useState<ItemRow[]>([]);
  const [allItems, setAllItems] = useState<ItemRow[]>([]);
  const [courses, setCourses] = useState<CourseInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState(false);

  // Leave state
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeTpl[]>([]);
const [dayParts, setDayParts] = useState<string[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveItem[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(true);
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leaveDate: ymdNepal(),
    type: "sick",
    dayPart: "full" as "full" | "first_half" | "second_half",
    reason: "",
    customMessage: "", // HTML for email body
  });
  const [leaveToast, setLeaveToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const getToken = () =>
    (typeof window !== "undefined" &&
      (localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher"))) || "";

  // Fetchers
  const fetchTemplates = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API}/leave/templates?role=teacher`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setLeaveTypes((data.types || []) as LeaveTypeTpl[]);
      setDayParts(data.dayParts || ["full", "first_half", "second_half"]);
    } catch (e) {
      console.error("Failed to fetch leave templates", e);
    }
  };

  const fetchMyLeaves = async () => {
    setLoadingLeaves(true);
    try {
      const token = getToken();
      const res = await fetch(`${API}/leave/teacher/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMyLeaves((data.items || []) as LeaveItem[]);
    } catch (e) {
      console.error("Failed to fetch my leaves", e);
    } finally {
      setLoadingLeaves(false);
    }
  };

  const fetchAssignments = async () => {
    if (!teacherId || !API) return;
    setLoading(true);
    const token = getToken();
    try {
      const res = await fetch(`${API}/overallAssignment/teacher/${teacherId}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      const sortedItems = (data.items || []).sort((a: any, b: any) => {
        const dateA = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
        const dateB = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
        return dateA - dateB;
      });

      const teacherCourseIds = courses.map((c) => c._id);
      const filteredItems = sortedItems.filter((item: any) =>
        teacherCourseIds.includes(item.courseInstanceId)
      );

      setAllItems(filteredItems);
      setItems(filteredItems.slice(0, 5));
    } catch (e) {
      console.error("Failed to fetch assignments", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    if (!teacherId || !API) return;
    const token = getToken();
    try {
      const res = await fetch(`${API}/teacher-routes/my-course-instances`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCourses(data.courseInstances || []);
    } catch (e) {
      console.error("Failed to fetch courses", e);
    }
  };

  const fetchCalendar = async () => {
    try {
      const res = await fetch(`${API}/calendar`);
      const data = await res.json();
      setHolidays(data.holidays || []);
    } catch (e) {
      console.error("Failed to fetch calendar", e);
    } finally {
      setLoadingCalendar(false);
    }
  };

  // Defaults based on selected type
  const defaultMsgForType = useMemo(() => {
    const t = leaveTypes.find((x) => x.id === leaveForm.type);
    return (t?.defaultReason || "").trim();
  }, [leaveTypes, leaveForm.type]);

  // Submit Leave — close modal on both success & failure
  const submitLeave = async () => {
    if (submittingLeave) return;
    setSubmittingLeave(true);
    setLeaveToast(null);

    try {
      const token = getToken();

      const payload = {
        ...leaveForm,
        customMessage: htmlIsEmpty(leaveForm.customMessage)
          ? (defaultMsgForType ? `<p>${defaultMsgForType}</p>` : "")
          : leaveForm.customMessage,
        customMessageText: (() => {
          const html = htmlIsEmpty(leaveForm.customMessage)
            ? defaultMsgForType
            : stripHtml(leaveForm.customMessage);
          return html || leaveForm.reason || "";
        })(),
      };

      const res = await fetch(`${API}/leave/teacher/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to request leave");

      setLeaveForm({
        leaveDate: ymdNepal(),
        type: "sick",
        dayPart: "full",
        reason: "",
        customMessage: "",
      });
      setLeaveToast({ ok: true, msg: "Leave requested successfully." });
      fetchMyLeaves();
    } catch (e: any) {
      setLeaveToast({ ok: false, msg: e.message });
    } finally {
      setSubmittingLeave(false);
      setShowLeaveModal(false);
      setTimeout(() => setLeaveToast(null), 3000);
    }
  };

  const cancelLeave = async (id: string) => {
    try {
      const token = getToken();
      const res = await fetch(`${API}/leave/teacher/${id}/cancel`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d?.error || "Failed to cancel");
      }
      setLeaveToast({ ok: true, msg: "Leave cancelled." });
      fetchMyLeaves();
    } catch (e: any) {
      setLeaveToast({ ok: false, msg: e.message });
    } finally {
      setTimeout(() => setLeaveToast(null), 2500);
    }
  };

  // Effects
  useEffect(() => {
    const savedNote = localStorage.getItem("dailyNote") || "";
    setNote(savedNote);
  }, []);

  useEffect(() => {
    fetchCourses();
    fetchTemplates();
    fetchMyLeaves();
  }, [teacherId]);

  useEffect(() => {
    fetchAssignments();
    fetchCalendar();
  }, [courses]);

  // Helpers
  const saveNote = () => {
    localStorage.setItem("dailyNote", note);
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 2000);
  };

  const today = new Date().toISOString().split("T")[0];
  const todayEvents = holidays.filter((h) => h.date === today);
  const { greeting, icon: GreetingIcon, color } = getTimeBasedGreeting();

  const stats = useMemo(
    () => [
      { label: "Active Courses", value: courses.length.toString(), icon: BookOpen, color: "text-blue-600", bg: "bg-blue-100" },
      { label: "Total Students", value: courses.reduce((sum, c) => sum + (c.studentCount || 0), 0).toString(), icon: Users, color: "text-green-600", bg: "bg-green-100" },
      { label: "Total Assignments", value: allItems.length.toString(), icon: ListChecks, color: "text-purple-600", bg: "bg-purple-100" },
    ],
    [courses, allItems]
  );

  const badgeForStatus = (s: LeaveItem["status"]) =>
    s === "approved"
      ? "bg-emerald-100 text-emerald-700"
      : s === "rejected"
      ? "bg-rose-100 text-rose-700"
      : s === "cancelled"
      ? "bg-gray-100 text-gray-600"
      : "bg-amber-100 text-amber-700";

  const dayPartLabel = (p: LeaveItem["dayPart"]) =>
    p === "first_half" ? "First Half" : p === "second_half" ? "Second Half" : "Full Day";

  // ────────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className={`bg-gradient-to-r ${color} text-white p-8 rounded-3xl shadow-lg relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-64 h-64 opacity-10">
            <GreetingIcon className="w-full h-full" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                  <GreetingIcon className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold">
                    {greeting}, {user?.username || "Teacher"}!
                  </h1>
                  <p className="text-white/90 mt-2 text-lg">Ready to make today amazing? Here's your dashboard.</p>
                </div>
              </div>

              {/* Ask for Leave Button */}
              <button
                onClick={() => setShowLeaveModal(true)}
                className="inline-flex items-center gap-2 bg-white text-blue-700 font-semibold px-4 py-2 rounded-xl shadow hover:bg-blue-50"
                title="Ask for leave"
              >
                <PlusCircle className="h-5 w-5" /> Ask for Leave
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {stats.map((stat, index) => (
                <div key={index} className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 ${stat.bg} rounded-lg`}>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-white/80 text-sm">{stat.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Toast */}
        {leaveToast && (
          <div
            className={`max-w-7xl mx-auto ${
              leaveToast.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
            } border rounded-xl p-3 border-current/10`}
          >
            {leaveToast.msg}
          </div>
        )}

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Today's Schedule */}
          <div className="lg:col-span-2 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Today's Schedule</h2>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>

            <div className="space-y-4">
              {mockSchedule.map((item, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl border-l-4 ${
                    item.status === "current" ? "bg-green-50 border-green-500" : "bg-gray-50 border-gray-300"
                  } hover:shadow-md transition-all duration-200`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{item.subject}</h3>
                        <p className="text-sm text-gray-600">{item.room}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{item.time}</p>
                      {item.status === "current" && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                          <Activity className="h-3 w-3" />
                          Live
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              className="mt-6 w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors font-semibold"
              onClick={() => router.push("/teacher/dashboard/schedule")}
            >
              View Full Schedule
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>

          {/* Assignments Section */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-xl">
                  <BookOpenCheck className="h-6 w-6 text-purple-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Recent Assignments</h2>
              </div>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-16 bg-gray-200 rounded-xl"></div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8">
                <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <BookOpenCheck className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500">No assignments found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const displayType = normalizeToDisplayType(item.type);
                  const config = TYPE_CONFIG[displayType] || DEFAULT_CONFIG;
                  const Icon = config.icon as any;
                  const dueDate = item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "No due date";
                  const isOverdue = item.dueAt && new Date(item.dueAt) < new Date();
                  const routeType = routeTypeFor(displayType);

                  return (
                    <div
                      key={item.id}
                      className="group p-4 border border-gray-200 rounded-xl hover:shadow-lg hover:border-blue-200 transition-all duration-200 cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/teacher/dashboard/class/${item.courseInstanceId}/Details/${routeType}/${item.id}`
                        )
                      }
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 ${config.bgColor} rounded-lg group-hover:scale-110 transition-transform`}>
                          <Icon className={`w-5 h-5 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                            {item.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-1 rounded-full ${config.bgColor} ${config.color} font-medium`}>
                              {TYPE_LABEL[displayType]}
                            </span>
                            <span className={`text-xs ${isOverdue ? "text-red-500" : "text-gray-500"}`}>Due: {dueDate}</span>
                          </div>
                        </div>
                        {isOverdue && <AlertCircle className="h-4 w-4 text-red-500" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              className="mt-6 w-full flex items-center justify-center gap-2 text-blue-600 border-2 border-blue-600 px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors font-semibold"
              onClick={() => router.push("/teacher/dashboard/assignments")}
            >
              View All Assignments
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Daily Notes */}
          <div className="lg:col-span-2 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-xl">
                  <Coffee className="h-6 w-6 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Daily Notes</h2>
              </div>
              <div className="text-sm text-gray-500">
                {new Date().toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>

            <textarea
              placeholder="What's on your mind today? Jot down important reminders, observations, or reflections..."
              className="w-full border border-gray-300 rounded-xl p-4 h-36 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white/50 backdrop-blur-sm transition-all"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <button
              className={`mt-4 flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                savedNote ? "bg-green-500 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
              onClick={saveNote}
            >
              {savedNote ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Note Saved!
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  Save Note
                </>
              )}
            </button>
          </div>

          {/* Calendar & Today's Events + My Leaves */}
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-orange-100 rounded-xl">
                  <Star className="h-6 w-6 text-orange-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Today</h2>
              </div>

              <div className="text-center bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 mb-6">
                <p className="text-5xl font-bold text-gray-900 mb-2">{new Date().getDate()}</p>
                <p className="text-gray-600 font-medium">
                  {new Date().toLocaleString("default", { month: "long", year: "numeric" })}
                </p>
                <p className="text-sm text-gray-500 mt-1">{new Date().toLocaleString("default", { weekday: "long" })}</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  Today's Events
                </h3>

                {loadingCalendar ? (
                  <div className="space-y-3">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-12 bg-gray-200 rounded-lg"></div>
                      </div>
                    ))}
                  </div>
                ) : todayEvents.length === 0 ? (
                  <div className="text-center py-4">
                    <div className="p-3 bg-gray-100 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="text-gray-500 text-sm">No special events today</p>
                    <p className="text-gray-400 text-xs mt-1">Have a productive day!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayEvents.map((event, idx) => (
                      <div key={idx} className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          <div>
                            <p className="font-medium text-gray-900">{event.name}</p>
                            <p className="text-sm text-gray-600">{event.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* My Leaves */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">My Leave Requests</h2>
                <button onClick={fetchMyLeaves} className="text-sm text-blue-600 hover:text-blue-700">
                  Refresh
                </button>
              </div>

              {loadingLeaves ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : myLeaves.length === 0 ? (
                <p className="text-sm text-gray-500">You haven’t requested any leave yet.</p>
              ) : (
                <ul className="space-y-2">
                  {myLeaves.map((lv) => (
                    <li key={lv._id} className="p-3 rounded-lg border border-gray-200 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">
                          {lv.leaveDate} • {dayPartLabel(lv.dayPart)}
                        </div>
                        <div className="text-sm text-gray-600 capitalize">
                          {lv.type} {lv.reason ? `— ${lv.reason}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${badgeForStatus(lv.status)}`}>{lv.status}</span>
                        {lv.status === "pending" && (
                          <button
                            onClick={() => cancelLeave(lv._id)}
                            className="text-xs px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Leave Request Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Request Leave</h3>
                <p className="text-sm text-gray-600 mt-1">Submit your leave request with detailed information</p>
              </div>
              <button
                className="p-2 hover:bg-white/80 rounded-xl transition-colors"
                onClick={() => setShowLeaveModal(false)}
                title="Close"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-4">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Date</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  value={leaveForm.leaveDate}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, leaveDate: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-r from-gray-50 to-purple-50 rounded-xl p-4">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Leave Type</label>
                  <select
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    value={leaveForm.type}
                    onChange={(e) => {
                      const value = e.target.value;
                      const tpl = leaveTypes.find((t) => t.id === value);
                      setLeaveForm((f) => ({
                        ...f,
                        type: value,
                        customMessage:
                          htmlIsEmpty(f.customMessage) && tpl?.defaultReason
                            ? `<p>${tpl.defaultReason}</p>`
                            : f.customMessage,
                      }));
                    }}
                  >
                    {leaveTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bg-gradient-to-r from-gray-50 to-green-50 rounded-xl p-4">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Duration</label>
                  <select
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    value={leaveForm.dayPart}
                    onChange={(e) => setLeaveForm((f) => ({ ...f, dayPart: e.target.value as any }))}
                  >
                    {dayParts.map((p) => (
                      <option key={p} value={p}>
                        {p === "first_half" ? "First Half" : p === "second_half" ? "Second Half" : "Full Day"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-gradient-to-r from-gray-50 to-yellow-50 rounded-xl p-4">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Brief Reason (Internal)</label>
                <input
                  type="text"
                  placeholder="Short internal note (optional)"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))}
                />
                <p className="text-xs text-gray-500 mt-2">This is for internal records only</p>
              </div>

              {/* RICH TEXT EDITOR for email message */}
              <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl p-6 border-2 border-dashed border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-800 block">Detailed Message to Admin</label>
                    <p className="text-xs text-gray-600 mt-1">This message will be sent via email to administrators</p>
                  </div>
                  <button
                    type="button"
                    className="text-xs bg-white text-blue-600 hover:text-blue-700 px-3 py-2 rounded-lg border border-blue-200 hover:bg-blue-50 transition-all"
                    onClick={() =>
                      setLeaveForm((f) => ({
                        ...f,
                        customMessage: defaultMsgForType ? `<p>${defaultMsgForType}</p>` : "",
                      }))
                    }
                  >
                    ✨ Use suggested template
                  </button>
                </div>

                <div className="bg-white rounded-lg shadow-sm">
                  <TiptapEditor
                    content={
                      htmlIsEmpty(leaveForm.customMessage) && defaultMsgForType
                        ? `<p>${defaultMsgForType}</p>`
                        : leaveForm.customMessage
                    }
                    onChange={(html) => setLeaveForm((f) => ({ ...f, customMessage: html }))}
                    placeholder="📝 Provide detailed information about your leave request...&#10;&#10;💡 Consider including:&#10;• Specific dates and time requirements&#10;• Coverage arrangements or substitutions&#10;• Emergency contact information&#10;• Reason for leave (if comfortable sharing)&#10;• Any special circumstances&#10;&#10;✨ Use the formatting toolbar above to organize longer messages with headings, lists, and emphasis."
                    className="bg-white min-h-[250px]"
                  />
                </div>

                <div className="flex items-start gap-2 mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-blue-500 text-lg mt-0.5">💡</div>
                  <div>
                    <p className="text-xs text-blue-800 font-medium mb-1">Tips for effective leave requests:</p>
                    <ul className="text-xs text-blue-700 space-y-1">
                      <li>• Be specific about dates and duration</li>
                      <li>• Mention any work arrangements or coverage plans</li>
                      <li>• Include emergency contact details if needed</li>
                      <li>• Use formatting tools above to organize longer messages</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gradient-to-r from-gray-50 to-blue-50 flex items-center justify-between gap-4">
              <div className="text-xs text-gray-600 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Request will be reviewed by administrators</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="px-6 py-2.5 rounded-xl border border-gray-300 hover:bg-white hover:shadow-sm transition-all text-gray-700 font-medium"
                  onClick={() => setShowLeaveModal(false)}
                >
                  Cancel
                </button>
                <button
                  disabled={submittingLeave}
                  className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-medium transition-all ${
                    submittingLeave
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transform hover:scale-105"
                  }`}
                  onClick={submitLeave}
                >
                  <Send className="h-4 w-4" />
                  {submittingLeave ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
