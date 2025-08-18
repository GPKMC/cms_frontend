'use client';

import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
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
} from 'lucide-react';
import TiptapEditor from '../notification_rte_comenent';

/** ======= CONFIG ======= */
const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');
const EP = {
  create: `${BACKEND}/announcement`,
  upload: `${BACKEND}/announcement/upload`,
  facultyList: `${BACKEND}/faculty-api/faculties`,
  // Your batches endpoint that filters using facultyCode (+ optional programLevel/type)
  batchesByFacultyCode: (
    code: string,
    opts?: { programLevel?: string; facultyType?: 'semester' | 'yearly'; limit?: number }
  ) => {
    const p = new URLSearchParams();
    p.set('facultyCode', code);
    if (opts?.programLevel) p.set('programLevel', opts.programLevel);
    if (opts?.facultyType) p.set('facultyType', opts.facultyType);
    p.set('limit', String(opts?.limit ?? 200));
    return `${BACKEND}/batch-api/batch?${p.toString()}`;
  },
};

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token_admin') || localStorage.getItem('token') || '';
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
type AnnouncementPayload = {
  type: 'general' | 'event' | 'seminar' | 'exam' | 'result' | 'cultural' | 'eca';
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
  priority?: 'normal' | 'high' | 'urgent';
  audience?: {
    mode: 'all' | 'faculty' | 'batches';
    facultyIds?: string[]; // in "faculty" mode: these faculties (all their batches)
    batchIds?: string[];   // in "batches" mode: batches under the chosen faculty
  };
};

type FacultyLite = {
  _id: string;
  name?: string;
  email?: string;
  username?: string;
  code?: string;                       // used to fetch batches by code
  programLevel?: string;               // e.g., 'bachelor' | 'master'
  type?: 'semester' | 'yearly';        // passed as facultyType
};

type BatchLite = {
  _id: string;
  batchname?: string;                  // prefer this for UI
  batchName?: string;                  // some APIs use camelCase
  name?: string;
  code?: string;
  year?: number;
};

/** ======= Helpers ======= */
function toISO(dt: string | null): string | null {
  if (!dt) return null;
  const date = new Date(dt);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

const fileKey = (f: File) => [f.name, f.size, f.lastModified, f.type].join('::');
function mergeUniqueFiles(prev: File[], next: File[]) {
  const map = new Map(prev.map((f) => [fileKey(f), f]));
  next.forEach((f) => map.set(fileKey(f), f));
  return Array.from(map.values());
}

async function uploadFiles(files: File[]): Promise<FileDesc[]> {
  if (!files.length) return [];
  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  const res = await fetch(EP.upload, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: fd,
  });
  if (!res.ok) throw new Error((await res.text().catch(() => '')) || 'Upload failed');
  const data = await res.json();
  return (data.files || []).map((f: any) => ({
    url: f.url,
    originalname: f.originalname || f.name,
    filetype: f.mimetype || f.type,
    size: f.size,
  }));
}

async function uploadOne(file: File): Promise<FileDesc> {
  const [first] = await uploadFiles([file]);
  if (!first?.url) throw new Error('Preview upload failed');
  return first;
}

/** Office viewer helpers */
const OFFICE_EXT = /\.(doc|docx|xls|xlsx|ppt|pptx)$/i;
const PDF_MIME = 'application/pdf';
const officeEmbed = (src: string) =>
  `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(src)}`;

/** Optional validations */
const MAX_FILE_SIZE_MB = 25;
const MAX_IMG = 50;
const MAX_DOC = 50;

