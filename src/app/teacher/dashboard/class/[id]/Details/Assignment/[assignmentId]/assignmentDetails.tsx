"use client";
import React, { useEffect, useState } from "react";
import { 
  Loader2, AlertCircle, User, Calendar, BookOpen, FileText, FileImage, Youtube,
  Clock, Play, ExternalLink, ChevronRight, X, MoreVertical, Pencil, Trash2
} from "lucide-react";


import toast from "react-hot-toast";
import { useUser } from "@/app/teacher/dashboard/teacherContext";
import AssignmentCommentSection from "./comment";
import { useRouter } from "next/navigation";
import AssignmentEditForm from "../../../workspace/editAssignmentForm";

// ---- Types (import if you have a types file) ----
interface UserMini {
  _id: string;
  username: string;
  email?: string;
  role?: string;
}
interface Assignment {
  _id: string;
  title: string;
  content?: string;
  postedBy?: UserMini;
  createdAt?: string;
  updatedAt?: string;
  documents?: { url: string; originalname?: string }[];
  media?: { url: string; originalname?: string }[];
  dueDate?: string;
  youtubeLinks?: string[];
  links?: string[];
}
interface SubmissionFile {
  url: string;
  originalname: string;
  mimetype?: string;
}
interface Submission {
  _id: string;
  status: "draft" | "submitted";
  files: SubmissionFile[];
  links: string[];
  submittedAt?: string;
  feedback?: string;
  grade?: number;
  youtubeLinks?: string[];
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const getFileUrl = (url: string) =>
  url?.startsWith("http") ? url : `${BACKEND_URL}${url || ""}`;

type AssignmentDetailProps ={
    classId : string,
    assignmentId: string
}
export default function AssignmentDetail( {classId , assignmentId}: AssignmentDetailProps) {
//   const params = useParams();
//   const assignmentId = params?.assignmentId as string;
  const  user = useUser();
  // State
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mediaPreview, setMediaPreview] = useState<{
    url: string; type: "img" | "pdf" | "office" | "youtube";
    originalname?: string; yt?: string;
  } | null>(null);
const [menuOpen, setMenuOpen] = useState(false);
const [confirmDelete, setConfirmDelete] = useState(false);
const menuRef = React.useRef<HTMLDivElement | null>(null);
const [showEdit, setShowEdit] = useState(false);
const [refreshTick, setRefreshTick] = useState(0);

 const router = useRouter();
// close on outside click
useEffect(() => {
  function onDocClick(e: MouseEvent) {
    if (!menuRef.current) return;
    if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") setMenuOpen(false);
  }
  document.addEventListener("mousedown", onDocClick);
  document.addEventListener("keydown", onKey);
  return () => {
    document.removeEventListener("mousedown", onDocClick);
    document.removeEventListener("keydown", onKey);
  };
}, []);

