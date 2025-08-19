"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  BookOpen, Download, Save, Users, Award, ClipboardList, Calculator,
  ChevronDown, AlertCircle, CheckCircle2, Loader2
} from "lucide-react";

/* ========= TYPES ========= */
type CourseInstanceLite = {
  _id: string;
  course: { name: string; code?: string; semesterOrYear?: { name?: string; semesterNumber?: number; yearNumber?: number } };
  batch: { batchname: string };
};
type StudentLite = { _id: string; username?: string; name?: string; email?: string };
type Mode = "exam" | "practical";

/* ========= CONFIG ========= */
const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");

/* ========= HELPERS ========= */
function ciLabel(ci: CourseInstanceLite) {
  const soY = ci.course?.semesterOrYear;
  const sy =
    soY?.semesterNumber ? `Sem ${soY.semesterNumber}` :
    soY?.yearNumber ? `Year ${soY.yearNumber}` :
    soY?.name || "";
  return `${ci.course?.name || "Course"} ${sy ? `• ${sy}` : ""} • ${ci.batch?.batchname || ""}`;
}

type ExamRow = { marks?: number; remarks?: string };
type PracticalRow = {
  pFirst?: number;
  pFinal?: number;
  pAssign?: number;
  pAttend?: number;
  practicalTotal?: number;
  remarks?: string;
};

