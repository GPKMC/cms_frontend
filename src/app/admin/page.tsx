"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  GraduationCap,
  UserCog,
  ShieldCheck,
  Layers,
  LayoutGrid,
  BookOpen,
  RefreshCw,
  Activity,
  X as CloseIcon,
  CalendarDays,
  Clock4,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

// ----------------- Types -----------------
interface SummaryResp {
  ok: boolean;
  totals: {
    users: number;
    students: number;
    teachers: number;
    admins: number;
    superadmins: number;
    activeUsers: number;
    inactiveUsers: number;
    verifiedUsers: number;
    unverifiedUsers: number;
  };
  entities: {
    faculties: number;
    batches: number;
    courses: number;
    semesterOrYears: number;
  };
  generatedAt: string;
}

interface GroupItem {
  _id: string;
  name?: string;
  code?: string;
  slug?: string;
  count: number;
  // batch extras (drilldown)
  batchname?: string;
  startYear?: number;
  currentSemesterOrYear?: number;
  isCompleted?: boolean;
}

interface AttendanceOverview {
  ok: boolean;
  range: { from: string; to: string };
  scope: { facultyId?: string; batchId?: string };
  counts: { present: number; absent: number; late: number; total: number };
  daily: { date: string; present: number; absent: number; late: number; total: number }[];
}

interface LeaveRow {
  _id: string;
  user: { _id: string; username: string; email: string; role: string } | null;
  role: "teacher" | "student";
  leaveDate: string; // YYYY-MM-DD
  dayPart: "full" | "first_half" | "second_half";
  type: "sick" | "emergency" | "function" | "puja" | "personal" | "other";
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  createdAt: string;
}

// -------------- API helpers --------------
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "";

async function apiGet<T>(path: string): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token_admin") : null;
  const url = `${API_BASE}/admin-api${path}`;
  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// -------------- UI bits --------------
