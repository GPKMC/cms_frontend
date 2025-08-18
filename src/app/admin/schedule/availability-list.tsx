"use client";

import { useEffect, useMemo, useState } from "react";
import AvailabilityEditModal from "./availabilityEditorModal";
import AvailabilityViewModal from "./availabilityViewmodal";
import { useRouter } from "next/navigation";

/* ========= CONFIG ========= */
const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");
const API_PREFIX = `${BACKEND}/schedule`;

// always return plain headers
function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token_admin") : "";
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/* ========= TYPES ========= */
type WeeklyWindow = {
  day: number;
  start?: string;       // "HH:MM" or "HH:MM:SS"
  end?: string;         // "HH:MM" or "HH:MM:SS"
  startMinutes?: number;
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
type ListRow = {
  _id: string;
  name?: string;
  email?: string;
  username?: string;
  availability: AvailabilityDoc | null;
};

/* ========= HELPERS ========= */
const dayAbbr = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

const hhmmToAmPm = (hhmm?: string): string => {
  if (!hhmm) return "";
  const m = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return "";
  let h = Number(m[1]);
  const min = m[2].padStart(2, "0");
  h = h % 24;
  const isAM = h < 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${isAM ? "AM" : "PM"}`;
};

const getStart = (w: WeeklyWindow) =>
  w.start != null ? ensureHHMM(w.start) : minutesToHHMM(w.startMinutes);
const getEnd = (w: WeeklyWindow) =>
  w.end != null ? ensureHHMM(w.end) : minutesToHHMM(w.endMinutes);

const toMin = (hhmm?: string) => {
  if (!hhmm) return NaN;
  const m = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return NaN;
  const h = Number(m[1]), mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return NaN;
  return h * 60 + mm;
};

function fmtSummary(av?: { weeklyWindows?: WeeklyWindow[] } | null) {
  const ww = av?.weeklyWindows;
  if (!Array.isArray(ww) || ww.length === 0) return "—";

  const byDay: Record<number, { s: string; e: string }[]> =
    { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

  ww.forEach(w => {
    const d = Number(w?.day);
    if (d < 0 || d > 6) return;
    const s = getStart(w);
    const e = getEnd(w);
    const sm = toMin(s), em = toMin(e);
    if (Number.isFinite(sm) && Number.isFinite(em) && em > sm) {
      byDay[d].push({ s, e });
    }
  });

  const parts: string[] = [];
  Object.entries(byDay).forEach(([d, arr]) => {
    if (!arr.length) return;
    const s = arr
      .slice()
      .sort((a, b) => toMin(a.s) - toMin(b.s))
      .map(w => `${hhmmToAmPm(w.s)}–${hhmmToAmPm(w.e)}`)
      .join(", ");
    if (s) parts.push(`${dayAbbr[Number(d)]}: ${s}`);
  });

  return parts.length ? parts.join("  •  ") : "—";
}

function hasValidAvailability(av?: AvailabilityDoc | null) {
  const ww = av?.weeklyWindows || [];
  return ww.some(w => {
    const s = getStart(w);
    const e = getEnd(w);
    const sm = toMin(s), em = toMin(e);
    return Number.isFinite(sm) && Number.isFinite(em) && em > sm;
  });
}

/* ========= LIST COMPONENT ========= */
export default function AvailabilityAdminList() {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);
  const router = useRouter();
const navigate = (path: string) => {
  router.push(path);
};

  async function fetchList() {
    setLoading(true);
    setMsg("");
    try {
      const qs = new URLSearchParams({ search, page: String(page), limit: String(limit) }).toString();
      const res = await fetch(`${API_PREFIX}/teacher-availability?${qs}`, {
        credentials: "include",
        headers: { ...authHeaders() },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setMsg(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchList(); /* eslint-disable-next-line */ }, [page]);
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      fetchList();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [search]);

  async function handleDelete(teacherId: string, teacherLabel: string) {
    const ok = window.confirm(`Delete availability for "${teacherLabel}"?\nThis only clears their availability (not the user).`);
    if (!ok) return;

    setMsg("");
    try {
      const del = await fetch(`${API_PREFIX}/teacher-availability/${teacherId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { ...authHeaders() },
      });

      if (del.status === 405 || del.status === 404) {
        const put = await fetch(`${API_PREFIX}/teacher-availability/${teacherId}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ weeklyWindows: [] }),
        });
        if (!put.ok) {
          const txt = await put.text();
          throw new Error(txt || "Failed to clear availability");
        }
      } else if (!del.ok) {
        const txt = await del.text();
        throw new Error(txt || "Failed to delete availability");
      }

      setMsg("✅ Availability deleted.");
      fetchList();
    } catch (e: any) {
      setMsg(`❌ ${e.message || "Delete failed"}`);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8 flex justify-between">
          <div className="">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Teacher Availability Management</h1>
            <p className="text-gray-600">Manage and view teacher availability schedules</p>
          </div>
        <button
  type="button"
  onClick={() => navigate("/admin/schedule/time")}
  className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:from-indigo-500 hover:to-purple-500 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:scale-[.98]"
>
  <svg className="h-4 w-4 transition-transform group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
  </svg>
  Add Teacher
</button>

        </div>


        {/* Search and Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search teacher name, email, or username..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                />
              </div>
            </div>
            <button
              onClick={fetchList}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Message Display */}
        {msg && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${msg.includes('✅')
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
            <div className={`w-2 h-2 rounded-full ${msg.includes('✅') ? 'bg-green-500' : 'bg-red-500'}`}></div>
            {msg}
          </div>
        )}

        {/* Teachers Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                <p className="text-gray-500 text-sm">Loading teachers...</p>
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                <h3 className="text-gray-900 font-medium text-lg mb-2">No teachers found</h3>
                <p className="text-gray-500 text-sm">Try adjusting your search criteria</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {rows.map((r, index) => {
                const label = r.name || r.username || r.email || "Teacher";
                const availabilitySummary = fmtSummary(r.availability);
                const hasAvailability = hasValidAvailability(r.availability);

                return (
                  <div key={r._id} className={`p-6 hover:bg-gray-50 transition-colors duration-200 ${index === 0 ? '' : ''}`}>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Teacher Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                              {label.charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 truncate">{label}</h3>
                            <p className="text-sm text-gray-500">{r.email || "No email provided"}</p>
                          </div>
                        </div>

                        {/* Availability Summary */}
                        <div className="ml-3">
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm font-medium text-gray-700">Availability</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${hasAvailability ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                              {hasAvailability ? 'Set' : 'Not Set'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 break-words">
                            {availabilitySummary}
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-3 lg:flex-shrink-0">
                        <button
                          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                          onClick={() => setViewingId(r._id)}
                          title="View availability details"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View
                        </button>
                        <button
                          className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                          onClick={() => setEditingId(r._id)}
                          title="Edit availability"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          className="inline-flex items-center px-3 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200"
                          onClick={() => handleDelete(r._id, label)}
                          title="Delete availability"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to{" "}
                  <span className="font-medium">{Math.min(page * limit, total)}</span> of{" "}
                  <span className="font-medium">{total}</span> results
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                  First
                </button>

                <button
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${pageNum === page ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                          }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                >
                  Last
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* view modal */}
      {viewingId && (
        <AvailabilityViewModal
          teacherId={viewingId}
          onClose={() => setViewingId(null)}
        />
      )}

      {/* edit drawer */}
      {editingId && (
        <AvailabilityEditModal
          teacherId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            fetchList();
          }}
        />
      )}
    </div>
  );
}
