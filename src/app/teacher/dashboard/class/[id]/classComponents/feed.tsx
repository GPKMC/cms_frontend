"use client";
import { useEffect, useState, useRef, JSX, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  AlertCircle,
  Loader2,
  Megaphone,
  FileText,
  BookOpenCheck,
  HelpCircle,
  ListChecks,
  User,
  Users2Icon,
  Download,
  Eye,
  FileText as FileTextIcon,
  FileImage as FileImageIcon,
  FileSpreadsheet as FileSpreadsheetIcon,
  FileJson as FileJsonIcon,
  FileArchive as FileArchiveIcon,
  FileAudio as FileAudioIcon,
  FileVideo as FileVideoIcon,
  FileCode as FileCodeIcon,
  FileIcon,
} from "lucide-react";
import { FaFilePowerpoint } from "react-icons/fa";
import Image from "next/image";
import { useUser } from "../../../teacherContext";

// NEW: import EditAnnouncementModal (expected to be in same folder — adjust path if different)
import EditAnnouncementModal from "../announcementeditform";

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days !== 1 ? "s" : ""} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? "s" : ""} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years !== 1 ? "s" : ""} ago`;
}

type FeedItemType =
  | "announcement"
  | "assignment"
  | "groupAssignment"
  | "material"
  | "quiz"
  | "question";

interface FeedItemBase {
  _id: string;
  title: string;
  content?: string;
  createdAt: string;
  updatedAt?: string;
  postedBy?: { _id: string; username: string; email: string; role: string };
  images?: string[];
  documents?: string[];
  links?: string[];
  youtubeLinks?: string[];
  topic?: string | null;
}

interface FeedGroupAssignment extends FeedItemBase {
  type: "groupAssignment";
  groups?: {
    _id?: string;
    id?: string;
    name?: string;
    members: Array<string | { _id: string }>;
    [key: string]: any;
  }[];
}

type FeedItem =
  | (FeedItemBase & { type: Exclude<FeedItemType, "groupAssignment"> })
  | FeedGroupAssignment;

interface Props {
  courseInstanceId: string;
}

const getOriginalFileName = (path: string) => {
  const filename = path.split("/").pop() || "";
  const match = filename.match(/^(?:[\d-]+-)+(.*)$/);
  return match ? match[1] : filename;
};

const fileTypeFromUrl = (url: string) => {
  const lower = url.toLowerCase();
  if (/\.(jpg|jpeg|png|gif)$/.test(lower)) return "image";
  if (lower.endsWith(".pdf")) return "pdf";
  if (/\.(ppt|pptx)$/.test(lower)) return "ppt";
  if (/\.(doc|docx)$/.test(lower)) return "word";
  if (/\.(xls|xlsx|csv)$/.test(lower)) return "excel";
  if (lower.endsWith(".txt")) return "txt";
  if (lower.endsWith(".json")) return "json";
  if (/\.(zip|rar)$/.test(lower)) return "zip";
  if (/\.(mp3|wav)$/.test(lower)) return "audio";
  if (/\.(mp4|avi|mov)$/.test(lower)) return "video";
  if (/\.(js|ts)$/.test(lower)) return "code";
  return "other";
};

const getFileIcon = (type: string) => {
  switch (type) {
    case "pdf":
      return <FileTextIcon className="text-red-500" />;
    case "word":
      return (
        <Image src={"/wordicon.svg"} alt="word icon" height={22} width={22} />
      );
    case "excel":
      return <FileSpreadsheetIcon className="text-green-600" />;
    case "ppt":
      return <FaFilePowerpoint className="text-orange-500" />;
    case "image":
      return <FileImageIcon className="text-yellow-400" />;
    case "txt":
      return <FileTextIcon className="text-gray-600" />;
    case "json":
      return <FileJsonIcon className="text-green-700" />;
    case "zip":
      return <FileArchiveIcon className="text-orange-700" />;
    case "audio":
      return <FileAudioIcon className="text-purple-700" />;
    case "video":
      return <FileVideoIcon className="text-indigo-700" />;
    case "code":
      return <FileCodeIcon className="text-violet-700" />;
    default:
      return <FileIcon className="text-gray-400" />;
  }
};

function getOfficePreviewUrl(url: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
    url
  )}`;
}

