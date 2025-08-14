"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  Loader2, Search, Eye, ExternalLink, Save, ShieldAlert, CalendarClock, X, Users,
  FileText, CheckCircle, Clock, Award, TrendingUp, BookOpen, MessageSquare, Edit3, BarChart3
} from "lucide-react";

/* ====================== Types ====================== */
type UserMini = { _id: string; username: string; email?: string };
type SubmissionFile = { url: string; originalname: string; filetype?: string };
type Submission = {
  _id: string;
  student: UserMini;
  files: SubmissionFile[];
  submittedAt?: string;
  grade?: number | null;
  feedback?: string;
  plagiarismPercentage?: number;
  status?: "submitted" | "draft";
};
type Assignment = {
  _id: string;
  title: string;
  points?: number | null;
  acceptingSubmissions?: boolean;
  closeAt?: string | null;
};
type SubmissionsResp = {
  assignment: Assignment;
  count: number;
  submissions: Submission[];
};

/* ====================== Config/Helpers ====================== */
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const authHeader = () => ({
  Authorization:
    "Bearer " +
    (localStorage.getItem("token_teacher") ||
      sessionStorage.getItem("token_teacher") ||
      ""),
});
const getFileUrl = (url: string) => (url?.startsWith("http") ? url : `${BACKEND_URL}${url || ""}`);
const isOfficeName = (n: string) => /\.(docx?|pptx?|xlsx?)$/i.test(n);
const isPDFName = (n: string) => /\.pdf$/i.test(n);
const isImageName = (n: string) => /\.(png|jpe?g|gif|webp)$/i.test(n);
const fmt = (d?: string) => (d ? new Date(d).toLocaleString() : "—");

