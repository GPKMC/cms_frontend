"use client";

import { useEffect, useMemo, useState } from "react";

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

// Accept either shape from API
type WeeklyWindow = {
  day: number;
  start?: string;        // "HH:MM" or "HH:MM:SS"
  end?: string;          // "HH:MM" or "HH:MM:SS"
  startMinutes?: number; // minutes since midnight
  endMinutes?: number;
  _id?: string;
};

type AvailabilityDoc = {
  _id?: string;
  teacher: string;
  weeklyWindows: WeeklyWindow[];
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};

/* ========= UTIL ========= */
const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const minutesToHHMM = (mins?: number | null): string => {
  if (mins == null || !Number.isFinite(mins)) return "";
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
};

const ensureHHMM = (s?: string): string => {
  if (!s) return "";
  const m = s.match(/^(\d{1,2}):(\d{1,2})/);
  if (!m) return "";
  const h = String(Number(m[1])).padStart(2, "0");
  const mm = String(Number(m[2])).padStart(2, "0");
  return `${h}:${mm}`;
};

const getStart = (w: WeeklyWindow) =>
  w.start != null ? ensureHHMM(w.start) : minutesToHHMM(w.startMinutes);
const getEnd = (w: WeeklyWindow) =>
  w.end != null ? ensureHHMM(w.end) : minutesToHHMM(w.endMinutes);

const toMin = (hhmm?: string): number => {
  if (!hhmm) return NaN;
  const m = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return NaN;
  const h = Number(m[1]), mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return NaN;
  return h * 60 + mm;
};

// "HH:MM" -> "h:MM AM/PM"
const hhmmToAmPm = (hhmm?: string): string => {
  if (!hhmm) return "";
  const m = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return hhmm;
  let h = Number(m[1]);
  const min = m[2].padStart(2, "0");
  h = h % 24;
  const isAM = h < 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${isAM ? "AM" : "PM"}`;
};

export default function AvailabilityViewModal({
  teacherId,
  onClose,
}: {
  teacherId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [user, setUser] = useState<TeacherLite | null>(null);
  const [availability, setAvailability] = useState<AvailabilityDoc | null>(null);

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
        setAvailability(a.availability || null);
      } catch (e: any) {
        setErr(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [teacherId]);

  // Normalize, sort, and group by day
  const byDay = useMemo(() => {
    const map: Record<number, { start: string; end: string }[]> =
      {0:[],1:[],2:[],3:[],4:[],5:[],6:[]};

    (availability?.weeklyWindows || []).forEach(w => {
      const d = Number(w.day);
      if (d < 0 || d > 6) return;
      const s = getStart(w);
      const e = getEnd(w);
      const sm = toMin(s), em = toMin(e);
      if (Number.isFinite(sm) && Number.isFinite(em) && em > sm) {
        map[d].push({ start: s, end: e });
      }
    });

    Object.values(map).forEach(arr =>
      arr.sort((a,b) => toMin(a.start) - toMin(b.start))
    );
    return map;
  }, [availability]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Teacher Availability Schedule
              </h2>
              <p className="text-indigo-100 text-sm mt-1">View weekly availability windows</p>
            </div>
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
                  <p className="text-gray-600 font-medium">Loading availability data...</p>
                </div>
              </div>
            ) : err ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-800 font-medium">{err}</p>
              </div>
            ) : (
              <>
                {/* Teacher Info Card */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                      {(user?.name || user?.username || "T").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {user?.name || user?.username || "Teacher"}
                      </h3>
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                        </svg>
                        <span>{user?.email || "No email provided"}</span>
                      </div>
                      {(availability?.effectiveFrom || availability?.effectiveTo) && (
                        <div className="inline-flex items-center gap-2 text-sm text-indigo-700 bg-indigo-100 px-3 py-1 rounded-full">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>
                            Effective: {availability?.effectiveFrom ? new Date(availability.effectiveFrom).toLocaleDateString() : "—"} 
                            {" "}to{" "} 
                            {availability?.effectiveTo ? new Date(availability.effectiveTo).toLocaleDateString() : "Ongoing"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-green-800 font-medium text-sm">Active Days</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                      {Object.values(byDay).filter(arr => arr.length > 0).length}/7
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-blue-800 font-medium text-sm">Total Slots</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">
                      {Object.values(byDay).reduce((sum, arr) => sum + arr.length, 0)}
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="text-purple-800 font-medium text-sm">Peak Day</span>
                    </div>
                    <p className="text-lg font-bold text-purple-600">
                      {(() => {
                        const maxSlots = Math.max(...Object.values(byDay).map(arr => arr.length));
                        const peakDay = Object.entries(byDay).find(([_, arr]) => arr.length === maxSlots);
                        return peakDay && maxSlots > 0 ? dayNames[parseInt(peakDay[0])] : "None";
                      })()}
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span className="text-orange-800 font-medium text-sm">Avg/Day</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-600">
                      {(() => {
                        const totalSlots = Object.values(byDay).reduce((sum, arr) => sum + arr.length, 0);
                        const activeDays = Object.values(byDay).filter(arr => arr.length > 0).length;
                        return activeDays > 0 ? (totalSlots / activeDays).toFixed(1) : "0";
                      })()}
                    </p>
                  </div>
                </div>

                {/* Weekly Schedule */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Weekly Schedule
                  </h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {dayNames.map((d, idx) => {
                      const arr = byDay[idx];
                      const hasSlots = arr && arr.length > 0;
                      return (
                        <div key={idx} className={`rounded-xl border-2 overflow-hidden transition-all duration-200 ${
                          hasSlots 
                            ? 'border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-sm' 
                            : 'border-gray-200 bg-gray-50'
                        }`}>
                          <div className={`px-4 py-3 ${
                            hasSlots 
                              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' 
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${hasSlots ? 'bg-white' : 'bg-gray-400'}`}></div>
                                <span className="font-semibold">{d}</span>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                hasSlots 
                                  ? 'bg-white/20 text-white' 
                                  : 'bg-gray-200 text-gray-600'
                              }`}>
                                {arr?.length || 0} slot{(arr?.length || 0) !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          
                          <div className="p-4 min-h-[80px]">
                            {!hasSlots ? (
                              <div className="text-center py-4">
                                <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                </svg>
                                <p className="text-sm text-gray-500">No availability</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {arr.map((w, i) => (
                                  <div key={i} className="bg-white rounded-lg border border-indigo-200 p-3 shadow-sm hover:shadow-md transition-shadow duration-200">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                                          {i + 1}
                                        </div>
                                        <div>
                                          <div className="font-medium text-gray-900 text-sm">
                                            Slot {i + 1}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            {(() => {
                                              const startMin = toMin(w.start);
                                              const endMin = toMin(w.end);
                                              if (Number.isFinite(startMin) && Number.isFinite(endMin)) {
                                                const duration = endMin - startMin;
                                                const hours = Math.floor(duration / 60);
                                                const mins = duration % 60;
                                                return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                                              }
                                              return "Duration unknown";
                                            })()}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="font-semibold text-indigo-700 text-sm">
                                          {hhmmToAmPm(w.start)}
                                        </div>
                                        <div className="text-xs text-gray-500">to</div>
                                        <div className="font-semibold text-purple-700 text-sm">
                                          {hhmmToAmPm(w.end)}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