function TxtPreview({ url }: { url: string }) {
  const [text, setText] = useState("Loading...");
  useEffect(() => {
    fetch(url)
      .then((r) => r.text())
      .then(setText)
      .catch(() => setText("Could not load file."));
  }, [url]);
  return (
    <pre className="overflow-x-auto max-h-[350px] bg-gray-50 p-3">{text}</pre>
  );
}

function openFullscreen(elem: HTMLImageElement | HTMLIFrameElement | null) {
  if (!elem) return;
  (elem as any).requestFullscreen?.() ||
    (elem as any).webkitRequestFullscreen?.() ||
    (elem as any).msRequestFullscreen?.();
}

// Route segments for teacher details pages (no leading slash)
const typeMeta: Record<FeedItemType, { icon: JSX.Element; route: string }> = {
  announcement: {
    icon: <Megaphone className="h-5 w-5 text-indigo-600" />,
    route: "announcement",
  },
  assignment: {
    icon: <FileText className="h-5 w-5 text-pink-600" />,
    route: "Assignment",
  },
  groupAssignment: {
    icon: <Users2Icon className="h-5 w-5 text-yellow-300" />,
    route: "groupAssignment",
  },
  material: {
    icon: <BookOpenCheck className="h-5 w-5 text-blue-600" />,
    route: "materials",
  },
  quiz: {
    icon: <ListChecks className="h-5 w-5 text-yellow-600" />,
    route: "quizzes",
  },
  question: {
    icon: <HelpCircle className="h-5 w-5 text-emerald-600" />,
    route: "Question",
  },
};

