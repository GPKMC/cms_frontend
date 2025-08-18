"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Inbox, CalendarClock, Archive, FileX2, Clock8, Send,
  Search, Plus, RefreshCw, Eye, Trash2, Edit3, CheckCircle2,
  MoreVertical, Download, ExternalLink, FileText, File, FileSpreadsheet, FileBarChart2,
  Image as ImageIcon, Star, Calendar, Users, BookOpen,
  Activity, Globe, MessageSquare, Layout, Share2, Copy
} from "lucide-react";
import { useRouter } from "next/navigation";
import AnnouncementReplies from "./new/reply";

/* ========= API CONFIG ========= */
const BACKEND = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";
const EP = {
  list: `${BACKEND}/announcement`,
  read: (id: string) => `${BACKEND}/announcement/${id}/notification-details?adminView=true`,
  readFallback: (id: string) => `${BACKEND}/announcement/${id}?adminView=true`,
  markRead: (id: string) => `${BACKEND}/announcement/${id}/read`,
  archive: (id: string) => `${BACKEND}/announcement/${id}/archive`,
  unarchive: (id: string) => `${BACKEND}/announcement/${id}/unarchive`,
  patch: (id: string) => `${BACKEND}/announcement/${id}`,
  del: (id: string) => `${BACKEND}/announcement/${id}`,
  folderCounts: `${BACKEND}/announcement/folder-counts`,
};

const getToken = (): string =>
  (typeof window !== "undefined" &&
    (localStorage.getItem("token_admin") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken"))) || "";

const authHeaders = (json = true): Record<string, string> => {
  const t = getToken();
  const h: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};
  if (json) h["Content-Type"] = "application/json";
  return h;
};

const buildQS = (obj: Record<string, unknown>) =>
  Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && `${v}` !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");

/* ========= Types ========= */
type Audience =
  | { mode: "all" }
  | { mode: "faculty"; facultyIds?: string[] }
  | { mode: "batches"; batchIds?: string[] };

type MyState = { readAt: string | null; archived: boolean; archivedAt: string | null };

type FileObj = { url: string; originalname?: string; filetype?: string; mimetype?: string; size?: number; caption?: string };

type AnnLite = {
  _id: string;
  type: string;
  title: string;
  summary?: string;
  audience?: Audience;
  published?: boolean;
  publishAt?: string | null;
  expiresAt?: string | null;
  pinned?: boolean;
  priority?: "normal" | "high" | "urgent";
  createdAt?: string;
  updatedAt?: string;
  images?: FileObj[];
  files?: FileObj[];
  myState?: MyState;
};

type AnnFull = AnnLite & { contentHtml?: string };

type FolderKey = "inbox" | "drafts" | "scheduled" | "expired" | "archived" | "all";

type FolderCounts = {
  all: number;
  drafts: number;
  scheduled: number;
  expired: number;
  live: number;
  archived: number;
  inbox: number;
};

/* ========= Utils ========= */
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString() : "—");
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const formatBytes = (n?: number) => {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let i = -1, size = n;
  do { size /= 1024; i++; } while (size >= 1024 && i < u.length - 1);
  return `${size.toFixed(size < 10 ? 1 : 0)} ${u[i]}`;
};

function status(a: AnnLite) {
  const now = Date.now();
  const pub = !!a?.published;
  const starts = !a?.publishAt || new Date(a.publishAt).getTime() <= now;
  const notExpired = !a?.expiresAt || new Date(a.expiresAt).getTime() > now;
  if (!pub) return "draft";
  if (!starts) return "scheduled";
  if (!notExpired) return "expired";
  return "live";
}

const ensureArr = <T,>(v: T | T[] | null | undefined): T[] => (Array.isArray(v) ? v : v ? [v] : []);
const normalizeAnn = (x: any): AnnFull => ({
  _id: x?._id || x?.id || "",
  type: x?.type || "general",
  title: x?.title || "(untitled)",
  summary: x?.summary || x?.shortDescription || "",
  audience: x?.audience || { mode: "all" },
  published: !!x?.published,
  publishAt: x?.publishAt || x?.publishedAt || null,
  expiresAt: x?.expiresAt || null,
  pinned: !!x?.pinned,
  priority: x?.priority || "normal",
  createdAt: x?.createdAt || x?.created_at || null,
  updatedAt: x?.updatedAt || x?.updated_at || null,
  images: ensureArr(x?.images).map((f: any) => ({
    url: f?.url || "",
    originalname: f?.originalname || f?.name || "",
    filetype: f?.filetype || f?.mimetype || "",
    size: f?.size,
    caption: f?.caption,
  })),
  files: ensureArr(x?.files).map((f: any) => ({
    url: f?.url || "",
    originalname: f?.originalname || f?.name || "",
    filetype: f?.filetype || f?.mimetype || "",
    size: f?.size,
    caption: f?.caption,
  })),
  myState: x?.myState || { readAt: null, archived: !!x?.archived, archivedAt: x?.archivedAt || null },
  contentHtml: x?.contentHtml || x?.content || "",
});