function validateAdd(
  kind: 'image' | 'doc',
  currentCount: number,
  selected: File[]
): { ok: true } | { ok: false; error: string } {
  const maxCount = kind === 'image' ? MAX_IMG : MAX_DOC;
  if (currentCount + selected.length > maxCount) {
    return { ok: false, error: `Too many ${kind === 'image' ? 'images' : 'files'} (max ${MAX_DOC}).` };
  }
  const tooBig = selected.find((f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
  if (tooBig) {
    return { ok: false, error: `"${tooBig.name}" exceeds ${MAX_FILE_SIZE_MB}MB.` };
  }
  return { ok: true };
}

/** Multi-select change helper */
function onMultiSelectChange(
  e: React.ChangeEvent<HTMLSelectElement>,
  setter: (ids: string[]) => void
) {
  const ids = Array.from(e.target.selectedOptions).map((o) => o.value);
  setter(ids);
}

/** Label helpers */
function facultyLabel(f: FacultyLite) {
  const base = f.name || f.username || f.email || f._id;
  return f.code ? `${base} (${f.code})` : base;
}
function batchLabel(b: BatchLite) {
  return (
    b.batchname || b.batchName || b.name || b.code || (b.year ? String(b.year) : b._id)
  );
}

/** ======= UI Component ======= */
export default function AnnouncementCreatePage() {
  // --- NEW: success/error counters
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const notifySuccess = (msg: string) => { setSuccessCount((c) => c + 1); toast.success(msg); };
  const notifyError   = (msg: string) => { setErrorCount((c) => c + 1); toast.error(msg); };
  const resetTotals   = () => { setSuccessCount(0); setErrorCount(0); };

  const [type, setType] = useState<AnnouncementPayload['type']>('general');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [contentHtml, setContentHtml] = useState('');

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [docFiles, setDocFiles] = useState<File[]>([]);

  const imagePreviews = useMemo(() => imageFiles.map((f) => URL.createObjectURL(f)), [imageFiles]);
  useEffect(
    () => () => {
      imagePreviews.forEach((u) => {
        try { URL.revokeObjectURL(u); } catch {}
      });
    },
    [imagePreviews]
  );

  const [links, setLinks] = useState<LinkItem[]>([]);
  const [published, setPublished] = useState(true);
  const [pinned, setPinned] = useState(false);
  const [priority, setPriority] = useState<AnnouncementPayload['priority']>('normal');
  const [publishAt, setPublishAt] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** ===== Audience state ===== */
  const [audienceMode, setAudienceMode] = useState<'all' | 'faculty' | 'batches'>('all');

  // Faculty master list
  const [faculty, setFaculty] = useState<FacultyLite[]>([]);
  const [loadingFaculty, setLoadingFaculty] = useState(false);

  // Selection for "faculty" mode
  const [selectedFacultyIds, setSelectedFacultyIds] = useState<string[]>([]);

  // For "batches" mode: choose ONE faculty, then we fetch only that faculty's batches (by code)
  const [batchFacultyId, setBatchFacultyId] = useState<string>('');
  const [batches, setBatches] = useState<BatchLite[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);

  /** Load faculty on mount */
  useEffect(() => {
    (async () => {
      try {
        setLoadingFaculty(true);
        const res = await fetch(EP.facultyList, { headers: { ...authHeaders() } });
        if (res.ok) {
          const data = await res.json();
          const list: FacultyLite[] = Array.isArray(data) ? data : data.data || data.teachers || [];
          setFaculty(list);
        } else {
          notifyError('Failed to load faculty list');
        }
      } catch {
        notifyError('Failed to load faculty list');
      } finally {
        setLoadingFaculty(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Fetch batches for the chosen faculty (by faculty CODE) */
  async function fetchBatchesForFaculty(fid: string) {
    if (!fid) return;
    const fac = faculty.find((f) => f._id === fid);
    if (!fac?.code) {
      setBatches([]);
      setSelectedBatchIds([]);
      notifyError('Selected faculty has no code; cannot load batches.');
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
      if (!res.ok) throw new Error('Request failed');

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
      // optional: success ping
      if (list.length > 0) notifySuccess('Batches loaded');
    } catch {
      setBatches([]);
      notifyError('Failed to load batches for the selected faculty');
    } finally {
      setLoadingBatches(false);
    }
  }

  /** When switching to "batches" mode, if a faculty is already selected keep it; else clear. */
  useEffect(() => {
    if (audienceMode !== 'batches') return;
    if (batchFacultyId) {
      fetchBatchesForFaculty(batchFacultyId);
    } else {
      setBatches([]);
      setSelectedBatchIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceMode]);

  /** If the selected faculty (for batches mode) changes, refresh batches */
  useEffect(() => {
    if (!batchFacultyId) {
      setBatches([]);
      setSelectedBatchIds([]);
      return;
    }
    fetchBatchesForFaculty(batchFacultyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchFacultyId]);

  /** Utilities */
  function selectAllFaculty() {
    setSelectedFacultyIds(faculty.map((f) => f._id));
  }
  function clearFaculty() {
    setSelectedFacultyIds([]);
  }
  function selectAllBatches() {
    setSelectedBatchIds(batches.map((b) => b._id));
  }
  function clearBatches() {
    setSelectedBatchIds([]);
  }

  // ===== Preview modal state =====
  type PreviewState = {
    open: boolean;
    kind: 'image' | 'file';
    title?: string;
    src: string;
    remoteUrl?: string;
    mime?: string;
    isOffice?: boolean;
  };
  const [preview, setPreview] = useState<PreviewState | null>(null);

  // link handlers
  const addLink = () => setLinks((ls) => [...ls, { label: '', url: '' }]);
  const removeLink = (idx: number) => setLinks((ls) => ls.filter((_, i) => i !== idx));
  const updateLink = (idx: number, patch: Partial<LinkItem>) =>
    setLinks((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  // remove selected images/files
  function removeImageAt(i: number) {
    try { URL.revokeObjectURL(imagePreviews[i]); } catch {}
    setImageFiles((prev) => prev.filter((_, idx) => idx !== i));
  }
  const clearAllImages = () => {
    imagePreviews.forEach((u) => { try { URL.revokeObjectURL(u); } catch {} });
    setImageFiles([]);
  };
  const removeDocAt = (i: number) => setDocFiles((prev) => prev.filter((_, idx) => idx !== i));
  const clearAllDocs = () => setDocFiles([]);

  // open previews
  function openImagePreview(i: number) {
    setPreview({
      open: true,
      kind: 'image',
      title: imageFiles[i]?.name || 'Image',
      src: imagePreviews[i],
      mime: imageFiles[i]?.type,
    });
  }

  async function openFilePreview(i: number) {
    try {
      const f = docFiles[i];
      if (!f) return;
      const name = f.name || 'File';
      if (f.type === PDF_MIME || /\.pdf$/i.test(name)) {
        const blobUrl = URL.createObjectURL(f);
        setPreview({ open: true, kind: 'file', title: name, src: blobUrl, mime: PDF_MIME, isOffice: false });
        return;
      }
      if (OFFICE_EXT.test(name)) {
        const uploaded = await uploadOne(f);
        const remote = uploaded.url;
        setPreview({
          open: true,
          kind: 'file',
          title: name,
          src: officeEmbed(remote),
          remoteUrl: remote,
          mime: uploaded.filetype,
          isOffice: true,
        });
        return;
      }
      const uploaded = await uploadOne(f);
      setPreview({
        open: true,
        kind: 'file',
        title: name,
        src: uploaded.url,
        remoteUrl: uploaded.url,
        mime: uploaded.filetype,
        isOffice: false,
      });
    } catch (e: any) {
      notifyError(e?.message || 'Preview failed');
    }
  }

  function closePreview() {
    if (preview?.src?.startsWith('blob:')) {
      try { URL.revokeObjectURL(preview.src); } catch {}
    }
    setPreview(null);
  }

  function resetForm() {
    setType('general');
    setTitle('');
    setSummary('');
    setContentHtml('');
    clearAllImages();
    clearAllDocs();
    setLinks([]);
    setPublished(true);
    setPinned(false);
    setPriority('normal');
    setPublishAt(null);
    setExpiresAt(null);
    setPreview(null);
    setAudienceMode('all');
    setSelectedFacultyIds([]);
    setBatchFacultyId('');
    setBatches([]);
    setSelectedBatchIds([]);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>, forcePublished?: boolean) {
    e.preventDefault();
    if (!title.trim()) {
      notifyError('Title is required');
      return;
    }

    if (audienceMode === 'faculty') {
      if (selectedFacultyIds.length === 0) {
        notifyError('Select at least one faculty (or switch to All).');
        return;
      }
    }

    if (audienceMode === 'batches') {
      if (!batchFacultyId) {
        notifyError('Choose a faculty to load its batches.');
        return;
      }
      if (selectedBatchIds.length === 0) {
        notifyError('Select at least one batch (or use Faculty mode for all batches under that faculty).');
        return;
      }
    }

    setSubmitting(true);
    try {
      const [uploadedImages, uploadedDocs] = await Promise.all([uploadFiles(imageFiles), uploadFiles(docFiles)]);

      const payload: AnnouncementPayload = {
        type,
        title: title.trim(),
        summary: summary.trim() || undefined,
        contentHtml: contentHtml || undefined,
        images: uploadedImages,
        files: uploadedDocs,
        links: links.filter((l) => l.url && /^https?:\/\//i.test(l.url)),
        published: forcePublished ?? published,
        publishAt: toISO(publishAt),
        expiresAt: toISO(expiresAt),
        pinned,
        priority,
        audience: {
          mode: audienceMode,
          facultyIds:
            audienceMode === 'faculty'
              ? selectedFacultyIds
              : audienceMode === 'batches' && batchFacultyId
              ? [batchFacultyId] // for context
              : [],
          batchIds: audienceMode === 'batches' ? selectedBatchIds : [],
        },
      };

      const res = await fetch(EP.create, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to create announcement');
      }
      notifySuccess(forcePublished ?? published ? 'Announcement published' : 'Draft saved');
      resetForm();
    } catch (err: any) {
      notifyError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="mx-auto max-w-5xl p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Create Announcement</h1>
                <p className="text-gray-600">Share important updates with students and faculty</p>
              </div>
            </div>

            {/* NEW: Totals chips */}
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

        <form onSubmit={(e) => handleSubmit(e)} className="space-y-8">
          {/* Basic Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Basic Information
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Announcement Type</label>
                  <div className="relative">
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as AnnouncementPayload['type'])}
                      className="w-full appearance-none rounded-lg border border-gray-300 px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
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
                    <svg
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                <div className="lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                    placeholder="e.g., Midterm Exam Routine (BCA)"
                    required
                  />
                </div>
              </div>

              {/* Summary */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Summary <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                  placeholder="Brief one-line summary of the announcement"
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">{summary.length}/500 characters</p>
              </div>
            </div>
          </div>

          {/* Content Editor */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Content
              </h2>
            </div>
            <div className="p-6">
              <TiptapEditor
                content={contentHtml}
                onChange={setContentHtml}
                placeholder="Start writing the announcement content..."
                className="prose-sm min-h-[200px]"
              />
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Rich text content saved as HTML
              </p>
            </div>
          </div>

          {/* Audience */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-sky-600 to-cyan-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5" />
                Audience
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex flex-wrap gap-3">
                <label
                  className={`px-3 py-2 rounded-lg border cursor-pointer text-sm ${
                    audienceMode === 'all' ? 'bg-sky-50 border-sky-300 text-sky-800' : 'bg-gray-50 border-gray-300 text-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="aud"
                    className="sr-only"
                    checked={audienceMode === 'all'}
                    onChange={() => setAudienceMode('all')}
                  />
                  All (everyone)
                </label>
                <label
                  className={`px-3 py-2 rounded-lg border cursor-pointer text-sm flex items-center gap-2 ${
                    audienceMode === 'faculty' ? 'bg-sky-50 border-sky-300 text-sky-800' : 'bg-gray-50 border-gray-300 text-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="aud"
                    className="sr-only"
                    checked={audienceMode === 'faculty'}
                    onChange={() => setAudienceMode('faculty')}
                  />
                  <GraduationCap className="w-4 h-4" /> Faculty (all batches under selected faculty)
                </label>
                <label
                  className={`px-3 py-2 rounded-lg border cursor-pointer text-sm ${
                    audienceMode === 'batches' ? 'bg-sky-50 border-sky-300 text-sky-800' : 'bg-gray-50 border-gray-300 text-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="aud"
                    className="sr-only"
                    checked={audienceMode === 'batches'}
                    onChange={() => setAudienceMode('batches')}
                  />
                  Batches (choose faculty ➜ pick batches)
                </label>
              </div>

              {/* Faculty mode */}
              {audienceMode === 'faculty' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-700">
                      Select faculty <span className="text-gray-400">({selectedFacultyIds.length} selected)</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllFaculty}
                        className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 border"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={clearFaculty}
                        className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 border"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <select
                    multiple
                    value={selectedFacultyIds}
                    onChange={(e) => onMultiSelectChange(e, setSelectedFacultyIds)}
                    size={Math.min(10, Math.max(6, faculty.length || 6))}
                    className="w-full rounded-lg border border-gray-300 p-2 bg-gray-50 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
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

                  <p className="text-xs text-gray-500">
                    Hint: This targets <strong>all batches</strong> under the selected faculty.
                  </p>
                </div>
              )}

              {/* Batches mode */}
              {audienceMode === 'batches' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Choose Faculty</label>
                    <select
                      value={batchFacultyId}
                      onChange={(e) => {
                        setBatchFacultyId(e.target.value);
                        setSelectedBatchIds([]);
                      }}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all duration-200"
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

                  <div className={`${batchFacultyId ? '' : 'opacity-50 pointer-events-none'}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-700">
                        Select batches <span className="text-gray-400">({selectedBatchIds.length} selected)</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={selectAllBatches}
                          disabled={!batchFacultyId || loadingBatches || batches.length === 0}
                          className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 border disabled:opacity-50"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={clearBatches}
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
                      onChange={(e) => onMultiSelectChange(e, setSelectedBatchIds)}
                      size={Math.min(10, Math.max(6, batches.length || 6))}
                      className="w-full rounded-lg border border-gray-300 p-2 bg-gray-50 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                    >
                      {!batchFacultyId ? (
                        <option disabled>Select a faculty first</option>
                      ) : loadingBatches ? (
                        <option>Loading…</option>
                      ) : batches.length === 0 ? (
                        <option disabled>No batches found for this faculty</option>
                      ) : (
                        batches.map((b) => (
                          <option key={b._id} value={b._id}>
                            {batchLabel(b)}
                          </option>
                        ))
                      )}
                    </select>

                    <p className="text-xs text-gray-500 mt-1">
                      Hold <kbd>Ctrl</kbd>/<kbd>⌘</kbd> to select multiple. If you want <strong>all batches</strong> in a
                      faculty, use the <em>Faculty</em> mode instead.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Media & Attachments */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-teal-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Media & Attachments
              </h2>
            </div>
            <div className="p-6 space-y-8">
              {/* Images */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <ImageIcon className="w-4 h-4 text-green-600" />
                    Images (Posters/Banners)
                    <span className="text-xs text-gray-500">({imageFiles.length})</span>
                  </div>
                  {imageFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAllImages}
                      className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-green-400 transition-colors duration-200">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      const v = validateAdd('image', imageFiles.length, files);
                      if (!v.ok) {
                        notifyError(v.error);
                        e.currentTarget.value = '';
                        return;
                      }
                      setImageFiles((prev) => mergeUniqueFiles(prev, files));
                      e.currentTarget.value = '';
                      notifySuccess(`${files.length} image(s) added`);
                    }}
                    className="w-full"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <div className="text-center">
                      <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-gray-600">Click to upload images or drag and drop</p>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to {MAX_FILE_SIZE_MB}MB each</p>
                    </div>
                  </label>
                </div>

                {imagePreviews.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Preview</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {imagePreviews.map((src, i) => (
                        <div key={`${fileKey(imageFiles[i])}-${i}`} className="relative group">
                          <div className="aspect-square rounded-lg border-2 border-gray-200 overflow-hidden bg-gray-50">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt={`preview-${i}`}
                              className="w-full h-full object-cover cursor-pointer"
                              onClick={() => openImagePreview(i)}
                            />
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => openImagePreview(i)}
                              className="p-2 rounded bg-black/60 text-white"
                              title="Preview"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeImageAt(i)}
                              className="p-2 rounded bg-red-600 text-white"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Files */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <FileIcon className="w-4 h-4 text-blue-600" />
                    Document Files (PDF, DOCX, PPTX, XLSX, etc.)
                    <span className="text-xs text-gray-500">({docFiles.length})</span>
                  </div>
                  {docFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAllDocs}
                      className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors duration-200">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      const v = validateAdd('doc', docFiles.length, files);
                      if (!v.ok) {
                        notifyError(v.error);
                        e.currentTarget.value = '';
                        return;
                      }
                      setDocFiles((prev) => mergeUniqueFiles(prev, files));
                      e.currentTarget.value = '';
                      notifySuccess(`${files.length} file(s) added`);
                    }}
                    className="w-full"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="text-center">
                      <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <p className="text-gray-600">Click to upload files or drag and drop</p>
                      <p className="text-xs text-gray-500 mt-1">Up to {MAX_FILE_SIZE_MB}MB each</p>
                    </div>
                  </label>
                </div>

                {docFiles.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Selected Files</h4>
                    <div className="space-y-2">
                      {docFiles.map((file, i) => (
                        <div key={`${fileKey(file)}-${i}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                          <FileIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                            <p className="text-xs text-gray-500">
                              {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || 'unknown'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openFilePreview(i)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-blue-600 text-white text-xs hover:bg-blue-700"
                              title="Preview (Office viewer for DOCX/PPTX/XLSX; inline for PDF)"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => removeDocAt(i)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-red-600 text-white text-xs hover:bg-red-700"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-600 to-red-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <LinkIcon className="w-5 h-5" />
                  External Links
                </h2>
                <button
                  type="button"
                  onClick={addLink}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors duration-200"
                >
                  <Plus className="w-4 h-4" /> Add Link
                </button>
              </div>
            </div>
            <div className="p-6">
              {links.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <p className="text-gray-500 text-sm">No external links added yet</p>
                  <p className="text-gray-400 text-xs mt-1">Add links to registration forms, documents, or other resources</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {links.map((l, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 items-end">
                        <div className="lg:col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Link Label (optional)</label>
                          <input
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all duration-200"
                            placeholder="e.g., Registration Form"
                            value={l.label ?? ''}
                            onChange={(e) => updateLink(i, { label: e.target.value })}
                          />
                        </div>
                        <div className="lg:col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            URL <span className="text-red-500">*</span>
                          </label>
                          <input
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all duration-200"
                            placeholder="https://example.com/registration"
                            value={l.url}
                            onChange={(e) => updateLink(i, { url: e.target.value })}
                          />
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => removeLink(i)}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors duration-200"
                            title="Remove link"
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

          {/* Publishing Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Publishing Settings
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority Level</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as AnnouncementPayload['priority'])}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all duration-200"
                  >
                    <option value="normal">🔵 Normal</option>
                    <option value="high">🟡 High Priority</option>
                    <option value="urgent">🔴 Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Publish At <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={publishAt ?? ''}
                    onChange={(e) => setPublishAt(e.target.value || null)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expires At <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={expiresAt ?? ''}
                    onChange={(e) => setExpiresAt(e.target.value || null)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all duration-200"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={published}
                      onChange={(e) => setPublished(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                        published ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {published && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Publish immediately</span>
                </label>

                <button
                  type="button"
                  onClick={() => setPinned((p) => !p)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-200 ${
                    pinned ? 'bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100' : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                  title={pinned ? 'Remove from top of announcements' : 'Pin to top of announcements'}
                >
                  {pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  {pinned ? 'Pinned to Top' : 'Pin to Top'}
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
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Publishing...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Publish Announcement
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={(e) => handleSubmit(e as any, false)}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
              >
                <Upload className="w-5 h-5" />
                Save as Draft
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 font-medium"
              >
                <Trash2 className="w-5 h-5" />
                Reset Form
              </button>
            </div>

            {/* NEW: Totals display */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-800 border border-green-200">
                  <CheckCircle2 className="w-4 h-4" /> Success: {successCount}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-800 border border-red-200">
                  <AlertTriangle className="w-4 h-4" /> Errors: {errorCount}
                </span>
                <button
                  type="button"
                  onClick={resetTotals}
                  className="ml-2 text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 border"
                  title="Reset counters"
                >
                  Reset totals
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm mt-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${published ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-gray-600">Status: {published ? 'Will be published' : 'Draft only'}</span>
                </div>
                {pinned && (
                  <div className="flex items-center gap-2">
                    <Pin className="w-3 h-3 text-yellow-600" />
                    <span className="text-yellow-700">Pinned announcement</span>
                  </div>
                )}
                {priority !== 'normal' && (
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${priority === 'urgent' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                    <span className="text-gray-600">Priority: {priority}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* ===== Preview Modal ===== */}
      {preview?.open && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex flex-col">
          <div className="flex items-center justify-between p-3 text-white bg-black/50">
            <div className="truncate">
              <span className="text-sm opacity-80 mr-2">Previewing:</span>
              <span className="text-sm font-medium truncate max-w-[60vw] inline-block align-bottom">
                {preview.title || (preview.kind === 'image' ? 'Image' : 'File')}
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
            {preview.kind === 'image' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.src} alt={preview.title || 'image'} className="w-full h-full object-contain rounded bg-white" />
            )}
            {preview.kind === 'file' &&
              (preview.isOffice ? (
                <iframe title="Microsoft Online Viewer" src={preview.src} className="w-full h-full rounded bg-white" allow="fullscreen" />
              ) : preview.mime === PDF_MIME || preview.src.startsWith('blob:') ? (
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
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
