"use client";

import React, { useEffect, useMemo, useState } from "react";
import ScheduleBuilderPage from "./schedulingform";

/* --------------------------- Types --------------------------- */
interface ScheduleEvent {
  _id: string;
  type: string;
  startDate: string;
  endDate: string;
  startMinutes: number;
  endMinutes: number;
  daysOfWeek?: number[]; // 0..6
  notes?: string;
  isCancelled?: boolean;

  teacher?: { _id?: string; name?: string; username?: string };
  batch?: { _id?: string; batchname?: string };
  faculty?: { _id?: string; name?: string; code?: string };
  semesterOrYear?: { _id?: string; name?: string };
  courseInstance?: {
    course?: { name?: string; code?: string };
    teacher?: { _id?: string; name?: string; username?: string };
    batch?: { _id?: string; batchname?: string };
  };
}

type GroupKey = string; // `${batchId}::${semesterId}`

/* --------------------- Small helpers --------------------- */
const dayNamesFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatTime24 = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};
const dayShort = (d: number) => dayNamesShort[d] ?? "-";
const dayFull = (d: number) => dayNamesFull[d] ?? "-";

/* ---------------- CSV helpers ---------------- */
function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((cell) => {
          const v = String(cell ?? "");
          return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ======================= Confirm Dialog ======================= */
function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="p-6">
          <p className="text-gray-600 leading-relaxed">{message}</p>
        </div>
        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 font-medium transition-all shadow-lg hover:shadow-xl"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ======================= View Group Modal (scrollable + per-row toggle) ======================= */
function ViewGroupModal({
  open,
  onClose,
  title,
  events,
  batchId,
  semesterId,
  onToast,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  events: ScheduleEvent[];
  batchId: string | null;
  semesterId: string | null;
  onToast: (msg: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [workingId, setWorkingId] = useState<string | null>(null);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token_admin") || "" : "";
  const Api = process.env.NEXT_PUBLIC_BACKEND_URL || "";

  const daywise = useMemo(() => {
    const map: Record<number, ScheduleEvent[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const e of events) {
      const days = e.daysOfWeek?.length ? e.daysOfWeek : [new Date(e.startDate).getDay()];
      for (const d of days) map[d].push(e);
    }
    for (const k of Object.keys(map)) {
      map[+k].sort((a, b) => a.startMinutes - b.startMinutes);
    }
    return map;
  }, [events]);

  if (!open) return null;

  const bulkToggle = async (cancelFlag: boolean) => {
    if (!batchId || !semesterId) return;
    try {
      const url = new URL(`${Api}/schedule/schedule-events`);
      url.searchParams.set("batch", batchId);
      url.searchParams.set("semesterOrYear", semesterId);
      const res = await fetch(url.toString(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isCancelled: cancelFlag }),
      });
      const data = await res.json();
      if (!res.ok || data?.ok !== true) throw new Error(data?.error || "Update failed");
      onToast(cancelFlag ? "All events cancelled." : "All events reactivated.");
      await onRefresh();
    } catch (err: any) {
      console.error(err);
      onToast(err?.message || "Bulk update failed");
    }
  };

  const toggleSingle = async (e: ScheduleEvent) => {
    try {
      setWorkingId(e._id);
      const res = await fetch(`${Api}/schedule/schedule-events/${e._id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cancel: !e.isCancelled }),
      });
      const data = await res.json();
      if (!res.ok || data?.ok !== true) throw new Error(data?.error || "Update failed");
      // Optimistic inline update
      e.isCancelled = !e.isCancelled;
      onToast(e.isCancelled ? "Event cancelled." : "Event reactivated.");
    } catch (err: any) {
      console.error(err);
      onToast(err?.message || "Failed to update");
    } finally {
      setWorkingId(null);
    }
  };

  return (
    // OVERLAY can scroll on small screens
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
    >
      {/* PANEL is a flex column; body will scroll */}
      <div className="w-full max-w-6xl max-h-[90vh] rounded-2xl bg-white shadow-2xl border border-gray-200 flex flex-col">
        {/* HEADER (non-scrolling) */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 shrink-0">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">📅 Weekly Schedule</h3>
            <p className="text-sm text-gray-600 mt-1">{title}</p>
          </div>
          <div className="flex items-center gap-3">
            {batchId && semesterId && (
              <>
                <button
                  onClick={() => bulkToggle(true)}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 text-white hover:bg-amber-600 font-medium transition-all shadow-lg hover:shadow-xl"
                >
                  🚫 Cancel All
                </button>
                <button
                  onClick={() => bulkToggle(false)}
                  className="px-4 py-2.5 rounded-xl bg-green-500 text-white hover:bg-green-600 font-medium transition-all shadow-lg hover:shadow-xl"
                >
                  ✅ Restore All
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all"
            >
              Close
            </button>
          </div>
        </div>

        {/* BODY (scrolls vertically) */}
        <div className="p-6 bg-gray-50 flex-1 min-h-0 overflow-y-auto">
          {([0, 1, 2, 3, 4, 5, 6] as const).map((d) => (
            <div key={d} className="mb-8 last:mb-0">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-sm">{d + 1}</span>
                </div>
                <h4 className="text-xl font-bold text-gray-900">{dayFull(d)}</h4>
              </div>

              {daywise[d].length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center border border-gray-200 shadow-sm">
                  <div className="text-gray-400 text-4xl mb-2">📅</div>
                  <div className="text-gray-500 font-medium">No classes scheduled</div>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  {/* X-scroll wrapper so table never squeezes */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px]">
                      <thead className="bg-gradient-to-r from-gray-50 to-blue-50">
                        <tr>
                          <th className="p-4 text-left font-semibold text-gray-700 border-b border-gray-200">🕐 Time</th>
                          <th className="p-4 text-left font-semibold text-gray-700 border-b border-gray-200">📚 Course</th>
                          <th className="p-4 text-left font-semibold text-gray-700 border-b border-gray-200">👨‍🏫 Teacher</th>
                          <th className="p-4 text-left font-semibold text-gray-700 border-b border-gray-200 w-48">⚡ Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {daywise[d].map((e, idx) => (
                          <tr
                            key={`${e._id}-${d}`}
                            className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                              e.isCancelled ? "bg-red-50/50 text-gray-600" : ""
                            } ${idx % 2 === 1 ? "bg-gray-25" : ""}`}
                          >
                            <td className="p-4 border-r border-gray-100 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                <span className="font-mono font-medium">
                                  {formatTime24(e.startMinutes)} – {formatTime24(e.endMinutes)}
                                </span>
                              </div>
                            </td>
                            <td className="p-4 border-r border-gray-100">
                              <div className="font-medium text-gray-900">
                                {e.courseInstance?.course?.code && e.courseInstance.course.name
                                  ? `${e.courseInstance.course.code} — ${e.courseInstance.course.name}`
                                  : e.courseInstance?.course?.name || "-"}
                              </div>
                            </td>
                            <td className="p-4 border-r border-gray-100">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                  <span className="text-indigo-600 text-xs font-semibold">
                                    {(e.courseInstance?.teacher?.name ||
                                      e.teacher?.name ||
                                      e.courseInstance?.teacher?.username ||
                                      e.teacher?.username ||
                                      "?")
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </span>
                                </div>
                                <span className="font-medium">
                                  {e.courseInstance?.teacher?.name ||
                                    e.teacher?.name ||
                                    e.courseInstance?.teacher?.username ||
                                    e.teacher?.username ||
                                    "-"}
                                </span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-start gap-3">
                                <span
                                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                                    e.isCancelled
                                      ? "bg-red-100 text-red-700 border border-red-200"
                                      : "bg-green-100 text-green-700 border border-green-200"
                                  }`}
                                >
                                  {e.isCancelled ? "🚫 Cancelled" : "✅ Active"}
                                </span>
                                <button
                                  onClick={() => toggleSingle(e)}
                                  disabled={workingId === e._id}
                                  className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-all ${
                                    e.isCancelled
                                      ? "bg-green-500 text-white hover:bg-green-600 shadow-md hover:shadow-lg"
                                      : "bg-red-500 text-white hover:bg-red-600 shadow-md hover:shadow-lg"
                                  } disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105`}
                                >
                                  {workingId === e._id
                                    ? "⏳ Saving…"
                                    : e.isCancelled
                                    ? "↩️ Restore"
                                    : "❌ Cancel"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ======================= Main Page ======================= */
export default function SchedulePage() {
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // filters
  const [facultyId, setFacultyId] = useState<string>("");
  const [batchId, setBatchId] = useState<string>("");
  const [semesterId, setSemesterId] = useState<string>("");

  // group modal + confirm + toast
  const [viewGroupKey, setViewGroupKey] = useState<GroupKey | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState<{
    type: "group";
    batchId?: string;
    semesterId?: string;
    title: string;
    message: string;
    action: "delete" | "cancelAll" | "uncancelAll";
  } | null>(null);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const Api = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const getToken = () =>
    (typeof window !== "undefined" ? localStorage.getItem("token_admin") || "" : "");

  const fetchSchedules = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${Api}/schedule/schedule-events`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.ok) setSchedules(data.events as ScheduleEvent[]);
      else setErrorMsg(data.error || "Failed to load schedules.");
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to load schedules.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Api]);

  const subjectLabel = (s: ScheduleEvent) => {
    const c = s.courseInstance?.course;
    if (c?.code && c?.name) return `${c.code} — ${c.name}`;
    return c?.name || "-";
  };
  const teacherLabel = (s: ScheduleEvent) =>
    s.courseInstance?.teacher?.name ||
    s.teacher?.name ||
    s.courseInstance?.teacher?.username ||
    s.teacher?.username ||
    "-";
  const batchLabel = (s: ScheduleEvent) =>
    s.courseInstance?.batch?.batchname || s.batch?.batchname || "-";
  const daysLabel = (s: ScheduleEvent) =>
    s.daysOfWeek?.length
      ? s.daysOfWeek.map((d) => dayShort(d)).join(", ")
      : dayShort(new Date(s.startDate).getDay());

  /* ---------- options for dropdowns ---------- */
  const { faculties, batches, semesters } = useMemo(() => {
    const facMap = new Map<string, string>();
    const batchMap = new Map<string, string>();
    const semMap = new Map<string, string>();
    for (const s of schedules) {
      if (s.faculty?._id) facMap.set(s.faculty._id, s.faculty.name || s.faculty.code || s.faculty._id);
      const bid = s.courseInstance?.batch?._id || s.batch?._id;
      if (bid) batchMap.set(bid, s.courseInstance?.batch?.batchname || s.batch?.batchname || bid);
      if (s.semesterOrYear?._id) semMap.set(s.semesterOrYear._id, s.semesterOrYear.name || s.semesterOrYear._id);
    }
    const toOpts = (m: Map<string, string>) =>
      Array.from(m.entries()).map(([value, label]) => ({ value, label }));
    return {
      faculties: toOpts(facMap).sort((a, b) => a.label.localeCompare(b.label)),
      batches: toOpts(batchMap).sort((a, b) => a.label.localeCompare(b.label)),
      semesters: toOpts(semMap).sort((a, b) => a.label.localeCompare(b.label)),
    };
  }, [schedules]);

  /* ---------- filtered view ---------- */
  const filtered = useMemo(
    () =>
      schedules.filter((s) => {
        const fOk = !facultyId || s.faculty?._id === facultyId;
        const bOk = !batchId || (s.courseInstance?.batch?._id || s.batch?._id) === batchId;
        const semOk = !semesterId || s.semesterOrYear?._id === semesterId;
        return fOk && bOk && semOk;
      }),
    [schedules, facultyId, batchId, semesterId]
  );

  /* ---------- groups: Batch × Semester ---------- */
  const groups = useMemo(() => {
    const map = new Map<
      GroupKey,
      {
        key: GroupKey;
        batchId: string;
        batchName: string;
        semesterId: string;
        semesterName: string;
        events: ScheduleEvent[];
      }
    >();

    for (const s of filtered) {
      const bId = s.courseInstance?.batch?._id || s.batch?._id;
      const bName = s.courseInstance?.batch?.batchname || s.batch?.batchname || "(Batch)";
      const semId = s.semesterOrYear?._id || "";
      const semName = s.semesterOrYear?.name || "(Semester)";
      if (!bId || !semId) continue;

      const k: GroupKey = `${bId}::${semId}`;
      if (!map.has(k)) {
        map.set(k, { key: k, batchId: bId, batchName: bName, semesterId: semId, semesterName: semName, events: [] });
      }
      map.get(k)!.events.push(s);
    }

    // Sort inside group by (day, start)
    const dayOf = (e: ScheduleEvent) =>
      e.daysOfWeek?.length ? e.daysOfWeek[0] : new Date(e.startDate).getDay();

    for (const g of map.values()) {
      g.events.sort((a, b) => {
        const da = dayOf(a);
        const db = dayOf(b);
        if (da !== db) return da - db;
        return a.startMinutes - b.startMinutes;
      });
    }
    return Array.from(map.values());
  }, [filtered]);

  /* ---------------- CSV: group + filtered-all ---------------- */
  const exportGroupCSV = (events: ScheduleEvent[], filenameHint: string) => {
    const header = [
      "Event ID",
      "Subject Code",
      "Subject Name",
      "Type",
      "Day",
      "Start",
      "End",
      "Start Date",
      "End Date",
      "Teacher",
      "Batch",
      "Cancelled",
      "Notes",
    ];
    const rows: string[][] = [];
    for (const s of events) {
      const code = s.courseInstance?.course?.code ?? "";
      const name = s.courseInstance?.course?.name ?? "";
      const days = s.daysOfWeek?.length ? s.daysOfWeek : [new Date(s.startDate).getDay()];
      for (const d of days) {
        rows.push([
          s._id,
          code,
          name,
          s.type,
          dayShort(d),
          formatTime24(s.startMinutes),
          formatTime24(s.endMinutes),
          new Date(s.startDate).toLocaleDateString(),
          new Date(s.endDate).toLocaleDateString(),
          teacherLabel(s),
          batchLabel(s),
          s.isCancelled ? "Yes" : "No",
          s.notes ?? "",
        ]);
      }
    }
    downloadCsv(`${filenameHint}_${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
  };

  const exportAllCSV = () => {
    exportGroupCSV(filtered, "schedule_export_filtered");
  };

  /* ---------------- group actions ---------------- */
  const openGroupView = (key: GroupKey) => {
    setViewGroupKey(key);
    setViewOpen(true);
  };

  const askDeleteGroup = (batchId: string, semesterId: string, label: string) => {
    setConfirmPayload({
      type: "group",
      batchId,
      semesterId,
      title: "Delete Entire Schedule",
      message: `This will permanently delete ALL events for ${label}. Continue?`,
      action: "delete",
    });
    setConfirmOpen(true);
  };

  const askCancelAll = (batchId: string, semesterId: string, label: string) => {
    setConfirmPayload({
      type: "group",
      batchId,
      semesterId,
      title: "Cancel All Events",
      message: `This will mark all events for ${label} as cancelled. Continue?`,
      action: "cancelAll",
    });
    setConfirmOpen(true);
  };

  const askUncancelAll = (batchId: string, semesterId: string, label: string) => {
    setConfirmPayload({
      type: "group",
      batchId,
      semesterId,
      title: "Uncancel All Events",
      message: `This will mark all events for ${label} as ACTIVE (not cancelled). Continue?`,
      action: "uncancelAll",
    });
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!confirmPayload) return;
    const { batchId, semesterId, action } = confirmPayload;
    if (!batchId || !semesterId) {
      setConfirmOpen(false);
      setConfirmPayload(null);
      return;
    }
    const token = getToken();

    const key = `${batchId}::${semesterId}`;
    setBusyKey(key);

    try {
      if (action === "delete") {
        // Hard delete the whole schedule for batch+semester
        const url = new URL(`${Api}/schedule/schedule-events`);
        url.searchParams.set("batch", batchId);
        url.searchParams.set("semesterOrYear", semesterId);
        url.searchParams.set("mode", "delete"); // delete all matching
        const res = await fetch(url.toString(), {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok !== true) throw new Error(data?.error || "Delete failed");
        setToast("Schedule deleted.");
      } else if (action === "cancelAll" || action === "uncancelAll") {
        // Bulk update (toggle isCancelled)
        const url = new URL(`${Api}/schedule/schedule-events`);
        url.searchParams.set("batch", batchId);
        url.searchParams.set("semesterOrYear", semesterId);
        const res = await fetch(url.toString(), {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ isCancelled: action === "cancelAll" ? true : false }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok !== true) throw new Error(data?.error || "Update failed");
        setToast(action === "cancelAll" ? "All events cancelled." : "All events reactivated.");
      }

      setConfirmOpen(false);
      setConfirmPayload(null);
      await fetchSchedules();
    } catch (e: any) {
      console.error(e);
      setToast(e?.message || "Operation failed");
      setConfirmOpen(false);
      setConfirmPayload(null);
      await fetchSchedules();
    } finally {
      setBusyKey(null);
      setTimeout(() => setToast(null), 2500);
    }
  };

  const groupLabel = (g: { batchName: string; semesterName: string }) =>
    `${g.batchName} — ${g.semesterName} schedule`;

  /* ------------------- UI ------------------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">📅 Schedule Management</h1>
              <p className="text-gray-600">Manage class schedules, view timetables, and track schedule changes</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={fetchSchedules}
                className="px-6 py-3 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium transition-all transform hover:scale-105 shadow-md"
              >
                🔄 Refresh
              </button>
              <button
                onClick={exportAllCSV}
                disabled={loading || filtered.length === 0}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 font-medium transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:transform-none"
              >
                📊 Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Schedule builder */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <span className="text-purple-600 text-xl">⚙️</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Schedule Builder</h2>
              <p className="text-gray-600 text-sm">Create and modify class schedules</p>
            </div>
          </div>
          <ScheduleBuilderPage />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 text-xl">🔍</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Filter Schedules</h2>
              <p className="text-gray-600 text-sm">Filter by faculty, batch, or semester</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">🏫 Faculty</label>
              <select
                value={facultyId}
                onChange={(e) => setFacultyId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm transition-all"
              >
                <option value="">All Faculties</option>
                {faculties.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">👥 Batch</label>
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm transition-all"
              >
                <option value="">All Batches</option>
                {batches.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">📚 Semester / Year</label>
              <select
                value={semesterId}
                onChange={(e) => setSemesterId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm transition-all"
              >
                <option value="">All Semesters</option>
                {semesters.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Grouped list (Batch × Semester) */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <span className="text-green-600 text-xl">📋</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Schedule Groups</h2>
              <p className="text-gray-600 text-sm">Organized by Batch × Semester</p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Loading schedules...</p>
            </div>
          ) : errorMsg ? (
            <div className="text-center py-12">
              <div className="text-red-500 text-4xl mb-4">⚠️</div>
              <p className="text-red-600 font-medium">{errorMsg}</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📅</div>
              <p className="text-gray-600 font-medium">No schedules found for current filters</p>
              <p className="text-gray-500 text-sm mt-2">Try adjusting your filter criteria</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {groups.map((g) => (
                <div
                  key={g.key}
                  className="group bg-gradient-to-br from-white to-blue-50 rounded-2xl border-2 border-gray-200 p-6 hover:border-blue-300 hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                          <span className="text-blue-600 font-semibold text-sm">📚</span>
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-700 transition-colors">
                          {g.batchName} — {g.semesterName} schedule
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full">
                          📊 {g.events.length} event{g.events.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    {/* View */}
                    <button
                      onClick={() => {
                        openGroupView(g.key);
                      }}
                      className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700 hover:text-blue-700 font-medium text-sm transition-all transform hover:scale-105"
                    >
                      👁️ View
                    </button>

                    {/* Export */}
                    <button
                      onClick={() => {
                        exportGroupCSV(
                          g.events,
                          `${g.batchName.replace(/\s+/g, "_")}_${g.semesterName.replace(/\s+/g, "_")}`
                        );
                      }}
                      className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-700 hover:text-purple-700 font-medium text-sm transition-all transform hover:scale-105"
                    >
                      📁 Export
                    </button>

                    {/* Cancel All */}
                    <button
                      onClick={() => {
                        setConfirmPayload({
                          type: "group",
                          batchId: g.batchId,
                          semesterId: g.semesterId,
                          title: "Cancel All Events",
                          message: `This will mark all events for ${groupLabel(g)} as cancelled. Continue?`,
                          action: "cancelAll",
                        });
                        setConfirmOpen(true);
                      }}
                      disabled={busyKey === g.key}
                      className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none shadow-md"
                    >
                      {busyKey === g.key ? "⏳" : "🚫"} {busyKey === g.key ? "Working…" : "Cancel"}
                    </button>

                    {/* Restore All */}
                    <button
                      onClick={() => {
                        setConfirmPayload({
                          type: "group",
                          batchId: g.batchId,
                          semesterId: g.semesterId,
                          title: "Uncancel All Events",
                          message: `This will mark all events for ${groupLabel(g)} as ACTIVE. Continue?`,
                          action: "uncancelAll",
                        });
                        setConfirmOpen(true);
                      }}
                      disabled={busyKey === g.key}
                      className="px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium text-sm transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none shadow-md"
                    >
                      {busyKey === g.key ? "⏳" : "✅"} {busyKey === g.key ? "Working…" : "Restore"}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => {
                        setConfirmPayload({
                          type: "group",
                          batchId: g.batchId,
                          semesterId: g.semesterId,
                          title: "Delete Entire Schedule",
                          message: `This will permanently delete ALL events for ${groupLabel(g)}. Continue?`,
                          action: "delete",
                        });
                        setConfirmOpen(true);
                      }}
                      disabled={busyKey === g.key}
                      className="px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium text-sm transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none shadow-md"
                    >
                      {busyKey === g.key ? "⏳" : "🗑️"} {busyKey === g.key ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Group View Modal */}
      <ViewGroupModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title={
          viewGroupKey
            ? (() => {
                const [bid, sid] = viewGroupKey.split("::");
                const g = groups.find((x) => x.batchId === bid && x.semesterId === sid);
                return g ? `${g.batchName} — ${g.semesterName}` : "";
              })()
            : ""
        }
        batchId={viewGroupKey ? viewGroupKey.split("::")[0] : null}
        semesterId={viewGroupKey ? viewGroupKey.split("::")[1] : null}
        events={
          viewGroupKey
            ? (() => {
                const [bid, sid] = viewGroupKey.split("::");
                return filtered.filter(
                  (e) =>
                    (e.courseInstance?.batch?._id || e.batch?._id) === bid &&
                    e.semesterOrYear?._id === sid
                );
              })()
            : []
        }
        onToast={(m) => {
          setToast(m);
          setTimeout(() => setToast(null), 2000);
        }}
        onRefresh={fetchSchedules}
      />

      {/* Confirm dialog (group actions) */}
      <ConfirmDialog
        open={confirmOpen}
        title={confirmPayload?.title || ""}
        message={confirmPayload?.message || ""}
        confirmText={
          confirmPayload?.action === "delete"
            ? "Delete"
            : confirmPayload?.action === "cancelAll"
            ? "Cancel All"
            : "Uncancel All"
        }
        cancelText="Cancel"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Tiny toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-gray-900 to-black text-white px-6 py-3 rounded-2xl shadow-2xl border border-gray-700 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="font-medium">{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
