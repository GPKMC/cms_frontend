"use client";

import { useEffect, useMemo, useState } from "react";

/* ========= CONFIG ========= */
const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");

const EP = {
  faculties: `${BACKEND}/faculty-api/faculties`,              // GET ?limit=
  batches: `${BACKEND}/batch-api/batch`,                      // GET ?faculty=
  semYears: `${BACKEND}/sem-api/semesterOrYear`,              // GET ?faculty=
  courseInstances: `${BACKEND}/course-api/overallCourseInstance`, // GET ?faculty=&batch=&semesterOrYear=
  batchPeriod: `${BACKEND}/batch-api/batchPeriod/ongoing`,    // GET ?batch=&semesterOrYear=
  solve: `${BACKEND}/schedule/solve`,                         // POST
};

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token_admin") || localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJSON<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init.headers || {}),
    },
    credentials: "include",
  });
  if (!res.ok) {
    let msg = "";
    try {
      const body = (await res.json()) as any;
      msg = body?.error || body?.message || "";
    } catch {}
    throw new Error(msg || res.statusText);
  }
  return res.json() as Promise<T>;
}

/* ========= TYPES ========= */
type Faculty = { _id: string; name: string; code?: string; type?: "semester" | "yearly" };
type Batch = { _id: string; name: string }; // name = batchname
type SemOrYear = { _id: string; name: string };

type CourseInstanceLite = {
  _id: string;
  courseName: string;
  courseCode?: string;
  teacherName: string;
  batchName: string;
};

type Row = {
  ciId: string;
  courseName: string;
  courseCode?: string;
  teacherName: string;
  batchName: string;
  sessionsPerWeek: number;
  durationMinutes: number;
  allowedDays: number[]; // 0..6
};

type TaskInput = {
  courseInstanceId: string;
  sessionsPerWeek: number;
  durationMinutes: number;
  allowedDays?: number[];
  type?: "lecture" | "lab" | "tutorial" | "other";
};

type SolvePreviewEvent = {
  courseInstance: string;
  day?: number;
  daysOfWeek?: number[];
  startMinutes: number;
  endMinutes: number;
  startDate?: string | Date;
  endDate?: string | Date;
};

type BatchPeriodLite = { startDate?: string; endDate?: string; status?: string } | null;
type Message = { type: "success" | "error"; text: string } | null;

/* ========= HELPERS ========= */
const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"] as const;
const dayAbbr  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"] as const;

// Safer list-unwrapper to avoid `.map is not a function`
function asArray<T = any>(payload: any, keys: string[] = []): T[] {
  if (Array.isArray(payload)) return payload;
  for (const k of keys) {
    if (Array.isArray(payload?.[k])) return payload[k];
  }
  return [];
}

const minutesTo12h = (mins: number): string => {
  if (!Number.isFinite(mins)) return "";
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
};

