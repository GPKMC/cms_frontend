"use client";

import React, { useEffect, useMemo, useState } from "react";

/** ===== Config ===== */
const API_PREFIX = `${(process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/$/, "")}/schedule`;

/** ===== Types ===== */
type TeacherLite = { _id: string; name?: string; username?: string; email?: string };
type Slot = { id: string; start: string; end: string };
type DaySlots = Record<number, Slot[]>; // 0..6 -> slots array

/** ===== Helpers ===== */
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayAbbr = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n || "0", 10));
  return h * 60 + m;
};
const genId = () => Math.random().toString(36).slice(2, 9);
const emptyWeek = (): DaySlots => ({ 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] });

/** Validate no overlaps per day and start < end */
function validateWeek(week: DaySlots): string[] {
  const errors: string[] = [];
  for (let d = 0; d <= 6; d++) {
    const slots = week[d] || [];
    for (const s of slots) {
      if (!s.start || !s.end) errors.push(`${dayAbbr[d]}: empty time`);
      const a = toMinutes(s.start);
      const b = toMinutes(s.end);
      if (a >= b) errors.push(`${dayAbbr[d]}: start must be before end (${s.start}–${s.end})`);
    }
    const sorted = [...slots].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    for (let i = 1; i < sorted.length; i++) {
      const p = sorted[i - 1];
      const c = sorted[i];
      if (toMinutes(p.end) > toMinutes(c.start)) {
        errors.push(`${dayAbbr[d]}: ${p.start}-${p.end} overlaps ${c.start}-${c.end}`);
      }
    }
  }
  return errors;
}

/** Convert DaySlots -> API weeklyWindows */
function toWeeklyWindows(week: DaySlots) {
  const out: { day: number; startMinutes: number; endMinutes: number }[] = [];
  for (let d = 0; d <= 6; d++) {
    for (const s of week[d] || []) {
      out.push({ day: d, startMinutes: toMinutes(s.start), endMinutes: toMinutes(s.end) });
    }
  }
  return out;
}

/** Preset: Mon/Wed/Fri 06:00–10:00 */
function mwfPreset(): DaySlots {
  const wk = emptyWeek();
  const mk = (start: string, end: string): Slot => ({ id: genId(), start, end });
  wk[1] = [mk("06:00", "10:00")];
  wk[3] = [mk("06:00", "10:00")];
  wk[5] = [mk("06:00", "10:00")];
  return wk;
}
/** Merge current week with preset days (replace those days only) */
function mergePreset(current: DaySlots, preset: DaySlots): DaySlots {
  const out: DaySlots = { ...emptyWeek(), ...current };
  for (let d = 0; d <= 6; d++) {
    if ((preset[d] || []).length) out[d] = preset[d];
  }
  return out;
}

/** ===== Auth + fetch helpers (uses token_admin first) ===== */
function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token_admin") || localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}
function buildHeaders(init?: HeadersInit, extra?: Record<string, string>): Headers {
  const h = new Headers(init);
  if (extra) for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return h;
}
async function fetchJSON(url: string, init?: RequestInit, extra?: Record<string, string>) {
  const headers = buildHeaders(init?.headers, { ...authHeaders(), ...(extra || {}) });
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || res.statusText);
  return res.json();
}

/** Load teachers from /schedule/teachers (supports search & paging) */
async function loadTeachers(search = "", limit = 200, page = 1): Promise<TeacherLite[]> {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  qs.set("page", String(page));
  if (search.trim()) qs.set("search", search.trim());
  const data = await fetchJSON(`${API_PREFIX}/teachers?${qs.toString()}`);
  const arr = Array.isArray(data) ? data : data.users || [];
  return arr.map((u: any) => ({ _id: u._id || u.id, name: u.name, username: u.username, email: u.email }));
}

