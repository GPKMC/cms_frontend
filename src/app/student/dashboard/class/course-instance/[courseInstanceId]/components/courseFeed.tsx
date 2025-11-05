"use client";
import { useEffect, useState, useRef, JSX } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  AlertCircle, Loader2, Megaphone, FileText, BookOpenCheck, HelpCircle, ListChecks, User,
  Users2Icon, Download, Eye, FileText as FileTextIcon, FileImage as FileImageIcon,
  FileSpreadsheet as FileSpreadsheetIcon, FileJson as FileJsonIcon, FileArchive as FileArchiveIcon,
  FileAudio as FileAudioIcon, FileVideo as FileVideoIcon, FileCode as FileCodeIcon, FileIcon,
} from "lucide-react";
import { FaFilePowerpoint } from "react-icons/fa";
import Image from "next/image";
import { useUser } from "@/app/student/dashboard/studentContext";

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

type FeedItemType = "announcement" | "assignment" | "groupAssignment" | "material" | "quiz" | "question";
interface FeedItem {
  _id: string;
  type: FeedItemType;
  title: string;
  content?: string;
  createdAt: string;
  updatedAt?: string;
  postedBy?: {
    _id: string;
    username: string;
    email: string;
    role: string;
  };
  images?: string[];
  documents?: string[];
  links?: string[];
  youtubeLinks?: string[];
  groups?: {
    _id: string;
    members: { _id: string }[] | string[];
    name?: string;
    [key: string]: any;
  }[];
}

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
    case "pdf": return <FileTextIcon className="text-red-500" />;
    case "word": return <Image src={"/wordicon.svg"} alt="word icon" height={22} width={22} />;
    case "excel": return <FileSpreadsheetIcon className="text-green-600" />;
    case "ppt": return <FaFilePowerpoint className="text-orange-500" />;
    case "image": return <FileImageIcon className="text-yellow-400" />;
    case "txt": return <FileTextIcon className="text-gray-600" />;
    case "json": return <FileJsonIcon className="text-green-700" />;
    case "zip": return <FileArchiveIcon className="text-orange-700" />;
    case "audio": return <FileAudioIcon className="text-purple-700" />;
    case "video": return <FileVideoIcon className="text-indigo-700" />;
    case "code": return <FileCodeIcon className="text-violet-700" />;
    default: return <FileIcon className="text-gray-400" />;
  }
};

function getOfficePreviewUrl(url: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}

function TxtPreview({ url }: { url: string }) {
  const [text, setText] = useState("Loading...");
  useEffect(() => {
    fetch(url)
      .then(r => r.text())
      .then(setText)
      .catch(() => setText("Could not load file."));
  }, [url]);
  return <pre className="overflow-x-auto max-h-[350px] bg-gray-50 p-3">{text}</pre>;
}

function openFullscreen(elem: HTMLImageElement | HTMLIFrameElement | null) {
  if (!elem) return;
  (elem as any).requestFullscreen?.() ||
    (elem as any).webkitRequestFullscreen?.() ||
    (elem as any).msRequestFullscreen?.();
}

const typeMeta: Record<FeedItemType, { icon: JSX.Element, route: string }> = {
  announcement: { icon: <Megaphone className="h-5 w-5 text-indigo-600" />, route: "/announcement" },
  assignment: { icon: <FileText className="h-5 w-5 text-pink-600" />, route: "/assignment" },
  groupAssignment: { icon: <Users2Icon className="h-5 w-5 text-yellow-300" />, route: "/group-assignments" },
  material: { icon: <BookOpenCheck className="h-5 w-5 text-blue-600" />, route: "/materials" },
  quiz: { icon: <ListChecks className="h-5 w-5 text-yellow-600" />, route: "/quizzes" },
  question: { icon: <HelpCircle className="h-5 w-5 text-emerald-600" />, route: "/questions" }
};

