"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  PlusCircle,
  X,
  Send,
  Calendar,
  Clock,
  Star,
  AlertCircle,
  Activity,
} from "lucide-react";
import { useUser } from "./studentContext";

/* ────────────────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────────────────── */
type LeaveItem = {
  _id: string;
  leaveDate: string; // YYYY-MM-DD
  dayPart: "full" | "first_half" | "second_half";
  type: string; // sick | emergency | function | puja | personal | other
  status: "pending" | "approved" | "rejected" | "cancelled";
  reason?: string;
  rejectionReason?: string;
  createdAt?: string;
};

type LeaveTypeTpl = { id: string; label: string; defaultReason?: string };

type ScheduleEventItem = {
  _id: string;
  type?: string; // lecture | lab | tutorial | other
  status: "past" | "current" | "upcoming";
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  // normalized convenience fields (from API)
  courseName?: string;
  batchName?: string;
  facultyName?: string;
  semLabel?: string; // semester or year label
  teacherName?: string;

  // server may send this to mark cancellations
  isCancelled?: boolean;
};

/* ────────────────────────────────────────────────────────────────────────────
   Config & helpers
   ──────────────────────────────────────────────────────────────────────────── */
const API = process.env.NEXT_PUBLIC_BACKEND_URL || "";

const TZ = "Asia/Kathmandu";
const ymdNepal = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // "YYYY-MM-DD"

const isYmd = (s: string) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

const addDaysNepal = (dateStr: string, delta: number) => {
  if (!isYmd(dateStr)) return ymdNepal();
  const d = new Date(`${dateStr}T00:00:00+05:45`);
  if (isNaN(d.getTime())) return ymdNepal();
  d.setDate(d.getDate() + delta);
  return ymdNepal(d);
};

const weekdayNameNepal = (ymd: string) => {
  if (!isYmd(ymd)) return "";
  const d = new Date(`${ymd}T12:00:00+05:45`);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" }).format(d);
};

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const htmlIsEmpty = (html?: string) => !stripHtml(html || "").length;

const badgeForStatus = (s: LeaveItem["status"]) =>
  s === "approved"
    ? "bg-emerald-100 text-emerald-700"
    : s === "rejected"
    ? "bg-rose-100 text-rose-700"
    : s === "cancelled"
    ? "bg-gray-100 text-gray-600"
    : "bg-amber-100 text-amber-700"; // pending

const dayPartLabel = (p: LeaveItem["dayPart"]) =>
  p === "first_half" ? "First Half" : p === "second_half" ? "Second Half" : "Full Day";

const trimApiBase = (s: string) => s.replace(/\/+$/, "");

/* summarize batch/sem/faculty chips from schedule items */
const summarizeCtxFromSchedule = (items: ScheduleEventItem[]) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const firstNonEmpty = <T extends string | undefined>(
    arr: any[],
    pick: (v: any) => string | undefined
  ) => arr.map(pick).find(Boolean);

  const batchName = firstNonEmpty(items, (x) => x.batchName);
  const semLabel = firstNonEmpty(items, (x) => x.semLabel);
  const facultyName = firstNonEmpty(items, (x) => x.facultyName);
  return { batchName, semLabel, facultyName };
};