/** ===== UI ===== */
export default function AdminTeacherAvailabilityPage() {
  const [teachers, setTeachers] = useState<TeacherLite[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [teacherSearch, setTeacherSearch] = useState(""); // search box for teachers
  const [loadingTeachers, setLoadingTeachers] = useState(false);

  const [week, setWeek] = useState<DaySlots>(emptyWeek());
  const [effectiveFrom, setEffectiveFrom] = useState<string>("");
  const [effectiveTo, setEffectiveTo] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load teachers on mount and whenever search changes (debounced)
  useEffect(() => {
    let t: any;
    setLoadingTeachers(true);
    (async () => {
      try {
        clearTimeout(t);
        await new Promise((r) => (t = setTimeout(r, 250))); // debounce
        const list = await loadTeachers(teacherSearch, 200, 1);
        setTeachers(list);
      } catch {
        setTeachers([]);
      } finally {
        setLoadingTeachers(false);
      }
    })();
    return () => clearTimeout(t);
  }, [teacherSearch]);

  // Load availability on teacher change
  useEffect(() => {
    if (!teacherId) {
      setWeek(emptyWeek());
      setEffectiveFrom("");
      setEffectiveTo("");
      return;
    }
    setLoading(true);
    fetchJSON(`${API_PREFIX}/teacher-availability/${teacherId}`)
      .then((data) => {
        const ta = data?.availability;
        if (!ta) {
          setWeek(emptyWeek());
          setEffectiveFrom("");
          setEffectiveTo("");
          return;
        }
        const wk = emptyWeek();
        (ta.weeklyWindows || []).forEach((w: any) => {
          const d = Number(w.day);
          const start = minutesToHHMMSafe(w.startMinutes);
          const end = minutesToHHMMSafe(w.endMinutes);
          wk[d] = (wk[d] || []).concat([{ id: genId(), start, end }]);
        });
        setWeek(wk);
        setEffectiveFrom(ta.effectiveFrom ? dateOnly(ta.effectiveFrom) : "");
        setEffectiveTo(ta.effectiveTo ? dateOnly(ta.effectiveTo) : "");
      })
      .catch((err) => setMessage({ type: "error", text: `Load failed: ${err.message}` }))
      .finally(() => setLoading(false));
  }, [teacherId]);

  const daysSelectedCount = useMemo(
    () => Object.values(week).filter((slots) => (slots?.length || 0) > 0).length,
    [week]
  );

  const totalSlots = useMemo(
    () => Object.values(week).reduce((sum, slots) => sum + (slots?.length || 0), 0),
    [week]
  );

  function minutesToHHMMSafe(mins: number) {
    if (mins == null || Number.isNaN(mins)) return "06:00";
    const h = Math.floor(mins / 60).toString().padStart(2, "0");
    const m = (mins % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  }
  function dateOnly(val: string) {
    try {
      return new Date(val).toISOString().slice(0, 10);
    } catch {
      return "";
    }
  }

  function addSlot(day: number, start = "06:00", end = "10:00") {
    setWeek((w) => ({ ...w, [day]: [...(w[day] || []), { id: genId(), start, end }] }));
  }
  function removeSlot(day: number, id: string) {
    setWeek((w) => ({ ...w, [day]: (w[day] || []).filter((s) => s.id !== id) }));
  }
  function updateSlot(day: number, id: string, field: "start" | "end", value: string) {
    setWeek((w) => ({
      ...w,
      [day]: (w[day] || []).map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    }));
  }
  function setPresetMWF() {
    setWeek((w) => mergePreset(w, mwfPreset()));
  }
  function clearAll() {
    setWeek(emptyWeek());
  }

  async function onSave() {
    if (!teacherId) {
      setMessage({ type: "error", text: "Select a teacher first." });
      return;
    }

    const errs = validateWeek(week);
    if (errs.length) {
      setMessage({ type: "error", text: errs[0] });
      return;
    }

    // Enforce minimum 1 day selected
    const totalDaysWithSlots = Object.values(week).filter((slots) => (slots?.length || 0) > 0).length;
    if (totalDaysWithSlots < 1) {
      setMessage({ type: "error", text: "Teacher must be available at least 1 day in the week." });
      return;
    }

    const body: any = {
      weeklyWindows: toWeeklyWindows(week),
      ...(effectiveFrom ? { effectiveFrom } : {}),
      ...(effectiveTo ? { effectiveTo } : {}),
    };

    setSaving(true);
    try {
      const headers = buildHeaders({ "Content-Type": "application/json" }, authHeaders());
      const res = await fetch(`${API_PREFIX}/teacher-availability/${teacherId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");
      setMessage({ type: "success", text: "Availability saved successfully!" });
      setTimeout(() => setMessage(null), 4000);
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  const teacherOptions = useMemo(
    () =>
      teachers.map((t) => ({
        value: t._id,
        label: t.name || t.username || t.email || t._id,
        sub: t.email || t.username || "",
      })),
    [teachers]
  );

  const selectedTeacher = teachers.find(t => t._id === teacherId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4l6 6m0-6l-6 6" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent mb-2">
            Teacher Availability Manager
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Define weekly time windows when teachers are available for scheduling. Create flexible schedules with multiple slots per day.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50 hover:shadow-xl transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Days</p>
                <p className="text-3xl font-bold text-indigo-600">{daysSelectedCount}/7</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-r from-indigo-100 to-indigo-200 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4l6 6m0-6l-6 6" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50 hover:shadow-xl transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Slots</p>
                <p className="text-3xl font-bold text-emerald-600">{totalSlots}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-r from-emerald-100 to-emerald-200 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50 hover:shadow-xl transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Teachers</p>
                <p className="text-3xl font-bold text-purple-600">{teachers.length}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-r from-purple-100 to-purple-200 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 overflow-hidden">
          {/* Teacher Selection Header */}
          <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Teacher Search */}
              <div>
                <label className="block text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search Teachers
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={teacherSearch}
                    onChange={(e) => setTeacherSearch(e.target.value)}
                    placeholder="Search by name, email, username..."
                    className="w-full rounded-xl border-0 px-4 py-3 text-sm bg-white/95 backdrop-blur-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50 placeholder-gray-500 transition-all duration-200"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                <label className="block text-sm font-semibold text-white mt-4 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Select Teacher
                </label>
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-xl border-0 px-4 py-3 pr-12 text-sm bg-white/95 backdrop-blur-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50 transition-all duration-200"
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                    disabled={loadingTeachers || teacherOptions.length === 0}
                  >
                    <option value="">
                      {loadingTeachers ? "🔄 Loading teachers…" : teacherOptions.length ? "👤 Select a teacher" : "❌ No teachers found"}
                    </option>
                    {teacherOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} {opt.sub ? `• ${opt.sub}` : ""}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-col justify-end">
                {selectedTeacher && (
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 mb-4 border border-white/30">
                    <p className="text-white/90 text-sm font-medium">Selected Teacher:</p>
                    <p className="text-white text-lg font-semibold">{selectedTeacher.name || selectedTeacher.username || selectedTeacher.email}</p>
                    {selectedTeacher.email && <p className="text-white/80 text-sm">{selectedTeacher.email}</p>}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={setPresetMWF}
                    className="flex-1 bg-white/20 backdrop-blur-sm border border-white/30 text-white px-4 py-3 rounded-xl text-sm font-medium hover:bg-white/30 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    MWF Preset
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="flex-1 bg-white/20 backdrop-blur-sm border border-white/30 text-white px-4 py-3 rounded-xl text-sm font-medium hover:bg-white/30 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Effective Dates */}
          <div className="p-6 bg-gray-50/50 border-b border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4l6 6m0-6l-6 6" />
                  </svg>
                  Effective From (Optional)
                </label>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Effective To (Optional)
                </label>
                <input
                  type="date"
                  value={effectiveTo}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm transition-all duration-200"
                />
              </div>
            </div>
          </div>

          {/* Week Schedule */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3 text-indigo-600">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <span className="text-lg font-medium">Loading availability…</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4l6 6m0-6l-6 6" />
                  </svg>
                  Weekly Schedule
                </h3>
                {Array.from({ length: 7 }, (_, d) => (
                  <DayRow
                    key={d}
                    day={d}
                    slots={week[d] || []}
                    onAdd={() => addSlot(d)}
                    onRemove={(id) => removeSlot(d, id)}
                    onChange={(id, field, value) => updateSlot(d, id, field, value)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50/50 px-6 py-4 flex items-center justify-between border-t border-gray-100">
            <div className="flex-1">
              {message && (
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium animate-pulse ${
                  message.type === "success" 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                  {message.type === "success" ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {message.text}
                </div>
              )}
            </div>
            <button
              disabled={!teacherId || saving}
              onClick={onSave}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-8 py-3 rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[140px] justify-center"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Row component for a single day */
function DayRow({
  day,
  slots,
  onAdd,
  onRemove,
  onChange,
}: {
  day: number;
  slots: Slot[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onChange: (id: string, field: "start" | "end", value: string) => void;
}) {
  const hasSlots = slots.length > 0;
  const dayColors = [
    "from-red-400 to-red-500",      // Sunday - Red
    "from-blue-400 to-blue-500",    // Monday - Blue
    "from-green-400 to-green-500",  // Tuesday - Green
    "from-yellow-400 to-yellow-500", // Wednesday - Yellow
    "from-purple-400 to-purple-500", // Thursday - Purple
    "from-pink-400 to-pink-500",    // Friday - Pink
    "from-indigo-400 to-indigo-500" // Saturday - Indigo
  ];

  return (
    <div className={`relative rounded-2xl border transition-all duration-300 hover:shadow-lg ${
      hasSlots 
        ? "bg-gradient-to-br from-white to-indigo-50/50 border-indigo-200 shadow-md" 
        : "bg-white border-gray-200 hover:border-gray-300"
    }`}>
      {/* Day Header */}
      <div className={`p-4 rounded-t-2xl bg-gradient-to-r ${dayColors[day]} relative overflow-hidden`}>
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
                <span className="text-white font-bold text-sm">{dayAbbr[day]}</span>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">{dayNames[day]}</h3>
                <p className="text-white/80 text-sm">
                  {slots.length === 0 ? "No availability" : `${slots.length} slot${slots.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onAdd} 
            className="bg-white/20 backdrop-blur-sm hover:bg-white/30 border border-white/30 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 hover:scale-105"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Slot
          </button>
        </div>
      </div>

      {/* Slots Content */}
      <div className="p-4">
        {slots.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">No time slots configured</p>
            <p className="text-gray-400 text-sm mt-1">Click "Add Slot" to create availability windows</p>
          </div>
        ) : (
          <div className="space-y-3">
            {slots.map((s, index) => (
              <div key={s.id} className="group relative">
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 hover:border-indigo-300">
                  <div className="flex items-center gap-4">
                    {/* Slot Number */}
                    <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>

                    {/* Time Inputs */}
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
                        <input
                          type="time"
                          step={60}
                          value={s.start}
                          onChange={(e) => onChange(s.id, "start", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
                        <input
                          type="time"
                          step={60}
                          value={s.end}
                          onChange={(e) => onChange(s.id, "end", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                        />
                      </div>
                    </div>

                    {/* Duration Display */}
                    <div className="text-center min-w-[80px]">
                      <p className="text-xs font-medium text-gray-600">Duration</p>
                      <p className="text-sm font-bold text-indigo-600">
                        {(() => {
                          const startMins = toMinutes(s.start);
                          const endMins = toMinutes(s.end);
                          const duration = Math.max(0, endMins - startMins);
                          const hours = Math.floor(duration / 60);
                          const mins = duration % 60;
                          if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
                          if (hours > 0) return `${hours}h`;
                          return `${mins}m`;
                        })()}
                      </p>
                    </div>

                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => onRemove(s.id)}
                      className="w-10 h-10 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-105 group-hover:bg-red-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}