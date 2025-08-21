// src/app/admin/report/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GraduationCap,
  Building2,
  Users,
  Calendar,
  ChevronDown,
  AlertCircle,
  Loader2,
  Download,
  Printer,
  FlaskConical,
  Info,
} from "lucide-react";

/* ================= CONFIG ================= */
const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");
const FACULTY_BASE = "/faculty-api";
const BATCH_BASE = "/batch-api";
const SEM_BASE = "/sem-api/"; // change to "" if mounted at root
const RESULT_BASE = "/result";

/* ================= TYPES ================= */
type Faculty = {
  _id: string;
  name: string;
  code?: string;
  type: "semester" | "year" | "yearly";
  totalSemestersOrYears?: number;
  programLevel?: string;
};
type Batch = {
  _id: string;
  batchname: string;
  faculty: string;
  currentSemesterOrYear?: number;
};
type SemOrYear = {
  _id: string;
  name?: string;
  semesterNumber?: number;
  yearNumber?: number;
};
type UserLite = { _id: string; name?: string; username?: string; email?: string; role?: string };
type ColumnCI = {
  ciId: string;
  courseCode?: string;
  courseName?: string;
  teacher?: UserLite;
  examTitle: string | null;
  maxMarks: number | null;
  passMarks: number | null;
};
type Cell = {
  _id: string | null;
  examTitle: string | null;
  maxMarks: number | null;
  passMarks: number | null;
  marks: number | null;
  examOutcome: "scored" | "ab" | "not_assigned";
  verified: boolean;
  locked: boolean;
  remarks: string | null;
};
type LedgerRow = {
  student: { _id: string; name?: string; username?: string; email?: string };
  cells: Record<string, Cell>;
};
type LedgerResponse = {
  ok: boolean;
  meta: { batch: string; type: "semester" | "yearly"; level: number; examSlot: number; attemptNo: number; examTitle?: string };
  courseInstances: Array<{ _id: string; course?: any; teacher?: UserLite }>;
  columns: ColumnCI[];
  rows: LedgerRow[];
};
type LevelOption = { value: number; label: string; id?: string };

type ExamSessionMeta = {
  ciId: string;
  examSlot?: number | null;
  attemptNo?: number | null;
  examTitle?: string | null;
};

type PracticalRecord = {
  _id: string;
  student?: UserLite;
  pFirst?: number;
  pFinal?: number;
  pAssign?: number;
  pAttend?: number;
  practicalTotal?: number;
  passMarks?: number;
  remarks?: string;
  verifiedBy?: UserLite | null;
  lockedByAdmin?: boolean;
};

type PracticalGroup = {
  ciId: string;
  courseCode?: string;
  courseName?: string;
  teacher?: UserLite;
  records: PracticalRecord[];
};

type SearchMode = "title" | "slot";

/* ================= HELPERS ================= */
const normalizeType = (t?: Faculty["type"]): "semester" | "yearly" =>
  t === "year" ? "yearly" : (t as any) === "yearly" ? "yearly" : "semester";
const levelWord = (t: "semester" | "yearly") => (t === "yearly" ? "Year" : "Semester");

