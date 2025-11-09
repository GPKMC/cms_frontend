"use client";


import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Folder,
  Mail,
  MoreVertical,
  RefreshCcw,
  Settings,
  ToggleLeft,
  ToggleRight,
  Undo2,
  CheckCheck,
  Eye,
} from "lucide-react";
import toast from "react-hot-toast";
import DOMPurify from "isomorphic-dompurify";
import he from "he";

/* =====================================================
   Types
===================================================== */

type StudentLite = {
  _id: string;
  username?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  group?: string;
  groupName?: string;
};

type Row = {
  student: StudentLite;
  submitted: boolean;
  returned?: boolean; // server maps from isReturned
  submissionId: string | null;
  submittedAt: string | null;
  grade?: number | null;
  attachments?: { url: string; originalname?: string; filetype?: string }[];
  snippet?: string; // text/HTML answer
};

export type StatsResponse = {
  questionId: string;
  title: string;
  maxPoints: number;
  acceptingSubmissions: boolean;
  assignedCount: number;
  turnedInCount: number;
  rows: Row[];
};

type SortKind = "status" | "first" | "last" | "group";

/* =====================================================
   Endpoints
===================================================== */

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

const STATS_URL = (id: string) => `${API_BASE}/grading/question/${id}/stats`;
const TOGGLE_ACCEPTING_URL = (id: string) =>
  `${API_BASE}/grading/question/${id}/accepting`; // PATCH {accepting:boolean}
const GRADE_URL = (submissionId: string) =>
  `${API_BASE}/questionsubmission/${submissionId}/grade`; // PATCH {grade}
const BULK_RETURN_URL = (id: string) =>
  `${API_BASE}/grading/question/${id}/return`; // POST {submissionIds: string[]}
const BULK_UNRETURN_URL = (id: string) =>
  `${API_BASE}/grading/question/${id}/unreturn`; // POST {submissionIds: string[]}

const buildHeaders = (token?: string): HeadersInit => {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};

/* =====================================================
   UI helpers
===================================================== */