/* ────────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────────── */
export default function StudentDashboard() {
  const { user } = useUser();

  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeTpl[]>([]);
  const [dayParts, setDayParts] = useState<string[]>([]);

  const [myLeaves, setMyLeaves] = useState<LeaveItem[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(true);
  const [submittingLeave, setSubmittingLeave] = useState(false);

  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  // ── Daily schedule state
  const [selectedDate, setSelectedDate] = useState<string>(ymdNepal());
  const [loadingDaySchedule, setLoadingDaySchedule] = useState<boolean>(true);
  const [daySchedule, setDaySchedule] = useState<ScheduleEventItem[]>([]);

  // Token for authenticated calls (robust)
  const getToken = () =>
    (typeof window !== "undefined" &&
      (localStorage.getItem("token_student") ||
        sessionStorage.getItem("token_student") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token"))) ||
    "";

  // Leave form
  const [form, setForm] = useState({
    leaveDate: ymdNepal(),
    type: "sick",
    dayPart: "full" as "full" | "first_half" | "second_half",
    reason: "",
    customMessage: "",
  });

  /* ---------------- Templates & Leaves ---------------- */
  const fetchTemplates = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API}/leave/templates?role=student`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setLeaveTypes((data.types || []) as LeaveTypeTpl[]);
      setDayParts(data.dayParts || ["full", "first_half", "second_half"]);
      // default message if empty
      const tpl = (data.types || []).find((t: any) => t.id === "sick");
      setForm((f) => ({
        ...f,
        customMessage:
          htmlIsEmpty(f.customMessage) && tpl?.defaultReason ? tpl.defaultReason : f.customMessage,
      }));
    } catch (e) {
      console.error("Failed to fetch templates", e);
    }
  };

  const fetchMyLeaves = async () => {
    setLoadingLeaves(true);
    try {
      const token = getToken();
      const res = await fetch(`${API}/leave/student/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMyLeaves((data.items || []) as LeaveItem[]);
    } catch (e) {
      console.error("Failed to fetch student leaves", e);
    } finally {
      setLoadingLeaves(false);
    }
  };

  /* ---------------- Student daily schedule ---------------- */
  const fetchDaySchedule = async (dateStr: string, signal?: AbortSignal) => {
    if (!API || !isYmd(dateStr)) {
      setDaySchedule([]);
      return;
    }

    setLoadingDaySchedule(true);

    const token = getToken();
    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    const base = trimApiBase(API);

    const buildUrl = (paramName: "date" | "ymd" | "day") => {
      const u = new URL(`${base}/studentSchedule/me/day`);
      u.searchParams.set(paramName, dateStr); // server accepts date|ymd|day
      return u.toString();
    };

    const doFetch = async (url: string) => {
      const res = await fetch(url, { headers, signal });
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {}
      if (!res.ok) {
        const msg = json?.error || json?.message || text || `HTTP ${res.status}`;
        throw new Error(`GET ${url} -> ${res.status} ${msg}`);
      }
      return Array.isArray(json?.items) ? (json.items as ScheduleEventItem[]) : [];
    };

    try {
      // Try ?date= first, then ?ymd=, then ?day=
      try {
        const items = await doFetch(buildUrl("date"));
        setDaySchedule(items);
      } catch {
        try {
          const items = await doFetch(buildUrl("ymd"));
          setDaySchedule(items);
        } catch {
          const items = await doFetch(buildUrl("day"));
          setDaySchedule(items);
        }
      }
    } catch (e: any) {
      // Quiet empty day / errors — still show “No classes today.”
      const msg = String(e?.message || "");
      const isClient404or400 = /->\s*(400|404)\b/i.test(msg);
      const looksLikeNoSchedule = /no schedule|no class|no classes|not found|empty/i.test(msg);
      const noContext = /no batch\/?semester/i.test(msg);

      setDaySchedule([]);

      if (!isClient404or400 && !looksLikeNoSchedule && !noContext) {
        setToast({ ok: false, msg: "Could not load schedule" });
        setTimeout(() => setToast(null), 3000);
      }
    } finally {
      setLoadingDaySchedule(false);
    }
  };

  const defaultMsgForType = useMemo(() => {
    const t = leaveTypes.find((x) => x.id === form.type);
    return (t?.defaultReason || "").trim();
  }, [leaveTypes, form.type]);

  const submitLeave = async () => {
    if (submittingLeave) return;
    setSubmittingLeave(true);
    setToast(null);

    try {
      const token = getToken();
      const payload = {
        ...form,
        customMessage: htmlIsEmpty(form.customMessage) ? defaultMsgForType : form.customMessage,
        customMessageText: htmlIsEmpty(form.customMessage)
          ? defaultMsgForType || form.reason
          : stripHtml(form.customMessage),
      };

      const res = await fetch(`${API}/leave/student/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to request leave");

      setToast({ ok: true, msg: "Leave requested successfully." });
      setForm({
        leaveDate: ymdNepal(),
        type: "sick",
        dayPart: "full",
        reason: "",
        customMessage: "",
      });
      fetchMyLeaves();
    } catch (e: any) {
      setToast({ ok: false, msg: e.message || "Request failed" });
    } finally {
      setSubmittingLeave(false);
      setShowLeaveModal(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const cancelLeave = async (id: string) => {
    try {
      const token = getToken();
      const res = await fetch(`${API}/leave/student/${id}/cancel`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to cancel leave");
      setToast({ ok: true, msg: "Leave cancelled." });
      fetchMyLeaves();
    } catch (e: any) {
      setToast({ ok: false, msg: e.message || "Cancel failed" });
    } finally {
      setTimeout(() => setToast(null), 2500);
    }
  };

  /* ---------------- Effects ---------------- */
  useEffect(() => {
    fetchTemplates();
    fetchMyLeaves();
  }, []);

  // fetch daily schedule when date changes (with debounce + cancel)
  useEffect(() => {
    if (!isYmd(selectedDate)) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetchDaySchedule(selectedDate, ctrl.signal);
    }, 150);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  /* ---------------- Derived ---------------- */
  const today = new Date().toISOString().split("T")[0];
  const isTodaySelected = selectedDate === ymdNepal();
  const selectedDatePretty = isYmd(selectedDate)
    ? `${weekdayNameNepal(selectedDate)}, ${selectedDate}`
    : `${weekdayNameNepal(ymdNepal())}, ${ymdNepal()}`;

  const ctxFromSchedule = useMemo(() => summarizeCtxFromSchedule(daySchedule), [daySchedule]);

  /* ────────────────────────────────────────────────────────────────────────────
     Render
     ────────────────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50/40 to-purple-100/30 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header: show chips only when we have them; otherwise nothing */}
        <div className="bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20 rounded-2xl shadow-xl border border-gray-100/50 p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text text-transparent">
                {user?.username ? `Welcome back, ${user.username}!` : "Welcome to your dashboard!"}
              </h1>
              <p className="text-gray-600 mt-2 flex items-center space-x-2">
                <span className="font-medium">{user?.email || "Student Portal"}</span>
                {user?.role && (
                  <>
                    <span className="text-gray-400">•</span>
                    <span className="px-3 py-1 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 rounded-full text-sm font-semibold capitalize border border-blue-200">
                      {user.role}
                    </span>
                  </>
                )}
              </p>

              <div className="mt-4 text-sm">
                {loadingDaySchedule ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500/20 border-t-blue-500"></div>
                    <span className="text-gray-500">Loading your academic details...</span>
                  </div>
                ) : ctxFromSchedule ? (
                  <div className="flex flex-wrap gap-3">
                    {ctxFromSchedule.batchName && (
                      <span className="px-3 py-2 rounded-xl bg-gradient-to-r from-gray-100 to-gray-200 border border-gray-300 text-gray-700 font-semibold">
                        📚 Batch: {ctxFromSchedule.batchName}
                      </span>
                    )}
                    {ctxFromSchedule.semLabel && (
                      <span className="px-3 py-2 rounded-xl bg-gradient-to-r from-blue-100 to-blue-200 border border-blue-300 text-blue-700 font-semibold">
                        🎓 {ctxFromSchedule.semLabel}
                      </span>
                    )}
                    {ctxFromSchedule.facultyName && (
                      <span className="px-3 py-2 rounded-xl bg-gradient-to-r from-purple-100 to-purple-200 border border-purple-300 text-purple-700 font-semibold">
                        🏛️ {ctxFromSchedule.facultyName}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg">
                  <Calendar className="h-5 w-5" />
                  <div className="text-left">
                    <div className="text-xs font-medium opacity-90">Today</div>
                    <div className="text-sm font-bold">{today}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Schedule */}
        <div className="bg-gradient-to-br from-white via-indigo-50/30 to-blue-50/20 rounded-2xl shadow-xl border border-gray-100/50 p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                <Calendar className="h-7 w-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                  {isTodaySelected ? "📅 Today's Schedule" : "📅 Daily Schedule"}
                </h2>
                <p className="text-gray-600 font-medium">{selectedDatePretty}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-xl p-2 border border-gray-200/50">
              <button
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 border border-gray-300 text-gray-700 font-medium text-sm transition-all duration-200 hover:shadow-md"
                onClick={() => setSelectedDate((d) => addDaysNepal(d, -1))}
              >
                ◀ Prev
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedDate(isYmd(v) ? v : ymdNepal());
                }}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              />
              <button
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 border border-gray-300 text-gray-700 font-medium text-sm transition-all duration-200 hover:shadow-md"
                onClick={() => setSelectedDate((d) => addDaysNepal(d, +1))}
              >
                Next ▶
              </button>
              {!isTodaySelected && (
                <button
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium text-sm hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                  onClick={() => setSelectedDate(ymdNepal())}
                >
                  Today
                </button>
              )}
            </div>
          </div>

          {/* Schedule list */}
          <div className="space-y-4 mt-8">
            {loadingDaySchedule ? (
              <>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-6 rounded-2xl bg-gradient-to-r from-gray-100 to-gray-200 animate-pulse h-24 border border-gray-200" />
                ))}
              </>
            ) : daySchedule.length === 0 ? (
              <div className="text-center py-12">
                <div className="p-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center shadow-lg">
                  <Calendar className="h-10 w-10 text-gray-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No classes scheduled</h3>
                <p className="text-gray-500">Enjoy your free day! 🎉</p>
              </div>
            ) : (
              daySchedule.map((ev, index) => {
                const isCurrent = ev.status === "current";
                const isCancelled = !!ev.isCancelled;

                const colorDot = isCancelled
                  ? "bg-red-500 shadow-red-200"
                  : isCurrent
                  ? "bg-green-500 shadow-green-200"
                  : ev.status === "upcoming"
                  ? "bg-blue-500 shadow-blue-200"
                  : "bg-gray-400 shadow-gray-200";

                const cardClasses = isCancelled
                  ? "bg-gradient-to-r from-red-50 to-rose-100/50 border-red-300 shadow-red-100"
                  : isCurrent
                  ? "bg-gradient-to-r from-green-50 to-emerald-100/50 border-green-400 shadow-green-100"
                  : "bg-gradient-to-r from-white to-gray-50/80 border-gray-200 shadow-gray-100";

                return (
                  <div
                    key={ev._id || index}
                    className={`p-6 rounded-2xl border-l-4 ${cardClasses} hover:shadow-xl transition-all duration-300 group`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-5">
                        <div className={`w-4 h-4 rounded-full ${colorDot} shadow-lg group-hover:scale-110 transition-transform duration-200`} />
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg group-hover:text-blue-700 transition-colors">
                            {ev.courseName || "Class"}
                          </h3>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                            {isCancelled && (
                              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-red-100 to-red-200 text-red-700 border border-red-300 font-semibold">
                                ⛔ Cancelled
                              </span>
                            )}
                            {ev.teacherName && (
                              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border border-gray-300 font-medium">
                                👨‍🏫 {ev.teacherName}
                              </span>
                            )}
                            {ev.facultyName && (
                              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700 border border-purple-300 font-medium">
                                🏛️ {ev.facultyName}
                              </span>
                            )}
                            {ev.semLabel && (
                              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700 border border-blue-300 font-medium">
                                🎓 {ev.semLabel}
                              </span>
                            )}
                            <span className="px-3 py-1 rounded-full bg-gradient-to-r from-indigo-100 to-indigo-200 text-indigo-700 border border-indigo-300 font-medium capitalize">
                              📚 {ev.type || "lecture"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className={`font-bold text-lg ${
                            isCancelled ? "text-gray-500 line-through" : "text-gray-900"
                          }`}
                        >
                          {ev.startTime} – {ev.endTime}
                        </p>
                        {!isCancelled && isCurrent && (
                          <span className="inline-flex items-center gap-2 text-sm text-green-700 bg-gradient-to-r from-green-100 to-emerald-100 px-3 py-1 rounded-full mt-2 border border-green-300 font-semibold shadow-lg">
                            <Activity className="h-4 w-4" />
                            🔴 Live Now
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`rounded-2xl p-4 border shadow-lg ${
              toast.ok
                ? "bg-gradient-to-r from-emerald-50 to-green-100/80 text-emerald-800 border-emerald-300"
                : "bg-gradient-to-r from-red-50 to-rose-100/80 text-red-700 border-red-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.ok ? (
                <span className="text-emerald-600">✅</span>
              ) : (
                <span className="text-red-600">❌</span>
              )}
              <span className="font-medium">{toast.msg}</span>
            </div>
          </div>
        )}
        
        {/* CTA: Ask for Leave */}
        <div className="bg-gradient-to-br from-white via-indigo-50/30 to-purple-50/20 rounded-2xl shadow-xl border border-gray-100/50 p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl shadow-lg">
                <Calendar className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                  🎯 Leave Center
                </h3>
                <p className="text-gray-600 mt-1">
                  {user?.username ? `Need time off, ${user.username}? Submit your leave request here.` : "Need time off? Submit your leave request here."}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowLeaveModal(true)}
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold"
              title="Ask for leave"
            >
              <PlusCircle className="h-6 w-6" />
              Request Leave
            </button>
          </div>
        </div>
        {/* My leaves panel */}
        <div className="bg-gradient-to-br from-white via-yellow-50/20 to-orange-50/20 rounded-2xl shadow-xl border border-gray-100/50 p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl shadow-lg">
                <Star className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                📝 My Leave Requests
              </h2>
            </div>
            <button
              onClick={fetchMyLeaves}
              className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 font-medium transition-all duration-200"
              title="Refresh"
            >
              <Clock className="h-4 w-4" />
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
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <AlertCircle className="h-4 w-4" />
              You haven’t requested any leave yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {myLeaves.map((lv) => (
                <li
                  key={lv._id}
                  className="p-3 rounded-lg border border-gray-200 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {lv.leaveDate} • {dayPartLabel(lv.dayPart)}
                    </div>
                    <div className="text-sm text-gray-600 capitalize">
                      {lv.type} {lv.reason ? `— ${lv.reason}` : ""}
                    </div>
                    {lv.status === "rejected" && lv.rejectionReason ? (
                      <div className="text-xs text-rose-600 mt-1">Reason: {lv.rejectionReason}</div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${badgeForStatus(lv.status)}`}>
                      {lv.status}
                    </span>
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

      {/* Leave Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b bg-gray-50">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Ask for Leave</h3>
                <p className="text-xs text-gray-600">Submit your request to the administration</p>
              </div>
              <button
                className="p-2 hover:bg-white rounded-lg"
                onClick={() => setShowLeaveModal(false)}
                title="Close"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  className="mt-1 w-full border rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={form.leaveDate}
                  onChange={(e) => setForm((f) => ({ ...f, leaveDate: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Leave Type</label>
                  <select
                    className="mt-1 w-full border rounded-xl px-3 py-2"
                    value={form.type}
                    onChange={(e) => {
                      const val = e.target.value;
                      const tpl = leaveTypes.find((t) => t.id === val);
                      setForm((f) => ({
                        ...f,
                        type: val,
                        customMessage:
                          htmlIsEmpty(f.customMessage) && tpl?.defaultReason
                            ? tpl.defaultReason
                            : f.customMessage,
                      }));
                    }}
                  >
                    {leaveTypes.length === 0 ? (
                      <option value="sick">Sick Leave</option>
                    ) : (
                      leaveTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Duration</label>
                  <select
                    className="mt-1 w-full border rounded-xl px-3 py-2"
                    value={form.dayPart}
                    onChange={(e) => setForm((f) => ({ ...f, dayPart: e.target.value as any }))}
                  >
                    {(dayParts.length ? dayParts : ["full", "first_half", "second_half"]).map((p) => (
                      <option key={p} value={p}>
                        {dayPartLabel(p as any)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Brief Reason (internal)</label>
                <input
                  type="text"
                  placeholder="e.g., Fever, personal emergency"
                  className="mt-1 w-full border rounded-xl px-3 py-2"
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Message to Admin</label>
                <textarea
                  placeholder="This will be sent in the leave email"
                  className="mt-1 w-full border rounded-xl px-3 py-2 h-28"
                  value={form.customMessage}
                  onChange={(e) => setForm((f) => ({ ...f, customMessage: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, customMessage: defaultMsgForType || f.customMessage }))
                  }
                  className="mt-2 text-xs text-blue-600 hover:text-blue-700"
                >
                  ✨ Use suggested template
                </button>
              </div>
            </div>

            <div className="p-5 border-t bg-gray-50 flex items-center justify-between">
              <div className="text-xs text-gray-600 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Admins will review your request</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-white"
                  onClick={() => setShowLeaveModal(false)}
                >
                  Close
                </button>
                <button
                  disabled={submittingLeave}
                  onClick={submitLeave}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white ${
                    submittingLeave ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  <Send className="h-4 w-4" />
                  {submittingLeave ? "Submitting..." : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* end modal */}
    </div>
  );
}