const toInt = (v: any) => {
  if (v === null || v === undefined) return undefined;
  const s = typeof v === "string" ? v.trim() : v;
  if (s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

const getToken = () =>
  typeof window !== "undefined"
    ? localStorage.getItem("token_admin") || sessionStorage.getItem("token_admin")
    : null;

const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

const ssGet = (k: string) => (typeof window !== "undefined" ? sessionStorage.getItem(k) || "" : "");
const ssSet = (k: string, v: string) => {
  if (typeof window !== "undefined") sessionStorage.setItem(k, v);
};

const studentLabel = (s?: { name?: string; username?: string; email?: string } | null) =>
  s?.username || s?.email || s?.name || "—";

/* ================= PAGE ================= */
export default function AdminResultsOnePage() {
  /* -------- selection state -------- */
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [defs, setDefs] = useState<SemOrYear[]>([]);
  const [loadingFac, setLoadingFac] = useState(true);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [loadingDefs, setLoadingDefs] = useState(false);

  const [facultyId, setFacultyId] = useState<string>(ssGet("sel_faculty"));
  const [batchId, setBatchId] = useState<string>(ssGet("sel_batch"));
  const [level, setLevel] = useState<number | "">(ssGet("sel_level") ? Number(ssGet("sel_level")) : "");

  // current faculty meta
  const faculty = useMemo(() => faculties.find((f) => f._id === facultyId) || null, [faculties, facultyId]);
  const fType = normalizeType(faculty?.type);
  const word = levelWord(fType);
  const totalLevels = toInt(faculty?.totalSemestersOrYears) ?? (fType === "yearly" ? 4 : 8);

  // exam title / attempt / mode / slot
  const [examTitle, setExamTitle] = useState<string>(ssGet("sel_examTitle") || "");
  const [attemptNo, setAttemptNo] = useState<string>(ssGet("sel_attemptNo") || "1");
  const [mode, setMode] = useState<SearchMode>("title");
  const [examSlot, setExamSlot] = useState<string>(ssGet("sel_examSlot") || "");

  useEffect(() => { ssSet("sel_examTitle", String(examTitle || "")); }, [examTitle]);
  useEffect(() => { ssSet("sel_attemptNo", String(attemptNo || "")); }, [attemptNo]);
  useEffect(() => { ssSet("sel_examSlot", String(examSlot || "")); }, [examSlot]);

  // data to derive titles/attempts
  const [ciIds, setCiIds] = useState<string[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessions, setSessions] = useState<ExamSessionMeta[]>([]);

  // practical
  const [showPractical, setShowPractical] = useState(true);
  const [loadingPractical, setLoadingPractical] = useState(false);
  const [practicals, setPracticals] = useState<PracticalGroup[]>([]);

  // derived options for titles and attempts
  const titleOptions = useMemo(() => {
    const titles = new Set<string>();
    sessions.forEach((s) => {
      const t = (s.examTitle || "").trim();
      if (t) titles.add(t);
    });
    return Array.from(titles).sort((a, b) => a.localeCompare(b));
  }, [sessions]);

  // auto-fallback: if no titles, switch to SLOT mode
  useEffect(() => {
    if (titleOptions.length === 0) setMode("slot");
  }, [titleOptions.length]);

  const attemptsForSelectedTitle = useMemo<number[]>(() => {
    if (!examTitle) return [];
    const set = new Set<number>();
    sessions.forEach((s) => {
      if ((s.examTitle || "").trim().toLowerCase() === examTitle.trim().toLowerCase()) {
        // treat missing attempt as 1
        const n = toInt(s.attemptNo ?? 1);
        if (Number.isInteger(n)) set.add(n!);
      }
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [sessions, examTitle]);

  // "ready" when we can request ledger
  const readyTitle = Boolean(facultyId && batchId && level && examTitle && Number(attemptNo) >= 1);
  const readySlot  = Boolean(facultyId && batchId && level && Number(examSlot) >= 1 && Number(attemptNo) >= 1);
  const ready = mode === "title" ? readyTitle : readySlot;

  /* -------- load faculties/batches/defs -------- */
  useEffect(() => {
    (async () => {
      try {
        setLoadingFac(true);
        const r = await fetch(`${BACKEND}${FACULTY_BASE}/facultycode`, { headers: { ...(authHeaders() || {}) } });
        const data = await r.json();
        const list: Faculty[] = Array.isArray(data?.faculties) ? data.faculties : [];
        setFaculties(list);
        if (!facultyId && list.length) {
          setFacultyId(list[0]._id);
          ssSet("sel_faculty", list[0]._id);
        }
      } finally {
        setLoadingFac(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // reset on faculty change
    setBatchId("");
    setLevel("");
    setExamTitle("");
    setAttemptNo("1");
    setExamSlot("");
    setMode("title");
    ssSet("sel_faculty", facultyId || "");
    ssSet("sel_examTitle", "");
    ssSet("sel_attemptNo", "1");
    ssSet("sel_examSlot", "");

    if (!facultyId) {
      setBatches([]);
      setDefs([]);
      setCiIds([]);
      setSessions([]);
      return;
    }

    (async () => {
      try {
        setLoadingBatch(true);
        const r = await fetch(
          `${BACKEND}${BATCH_BASE}/batchcode?faculty=${encodeURIComponent(facultyId)}`,
          { headers: { ...(authHeaders() || {}) } }
        );
        const data = await r.json();
        const list: Batch[] = Array.isArray(data?.batches) ? data.batches : [];
        setBatches(list);
        if (list.length) {
          setBatchId(list[0]._id);
          ssSet("sel_batch", list[0]._id);
        }
      } finally {
        setLoadingBatch(false);
      }
    })();

    (async () => {
      try {
        setLoadingDefs(true);
        const r = await fetch(
          `${BACKEND}${SEM_BASE}semesterOrYear?faculty=${encodeURIComponent(facultyId)}&limit=100`,
          { headers: { ...(authHeaders() || {}) } }
        );
        const data = await r.json();
        const list: SemOrYear[] = Array.isArray(data?.semesters) ? data.semesters : [];
        setDefs(list);
      } finally {
        setLoadingDefs(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facultyId]);

  // prefill level from batch.currentSemesterOrYear when batch changes
  useEffect(() => {
    const b = batches.find((x) => x._id === batchId);
    const current = toInt(b?.currentSemesterOrYear);
    setLevel(current || "");
    ssSet("sel_batch", batchId || "");
    ssSet("sel_level", current ? String(current) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  // Level options (ensure current exists even if defs don’t include it)
  const levelOptions: LevelOption[] = useMemo<LevelOption[]>(() => {
    const items = defs
      .map((d) => {
        const n = fType === "yearly" ? toInt(d.yearNumber) : toInt(d.semesterNumber);
        if (!Number.isInteger(n)) return null;
        return { value: n as number, label: d.name || `${word} ${n}`, id: d._id };
      })
      .filter(Boolean) as LevelOption[];

    if (items.length) {
      const seen = new Set<number>();
      const sorted = items.sort((a, b) => a.value - b.value).filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
      const cur = toInt(batches.find((b) => b._id === batchId)?.currentSemesterOrYear);
      if (Number.isInteger(cur) && !sorted.some((o) => o.value === cur)) {
        sorted.unshift({ value: cur!, label: `${word} ${cur} (current)` });
      }
      return sorted;
    }

    // fallback to total count
    const cur = toInt(batches.find((b) => b._id === batchId)?.currentSemesterOrYear);
    const base = Array.from({ length: totalLevels }, (_, i) => ({ value: i + 1, label: `${word} ${i + 1}` } as LevelOption));
    if (Number.isInteger(cur) && !base.some((o) => o.value === cur)) {
      base.unshift({ value: cur!, label: `${word} ${cur} (current)` });
    }
    return base;
  }, [defs, fType, totalLevels, word, batches, batchId]);

  useEffect(() => {
    if (facultyId && batchId && (level === "" || level == null) && levelOptions.length > 0) {
      setLevel(levelOptions[0].value);
      ssSet("sel_level", String(levelOptions[0].value));
    }
  }, [facultyId, batchId, level, levelOptions]);

  /* -------- scope: fetch course instances, then exam sessions per CI -------- */
  useEffect(() => {
    const loadScopeAndSessions = async () => {
      setSessions([]);
      setCiIds([]);
      if (!facultyId || !batchId || !level) return;

      try {
        const q = new URLSearchParams({
          batch: String(batchId),
          type: fType === "yearly" ? "year" : "semester",
          level: String(level),
        });
        const r = await fetch(`${BACKEND}${RESULT_BASE}/admin/by-scope?${q.toString()}`, {
          headers: { ...(authHeaders() || {}) },
        });
        const j = await r.json();
        const cis: Array<{ _id: string }> = Array.isArray(j?.courseInstances) ? j.courseInstances : [];
        const ids = cis.map((c) => c._id);
        setCiIds(ids);

        if (ids.length === 0) {
          setSessions([]);
          return;
        }

        setLoadingSessions(true);
        const arr = await Promise.all(
          ids.map(async (id) => {
            const rs = await fetch(`${BACKEND}${RESULT_BASE}/admin/exam-sessions/${id}`, {
              headers: { ...(authHeaders() || {}) },
            });
            const js = await rs.json();
            const list: Array<{ examSlot?: number; attemptNo?: number; examTitle?: string }> =
              Array.isArray(js?.sessions) ? js.sessions : [];
            return list.map((s) => ({
              ciId: id,
              examSlot: s.examSlot ?? null,
              attemptNo: s.attemptNo ?? null,
              examTitle: s.examTitle ?? "",
            }));
          })
        );

        setSessions(arr.flat());
      } catch (e) {
        console.error("Failed to load scope/sessions:", e);
        setSessions([]);
      } finally {
        setLoadingSessions(false);
      }
    };

    loadScopeAndSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facultyId, batchId, level, fType]);

  // When examTitle changes, ensure attempt is valid (title mode)
  useEffect(() => {
    if (!examTitle) return;
    const attempts = attemptsForSelectedTitle;
    if (attempts.length === 0) setAttemptNo("1");
    else if (!attempts.includes(Number(attemptNo))) setAttemptNo(String(attempts[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examTitle]);

  /* ================= LEDGER ================= */
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [columns, setColumns] = useState<ColumnCI[]>([]);
  const [rows, setRows] = useState<LedgerRow[]>([]);

  const isAbortError = (e: any, signal?: AbortSignal) =>
    signal?.aborted ||
    e?.name === "AbortError" ||
    e?.code === 20 ||
    (typeof DOMException !== "undefined" && e instanceof DOMException && e.name === "AbortError");

  const loadLedger = async (signal?: AbortSignal, overrideLevel?: number) => {
    if (!facultyId || !batchId || (!level && !overrideLevel)) return;
    try {
      if (!signal?.aborted) {
        setLoadingLedger(true);
        setErrorText("");
      }

      const att = parseInt(String(attemptNo).trim(), 10);
      if (!Number.isInteger(att) || att < 1) {
        if (!signal?.aborted) {
          setErrorText("Please pick a valid Attempt (≥ 1).");
          setLoadingLedger(false);
        }
        return;
      }

      const lvlToUse = overrideLevel ?? level;

      // Build query for server:
      const qp: Record<string, string> = {
        batch: String(batchId),
        type: fType === "yearly" ? "year" : "semester",
        level: String(lvlToUse),
        attemptNo: String(att),
      };
      if (mode === "title") {
        if (!examTitle) {
          if (!signal?.aborted) {
            setErrorText("Pick an Exam Title or switch to By Slot.");
            setLoadingLedger(false);
          }
          return;
        }
        qp.examTitle = String(examTitle);
      } else {
        const slot = parseInt(String(examSlot).trim(), 10);
        if (!Number.isInteger(slot) || slot < 1) {
          if (!signal?.aborted) {
            setErrorText("Enter a valid Exam Slot (≥ 1) or switch back to Title mode.");
            setLoadingLedger(false);
          }
          return;
        }
        qp.examSlot = String(slot);
      }

      const r = await fetch(`${BACKEND}${RESULT_BASE}/admin/ledger?${new URLSearchParams(qp).toString()}`, {
        headers: { ...(authHeaders() || {}) },
        signal,
      });

      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        let msg = txt || `Request failed (${r.status})`;
        try {
          const j = JSON.parse(txt);
          msg = j?.error || j?.message || msg;
        } catch {}
        if (r.status === 401 || r.status === 403) msg = `${msg} — are you logged in as admin? (Missing/expired token)`;
        throw new Error(msg);
      }

      const data: LedgerResponse = await r.json();
      if (!data?.ok) throw new Error((data as any)?.error || "Failed to load ledger");

      if (!signal?.aborted) {
        setColumns(data.columns || []);
        setRows(data.rows || []);
      }
    } catch (e: any) {
      if (isAbortError(e, signal)) return;
      console.error("Ledger load failed:", e);
      if (!signal?.aborted) {
        setColumns([]);
        setRows([]);
        setErrorText(e?.message || "Failed to load ledger");
      }
    } finally {
      if (!signal?.aborted) setLoadingLedger(false);
    }
  };

  // auto-load when inputs change
  useEffect(() => {
    const ac = new AbortController();
    if (mode === "title" && examTitle) loadLedger(ac.signal);
    if (mode === "slot" && Number(examSlot) >= 1 && Number(attemptNo) >= 1) loadLedger(ac.signal);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facultyId, batchId, level, fType, mode, examTitle, examSlot, attemptNo, sessions]);

  /* ===== derived totals ===== */
  type RowTotals = { counted: number; sumMarks: number; sumMax: number; final: "Pass" | "Fail" | "NA" };
  const rowTotals: Record<string, RowTotals> = useMemo(() => {
    const out: Record<string, RowTotals> = {};
    for (const r of rows) {
      let counted = 0, sumMarks = 0, sumMax = 0, failed = false;
      for (const col of columns) {
        const cell = r.cells[col.ciId];
        if (!cell) continue;
        if (cell.examOutcome === "not_assigned") continue;
        counted += 1;
        const max = Number(col.maxMarks ?? cell.maxMarks ?? 0);
        const pass = Number(col.passMarks ?? cell.passMarks ?? 0);
        if (cell.examOutcome === "ab") {
          sumMax += Number.isFinite(max) ? max : 0;
          failed = true;
        } else {
          const m = Number(cell.marks ?? 0);
          sumMarks += Number.isFinite(m) ? m : 0;
          sumMax += Number.isFinite(max) ? max : 0;
          if (Number.isFinite(m) && Number.isFinite(pass) && m < pass) failed = true;
        }
      }
      const final: RowTotals["final"] = counted === 0 ? "NA" : failed ? "Fail" : "Pass";
      out[r.student._id] = { counted, sumMarks, sumMax, final };
    }
    return out;
  }, [rows, columns]);

  /* ===== practical: load & render ===== */
  const loadPracticals = async (overrideLevel?: number) => {
    if (!facultyId || !batchId || (!level && !overrideLevel)) return;
    setLoadingPractical(true);
    try {
      const lvlToUse = overrideLevel ?? level;
      const q = new URLSearchParams({
        batch: String(batchId),
        type: fType === "yearly" ? "year" : "semester",
        level: String(lvlToUse),
        kind: "practical",
      });
      const r = await fetch(`${BACKEND}${RESULT_BASE}/admin/by-scope?${q.toString()}`, {
        headers: { ...(authHeaders() || {}) },
      });
      if (!r.ok) throw new Error(`Practical fetch failed (${r.status})`);
      const data = await r.json();

      const grouped: Array<{
        ciId: string;
        course?: any;
        teacher?: UserLite;
        records: any[];
      }> = Array.isArray(data?.grouped) ? data.grouped : [];

      const out: PracticalGroup[] = grouped.map((g) => ({
        ciId: g.ciId,
        courseCode: g.course?.code,
        courseName: g.course?.name,
        teacher: g.teacher,
        records: (g.records || []).map((d: any) => ({
          _id: d?._id,
          student: d?.student,
          pFirst: d?.pFirst,
          pFinal: d?.pFinal,
          pAssign: d?.pAssign,
          pAttend: d?.pAttend,
          practicalTotal: d?.practicalTotal,
          passMarks: d?.passMarks,
          remarks: d?.remarks,
          verifiedBy: d?.verifiedBy || null,
          lockedByAdmin: !!d?.lockedByAdmin,
        })),
      }));

      setPracticals(out);
    } catch (e) {
      console.error(e);
      setPracticals([]);
    } finally {
      setLoadingPractical(false);
    }
  };

  useEffect(() => {
    if (showPractical && facultyId && batchId && level) loadPracticals();
    else setPracticals([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPractical, facultyId, batchId, level, fType]);

  /* ===== render helpers ===== */
  const outcomeBadge = (o: Cell["examOutcome"]) =>
    o === "ab" ? "bg-rose-50 text-rose-700 border-rose-200"
      : o === "not_assigned" ? "bg-slate-50 text-slate-500 border-slate-200"
        : "bg-emerald-50 text-emerald-700 border-emerald-200";

  const cellDisplay = (cell: Cell, max: number | null) => {
    if (cell.examOutcome === "ab") return "A";
    if (cell.examOutcome === "not_assigned") return "–";
    if (cell.marks == null) return "";
    return `${cell.marks}${Number.isFinite(max as any) ? ` / ${max}` : ""}`;
  };

  const exportCSVExam = () => {
    const namePart = mode === "title" ? (examTitle || "exam") : `slot${examSlot || "X"}`;
    const head = ["SN", "Student", ...columns.map(c => `${c.courseCode || ""} ${c.courseName || ""}`.trim()), "Counted", "Total", "Max", "Final"];
    const lines = [head.join(",")];
    rows.forEach((r, i) => {
      const t = rowTotals[r.student._id] || { counted: 0, sumMarks: 0, sumMax: 0, final: "NA" as const };
      const cells = columns.map(c => {
        const cell = r.cells[c.ciId];
        if (!cell) return "";
        if (cell.examOutcome === "ab") return "A";
        if (cell.examOutcome === "not_assigned") return "-";
        return Number.isFinite(cell.marks as any) ? String(cell.marks) : "";
      });
      lines.push([
        i + 1,
        (r.student.name || r.student.username || r.student.email || r.student._id).replace(/,/g, " "),
        ...cells,
        t.counted,
        t.sumMarks,
        t.sumMax,
        t.final,
      ].join(","));
    });
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger_${namePart.replace(/\s+/g, "_")}_attempt${attemptNo}_batch_${batchId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSVPractical = (grp: PracticalGroup) => {
    const head = ["SN","Student","First","Final","Assign","Attend","Total","Pass","Verified","Locked","Remarks"];
    const lines = [head.join(",")];
    (grp.records || []).forEach((r, i) => {
      lines.push([
        i + 1,
        (r.student?.name || r.student?.username || r.student?.email || r.student?._id || "").replace(/,/g, " "),
        r.pFirst ?? "",
        r.pFinal ?? "",
        r.pAssign ?? "",
        r.pAttend ?? "",
        r.practicalTotal ?? "",
        r.passMarks ?? "",
        r.verifiedBy ? "Yes" : "No",
        r.lockedByAdmin ? "Yes" : "No",
        (r.remarks || "").replace(/,/g, " "),
      ].join(","));
    });
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `practical_${(grp.courseCode || grp.courseName || grp.ciId).toString().replace(/\s+/g,"_")}_batch_${batchId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doPrint = () => window.print();

  // Click helpers that prefer the current level (auto-apply at fetch time)
  const currentLevel = toInt(batches.find((b) => b._id === batchId)?.currentSemesterOrYear);
  const fetchExamClick = () => {
    const lvl = Number.isInteger(currentLevel) ? (currentLevel as number) : (typeof level === "number" ? level : undefined);
    loadLedger(undefined, lvl);
  };
  const fetchPracticalClick = () => {
    setShowPractical(true);
    const lvl = Number.isInteger(currentLevel) ? (currentLevel as number) : (typeof level === "number" ? level : undefined);
    loadPracticals(lvl);
  };

  /* ================= RENDER ================= */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-block { display: block !important; }
          .print-break-inside-avoid { break-inside: avoid; }
          .scroll-area { max-height: none !important; overflow: visible !important; }
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <GraduationCap className="h-6 w-6 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Admin • Exam Ledger</h1>
          </div>
          <p className="text-slate-600">
            Choose a <span className="font-medium">mode</span> below. With <span className="font-medium">By Title</span> we auto-resolve the slot on the server.{" "}
            With <span className="font-medium">By Slot</span> you enter the slot directly. “A” = Absent; “–” = Not Assigned.
          </p>
        </div>

        {/* Card: Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-slate-600" />
              Configuration
            </h2>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Faculty */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Faculty</label>
              <div className="relative">
                <select
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
                  value={facultyId}
                  onChange={(e) => setFacultyId(e.target.value)}
                >
                  {loadingFac && <option key="fac-loading" value="">Loading faculties…</option>}
                  {!loadingFac && faculties.length === 0 && <option key="fac-none" value="">No faculties found</option>}
                  {!loadingFac &&
                    faculties.map((f) => (
                      <option key={f._id} value={f._id}>
                        {f.name} {f.code ? `• ${f.code}` : ""} • {normalizeType(f.type) === "yearly" ? "Year-based" : "Semester-based"}
                      </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-3 top-3 h-5 w-5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Batch */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Batch</label>
              <div className="relative">
                <select
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer disabled:bg-slate-100 disabled:text-slate-500"
                  disabled={!facultyId || loadingBatch}
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                >
                  {!facultyId && <option key="batch-need-faculty" value="">Select a faculty first</option>}
                  {facultyId && loadingBatch && <option key="batch-loading" value="">Loading batches…</option>}
                  {facultyId && !loadingBatch && batches.length === 0 && <option key="batch-none" value="">No batches found</option>}
                  {facultyId &&
                    !loadingBatch &&
                    batches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.batchname}
                      </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-3 top-3 h-5 w-5 text-slate-400 pointer-events-none" />
              </div>

              {/* Current level hint */}
              <div className="mt-3 text-sm text-slate-600 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-500" />
                {batchId ? (
                  <>
                    Current {word}:{" "}
                    <span className="font-medium text-slate-900 ml-1">
                      {toInt(batches.find((b) => b._id === batchId)?.currentSemesterOrYear) ?? "—"}
                    </span>
                  </>
                ) : (
                  "Current level: —"
                )}
              </div>
            </div>

            {/* Level */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{word}</label>
              <div className="relative">
                <select
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer disabled:bg-slate-100 disabled:text-slate-500"
                  disabled={!facultyId}
                  value={String(level)}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : "";
                    setLevel(v);
                    ssSet("sel_level", v ? String(v) : "");
                  }}
                >
                  {!facultyId && <option key="level-need-faculty" value="">Select a faculty first</option>}
                  {facultyId && (
                    <>
                      <option key="level-prompt" value="">Select {word.toLowerCase()}</option>
                      {levelOptions.map((o) => (
                        <option key={`lvl-${o.id ?? o.value}`} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <ChevronDown className="absolute right-3 top-3 h-5 w-5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* MODE SWITCH (Title / Slot) */}
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-slate-700 mb-2">Search mode</label>
              <div className="inline-flex rounded-lg overflow-hidden border">
                <button
                  type="button"
                  onClick={() => setMode("title")}
                  className={`px-3 py-2 text-sm ${mode === "title" ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
                >
                  By Title
                </button>
                <button
                  type="button"
                  onClick={() => setMode("slot")}
                  className={`px-3 py-2 text-sm border-l ${mode === "slot" ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
                >
                  By Slot
                </button>
              </div>
              {titleOptions.length === 0 && (
                <div className="mt-2 text-xs text-amber-700 bg-amber-50 inline-flex items-center gap-2 px-2 py-1 rounded">
                  <Info className="h-3.5 w-3.5" />
                  No exam titles found in this scope. Switched to “By Slot”.
                </div>
              )}
            </div>

            {/* Exam Title (title mode) */}
            {mode === "title" && (
              <>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Exam Title</label>
                  <div className="relative">
                    <select
                      className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer disabled:bg-slate-100 disabled:text-slate-500"
                      disabled={!facultyId || !batchId || !level || loadingSessions}
                      value={examTitle}
                      onChange={(e) => setExamTitle(e.target.value)}
                    >
                      {!facultyId || !batchId || !level ? (
                        <option value="">Select faculty, batch, and {word.toLowerCase()} first</option>
                      ) : loadingSessions ? (
                        <option value="">Loading exam titles…</option>
                      ) : titleOptions.length === 0 ? (
                        <option value="">No exam titles found in this scope</option>
                      ) : (
                        <>
                          <option value="">Select an exam</option>
                          {titleOptions.map((t) => (
                            <option key={`title-${t}`} value={t}>{t}</option>
                          ))}
                        </>
                      )}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 h-5 w-5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Attempt (title mode) */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Attempt</label>
                  <div className="relative">
                    <select
                      className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer disabled:bg-slate-100 disabled:text-slate-500"
                      disabled={!examTitle}
                      value={attemptNo}
                      onChange={(e) => setAttemptNo(e.target.value.replace(/[^\d]/g, "") || "1")}
                    >
                      {!examTitle ? (
                        <option value="">Select exam title first</option>
                      ) : attemptsForSelectedTitle.length === 0 ? (
                        <option value="1">1</option>
                      ) : (
                        attemptsForSelectedTitle.map((a) => (
                          <option key={`att-${a}`} value={String(a)}>{a}</option>
                        ))
                      )}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 h-5 w-5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </>
            )}

            {/* Slot + Attempt (slot mode) */}
            {mode === "slot" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Exam Slot</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3"
                    value={examSlot}
                    onChange={(e) => setExamSlot(e.target.value.replace(/[^\d]/g, ""))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Attempt</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3"
                    value={attemptNo}
                    onChange={(e) => setAttemptNo(e.target.value.replace(/[^\d]/g, ""))}
                  />
                </div>
              </>
            )}
          </div>

          {/* Footer status + ACTION BUTTONS */}
          <div className="px-6 py-4 border-t border-slate-200 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-slate-600">
              <Users className="h-4 w-4" />
              <span className="text-sm">
                {faculty
                  ? `${faculty.name} • ${normalizeType(faculty.type) === "yearly" ? "Year-based" : "Semester-based"} • Total ${word.toLowerCase()}s: ${faculty.totalSemestersOrYears ?? (normalizeType(faculty.type) === "yearly" ? 4 : 8)}`
                  : "No faculty selected"}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-3">
              {!ready && (
                <div className="inline-flex items-center gap-2 text-amber-700 bg-amber-50 px-3 py-2 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {mode === "title"
                    ? `Select faculty, batch, ${word.toLowerCase()}, exam title & attempt`
                    : `Select faculty, batch, ${word.toLowerCase()}, slot & attempt`}
                </div>
              )}

              {/* Fetch Exam */}
              <button
                onClick={fetchExamClick}
                disabled={!ready || loadingLedger}
                className={`px-3 py-2 rounded-lg inline-flex items-center gap-2 border ${ready ? "bg-white hover:bg-slate-50" : "bg-slate-100 text-slate-400"}`}
                title="Fetch exam ledger"
              >
                {loadingLedger ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
                Fetch Exam
              </button>

              {/* Fetch Practical */}
              <button
                onClick={fetchPracticalClick}
                disabled={loadingPractical || !facultyId || !batchId || !level}
                className={`px-3 py-2 rounded-lg inline-flex items-center gap-2 border ${facultyId && batchId && level ? "bg-white hover:bg-slate-50" : "bg-slate-100 text-slate-400"}`}
                title="Fetch practical marks"
              >
                {loadingPractical ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                Fetch Practical
              </button>

              <button
                onClick={exportCSVExam}
                disabled={rows.length === 0}
                className="px-3 py-2 rounded-lg inline-flex items-center gap-2 border bg-white hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
              <button
                onClick={doPrint}
                disabled={rows.length === 0}
                className="px-3 py-2 rounded-lg inline-flex items-center gap-2 border bg-white hover:bg-slate-50 disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
            </div>
          </div>
        </div>

        {/* States */}
        {loadingLedger && (
          <div className="py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-3" />
            <div className="text-slate-600">Loading ledger…</div>
          </div>
        )}
        {!loadingLedger && errorText && (
          <div className="mt-6 p-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-700">
            {errorText}
          </div>
        )}
        {!loadingLedger && !errorText && rows.length === 0 && (
          <div className="mt-6 py-6 text-center text-slate-600">
            {columns.length === 0
              ? "No subjects found for this selection."
              : "No students found in this batch (or no records match this selection)."}
          </div>
        )}

        {/* Ledger */}
        {!loadingLedger && !errorText && rows.length > 0 && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-sm text-slate-700">
              {mode === "title" ? (
                <>Exam <span className="font-semibold">{examTitle}</span> • Attempt <span className="font-semibold">{attemptNo}</span></>
              ) : (
                <>Slot <span className="font-semibold">{examSlot}</span> • Attempt <span className="font-semibold">{attemptNo}</span></>
              )}
              {" • "}Columns: <span className="font-semibold">{columns.length}</span> • Students: <span className="font-semibold">{rows.length}</span>
            </div>

            <div className="overflow-x-auto scroll-area">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-3 w-64">Student</th>
                    {columns.map((c) => (
                      <th key={`th-${c.ciId}`} className="text-left px-4 py-3 min-w-[160px]">
                        <div className="font-medium text-slate-800 truncate">
                          {c.courseCode ? `${c.courseCode} • ` : ""}
                          {c.courseName || "Course"}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {c.examTitle || "Exam"} {Number.isFinite(c.maxMarks as any) ? `• Max ${c.maxMarks}` : ""}
                        </div>
                      </th>
                    ))}
                    <th className="text-left px-4 py-3">Counted</th>
                    <th className="text-left px-4 py-3">Total</th>
                    <th className="text-left px-4 py-3">Max</th>
                    <th className="text-left px-4 py-3">Final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, idx) => {
                    const t = rowTotals[r.student._id] || { counted: 0, sumMarks: 0, sumMax: 0, final: "NA" as const };
                    return (
                      <tr key={`row-${r.student._id}`}>
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-xs font-medium flex items-center justify-center">
                              {idx + 1}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900 truncate">{studentLabel(r.student)}</div>
                              <div className="text-xs text-slate-500 truncate">{r.student.email || r.student.username || ""}</div>
                            </div>
                          </div>
                        </td>

                        {columns.map((c) => {
                          const cell = r.cells[c.ciId];
                          const display = cell ? cellDisplay(cell, c.maxMarks) : "–";
                          const outcome = cell?.examOutcome || "not_assigned";
                          return (
                            <td key={`td-${r.student._id}-${c.ciId}`} className="px-4 py-3 align-top">
                              <div
                                className={`inline-flex items-center px-2 py-1 rounded border ${outcomeBadge(outcome)}`}
                                title={cell?.remarks || ""}
                              >
                                {display}
                              </div>
                            </td>
                          );
                        })}

                        <td className="px-4 py-3 align-top">{t.counted}</td>
                        <td className="px-4 py-3 align-top font-semibold">{t.sumMarks}</td>
                        <td className="px-4 py-3 align-top">{t.sumMax}</td>
                        <td className="px-4 py-3 align-top">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              t.final === "Pass" ? "bg-emerald-50 text-emerald-700"
                              : t.final === "Fail" ? "bg-rose-50 text-rose-700"
                              : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {t.final}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Practical Marks */}
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">Practical Marks</h2>
            <label className="ml-3 inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={showPractical}
                onChange={(e) => setShowPractical(e.target.checked)}
              />
              Show section
            </label>
          </div>

          {!showPractical ? null : loadingPractical ? (
            <div className="py-10 text-center text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin inline mr-2 text-blue-600" />
              Loading practical marks…
            </div>
          ) : practicals.length === 0 ? (
            <div className="py-6 text-slate-600">No practical records found for this selection.</div>
          ) : (
            <div className="space-y-6">
              {practicals.map((grp) => (
                <div key={`pr-${grp.ciId}`} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print-break-inside-avoid">
                  <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        {(grp.courseCode ? `${grp.courseCode} • ` : "") + (grp.courseName || "Course")}
                      </div>
                      <div className="text-xs text-slate-600 truncate">
                        Teacher: {grp.teacher?.name || grp.teacher?.username || grp.teacher?.email || "—"}
                      </div>
                    </div>
                    <button
                      onClick={() => exportCSVPractical(grp)}
                      className="px-3 py-1.5 rounded border bg-white hover:bg-slate-50 inline-flex items-center gap-2 text-sm"
                    >
                      <Download className="h-4 w-4" />
                      Export CSV
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="text-left px-4 py-3 w-64">Student</th>
                          <th className="text-left px-4 py-3">First</th>
                          <th className="text-left px-4 py-3">Final</th>
                          <th className="text-left px-4 py-3">Assign</th>
                          <th className="text-left px-4 py-3">Attend</th>
                          <th className="text-left px-4 py-3">Total</th>
                          <th className="text-left px-4 py-3">Pass</th>
                          <th className="text-left px-4 py-3">Verified</th>
                          <th className="text-left px-4 py-3">Locked</th>
                          <th className="text-left px-4 py-3">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {grp.records.map((r, i) => (
                          <tr key={`prr-${grp.ciId}-${r._id}-${i}`}>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900 truncate">
                                {studentLabel(r.student)}
                              </div>
                              <div className="text-xs text-slate-500 truncate">
                                {r.student?.email || r.student?.username || ""}
                              </div>
                            </td>
                            <td className="px-4 py-3">{Number.isFinite(r.pFirst as any) ? r.pFirst : ""}</td>
                            <td className="px-4 py-3">{Number.isFinite(r.pFinal as any) ? r.pFinal : ""}</td>
                            <td className="px-4 py-3">{Number.isFinite(r.pAssign as any) ? r.pAssign : ""}</td>
                            <td className="px-4 py-3">{Number.isFinite(r.pAttend as any) ? r.pAttend : ""}</td>
                            <td className="px-4 py-3 font-semibold">{Number.isFinite(r.practicalTotal as any) ? r.practicalTotal : ""}</td>
                            <td className="px-4 py-3">{Number.isFinite(r.passMarks as any) ? r.passMarks : ""}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${r.verifiedBy ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                                {r.verifiedBy ? "Yes" : "No"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${r.lockedByAdmin ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-700"}`}>
                                {r.lockedByAdmin ? "Yes" : "No"}
                              </span>
                            </td>
                            <td className="px-4 py-3">{r.remarks || ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tiny readout */}
        <div className="mt-6 text-sm text-slate-600">
          <div>
            <span className="font-medium">Selection:</span>{" "}
            {faculty ? faculty.name : "—"} • {batches.find((b) => b._id === batchId)?.batchname || "—"} •{" "}
            {level ? `${word} ${level}` : "—"} • {mode === "title" ? `Exam “${examTitle || "—"}”` : `Slot ${examSlot || "—"}`} • Attempt {attemptNo || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
