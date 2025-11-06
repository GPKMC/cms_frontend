"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import io, { Socket } from "socket.io-client";
import { useParams } from "next/navigation";
import { Calendar, Users, QrCode, Play, Square, RefreshCw, ChevronDown } from "lucide-react";

/* =================== API paths =================== */
const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || API;
const DUPLICATED_PREFIX = false;
const base = (p: string) =>
  `${API}/attendance${DUPLICATED_PREFIX ? "/attendance" : ""}${p}`;

const OPEN_SESSION = () => base(`/sessions`);
const CLOSE_SESSION = (sid: string) => base(`/sessions/${sid}/close`);
const TOKEN_PATH = (sid: string) => base(`/sessions/${sid}/token`);
const MANUAL_MARK = (sid: string) => base(`/sessions/${sid}/manual`);
const MONTH_REPORT = (ciId: string, year: number, month: number, stats = true) =>
  base(
    `/course-instances/${ciId}/month?year=${year}&month=${month}${
      stats ? "&includeStats=1" : ""
    }`
  );

/* =================== types =================== */
type Student = { _id: string; username?: string; email?: string };
type Status = "present" | "absent" | "late" | null;

type MonthPayload = {
  year: number;
  month: number;
  daysInMonth: number;
  students: Student[];
  sessionsByDay: Record<string, string>;
  matrix: Record<string, Record<number, Status>>;
  stats?: {
    perStudent: Record<
      string,
      { present: number; absent: number; late: number; total: number; percentPresent: number }
    >;
    perDay: Record<string, { present: number; absent: number; late: number; total: number }>;
  };
};