export default function MarksEntry() {
  const [loadingCI, setLoadingCI] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [courseInstances, setCourseInstances] = useState<CourseInstanceLite[]>([]);
  const [selectedCI, setSelectedCI] = useState<string>("");

  const [mode, setMode] = useState<Mode>("exam");

  // exam config
  const [attemptNo, setAttemptNo] = useState<number>(1);
  const [maxMarks, setMaxMarks] = useState<number>(30);
  const [examTitle, setExamTitle] = useState<string>("");

  // practical config
  const [pMaxFirst, setPMaxFirst] = useState<number>(5);
  const [pMaxFinal, setPMaxFinal] = useState<number>(5);
  const [pMaxAssign, setPMaxAssign] = useState<number>(5);
  const [pMaxAttend, setPMaxAttend] = useState<number>(5);

  const [students, setStudents] = useState<StudentLite[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [rows, setRows] = useState<Record<string, ExamRow & PracticalRow>>({});

  // auth token (same pattern you used before)
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher")
      : null;

  const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;

  /* ========= FOCUS GRID (for keyboard navigation) ========= */
  // cellRefs[studentId][field] -> input element
  const cellRefs = useRef<Record<string, Record<string, HTMLInputElement | null>>>({});

  // ordered fields per mode (exclude disabled "Total")
  const fieldOrder = useMemo<string[]>(
    () => (mode === "exam" ? ["marks", "remarks"] : ["pFirst", "pFinal", "pAssign", "pAttend", "remarks"]),
    [mode]
  );

  const focusCell = (rowIdx: number, colIdx: number) => {
    if (rowIdx < 0 || rowIdx >= students.length) return;
    if (colIdx < 0 || colIdx >= fieldOrder.length) return;
    const studentId = students[rowIdx]._id;
    const field = fieldOrder[colIdx];
    const el = cellRefs.current[studentId]?.[field];
    if (el) {
      el.focus();
      // select text for quick overwrite
      el.select?.();
    }
  };

  const handleCellKeyDown = (rowIdx: number, colIdx: number) =>
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const key = e.key;
      if (key === "Enter") {
        e.preventDefault();
        const nextCol = colIdx + 1;
        if (nextCol < fieldOrder.length) {
          focusCell(rowIdx, nextCol);
        } else {
          // wrap to first col of next row
          focusCell(rowIdx + 1, 0);
        }
      } else if (key === "Home") {
        e.preventDefault();
        focusCell(rowIdx, 0);
      } else if (key === "End") {
        e.preventDefault();
        focusCell(rowIdx, fieldOrder.length - 1);
      } else if (key === "ArrowDown") {
        e.preventDefault();
        focusCell(rowIdx + 1, colIdx);
      } else if (key === "ArrowUp") {
        e.preventDefault();
        focusCell(rowIdx - 1, colIdx);
      }
    };

  /* ========= 1) Load my course instances (real API) ========= */
  useEffect(() => {
    async function fetchCIs() {
      try {
        const res = await axios.get(`${BACKEND}/teacher-routes/my-course-instances`, {
          headers: authHeader,
        });
        const arr: CourseInstanceLite[] = res?.data?.courseInstances || [];
        setCourseInstances(arr);
        if (arr.length > 0) setSelectedCI(arr[0]._id);
      } catch (err: any) {
        console.error("Failed to load courseInstances:", err?.response?.data || err.message);
        alert(err?.response?.data?.message || "Failed to load course instances");
      } finally {
        setLoadingCI(false);
      }
    }
    if (authHeader) fetchCIs();
    else setLoadingCI(false);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ========= 2) Load students for selected CI (real API) ========= */
  useEffect(() => {
    async function fetchStudents() {
      if (!selectedCI) {
        setStudents([]);
        setRows({});
        return;
      }
      setLoadingStudents(true);
      try {
        const res = await axios.get(
          `${BACKEND}/teacher-routes/course-instance/${selectedCI}/students`,
          { headers: authHeader }
        );
        const list: StudentLite[] = res?.data || [];
        setStudents(list);
        // initialize row objects + reset refs container
        setRows((old) => {
          const next = { ...old };
          for (const s of list) if (!next[s._id]) next[s._id] = {};
          return next;
        });
        cellRefs.current = {}; // clear old refs so they don't point to stale nodes
      } catch (err: any) {
        console.error("Failed to load students:", err?.response?.data || err.message);
        alert(err?.response?.data?.message || "Failed to load students");
      } finally {
        setLoadingStudents(false);
      }
    }
    if (authHeader) fetchStudents();
  }, [selectedCI, token]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ========= 3) Default exam title ========= */
  useEffect(() => {
    if (mode === "exam" && !examTitle) setExamTitle(`Exam-${attemptNo}`);
  }, [mode, attemptNo, examTitle]);

  /* ========= 4) Change handlers ========= */
  function clamp(num: number | undefined, max: number) {
    if (num === undefined || Number.isNaN(num)) return undefined;
    return Math.min(Math.max(num, 0), max);
  }

  const handleChangeRow = (
    studentId: string,
    field: "marks" | "remarks" | "pFirst" | "pFinal" | "pAssign" | "pAttend",
    value: string
  ) => {
    setRows((prev) => {
      const next = { ...prev };
      const r = { ...(next[studentId] || {}) };

      if (field === "remarks") {
        (r as any).remarks = value;
      } else if (mode === "exam" && field === "marks") {
        const n = value === "" ? undefined : Number(value);
        (r as any).marks = Number.isFinite(n as number) ? (n as number) : undefined;
      } else {
        const raw = value === "" ? undefined : Number(value);
        let n: number | undefined = Number.isFinite(raw as number) ? (raw as number) : undefined;
        if (field === "pFirst") n = clamp(n, pMaxFirst);
        if (field === "pFinal") n = clamp(n, pMaxFinal);
        if (field === "pAssign") n = clamp(n, pMaxAssign);
        if (field === "pAttend") n = clamp(n, pMaxAttend);
        (r as any)[field] = n;

        const t = (r.pFirst || 0) + (r.pFinal || 0) + (r.pAssign || 0) + (r.pAttend || 0);
        (r as any).practicalTotal = Number.isFinite(t) ? t : undefined;
      }

      next[studentId] = r as any;
      return next;
    });
  };

  const canSubmit = useMemo(() => {
    if (!selectedCI || students.length === 0) return false;
    if (mode === "exam") {
      if (![1, 2, 3].includes(attemptNo)) return false;
      if (!Number.isFinite(maxMarks) || maxMarks < 0) return false;
      return students.some((s) => Number.isFinite(rows[s._id]?.marks as number));
    }
    return students.some((s) => Number.isFinite(rows[s._id]?.practicalTotal as number));
  }, [selectedCI, students, rows, mode, attemptNo, maxMarks]);

  /* ========= 5) Submit to real endpoints ========= */
  const handleSubmit = async () => {
    if (!canSubmit || saving) return;
    if (!authHeader) {
      alert("Not authenticated. Please login again.");
      return;
    }
    try {
      setSaving(true);
      setSaveSuccess(false);

      if (mode === "exam") {
        const payload = {
          attemptNo,
          maxMarks,
          examTitle: examTitle || `Exam-${attemptNo}`,
          rows: students
            .filter((s) => Number.isFinite(rows[s._id]?.marks as number))
            .map((s) => ({
              student: s._id,
              marks: rows[s._id]!.marks!,
              remarks: rows[s._id]?.remarks || undefined,
            })),
        };
        await axios.post(`${BACKEND}/results/bulk/exam/${selectedCI}`, payload, {
          headers: authHeader,
        });
      } else {
        const payload = {
          pMaxFirst,
          pMaxFinal,
          pMaxAssign,
          pMaxAttend,
          rows: students
            .filter((s) => {
              const r = rows[s._id] || {};
              return (
                Number.isFinite(r.practicalTotal as number) ||
                Number.isFinite(r.pFirst as number) ||
                Number.isFinite(r.pFinal as number) ||
                Number.isFinite(r.pAssign as number) ||
                Number.isFinite(r.pAttend as number)
              );
            })
            .map((s) => {
              const r = rows[s._id]!;
              return {
                student: s._id,
                pFirst: r.pFirst,
                pFinal: r.pFinal,
                pAssign: r.pAssign,
                pAttend: r.pAttend,
                practicalTotal: r.practicalTotal,
                remarks: r.remarks || undefined,
              };
            }),
        };
        await axios.post(`${BACKEND}/results/bulk/practical/${selectedCI}`, payload, {
          headers: authHeader,
        });
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error("Save failed:", err?.response?.data || err.message);
      alert(err?.response?.data?.error || err?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  /* ========= 6) CSV Download ========= */
  const handleDownloadCSV = () => {
    const headerExam = ["SN","Student Name/Email","Marks","Remarks"];
    const headerPrac = ["SN","Student Name/Email","First(5)","Final(5)","Assignment(5)","Attendance(5)","Total(40)","Remarks"];

    const lines: string[] = [];
    if (mode === "exam") {
      lines.push(headerExam.join(","));
      students.forEach((s, i) => {
        const r = rows[s._id] || {};
        const name = (s.name || s.username || s.email || s._id).replace(/,/g, " ");
        const marks = (r as any).marks ?? "";
        const remarks = ((r as any).remarks || "").replace(/,/g, " ");
        lines.push([i + 1, name, marks, remarks].join(","));
      });
    } else {
      lines.push(headerPrac.join(","));
      students.forEach((s, i) => {
        const r = rows[s._id] || {};
        const name = (s.name || s.username || s.email || s._id).replace(/,/g, " ");
        const f = (r as any).pFirst ?? "";
        const fin = (r as any).pFinal ?? "";
        const asg = (r as any).pAssign ?? "";
        const att = (r as any).pAttend ?? "";
        const tot = (r as any).practicalTotal ?? "";
        const remarks = ((r as any).remarks || "").replace(/,/g, " ");
        lines.push([i + 1, name, f, fin, asg, att, tot, remarks].join(","));
      });
    }
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const title = mode === "exam" ? `exam_attempt${attemptNo}_CI_${selectedCI}.csv` : `practical_CI_${selectedCI}.csv`;
    a.href = url;
    a.download = title;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filledRows = students.filter(s => {
    const r = rows[s._id] || {};
    if (mode === "exam") return Number.isFinite((r as any).marks as number);
    return Number.isFinite((r as any).practicalTotal as number);
  }).length;

  if (loadingCI) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-lg text-slate-600">Loading your courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ClipboardList className="h-6 w-6 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Internal Results Entry</h1>
          </div>
          <p className="text-slate-600">Manage and submit examination and practical marks for your courses</p>
        </div>

        {/* Configuration Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-8">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-slate-600" />
              Configuration
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

              {/* Course Instance */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Course Instance</label>
                <div className="relative">
                  <select
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
                    value={selectedCI}
                    onChange={(e) => setSelectedCI(e.target.value)}
                  >
                    {courseInstances.length === 0 && <option value="">No courses found</option>}
                    {courseInstances.map((ci) => (
                      <option key={ci._id} value={ci._id}>
                        {ciLabel(ci)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-3 h-5 w-5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Assessment Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Assessment Type</label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                      mode === "exam" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-800"
                    }`}
                    onClick={() => setMode("exam")}
                  >
                    <Award className="h-4 w-4" />
                    Exam
                  </button>
                  <button
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                      mode === "practical" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-800"
                    }`}
                    onClick={() => setMode("practical")}
                  >
                    <Calculator className="h-4 w-4" />
                    Practical
                  </button>
                </div>
              </div>

              {/* Dynamic Config */}
              {mode === "exam" ? (
                <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Attempt Number</label>
                    <select
                      className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={attemptNo}
                      onChange={(e) => setAttemptNo(Number(e.target.value))}
                    >
                      <option value={1}>First Attempt</option>
                      <option value={2}>Second Attempt</option>
                      <option value={3}>Third Attempt</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Maximum Marks</label>
                    <input
                      type="number"
                      className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min={0}
                      value={maxMarks}
                      onChange={(e) => setMaxMarks(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Exam Title</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={`Exam-${attemptNo}`}
                      value={examTitle}
                      onChange={(e) => setExamTitle(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="lg:col-span-4">
                  <label className="block text-sm font-medium text-slate-700 mb-3">Component Maximum Marks</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">First Internal</label>
                      <input type="number" min={0}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={pMaxFirst} onChange={(e) => setPMaxFirst(Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Final Internal</label>
                      <input type="number" min={0}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={pMaxFinal} onChange={(e) => setPMaxFinal(Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Assignment</label>
                      <input type="number" min={0}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={pMaxAssign} onChange={(e) => setPMaxAssign(Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Attendance</label>
                      <input type="number" min={0}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={pMaxAttend} onChange={(e) => setPMaxAttend(Number(e.target.value))} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">

          {/* Table Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-slate-600" />
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {loadingStudents ? "Loading students..." : `Students (${students.length})`}
                </h3>
                {filledRows > 0 && (
                  <p className="text-sm text-slate-500">{filledRows} of {students.length} entries completed</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleDownloadCSV}
                className="flex items-center gap-2 px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors duration-200"
                title="Download CSV of current table"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>

              <button
                disabled={!canSubmit || saving}
                onClick={handleSubmit}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                  canSubmit && !saving
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl"
                    : "bg-slate-300 text-slate-500 cursor-not-allowed"
                }`}
                title={canSubmit ? "Save all entries" : "Fill at least one entry to save"}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Marks
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          {students.length > 0 && (
            <div className="px-6 py-2 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                <span>Progress</span>
                <span>{Math.round((filledRows / students.length) * 100)}% complete</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(filledRows / students.length) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Table Content */}
          <div className="overflow-hidden">
            {/* Table Headers */}
            {mode === "exam" ? (
              <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-600">
                <div className="col-span-4 p-4">Student Information</div>
                <div className="col-span-2 p-4 text-center">Marks (/{maxMarks})</div>
                <div className="col-span-6 p-4">Remarks</div>
              </div>
            ) : (
              <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-600">
                <div className="col-span-3 p-4">Student Information</div>
                <div className="col-span-1 p-4 text-center">First<br />({pMaxFirst})</div>
                <div className="col-span-1 p-4 text-center">Final<br />({pMaxFinal})</div>
                <div className="col-span-2 p-4 text-center">Assignment<br />({pMaxAssign})</div>
                <div className="col-span-1 p-4 text-center">Attend.<br />({pMaxAttend})</div>
                <div className="col-span-1 p-4 text-center">Total<br />(40)</div>
                <div className="col-span-3 p-4">Remarks</div>
              </div>
            )}

            {/* Table Rows */}
            <div className="max-h-[60vh] overflow-auto">
              {students.map((s, idx) => {
                const r = rows[s._id] || {};
                const displayName = s.name || s.username || s.email || s._id.slice(-6);
                const hasData = mode === "exam" ? Number.isFinite((r as any).marks as number) : Number.isFinite((r as any).practicalTotal as number);

                // ref helper
                const setRef = (field: string) => (el: HTMLInputElement | null) => {
                  if (!cellRefs.current[s._id]) cellRefs.current[s._id] = {};
                  cellRefs.current[s._id][field] = el;
                };

                return (
                  <div
                    className={`grid grid-cols-12 border-b border-slate-100 hover:bg-slate-50 transition-colors duration-150 ${
                      hasData ? "bg-green-50/50" : ""
                    }`}
                    key={s._id}
                  >
                    {mode === "exam" ? (
                      <>
                        <div className="col-span-4 p-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                              hasData ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                            }`}>
                              {idx + 1}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{displayName}</div>
                              <div className="text-sm text-slate-500">{s.email || s.username || ""}</div>
                            </div>
                          </div>
                        </div>
                        <div className="col-span-2 p-4">
                          <input
                            ref={setRef("marks")}
                            onKeyDown={handleCellKeyDown(idx, 0)}
                            onFocus={(e) => e.currentTarget.select()}
                            type="number"
                            min={0}
                            max={maxMarks}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={(r as any).marks ?? ""}
                            onChange={(e) => handleChangeRow(s._id, "marks", e.target.value)}
                            placeholder={`0 - ${maxMarks}`}
                            aria-label={`Marks for ${displayName}`}
                          />
                        </div>
                        <div className="col-span-6 p-4">
                          <input
                            ref={setRef("remarks")}
                            onKeyDown={handleCellKeyDown(idx, 1)}
                            onFocus={(e) => e.currentTarget.select()}
                            type="text"
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={(r as any).remarks ?? ""}
                            onChange={(e) => handleChangeRow(s._id, "remarks", e.target.value)}
                            placeholder="Optional remarks..."
                            aria-label={`Remarks for ${displayName}`}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="col-span-3 p-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                              hasData ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                            }`}>
                              {idx + 1}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{displayName}</div>
                              <div className="text-sm text-slate-500">{s.email || s.username || ""}</div>
                            </div>
                          </div>
                        </div>
                        <div className="col-span-1 p-4">
                          <input
                            ref={setRef("pFirst")}
                            onKeyDown={handleCellKeyDown(idx, 0)}
                            onFocus={(e) => e.currentTarget.select()}
                            type="number"
                            min={0}
                            max={pMaxFirst}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2 py-2 text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={(r as any).pFirst ?? ""}
                            onChange={(e) => handleChangeRow(s._id, "pFirst", e.target.value)}
                            placeholder={`0-${pMaxFirst}`}
                            aria-label={`First for ${displayName}`}
                          />
                        </div>
                        <div className="col-span-1 p-4">
                          <input
                            ref={setRef("pFinal")}
                            onKeyDown={handleCellKeyDown(idx, 1)}
                            onFocus={(e) => e.currentTarget.select()}
                            type="number"
                            min={0}
                            max={pMaxFinal}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2 py-2 text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={(r as any).pFinal ?? ""}
                            onChange={(e) => handleChangeRow(s._id, "pFinal", e.target.value)}
                            placeholder={`0-${pMaxFinal}`}
                            aria-label={`Final for ${displayName}`}
                          />
                        </div>
                        <div className="col-span-2 p-4">
                          <input
                            ref={setRef("pAssign")}
                            onKeyDown={handleCellKeyDown(idx, 2)}
                            onFocus={(e) => e.currentTarget.select()}
                            type="number"
                            min={0}
                            max={pMaxAssign}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2 py-2 text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={(r as any).pAssign ?? ""}
                            onChange={(e) => handleChangeRow(s._id, "pAssign", e.target.value)}
                            placeholder={`0-${pMaxAssign}`}
                            aria-label={`Assignment for ${displayName}`}
                          />
                        </div>
                        <div className="col-span-1 p-4">
                          <input
                            ref={setRef("pAttend")}
                            onKeyDown={handleCellKeyDown(idx, 3)}
                            onFocus={(e) => e.currentTarget.select()}
                            type="number"
                            min={0}
                            max={pMaxAttend}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2 py-2 text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={(r as any).pAttend ?? ""}
                            onChange={(e) => handleChangeRow(s._id, "pAttend", e.target.value)}
                            placeholder={`0-${pMaxAttend}`}
                            aria-label={`Attendance for ${displayName}`}
                          />
                        </div>
                        <div className="col-span-1 p-4">
                          <input
                            disabled
                            className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg px-2 py-2 text-center font-semibold text-blue-700"
                            value={(r as any).practicalTotal ?? ""}
                            placeholder="—"
                            title="Automatically calculated sum"
                            aria-label={`Total for ${displayName}`}
                          />
                        </div>
                        <div className="col-span-3 p-4">
                          <input
                            ref={setRef("remarks")}
                            onKeyDown={handleCellKeyDown(idx, 4)}
                            onFocus={(e) => e.currentTarget.select()}
                            type="text"
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={(r as any).remarks ?? ""}
                            onChange={(e) => handleChangeRow(s._id, "remarks", e.target.value)}
                            placeholder="Optional remarks..."
                            aria-label={`Remarks for ${displayName}`}
                          />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {!loadingStudents && students.length === 0 && (
                <div className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                    <Users className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No Students Found</h3>
                  <p className="text-slate-500">No students are enrolled in this course instance.</p>
                </div>
              )}

              {loadingStudents && (
                <div className="p-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                  <p className="text-slate-600">Loading student data...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Footer */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-slate-600">
                  Selected: <span className="font-mono text-slate-800">{selectedCI || "None"}</span>
                </span>
              </div>

              {mode === "exam" ? (
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-600">
                    Exam Mode • Attempt {attemptNo} • Max {maxMarks} marks
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-600">
                    Practical Mode • Components: {pMaxFirst}/{pMaxFinal}/{pMaxAssign}/{pMaxAttend}
                  </span>
                </div>
              )}
            </div>

            {!canSubmit && students.length > 0 && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Fill at least one entry to save</span>
              </div>
            )}

            {canSubmit && (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">Ready to save {filledRows} entries</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