/* ===== Share helpers ===== */
const stripHtml = (html?: string) =>
  (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const getShareUrl = (id: string) => {
  // If you have a public detail page, adjust the path below.
  // Example: /announcement/[id]
  const base =
    (typeof window !== "undefined" ? window.location.origin : "") ||
    process.env.NEXT_PUBLIC_SHARE_BASE ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "";
  return `${base}/announcement/${id}`;
};

async function shareAnnouncement(a: Pick<AnnFull, "_id" | "title" | "summary" | "contentHtml">) {
  const url = getShareUrl(a._id);
  const text = a.summary || stripHtml(a.contentHtml).slice(0, 200);

  if (typeof navigator !== "undefined" && (navigator as any).share) {
    try {
      await (navigator as any).share({ title: a.title, text, url });
      return;
    } catch {
      // fallthrough to copy
    }
  }

  // Fallbacks
  try {
    await navigator.clipboard?.writeText(url);
    alert("Share link copied to clipboard!");
  } catch {
    // open a simple chooser via prompt
    window.prompt("Copy this link:", url);
  }
}

/* ========= Folder filtering & pagination ========= */
function matchesFolder(a: AnnLite, f: FolderKey) {
  const st = status(a);
  const archived = !!a?.myState?.archived;

  switch (f) {
    case "inbox":
      // Only LIVE (not archived)
      return !archived && st === "live";
    case "drafts":
      return st === "draft";
    case "scheduled":
      return st === "scheduled";
    case "expired":
      return st === "expired";
    case "archived":
      return archived;
    case "all":
    default:
      return true;
  }
}


function paginate<T>(arr: T[], page: number, limit: number) {
  const start = (page - 1) * limit;
  return arr.slice(start, start + limit);
}

/* ========= Main ========= */
export default function AnnouncementAdminMailbox() {
  const [folder, setFolder] = useState<FolderKey>("inbox");
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);

  const [allRows, setAllRows] = useState<AnnLite[]>([]); // raw from API for admin view
  const [rows, setRows] = useState<AnnLite[]>([]);        // filtered + paginated for the list
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [folderCounts, setFolderCounts] = useState<FolderCounts>({
    all: 0, drafts: 0, scheduled: 0, expired: 0, live: 0, archived: 0, inbox: 0,
  });

  const pages = useMemo(() => Math.max(1, Math.ceil((total || 0) / limit)), [total, limit]);
  const startIndex = (page - 1) * limit;

  // const menuRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const router = useRouter();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!menuFor) return;
      const node = rowRefs.current[menuFor];
      if (node && !node.contains(e.target as Node)) setMenuFor(null);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuFor(null);
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuFor]);


  // refilter + repaginate any time folder/page/limit/search/type/allRows change
  useEffect(() => {
    const typed = type.trim().toLowerCase();
    const term = q.trim().toLowerCase();

    let base = allRows;

    if (typed) base = base.filter(r => (r.type || "").toLowerCase() === typed);
    if (term) {
      base = base.filter(r =>
        (r.title || "").toLowerCase().includes(term) ||
        (r.summary || "").toLowerCase().includes(term)
      );
    }

    const filtered = base.filter(r => matchesFolder(r, folder));
    const paged = paginate(filtered, page, limit);
    setRows(paged);
    setTotal(filtered.length);

    // keep selected item visible; if not present, select first
    if (selectedId && !filtered.some(r => r._id === selectedId)) {
      setSelectedId(filtered[0]?._id || null);
    } else if (!selectedId && filtered[0]?._id) {
      setSelectedId(filtered[0]._id);
    }
  }, [allRows, folder, page, limit, q, type, selectedId]);

  useEffect(() => { setPage(1); }, [folder, type, q]);

  useEffect(() => {
    fetchList();
    fetchFolderCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ======= API Calls ======= */
async function fetchList() {
  try {
    setLoading(true);

    // Pull a generous page (backend caps at ~100). We do client filtering/pagination.
    const qs = buildQS({
      page: 1,
      limit: 100,
      adminView: true, // crucial for admin (drafts/scheduled/expired)
    });

    const res = await fetch(`${EP.list}?${qs}`, {
      headers: { ...authHeaders(false) },
      cache: "no-store",
    });

    const json = await res.json().catch(() => ({}));
    const items: any[] =
      Array.isArray(json?.data) ? json.data :
      Array.isArray(json?.items) ? json.items :
      Array.isArray(json) ? json : [];

    const normalized = items.map(normalizeAnn);
    setAllRows(normalized);

    // Immediate local counts so chips are correct even if counts API lags
    setFolderCounts(computeCounts(normalized));
  } catch (e) {
    console.error("fetchList error", e);
    setAllRows([]);
  } finally {
    setLoading(false);
  }
}
// ⬇️ Add this helper in your utils section (anywhere above the component)
function computeCounts(list: AnnLite[]): FolderCounts {
  return list.reduce<FolderCounts>(
    (acc, a) => {
      const st = status(a);
      acc.all++;
      if (st === "draft") acc.drafts++;
      if (st === "scheduled") acc.scheduled++;
      if (st === "expired") acc.expired++;
      if (st === "live") acc.live++;
      if (a?.myState?.archived) acc.archived++;
      if (!a?.myState?.archived && st === "live") acc.inbox++;
      return acc;
    },
    { all: 0, drafts: 0, scheduled: 0, expired: 0, live: 0, archived: 0, inbox: 0 }
  );
}
useEffect(() => {
  setFolderCounts(computeCounts(allRows));
}, [allRows]);


// ⬇️ Replace your existing fetchFolderCounts with this
async function fetchFolderCounts() {
  try {
    const res = await fetch(`${EP.folderCounts}?adminView=true`, {
      headers: { ...authHeaders(false) },
      cache: "no-store",
    });
    if (!res.ok) throw new Error("counts not ok");

    const data = await res.json();
    const d = data?.data || data;

    // Map possible backend key variants for "archived"
    const serverCounts: FolderCounts = {
      all: Number(d?.all ?? 0),
      drafts: Number(d?.drafts ?? 0),
      scheduled: Number(d?.scheduled ?? 0),
      expired: Number(d?.expired ?? 0),
      live: Number(d?.live ?? 0),
      archived: Number(d?.archived ?? d?.archive ?? d?.archieve ?? 0),
      inbox: Number(d?.inbox ?? 0),
    };

    // Merge with local calculation as a safety net
    const localCounts = computeCounts(allRows);
    setFolderCounts({
      ...serverCounts,
      archived: serverCounts.archived || localCounts.archived,
    });
  } catch (e) {
    // Fallback entirely to local calculation
    setFolderCounts(computeCounts(allRows));
  }
}

 async function archive(id: string) {
  // close any open menu quickly for better UX
  setMenuFor(null);

  // 1) optimistic UI update
  const prev = allRows;
  const next = allRows.map(a =>
    a._id === id
      ? {
          ...a,
          myState: {
            ...(a.myState || { readAt: null, archived: false, archivedAt: null }),
            archived: true,
            archivedAt: new Date().toISOString(),
          },
        }
      : a
  );
  setAllRows(next);
  setFolderCounts(computeCounts(next)); // instant chip refresh

  // (optional) jump to the Archived folder right away
  // setFolder("archived");

  try {
    const res = await fetch(EP.archive(id), {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error("Archive failed");

    // 2) light re-sync (don’t block UI)
    fetchFolderCounts();
    fetchList();
  } catch (e) {
    console.error("archive error", e);
    // 3) revert optimistic change if the server call failed
    setAllRows(prev);
    setFolderCounts(computeCounts(prev));
    alert("Could not archive. Please try again.");
  }
}

async function unarchive(id: string) {
  setMenuFor(null);

  const prev = allRows;
  const next = allRows.map(a =>
    a._id === id
      ? {
          ...a,
          myState: {
            ...(a.myState || { readAt: null, archived: false, archivedAt: null }),
            archived: false,
            archivedAt: null,
          },
        }
      : a
  );
  setAllRows(next);
  setFolderCounts(computeCounts(next)); // instant chip refresh

  try {
    const res = await fetch(EP.unarchive(id), {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error("Unarchive failed");

    fetchFolderCounts();
    fetchList();
  } catch (e) {
    console.error("unarchive error", e);
    setAllRows(prev);
    setFolderCounts(computeCounts(prev));
    alert("Could not unarchive. Please try again.");
  }
}


  async function remove(id: string) {
    if (!confirm("Delete this announcement permanently?")) return;
    try {
      await fetch(EP.del(id), { method: "DELETE", headers: authHeaders(false) });
      await fetchList(); await fetchFolderCounts();
    } catch (e) { console.error("delete error", e); }
  }

  // NEW: publish a draft immediately
  async function publishNow(id: string) {
    try {
      const res = await fetch(EP.patch(id), {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({
          published: true,
          publishAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to publish");
      }
      await fetchList();
      await fetchFolderCounts();
      alert("Published 🎉");
    } catch (e: any) {
      alert(e?.message || "Could not publish. Check publish/expiry dates.");
      console.error("publishNow error", e);
    }
  }

  const selectedOne = rows.find((r) => r._id === selectedId) || allRows.find(r => r._id === selectedId) || null;


  /* ========= UI ========= */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30">
      <div className="p-4">
        <div className="max-w-[1800px] mx-auto space-y-4">
          {/* Header */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/40 overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl grid place-items-center">
                  <Inbox className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-black bg-gradient-to-r from-gray-900 to-blue-800 bg-clip-text text-transparent">
                    Announcement Hub
                  </h1>
                  <p className="text-sm text-gray-600">Manage communications efficiently</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => { fetchList(); fetchFolderCounts(); }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-sm font-medium"
                  onClick={() => { router.push("/admin/announcement/new"); }}
                >
                  <Plus className="h-4 w-4" />
                  Create
                </button>
              </div>
            </div>

            <div className="px-6 pb-4">
              <div className="flex gap-2 flex-wrap">
                <StatChip label="Inbox" value={folderCounts.inbox} active={folder === "inbox"} onClick={() => setFolder("inbox")} />
                <StatChip label="Drafts" value={folderCounts.drafts} active={folder === "drafts"} onClick={() => setFolder("drafts")} />
                <StatChip label="Scheduled" value={folderCounts.scheduled} active={folder === "scheduled"} onClick={() => setFolder("scheduled")} />
                <StatChip label="Expired" value={folderCounts.expired} active={folder === "expired"} onClick={() => setFolder("expired")} />
                <StatChip label="Archived" value={folderCounts.archived} active={folder === "archived"} onClick={() => setFolder("archived")} />
                <StatChip label="All" value={folderCounts.all} active={folder === "all"} onClick={() => setFolder("all")} />
              </div>
            </div>
          </div>

          {/* Layout: 2 | 3 | 7 */}
          <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
            {/* Sidebar */}
            <div className="col-span-2">
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/40 h-full">
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 rounded-t-2xl">
                  <h2 className="text-white font-bold text-sm flex items-center gap-2">
                    <Archive className="h-4 w-4" />
                    Folders
                  </h2>
                </div>
                <nav className="p-3 space-y-1">
                  <FolderBtn icon={<Inbox className="h-4 w-4" />} label="Inbox" count={folderCounts.inbox} active={folder === "inbox"} onClick={() => setFolder("inbox")} />
                  <FolderBtn icon={<Edit3 className="h-4 w-4" />} label="Drafts" count={folderCounts.drafts} active={folder === "drafts"} onClick={() => setFolder("drafts")} />
                  <FolderBtn icon={<CalendarClock className="h-4 w-4" />} label="Scheduled" count={folderCounts.scheduled} active={folder === "scheduled"} onClick={() => setFolder("scheduled")} />
                  <FolderBtn icon={<Clock8 className="h-4 w-4" />} label="Expired" count={folderCounts.expired} active={folder === "expired"} onClick={() => setFolder("expired")} />
                  <FolderBtn icon={<Archive className="h-4 w-4" />} label="Archived" count={folderCounts.archived} active={folder === "archived"} onClick={() => setFolder("archived")} />
                  <FolderBtn icon={<FileX2 className="h-4 w-4" />} label="All" count={folderCounts.all} active={folder === "all"} onClick={() => setFolder("all")} />
                </nav>
              </div>
            </div>

            {/* List */}
            <div className="col-span-3">
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/40 h-full flex flex-col">
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3 rounded-t-2xl">
                  <h2 className="text-white font-bold text-sm capitalize flex items-center gap-2">
                    <Layout className="h-4 w-4" />
                    {folder} ({total})
                  </h2>
                </div>

                <div className="p-3 border-b">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm"
                        placeholder="Search..."
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && setPage(1)}
                      />
                    </div>
                    <select className="px-3 py-2 border rounded-lg text-sm" value={type} onChange={(e) => { setType(e.target.value); }}>
                      <option value="">All</option>
                      <option value="general">📢 General</option>
                      <option value="event">🎉 Event</option>
                      <option value="exam">📝 Exam</option>
                      <option value="result">📊 Result</option>
                      <option value="cultural">🎭 Cultural</option>
                    </select>
                  </div>
                </div>

                <div className="flex-1 overflow-auto">
                  {loading ? <SkeletonList /> : rows.length === 0 ? <EmptyList /> : (
                    <div className="divide-y divide-gray-100">
                      {rows.map((r, idx) => {
                        const unread = !r?.myState?.readAt && !r?.myState?.archived;
                        const st = status(r);
                        const isSelected = selectedId === r._id;
                        const number = startIndex + idx + 1;

                        return (
                          <div
                            key={r._id}
                            onClick={() => { setSelectedId(r._id); setMenuFor(null); }}
                            className={`p-3 cursor-pointer hover:bg-blue-50 transition-colors ${isSelected ? "bg-blue-100 border-l-4 border-blue-500" : ""}`}
                          >
                            <div className="flex items-start gap-2">
                              <div className="mt-1">
                                {unread ? <div className="w-2 h-2 bg-blue-500 rounded-full" /> : <CheckCircle2 className="h-3 w-3 text-gray-300" />}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 mb-1">
                                  <span className="text-xs text-gray-500 bg-gray-100 rounded px-1">#{number}</span>
                                  {r.pinned && <Star className="h-3 w-3 text-amber-500" title="Pinned" />}
                                  {r.priority && r.priority !== "normal" && (
                                    <span className="text-[10px] bg-red-500 text-white px-1 rounded">{r.priority.toUpperCase()}</span>
                                  )}
                                </div>

                                <h3 className="font-semibold text-sm mb-1 line-clamp-2">{r.title}</h3>
                                {r.summary && <p className="text-xs text-gray-600 line-clamp-2 mb-1">{r.summary}</p>}

                                <div className="flex items-center gap-1 mb-1 flex-wrap">
                                  <AudiencePill audience={r.audience} />
                                  <StatusBadge status={st} />
                                  <TypeBadge type={r.type} />
                                </div>

                                <div className="text-xs text-gray-500">{fmt(r.createdAt)}</div>
                              </div>

                              <div className="relative" ref={(el) => { rowRefs.current[r._id] = el; }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === r._id ? null : r._id); }}
                                  className="p-1 rounded hover:bg-gray-200"
                                >
                                  <MoreVertical className="h-3 w-3" />
                                </button>
                                {menuFor === r._id && (
                                  <div className="absolute right-0 mt-1 w-44 bg-white border rounded-lg shadow-lg z-20">
                                    <button
                                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-xs"
                                      onClick={(e) => { e.stopPropagation(); shareAnnouncement(r); setMenuFor(null); }}
                                    >
                                      <Share2 className="h-3 w-3" /> Share
                                    </button>
                                    {st === "draft" && (
                                      <button
                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-xs"
                                        onClick={(e) => { e.stopPropagation(); setMenuFor(null); publishNow(r._id); }}
                                      >
                                        <Send className="h-3 w-3" /> Publish now
                                      </button>
                                    )}

                                    {!r?.myState?.archived ? (
                                      <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-xs" onClick={() => archive(r._id)}>
                                        <Archive className="h-3 w-3" /> Archive
                                      </button>
                                    ) : (
                                      <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-xs" onClick={() => unarchive(r._id)}>
                                        <Archive className="h-3 w-3" /> Unarchive
                                      </button>
                                    )}
                                    <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-xs text-red-600" onClick={() => remove(r._id)}>
                                      <Trash2 className="h-3 w-3" /> Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="px-3 py-2 border-t bg-gray-50 rounded-b-2xl flex items-center justify-between">
                  <span className="text-xs text-gray-600">{total} items</span>
                  <div className="flex items-center gap-1">
                    <button
                      className="px-2 py-1 border rounded text-xs disabled:opacity-50"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => clamp(p - 1, 1, pages))}
                    >
                      Prev
                    </button>
                    <span className="text-xs text-gray-600 px-2">
                      {Math.min(page, pages)}/{pages}
                    </span>
                    <button
                      className="px-2 py-1 border rounded text-xs disabled:opacity-50"
                      disabled={page >= pages}
                      onClick={() => setPage((p) => clamp(p + 1, 1, pages))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="col-span-7">
              <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 h-full flex flex-col">
                <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-6 py-4 rounded-t-2xl">
                  <div className="flex items-center justify-between">
                    <h2 className="text-white font-bold text-lg flex items-center gap-3">
                      <Eye className="h-5 w-5" />
                      Preview
                    </h2>
                    {selectedOne && (
                      <div className="flex items-center gap-2">
                        <button
                          className="p-2 rounded-lg bg-white/20 text-white hover:bg-white/30"
                          title="Share"
                          onClick={() => shareAnnouncement(selectedOne)}
                        >
                          <Share2 className="h-4 w-4" />
                        </button>
                        <button
                          className="p-2 rounded-lg bg-white/20 text-white hover:bg-white/30"
                          title="Edit"
                          onClick={() => router.push(`/admin/announcement/${selectedOne._id}/edit`)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        {status(selectedOne) === "draft" && (
                          <button
                            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                            onClick={() => publishNow(selectedOne._id)}
                          >
                            Publish now
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-6">
                  {selectedId ? <BeautifulPreview id={selectedId} onShare={shareAnnouncement} onEdit={(id) => router.push(`/admin/announcement/${id}/edit`)} /> : <EmptyPreview />}
                </div>

                {selectedOne && (
                  <div className="px-6 py-4 border-t bg-gray-50 rounded-b-2xl flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      ID: <code className="bg-gray-200 px-2 py-1 rounded text-xs">{selectedOne._id.slice(-8)}</code>
                    </div>
                    <div className="flex items-center gap-3">
                      {!selectedOne?.myState?.archived ? (
                        <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50" onClick={() => archive(selectedOne._id)}>
                          Archive
                        </button>
                      ) : (
                        <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50" onClick={() => unarchive(selectedOne._id)}>
                          Unarchive
                        </button>
                      )}
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700" onClick={() => router.push(`/admin/announcement/${selectedOne._id}/edit`)}>
                        Edit
                      </button>


                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ========= Helper Components ========= */
function StatChip({ label, value, active, onClick }: { label: string; value: number; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${active ? "bg-blue-100 border-blue-300 text-blue-700" : "bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200"
        }`}
    >
      {label} <span className="bg-white/50 px-2 py-1 rounded-full text-xs">{value}</span>
    </button>
  );
}

function FolderBtn({
  icon, label, active, onClick, count,
}: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-colors ${active ? "bg-blue-100 text-blue-700 border border-blue-200" : "hover:bg-gray-100 text-gray-700"
        }`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      {typeof count === "number" && (
        <span className={`px-2 py-1 rounded text-xs ${active ? "bg-blue-200" : "bg-gray-200"}`}>{count}</span>
      )}
    </button>
  );
}

function AudiencePill({ audience }: { audience?: Audience }) {
  if (!audience || audience.mode === "all")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
        <Globe className="h-2 w-2" /> All
      </span>
    );
  if (audience.mode === "faculty")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
        <Users className="h-2 w-2" /> Faculty
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700">
      <BookOpen className="h-2 w-2" /> Batches
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    live: "bg-green-100 text-green-700",
    scheduled: "bg-blue-100 text-blue-700",
    expired: "bg-red-100 text-red-700",
    draft: "bg-gray-100 text-gray-700",
  };
  const icons: Record<string, React.ReactNode> = {
    live: <Activity className="h-2 w-2" />,
    scheduled: <Calendar className="h-2 w-2" />,
    expired: <Clock8 className="h-2 w-2" />,
    draft: <Edit3 className="h-2 w-2" />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${colors[status] || colors.draft}`}>
      {icons[status] || icons.draft}
      {status}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const emojis: Record<string, string> = { general: "📢", event: "🎉", exam: "📝", result: "📊", cultural: "🎭" };
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700">
      {emojis[type] || "📄"} {type || "General"}
    </span>
  );
}

function EmptyList() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <Inbox className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-gray-900 font-bold mb-2">No announcements</h3>
        <p className="text-gray-500 text-sm">Try adjusting your filters</p>
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="p-3 animate-pulse">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-gray-200 rounded-full mt-1" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-200 rounded w-3/4" />
              <div className="h-2 bg-gray-200 rounded w-full" />
              <div className="flex gap-1">
                <div className="h-4 w-12 bg-gray-200 rounded-full" />
                <div className="h-4 w-16 bg-gray-200 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyPreview() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-6">
        <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-200 rounded-full flex items-center justify-center mx-auto">
          <Eye className="w-12 h-12 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-3">Select an announcement</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Choose an announcement from the list to view its detailed content
          </p>
        </div>
      </div>
    </div>
  );
}

/* ========= Preview (fetches full details) ========= */
function BeautifulPreview({ id, onShare, onEdit }: {
  id: string;
  onShare: (a: Pick<AnnFull, "_id" | "title" | "summary" | "contentHtml">) => void;
  onEdit: (id: string) => void;
}) {
  const [item, setItem] = useState<AnnFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        let res = await fetch(EP.read(id), { headers: { ...authHeaders(false) }, cache: "no-store" });
        if (res.status === 404) res = await fetch(EP.readFallback(id), { headers: { ...authHeaders(false) }, cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        const j = await res.json();
        const data = j?.data || j?.announcement || j;
        const norm = normalizeAnn(data);
        if (alive) setItem(norm);
      } catch (e) {
        console.error("preview load error", e);
        if (alive) setErr("Could not load details for this announcement.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-7 w-2/3 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
        <div className="h-56 w-full bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }
  if (err) return <div className="text-sm text-red-600">{err}</div>;
  if (!item) return <div className="text-gray-500">Not found</div>;

  const st = status(item);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={st} />
          <TypeBadge type={item.type} />
          <AudiencePill audience={item.audience} />
        </div>

        <h1 className="text-3xl font-bold leading-tight text-gray-900">{item.title}</h1>

        {item.summary ? (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border-l-4 border-blue-500">
            <h4 className="text-lg font-bold mb-2 flex items-center gap-2 text-blue-700">
              <MessageSquare className="h-5 w-5" />
              Summary
            </h4>
            <p className="text-gray-700 leading-relaxed">{item.summary}</p>
          </div>
        ) : null}

        {/* Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetaCard icon={<Calendar className="h-5 w-5 text-green-600" />} title="Created" value={fmt(item.createdAt)} tone="green" />
          {item.publishAt && (
            <MetaCard icon={<Send className="h-5 w-5 text-blue-600" />} title="Publish Date" value={fmt(item.publishAt)} tone="blue" />
          )}
          {item.expiresAt && (
            <MetaCard icon={<Clock8 className="h-5 w-5 text-amber-600" />} title="Expires" value={fmt(item.expiresAt)} tone="amber" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-6 py-4 border-b border-gray-200">
          <h3 className="font-bold text-xl text-gray-800 flex items-center gap-3">
            <FileText className="h-6 w-6" />
            Content
          </h3>
        </div>
        <div className="p-6">
          {item.contentHtml ? (
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: item.contentHtml }} />
          ) : (
            <p className="text-gray-600">No content provided.</p>
          )}
        </div>
      </div>

      {/* Images */}
      {item.images?.length ? (
        <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-gray-200">
            <h3 className="font-bold text-xl text-gray-800 flex items-center gap-3">
              <ImageIcon className="h-6 w-6" />
              Images ({item.images.length})
            </h3>
          </div>
          <div className="p-6 grid gap-4 grid-cols-1 lg:grid-cols-2">
            {item.images.map((img, i) => (
              <div key={i} className="group relative">
                <div className="aspect-video rounded-xl overflow-hidden shadow-lg group-hover:shadow-xl transition-all duration-300 border border-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.originalname || `Image ${i + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl transition-all duration-300 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <a
                      href={img.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="bg-white/90 backdrop-blur rounded-full p-3 shadow-lg hover:bg-white transition-all duration-200 inline-flex"
                      title="Open"
                    >
                      <Eye className="h-5 w-5 text-gray-700" />
                    </a>
                  </div>
                </div>
                {img.originalname && <div className="mt-3"><h4 className="font-medium text-gray-800">{img.originalname}</h4></div>}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Files */}
      {item.files?.length ? (
        <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4 border-b border-gray-200">
            <h3 className="font-bold text-xl text-gray-800 flex items-center gap-3">
              <File className="h-6 w-6" />
              Files ({item.files.length})
            </h3>
          </div>
          <div className="p-6 space-y-4">
            {item.files.map((file, i) => (
              <FileRow key={i} f={file} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-4 pt-2">
        <button
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
          onClick={() => onEdit(item._id)}
        >
          <Edit3 className="h-5 w-5" />
          Edit
        </button>
        <button
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
          onClick={() => onShare(item)}
        >
          <Share2 className="h-5 w-5" />
          Share
        </button>
        <a
          className="flex items-center gap-2 px-6 py-3 border-2 border-gray-300 bg-white text-gray-700 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
          href={`mailto:?subject=${encodeURIComponent(item.title)}&body=${encodeURIComponent((item.summary || "") + "\n\n" + getShareUrl(item._id))}`}
        >
          <Copy className="h-5 w-5" />
          Mail
        </a>
        <a
          className="flex items-center gap-2 px-6 py-3 border-2 border-gray-300 bg-white text-gray-700 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
          href={`https://wa.me/?text=${encodeURIComponent(item.title + "\n" + getShareUrl(item._id))}`}
          target="_blank" rel="noreferrer noopener"
        >
          <Share2 className="h-5 w-5" />
          WhatsApp
        </a>
        <a
          className="flex items-center gap-2 px-6 py-3 border-2 border-gray-300 bg-white text-gray-700 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
          href={`https://t.me/share/url?url=${encodeURIComponent(getShareUrl(item._id))}&text=${encodeURIComponent(item.title)}`}
          target="_blank" rel="noreferrer noopener"
        >
          <Share2 className="h-5 w-5" />
          Telegram
        </a>
      </div>
      <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-fuchsia-50 to-violet-50 px-6 py-4 border-b border-gray-200">
          <h3 className="font-bold text-xl text-gray-800 flex items-center gap-3">
            <MessageSquare className="h-6 w-6" />
            Discussion
          </h3>
        </div>
        <div className="p-6">
          {/* You can also pass currentUserId and isAdmin if you have them */}
          <AnnouncementReplies
            announcementId={id}
            isAdmin={true}              // or compute from your auth context
            // currentUserId={me?._id}  // optional if you have it
            adminView={true}            // lets admin reply on drafts/scheduled
          />
        </div>
      </div>
    </div>
  );
}

/* ========= Preview helpers ========= */
type Tone = "green" | "blue" | "amber";
function MetaCard({ icon, title, value, tone }: { icon: React.ReactNode; title: string; value: string; tone: Tone }) {
  const tones: Record<Tone, string> = {
    green: "from-green-50 to-emerald-50 border-green-200 text-green-700",
    blue: "from-blue-50 to-sky-50 border-blue-200 text-blue-700",
    amber: "from-amber-50 to-orange-50 border-amber-200 text-amber-700",
  };
  return (
    <div className={`rounded-xl p-4 border bg-gradient-to-br ${tones[tone]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function FileRow({ f }: { f: FileObj }) {
  const url = f?.url || "#";
  const name = f?.originalname || url.split("/").pop() || "file";
  const mt = (f?.filetype || f?.mimetype || "").toLowerCase();
  const officeUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;

  const office =
    mt.includes("msword") ||
    mt.includes("officedocument") ||
    mt.includes("ms-powerpoint") ||
    mt.includes("ms-excel") ||
    /\.(docx?|xlsx?|pptx?)$/i.test(name || "");

  return (
    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200 hover:border-blue-300 transition-all duration-200 group">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-200">
          {getFileIcon(name, mt)}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-gray-800 truncate" title={name}>
            {name}
          </h4>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600">{mt || "file"}</span>
            {f?.size ? (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-gray-600">{formatBytes(f.size)}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {office && (
          <a
            href={officeUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 text-sm font-medium"
          >
            <ExternalLink className="h-4 w-4" />
            View
          </a>
        )}
        <a
          href={url}
          download
          className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 text-sm font-medium"
        >
          <Download className="h-4 w-4" />
          Download
        </a>
      </div>
    </div>
  );
}

/* ========= Icons ========= */
function getFileIcon(filename?: string, mimetype?: string) {
  const name = (filename || "").toLowerCase();
  const type = (mimetype || "").toLowerCase();

  if (name.endsWith(".pdf") || type.includes("pdf")) return <FileText className="h-6 w-6 text-white" />;
  if (/\.(xlsx?|csv)$/.test(name) || type.includes("spreadsheet") || type.includes("excel"))
    return <FileSpreadsheet className="h-6 w-6 text-white" />;
  if (/\.(pptx?|key)$/.test(name) || type.includes("presentation")) return <FileBarChart2 className="h-6 w-6 text-white" />;
  if (name.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff?)$/i) || type.startsWith("image/")) return <ImageIcon className="h-6 w-6 text-white" />;
  return <File className="h-6 w-6 text-white" />;
}