export default function TeacherAttendanceMonthPage() {
  const params = useParams();
  const courseInstanceId = String(params?.id);

  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);

  const [data, setData] = useState<MonthPayload | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [liveDay, setLiveDay] = useState<number | "">("");
  const [liveSessionId, setLiveSessionId] = useState<string>("");
  const [qrValue, setQrValue] = useState<string>("");
  const socketRef = useRef<Socket | null>(null);

  // keyboard selection
  const [selectedRow, setSelectedRow] = useState<number>(0);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const gridRef = useRef<HTMLDivElement | null>(null);

  function makeHeaders(extra?: Record<string, string>): Headers {
    const h = new Headers(extra);
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token_teacher") ||
          sessionStorage.getItem("token_teacher")
        : null;
    if (token) h.set("Authorization", `Bearer ${token}`);
    return h;
  }

  const fetchJSON = async (url: string, init?: RequestInit) => {
    const r = await fetch(url, init);
    const text = await r.text();
    const body = text ? JSON.parse(text) : {};
    if (!r.ok) throw new Error(body.error || `HTTP ${r.status} ${r.statusText}`);
    return body;
  };

  /* ============== load month report ============== */
  const loadMonth = async (y = year, m = month): Promise<MonthPayload | undefined> => {
    try {
      setLoading(true);
      setErr("");
      const payload: MonthPayload = await fetchJSON(
        MONTH_REPORT(courseInstanceId, y, m, true),
        { headers: makeHeaders() }
      );
      setData(payload);

      // keep selection in-bounds
      setSelectedDay((d) => Math.min(Math.max(1, d || 1), payload.daysInMonth));
      setSelectedRow((r) =>
        Math.min(Math.max(0, r || 0), Math.max(0, payload.students.length - 1))
      );

      // clear live if day not present anymore
      if (liveDay && !payload.sessionsByDay[String(liveDay)]) {
        setLiveDay("");
        setLiveSessionId("");
        setQrValue("");
        socketRef.current?.close();
        socketRef.current = null;
      }
      return payload;
    } catch (e: any) {
      setErr(e.message || "Failed to load month");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonth().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseInstanceId, year, month]);

  /* ============== live QR rotation ============== */
  useEffect(() => {
    if (!liveSessionId) return;
    let on = true;
    const refresh = async () => {
      try {
        const d = await fetchJSON(TOKEN_PATH(liveSessionId), { headers: makeHeaders() });
        if (!on) return;
        if (d.token) setQrValue(JSON.stringify({ sessionId: liveSessionId, token: d.token }));
      } catch {}
    };
    refresh();
    const id = setInterval(refresh, 15000);
    return () => {
      on = false;
      clearInterval(id);
    };
  }, [liveSessionId]);

  /* ============== socket for live updates (one session at a time) ============== */
  useEffect(() => {
    if (!liveSessionId) return;
    const s = io(SOCKET_URL, { withCredentials: true });
    socketRef.current = s;
    s.emit("join-session", liveSessionId, () => {});
    s.on("attendance:updated", ({ record }: { record: { student: string; status: Status } }) => {
      setData((prev) => {
        if (!prev) return prev;
        const day = Object.entries(prev.sessionsByDay).find(
          ([, sid]) => sid === String(liveSessionId)
        )?.[0];
        if (!day) return prev;
        const dnum = Number(day);
        const sid = String(record.student);
        if (!prev.matrix[sid]) return prev;
        const next = { ...prev, matrix: { ...prev.matrix, [sid]: { ...prev.matrix[sid] } } };
        next.matrix[sid][dnum] = record.status;

        // refresh per-student stats if present
        if (next.stats?.perStudent) {
          const sstats = { present: 0, absent: 0, late: 0, total: 0, percentPresent: 0 };
          for (let dd = 1; dd <= prev.daysInMonth; dd++) {
            if (!prev.sessionsByDay[String(dd)]) continue;
            const val = next.matrix[sid][dd];
            if (!val) continue;
            sstats.total++;
            if (val === "present") sstats.present++;
            else if (val === "absent") sstats.absent++;
            else if (val === "late") sstats.late++;
          }
          sstats.percentPresent = sstats.total ? Math.round((sstats.present / sstats.total) * 100) : 0;
          next.stats.perStudent[sid] = sstats;
        }
        return next;
      });
    });
    s.on("attendance:closed", () => {});
    return () => {
      s.emit("leave-session", liveSessionId);
      s.close();
      socketRef.current = null;
    };
  }, [liveSessionId]);

  /* ============== helpers for backfilling past days ============== */
  const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  // NOTE: requires backend support for (forDate, reuse)
  const ensureSessionForDay = async (day: number): Promise<string> => {
    if (!data) throw new Error("No month data loaded");
    const existing = data.sessionsByDay[String(day)];
    if (existing) return existing;

    const forDate = `${year}-${pad2(month)}-${pad2(day)}`;
    const res = await fetchJSON(OPEN_SESSION(), {
      method: "POST",
      headers: makeHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ courseInstanceId, forDate, reuse: true, rotating: false }),
    });

    await loadMonth(year, month);
    return String(res.sessionId);
  };

  /* ============== actions ============== */
  const openTodaySession = async () => {
    try {
      const today = new Date();
      const y = today.getFullYear();
      const m = today.getMonth() + 1;
      if (y !== year || m !== month) {
        alert("Switch the picker to the current month to open today's session.");
        return;
      }
      await fetchJSON(OPEN_SESSION(), {
        method: "POST",
        headers: makeHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ courseInstanceId, rotating: true }),
      });
      const fresh = await loadMonth(y, m);
      const d = today.getDate();
      if (fresh?.sessionsByDay[String(d)]) {
        setLiveDay(d);
        setLiveSessionId(fresh.sessionsByDay[String(d)]);
      }
    } catch (e: any) {
      alert(e.message || "Failed to open session");
    }
  };

  const joinLiveForDay = (d: number) => {
    if (!data) return;
    const sid = data.sessionsByDay[String(d)];
    if (!sid) return;
    setLiveDay(d);
    setLiveSessionId(sid);
  };

  // UPDATED: fully tear down live state so QR hides immediately
  const closeLiveSession = async () => {
    if (!liveSessionId) return;
    const closingId = liveSessionId; // capture in case state changes fast
    try {
      await fetchJSON(CLOSE_SESSION(closingId), { method: "POST", headers: makeHeaders() });
    } catch (e: any) {
      alert(e.message || "Failed to close session");
    } finally {
      try {
        socketRef.current?.emit("leave-session", closingId);
        socketRef.current?.close();
      } catch {}
      socketRef.current = null;

      setQrValue("");
      setLiveSessionId("");     // hides QR block
      // Optionally also clear selection from dropdown:
      // setLiveDay("");

      await loadMonth();        // pick up auto-absents, etc.
    }
  };

  const setStatus = async (studentId: string, day: number, status: "present" | "absent") => {
    if (!data) return;
    let sid = data.sessionsByDay[String(day)];
    if (!sid) {
      try {
        sid = await ensureSessionForDay(day);
      } catch (e: any) {
        alert(e.message || "Could not create session for that date");
        return;
      }
    }
    try {
      const res = await fetchJSON(MANUAL_MARK(sid), {
        method: "POST",
        headers: makeHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ studentId, status }),
      });
      const saved: { student: string; status: "present" | "absent" } = res.record;

      setData((prev) => {
        if (!prev) return prev;
        const pid = String(saved.student);
        const next = { ...prev, matrix: { ...prev.matrix, [pid]: { ...prev.matrix[pid] } } };
        next.matrix[pid][day] = saved.status;

        if (!next.sessionsByDay[String(day)]) {
          next.sessionsByDay = { ...next.sessionsByDay, [String(day)]: sid! };
        }

        if (next.stats?.perStudent) {
          const sstats = { present: 0, absent: 0, late: 0, total: 0, percentPresent: 0 };
          for (let dd = 1; dd <= next.daysInMonth; dd++) {
            if (!next.sessionsByDay[String(dd)]) continue;
            const val = next.matrix[pid][dd];
            if (!val) continue;
            sstats.total++;
            if (val === "present") sstats.present++;
            else if (val === "absent") sstats.absent++;
            else if (val === "late") sstats.late++;
          }
          sstats.percentPresent = sstats.total ? Math.round((sstats.present / sstats.total) * 100) : 0;
          next.stats.perStudent[pid] = sstats;
        }
        return next;
      });
    } catch (e: any) {
      alert(e.message || "Failed to update");
    }
  };

  /* ============== keyboard nav ============== */
  useEffect(() => {
    if (!data) return;
    const id = `cell-${selectedRow}-${selectedDay}`;
    const el = document.getElementById(id);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedRow, selectedDay, data]);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!data || data.students.length === 0) return;

    const lastRow = data.students.length - 1;
    const lastDay = data.daysInMonth;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      setSelectedDay((d) => Math.min(lastDay, d + 1));
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSelectedDay((d) => Math.max(1, d - 1));
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedRow((r) => Math.min(lastRow, r + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedRow((r) => Math.max(0, r - 1));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      setSelectedRow((r) => (r >= lastRow ? 0 : r + 1));
      return;
    }

    if (e.key === "p" || e.key === "P" || e.key === "a" || e.key === "A") {
      e.preventDefault();
      const student = data.students[selectedRow];
      if (!student) return;
      const status = e.key.toLowerCase() === "p" ? "present" : "absent";
      await setStatus(String(student._id), selectedDay, status);
      setSelectedRow((r) => (r >= lastRow ? 0 : r + 1));
      return;
    }

    if (e.key === " ") {
      e.preventDefault();
      const student = data.students[selectedRow];
      if (!student) return;
      const sid = String(student._id);
      const v = data.matrix[sid]?.[selectedDay] ?? null;
      const next: "present" | "absent" = v === "present" ? "absent" : "present";
      await setStatus(sid, selectedDay, next);
      setSelectedRow((r) => (r >= lastRow ? 0 : r + 1));
    }
  };

  /* ============== derived ============== */
  const monthName = useMemo(
    () => new Date(year, month - 1, 1).toLocaleString(undefined, { month: "long" }),
    [year, month]
  );

  const selectableYears = useMemo(() => {
    const y = now.getFullYear();
    return [y - 2, y - 1, y, y + 1, y + 2];
  }, [now]);

  const statusLetter = (status: Status) =>
    status === "present" ? "P" : status === "absent" ? "A" : status === "late" ? "L" : "—";

  const overallStats = useMemo(() => {
    if (!data?.stats?.perStudent) return null;
    const students = Object.values(data.stats.perStudent);
    const total = students.length;
    if (total === 0) return null;

    const avgPresent = Math.round(students.reduce((sum, s) => sum + s.present, 0) / total);
    const avgPercent = Math.round(students.reduce((sum, s) => sum + s.percentPresent, 0) / total);
    const excellentStudents = students.filter((s) => s.percentPresent >= 90).length;
    const atRiskStudents = students.filter((s) => s.percentPresent < 70).length;

    return { avgPresent, avgPercent, excellentStudents, atRiskStudents, total };
  }, [data]);

  /* ============== UI ============== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="p-6 space-y-8" ref={gridRef} tabIndex={0} onKeyDown={handleKeyDown}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Users className="w-8 h-8 text-indigo-600" />
              Attendance Dashboard
            </h1>
            <p className="text-gray-600 mt-1">Manage student attendance with live QR scanning</p>
          </div>

          {overallStats && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-white rounded-lg p-3 border shadow-sm">
                <div className="text-gray-500">Avg Attendance</div>
                <div className="text-2xl font-bold text-indigo-600">{overallStats.avgPercent}%</div>
              </div>
              <div className="bg-white rounded-lg p-3 border shadow-sm">
                <div className="text-gray-500">At Risk Students</div>
                <div className="text-2xl font-bold text-red-600">{overallStats.atRiskStudents}</div>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl p-6 border shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            {/* Date Selectors */}
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <div className="relative">
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1, 1).toLocaleString(undefined, { month: "long" })}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2 top-3 text-gray-400" />
              </div>

              <div className="relative">
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {selectableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2 top-3 text-gray-400" />
              </div>
            </div>

            <button
              onClick={() => loadMonth()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Loading..." : "Reload"}
            </button>

            <div className="flex-1" />

            {/* Live Controls */}
            <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-3 border border-indigo-100">
              <QrCode className="w-5 h-5 text-indigo-600" />
              <span className="text-sm font-medium text-gray-700">Live Session:</span>

              <div className="relative">
                <select
                  value={liveDay || ""}
                  onChange={async (e) => {
                    const v = e.target.value ? Number(e.target.value) : "";
                    if (!v) {
                      setLiveDay("");
                      setLiveSessionId("");
                      setQrValue("");
                      socketRef.current?.close();
                      socketRef.current = null;
                      return;
                    }
                    if (data && !data.sessionsByDay[String(v)]) {
                      try {
                        const sid = await ensureSessionForDay(v);
                        setLiveDay(v);
                        setLiveSessionId(sid);
                      } catch (err: any) {
                        alert(err.message || "Could not prepare session for live");
                      }
                    } else {
                      joinLiveForDay(v);
                    }
                  }}
                  className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select day</option>
                  {data &&
                    Array.from({ length: data.daysInMonth }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        Day {d}
                      </option>
                    ))}
                </select>
                <ChevronDown className="w-3 h-3 absolute right-2 top-3 text-gray-400" />
              </div>

              <button
                onClick={openTodaySession}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
              >
                <Play className="w-4 h-4" />
                Start Today
              </button>

              <button
                onClick={closeLiveSession}
                disabled={!liveSessionId}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                <Square className="w-4 h-4" />
                Stop Live
              </button>
            </div>
          </div>
        </div>

        {/* Keyboard Hints */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center gap-4 text-sm text-blue-800">
            <span className="font-medium">Keyboard Shortcuts:</span>
            <div className="flex flex-wrap gap-4">
              <span>
                <kbd className="px-2 py-1 bg-white rounded border text-xs">← ↑ → ↓</kbd> Navigate
              </span>
              <span>
                <kbd className="px-2 py-1 bg-white rounded border text-xs">P</kbd> Present
              </span>
              <span>
                <kbd className="px-2 py-1 bg-white rounded border text-xs">A</kbd> Absent
              </span>
              <span>
                <kbd className="px-2 py-1 bg-white rounded border text-xs">Enter</kbd> Next student
              </span>
              <span>
                <kbd className="px-2 py-1 bg-white rounded border text-xs">Space</kbd> Toggle
              </span>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {err && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <span className="font-medium">Error:</span>
              <span>{err}</span>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Attendance Sheet */}
          <div className="xl:col-span-3">
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                <h2 className="text-lg font-semibold text-gray-900">
                  {monthName} {year} Attendance
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {data?.students.length || 0} students •{" "}
                  {data ? Object.keys(data.sessionsByDay).length : 0} sessions
                </p>
              </div>

              <div className="overflow-auto max-h-[70vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100 z-10">
                    <tr>
                      <Th className="sticky left-0 z-20 bg-gradient-to-r from-gray-50 to-gray-100">
                        Student
                      </Th>
                      {data &&
                        Array.from({ length: data.daysInMonth }, (_, i) => i + 1).map((d) => {
                          const hasSession = !!data.sessionsByDay[String(d)];
                          const isToday =
                            d === now.getDate() &&
                            year === now.getFullYear() &&
                            month === now.getMonth() + 1;
                          return (
                            <Th
                              key={d}
                              className={`text-center ${
                                hasSession ? "bg-blue-50" : ""
                              } ${isToday ? "bg-yellow-100 font-bold" : ""}`}
                            >
                              {d}
                              {hasSession && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full mx-auto mt-1" />
                              )}
                            </Th>
                          );
                        })}
                      <Th className="text-center">Present</Th>
                      <Th className="text-center">%</Th>
                    </tr>
                  </thead>

                  <tbody>
                    {data?.students.map((s, rowIdx) => {
                      const sid = String(s._id);
                      const row = data.matrix[sid];
                      const totals = data.stats?.perStudent?.[sid];
                      const attendancePercent =
                        totals?.percentPresent ??
                        Number(
                          computePercent(
                            row,
                            data.sessionsByDay,
                            data.daysInMonth
                          ).replace("%", "")
                        );
                      const presentCount =
                        totals?.present ??
                        countRowPresent(
                          row,
                          data.sessionsByDay,
                          data.daysInMonth
                        );

                      return (
                        <tr key={sid} className="border-t hover:bg-gray-50 transition-colors">
                          <Td className="sticky left-0 z-10 bg-white hover:bg-gray-50 transition-colors min-w-[220px]">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                  attendancePercent >= 90
                                    ? "bg-green-100 text-green-800"
                                    : attendancePercent >= 70
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {s.username?.[0]?.toUpperCase() || "?"}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {s.username || "(no name)"}
                                </div>
                                <div className="text-xs text-gray-500">{s.email}</div>
                              </div>
                            </div>
                          </Td>

                          {Array.from({ length: data.daysInMonth }, (_, i) => i + 1).map((day) => {
                            const hasSession = !!data.sessionsByDay[String(day)];
                            const v = row?.[day] ?? null;
                            const isSelected = rowIdx === selectedRow && day === selectedDay;
                            const isLiveDay = liveDay === day;

                            return (
                              <Td key={day} className="text-center">
                                <button
                                  id={`cell-${rowIdx}-${day}`}
                                  onClick={() => {
                                    setSelectedRow(rowIdx);
                                    setSelectedDay(day);
                                  }}
                                  onDoubleClick={async () => {
                                    const next: "present" | "absent" =
                                      v === "present" ? "absent" : "present";
                                    await setStatus(sid, day, next);
                                  }}
                                  className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all hover:scale-105 ${
                                    !hasSession && v === null
                                      ? "border-gray-200 bg-gray-50"
                                      : v === "present"
                                      ? "border-green-300 bg-green-100"
                                      : v === "absent"
                                      ? "border-red-300 bg-red-100"
                                      : v === "late"
                                      ? "border-yellow-300 bg-yellow-100"
                                      : "border-gray-200 bg-white"
                                  } ${
                                    isSelected ? "ring-2 ring-indigo-500 ring-offset-1" : ""
                                  } ${isLiveDay ? "ring-2 ring-purple-400" : ""}`}
                                  title={
                                    hasSession
                                      ? "Click to select, double-click to toggle"
                                      : "No session - type P/A to create"
                                  }
                                  aria-label={`Day ${day} status ${v ?? "none"}`}
                                >
                                  <span className="font-semibold">
                                    {statusLetter(v)}
                                  </span>
                                </button>
                              </Td>
                            );
                          })}

                          {/* Present count */}
                          <Td className="text-center font-semibold">
                            <div className="inline-flex items-center justify-center gap-2">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-800 text-xs font-bold">
                                P
                              </span>
                              {presentCount}
                            </div>
                          </Td>

                          {/* Percent */}
                          <Td className="text-center">
                            <div
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                attendancePercent >= 90
                                  ? "bg-green-100 text-green-800"
                                  : attendancePercent >= 70
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {attendancePercent}%
                            </div>
                          </Td>
                        </tr>
                      );
                    })}

                    {data && data.students.length === 0 && (
                      <tr>
                        <Td colSpan={data.daysInMonth + 3} className="text-center py-8">
                          <div className="flex flex-col items-center gap-2 text-gray-500">
                            <Users className="w-8 h-8" />
                            <span>No students enrolled</span>
                          </div>
                        </Td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Live QR Code */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-semibold text-gray-900">
                    {liveDay ? `Live Session - Day ${liveDay}` : "QR Code Scanner"}
                  </h3>
                </div>
                {liveDay && (
                  <p className="text-sm text-gray-600 mt-1">
                    {monthName} {liveDay}, {year}
                  </p>
                )}
              </div>

              <div className="p-6 flex flex-col items-center">
                {liveSessionId ? (
                  qrValue ? (
                    <div className="space-y-4">
                      <div className="bg-white p-4 rounded-xl border-2 border-indigo-200">
                        <QRCodeSVG value={qrValue} size={200} />
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          <span className="text-sm font-medium">Live & Active</span>
                        </div>
                        <p className="text-xs text-gray-500">Token refreshes every 15 seconds</p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-[200px] h-[200px] bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center">
                      <div className="text-center">
                        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Generating QR...</p>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="text-center py-8">
                    <QrCode className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-sm text-gray-500 mb-2">No active session</p>
                    <p className="text-xs text-gray-400">Select a live day or start today's session</p>
                  </div>
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                <h3 className="font-semibold text-gray-900">Status Legend</h3>
              </div>
              <div className="p-4 space-y-3">
                <LegendItem color="green" letter="P" title="Present" desc="Student attended" />
                <LegendItem color="red" letter="A" title="Absent" desc="Student missed class" />
                <LegendItem color="yellow" letter="L" title="Late" desc="Arrived after start" />
                <LegendItem color="gray" letter="—" title="No Session" desc="Class not held" />
              </div>
            </div>

            {/* Quick Stats */}
            {overallStats && (
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                  <h3 className="font-semibold text-gray-900">Class Overview</h3>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{overallStats.total}</div>
                      <div className="text-xs text-blue-800">Students</div>
                    </div>
                    <div className="text-center p-3 bg-indigo-50 rounded-lg">
                      <div className="text-2xl font-bold text-indigo-600">{overallStats.avgPresent}</div>
                      <div className="text-xs text-indigo-800">Avg Present</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Excellent (≥90%)</span>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span className="text-sm font-medium">{overallStats.excellentStudents}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">At Risk (&lt;70%)</span>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                        <span className="text-sm font-medium">{overallStats.atRiskStudents}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t">
                    <div className="text-xs text-gray-500 mb-2">Overall Attendance</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${overallStats.avgPercent}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        {overallStats.avgPercent}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =================== Helper Components =================== */

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-700 ${className}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  colSpan,
  className = "",
}: {
  children: React.ReactNode;
  colSpan?: number;
  className?: string;
}) {
  return (
    <td colSpan={colSpan} className={`px-4 py-3 ${className}`}>
      {children}
    </td>
  );
}

function LegendItem({
  color,
  letter,
  title,
  desc,
}: {
  color: "green" | "red" | "yellow" | "gray";
  letter: string;
  title: string;
  desc: string;
}) {
  const map = {
    green: "border-green-300 bg-green-100 text-green-800",
    red: "border-red-300 bg-red-100 text-red-800",
    yellow: "border-yellow-300 bg-yellow-100 text-yellow-800",
    gray: "border-gray-200 bg-gray-50 text-gray-700",
  } as const;
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center font-bold ${map[color]}`}>
        {letter}
      </div>
      <div>
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-gray-500">{desc}</div>
      </div>
    </div>
  );
}

function countRowPresent(
  row: Record<number, Status> | undefined,
  sessionsByDay: Record<string, string>,
  daysInMonth: number
) {
  if (!row) return 0;
  let c = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (!sessionsByDay[String(d)]) continue;
    if (row[d] === "present") c++;
  }
  return c;
}

function computePercent(
  row: Record<number, Status> | undefined,
  sessionsByDay: Record<string, string>,
  daysInMonth: number
) {
  if (!row) return "0%";
  let present = 0;
  let total = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (!sessionsByDay[String(d)]) continue;
    const v = row[d];
    if (!v) continue;
    total++;
    if (v === "present") present++;
  }
  return total ? `${Math.round((present / total) * 100)}%` : "0%";
}