export default function CourseFeed({ courseInstanceId }: Props) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Preview modal state
  const [previewDoc, setPreviewDoc] = useState<{ url: string; type: string } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { user } = useUser();

  // One-time auto-scroll control + highlight id
  const didAutoScrollRef = useRef(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    if (!courseInstanceId) return;
    setLoading(true);
    setError(null);

    const fetchFeed = async () => {
      try {
        const token =
          localStorage.getItem("token_student") ||
          sessionStorage.getItem("token_student");
        if (!token) throw new Error("Token missing");

        const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
        const res = await fetch(
          `${base}/student/course-instance/${courseInstanceId}/feed`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            }
          }
        );
        if (!res.ok) throw new Error(`Failed to fetch feed: ${res.status}`);
        const result = await res.json();
        setFeed(result.feed || []);
      } catch (err) {
        setError((err as Error).message || "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchFeed();
  }, [courseInstanceId]);

  useEffect(() => {
    if (!previewDoc) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewDoc(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [previewDoc]);

  // Filter group assignments to only those where user is a group member
  const filteredFeed = feed.filter((item) => {
    if (item.type === "groupAssignment") {
      if (!user || !Array.isArray(item.groups)) return false;
      const userId = (user._id || (user as any).id || "").toString();
      return item.groups.some(group =>
        (group.members || []).some((m: any) => {
          const mid = typeof m === "string" ? m : m?._id;
          return (mid || "").toString() === userId;
        })
      );
    }
    return true;
  });

  // 🔗 Deep-link: scroll once to an announcement & highlight, then remove effect
  useEffect(() => {
    if (loading || didAutoScrollRef.current) return;

    const type = (searchParams?.get("type") || "").toLowerCase();
    const targetId = searchParams?.get("highlight") || "";

    if (type === "announcement" && targetId) {
      const el = document.getElementById(`announcement-${targetId}`);
      if (el) {
        didAutoScrollRef.current = true;
        setHighlightedId(targetId);
        el.scrollIntoView({ behavior: "smooth", block: "center" });

        // Remove highlight after a moment so page returns to normal
        const t = setTimeout(() => setHighlightedId(null), 4500);

        // Clean the URL to avoid future auto-scrolls (keeps the same route)
        router.replace(pathname || "/");

        return () => clearTimeout(t);
      }
    }
  }, [loading, filteredFeed, searchParams, pathname, router]);

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
    <div className="space-y-4">
      {filteredFeed.map(item => {
        const { icon, route } = typeMeta[item.type];

        // Announcements: Inline full content and all attachments!
        if (item.type === "announcement") {
          const isHL = highlightedId === item._id;
          return (
            <div
              key={item._id}
              id={`announcement-${item._id}`}
              className={
                "border rounded-lg p-4 bg-white shadow-sm transition-all " +
                (isHL
                  ? "border-indigo-400 ring-4 ring-indigo-300/60 bg-indigo-50/40 animate-pulse"
                  : "border-indigo-100")
              }
              title="Announcement"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-indigo-700 font-medium">
                  {icon}
                  <span className="capitalize">Announcement</span>
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
              <h3 className="text-gray-900 font-semibold mb-1 text-base">{item.title}</h3>
              {item.content && (
                <div
                  className="mb-3 text-gray-800 prose prose-sm max-w-none announcement-content"
                  dangerouslySetInnerHTML={{ __html: item.content }}
                />
              )}
              {item.images && item.images.length > 0 && (
                <div className="flex gap-4 flex-wrap mt-2">
                  {item.images.map((url, idx) => {
                    const src = url.startsWith("http")
                      ? url
                      : (process.env.NEXT_PUBLIC_BACKEND_URL || "") + url;
                    return (
                      <div key={idx} className="relative group">
                        <img
                          src={src}
                          alt=""
                          className="w-24 h-16 object-cover rounded border cursor-pointer hover:opacity-80"
                          onClick={() => setPreviewDoc({ url: src, type: "image" })}
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
              {item.documents && item.documents.length > 0 && (
                <div className="flex gap-4 flex-wrap mt-4">
                  {item.documents.map((url, idx) => {
                    const fileUrl = url.startsWith("http")
                      ? url
                      : (process.env.NEXT_PUBLIC_BACKEND_URL || "") + url;
                    const originalName = getOriginalFileName(url);
                    const fileType = fileTypeFromUrl(fileUrl);
                    const isPreviewable =
                      ["pdf", "ppt", "word", "excel", "txt"].includes(fileType);

                    return (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1 border">
                        <button
                          type="button"
                          className="flex items-center gap-2 font-medium text-blue-700 hover:underline"
                          onClick={() =>
                            isPreviewable
                              ? setPreviewDoc({ url: fileUrl, type: fileType })
                              : window.open(fileUrl, "_blank")
                          }
                          title={`Preview ${originalName}`}
                        >
                          {getFileIcon(fileType)}
                          <span className="text-xs truncate max-w-[110px]" title={originalName}>
                            {originalName}{isPreviewable ? " (Preview)" : ""}
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
              {previewDoc && (
                <div className="fixed inset-0 bg-black/70 z-[9999] backdrop-blur-sm flex items-center justify-center transition-all duration-200">
                  <div className="bg-white rounded-xl p-6 max-w-4xl w-full shadow-2xl relative flex flex-col scale-95 animate-[scale-in_0.2s_ease-in-out_forwards]">
                    <button
                      className="absolute top-2 right-2 bg-gray-200 p-1 rounded-full"
                      onClick={() => setPreviewDoc(null)}
                      title="Close"
                    >✕</button>
                    {previewDoc.type === "image" && (
                      <button
                        className="absolute top-2 left-2 bg-gray-200 p-1 rounded-full"
                        title="Full screen"
                        onClick={() => openFullscreen(imageRef.current)}
                      >⛶</button>
                    )}
                    {["pdf", "ppt", "word", "excel"].includes(previewDoc.type) && (
                      <button
                        className="absolute top-2 left-2 bg-gray-200 p-1 rounded-full"
                        title="Full screen"
                        onClick={() => openFullscreen(iframeRef.current)}
                      >⛶</button>
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
                        <a href={previewDoc.url} download className="text-blue-600 underline">Download</a>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {item.links && item.links.length > 0 && (
                <div className="mt-2 space-x-2">
                  {item.links.map((link, idx) => (
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
              {item.youtubeLinks && item.youtubeLinks.length > 0 && (
                <div className="mt-2 flex gap-3">
                  {item.youtubeLinks.map((url, idx) => {
                    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]+)/);
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
                {item.postedBy
                  ? <>
                      {item.postedBy.username} ({item.postedBy.role})
                    </>
                  : <span className="italic text-gray-400">Unknown poster</span>
                }
              </div>
            </div>
          );
        }

        // All other types (regular card, navigates on click)
        return (
          <div
            key={item._id}
            className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm cursor-pointer hover:bg-blue-50 transition"
            onClick={() => {
              router.push(`/student/dashboard/class/course-instance/${courseInstanceId}/${route}/${item._id}`);
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
            <h3 className="text-gray-900 font-semibold mb-1 text-base">{item.title}</h3>
            {item.content && (
              <div
                className="mb-3 text-gray-800 prose prose-sm max-w-none announcement-content"
                dangerouslySetInnerHTML={{ __html: item.content }}
              />
            )}
            <div className="text-sm text-gray-600 flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              {item.postedBy
                ? <>
                    {item.postedBy.username} ({item.postedBy.role})
                  </>
                : <span className="italic text-gray-400">Unknown poster</span>
              }
            </div>
          </div>
        );
      })}
    </div>
  );
}