  // --- File icon helpers (pass to SubmissionPanel) ---
  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return <FileImage className="w-5 h-5 text-emerald-500" />;
    if (["pdf"].includes(ext)) return <FileText className="w-5 h-5 text-red-500" />;
    if (["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(ext)) return <FileText className="w-5 h-5 text-blue-500" />;
    return <FileText className="w-5 h-5 text-gray-500" />;
  };
  useEffect(() => {
  const ctrl = new AbortController();
  (async () => {
    try {
      if (!assignmentId) throw new Error("Missing assignmentId");
      setLoading(true);
      setError(null);

      const res = await fetch(`${BACKEND_URL}/assignment/${assignmentId}`, {
        signal: ctrl.signal,
        headers: {
          Authorization:
            "Bearer " +
            (localStorage.getItem("token_teacher") ||
              sessionStorage.getItem("token_teacher") ||
              ""),
        },
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }

      const json = await res.json();
      const data: Assignment = json.assignment ?? json.data ?? json;
      setAssignment(data);
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.error(e);
        setError(e.message || "Failed to load assignment.");
        toast.error("Failed to load assignment");
      }
    } finally {
      setLoading(false);
    }
  })();
  return () => ctrl.abort();
}, [assignmentId, refreshTick]); // 👈 add refreshTick


  const isOfficeDoc = (name: string) => /\.(docx?|pptx?|xlsx?)$/i.test(name);
  const isPDF = (name: string) => /\.pdf$/i.test(name);
  const isImage = (name: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(name);

  // YouTube helpers
  const getYoutubeEmbed = (url: string) => {
    let id =
      url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1] ||
      url.match(/youtube\.com\/watch\?.*v=([^&\n?#]+)/)?.[1];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  };

  // Due Date Status
  const getDueDateStatus = (dueDate?: string) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const now = new Date();
    const diffHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < 0) return { status: 'overdue', color: 'text-red-600', bg: 'bg-gradient-to-r from-red-50 to-red-100', border: 'border-red-200' };
    if (diffHours < 24) return { status: 'urgent', color: 'text-amber-600', bg: 'bg-gradient-to-r from-amber-50 to-yellow-100', border: 'border-amber-200' };
    if (diffHours < 168) return { status: 'approaching', color: 'text-orange-600', bg: 'bg-gradient-to-r from-orange-50 to-orange-100', border: 'border-orange-200' };
    return { status: 'normal', color: 'text-emerald-600', bg: 'bg-gradient-to-r from-emerald-50 to-green-100', border: 'border-emerald-200' };
  };

  // --- Render ---
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50">
        <div className="relative bg-white/90 backdrop-blur-xl p-12 rounded-3xl shadow-2xl border border-white/20 flex items-center gap-6">
          <Loader2 className="animate-spin w-12 h-12 text-violet-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Loading Assignment</h2>
            <p className="text-gray-600">Preparing your workspace...</p>
          </div>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-xl p-10 rounded-3xl shadow-2xl max-w-md w-full border border-red-100">
          <div className="flex items-center gap-4 text-red-600 mb-6">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Oops!</h2>
              <p className="text-red-500">Something went wrong</p>
            </div>
          </div>
          <p className="text-gray-700 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl hover:from-red-600 hover:to-pink-600 transition-all duration-300 transform hover:scale-105 font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    );

  if (!assignment)
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="p-6 bg-gray-100 rounded-full mb-6 mx-auto w-fit">
            <BookOpen className="w-16 h-16 opacity-50" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Assignment Not Found</h2>
          <p className="text-gray-400">The assignment you're looking for doesn't exist</p>
        </div>
      </div>
    );

  const dueDateStatus = getDueDateStatus(assignment.dueDate);
const handleEdit = () => {
  setMenuOpen(false);
  setShowEdit(true);      // 👈 this opens the edit form
};


const handleDelete = async () => {
  setMenuOpen(false);
  setConfirmDelete(false);
  try {
    const res = await fetch(`${BACKEND_URL}/assignment/${assignmentId}`, {
      method: "DELETE",
      headers: {
        Authorization:
          "Bearer " +
          (localStorage.getItem("token_teacher") ||
            sessionStorage.getItem("token_teacher") ||
            ""),
      },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || res.statusText);
    }
    toast.success("Assignment deleted");
    // Optionally redirect back
    // router.back();
          router.push(`http://localhost:3000/teacher/dashboard/class/${classId}/workspace`);

  } catch (err: any) {
    toast.error(err?.message || "Failed to delete");
  }
};

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 relative overflow-hidden">
      {/* Media Preview Modal */}
      {mediaPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden border border-white/20">
            <div className="flex items-center justify-between p-6 border-b border-gray-200/50 bg-gradient-to-r from-indigo-50 to-purple-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/60 rounded-xl">
                  <X className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{mediaPreview.originalname || "Preview"}</h3>
                  <p className="text-sm text-gray-500">File preview</p>
                </div>
              </div>
              <button
                className="p-3 hover:bg-white/60 rounded-full transition-all duration-300 group"
                onClick={() => setMediaPreview(null)}
              >
                <X className="w-6 h-6 text-gray-600 group-hover:text-gray-800" />
              </button>
            </div>
            <div className="p-6">
              {/* Image */}
              {mediaPreview.type === "img" && (
                <img
                  src={getFileUrl(mediaPreview.url)}
                  alt={mediaPreview.originalname}
                  className="max-w-full max-h-[70vh] mx-auto rounded-2xl shadow-lg"
                />
              )}
              {/* PDF */}
              {mediaPreview.type === "pdf" && (
                <iframe
                  src={getFileUrl(mediaPreview.url)}
                  className="w-full h-[70vh] rounded-2xl"
                  title="PDF Preview"
                ></iframe>
              )}
              {/* Office Doc */}
              {mediaPreview.type === "office" && (
                <iframe
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(getFileUrl(mediaPreview.url))}`}
                  className="w-full h-[70vh] rounded-2xl"
                  title="Office Preview"
                ></iframe>
              )}
              {/* YouTube */}
              {mediaPreview.type === "youtube" && (
                <iframe
                  src={mediaPreview.yt}
                  className="w-full h-[60vh] rounded-2xl"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  title="YouTube"
                ></iframe>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="">
        <div className="">
          {/* LEFT: Assignment Details */}
          <div className="">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden mb-8 border border-white/20">
              {/* Assignment Header */}
             {/* Assignment Header */}
<div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white p-10 overflow-hidden">
  <div className="relative z-10">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
        <BookOpen className="w-6 h-6" />
      </div>
      <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">
        Assignment
      </span>
    </div>

    {/* Title + menu row */}
    <div className="flex items-start justify-between gap-4">
      <h1 className="text-4xl font-bold leading-tight">{assignment.title}</h1>

      {/* 3-dot menu */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((s) => !s)}
          className="rounded-xl bg-white/15 hover:bg-white/25 transition p-2"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="More actions"
        >
          <MoreVertical className="h-5 w-5" />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-44 rounded-xl border border-white/20 bg-white/90 text-gray-800 shadow-2xl backdrop-blur-xl overflow-hidden"
          >
            <button
              onClick={handleEdit}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100"
              role="menuitem"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
            <button
              onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              role="menuitem"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>

    <div className="mt-6 flex flex-wrap gap-6 text-indigo-100">
      {assignment.postedBy && (
        <div className="flex items-center gap-3 bg-white/10 rounded-full px-4 py-2 backdrop-blur-sm">
          <User className="w-5 h-5" />
          <span className="font-medium">{assignment.postedBy.username}</span>
        </div>
      )}
      {assignment.createdAt && (
        <div className="flex items-center gap-3 bg-white/10 rounded-full px-4 py-2 backdrop-blur-sm">
          <Calendar className="w-5 h-5" />
          <span>Posted {new Date(assignment.createdAt).toLocaleDateString()}</span>
        </div>
      )}
    </div>
  </div>
</div>

              {/* Due Date Banner */}
              {assignment.dueDate && dueDateStatus && (
                <div className={`px-10 py-6 border-b border-gray-200/50 ${dueDateStatus.bg} ${dueDateStatus.border} border-l-4`}>
                  <div className={`flex items-center gap-3 ${dueDateStatus.color} font-semibold`}>
                    <div className="p-2 bg-white/60 rounded-xl">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-lg">Due: {new Date(assignment.dueDate).toLocaleDateString()}</div>
                      <div className="text-sm opacity-75">{new Date(assignment.dueDate).toLocaleTimeString()}</div>
                    </div>
                    {dueDateStatus.status === 'overdue' && (
                      <span className="ml-auto bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">OVERDUE</span>
                    )}
                    {dueDateStatus.status === 'urgent' && (
                      <span className="ml-auto bg-amber-500 text-white px-3 py-1 rounded-full text-sm font-bold animate-bounce">DUE SOON</span>
                    )}
                  </div>
                </div>
              )}
              <div className="p-10">
                {/* Assignment Content */}
                {assignment.content && (
                  <div className="prose prose-lg max-w-none mb-8 text-gray-800" 
                       dangerouslySetInnerHTML={{ __html: assignment.content }} />
                )}

                {/* Content Sections */}
                <div className="space-y-8">
                  {/* Documents Section */}
                  {assignment.documents && assignment.documents.length > 0 && (
                    <div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl text-white">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-800">Documents</h3>
                          <p className="text-gray-500">Required reading materials</p>
                        </div>
                      </div>
                      <div className="grid gap-4">
                        {assignment.documents.map((doc, idx) => (
                          <div key={idx} className="group/item bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-2xl border border-blue-100 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                className="flex items-center gap-4 text-left flex-1"
                                onClick={() =>
                                  isOfficeDoc(doc.originalname || "")
                                    ? setMediaPreview({ url: doc.url, type: "office", originalname: doc.originalname })
                                    : isPDF(doc.originalname || "")
                                      ? setMediaPreview({ url: doc.url, type: "pdf", originalname: doc.originalname })
                                      : window.open(getFileUrl(doc.url), "_blank")
                                }
                              >
                                <div className="p-3 bg-white rounded-xl shadow-sm">
                                  {getFileIcon(doc.originalname || "")}
                                </div>
                                <div className="flex-1">
                                  <div className="font-semibold text-gray-800 group-hover/item:text-blue-600 transition-colors">
                                    {doc.originalname || "Document"}
                                  </div>
                                  <div className="text-sm text-gray-500">Click to view</div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-400 group-hover/item:text-blue-500 transition-colors" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Media Section */}
                  {assignment.media && assignment.media.length > 0 && (
                    <div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white">
                          <FileImage className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-800">Media Files</h3>
                          <p className="text-gray-500">Visual content and resources</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {assignment.media.map((file, idx) => (
                          isImage(file.originalname || "") ? (
                            <div key={idx} className="group/media relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 aspect-square">
                              <img
                                src={getFileUrl(file.url)}
                                alt={file.originalname || "Media"}
                                className="w-full h-full object-cover cursor-pointer group-hover/media:scale-110 transition-transform duration-500"
                                onClick={() => setMediaPreview({ url: file.url, type: "img", originalname: file.originalname })}
                              />
                            </div>
                          ) : (
                            <button
                              key={idx}
                              type="button"
                              className="group/file p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl hover:from-purple-100 hover:to-pink-100 transition-all duration-300 text-center aspect-square flex flex-col items-center justify-center"
                              onClick={() =>
                                isOfficeDoc(file.originalname || "")
                                  ? setMediaPreview({ url: file.url, type: "office", originalname: file.originalname })
                                  : isPDF(file.originalname || "")
                                    ? setMediaPreview({ url: file.url, type: "pdf", originalname: file.originalname })
                                    : window.open(getFileUrl(file.url), "_blank")
                              }
                            >
                              <div className="p-3 bg-white rounded-xl mb-3 group-hover/file:scale-110 transition-transform">
                                {getFileIcon(file.originalname || "")}
                              </div>
                              <p className="text-sm font-medium truncate max-w-full">{file.originalname}</p>
                            </button>
                          )
                        ))}
                      </div>
                    </div>
                  )}

                  {/* YouTube Videos */}
                  {assignment.youtubeLinks && assignment.youtubeLinks.length > 0 && (
                    <div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl text-white">
                          <Youtube className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-800">Video Content</h3>
                          <p className="text-gray-500">Watch these educational videos</p>
                        </div>
                      </div>
                      <div className="grid gap-4">
                        {assignment.youtubeLinks.map((url, idx) => {
                          const embed = getYoutubeEmbed(url);
                          return (
                            <div key={idx} className="group/video bg-gradient-to-r from-red-50 to-pink-50 p-5 rounded-2xl border border-red-100 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
                              <button
                                type="button"
                                className="flex items-center gap-4 text-left w-full"
                                onClick={() => setMediaPreview({ url, type: "youtube", yt: embed || url })}
                              >
                                <div className="p-3 bg-red-500 rounded-xl text-white group-hover/video:bg-red-600 transition-colors">
                                  <Play className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                  <div className="font-semibold text-gray-800 group-hover/video:text-red-600 transition-colors">
                                    Video {idx + 1}
                                  </div>
                                  <div className="text-sm text-gray-500 truncate">{url}</div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-400 group-hover/video:text-red-500 transition-colors" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* External Links */}
                  {assignment.links && assignment.links.length > 0 && (
                    <div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl text-white">
                          <ExternalLink className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-800">External Resources</h3>
                          <p className="text-gray-500">Additional reading and references</p>
                        </div>
                      </div>
                      <div className="grid gap-4">
                        {assignment.links.map((l, idx) => (
                          <a
                            key={idx}
                            href={l}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group/link bg-gradient-to-r from-emerald-50 to-teal-50 p-5 rounded-2xl border border-emerald-100 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] flex items-center gap-4"
                          >
                            <div className="p-3 bg-emerald-500 rounded-xl text-white group-hover/link:bg-emerald-600 transition-colors">
                              <ExternalLink className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-800 group-hover/link:text-emerald-600 transition-colors">
                                External Link {idx + 1}
                              </div>
                              <div className="text-sm text-gray-500 truncate">{l}</div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover/link:text-emerald-500 transition-colors" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

     
        </div>
        <AssignmentCommentSection assignmentId={assignmentId} />
      </div>
      {confirmDelete && (
  <div className="fixed inset-0 z-50 grid place-items-center p-4">
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(false)} />
    <div className="relative w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl">
      <h3 className="text-lg font-semibold">Delete assignment?</h3>
      <p className="mt-1 text-sm text-gray-600">
        This action cannot be undone.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          onClick={() => setConfirmDelete(false)}
        >
          Cancel
        </button>
        <button
          className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 inline-flex items-center gap-2"
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </div>
  </div>
)}
{showEdit && (
  <AssignmentEditForm
    assignmentId={assignmentId}
    courseInstanceId={classId}
    courseName={/* use what you have, or a fallback: */ (assignment as any)?.course?.name || "Course"}
    onSuccess={() => {
      setShowEdit(false);
      setRefreshTick(t => t + 1); // re-fetch details
    }}
    onCancel={() => setShowEdit(false)}
  />
)}

    </div>
  );
}