export default function CourseFeed({ courseInstanceId }: Props) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state for per-announcement menu, edit modal and delete modal
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [announcementToEdit, setAnnouncementToEdit] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Preview modal state (single modal outside list)
  const [previewDoc, setPreviewDoc] = useState<{ url: string; type: string } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const router = useRouter();
  const rawPathname = usePathname();
  const pathname = rawPathname ?? ""; // ✅ normalize so it's never null

  const sp = useSearchParams(); // may be URLSearchParams | null in your typings
  const { user } = useUser();
  const role = user?.role;

  // ✅ Read highlight params once, guarding for possibly-null sp
  const initialHighlightRef = useRef<{ id: string | null; type: FeedItemType | null } | null>(null);
  if (initialHighlightRef.current === null) {
    const id = sp?.get("highlight") ?? null;
    const typeParam = (sp?.get("type") as FeedItemType | null) ?? null;
    initialHighlightRef.current = {
      id,
      type: typeParam || "announcement",
    };
  }

  // ✅ guard to ensure we only auto-scroll one time
  const didAutoScrollRef = useRef(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Normalize API → flat feed
  function normalizePayloadToFeed(payload: any): FeedItem[] {
    if (payload?.feed && Array.isArray(payload.feed)) return payload.feed as FeedItem[];

    if (Array.isArray(payload)) {
      const items: FeedItem[] = [];
      payload.forEach((bucket: any) => {
        (bucket.materials || []).forEach((m: any) =>
          items.push({ ...m, type: "material" })
        );
        (bucket.assignments || []).forEach((a: any) =>
          items.push({ ...a, type: "assignment" })
        );
        (bucket.questions || []).forEach((q: any) =>
          items.push({ ...q, type: "question" })
        );
        (bucket.groupAssignments || []).forEach((ga: any) =>
          items.push({ ...ga, type: "groupAssignment" })
        );
        (bucket.quizzes || []).forEach((qz: any) =>
          items.push({ ...qz, type: "quiz" })
        );
      });
      items.sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime()
      );
      return items;
    }
    return [];
  }

  // Extracted fetch so it can be reused after edit/delete
  const fetchFeed = useCallback(async () => {
    if (!courseInstanceId) return;
    setLoading(true);
    setError(null);
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL;
      if (!base) throw new Error("NEXT_PUBLIC_BACKEND_URL is not set");

      const teacherTok =
        localStorage.getItem("token_teacher") ||
        sessionStorage.getItem("token_teacher");
      const studentTok =
        localStorage.getItem("token_student") ||
        sessionStorage.getItem("token_student");
      const token =
        (role === "teacher" ? teacherTok : studentTok) || teacherTok || studentTok;
      if (!token) throw new Error("Auth token missing");

      const url = `${base}/student/course-instance/${courseInstanceId}/feed`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error(`Failed to fetch feed: ${res.status}`);
      const raw = await res.json();

      setFeed(normalizePayloadToFeed(raw));
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [courseInstanceId, role]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Teacher sees ALL group assignments; students only those where they’re a member
  const userId = (user?._id || (user as any)?.id || "").toString();
  const filteredFeed = feed.filter((item) => {
    if (item.type !== "groupAssignment") return true;
    if (role === "teacher") return true;

    const groups = (item as FeedGroupAssignment).groups || [];
    return groups.some((g) =>
      (g.members || []).some((m: any) => {
        const mid = (typeof m === "string" ? m : m?._id) || "";
        return mid.toString() === userId;
      })
    );
  });

  // ✅ Auto-scroll exactly once, then clear highlight & clean URL
  useEffect(() => {
    if (loading || didAutoScrollRef.current) return;

    const targetId = initialHighlightRef.current?.id;
    const targetType = (
      initialHighlightRef.current?.type || "announcement"
    ).toLowerCase() as string;

    if (!targetId) return;

    const domId = `feed-${targetType}-${targetId}`;
    const el = document.getElementById(domId);
    if (!el) return;

    didAutoScrollRef.current = true;
    setHighlightedId(targetId);
    el.scrollIntoView({ behavior: "smooth", block: "center" });

    const t = setTimeout(() => setHighlightedId(null), 4500);

    // Only call replace if we actually have a pathname (keeps TS happy)
    if (pathname) {
      router.replace(pathname);
    }

    return () => clearTimeout(t);
  }, [loading, filteredFeed, router, pathname]);

  if (loading) {
    return (
      <div className="text-center py-10 text-gray-500 flex flex-col items-center">
        <Loader2 className="animate-spin h-6 w-6 mb-2" />
        Loading feed...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-300 p-4 rounded flex items-center gap-3 text-red-700">
        <AlertCircle className="w-5 h-5" />
        {error}
      </div>
    );
  }

  if (filteredFeed.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        No recent updates available for this course.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {filteredFeed.map((item) => {
          const meta = typeMeta[item.type];
          const icon = meta?.icon;
          const route = meta?.route;

          const cardDomId = `feed-${item.type}-${item._id}`;
          const isHighlighted = highlightedId === item._id;

          if (item.type === "announcement") {
            return (
              <div
                id={cardDomId}
                key={item._id}
                className={`border rounded-lg p-4 bg-white shadow-sm ${
                  isHighlighted
                    ? "ring-2 ring-blue-500 bg-yellow-50"
                    : "border-indigo-100"
                }`}
                title="Announcement"
              >
                <div className="flex items-center justify-between mb-2 relative">
                  <div className="flex items-center gap-2 text-sm text-indigo-700 font-medium">
                    {icon}
                    <span className="capitalize">Announcement</span>
                    {item.updatedAt && item.updatedAt !== item.createdAt && (
                      <span className="ml-2 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold">
                        Updated
                      </span>
                    )}
                  </div>

                  {/* Right side: timestamp and optional author-only menu */}
                  <div className="flex items-center gap-2 relative">
                    <span className="text-xs text-gray-500">
                      {timeAgo(item.updatedAt || item.createdAt)}
                    </span>

                    {/* Show three-dots menu only to the author of the announcement */}
                    {item.postedBy && item.postedBy._id && item.postedBy._id.toString() === userId && (
                      <div className="relative">
                        <button
                          type="button"
                          className="ml-2 px-2 py-1 rounded hover:bg-gray-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === item._id ? null : item._id);
                          }}
                          aria-haspopup="true"
                          aria-expanded={menuOpenId === item._id}
                          title="Actions"
                        >
                          ⋮
                        </button>

                        {menuOpenId === item._id && (
                          <div
                            className="absolute right-0 mt-2 w-36 bg-white border rounded shadow-md z-50"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="w-full text-left px-3 py-2 hover:bg-gray-100"
                              onClick={() => {
                                setAnnouncementToEdit(item._id);
                                setEditModalOpen(true);
                                setMenuOpenId(null);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="w-full text-left px-3 py-2 text-red-600 hover:bg-gray-100"
                              onClick={() => {
                                setAnnouncementToDelete(item._id);
                                setDeleteModalOpen(true);
                                setMenuOpenId(null);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="text-gray-900 font-semibold mb-1 text-base">
                  {item.title}
                </h3>

                {item.content && (
                  <div
                    className="mb-3 text-gray-800 prose prose-sm max-w-none announcement-content"
                    dangerouslySetInnerHTML={{ __html: item.content }}
                  />
                )}

                {(item as any).images?.length > 0 && (
                  <div className="flex gap-4 flex-wrap mt-2">
                    {(item as any).images.map((url: string, idx: number) => {
                      const src = url.startsWith("http")
                        ? url
                        : `${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`;
                      return (
                        <div key={idx} className="relative group">
                          <img
                            src={src}
                            alt=""
                            className="w-24 h-16 object-cover rounded border cursor-pointer hover:opacity-80"
                            onClick={() =>
                              setPreviewDoc({ url: src, type: "image" })
                            }
                            title="Click to view full image"
                          />
                          <a
                            href={src}
                            download
                            className="absolute right-1 top-1 p-1 rounded-full bg-white shadow opacity-80 hover:opacity-100"
                            title="Download Image"
                          >
                            <Download size={16} />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}

                {(item as any).documents?.length > 0 && (
                  <div className="flex gap-4 flex-wrap mt-4">
                    {(item as any).documents.map((url: string, idx: number) => {
                      const fileUrl = url.startsWith("http")
                        ? url
                        : `${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`;
                      const originalName = getOriginalFileName(url);
                      const fileType = fileTypeFromUrl(fileUrl);
                      const previewable = ["pdf", "ppt", "word", "excel", "txt"].includes(
                        fileType
                      );

                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1 border"
                        >
                          <button
                            type="button"
                            className="flex items-center gap-2 font-medium text-blue-700 hover:underline"
                            onClick={() =>
                              previewable
                                ? setPreviewDoc({
                                    url: fileUrl,
                                    type: fileType,
                                  })
                                : window.open(fileUrl, "_blank")
                            }
                            title={`Preview ${originalName}`}
                          >
                            {getFileIcon(fileType)}
                            <span
                              className="text-xs truncate max-w-[110px]"
                              title={originalName}
                            >
                              {originalName}
                              {previewable ? " (Preview)" : ""}
                            </span>
                            <Eye className="ml-1" size={16} />
                          </button>
                          <a
                            href={fileUrl}
                            download={originalName}
                            className="p-1 text-blue-700 hover:bg-blue-50 rounded-full"
                            title={`Download ${originalName}`}
                          >
                            <Download size={16} />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}

                {(item as any).links?.length > 0 && (
                  <div className="mt-2 space-x-2">
                    {(item as any).links.map((link: string, idx: number) => (
                      <a
                        key={idx}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline break-all"
                      >
                        {link}
                      </a>
                    ))}
                  </div>
                )}

                {(item as any).youtubeLinks?.length > 0 && (
                  <div className="mt-2 flex gap-3">
                    {(item as any).youtubeLinks.map((url: string, idx: number) => {
                      const match = url.match(
                        /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]+)/
                      );
                      const embedUrl = match
                        ? `https://www.youtube.com/embed/${match[1]}`
                        : url;
                      return (
                        <iframe
                          key={idx}
                          width="300"
                          height="170"
                          src={embedUrl}
                          title="YouTube video"
                          allowFullScreen
                          className="rounded"
                        />
                      );
                    })}
                  </div>
                )}

                <div className="mt-3 text-sm text-gray-600 flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  {item.postedBy ? (
                    <>
                      {item.postedBy.username} ({item.postedBy.role})
                    </>
                  ) : (
                    <span className="italic text-gray-400">
                      Unknown poster
                    </span>
                  )}
                </div>
              </div>
            );
          }

          // All other types → card that navigates
          return (
            <div
              id={cardDomId}
              key={item._id}
              className={`border border-gray-200 rounded-lg p-4 bg-white shadow-sm cursor-pointer hover:bg-blue-50 transition ${
                isHighlighted ? "ring-2 ring-blue-500 bg-yellow-50" : ""
              }`}
              onClick={() => {
                router.push(
                  `/teacher/dashboard/class/${courseInstanceId}/Details/${typeMeta[item.type].route}/${item._id}`
                );
              }}
              title={`View details of this ${item.type}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                  {icon}
                  <span className="capitalize">{item.type}</span>
                  {item.updatedAt && item.updatedAt !== item.createdAt && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold">
                      Updated
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {timeAgo(item.updatedAt || item.createdAt)}
                </span>
              </div>
              <h3 className="text-gray-900 font-semibold mb-1 text-base">
                {item.title}
              </h3>
              {item.content && (
                <div
                  className="mb-3 text-gray-800 prose prose-sm max-w-none announcement-content"
                  dangerouslySetInnerHTML={{ __html: item.content }}
                />
              )}
              <div className="text-sm text-gray-600 flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                {item.postedBy ? (
                  <>
                    {item.postedBy.username} ({item.postedBy.role})
                  </>
                ) : (
                  <span className="italic text-gray-400">Unknown poster</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit modal (external component) */}
      {editModalOpen && announcementToEdit && (
        <EditAnnouncementModal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setAnnouncementToEdit(null);
          }}
          announcementId={announcementToEdit}
          courseInstanceId={courseInstanceId}
          onSuccess={() => {
            setEditModalOpen(false);
            setAnnouncementToEdit(null);
            fetchFeed();
          }}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteModalOpen && announcementToDelete && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-2">Confirm delete</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this announcement? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded bg-gray-100"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setAnnouncementToDelete(null);
                }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="px-3 py-2 rounded bg-red-600 text-white"
                onClick={async () => {
                  setDeleting(true);
                  try {
                    const base = process.env.NEXT_PUBLIC_BACKEND_URL;
                    if (!base) throw new Error("NEXT_PUBLIC_BACKEND_URL is not set");

                    const teacherTok =
                      localStorage.getItem("token_teacher") ||
                      sessionStorage.getItem("token_teacher");
                    const studentTok =
                      localStorage.getItem("token_student") ||
                      sessionStorage.getItem("token_student");
                    const token =
                      (role === "teacher" ? teacherTok : studentTok) || teacherTok || studentTok;
                    if (!token) throw new Error("Auth token missing");

                    // NOTE: adjust endpoint if your backend uses a different route for deleting announcements
                    const url = `${base}/announcement-routes/${announcementToDelete}`;
                    const res = await fetch(url, {
                      method: "DELETE",
                      headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                      },
                    });
                    if (!res.ok) throw new Error(`Failed to delete: ${res.status}`);

                    setFeed((prev) => prev.filter((f) => f._id !== announcementToDelete));
                    setDeleteModalOpen(false);
                    setAnnouncementToDelete(null);
                  } catch (err: any) {
                    // minimal error UI
                    alert(err?.message || "Delete failed");
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single preview modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/70 z-[9999] backdrop-blur-sm flex items-center justify-center transition-all duration-200">
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full shadow-2xl relative flex flex-col">
            <button
              className="absolute top-2 right-2 bg-gray-200 p-1 rounded-full"
              onClick={() => setPreviewDoc(null)}
              title="Close"
            >
              ✕
            </button>

            {["image", "pdf", "ppt", "word", "excel"].includes(previewDoc.type) && (
              <button
                className="absolute top-2 left-2 bg-gray-200 p-1 rounded-full"
                title="Full screen"
                onClick={() =>
                  openFullscreen(
                    previewDoc.type === "image"
                      ? imageRef.current
                      : iframeRef.current
                  )
                }
              >
                ⛶
              </button>
            )}

            <a
              href={previewDoc.url}
              download
              className="absolute bottom-2 right-2 bg-blue-600 text-white p-2 rounded-full"
              title="Download file"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download size={18} />
            </a>

            {previewDoc.type === "image" ? (
              <img
                ref={imageRef}
                src={previewDoc.url}
                alt=""
                className="max-w-full max-h-[80vh] rounded mx-auto"
              />
            ) : previewDoc.type === "pdf" ? (
              <iframe
                ref={iframeRef}
                src={previewDoc.url}
                width="100%"
                height="600px"
                className="rounded"
                allowFullScreen
              />
            ) : ["ppt", "word", "excel"].includes(previewDoc.type) ? (
              <iframe
                ref={iframeRef}
                src={getOfficePreviewUrl(previewDoc.url)}
                width="100%"
                height="500px"
                className="rounded"
                allowFullScreen
              />
            ) : previewDoc.type === "txt" ? (
              <TxtPreview url={previewDoc.url} />
            ) : (
              <div className="text-center text-gray-500">
                Preview not supported for this file type. <br />
                <a
                  href={previewDoc.url}
                  download
                  className="text-blue-600 underline"
                >
                  Download
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