function toLocalInputValue(iso?: string | null) {
  if (!iso) return "";
  const dt = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = dt.getFullYear();
  const m = pad(dt.getMonth() + 1);
  const d = pad(dt.getDate());
  const hh = pad(dt.getHours());
  const mm = pad(dt.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

/* ---- Plagiarism helpers ---- */
const PLAG_THRESHOLD = 30; // tweak if your policy is different
const plagStatus = (p?: number | null) =>
  p == null ? null : p >= PLAG_THRESHOLD ? "PLAGIARIZED" : "ACCEPTED";

/* Better file kind detection using MIME OR filename */
const isOfficeMime = (mt?: string) =>
  !!mt && /^application\/vnd\.openxmlformats-officedocument\./i.test(mt);
const classifyFile = (f: SubmissionFile) => {
  const mt = f.filetype?.toLowerCase();
  const name = f.originalname || "";
  if (mt?.startsWith("image/") || isImageName(name)) return "img";
  if (mt === "application/pdf" || isPDFName(name)) return "pdf";
  if (isOfficeMime(mt) || isOfficeName(name)) return "office";
  return "other";
};

/* Quick feedback templates */
const FEEDBACK_TEMPLATES = [
  { label: "Excellent Work", text: "Outstanding work! You've demonstrated excellent understanding of the concepts and provided thorough, well-organized responses." },
  { label: "Good Job", text: "Good work overall. You've shown solid understanding with room for minor improvements in [specific area]." },
  { label: "Needs Improvement", text: "Your submission shows effort, but needs improvement in [specific areas]. Please review the rubric and consider revising." },
  { label: "Missing Requirements", text: "Your submission is missing some key requirements. Please review the assignment instructions and resubmit." },
  { label: "Late Submission", text: "This submission was received after the deadline. Please ensure future assignments are submitted on time." }
];

/* ====================== Component ====================== */
export default function TeacherGradeWorkspace({ assignmentId }: { assignmentId: string }) {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Submission[]>([]);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => list.find(s => s._id === selectedId) || null, [list, selectedId]);

  const [q, setQ] = useState("");
  const [gradeInput, setGradeInput] = useState<string>("");
  const [feedbackInput, setFeedbackInput] = useState<string>("");
  const [savingGrade, setSavingGrade] = useState(false);
  const [showFeedbackTemplates, setShowFeedbackTemplates] = useState(false);

  const maxPoints = assignment?.points ?? 100;
  const [closeAtLocal, setCloseAtLocal] = useState<string>("");

  const [preview, setPreview] = useState<{ src: string; title: string; kind: "img"|"pdf"|"office"|"other" }|null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // includeDrafts=1 => backend should also return "assigned" entries
      const res = await fetch(
        `${BACKEND_URL}/assignmentgrading/assignments/${assignmentId}/submissions?includeDrafts=1`,
        { headers: { "Content-Type": "application/json", ...authHeader() } }
      );
      const data: SubmissionsResp = await res.json();
      if (!res.ok) throw new Error((data as any)?.error || "Failed to load");
      setAssignment(data.assignment);
      setCloseAtLocal(toLocalInputValue(data.assignment?.closeAt ?? null));
      setList(Array.isArray(data.submissions) ? data.submissions : []);
      setSelectedId(prev => prev ?? data.submissions?.[0]?._id ?? null);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (assignmentId) load(); }, [assignmentId]);

  useEffect(() => {
    if (!selected) { setGradeInput(""); setFeedbackInput(""); return; }
    setGradeInput(selected.grade != null ? String(selected.grade) : "");
    setFeedbackInput(selected.feedback ?? "");
  }, [selectedId]); // re-sync when switching students

  /* Derive roster groups */
  const { assigned, submitted, graded } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = list.filter(s => {
      if (!needle) return true;
      const name = (s.student?.username || "").toLowerCase();
      const email = (s.student?.email || "").toLowerCase();
      return name.includes(needle) || email.includes(needle);
    });

    const g = filtered.filter(s => s.grade != null);
    const sub = filtered.filter(s => s.grade == null && (s.status === "submitted" || !!s.submittedAt));
    const asg = filtered.filter(s => !s.submittedAt && s.status !== "submitted");
    return { assigned: asg, submitted: sub, graded: g };
  }, [list, q]);

  /* Preview dispatcher */
  function openPreview(f: SubmissionFile) {
    const abs = getFileUrl(f.url);
    const kind = classifyFile(f);
    if (kind === "office") {
      const office = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(abs)}`;
      setPreview({ src: office, title: f.originalname, kind: "office" });
    } else if (kind === "pdf") {
      setPreview({ src: abs, title: f.originalname, kind: "pdf" });
    } else if (kind === "img") {
      setPreview({ src: abs, title: f.originalname, kind: "img" });
    } else {
      setPreview({ src: abs, title: f.originalname, kind: "other" });
    }
  }

  /* Save grade + feedback */
  async function saveGrade() {
    if (!selected) return;
    const val = gradeInput.trim();
    const gradeNum = val === "" ? undefined : Number(val);
    if (val !== "" && Number.isNaN(gradeNum)) {
      alert("Grade must be a valid number");
      return;
    }
    if (gradeNum != null && (gradeNum < 0 || gradeNum > maxPoints)) {
      alert(`Grade must be between 0 and ${maxPoints}`);
      return;
    }
    if (!feedbackInput.trim()) {
      if (!confirm("No feedback provided. Continue saving grade only?")) return;
    }

    setSavingGrade(true);
    try {
      const res = await fetch(`${BACKEND_URL}/assignmentgrading/submissions/${selected._id}/grade`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ grade: gradeNum, feedback: feedbackInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save");

      // Optimistic update
      setList(prev => prev.map(s =>
        s._id === selected._id ? { ...s, grade: gradeNum, feedback: feedbackInput } : s
      ));

      // jump to next ungraded
      const nextUngraded = submitted.find(s => s._id !== selected._id);
      if (nextUngraded) setSelectedId(nextUngraded._id);
    } catch (e: any) {
      alert(e.message || "Failed to save grade");
    } finally {
      setSavingGrade(false);
    }
  }

  function insertFeedbackTemplate(template: string) {
    setFeedbackInput(prev => (prev ? prev + "\n\n" + template : template));
    setShowFeedbackTemplates(false);
  }

  /* Accepting / closing controls */
  async function toggleAccepting() {
    if (!assignment?._id) return;
    const next = !(assignment?.acceptingSubmissions ?? true);
    try {
      const res = await fetch(`${BACKEND_URL}/assignmentgrading/assignments/${assignment._id}/accepting`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ acceptingSubmissions: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update");
      await load();
    } catch (e: any) {
      alert(e.message || "Failed to update submission status");
    }
  }

  async function closeNow() {
    if (!assignment?._id) return;
    if (!confirm("Close submissions immediately? This will prevent any new submissions.")) return;
    try {
      const res = await fetch(`${BACKEND_URL}/assignmentgrading/assignments/${assignment._id}/accepting`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ closeNow: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to close");
      await load();
    } catch (e: any) {
      alert(e.message || "Failed to close submissions");
    }
  }

  async function saveCloseDate() {
    if (!assignment?._id) return;
    const iso = closeAtLocal ? new Date(closeAtLocal).toISOString() : null;
    try {
      const res = await fetch(`${BACKEND_URL}/assignmentgrading/assignments/${assignment._id}/accepting`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ closeAt: iso }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to set close date");
      await load();
    } catch (e: any) {
      alert(e.message || "Failed to save close date");
    }
  }

  /* ====================== UI ====================== */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 shadow-lg border flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600"/>
          <span className="text-gray-700 font-medium">Loading assignments...</span>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md">
          <div className="flex items-center gap-3 text-red-700">
            <ShieldAlert className="w-6 h-6 flex-shrink-0"/>
            <div>
              <h3 className="font-semibold">Error Loading Workspace</h3>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const avgGrade = (graded.length > 0)
    ? graded.reduce((sum, s) => sum + (s.grade || 0), 0) / graded.length
    : 0;
  const completionRate = list.length > 0 ? ((submitted.length + graded.length) / list.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{assignment?.title}</h1>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Award className="w-4 h-4" />
                    Max: {maxPoints} points
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarClock className="w-4 h-4" />
                    Close: {fmt(assignment?.closeAt || undefined)}
                  </span>
                  <span className="flex items-center gap-1">
                    <BarChart3 className="w-4 h-4" />
                    Avg: {avgGrade.toFixed(1)}/{maxPoints}
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    {completionRate.toFixed(0)}% submitted
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"/>
                <input
                  value={q}
                  onChange={e=>setQ(e.target.value)}
                  placeholder="Search students..."
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                />
              </div>

              {/* Open/Close submissions */}
              <button
                onClick={toggleAccepting}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  assignment?.acceptingSubmissions
                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                    : "bg-green-100 text-green-700 hover:bg-green-200"
                }`}
              >
                {assignment?.acceptingSubmissions ? "Close Submissions" : "Open Submissions"}
              </button>

              {/* Close now */}
              <button
                onClick={closeNow}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
                title="Close immediately"
              >
                Close Now
              </button>

              {/* Set close date */}
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={closeAtLocal}
                  onChange={e => setCloseAtLocal(e.target.value)}
                  className="px-2 py-2 text-sm border rounded-lg"
                  title="Set/clear close date/time"
                />
                <button
                  onClick={saveCloseDate}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Save Date
                </button>
              </div>

              <button
                onClick={load}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Student List */}
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
            {/* Stats */}
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-white rounded-lg shadow-sm">
                  <div className="text-lg font-bold text-gray-900">{assigned.length}</div>
                  <div className="text-xs text-gray-600">Assigned</div>
                </div>
                <div className="text-center p-2 bg-white rounded-lg shadow-sm">
                  <div className="text-lg font-bold text-orange-600">{submitted.length}</div>
                  <div className="text-xs text-gray-600">To Grade</div>
                </div>
                <div className="text-center p-2 bg-white rounded-lg shadow-sm">
                  <div className="text-lg font-bold text-green-600">{graded.length}</div>
                  <div className="text-xs text-gray-600">Graded</div>
                </div>
              </div>
            </div>

            {/* Sections */}
            <div className="flex-1 overflow-y-auto">
              {submitted.length > 0 && (
                <Section
                  title="Need Grading"
                  items={submitted}
                  maxPoints={maxPoints}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  icon={<Clock className="w-4 h-4" />}
                  color="orange"
                  priority
                />
              )}
              {graded.length > 0 && (
                <Section
                  title="Graded"
                  items={graded}
                  maxPoints={maxPoints}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  icon={<CheckCircle className="w-4 h-4" />}
                  color="green"
                />
              )}
              {assigned.length > 0 && (
                <Section
                  title="Not Submitted"
                  items={assigned}
                  maxPoints={maxPoints}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  icon={<Users className="w-4 h-4" />}
                  color="gray"
                />
              )}
              {assigned.length + submitted.length + graded.length === 0 && (
                <div className="p-6 text-center text-gray-500">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No students found</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Student Details */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            {!selected ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center p-8 bg-white rounded-xl shadow-sm border max-w-md mx-4">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Student</h3>
                  <p className="text-gray-600">Choose a student from the sidebar to review their submission and provide grades</p>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Student Header */}
                <div className="bg-white rounded-xl border p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold">
                            {selected.student?.username?.[0]?.toUpperCase() || "?"}
                          </span>
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">{selected.student?.username}</h2>
                          <p className="text-gray-600 text-sm">{selected.student?.email || "No email"}</p>
                        </div>
                      </div>

                      {selected.submittedAt && (
                        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-200 inline-flex">
                          <CheckCircle className="w-4 h-4" />
                          <span>Submitted {new Date(selected.submittedAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Grade + Plag status */}
                    <div className="text-right">
                      <div className="text-3xl font-bold text-blue-600">
                        {selected.grade != null ? selected.grade : "—"}
                        <span className="text-lg text-gray-400">/{maxPoints}</span>
                      </div>
                      {selected.grade != null && (
                        <div className="text-sm text-gray-600 mt-1">
                          {((selected.grade / maxPoints) * 100).toFixed(1)}%
                        </div>
                      )}
                      {typeof selected.plagiarismPercentage === "number" && (
                        <div className="mt-2 flex items-center gap-2 justify-end">
                          {/* status chip */}
                          {(() => {
                            const st = plagStatus(selected.plagiarismPercentage);
                            if (!st) return null;
                            const cls =
                              st === "PLAGIARIZED"
                                ? "bg-red-100 text-red-700"
                                : "bg-green-100 text-green-700";
                            return (
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${cls}`}>
                                {st}
                              </span>
                            );
                          })()}

                          {/* percent chip */}
                          <span className={`text-sm px-2 py-1 rounded ${
                            selected.plagiarismPercentage >= PLAG_THRESHOLD
                              ? 'bg-red-50 text-red-700'
                              : 'bg-green-50 text-green-700'
                          }`}>
                            Plagiarism: {selected.plagiarismPercentage.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Files Section (preview ONLY) */}
                <div className="bg-white rounded-xl border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    Submitted Files ({selected.files?.length || 0})
                  </h3>
                  {selected.files?.length ? (
                    <div className="space-y-3">
                      {selected.files.map((f, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <FileText className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{f.originalname}</div>
                              <div className="text-sm text-gray-500">{f.filetype || "—"}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={()=>openPreview(f)}
                              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              <Eye className="w-4 h-4"/> Preview
                            </button>
                            <a
                              href={getFileUrl(f.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              <ExternalLink className="w-4 h-4"/> Open
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No files submitted</p>
                    </div>
                  )}
                </div>

                {/* Grading & Feedback */}
                <div className="bg-white rounded-xl border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <Award className="w-5 h-5 text-green-600" />
                    Grading & Feedback
                  </h3>

                  <div className="grid lg:grid-cols-[200px_1fr] gap-6">
                    {/* Grade Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Grade (0–{maxPoints})
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={gradeInput}
                          onChange={e=>setGradeInput(e.target.value)}
                          min={0}
                          max={maxPoints}
                          step="0.1"
                          className="w-full px-4 py-3 text-xl font-bold text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={`0–${maxPoints}`}
                        />
                      </div>
                      {gradeInput && !isNaN(Number(gradeInput)) && (
                        <div className="mt-2 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                            Number(gradeInput) / maxPoints >= 0.9 ? 'bg-green-100 text-green-800' :
                            Number(gradeInput) / maxPoints >= 0.8 ? 'bg-blue-100 text-blue-800' :
                            Number(gradeInput) / maxPoints >= 0.7 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {((Number(gradeInput) / maxPoints) * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}

                      {/* Quick Grades */}
                      <div className="mt-3 space-y-1">
                        <div className="text-xs font-medium text-gray-600 mb-2">Quick Grades:</div>
                        <div className="grid grid-cols-2 gap-1">
                          {[
                            { label: "A+", value: maxPoints },
                            { label: "A", value: Math.round(maxPoints * 0.95) },
                            { label: "B+", value: Math.round(maxPoints * 0.87) },
                            { label: "B", value: Math.round(maxPoints * 0.83) },
                            { label: "C+", value: Math.round(maxPoints * 0.77) },
                            { label: "C", value: Math.round(maxPoints * 0.73) }
                          ].map(grade => (
                            <button
                              key={grade.label}
                              onClick={() => setGradeInput(String(grade.value))}
                              className="px-2 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                            >
                              {grade.label} ({grade.value})
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Feedback */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">
                          Feedback for Student
                        </label>
                        <button
                          onClick={() => setShowFeedbackTemplates(!showFeedbackTemplates)}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          Templates
                        </button>
                      </div>

                      {showFeedbackTemplates && (
                        <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="text-xs font-medium text-blue-800 mb-2">Quick Feedback:</div>
                          <div className="space-y-1">
                            {FEEDBACK_TEMPLATES.map((template, i) => (
                              <button
                                key={i}
                                onClick={() => insertFeedbackTemplate(template.text)}
                                className="block w-full text-left px-2 py-1 text-xs bg-white hover:bg-blue-100 rounded border text-gray-700 transition-colors"
                              >
                                {template.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <textarea
                        value={feedbackInput}
                        onChange={e=>setFeedbackInput(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[120px] resize-vertical"
                        placeholder="Provide constructive, specific feedback..."
                      />
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                        <span>{feedbackInput.length} characters</span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          Visible to the student
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end pt-6 border-t border-gray-200">
                    <button
                      onClick={saveGrade}
                      disabled={savingGrade || !gradeInput.trim()}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {savingGrade ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin"/>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-5 h-5" />
                          Save & Next
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-6xl max-h-[95vh] rounded-lg overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900">{preview.title}</h3>
              <button
                onClick={() => setPreview(null)}
                className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5 text-gray-600"/>
              </button>
            </div>
            <div className="p-4">
              <div className="bg-white rounded-lg overflow-hidden">
                {preview.kind === "img" && (
                  <img
                    src={preview.src}
                    alt={preview.title}
                    className="max-h-[80vh] w-full object-contain"
                  />
                )}
                {preview.kind === "pdf" && (
                  <iframe
                    title="PDF Preview"
                    className="w-full h-[80vh]"
                    src={preview.src}
                  />
                )}
                {preview.kind === "office" && (
                  <iframe
                    title="Office Document Preview"
                    className="w-full h-[80vh]"
                    src={preview.src}
                  />
                )}
                {preview.kind === "other" && (
                  <div className="text-center py-16 text-gray-600">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg mb-4">This file type cannot be previewed</p>
                    <a
                      href={preview.src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4"/>
                      Open in New Tab
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =============== Roster Section Component =============== */
function Section({
  title,
  items,
  maxPoints,
  selectedId,
  onSelect,
  icon,
  color,
  priority = false,
}: {
  title: string;
  items: Submission[];
  maxPoints: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  icon: React.ReactNode;
  color: "gray" | "blue" | "green" | "orange";
  priority?: boolean;
}) {
  const colorClasses = {
    gray: "text-gray-600 bg-gray-50",
    blue: "text-blue-600 bg-blue-50",
    green: "text-green-600 bg-green-50",
    orange: "text-orange-600 bg-orange-50",
  };

  return (
    <div className={`border-b border-gray-200 ${priority ? 'border-l-4 border-l-orange-400' : ''}`}>
      <div className={`px-4 py-3 ${colorClasses[color]} flex items-center gap-2 font-medium text-sm`}>
        {icon}
        <span>{title} ({items.length})</span>
        {priority && <span className="ml-auto text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded-full font-semibold">Priority</span>}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {items.length === 0 ? (
          <div className="px-4 py-6 text-center text-gray-400 text-sm">
            No students in this section
          </div>
        ) : (
          items.map((s) => {
            const active = s._id === selectedId;
            const hasGrade = s.grade != null;
            const gradeText = hasGrade ? `${s.grade}/${maxPoints}` : "";
            const hasSubmission = !!s.submittedAt;
            const p = s.plagiarismPercentage;
            const st = typeof p === "number" ? plagStatus(p) : null;

            return (
              <button
                key={s._id}
                onClick={()=>onSelect(s._id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  active ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium text-gray-900">
                        {s.student?.username || "Unknown"}
                      </div>
                      {hasGrade && (
                        <div className="text-sm font-bold px-2 py-1 rounded bg-blue-100 text-blue-800">
                          {gradeText}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {hasSubmission ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                            <CheckCircle className="w-3 h-3" />
                            Submitted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                            <Clock className="w-3 h-3" />
                            Not submitted
                          </span>
                        )}

                        {/* Plagiarism chip (status + %) */}
                        {typeof p === "number" && (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                            p >= PLAG_THRESHOLD ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {st} • {p.toFixed(0)}%
                          </span>
                        )}

                        {s.feedback && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                            <MessageSquare className="w-3 h-3" />
                            Feedback
                          </span>
                        )}
                      </div>

                      {s.submittedAt && (
                        <div className="text-xs text-gray-500">
                          {new Date(s.submittedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
