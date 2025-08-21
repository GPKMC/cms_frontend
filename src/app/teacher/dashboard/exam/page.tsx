"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  BookOpen, Download, Save, Users, Award, ClipboardList, Calculator,
  ChevronDown, AlertCircle, CheckCircle2, Loader2, Printer, PlusCircle, FolderOpen
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

/* ========= TYPES ========= */
type CourseInstanceLite = {
  _id: string;
  course: { name: string; code?: string; semesterOrYear?: { name?: string; semesterNumber?: number; yearNumber?: number } };
  batch: { batchname: string };
};
type StudentLite = { _id: string; username?: string; name?: string; email?: string };
type Mode = "exam" | "practical";

type AttemptInfo = { attemptNo: number; count: number; maxMarks?: number; title?: string };
type ExamSlotInfo = { examSlot: number; title?: string; maxMarks?: number; totalCount: number; attempts: AttemptInfo[] };

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

type ExamRow = {
  marks?: number;
  remarks?: string;
  examOutcome?: "scored" | "ab" | "not_assigned";
};
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

  // exam config (two-level: examSlot and attemptNo; both >= 1)
  const [examSlot, setExamSlot] = useState<number>(1);
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

  // exam slots list (each slot has attempts)
  const [examSlots, setExamSlots] = useState<ExamSlotInfo[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);

  // auth token
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher")
      : null;

  const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;

  /* ========= FOCUS GRID ========= */
  const cellRefs = useRef<Record<string, Record<string, HTMLInputElement | null>>>({});

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
      el.select?.();
    }
  };

  const handleCellKeyDown = (rowIdx: number, colIdx: number) =>
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const key = e.key;
      if (key === "Enter") {
        e.preventDefault();
        const nextCol = colIdx + 1;
        if (nextCol < fieldOrder.length) focusCell(rowIdx, nextCol);
        else focusCell(rowIdx + 1, 0);
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

  /* ========= Load my course instances ========= */
  useEffect(() => {
    async function fetchCIs() {
      try {
        const res = await axios.get(`${BACKEND}/teacher-routes/my-course-instances`, { headers: authHeader });
        const arr: CourseInstanceLite[] = res?.data?.courseInstances || [];
        setCourseInstances(arr);
        if (arr.length > 0) setSelectedCI(arr[0]._id);
      } catch (err: any) {
        console.error("Failed to load courseInstances:", err?.response?.data || err.message);
        toast.error(err?.response?.data?.message || "Failed to load course instances");
      } finally {
        setLoadingCI(false);
      }
    }
    if (authHeader) fetchCIs();
    else setLoadingCI(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /* ========= Load students for selected CI ========= */
  useEffect(() => {
    async function fetchStudents() {
      if (!selectedCI) {
        setStudents([]);
        setRows({});
        return;
      }
      setLoadingStudents(true);
      try {
        const res = await axios.get(`${BACKEND}/teacher-routes/course-instance/${selectedCI}/students`, { headers: authHeader });
        const list: StudentLite[] = res?.data || [];
        setStudents(list);
        setRows((old) => {
          const next = { ...old };
          for (const s of list) if (!next[s._id]) next[s._id] = {};
          return next;
        });
        cellRefs.current = {};
      } catch (err: any) {
        console.error("Failed to load students:", err?.response?.data || err.message);
        toast.error(err?.response?.data?.message || "Failed to load students");
      } finally {
        setLoadingStudents(false);
      }
    }
    if (authHeader) fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCI, token]);

  /* ========= Load ALL exam slots+attempts for this CI ========= */
  async function loadExamSlots() {
    if (!selectedCI || !authHeader) return;
    setLoadingExams(true);
    try {
      const res = await axios.get(`${BACKEND}/result/list/${selectedCI}?kind=exam`, { headers: authHeader });
      const records: any[] = Array.isArray(res.data) ? res.data : [];

      // group by examSlot, then attemptNo
      const group = new Map<number, { title?: string; maxMarks?: number; attempts: Map<number, AttemptInfo>; total: number }>();
      for (const rec of records) {
        const slot = Number(rec?.examSlot);
        const att  = Number(rec?.attemptNo);
        if (!Number.isFinite(slot) || slot < 1 || !Number.isFinite(att) || att < 1) continue;

        const g = group.get(slot) || { title: undefined, maxMarks: undefined, attempts: new Map(), total: 0 };
        if (!g.title && rec?.examTitle != null) g.title = String(rec.examTitle ?? "");
        if (!Number.isFinite(g.maxMarks) && Number.isFinite(Number(rec?.maxMarks))) g.maxMarks = Number(rec.maxMarks);

        const a = g.attempts.get(att) || { attemptNo: att, count: 0, maxMarks: g.maxMarks, title: g.title };
        a.count += 1;
        if (!Number.isFinite(a.maxMarks) && Number.isFinite(Number(rec?.maxMarks))) a.maxMarks = Number(rec.maxMarks);
        if (a.title == null && rec?.examTitle != null) a.title = String(rec.examTitle ?? "");
        g.attempts.set(att, a);

        g.total += 1;
        group.set(slot, g);
      }

      const arr: ExamSlotInfo[] = Array.from(group.entries())
        .map(([slot, g]) => ({
          examSlot: slot,
          title: g.title,
          maxMarks: g.maxMarks,
          totalCount: g.total,
          attempts: Array.from(g.attempts.values()).sort((x, y) => x.attemptNo - y.attemptNo),
        }))
        .sort((x, y) => x.examSlot - y.examSlot);

      setExamSlots(arr);

      // choose first existing slot/attempt if current selection doesn't exist
      const slotExists = arr.some(s => s.examSlot === examSlot);
      if (!slotExists && arr.length) {
        setExamSlot(arr[0].examSlot);
        const firstAttempt = arr[0].attempts[0]?.attemptNo ?? 1;
        setAttemptNo(firstAttempt);
      } else if (slotExists) {
        const selected = arr.find(s => s.examSlot === examSlot)!;
        const attemptExists = selected.attempts.some(a => a.attemptNo === attemptNo);
        if (!attemptExists && selected.attempts.length) {
          setAttemptNo(selected.attempts[0].attemptNo);
        }
      }
    } catch (err: any) {
      console.error("Failed to load exam slots:", err?.response?.data || err.message);
      toast.error(err?.response?.data?.error || "Failed to load exam sessions");
    } finally {
      setLoadingExams(false);
    }
  }

  useEffect(() => {
    if (!authHeader || !selectedCI) return;
    loadExamSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCI, token]);

  /* ========= Load existing saved rows for selected (slot, attempt) ========= */
  async function loadExistingRows() {
    if (!selectedCI || !authHeader) return;

    const params =
      mode === "exam"
        ? `?kind=exam&examSlot=${examSlot}&attemptNo=${attemptNo}`
        : `?kind=practical`;

    try {
      const res = await axios.get(
        `${BACKEND}/result/list/${selectedCI}${params}`,
        { headers: authHeader }
      );
      const records = Array.isArray(res.data) ? res.data : [];

      // For exam: pick maxMarks + title from existing rows of this (slot, attempt)
      if (mode === "exam") {
        if (records.length) {
          const withMax = records.find((r: any) => Number.isFinite(Number(r?.maxMarks)));
          if (withMax) setMaxMarks(Number(withMax.maxMarks));
          const withTitle = records.find((r: any) => r?.examTitle != null);
          if (withTitle) setExamTitle(String(withTitle.examTitle ?? ""));
        }
      }

      const byStudent: Record<string, any> = {};
      for (const rec of records) {
        const sid = rec?.student?._id || rec?.student;
        if (!sid) continue;
        if (rec.kind === "exam") {
          const outcome: ExamRow["examOutcome"] = rec?.examOutcome || (Number.isFinite(Number(rec?.marks)) ? "scored" : undefined);
          byStudent[sid] = {
            examOutcome: outcome,
            marks: outcome === "scored" ? (Number.isFinite(Number(rec?.marks)) ? Number(rec.marks) : undefined) : undefined,
            remarks: rec.remarks ?? "",
          };
        } else {
          byStudent[sid] = {
            pFirst: rec.pFirst ?? undefined,
            pFinal: rec.pFinal ?? undefined,
            pAssign: rec.pAssign ?? undefined,
            pAttend: rec.pAttend ?? undefined,
            practicalTotal: rec.practicalTotal ?? undefined,
            remarks: rec.remarks ?? "",
          };
        }
      }

      setRows((prev) => {
        const next = { ...prev };
        for (const s of students) {
          if (byStudent[s._id]) {
            next[s._id] = { ...(next[s._id] || {}), ...byStudent[s._id] };
          } else {
            if (mode === "exam") {
              next[s._id] = { ...(next[s._id] || {}), marks: undefined, remarks: "", examOutcome: undefined };
            } else {
              next[s._id] = { ...(next[s._id] || {}), pFirst: undefined, pFinal: undefined, pAssign: undefined, pAttend: undefined, practicalTotal: undefined, remarks: "" };
            }
          }
        }
        return next;
      });
    } catch (err: any) {
      console.error("Failed to load existing results:", err?.response?.data || err.message);
      toast.error(err?.response?.data?.error || "Failed to load existing results");
    }
  }

  useEffect(() => {
    if (!authHeader) return;
    if (!selectedCI) return;
    if (students.length === 0) return;
    loadExistingRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCI, mode, examSlot, attemptNo, students.length, token]);

  /* ========= Change handlers ========= */
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
      const r: any = { ...(next[studentId] || {}) };

      if (field === "remarks") {
        r.remarks = value;
      } else if (mode === "exam" && field === "marks") {
        const raw = (value ?? "").trim();

        if (raw === "") {
          r.marks = undefined;
          r.examOutcome = undefined;
        } else if (/^a$/i.test(raw)) {
          r.examOutcome = "ab";
          r.marks = 0;
        } else if (/^n$/i.test(raw)) {
          r.examOutcome = "not_assigned";
          r.marks = undefined;
        } else {
          const n = Number(raw);
          if (Number.isFinite(n)) {
            r.examOutcome = "scored";
            r.marks = clamp(n, maxMarks);
          }
        }
      } else {
        const raw = value === "" ? undefined : Number(value);
        let n: number | undefined = Number.isFinite(raw as number) ? (raw as number) : undefined;
        if (field === "pFirst") n = clamp(n, pMaxFirst);
        if (field === "pFinal") n = clamp(n, pMaxFinal);
        if (field === "pAssign") n = clamp(n, pMaxAssign);
        if (field === "pAttend") n = clamp(n, pMaxAttend);
        r[field] = n;

        const t = (r.pFirst || 0) + (r.pFinal || 0) + (r.pAssign || 0) + (r.pAttend || 0);
        r.practicalTotal = Number.isFinite(t) ? t : undefined;
      }

      next[studentId] = r;
      return next;
    });
  };

  const canSubmit = useMemo(() => {
    if (!selectedCI || students.length === 0) return false;
    if (mode === "exam") {
      if (!Number.isInteger(examSlot) || examSlot < 1) return false;
      if (!Number.isInteger(attemptNo) || attemptNo < 1) return false;
      if (!Number.isFinite(maxMarks) || maxMarks < 0) return false;
      return students.some((s) => {
        const r = rows[s._id] as ExamRow | undefined;
        return r?.examOutcome != null || Number.isFinite(r?.marks as number);
      });
    }
    return students.some((s) => Number.isFinite(rows[s._id]?.practicalTotal as number));
  }, [selectedCI, students, rows, mode, examSlot, attemptNo, maxMarks]);

  /* ========= Submit ========= */
  const handleSubmit = async () => {
    if (!canSubmit || saving) return;
    if (!authHeader) {
      toast.error("Not authenticated. Please login again.");
      return;
    }
    try {
      setSaving(true);
      setSaveSuccess(false);

      if (mode === "exam") {
        const payload = {
          examSlot,
          attemptNo,
          maxMarks,
          examTitle,
          rows: students
            .filter((s) => {
              const r = rows[s._id] as ExamRow | undefined;
              return r && (r.examOutcome != null || Number.isFinite(r.marks as number));
            })
            .map((s) => {
              const r = rows[s._id] as ExamRow;
              const outcome = r.examOutcome ?? (Number.isFinite(r.marks as number) ? "scored" : undefined);
              return {
                student: s._id,
                examOutcome: outcome,
                ...(outcome === "ab" ? { marks: 0 } :
                   outcome === "scored" ? { marks: r.marks } : {}),
                remarks: r.remarks || undefined,
              };
            }),
        };
        await axios.post(`${BACKEND}/result/bulk/exam/${selectedCI}`, payload, { headers: authHeader });
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
        await axios.post(`${BACKEND}/result/bulk/practical/${selectedCI}`, payload, { headers: authHeader });
      }

      setSaveSuccess(true);
      toast.success("Marks saved successfully!");

      await loadExamSlots();
      await loadExistingRows();

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  /* ========= CSV Download ========= */
  const handleDownloadCSV = () => {
    const headerExam = ["SN", "Student Name/Email", "Marks (or A/N)", "Remarks"];
    const headerPrac = ["SN", "Student Name/Email", "First(5)", "Final(5)", "Assignment(5)", "Attendance(5)", "Total(40)", "Remarks"];

    const lines: string[] = [];
    if (mode === "exam") {
      lines.push(headerExam.join(","));
      students.forEach((s, i) => {
        const r = (rows[s._id] || {}) as ExamRow;
        const name = (s.name || s.username || s.email || s._id).replace(/,/g, " ");
        const marks =
          r.examOutcome === "ab" ? "A" :
          r.examOutcome === "not_assigned" ? "N" :
          (Number.isFinite(r.marks as number) ? String(r.marks) : "");
        const remarks = (r.remarks || "").replace(/,/g, " ");
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
    const title =
      mode === "exam"
        ? `exam_slot${examSlot}_attempt${attemptNo}_CI_${selectedCI}.csv`
        : `practical_CI_${selectedCI}.csv`;
    a.href = url;
    a.download = title;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  /* ========= Print ========= */
  const handlePrint = () => {
    toast("Preparing print…", { icon: "🖨️" });
    window.print();
  };

  /* ========= Exam Session actions ========= */
  const handleOpenAttempt = (slot: number, attempt: number) => {
    setExamSlot(slot);
    setAttemptNo(attempt);
  };

  const handleCreateNewExam = () => {
    const nextSlot = examSlots.length ? Math.max(...examSlots.map(s => s.examSlot)) + 1 : 1;
    setExamSlot(nextSlot);
    setAttemptNo(1);
    setExamTitle("");
    if (!Number.isFinite(maxMarks)) setMaxMarks(30);
    toast.success(`New exam created locally (Slot ${nextSlot}, Attempt 1). Enter marks & save to persist.`);
  };

  const handleCreateNewAttempt = () => {
    const slot = examSlots.find(s => s.examSlot === examSlot);
    const nextAttempt = slot && slot.attempts.length
      ? Math.max(...slot.attempts.map(a => a.attemptNo)) + 1
      : 1;
    setAttemptNo(nextAttempt);
    toast.success(`New attempt created locally (Slot ${examSlot}, Attempt ${nextAttempt}). Save to persist.`);
  };

  const filledRows = students.filter(s => {
    const r = rows[s._id] as ExamRow & PracticalRow;
    if (mode === "exam") return (r as ExamRow)?.examOutcome != null || Number.isFinite((r as ExamRow)?.marks as number);
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

  const selectedCILabel =
    selectedCI ? ciLabel(courseInstances.find(ci => ci._id === selectedCI) || ({} as CourseInstanceLite)) : "None";

  function examOutcomeClasses(
    outcome?: "scored" | "ab" | "not_assigned"
  ) {
    if (outcome === "ab") {
      return "bg-red-50 border-red-300 text-red-700 placeholder-red-400 focus:ring-red-500 focus:border-red-500";
    }
    if (outcome === "scored") {
      return "bg-green-50 border-green-300 text-green-700 focus:ring-green-500 focus:border-green-500";
    }
    // not_assigned or empty → normal look
    return "";
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Toaster */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 5000,
          style: { fontSize: "14px" },
          success: { style: { background: "#16a34a", color: "white" } },
          error: { style: { background: "#dc2626", color: "white" } },
        }}
      />

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-block { display: block !important; }
          .print-break-inside-avoid { break-inside: avoid; }
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8 no-print">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ClipboardList className="h-6 w-6 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Internal Results Entry</h1>
          </div>
          <p className="text-slate-600">Manage and submit examination and practical marks for your courses</p>
        </div>

        {/* Configuration Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-8 no-print">
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

              {/* Exam Slots + Attempts (list) */}
              {mode === "exam" && (
                <div className="lg:col-span-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Exam Slots & Attempts</label>
                  <div className="flex flex-col gap-2">
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="max-h-64 overflow-auto divide-y divide-slate-100">
                        {loadingExams && (
                          <div className="flex items-center gap-2 px-3 py-2 text-slate-600">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading exams…
                          </div>
                        )}
                        {!loadingExams && examSlots.length === 0 && (
                          <div className="px-3 py-3 text-slate-500">No exam slots yet. Create one below.</div>
                        )}
                        {!loadingExams && examSlots.map((slot) => (
                          <div key={slot.examSlot} className="px-3 py-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                                  examSlot === slot.examSlot ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                                }`}>
                                  {slot.examSlot}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-slate-900 truncate">
                                    {slot.title || `Exam-${slot.examSlot}`}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    Max {slot.maxMarks ?? "—"} • {slot.totalCount} record{slot.totalCount === 1 ? "" : "s"}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => { setExamSlot(slot.examSlot); if (slot.attempts[0]) setAttemptNo(slot.attempts[0].attemptNo); }}
                                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                                title="Select this exam slot"
                              >
                                <FolderOpen className="h-4 w-4" />
                                Open
                              </button>
                            </div>

                            {/* attempts pills */}
                            <div className="mt-2 flex flex-wrap gap-2">
                              {slot.attempts.map((a) => (
                                <button
                                  key={a.attemptNo}
                                  onClick={() => handleOpenAttempt(slot.examSlot, a.attemptNo)}
                                  className={`px-2 py-1 rounded text-xs border ${
                                    examSlot === slot.examSlot && attemptNo === a.attemptNo
                                      ? "bg-blue-600 text-white border-blue-600"
                                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                                  }`}
                                  title={`Open Attempt ${a.attemptNo}`}
                                >
                                  Attempt {a.attemptNo} <span className="opacity-70">({a.count})</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-500">
                        Current: Slot <span className="font-semibold text-slate-700">{examSlot}</span> • Attempt <span className="font-semibold text-slate-700">{attemptNo}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCreateNewAttempt}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
                          title="Create a new attempt for current slot"
                        >
                          <PlusCircle className="h-4 w-4" />
                          New Attempt
                        </button>
                        <button
                          onClick={handleCreateNewExam}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                          title="Create a new exam slot"
                        >
                          <PlusCircle className="h-4 w-4" />
                          New Exam
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Config */}
              {mode === "exam" ? (
                <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Exam Slot</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={examSlot}
                      onChange={(e) => setExamSlot(Math.max(1, Number(e.target.value || 1)))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Attempt Number</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={attemptNo}
                      onChange={(e) => setAttemptNo(Math.max(1, Number(e.target.value || 1)))}
                    />
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
                      placeholder={`Exam-${examSlot}`}
                      value={examTitle}
                      onChange={(e) => setExamTitle(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-4 text-xs text-slate-500">
                    Tip: In the <b>Marks</b> cell you can type <b>A</b> for Absent (saves as 0), <b>N</b> for Not Assigned, or a number 0–{maxMarks}.
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
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between no-print">
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
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors duration-200"
                title="Print this page"
              >
                <Printer className="h-4 w-4" />
                Print
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
            <div className="px-6 py-2 bg-slate-50 border-b border-slate-200 no-print">
              <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                <span>Progress</span>
                <span>{Math.round((filledRows / students.length) * 100)}% complete</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(filledRows / students.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Table Content */}
          <div className="overflow-hidden">
            {/* Table Headers */}
            {mode === "exam" ? (
              <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-600">
                <div className="col-span-4 p-4">Student Information</div>
                <div className="col-span-2 p-4 text-center">Marks (/{maxMarks} or A/N)</div>
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
                const r = rows[s._id] as ExamRow & PracticalRow || {};
                const displayName = s.name || s.username || s.email || s._id.slice(-6);
                const hasData = mode === "exam"
                  ? ((r as ExamRow)?.examOutcome != null || Number.isFinite((r as any).marks as number))
                  : Number.isFinite((r as any).practicalTotal as number);

                const setRef = (field: string) => (el: HTMLInputElement | null) => {
                  if (!cellRefs.current[s._id]) cellRefs.current[s._id] = {};
                  cellRefs.current[s._id][field] = el;
                };

                // display value for exam marks: A / N / number
                const examDisplayVal =
                  (r as ExamRow)?.examOutcome === "ab" ? "A" :
                  (r as ExamRow)?.examOutcome === "not_assigned" ? "N" :
                  ((r as ExamRow)?.marks ?? "");

                return (
                  <div
                    className={`grid grid-cols-12 border-b border-slate-100 hover:bg-slate-50 transition-colors duration-150 ${hasData ? "bg-green-50/50" : ""}`}
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
                            type="text" /* allow A/N */
                            className={[
                              "w-full border rounded-lg px-3 py-2 text-center",
                              "focus:ring-2 focus:border-transparent",
                              "bg-white border-slate-300", // base
                              examOutcomeClasses((r as ExamRow)?.examOutcome), // color by outcome
                            ].join(" ")}
                            value={mode === "exam" ? (examDisplayVal as any) : ""}
                            onChange={(e) => handleChangeRow(s._id, "marks", e.target.value)}
                            placeholder={`0 - ${maxMarks} or A/N`}
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
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6 print-break-inside-avoid">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full no-print"></div>
                <span className="text-slate-600">
                  Selected:{" "}
                  <span className="font-mono text-slate-800">
                    {selectedCI ? selectedCILabel : "None"}
                  </span>
                </span>
              </div>

              {mode === "exam" ? (
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-600">
                    Exam Mode • Slot {examSlot} • Attempt {attemptNo} • Max {maxMarks} marks • Use A=Absent, N=Not Assigned
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

            <div className="no-print">
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
    </div>
  );
}