/* ========= PAGE ========= */
export default function ScheduleBuilderPage() {
  // filters
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [facultyId, setFacultyId] = useState<string>("");

  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState<string>("");

  const [sems, setSems] = useState<SemOrYear[]>([]);
  const [semId, setSemId] = useState<string>("");

  // date range (auto-filled & locked when BatchPeriod is found)
  const [startDate, setStartDate] = useState<string>("");
  const [endDate,   setEndDate]   = useState<string>("");

  // data
  const [cis, setCis] = useState<CourseInstanceLite[]>([]);
  const [rows, setRows] = useState<Row[]>([]);

  // BatchPeriod (ongoing)
  const [bp, setBp] = useState<BatchPeriodLite>(null);

  // ui state
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingCis, setLoadingCis] = useState<boolean>(false);
  const [msg, setMsg] = useState<Message>(null);

  // solver state
  const [preview, setPreview] = useState<SolvePreviewEvent[]>([]);
  const [committing, setCommitting] = useState<boolean>(false);

  /* ===== load faculties ===== */
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchJSON<any>(`${EP.faculties}?limit=200`);
        const list: Faculty[] = asArray<any>(data, ["rows", "faculties", "items"]).map((f) => ({
          _id: f._id || f.id,
          name: f.name,
          code: f.code,
          type: f.type,
        }));
        setFaculties(list);
      } catch (e: any) {
        setMsg({ type: "error", text: `Failed to load faculties: ${e.message}` });
      }
    })();
  }, []);

  /* ===== when faculty changes: load batches + semesters ===== */
  useEffect(() => {
    setCis([]); setRows([]); setPreview([]);
    if (!facultyId) {
      setBatches([]); setSems([]); setBatchId(""); setSemId("");
      setBp(null); setStartDate(""); setEndDate("");
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const [b, s] = await Promise.all([
          fetchJSON<any>(`${EP.batches}?faculty=${facultyId}&limit=500`),
          fetchJSON<any>(`${EP.semYears}?faculty=${facultyId}&limit=200`),
        ]);
        const bs: Batch[] = asArray<any>(b, ["rows", "batches", "items"]).map((x) => ({
          _id: x._id || x.id,
          name: x.batchname || x.name,
        }));
        const ss: SemOrYear[] = asArray<any>(s, ["rows", "semesters", "years", "items"]).map((x) => ({
          _id: x._id || x.id,
          name: x.name,
        }));
        setBatches(bs);
        setSems(ss);
        setBatchId("");
        setSemId("");
        setBp(null);
        setStartDate("");
        setEndDate("");
      } catch (e: any) {
        setMsg({ type: "error", text: `Failed to load batches/semesters: ${e.message}` });
      } finally {
        setLoading(false);
      }
    })();
  }, [facultyId]);

  /* ===== when batch + sem selected: fetch ongoing BatchPeriod and auto-fill dates ===== */
  useEffect(() => {
    setPreview([]);
    if (!batchId || !semId) {
      setBp(null);
      setStartDate("");
      setEndDate("");
      return;
    }
    (async () => {
      try {
        const qs = new URLSearchParams({ batch: batchId, semesterOrYear: semId }).toString();
        const data = await fetchJSON<any>(`${EP.batchPeriod}?${qs}`);
        // BE shape suggested: { ok: true, period: {...} }  — fall back to raw
        const period = data?.period || data || null;
        const s = period?.startDate ? new Date(period.startDate) : null;
        const e = period?.endDate ? new Date(period.endDate) : null;
        setBp(period);
        // lock the UI to the BatchPeriod window if present
        if (s) setStartDate(s.toISOString().slice(0, 10));
        if (e) setEndDate(e.toISOString().slice(0, 10));
      } catch (e) {
        // no ongoing period; allow manual dates
        setBp(null);
        setStartDate("");
        setEndDate("");
      }
    })();
  }, [batchId, semId]);

  /* ===== load course instances ===== */
  async function loadCourseInstances(): Promise<void> {
    if (!facultyId) {
      setMsg({ type: "error", text: "Pick a faculty first." });
      return;
    }
    setLoadingCis(true);
    setPreview([]);
    try {
      const qs = new URLSearchParams();
      qs.set("faculty", facultyId);
      if (batchId) qs.set("batch", batchId);
      if (semId) qs.set("semesterOrYear", semId);
      qs.set("limit", "1000");

      const data = await fetchJSON<any>(`${EP.courseInstances}?${qs.toString()}`);
      const array = asArray<any>(data, ["items", "rows", "courseInstances"]);
      const list: CourseInstanceLite[] = array.map((ci) => ({
        _id: ci._id || ci.id,
        courseName: ci.course?.name || "—",
        courseCode: ci.course?.code || undefined,
        teacherName: ci.teacher?.name || ci.teacher?.username || "—",
        batchName: ci.batch?.batchname || "—",
      }));

      setCis(list);

      const defaults: Row[] = list.map((x) => ({
        ciId: x._id,
        courseName: x.courseName,
        courseCode: x.courseCode,
        teacherName: x.teacherName,
        batchName: x.batchName,
        sessionsPerWeek: 2,
        durationMinutes: 60,
        allowedDays: [],
      }));
      setRows(defaults);
      if (list.length === 0) {
        setMsg({ type: "error", text: "No course instances match your filters." });
      } else {
        setMsg(null);
      }
    } catch (e: any) {
      setMsg({ type: "error", text: `Failed to load course instances: ${e.message}` });
    } finally {
      setLoadingCis(false);
    }
  }

  /* ===== build tasks for solver ===== */
  const tasks: TaskInput[] = useMemo(() => {
    return rows
      .filter((r) => r.sessionsPerWeek > 0 && r.durationMinutes > 0)
      .map((r) => ({
        courseInstanceId: r.ciId,
        sessionsPerWeek: Number(r.sessionsPerWeek),
        durationMinutes: Number(r.durationMinutes),
        allowedDays: r.allowedDays.length ? r.allowedDays : undefined,
        type: "lecture",
      }));
  }, [rows]);

  /* ===== date validation against BatchPeriod (if exists) ===== */
  const datesValid = useMemo(() => {
    if (!startDate || !endDate) return false;
    const s = new Date(startDate), e = new Date(endDate);
    if (s > e) return false;
    if (bp?.startDate) {
      const bps = new Date(bp.startDate);
      if (s < bps) return false;
    }
    if (bp?.endDate) {
      const bpe = new Date(bp.endDate);
      if (e > bpe) return false;
    }
    return true;
  }, [startDate, endDate, bp]);

  const canRun = useMemo<boolean>(() => tasks.length > 0 && datesValid, [tasks, datesValid]);

  /* ===== solver calls ===== */
  async function runSolve(dry: boolean): Promise<void> {
    if (!canRun) {
      setMsg({
        type: "error",
        text: bp
          ? "Pick dates within the ongoing BatchPeriod and add at least one course with sessions/duration."
          : "Pick a valid date range and add at least one course with sessions/duration.",
      });
      return;
    }
    setPreview([]);
    setMsg(null);
    try {
      const body = JSON.stringify({ tasks, startDate, endDate, dryRun: dry, checkExisting: true });
      const data = await fetchJSON<{ ok: boolean; events: SolvePreviewEvent[] }>(EP.solve, { method: "POST", body });
      const events = asArray<SolvePreviewEvent>(data, ["events"]);
      setPreview(events);
      setMsg({
        type: "success",
        text: dry ? `Dry-run found ${events.length} weekly slots.` : `Created ${events.length} events.`,
      });
    } catch (e: any) {
      setMsg({ type: "error", text: e.message || "Solve failed" });
    }
  }

  async function commit(): Promise<void> {
    setCommitting(true);
    try {
      await runSolve(false);
    } finally {
      setCommitting(false);
    }
  }

  /* ===== UI helpers ===== */
  function toggleAllowedDay(ciId: string, d: number) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.ciId !== ciId) return r;
        const set = new Set<number>(r.allowedDays || []);
        set.has(d) ? set.delete(d) : set.add(d);
        return { ...r, allowedDays: Array.from(set).sort((a, b) => a - b) };
      })
    );
  }
  function setRow(ciId: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.ciId === ciId ? { ...r, ...patch } : r)));
  }

  /* ===== Preview by day ===== */
  const previewByDay: Record<number, SolvePreviewEvent[]> = useMemo(() => {
    const map: Record<number, SolvePreviewEvent[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const ev of preview) {
      const day = Array.isArray(ev.daysOfWeek) ? ev.daysOfWeek[0] : ev.day ?? 0;
      map[day].push(ev);
    }
    (Object.keys(map) as unknown as number[]).forEach((k: any) => {
      map[Number(k)].sort((a, b) => (a.startMinutes || 0) - (b.startMinutes || 0));
    });
    return map;
  }, [preview]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-6 space-y-8">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-gray-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent">
            Weekly Schedule Builder
          </h1>
          <p className="text-gray-600 mt-2">
            Build a timetable across faculties using teacher availability and conflict checks. Course names shown—no raw IDs.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-white/50 p-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Faculty</label>
              <select
                value={facultyId}
                onChange={(e) => setFacultyId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 bg-white"
              >
                <option value="">Select faculty…</option>
                {faculties.map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.code ? `${f.code} — ${f.name}` : f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Batch (optional)</label>
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                disabled={!facultyId}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 bg-white disabled:opacity-60"
              >
                <option value="">All batches</option>
                {batches.map((b) => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Semester/Year (optional)</label>
              <select
                value={semId}
                onChange={(e) => setSemId(e.target.value)}
                disabled={!facultyId}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 bg-white disabled:opacity-60"
              >
                <option value="">All</option>
                {sems.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={loadCourseInstances}
                disabled={!facultyId || loading || loadingCis}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 font-semibold disabled:opacity-50"
              >
                {loadingCis ? "Loading…" : "Load Courses"}
              </button>
            </div>
          </div>

          {/* Date range (auto-filled & locked if BatchPeriod exists) */}
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Start Date {bp ? <span className="text-xs text-gray-500">(from BatchPeriod)</span> : null}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={!!bp}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 bg-white disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                End Date {bp ? <span className="text-xs text-gray-500">(from BatchPeriod)</span> : null}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={!!bp}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 bg-white disabled:opacity-60"
              />
            </div>
          </div>
          {!datesValid && startDate && endDate && (
            <div className="mt-2 text-sm text-red-600">
              Dates must be valid{bp ? " and within the ongoing BatchPeriod" : ""}.
            </div>
          )}
        </div>

        {/* Courses Table */}
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-white/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Course Instances ({rows.length})</h2>
            <div className="text-sm text-gray-500">Tip: Leave “Allowed Days” empty to let availability decide.</div>
          </div>

          {rows.length === 0 ? (
            <div className="text-gray-500 text-center py-10">No course instances loaded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b bg-gray-50">
                    <th className="px-3 py-2">Course</th>
                    <th className="px-3 py-2">Teacher</th>
                    <th className="px-3 py-2">Batch</th>
                    <th className="px-3 py-2">Sessions/Week</th>
                    <th className="px-3 py-2">Duration (mins)</th>
                    <th className="px-3 py-2">Allowed Days</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.ciId} className="border-b hover:bg-gray-50/60">
                      <td className="px-3 py-2 font-medium">
                        {r.courseCode ? `${r.courseCode} — ${r.courseName}` : r.courseName}
                      </td>
                      <td className="px-3 py-2">{r.teacherName}</td>
                      <td className="px-3 py-2">{r.batchName}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          max={14}
                          value={r.sessionsPerWeek}
                          onChange={(e) => setRow(r.ciId, { sessionsPerWeek: Math.max(1, Number(e.target.value || 0)) })}
                          className="w-24 rounded-lg border border-gray-200 px-2 py-1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={15}
                          max={240}
                          value={r.durationMinutes}
                          onChange={(e) => setRow(r.ciId, { durationMinutes: Math.max(15, Number(e.target.value || 0)) })}
                          className="w-28 rounded-lg border border-gray-200 px-2 py-1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {dayAbbr.map((dname, d) => {
                            const active = (r.allowedDays || []).includes(d);
                            return (
                              <button
                                key={`${r.ciId}-${d}`}
                                type="button"
                                onClick={() => toggleAllowedDay(r.ciId, d)}
                                className={`px-2 py-1 rounded-lg border text-xs ${
                                  active
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-100"
                                }`}
                              >
                                {dname}
                              </button>
                            );
                          })}
                          {(r.allowedDays || []).length === 0 && (
                            <span className="text-[11px] text-gray-400 ml-1">(any day)</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => runSolve(true)}
              disabled={!canRun || loadingCis}
              className="bg-white border border-indigo-600 text-indigo-700 hover:bg-indigo-50 rounded-xl px-4 py-2 font-semibold disabled:opacity-50"
            >
              Dry-Run (Preview)
            </button>
            <button
              onClick={commit}
              disabled={!canRun || committing || loadingCis}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 font-semibold disabled:opacity-50"
            >
              {committing ? "Creating…" : "Create Schedule"}
            </button>
            <div className="flex-1 text-right">
              {msg && (
                <span
                  className={`inline-block px-3 py-2 rounded-lg text-sm ${
                    msg.type === "success"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {msg.text}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Preview timetable */}
        {preview.length > 0 && (
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-white/50 p-6">
            <h3 className="text-xl font-bold mb-4">Preview (Weekly)</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dayNames.map((name, d) => {
                const arr = previewByDay[d] || [];
                return (
                  <div key={name} className="rounded-xl border bg-gray-50">
                    <div className="border-b bg-white px-3 py-2 font-semibold">{name}</div>
                    <div className="p-3 min-h-[72px] space-y-2">
                      {arr.length === 0 ? (
                        <div className="text-gray-400 text-sm">—</div>
                      ) : (
                        arr.map((ev, idx) => {
                          const ci = cis.find((x) => x._id === ev.courseInstance);
                          const label = ci
                            ? ci.courseCode
                              ? `${ci.courseCode} — ${ci.courseName}`
                              : ci.courseName
                            : "Course";
                          return (
                            <div key={`${d}-${idx}`} className="bg-white border rounded-lg px-3 py-2 shadow-sm">
                              <div className="text-sm font-semibold">{label}</div>
                              <div className="text-xs text-gray-600">
                                {minutesTo12h(ev.startMinutes)} – {minutesTo12h(ev.endMinutes)}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-gray-500 mt-3">Times shown in local time, formatted with AM/PM.</div>
          </div>
        )}
      </div>
    </div>
  );
}
