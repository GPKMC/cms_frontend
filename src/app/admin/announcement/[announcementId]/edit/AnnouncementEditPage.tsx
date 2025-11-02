"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import {
  Save,
  Upload,
  Trash2,
  Plus,
  Image as ImageIcon,
  FileText as FileIcon,
  Link as LinkIcon,
  Pin,
  PinOff,
  Eye,
  X,
  Users,
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import TiptapEditor from "../../notification_rte_comenent"; // adjust if your path differs

/** ======= CONFIG (same as create) ======= */
const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");
const EP = {
  read: (id: string) => `${BACKEND}/announcement/${id}/notification-details?adminView=true`,
  readFallback: (id: string) => `${BACKEND}/announcement/${id}?adminView=true`,
  patch: (id: string) => `${BACKEND}/announcement/${id}`,
  upload: `${BACKEND}/announcement/upload`,
  facultyList: `${BACKEND}/faculty-api/faculties`,
  batchesByFacultyCode: (
    code: string,
    opts?: { programLevel?: string; facultyType?: "semester" | "yearly"; limit?: number }
  ) => {
    const p = new URLSearchParams();
    p.set("facultyCode", code);
    if (opts?.programLevel) p.set("programLevel", opts.programLevel);
    if (opts?.facultyType) p.set("facultyType", opts.facultyType);
    p.set("limit", String(opts?.limit ?? 200));
    return `${BACKEND}/batch-api/batch?${p.toString()}`;
  },
};

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token_admin") || localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** ======= Types ======= */
type FileDesc = {
  url: string;
  originalname?: string;
  filetype?: string;
  size?: number;
  caption?: string;
};
type LinkItem = { label?: string; url: string };
type Audience =
  | { mode: "all" }
  | { mode: "faculty"; facultyIds?: string[] }
  | { mode: "batches"; facultyIds?: string[]; batchIds?: string[] };

type AnnouncementDoc = {
  _id: string;
  type: "general" | "event" | "seminar" | "exam" | "result" | "cultural" | "eca";
  title: string;
  summary?: string;
  contentHtml?: string;
  images?: FileDesc[];
  files?: FileDesc[];
  links?: LinkItem[];
  published?: boolean;
  publishAt?: string | null;
  expiresAt?: string | null;
  pinned?: boolean;
  priority?: "normal" | "high" | "urgent";
  audience?: Audience;
  createdAt?: string;
  updatedAt?: string;
};

type FacultyLite = {
  _id: string;
  name?: string;
  email?: string;
  username?: string;
  code?: string;
  programLevel?: string;
  type?: "semester" | "yearly";
};
type BatchLite = { _id: string; batchname?: string; batchName?: string; name?: string; code?: string; year?: number };

/** ======= Helpers ======= */
const PDF_MIME = "application/pdf";
const OFFICE_EXT = /\.(doc|docx|xls|xlsx|ppt|pptx)$/i;

function toISO(dt: string | null): string | null {
  if (!dt) return null;
  const d = new Date(dt);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function isoToLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const fileKey = (f: File) => [f.name, f.size, f.lastModified, f.type].join("::");
function mergeUniqueFiles(prev: File[], next: File[]) {
  const map = new Map(prev.map((f) => [fileKey(f), f]));
  next.forEach((f) => map.set(fileKey(f), f));
  return Array.from(map.values());
}

async function uploadFiles(files: File[]): Promise<FileDesc[]> {
  if (!files.length) return [];
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  const res = await fetch(EP.upload, { method: "POST", headers: { ...authHeaders() }, body: fd });
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || "Upload failed");
  const data = await res.json();
  return (data.files || []).map((f: any) => ({
    url: f.url,
    originalname: f.originalname || f.name,
    filetype: f.mimetype || f.type,
    size: f.size,
  }));
}

const officeEmbed = (src: string) =>
  `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(src)}`;

function facultyLabel(f: FacultyLite) {
  const base = f.name || f.username || f.email || f._id;
  return f.code ? `${base} (${f.code})` : base;
}
function batchLabel(b: BatchLite) {
  return b.batchname || b.batchName || b.name || b.code || (b.year ? String(b.year) : b._id);
}

