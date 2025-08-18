"use client";

import React, { useEffect, useMemo, useState } from "react";

/* ========= CONFIG ========= */
const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");
const API_PREFIX = `${BACKEND}/schedule`;

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token_admin") : "";
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/* ========= TYPES ========= */
type TeacherLite = { _id: string; name?: string; email?: string; username?: string };
type WeeklyWindow = { day: number; start: string; end: string; _id?: string };

const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

/* ========= UTIL (DEFENSIVE) ========= */
const minutesToHHMM = (mins?: number | null): string => {
  if (mins == null || !Number.isFinite(mins)) return "";
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
};

const normalizeTime = (v: unknown): string => {
  if (typeof v === "number" && Number.isFinite(v)) return minutesToHHMM(v);
  if (typeof v === "string") {
    if (v.includes(":")) return v.slice(0, 5);
    const n = Number(v);
    if (Number.isFinite(n)) return minutesToHHMM(n);
  }
  return "";
};

const toMin = (t?: string | null): number => {
  if (!t) return NaN;
  const hhmm = t.length >= 5 ? t.slice(0, 5) : t;
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return NaN;
  const [h, m] = hhmm.split(":").map((n) => parseInt(n || "0", 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
  return h * 60 + m;
};

const safeOverlap = (a: WeeklyWindow, b: WeeklyWindow) => {
  if (a.day !== b.day) return false;
  const as = toMin(a.start), ae = toMin(a.end);
  const bs = toMin(b.start), be = toMin(b.end);
  if (![as, ae, bs, be].every(Number.isFinite)) return false;
  return as < be && bs < ae;
};

/* ========= COMPONENT ========= */
export default function AvailabilityEditModal({
  teacherId,
  onClose,
  onSaved,
}: {
  teacherId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [user, setUser] = useState<TeacherLite | null>(null);
  const [weekly, setWeekly] = useState<WeeklyWindow[]>([]);

  // load teacher + availability
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const [uRes, aRes] = await Promise.all([
          fetch(`${API_PREFIX}/teachers/${teacherId}`, {
            credentials: "include",
            headers: { ...authHeaders() },
          }),
          fetch(`${API_PREFIX}/teacher-availability/${teacherId}`, {
            credentials: "include",
            headers: { ...authHeaders() },
          }),
        ]);
        if (uRes.ok) {
          const u = await uRes.json();
          setUser(u.user || null);
        }
        if (!aRes.ok) throw new Error(await aRes.text());
        const a = await aRes.json();

        const raw = Array.isArray(a?.availability?.weeklyWindows)
          ? a.availability.weeklyWindows
          : [];

        const ww: WeeklyWindow[] = raw.map((w: any) => ({
          day: Number(w?.day ?? 0),
          start: normalizeTime(w?.start ?? w?.startMinutes),
          end: normalizeTime(w?.end ?? w?.endMinutes),
          _id: w?._id,
        }));

        setWeekly(ww);
      } catch (e: any) {
        setErr(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [teacherId]);

  // conflicts + invalids
  const conflictIdx = useMemo(() => {
    const bad = new Set<number>();
    weekly.forEach((a, i) => {
      const aS = toMin(a.start);
      const aE = toMin(a.end);
      if (!Number.isFinite(aS) || !Number.isFinite(aE) || aE <= aS) {
        bad.add(i);
        return;
      }
      weekly.forEach((b, j) => {
        if (i !== j && safeOverlap(a, b)) bad.add(i);
      });
    });
    return bad;
  }, [weekly]);

  function addSlot(day: number) {
    setWeekly((w) => [...w, { day, start: "09:00", end: "10:00" }]);
  }
  function clearDay(day: number) {
    setWeekly((w) => w.filter((x) => x.day !== day));
  }
  function clearAll() {
    if (confirm("Clear all availability for this teacher?")) {
      setWeekly([]);
    }
  }

  function updateAt(idx: number, patch: Partial<WeeklyWindow>) {
    setWeekly((w) => w.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }
  function removeAt(idx: number) {
    setWeekly((w) => w.filter((_, i) => i !== idx));
  }

  async function save() {
    try {
      setSaving(true);
      setErr("");

      if (conflictIdx.size) throw new Error("Please resolve overlapping/invalid times.");
      if (weekly.some((s) => !Number.isFinite(toMin(s.start)) || !Number.isFinite(toMin(s.end)))) {
        throw new Error("Please fill valid HH:MM for all slots.");
      }

      // Convert HH:MM format to minutes for the API
      const weeklyWindowsForAPI = weekly.map((slot) => ({
        day: slot.day,
        startMinutes: toMin(slot.start),
        endMinutes: toMin(slot.end),
        ...(slot._id && { _id: slot._id }) // Include _id if it exists for existing slots
      }));

      const res = await fetch(`${API_PREFIX}/teacher-availability/${teacherId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ weeklyWindows: weeklyWindowsForAPI }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSaved();
    } catch (e: any) {
      setErr(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // grouped render with tolerant sorter
  const grouped = useMemo(() => {
    const map: Record<number, { idx: number; row: WeeklyWindow }[]> =
      {0:[],1:[],2:[],3:[],4:[],5:[],6:[]};
    weekly.forEach((row, idx) => map[row.day].push({ idx, row }));
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => {
        const as = toMin(a.row.start);
        const bs = toMin(b.row.start);
        if (!Number.isFinite(as) && !Number.isFinite(bs)) return 0;
        if (!Number.isFinite(as)) return 1;
        if (!Number.isFinite(bs)) return -1;
        return as - bs;
      })
    );
    return map;
  }, [weekly]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Edit Availability Schedule
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                {user ? (user.name || user.username || user.email || "Teacher") : "Loading..."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={clearAll} 
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-200 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear All
              </button>
              <button 
                onClick={onClose} 
                className="flex items-center justify-center w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg transition-colors duration-200"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                  <p className="text-gray-600 font-medium">Loading availability data...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Error Messages */}
                {err && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-800 font-medium">{err}</p>
                  </div>
                )}

                {/* Conflict Warning */}
                {conflictIdx.size > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                    <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <p className="text-amber-800 font-medium">Time Conflicts Detected</p>
                      <p className="text-amber-700 text-sm">Some time slots overlap or have invalid ranges. Please fix the highlighted slots before saving.</p>
                    </div>
                  </div>
                )}

                {/* Stats Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-blue-800 font-medium text-sm">Total Slots</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{weekly.length}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-green-800 font-medium text-sm">Valid Slots</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600 mt-1">{weekly.length - conflictIdx.size}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-red-800 font-medium text-sm">Conflicts</span>
                    </div>
                    <p className="text-2xl font-bold text-red-600 mt-1">{conflictIdx.size}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-purple-800 font-medium text-sm">Active Days</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-600 mt-1">{Object.values(grouped).filter(arr => arr.length > 0).length}</p>
                  </div>
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {dayNames.map((d, day) => {
                    const arr = grouped[day];
                    const hasSlots = arr.length > 0;
                    return (
                      <div key={day} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                        <div className={`px-4 py-3 ${hasSlots ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'} transition-colors duration-200`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${hasSlots ? 'bg-white' : 'bg-gray-400'}`}></div>
                              <span className="font-semibold">{d}</span>
                              <span className={`text-xs px-2 py-1 rounded-full ${hasSlots ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                {arr.length} slot{arr.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => addSlot(day)}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 ${
                                  hasSlots ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add Slot
                              </button>
                              {arr.length > 0 && (
                                <button
                                  onClick={() => clearDay(day)}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-colors duration-200"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Clear
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="p-4 space-y-3">
                          {arr.length === 0 ? (
                            <div className="text-center py-8">
                              <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-sm text-gray-500">No time slots scheduled</p>
                              <p className="text-xs text-gray-400 mt-1">Click "Add Slot" to create one</p>
                            </div>
                          ) : (
                            arr.map(({ idx, row }, i) => {
                              const invalid = conflictIdx.has(idx);
                              return (
                                <div
                                  key={idx}
                                  className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                                    invalid 
                                      ? "border-red-300 bg-red-50 shadow-sm" 
                                      : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
                                  }`}
                                >
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                      invalid ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                                    }`}>
                                      {i + 1}
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">Time Slot {i + 1}</span>
                                    {invalid && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Conflict
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
                                      <div className="relative">
                                        <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <input
                                          type="time"
                                          step={900}
                                          value={row.start || ""}
                                          onChange={(e) => updateAt(idx, { start: e.target.value })}
                                          className={`w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 ${
                                            invalid ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                          }`}
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">End Time</label>
                                      <div className="relative">
                                        <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <input
                                          type="time"
                                          step={900}
                                          value={row.end || ""}
                                          onChange={(e) => updateAt(idx, { end: e.target.value })}
                                          className={`w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 ${
                                            invalid ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                          }`}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <label className="text-xs font-medium text-gray-700">Move to:</label>
                                      <select
                                        value={row.day}
                                        onChange={(e) => updateAt(idx, { day: parseInt(e.target.value, 10) })}
                                        className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                      >
                                        {dayNames.map((name, di) => (
                                          <option key={di} value={di}>{name}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <button
                                      onClick={() => removeAt(idx)}
                                      className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-colors duration-200"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                      Remove
                                    </button>
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
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>Valid slots: {weekly.length - conflictIdx.size}</span>
              </div>
              {conflictIdx.size > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span>Conflicts: {conflictIdx.size}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={onClose} 
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || conflictIdx.size > 0}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Saving Changes...
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
    </div>
  );
}