function Avatar({ user, size = 32 }: { user: StudentLite; size?: number }) {
  const base = user.name || user.username || user.email || "?";
  const initials = base
    .split(" ")
    .filter(Boolean)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-full bg-gray-200 text-gray-700 overflow-hidden"
      style={{ width: size, height: size }}
    >
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt={base} className="w-full h-full object-cover" />
      ) : (
        <span className="text-xs font-semibold">{initials}</span>
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 px-3 py-1 rounded-full border ${
        checked ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"
      }`}
    >
      {checked ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
      <span className="text-sm">
        {checked ? "Accepting submissions" : "Closed to submissions"}
      </span>
    </button>
  );
}

function GradeInput({
  value,
  maxPoints,
  disabled,
  onCommit,
}: {
  value: number | null | undefined;
  maxPoints: number;
  disabled?: boolean;
  onCommit: (v: number | null) => Promise<void> | void;
}) {
  const [local, setLocal] = useState<string>(value == null ? "" : String(value));
  useEffect(() => {
    setLocal(value == null ? "" : String(value));
  }, [value]);

  function clamp(n: number) {
    if (Number.isNaN(n)) return 0;
    if (n < 0) return 0;
    if (n > maxPoints) return maxPoints;
    return n;
  }

  async function commit() {
    const v = local.trim() === "" ? null : clamp(Number(local));
    await onCommit(v);
  }

  return (
    <input
      inputMode="numeric"
      className={`w-24 border rounded-md px-2 py-1 text-sm ${disabled ? "bg-gray-100 text-gray-500" : ""}`}
      placeholder={`__/` + maxPoints}
      value={local}
      onChange={(e) => setLocal(e.target.value.replace(/[^0-9]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      disabled={disabled}
    />
  );
}

/* ---------- HTML/text helpers ---------- */

const looksLikeHTML = (s?: string) => !!s && /<\/?[a-z][\s\S]*>/i.test(s);
const stripToText = (html: string) =>
  DOMPurify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
const sanitizeHTML = (html: string) => DOMPurify.sanitize(html);
const decodeEntities = (s: string) => he.decode(s);

/* ---------- Preview helpers ---------- */

function getExt(nameOrUrl: string) {
  const q = nameOrUrl.split("?")[0];
  const m = q.match(/\.([a-z0-9]+)$/i);
  return (m?.[1] || "").toLowerCase();
}
const isImg = (f: { url: string; originalname?: string; filetype?: string }) =>
  (f.filetype || "").startsWith("image/") ||
  ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(getExt(f.originalname || f.url));
const isVid = (f: { url: string; originalname?: string; filetype?: string }) =>
  (f.filetype || "").startsWith("video/") ||
  ["mp4", "webm", "ogg", "mov"].includes(getExt(f.originalname || f.url));
const isPdf = (f: { url: string; originalname?: string; filetype?: string }) =>
  f.filetype === "application/pdf" || getExt(f.originalname || f.url) === "pdf";

function AnswerPreview({
  attachments,
  snippet,
  onOpen,
}: {
  attachments?: { url: string; originalname?: string; filetype?: string }[];
  snippet?: string;
  onOpen?: () => void;
}) {
  const f = attachments?.[0];
  const decoded = snippet ? decodeEntities(snippet) : "";

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onOpen}
        className="h-28 w-full bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center hover:ring-1 hover:ring-gray-200"
        title="Open preview"
      >
        {!f ? (
          <div className="px-3 text-xs text-gray-600 w-full h-full flex items-center justify-center">
            {decoded
              ? looksLikeHTML(decoded)
                ? <span className="line-clamp-4">{stripToText(decoded)}</span>
                : <span className="line-clamp-4 whitespace-pre-wrap">{decoded}</span>
              : "No attachment"}
          </div>
        ) : isImg(f) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.url} alt={f.originalname || "image"} className="h-full w-auto object-contain" />
        ) : isVid(f) ? (
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Eye className="w-3 h-3" /> Video — click to open
          </div>
        ) : isPdf(f) ? (
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Eye className="w-3 h-3" /> PDF — click to open
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="px-2 py-1 rounded bg-white border">{f.originalname || "file"}</span>
            <span className="text-gray-500">— click to open</span>
          </div>
        )}
      </button>

      {attachments && attachments.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {attachments.slice(1, 5).map((a, i) => (
            <a
              key={i}
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
              title={a.originalname || "attachment"}
            >
              {a.originalname || `Attachment ${i + 2}`}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Big Preview Modal ---------- */

function PreviewModal({
  open,
  onClose,
  title,
  attachments,
  snippet,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  attachments?: { url: string; originalname?: string; filetype?: string }[];
  snippet?: string;
}) {
  if (!open) return null;

  const file = attachments?.[0];
  const ext = (file?.originalname || file?.url || "").split("?")[0].split(".").pop()?.toLowerCase();
  const _isImg =
    (file?.filetype || "").startsWith("image/") ||
    ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext || "");
  const _isVid =
    (file?.filetype || "").startsWith("video/") ||
    ["mp4", "webm", "ogg", "mov"].includes(ext || "");
  const _isPdf = file?.filetype === "application/pdf" || ext === "pdf";

  const decoded = snippet ? decodeEntities(snippet) : "";

  return (
    <div className="fixed inset-0 z-[999]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-gray-800">{title || "Answer preview"}</h3>
            <button onClick={onClose} className="px-2 py-1 rounded-md hover:bg-gray-100">✕</button>
          </div>
          <div className="p-4 space-y-3">
            <div className="w-full h-[65vh] bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden">
              {!file ? (
                decoded ? (
                  looksLikeHTML(decoded) ? (
                    <div
                      className="w-full h-full p-4 text-sm text-gray-800 prose prose-sm max-w-none overflow-auto"
                      dangerouslySetInnerHTML={{ __html: sanitizeHTML(decoded) }}
                    />
                  ) : (
                    <div className="w-full h-full p-4 text-sm text-gray-800 whitespace-pre-wrap overflow-auto">
                      {decoded}
                    </div>
                  )
                ) : (
                  <div className="text-sm text-gray-500 px-3">No attachment</div>
                )
              ) : _isImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={file.url} alt={file.originalname || "image"} className="object-contain w-full h-full" />
              ) : _isVid ? (
                <video src={file.url} controls className="w-full h-full" />
              ) : _isPdf ? (
                <iframe title={file.originalname || "pdf"} src={file.url} className="w-full h-full" />
              ) : (
                <div className="text-sm text-gray-600">
                  <div className="mb-2">Cannot preview this file type here.</div>
                  <a href={file.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                    Open / Download: {file.originalname || "file"}
                  </a>
                </div>
              )}
            </div>

            {attachments && attachments.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {attachments.slice(1, 12).map((a, i) => (
                  <a
                    key={i}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
                  >
                    {a.originalname || `Attachment ${i + 2}`}
                  </a>
                ))}
              </div>
            )}
          </div>
          <div className="px-4 py-3 border-t flex justify-end">
            <button onClick={onClose} className="px-3 py-1.5 rounded-md border hover:bg-gray-50">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =====================================================
   Main
===================================================== */

export default function TeacherStudentWork({
  questionId,
  token,
}: {
  questionId: string;
  token?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [filter, setFilter] = useState<"all" | "turned-in" | "assigned">("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [maxPoints, setMaxPoints] = useState<number>(100);

  // Preview modal state
  const [preview, setPreview] = useState<{
    title: string;
    attachments?: { url: string; originalname?: string; filetype?: string }[];
    snippet?: string;
  } | null>(null);

  // sorting
  const [sortKind, setSortKind] = useState<SortKind>("status");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function load() {
    try {
      setLoading(true);
      const r = await fetch(STATS_URL(questionId), {
        headers: buildHeaders(token),
        cache: "no-store",
      });
      if (!r.ok) throw new Error(await r.text());
      const data: StatsResponse = await r.json();
      setStats(data);
      setMaxPoints(data.maxPoints || 100);
      setSelected({});
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to load student work");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  function safeName(r: Row) {
    return (r.student.name || r.student.username || r.student.email || "").trim();
  }
  function firstNameOf(r: Row) {
    const n = safeName(r);
    return n.split(/\s+/)[0] || n;
  }
  function lastNameOf(r: Row) {
    const n = safeName(r);
    const parts = n.split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : parts[0] || n;
  }
  function groupOf(r: Row) {
    return r.student.groupName || r.student.group || "";
  }

  const baseRows = useMemo(() => {
    if (!stats) return [] as Row[];
    if (filter === "turned-in") return stats.rows.filter((r) => r.submitted);
    if (filter === "assigned") return stats.rows.filter((r) => !r.submitted);
    return stats.rows;
  }, [stats, filter]);

  const rows = useMemo(() => {
    const copy = [...baseRows];
    switch (sortKind) {
      case "first":
        copy.sort((a, b) => firstNameOf(a).localeCompare(firstNameOf(b)));
        break;
      case "last":
        copy.sort((a, b) => lastNameOf(a).localeCompare(lastNameOf(b)));
        break;
      case "group":
        copy.sort((a, b) => groupOf(a).localeCompare(groupOf(b)));
        break;
      case "status":
      default:
        // Ungraded first, then most recent submission time
        copy.sort((a, b) => {
          const ag = a.grade == null ? 0 : 1;
          const bg = b.grade == null ? 0 : 1;
          if (ag !== bg) return ag - bg;
          const ta = new Date(a.submittedAt || 0).getTime();
          const tb = new Date(b.submittedAt || 0).getTime();
          return tb - ta;
        });
        break;
    }
    return copy;
  }, [baseRows, sortKind]);

  /** Save locally; only send to server immediately if already returned */
  async function commitGrade(row: Row, grade: number | null) {
    if (!row.submissionId) return;

    // Optimistic local save (NOT sent to student yet)
    setStats((prev) =>
      prev
        ? {
            ...prev,
            rows: prev.rows.map((x) =>
              x.submissionId === row.submissionId ? { ...x, grade: grade ?? null } : x
            ),
          }
        : prev
    );

    // Only call API if already returned (visible to student)
    if (row.returned) {
      try {
        const r = await fetch(GRADE_URL(row.submissionId), {
          method: "PATCH",
          headers: buildHeaders(token),
          body: JSON.stringify({ grade }),
        });
        if (!r.ok) throw new Error(await r.text());
        toast.success("Grade updated");
      } catch (e: any) {
        console.error(e);
        toast.error("Failed to save grade");
      }
    } else {
      toast("Grade saved locally — will send on return");
    }
  }

  function toggleRowSelect(row: Row) {
    if (!row.submissionId || !row.submitted) return; // only actual submissions
    setSelected((s) => ({ ...s, [row.submissionId!]: !s[row.submissionId!] }));
  }

  /* ---------- Return/Unreturn helpers ---------- */

  async function returnSubmissions(ids: string[]) {
    if (!stats || !ids.length) return;
    try {
      // 1) Mark returned
      const ret = await fetch(BULK_RETURN_URL(stats.questionId), {
        method: "POST",
        headers: buildHeaders(token),
        body: JSON.stringify({ submissionIds: ids }),
      });
      if (!ret.ok) {
        const msg = await ret.text();
        throw new Error(`Return failed (${ret.status}): ${msg}`);
      }

      // 2) After return, push grades (if any)
      const mapById = new Map<string, Row>();
      stats.rows.forEach((r) => r.submissionId && mapById.set(r.submissionId, r));
      for (const sid of ids) {
        const row = mapById.get(sid);
        if (row?.grade != null) {
          const resp = await fetch(GRADE_URL(sid), {
            method: "PATCH",
            headers: buildHeaders(token),
            body: JSON.stringify({ grade: row.grade }),
          });
          if (!resp.ok) {
            const msg = await resp.text();
            throw new Error(`Grade push failed (${resp.status}): ${msg}`);
          }
        }
      }

      // 3) Update local
      setStats((prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.map((x) =>
                x.submissionId && ids.includes(x.submissionId) ? { ...x, returned: true } : x
              ),
            }
          : prev
      );
      setSelected({});
      toast.success("Returned to students");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to return");
    }
  }

  async function unreturnSubmissions(ids: string[]) {
    if (!stats || !ids.length) return;
    try {
      const ret = await fetch(BULK_UNRETURN_URL(stats.questionId), {
        method: "POST",
        headers: buildHeaders(token),
        body: JSON.stringify({ submissionIds: ids }),
      });
      if (!ret.ok) {
        const msg = await ret.text();
        throw new Error(`Unreturn failed (${ret.status}): ${msg}`);
      }

      setStats((prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.map((x) =>
                x.submissionId && ids.includes(x.submissionId) ? { ...x, returned: false } : x
              ),
            }
          : prev
      );
      setSelected({});
      toast.success("Unreturned (hidden from students)");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to unreturn");
    }
  }

  // Toolbar selections split
  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => k), [selected]);
  const selectedTurnedInIds = useMemo(
    () => (stats?.rows || []).filter((r) => r.submissionId && selected[r.submissionId] && r.submitted && !r.returned).map((r) => r.submissionId!) || [],
    [selected, stats]
  );
  const selectedReturnedIds = useMemo(
    () => (stats?.rows || []).filter((r) => r.submissionId && selected[r.submissionId] && r.returned).map((r) => r.submissionId!) || [],
    [selected, stats]
  );

  /* ---------- helper for card status/footer ---------- */
  function cardMeta(row: Row) {
    if (!row.submitted) {
      return {
        stateClass: "text-gray-500",
        stateText: "Assigned",
        footer: "Awaiting submission",
        inputDisabled: true,
        canReturn: false,
        canUnreturn: false,
      };
    }
    if (row.returned) {
      return {
        stateClass: "text-blue-600",
        stateText: "Returned",
        footer: "Visible to student",
        inputDisabled: false,
        canReturn: false,
        canUnreturn: true,
      };
    }
    return {
      stateClass: "text-green-600",
      stateText: "Turned in",
      footer: "Saved locally — will send on return",
      inputDisabled: false,
      canReturn: true,
      canUnreturn: false,
    };
  }

  const anySelected = selectedIds.length > 0;
  const anyReturnable = selectedTurnedInIds.length > 0;
  const anyUnreturnable = selectedReturnedIds.length > 0;

  return (
    <>
      <div className="min-h-[80vh] grid grid-cols-12 gap-6">
        {/* Left: roster list */}
        <div className="col-span-4 bg-white rounded-xl shadow-sm border p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <input type="checkbox" className="accent-blue-600" disabled />
              <span className="font-medium text-gray-700">All students</span>
            </div>

            <div className="relative" ref={sortRef}>
              <button
                onClick={() => setSortOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 border rounded-md text-sm"
              >
                Sort by{" "}
                {sortKind === "status"
                  ? "status"
                  : sortKind === "first"
                  ? "first name"
                  : sortKind === "last"
                  ? "last name"
                  : "group"}{" "}
                <ChevronDown className="w-4 h-4" />
              </button>

              {sortOpen && (
                <div className="absolute right-0 mt-2 bg-white border rounded-lg shadow p-1 text-sm z-10">
                  <button
                    onClick={() => {
                      setSortKind("status");
                      setSortOpen(false);
                    }}
                    className={`px-3 py-1 rounded w-full text-left hover:bg-gray-50 ${sortKind === "status" ? "font-semibold" : ""}`}
                  >
                    Sort by status
                  </button>
                  <button
                    onClick={() => {
                      setSortKind("first");
                      setSortOpen(false);
                    }}
                    className={`px-3 py-1 rounded w-full text-left hover:bg-gray-50 ${sortKind === "first" ? "font-semibold" : ""}`}
                  >
                    Sort by first name
                  </button>
                  <button
                    onClick={() => {
                      setSortKind("last");
                      setSortOpen(false);
                    }}
                    className={`px-3 py-1 rounded w-full text-left hover:bg-gray-50 ${sortKind === "last" ? "font-semibold" : ""}`}
                  >
                    Sort by last name
                  </button>
                  <button
                    onClick={() => {
                      setSortKind("group");
                      setSortOpen(false);
                    }}
                    className={`px-3 py-1 rounded w-full text-left hover:bg-gray-50 ${sortKind === "group" ? "font-semibold" : ""}`}
                  >
                    Sort by group
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-2">
            {/* Turned in (not returned) */}
            <div>
              <div className="text-sm text-gray-500 mb-1">Turned in</div>
              {(rows || [])
                .filter((r) => r.submitted && !r.returned)
                .map((r) => (
                  <div key={r.student._id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="accent-blue-600"
                      checked={!!(r.submissionId && selected[r.submissionId])}
                      onChange={() => toggleRowSelect(r)}
                      disabled={!r.submissionId}
                    />
                    <Avatar user={r.student} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {r.student.name || r.student.username || r.student.email}
                      </div>
                      <div className="text-xs text-green-600">Turned in</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <GradeInput value={r.grade ?? null} maxPoints={maxPoints} onCommit={(v) => commitGrade(r, v)} />
                      <span className="text-gray-400">/{maxPoints}</span>
                    </div>
                  </div>
                ))}
            </div>

            {/* Assigned */}
            <div className="mt-4">
              <div className="text-sm text-gray-500 mb-1">Assigned</div>
              {(rows || [])
                .filter((r) => !r.submitted)
                .map((r) => (
                  <div key={r.student._id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50">
                    <input type="checkbox" className="accent-blue-600" disabled />
                    <Avatar user={r.student} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {r.student.name || r.student.username || r.student.email}
                      </div>
                      <div className="text-xs text-gray-500">Assigned</div>
                    </div>
                    <div className="text-sm text-gray-400">__/ {maxPoints}</div>
                  </div>
                ))}
            </div>

            {/* Graded (Returned) */}
            <div className="mt-4">
              <div className="text-sm text-gray-500 mb-1">Graded</div>
              {(rows || [])
                .filter((r) => r.submitted && r.returned)
                .map((r) => (
                  <div key={r.student._id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="accent-blue-600"
                      checked={!!(r.submissionId && selected[r.submissionId])}
                      onChange={() => toggleRowSelect(r)}
                      disabled={!r.submissionId}
                    />
                    <Avatar user={r.student} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {r.student.name || r.student.username || r.student.email}
                      </div>
                      <div className="text-xs text-blue-600">Returned</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <GradeInput value={r.grade ?? null} maxPoints={maxPoints} onCommit={(v) => commitGrade(r, v)} />
                      <span className="text-gray-400">/{maxPoints}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Right: header + grid */}
        <div className="col-span-8">
          {/* Toolbar */}
          <div className="bg-white rounded-xl shadow-sm border mb-4">
            <div className="flex items-center justify-between p-3 border-b">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => returnSubmissions(selectedTurnedInIds)}
                  disabled={!anyReturnable}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
                    anyReturnable ? "bg-blue-600 text-white border-blue-600" : "bg-gray-100 text-gray-400 border-gray-200"
                  }`}
                  title="Return to selected"
                >
                  <CheckCheck className="w-4 h-4 inline mr-1" />
                  Return
                </button>

                <button
                  onClick={() => unreturnSubmissions(selectedReturnedIds)}
                  disabled={!anyUnreturnable}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
                    anyUnreturnable ? "bg-white text-gray-800 border-gray-300 hover:bg-gray-50" : "bg-gray-100 text-gray-400 border-gray-200"
                  }`}
                  title="Unreturn (hide from students)"
                >
                  <Undo2 className="w-4 h-4 inline mr-1" />
                  Unreturn
                </button>

                <div className="relative">
                  <button className="flex items-center gap-2 px-3 py-1.5 border rounded-md text-sm">
                    {maxPoints} points <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <button className="px-3 py-1.5 border rounded-md text-sm text-gray-700">
                  <Mail className="w-4 h-4 inline mr-2" /> Email
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={load} className="px-2 py-1.5 border rounded-md text-gray-600" title="Refresh">
                  <RefreshCcw className="w-4 h-4" />
                </button>
                <button className="px-2 py-1.5 border rounded-md text-gray-600" title="Settings">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Stats row */}
            <div className="p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-semibold">{stats?.title || "Student work"}</h2>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <div className="text-2xl font-semibold">{stats?.turnedInCount ?? 0}</div>
                  <div className="text-sm text-gray-500">Turned in</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold">{stats?.assignedCount ?? 0}</div>
                  <div className="text-sm text-gray-500">Assigned</div>
                </div>
                <Toggle checked={!!stats?.acceptingSubmissions} onChange={toggleAccepting} />
              </div>
            </div>
          </div>

          {/* Filter row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-full text-sm border ${filter === "all" ? "bg-gray-900 text-white" : "bg-white"}`}
              >
                All
              </button>
              <button
                onClick={() => setFilter("turned-in")}
                className={`px-3 py-1.5 rounded-full text-sm border ${filter === "turned-in" ? "bg-gray-900 text-white" : "bg-white"}`}
              >
                Turned in
              </button>
              <button
                onClick={() => setFilter("assigned")}
                className={`px-3 py-1.5 rounded-full text-sm border ${filter === "assigned" ? "bg-gray-900 text-white" : "bg-white"}`}
              >
                Assigned
              </button>
            </div>
            <button className="px-3 py-1.5 border rounded-md text-sm text-gray-700">
              <Folder className="w-4 h-4 inline mr-2" /> Open folder
            </button>
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading && <div className="col-span-full text-sm text-gray-500">Loading…</div>}
            {!loading && rows.length === 0 && (
              <div className="col-span-full text-sm text-gray-500">No students to show.</div>
            )}

            {rows.map((r) => {
              const meta = cardMeta(r);
              const title = r.student.name || r.student.username || r.student.email || "Answer";
              return (
                <div key={r.student._id} className="bg-white rounded-xl shadow-sm border p-3">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar user={r.student} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{title}</div>
                      <div className={`text-xs ${meta.stateClass}`}>{meta.stateText}</div>
                    </div>

                    {/* per-card actions: Return / Unreturn */}
                    {r.submitted && r.submissionId && (
                      <div className="flex items-center gap-1">
                        {meta.canReturn && (
                          <button
                            onClick={() => returnSubmissions([r.submissionId!])}
                            className="px-2 py-1 border rounded-md text-xs bg-blue-600 text-white hover:opacity-90"
                            title="Return to student"
                          >
                            <CheckCheck className="w-3 h-3 inline mr-1" /> Return
                          </button>
                        )}
                        {meta.canUnreturn && (
                          <button
                            onClick={() => unreturnSubmissions([r.submissionId!])}
                            className="px-2 py-1 border rounded-md text-xs hover:bg-gray-50"
                            title="Unreturn (hide from student)"
                          >
                            <Undo2 className="w-3 h-3 inline mr-1" /> Unreturn
                          </button>
                        )}
                        <button
                          onClick={() =>
                            setPreview({
                              title,
                              attachments: r.attachments,
                              snippet: r.snippet,
                            })
                          }
                          className="px-2 py-1 border rounded-md text-xs hover:bg-gray-50"
                          title="Preview the answer"
                        >
                          <Eye className="w-3 h-3 inline mr-1" /> Preview
                        </button>
                        <button className="p-1 rounded-md hover:bg-gray-100" title="More">
                          <MoreVertical className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ANSWER PREVIEW (clickable to open modal) */}
                  <AnswerPreview
                    attachments={r.attachments}
                    snippet={r.snippet}
                    onOpen={() =>
                      setPreview({
                        title,
                        attachments: r.attachments,
                        snippet: r.snippet,
                      })
                    }
                  />

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GradeInput
                        value={r.grade ?? null}
                        maxPoints={maxPoints}
                        onCommit={(v) => commitGrade(r, v)}
                        disabled={meta.inputDisabled}
                      />
                      <span className="text-gray-400">/{maxPoints}</span>
                    </div>
                    <div className="text-xs text-gray-500">{meta.footer}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* One global modal */}
      <PreviewModal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.title || ""}
        attachments={preview?.attachments}
        snippet={preview?.snippet}
      />
    </>
  );

 async function toggleAccepting(v: boolean) {
  if (!stats) return;
  try {
    const r = await fetch(TOGGLE_ACCEPTING_URL(stats.questionId), {
      method: "PATCH",
      headers: buildHeaders(token),
      // 🔴 old: { accepting: v }
      // ✅ new: must match backend: acceptingSubmissions
      body: JSON.stringify({ acceptingSubmissions: v }),
    });

    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();

    // update local state from server response (preferred)
    setStats(prev =>
      prev
        ? {
            ...prev,
            acceptingSubmissions:
              data?.question?.acceptingSubmissions ?? v,
          }
        : prev
    );

    toast.success(v ? "Submissions opened" : "Submissions closed");
  } catch (e: any) {
    console.error(e);
    toast.error("Failed to update accepting state");
  }
}

}