/** =================== EDIT PAGE (CLIENT) =================== */
export default function AnnouncementEditPage({ id }: { id: string }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // success/error counters (like create)
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const ok = (m: string) => {
    setSuccessCount((c) => c + 1);
    toast.success(m);
  };
  const fail = (m: string) => {
    setErrorCount((c) => c + 1);
    toast.error(m);
  };
  const resetTotals = () => {
    setSuccessCount(0);
    setErrorCount(0);
  };

  /** ===== Form state (prefilled) ===== */
  const [type, setType] = useState<AnnouncementDoc["type"]>("general");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [contentHtml, setContentHtml] = useState("");

  // existing attachments from DB (kept until user removes)
  const [existingImages, setExistingImages] = useState<FileDesc[]>([]);
  const [existingFiles, setExistingFiles] = useState<FileDesc[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);

  // new (local) files to upload & merge
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newDocs, setNewDocs] = useState<File[]>([]);

  const imgBlobUrls = useMemo(() => newImages.map((f) => URL.createObjectURL(f)), [newImages]);
  useEffect(
    () => () => {
      imgBlobUrls.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      });
    },
    [imgBlobUrls]
  );

  const [published, setPublished] = useState(true);
  const [pinned, setPinned] = useState(false);
  const [priority, setPriority] = useState<"normal" | "high" | "urgent">("normal");
  const [publishAt, setPublishAt] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  /** ===== Audience ===== */
  const [audienceMode, setAudienceMode] = useState<"all" | "faculty" | "batches">("all");
  const [faculty, setFaculty] = useState<FacultyLite[]>([]);
  const [loadingFaculty, setLoadingFaculty] = useState(false);

  const [selectedFacultyIds, setSelectedFacultyIds] = useState<string[]>([]); // for faculty mode

  const [batchFacultyId, setBatchFacultyId] = useState<string>(""); // for batches mode
  const [batches, setBatches] = useState<BatchLite[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);

  // ===== Preview modal (for local new files) =====
  type PreviewState = {
    open: boolean;
    kind: "image" | "file";
    title?: string;
    src: string;
    remoteUrl?: string;
    mime?: string;
    isOffice?: boolean;
  };
  const [preview, setPreview] = useState<PreviewState | null>(null);
  function closePreview() {
    if (preview?.src?.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(preview.src);
      } catch {}
    }
    setPreview(null);
  }
  async function openNewDocPreview(i: number) {
    const f = newDocs[i];
    if (!f) return;
    const name = f.name || "File";
    if (f.type === PDF_MIME || /\.pdf$/i.test(name)) {
      const url = URL.createObjectURL(f);
      setPreview({ open: true, kind: "file", title: name, src: url, mime: PDF_MIME, isOffice: false });
      return;
    }
    if (OFFICE_EXT.test(name)) {
      // Needs remote URL to embed Office viewer
      try {
        const [uploaded] = await uploadFiles([f]);
        setPreview({
          open: true,
          kind: "file",
          title: name,
          src: officeEmbed(uploaded.url),
          remoteUrl: uploaded.url,
          mime: uploaded.filetype,
          isOffice: true,
        });
      } catch (e: any) {
        fail(e?.message || "Preview failed");
      }
      return;
    }
    // default: open directly after temp upload
    try {
      const [uploaded] = await uploadFiles([f]);
      setPreview({
        open: true,
        kind: "file",
        title: name,
        src: uploaded.url,
        remoteUrl: uploaded.url,
        mime: uploaded.filetype,
        isOffice: false,
      });
    } catch (e: any) {
      fail(e?.message || "Preview failed");
    }
  }

  /** ===== Load faculty list ===== */
  useEffect(() => {
    (async () => {
      try {
        setLoadingFaculty(true);
        const res = await fetch(EP.facultyList, { headers: { ...authHeaders() } });
        if (!res.ok) throw new Error("Faculty list failed");
        const data = await res.json();
        const list: FacultyLite[] = Array.isArray(data) ? data : data.data || data.teachers || [];
        setFaculty(list);
      } catch {
        fail("Failed to load faculty list");
      } finally {
        setLoadingFaculty(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ===== Load current announcement ===== */
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        let res = await fetch(EP.read(id), { headers: { ...authHeaders() }, cache: "no-store" });
        if (res.status === 404) res = await fetch(EP.readFallback(id), { headers: { ...authHeaders() }, cache: "no-store" });
        if (!res.ok) throw new Error(`Load failed (${res.status})`);
        const j = await res.json();
        const data: AnnouncementDoc = j?.data || j?.announcement || j;

        setType(data.type);
        setTitle(data.title || "");
        setSummary(data.summary || "");
        setContentHtml(data.contentHtml || "");
        setExistingImages(Array.isArray(data.images) ? data.images : []);
        setExistingFiles(Array.isArray(data.files) ? data.files : []);
        setLinks(Array.isArray(data.links) ? data.links : []);
        setPublished(!!data.published);
        setPinned(!!data.pinned);
        setPriority((data.priority as any) || "normal");
        setPublishAt(isoToLocalInput(data.publishAt));
        setExpiresAt(isoToLocalInput(data.expiresAt));

        const aud = data.audience || { mode: "all" };
        setAudienceMode(aud.mode || "all");

        if (aud.mode === "faculty") {
          setSelectedFacultyIds(aud.facultyIds || []);
          setBatchFacultyId("");
          setSelectedBatchIds([]);
          setBatches([]);
        } else if (aud.mode === "batches") {
          // try to retain a faculty context (first faculty id if present)
          const fid = aud.facultyIds?.[0] || "";
          setBatchFacultyId(fid);
          setSelectedBatchIds(aud.batchIds || []);
        } else {
          setSelectedFacultyIds([]);
          setBatchFacultyId("");
          setSelectedBatchIds([]);
          setBatches([]);
        }
      } catch (e: any) {
        fail(e?.message || "Failed to load announcement");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  /** ===== When switching to batches mode, fetch batches for selected faculty ===== */
  useEffect(() => {
    if (audienceMode !== "batches") return;
    if (!batchFacultyId) {
      setBatches([]);
      setSelectedBatchIds([]);
      return;
    }
    fetchBatchesForFaculty(batchFacultyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceMode, batchFacultyId]);

  async function fetchBatchesForFaculty(fid: string) {
    const fac = faculty.find((f) => f._id === fid);
    if (!fac?.code) {
      setBatches([]);
      return;
    }
    setLoadingBatches(true);
    try {
      const url = EP.batchesByFacultyCode(fac.code, {
        programLevel: fac.programLevel,
        facultyType: fac.type,
        limit: 200,
      });
      const res = await fetch(url, { headers: { ...authHeaders() } });
      if (!res.ok) throw new Error("batches request failed");
      const data = await res.json();
      const raw: any[] = Array.isArray(data?.batches)
        ? data.batches
        : Array.isArray(data)
        ? data
        : data.data || [];
      const list: BatchLite[] = raw.map((b: any) => ({
        ...b,
        batchname: b.batchname || b.batchName || b.name || b.code || (b.year ? String(b.year) : undefined),
      }));
      setBatches(list);
    } catch {
      setBatches([]);
      fail("Failed to load batches");
    } finally {
      setLoadingBatches(false);
    }
  }

  /** ===== Links helpers ===== */
  const addLink = () => setLinks((ls) => [...ls, { label: "", url: "" }]);
  const removeLink = (idx: number) => setLinks((ls) => ls.filter((_, i) => i !== idx));
  const updateLink = (idx: number, patch: Partial<LinkItem>) =>
    setLinks((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  /** ===== Existing attachments removal ===== */
  const removeExistingImage = (i: number) =>
    setExistingImages((xs) => xs.filter((_, idx) => idx !== i));
  const clearExistingImages = () => setExistingImages([]);

  const removeExistingFile = (i: number) =>
    setExistingFiles((xs) => xs.filter((_, idx) => idx !== i));
  const clearExistingFiles = () => setExistingFiles([]);

  /** ===== New local attachments handlers ===== */
  function addMoreImages(files: File[]) {
    setNewImages((prev) => mergeUniqueFiles(prev, files));
    ok(`${files.length} image(s) added`);
  }
  function addMoreDocs(files: File[]) {
    setNewDocs((prev) => mergeUniqueFiles(prev, files));
    ok(`${files.length} file(s) added`);
  }
  const removeNewImageAt = (i: number) => setNewImages((prev) => prev.filter((_, idx) => idx !== i));
  const clearNewImages = () => setNewImages([]);
  const removeNewDocAt = (i: number) => setNewDocs((prev) => prev.filter((_, idx) => idx !== i));
  const clearNewDocs = () => setNewDocs([]);

  /** ===== Submit (PATCH + merge attachments) ===== */
  async function handleUpdate(e: React.FormEvent<HTMLFormElement>, forcePublished?: boolean) {
    e.preventDefault();
    if (!id) return fail("Missing id");
    if (!title.trim()) return fail("Title is required");

    if (audienceMode === "faculty" && selectedFacultyIds.length === 0) {
      return fail("Select at least one faculty or switch to All");
    }
    if (audienceMode === "batches") {
      if (!batchFacultyId) return fail("Choose a faculty to load its batches");
      if (selectedBatchIds.length === 0) return fail("Select at least one batch");
    }

    setSubmitting(true);
    try {
      // upload just the NEW files
      const [uploadedImages, uploadedDocs] = await Promise.all([
        uploadFiles(newImages),
        uploadFiles(newDocs),
      ]);

      // merged arrays = kept existing + newly uploaded
      const mergedImages: FileDesc[] = [...existingImages, ...uploadedImages];
      const mergedFiles: FileDesc[] = [...existingFiles, ...uploadedDocs];

      // build audience payload
      const audPayload: Audience =
        audienceMode === "all"
          ? { mode: "all" }
          : audienceMode === "faculty"
          ? { mode: "faculty", facultyIds: selectedFacultyIds }
          : {
              mode: "batches",
              facultyIds: batchFacultyId ? [batchFacultyId] : [],
              batchIds: selectedBatchIds,
            };

      // PATCH with the whole doc (backend replaces with provided arrays)
      const payload = {
        type,
        title: title.trim(),
        summary: summary.trim() || undefined,
        contentHtml: contentHtml || undefined,
        images: mergedImages,
        files: mergedFiles,
        links: links.filter((l) => l.url && /^https?:\/\//i.test(l.url)),
        published: forcePublished ?? published,
        publishAt: toISO(publishAt),
        expiresAt: toISO(expiresAt),
        pinned,
        priority,
        audience: audPayload,
      };

      const res = await fetch(EP.patch(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Update failed");
      }

      const willPublish = forcePublished ?? published;
      ok(willPublish ? "Announcement updated & published" : "Draft updated");

      // Let the toast render, then navigate to the list
      setTimeout(() => {
        router.replace("/admin/announcement"); // route path (not /page.tsx)
      }, 600);

      return;
    } catch (e: any) {
      fail(e?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!id) {
    return <div className="p-6 text-sm text-red-600">Invalid URL: missing announcement id.</div>;
  }
  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-7 w-2/3 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
        <div className="h-56 w-full bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />

      <div className="mx-auto max-w-5xl p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg grid place-items-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Edit Announcement</h1>
                <p className="text-gray-600">Update content, audience, and attachments</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-green-100 text-green-800 border border-green-200">
                <CheckCircle2 className="w-4 h-4" /> {successCount}
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-red-100 text-red-800 border border-red-200">
                <AlertTriangle className="w-4 h-4" /> {errorCount}
              </span>
              <button
                type="button"
                onClick={resetTotals}
                className="ml-1 text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 border"
                title="Reset counters"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={(e) => handleUpdate(e)} className="space-y-8">
          {/* Basic Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Basic Information</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Announcement Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AnnouncementDoc["type"])}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3"
                    required
                  >
                    <option value="general">📢 General</option>
                    <option value="event">🎉 Event</option>
                    <option value="seminar">🎓 Seminar</option>
                    <option value="exam">📝 Exam</option>
                    <option value="result">📊 Result</option>
                    <option value="cultural">🎭 Cultural</option>
                    <option value="eca">🏆 ECA</option>
                  </select>
                </div>
                <div className="lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3"
                    placeholder="Title"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Summary</label>
                <input
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                  placeholder="One-line summary"
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">{summary.length}/500</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Content</h2>
            </div>
            <div className="p-6">
              <TiptapEditor content={contentHtml} onChange={setContentHtml} placeholder="Update the content..." />
            </div>
          </div>

          {/* Audience */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-sky-600 to-cyan-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5" /> Audience
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex flex-wrap gap-3">
                <label className={`px-3 py-2 rounded-lg border cursor-pointer text-sm ${audienceMode === "all" ? "bg-sky-50 border-sky-300" : "bg-gray-50 border-gray-300"}`}>
                  <input type="radio" name="aud" className="sr-only" checked={audienceMode === "all"} onChange={() => setAudienceMode("all")} />
                  All (everyone)
                </label>
                <label className={`px-3 py-2 rounded-lg border cursor-pointer text-sm flex items-center gap-2 ${audienceMode === "faculty" ? "bg-sky-50 border-sky-300" : "bg-gray-50 border-gray-300"}`}>
                  <input type="radio" name="aud" className="sr-only" checked={audienceMode === "faculty"} onChange={() => setAudienceMode("faculty")} />
                  <GraduationCap className="w-4 h-4" /> Faculty
                </label>
                <label className={`px-3 py-2 rounded-lg border cursor-pointer text-sm ${audienceMode === "batches" ? "bg-sky-50 border-sky-300" : "bg-gray-50 border-gray-300"}`}>
                  <input type="radio" name="aud" className="sr-only" checked={audienceMode === "batches"} onChange={() => setAudienceMode("batches")} />
                  Batches
                </label>
              </div>

              {audienceMode === "faculty" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-700">
                      Select faculty <span className="text-gray-400">({selectedFacultyIds.length} selected)</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedFacultyIds(faculty.map((f) => f._id))}
                        className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 border"
                      >
                        Select all
                      </button>
                      <button type="button" onClick={() => setSelectedFacultyIds([])} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 border">
                        Clear
                      </button>
                    </div>
                  </div>
                  <select
                    multiple
                    value={selectedFacultyIds}
                    onChange={(e) => {
                      const ids = Array.from(e.target.selectedOptions).map((o) => o.value);
                      setSelectedFacultyIds(ids);
                    }}
                    size={Math.min(10, Math.max(6, faculty.length || 6))}
                    className="w-full rounded-lg border border-gray-300 p-2 bg-gray-50"
                  >
                    {loadingFaculty ? (
                      <option>Loading…</option>
                    ) : faculty.length === 0 ? (
                      <option disabled>No faculty found</option>
                    ) : (
                      faculty.map((f) => (
                        <option key={f._id} value={f._id}>
                          {facultyLabel(f)}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {audienceMode === "batches" && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Choose Faculty</label>
                    <select
                      value={batchFacultyId}
                      onChange={(e) => {
                        setBatchFacultyId(e.target.value);
                        setSelectedBatchIds([]);
                      }}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3"
                    >
                      <option value="">-- Select Faculty --</option>
                      {loadingFaculty ? (
                        <option disabled>Loading…</option>
                      ) : faculty.length === 0 ? (
                        <option disabled>No faculty found</option>
                      ) : (
                        faculty.map((f) => (
                          <option key={f._id} value={f._id}>
                            {facultyLabel(f)}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className={`${batchFacultyId ? "" : "opacity-50 pointer-events-none"}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-700">
                        Select batches <span className="text-gray-400">({selectedBatchIds.length} selected)</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedBatchIds(batches.map((b) => b._id))}
                          disabled={!batchFacultyId || loadingBatches || batches.length === 0}
                          className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 border disabled:opacity-50"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedBatchIds([])}
                          disabled={!batchFacultyId}
                          className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 border disabled:opacity-50"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <select
                      multiple
                      value={selectedBatchIds}
                      onChange={(e) => {
                        const ids = Array.from(e.target.selectedOptions).map((o) => o.value);
                        setSelectedBatchIds(ids);
                      }}
                      size={Math.min(10, Math.max(6, batches.length || 6))}
                      className="w-full rounded-lg border border-gray-300 p-2 bg-gray-50"
                    >
                      {!batchFacultyId ? (
                        <option disabled>Select a faculty first</option>
                      ) : loadingBatches ? (
                        <option>Loading…</option>
                      ) : batches.length === 0 ? (
                        <option disabled>No batches found</option>
                      ) : (
                        batches.map((b) => (
                          <option key={b._id} value={b._id}>
                            {batchLabel(b)}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Attachments */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-teal-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Media & Attachments</h2>
            </div>
            <div className="p-6 space-y-8">
              {/* Existing images */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <ImageIcon className="w-4 h-4 text-green-600" />
                    Existing Images <span className="text-xs text-gray-500">({existingImages.length})</span>
                  </div>
                  {existingImages.length > 0 && (
                    <button type="button" onClick={clearExistingImages} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 border border-red-200">
                      Remove all
                    </button>
                  )}
                </div>
                {existingImages.length === 0 ? (
                  <p className="text-sm text-gray-500">No existing images</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {existingImages.map((img, i) => (
                      <div key={`${img.url}-${i}`} className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={img.originalname || `image-${i}`} className="w-full h-40 object-cover rounded border" />
                        <button
                          type="button"
                          onClick={() => removeExistingImage(i)}
                          className="absolute top-2 right-2 p-1.5 rounded bg-red-600 text-white opacity-0 group-hover:opacity-100"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add new images */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <ImageIcon className="w-4 h-4 text-green-600" />
                    Add More Images <span className="text-xs text-gray-500">({newImages.length})</span>
                  </div>
                  {newImages.length > 0 && (
                    <button type="button" onClick={clearNewImages} className="text-xs px-2 py-1 rounded bg-gray-100 border">
                      Clear new
                    </button>
                  )}
                </div>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length) addMoreImages(files);
                      (e.target as HTMLInputElement).value = "";
                    }}
                  />
                </div>

                {imgBlobUrls.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {imgBlobUrls.map((src, i) => (
                      <div key={`${fileKey(newImages[i])}-${i}`} className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={`new-${i}`} className="w-full h-40 object-cover rounded border" />
                        <button
                          type="button"
                          onClick={() => removeNewImageAt(i)}
                          className="absolute top-2 right-2 p-1.5 rounded bg-red-600 text-white opacity-0 group-hover:opacity-100"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Existing files */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <FileIcon className="w-4 h-4 text-blue-600" />
                    Existing Files <span className="text-xs text-gray-500">({existingFiles.length})</span>
                  </div>
                  {existingFiles.length > 0 && (
                    <button type="button" onClick={clearExistingFiles} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 border border-red-200">
                      Remove all
                    </button>
                  )}
                </div>
                {existingFiles.length === 0 ? (
                  <p className="text-sm text-gray-500">No existing files</p>
                ) : (
                  <div className="space-y-2">
                    {existingFiles.map((f, i) => (
                      <div key={`${f.url}-${i}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                        <FileIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{f.originalname || f.url.split("/").pop()}</p>
                          <p className="text-xs text-gray-500">{f.filetype || "file"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-white border text-xs">
                            <Eye className="w-3.5 h-3.5" /> Open
                          </a>
                          <button
                            type="button"
                            onClick={() => removeExistingFile(i)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-red-600 text-white text-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add new files */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <FileIcon className="w-4 h-4 text-blue-600" />
                    Add More Files <span className="text-xs text-gray-500">({newDocs.length})</span>
                  </div>
                  {newDocs.length > 0 && (
                    <button type="button" onClick={clearNewDocs} className="text-xs px-2 py-1 rounded bg-gray-100 border">
                      Clear new
                    </button>
                  )}
                </div>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length) addMoreDocs(files);
                      (e.target as HTMLInputElement).value = "";
                    }}
                  />
                </div>

                {newDocs.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {newDocs.map((file, i) => (
                      <div key={`${fileKey(file)}-${i}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                        <FileIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || "unknown"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openNewDocPreview(i)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-blue-600 text-white text-xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => removeNewDocAt(i)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-red-600 text-white text-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Links */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-600 to-red-600 px-6 py-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                      <LinkIcon className="w-5 h-5" />
                      External Links
                    </h3>
                    <button
                      type="button"
                      onClick={addLink}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm"
                    >
                      <Plus className="w-4 h-4" /> Add Link
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  {links.length === 0 ? (
                    <p className="text-sm text-gray-500">No links</p>
                  ) : (
                    <div className="space-y-4">
                      {links.map((l, i) => (
                        <div key={i} className="bg-gray-50 rounded-lg p-4 border">
                          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 items-end">
                            <div className="lg:col-span-2">
                              <label className="block text-xs font-medium text-gray-700 mb-1">Label</label>
                              <input
                                className="w-full rounded-lg border px-3 py-2 text-sm"
                                value={l.label ?? ""}
                                onChange={(e) => updateLink(i, { label: e.target.value })}
                                placeholder="Label (optional)"
                              />
                            </div>
                            <div className="lg:col-span-2">
                              <label className="block text-xs font-medium text-gray-700 mb-1">URL</label>
                              <input
                                className="w-full rounded-lg border px-3 py-2 text-sm"
                                value={l.url}
                                onChange={(e) => updateLink(i, { url: e.target.value })}
                                placeholder="https://example.com"
                              />
                            </div>
                            <div>
                              <button
                                type="button"
                                onClick={() => removeLink(i)}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm"
                              >
                                <Trash2 className="w-4 h-4" />
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Publishing */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Publishing Settings</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3"
                  >
                    <option value="normal">🔵 Normal</option>
                    <option value="high">🟡 High</option>
                    <option value="urgent">🔴 Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Publish At</label>
                  <input
                    type="datetime-local"
                    value={publishAt ?? ""}
                    onChange={(e) => setPublishAt(e.target.value || null)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expires At</label>
                  <input
                    type="datetime-local"
                    value={expiresAt ?? ""}
                    onChange={(e) => setExpiresAt(e.target.value || null)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="sr-only" />
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${published ? "bg-green-500 border-green-500" : "border-gray-300"}`}>
                      {published && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Published</span>
                </label>

                <button
                  type="button"
                  onClick={() => setPinned((p) => !p)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm ${pinned ? "bg-yellow-50 border-yellow-300 text-yellow-700" : "bg-gray-50 border-gray-300 text-gray-700"}`}
                >
                  {pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  {pinned ? "Pinned to Top" : "Pin to Top"}
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Changes
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={(e) => handleUpdate(e as any, false)}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg disabled:opacity-50"
                title="Save as draft"
              >
                <Upload className="w-5 h-5" />
                Save as Draft
              </button>

              <button
                type="button"
                onClick={() => router.back()}
                className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg"
              >
                <Trash2 className="w-5 h-5" />
                Cancel
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${published ? "bg-green-500" : "bg-gray-400"}`}></div>
                Status: {published ? "Published" : "Draft"}
              </div>
              {pinned && (
                <div className="flex items-center gap-2">
                  <Pin className="w-3 h-3 text-yellow-600" />
                  Pinned
                </div>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Preview modal for new files */}
      {preview?.open && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex flex-col">
          <div className="flex items-center justify-between p-3 text-white bg-black/50">
            <div className="truncate">
              <span className="text-sm opacity-80 mr-2">Previewing:</span>
              <span className="text-sm font-medium truncate max-w-[60vw] inline-block align-bottom">
                {preview.title || (preview.kind === "image" ? "Image" : "File")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={preview.isOffice ? (preview.remoteUrl || preview.src) : preview.src}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-sm"
              >
                Open in new tab
              </a>
              <button onClick={closePreview} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded" title="Close preview">
                <X className="w-5 h-5 mx-auto my-auto" />
              </button>
            </div>
          </div>
          <div className="flex-1 p-3">
            {preview.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.src} alt={preview.title || "image"} className="w-full h-full object-contain rounded bg-white" />
            ) : preview.isOffice ? (
              <iframe title="Microsoft Online Viewer" src={preview.src} className="w-full h-full rounded bg-white" allow="fullscreen" />
            ) : preview.mime === PDF_MIME || preview.src.startsWith("blob:") ? (
              <iframe title="PDF Preview" src={preview.src} className="w-full h-full rounded bg-white" />
            ) : (
              <div className="w-full h-full grid place-items-center text-white">
                <div className="text-center">
                  <p className="text-sm opacity-80 mb-2">Cannot embed this file type.</p>
                  {preview.remoteUrl && (
                    <a href={preview.remoteUrl} target="_blank" rel="noreferrer" className="underline">
                      Open file directly
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