function StatCard({
  title, value, icon: Icon, sub,
}: { title: string; value: number | string; icon: any; sub?: string }) {
  return (
    <div className="group relative rounded-2xl shadow-lg border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 hover:shadow-xl hover:border-blue-200 transition-all duration-300 transform hover:scale-105">
      <div className="absolute top-4 right-4 opacity-20 group-hover:opacity-30 transition-opacity">
        <Icon className="h-8 w-8 text-gray-400" />
      </div>
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-600 mb-1">{title}</div>
          <div className="text-3xl font-bold tracking-tight text-gray-900 mb-1">{value}</div>
          {sub && <div className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded-full inline-block">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl shadow-lg border border-gray-200 bg-white hover:shadow-xl transition-all duration-300 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50">
        <h3 className="font-bold text-lg text-gray-900">{title}</h3>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// -------------- Data hook --------------
function useAdminData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<SummaryResp | null>(null);
  const [byFaculty, setByFaculty] = useState<GroupItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceOverview | null>(null);
  const [recentLeaves, setRecentLeaves] = useState<LeaveRow[]>([]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [sum, fac, att, leaves] = await Promise.all([
        apiGet<SummaryResp>("/summary"),
        apiGet<{ ok: boolean; items: GroupItem[] }>("/students-by-faculty"),
        apiGet<AttendanceOverview>("/attendance/overview?days=14"),
        apiGet<{ ok: boolean; items: LeaveRow[] }>("/leaves/recent?limit=5&status=pending"),
      ]);
      setSummary(sum);
      setByFaculty(fac.items || []);
      setAttendance(att);
      setRecentLeaves(leaves.items || []);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  return { loading, error, reload: loadAll, summary, byFaculty, attendance, recentLeaves };
}

// -------------- Page --------------
export default function AdminDashboardPage() {
  const { loading, error, reload, summary, byFaculty, attendance, recentLeaves } = useAdminData();

  const totalCards = useMemo(() => ([
    { title: "Total Users", value: summary?.totals.users ?? 0, icon: Users },
    { title: "Students", value: summary?.totals.students ?? 0, icon: GraduationCap },
    { title: "Teachers", value: summary?.totals.teachers ?? 0, icon: UserCog },
    { title: "Admins", value: (summary?.totals.admins ?? 0) + (summary?.totals.superadmins ?? 0), icon: ShieldCheck },
  ]), [summary]);

  const entityCards = useMemo(() => ([
    { title: "Faculties", value: summary?.entities.faculties ?? 0, icon: Layers },
    { title: "Batches", value: summary?.entities.batches ?? 0, icon: LayoutGrid },
    { title: "Courses", value: summary?.entities.courses ?? 0, icon: BookOpen },
    { title: "Active Users", value: summary?.totals.activeUsers ?? 0, icon: Activity, sub: `${summary ? Math.round((summary.totals.activeUsers / Math.max(1, summary.totals.users)) * 100) : 0}% active` },
  ]), [summary]);

  // ---------- Drilldown state ----------
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedFaculty, setSelectedFaculty] = useState<{ id: string; name: string } | null>(null);
  const [batches, setBatches] = useState<GroupItem[]>([]);

  async function openFacultyDetails(fac: GroupItem) {
    setSelectedFaculty({ id: fac._id, name: fac.code || fac.name || "Faculty" });
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const resp = await apiGet<{ ok: boolean; items: GroupItem[] }>(`/students-by-batch?facultyId=${fac._id}`);
      setBatches(resp.items || []);
    } catch (e: any) {
      setDetailError(e.message || "Failed to load details");
    } finally {
      setDetailLoading(false);
    }
  }

  const facultyBars = useMemo(
    () =>
      (byFaculty || []).map((f) => ({
        _id: f._id,
        name: f.code || f.name || "N/A",
        count: f.count,
      })),
    [byFaculty]
  );

  const attendanceDaily = useMemo(
    () => (attendance?.daily || []).map(d => ({
      date: d.date,
      Present: d.present,
      Absent: d.absent,
      Late: d.late,
    })),
    [attendance]
  );

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-8 bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">📊 Admin Dashboard</h1>
            <p className="text-gray-600">Complete overview of your educational management system</p>
          </div>
          <button
            onClick={reload}
            className="inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <RefreshCw className="h-5 w-5" />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border-2 border-red-200 bg-gradient-to-r from-red-50 to-red-100 p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
              <span className="text-white font-bold">!</span>
            </div>
            <div className="text-red-800 font-medium">{error}</div>
          </div>
        </div>
      )}

      {/* Top stats */}
      <div className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {totalCards.map((c, i) => (
            <StatCard key={i} title={c.title} value={c.value} icon={c.icon} />
          ))}
        </div>
      </div>

      {/* Entities */}
      <div className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {entityCards.map((c, i) => (
            <StatCard key={i} title={c.title} value={c.value} icon={c.icon} sub={(c as any).sub} />
          ))}
        </div>
      </div>

      {/* Students by Faculty (bar + drilldown) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        <Card title="📊 Students by Faculty">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={facultyBars} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-25} textAnchor="end" height={55} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="count"
                  name="Students"
                  fill="#2563eb"
                  radius={[6, 6, 0, 0]}
                  onClick={(entry: any) => openFacultyDetails(entry?.payload)}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs text-gray-500 mt-2">Tip: click a bar to view batches inside that faculty.</div>
        </Card>

        {/* Attendance Overview */}
        <Card
          title="🗓️ Attendance Overview (Last 14 days)"
          action={
            attendance && (
              <div className="text-xs text-gray-600 flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                <span>
                  {new Date(attendance.range.from).toISOString().slice(0, 10)} →{" "}
                  {new Date(attendance.range.to).toISOString().slice(0, 10)}
                </span>
              </div>
            )
          }
        >
          {/* Totals row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl border p-3 bg-green-50 border-green-200">
              <div className="text-xs text-green-700 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Present</div>
              <div className="text-2xl font-bold text-green-800">{attendance?.counts.present ?? 0}</div>
            </div>
            <div className="rounded-xl border p-3 bg-amber-50 border-amber-200">
              <div className="text-xs text-amber-700 flex items-center gap-1"><Clock4 className="h-4 w-4" /> Late</div>
              <div className="text-2xl font-bold text-amber-800">{attendance?.counts.late ?? 0}</div>
            </div>
            <div className="rounded-xl border p-3 bg-rose-50 border-rose-200">
              <div className="text-xs text-rose-700 flex items-center gap-1"><XCircle className="h-4 w-4" /> Absent</div>
              <div className="text-2xl font-bold text-rose-800">{attendance?.counts.absent ?? 0}</div>
            </div>
          </div>

          {/* Daily stacked bars */}
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceDaily} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Present" stackId="a" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Late" stackId="a" fill="#f59e0b" />
                <Bar dataKey="Absent" stackId="a" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent Leaves */}
      <div className="grid grid-cols-1 mb-10">
        <Card
          title="📝 Pending Leave Requests"
          action={
            <Link
              href="/admin/leave"
              className="text-sm px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
            >
              Show all
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2">User</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Date</th>
                  <th className="py-2">Part</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Reason</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(recentLeaves || []).map((lr) => (
                  <tr key={lr._id} className="border-b last:border-0">
                    <td className="py-2">
                      {lr.user ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                            {lr.user.username?.[0]?.toUpperCase() || "U"}
                          </div>
                          <div>
                            <div className="font-medium">{lr.user.username}</div>
                            <div className="text-xs text-gray-500">{lr.user.email}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="py-2 capitalize">{lr.role}</td>
                    <td className="py-2">{lr.leaveDate}</td>
                    <td className="py-2">{lr.dayPart.replace("_", " ")}</td>
                    <td className="py-2 capitalize">{lr.type}</td>
                    <td className="py-2 text-gray-600">{lr.reason || "—"}</td>
                    <td className="py-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        {lr.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!recentLeaves || recentLeaves.length === 0) && (
                  <tr><td colSpan={7} className="py-4 text-center text-gray-500">No pending requests.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Drilldown Modal */}
      {detailOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-2 md:p-6">
          <div className="w-full md:max-w-3xl rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
              <div className="font-semibold text-gray-800">
                {selectedFaculty ? `Batches in ${selectedFaculty.name}` : "Details"}
              </div>
              <button
                onClick={() => { setDetailOpen(false); setBatches([]); setSelectedFaculty(null); }}
                className="p-2 rounded-lg hover:bg-gray-100"
                aria-label="Close"
                title="Close"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              {detailLoading && <div className="text-sm text-gray-600">Loading…</div>}
              {detailError && <div className="text-sm text-red-600">{detailError}</div>}

              {!detailLoading && !detailError && (
                <>
                  {/* Mini chart */}
                  <div className="h-64 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={(batches || []).map(b => ({
                          name: b.batchname || String(b.startYear) || "Batch",
                          count: b.count,
                        }))}
                        margin={{ top: 10, right: 20, left: 0, bottom: 40 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" name="Students" fill="#16a34a" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-600 border-b">
                          <th className="py-2">Batch</th>
                          <th className="py-2">Start Year</th>
                          <th className="py-2">Current Sem/Year</th>
                          <th className="py-2">Completed</th>
                          <th className="py-2">Students</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(batches || []).map((b) => (
                          <tr key={b._id} className="border-b last:border-0">
                            <td className="py-2 font-medium">{b.batchname || "—"}</td>
                            <td className="py-2 text-gray-600">{b.startYear ?? "—"}</td>
                            <td className="py-2 text-gray-600">{b.currentSemesterOrYear ?? "—"}</td>
                            <td className="py-2">
                              <span className={`text-xs rounded-full px-2 py-0.5 border ${
                                b.isCompleted ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}>
                                {b.isCompleted ? "Yes" : "No"}
                              </span>
                            </td>
                            <td className="py-2">{b.count}</td>
                          </tr>
                        ))}
                        {(!batches || batches.length === 0) && (
                          <tr><td colSpan={5} className="py-4 text-center text-gray-500">No batches found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-100 p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500/20 border-t-blue-500 mx-auto mb-3"></div>
            <p className="text-sm text-gray-600 font-medium">Loading dashboard data...</p>
          </div>
        </div>
      )}
    </div>
  );
}
