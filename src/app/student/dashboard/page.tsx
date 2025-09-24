
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
} from "lucide-react";

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

/* ────────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────────── */
export default function StudentDashboard() {
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeTpl[]>([]);
  const [dayParts, setDayParts] = useState<string[]>([]);

  const [myLeaves, setMyLeaves] = useState<LeaveItem[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(true);
  const [submittingLeave, setSubmittingLeave] = useState(false);

  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const [form, setForm] = useState({
    leaveDate: ymdNepal(),
    type: "sick",
    dayPart: "full" as "full" | "first_half" | "second_half",
    reason: "",
    // keep message simple (textarea) for student; backend supports HTML/plain text
    customMessage: "",
  });

  // pick up student token; adjust keys if your app uses different names
  const getToken = () =>
    (typeof window !== "undefined" &&
      (localStorage.getItem("token_student") ||
        sessionStorage.getItem("token_student") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token"))) ||
    "";

  const fetchTemplates = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API}/leave/templates?role=student`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setLeaveTypes((data.types || []) as LeaveTypeTpl[]);
      setDayParts(data.dayParts || ["full", "first_half", "second_half"]);
      // set default message if empty
      const tpl = (data.types || []).find((t: any) => t.id === "sick");
      setForm((f) => ({
        ...f,
        customMessage: htmlIsEmpty(f.customMessage) && tpl?.defaultReason ? tpl.defaultReason : f.customMessage,
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
        // If message blank, fall back to template
        customMessage: htmlIsEmpty(form.customMessage) ? defaultMsgForType : form.customMessage,
        customMessageText: htmlIsEmpty(form.customMessage) ? defaultMsgForType || form.reason : stripHtml(form.customMessage),
      };

      const res = await fetch(`${API}/leave/student/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to request leave");

      setToast({ ok: true, msg: "Leave requested successfully." });
      // reset form minimal
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
      // Close modal regardless (as you wanted)
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

  useEffect(() => {
    fetchTemplates();
    fetchMyLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Page header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Home</h1>
              <p className="text-sm text-gray-600">Today: {today}</p>
            </div>
          </div>

          <button
            onClick={() => setShowLeaveModal(true)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition"
            title="Ask for leave"
          >
            <PlusCircle className="h-5 w-5" />
            Ask for Leave
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`rounded-xl p-3 border ${
              toast.ok ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {/* My leaves panel */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-yellow-100 rounded-xl">
                <Star className="h-5 w-5 text-yellow-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">My Leave Requests</h2>
            </div>
            <button
              onClick={fetchMyLeaves}
              className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
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
                        // if message empty, prefill with template
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
                    setForm((f) => ({
                      ...f,
                      customMessage: defaultMsgForType || f.customMessage,
                    }))
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
    </div>
  );
}
