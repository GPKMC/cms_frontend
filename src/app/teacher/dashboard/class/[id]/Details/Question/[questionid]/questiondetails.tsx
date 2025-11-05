"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  Loader2, AlertCircle, User, FileText, ExternalLink, Image, Youtube, Eye, X, Calendar, Award, Clock, Download, Play
} from "lucide-react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";

// import { useParams } from "next/navigation";
import QuestionCommentSection from "./comment";
import { useUser } from "../../../../../teacherContext";
import { useRouter } from "next/navigation";
import QuestionEditForm from "../../../workspace/question/editQuestionForm";

// --- Helpers ---
function getFileUrl(url: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const base = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  return `${base}${url.startsWith("/") ? url : "/" + url}`;
}
const isOfficeDoc = (filename: string) => /\.(docx?|pptx?|xlsx?)$/i.test(filename);
const isPDF = (filename: string) => /\.pdf$/i.test(filename);
const isImage = (filename: string) => /\.(jpe?g|png|gif|webp|bmp)$/i.test(filename);
const getYouTubeId = (url: string) => {
  const m = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return m ? m[1] : null;
};

// --- Modals ---
function ImageModal({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  if (!src) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative bg-white rounded-3xl shadow-2xl p-6 max-w-4xl max-h-[90vh] m-4">
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 bg-white rounded-full p-3 hover:bg-gray-50 shadow-lg transition-all duration-200 z-10"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
        <img
          src={src}
          alt={alt || "Preview"}
          className="rounded-2xl max-w-[80vw] max-h-[80vh] object-contain shadow-lg"
        />
        {alt && (
          <div className="mt-4 text-center text-gray-600 font-medium">{alt}</div>
        )}
      </div>
    </div>
  );
}
function OfficeDocModal({ url, alt, onClose }: { url: string; alt?: string; onClose: () => void }) {
  if (!url) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative bg-white rounded-3xl shadow-2xl p-6 max-w-5xl w-full mx-4 max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 bg-white rounded-full p-3 hover:bg-gray-50 shadow-lg transition-all duration-200 z-10"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
        <div className="mb-4 text-lg font-semibold text-gray-800">{alt}</div>
        <iframe
          src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
          className="w-full h-[70vh] rounded-2xl border border-gray-200 shadow-inner"
          title={alt}
        />
      </div>
    </div>
  );
}
function PDFModal({ url, alt, onClose }: { url: string; alt?: string; onClose: () => void }) {
  if (!url) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative bg-white rounded-3xl shadow-2xl p-6 max-w-5xl w-full mx-4 max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 bg-white rounded-full p-3 hover:bg-gray-50 shadow-lg transition-all duration-200 z-10"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
        <div className="mb-4 text-lg font-semibold text-gray-800">{alt}</div>
        <iframe
          src={url}
          className="w-full h-[70vh] rounded-2xl border border-gray-200 shadow-inner"
          title={alt}
        />
      </div>
    </div>
  );
}

type QuestionDetailPageProps = { questionId: string, classId: string };

export default function QuestionDetail({ questionId, classId }: QuestionDetailPageProps) {
  //   const params = useParams();
  //   const questionId = params?.questionId as string;

  const [question, setQuestion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Modals
  const [imgModal, setImgModal] = useState<{ src: string, alt?: string } | null>(null);
  const [docModal, setDocModal] = useState<{ url: string, alt?: string } | null>(null);
  const [pdfModal, setPdfModal] = useState<{ url: string, alt?: string } | null>(null);
  const { user } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
const [refreshTick, setRefreshTick] = useState(0);

async function loadQuestion() {
  setLoading(true);
  setErr(null);
  const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/question/${questionId}`, {
    headers: {
      Authorization: "Bearer " + (localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher") || ""),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch question");
  setQuestion(data.question);
  setLoading(false);
}

useEffect(() => {
  if (!questionId) return;
  loadQuestion();
}, [questionId, refreshTick]); // ⬅️ add refreshTick here

  useEffect(() => {
    if (!questionId) return;
    setLoading(true);
    setErr(null);
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/question/${questionId}`, {
      headers: {
        Authorization: "Bearer " + (localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher") || ""),
      },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch question");
        setQuestion(data.question);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [questionId]);
  console.log("questionId:", questionId);
  console.log("user:", user);

  //edit and delete button 
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);



  const getDaysUntilDue = (dueDate: string) => {
    return Math.ceil((new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  };

  const getDueDateStatus = (dueDate: string) => {
    const days = getDaysUntilDue(dueDate);
    if (days < 0) return { text: "Overdue", color: "text-red-600 bg-red-50 border-red-200" };
    if (days === 0) return { text: "Due Today", color: "text-orange-600 bg-orange-50 border-orange-200" };
    if (days <= 3) return { text: `${days} days left`, color: "text-yellow-600 bg-yellow-50 border-yellow-200" };
    return { text: `${days} days left`, color: "text-green-600 bg-green-50 border-green-200" };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 flex items-center gap-4">
          <Loader2 className="animate-spin w-6 h-6 text-indigo-600" />
          <span className="text-gray-700 font-medium">Loading question details...</span>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertCircle className="w-6 h-6" />
            <span className="font-semibold text-lg">Error Loading Question</span>
          </div>
          <p className="text-gray-600">{err}</p>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-gray-600 text-center">No question found.</div>
        </div>
      </div>
    );
  }

  const dueStatus = getDueDateStatus(question.dueDate);

  async function handleDeleteQuestion() {
    try {
      setDeleting(true);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/question/${questionId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: "Bearer " + (localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher") || ""),
          },
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "Failed to delete");

      // success: close modal and redirect
      setConfirmOpen(false);
      router.push(`http://localhost:3000/teacher/dashboard/class/${classId}/workspace`);
    } catch (e: any) {
      alert(e.message || "Failed to delete question");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {imgModal && <ImageModal src={imgModal.src} alt={imgModal.alt} onClose={() => setImgModal(null)} />}
      {docModal && <OfficeDocModal url={docModal.url} alt={docModal.alt} onClose={() => setDocModal(null)} />}
      {pdfModal && <PDFModal url={pdfModal.url} alt={pdfModal.alt} onClose={() => setPdfModal(null)} />}

      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
            <div className="relative">
              <div className="flex items-start justify-between gap-3 mb-4">
                <h1 className="text-3xl font-bold leading-tight">{question.title}</h1>

                <div ref={menuRef} className="relative">
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="p-2 rounded-full hover:bg-white/20 transition"
                    aria-label="More actions"
                  >
                    <MoreVertical className="w-5 h-5 text-white" />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-40 bg-white text-gray-800 rounded-xl shadow-lg border z-20">
                      <button
                        onClick={() => { setMenuOpen(false); setShowEdit(true); }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Pencil className="w-4 h-4" /> Edit
                      </button>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          setConfirmOpen(true);   // <-- open confirm modal
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>

                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-white/90">
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
                  <User className="w-4 h-4" />
                  <span className="font-medium">{question.postedBy?.username || question.postedBy?.email || "Unknown"}</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
                  <Award className="w-4 h-4" />
                  <span className="font-medium">{question.points} pts</span>
                </div>
                {question.courseInstance && (
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
                    <span className="font-medium">{question.courseInstance.code || question.courseInstance.course?.title}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          {question.dueDate && (
            <div className={`px-8 py-4 border-l-4 border-current ${dueStatus.color}`}>
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5" />
                <div>
                  <div className="font-semibold">{dueStatus.text}</div>
                  <div className="text-sm opacity-75">
                    Due: {new Date(question.dueDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Question Details
          </h2>
          {question.content && (
            <div
              className="prose prose-lg max-w-none text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: question.content }}
            />
          )}
        </div>

        {/* Attachments */}
        {(question.media?.length > 0 || question.documents?.length > 0 || question.youtubeLinks?.length > 0 || question.links?.length > 0) && (
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Resources & Attachments</h2>
            <div className="space-y-8">
              {/* Media Gallery */}
              {question.media?.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-purple-100 p-2 rounded-xl">
                      <Image className="w-5 h-5 text-purple-600" />
                    </div>
                    <h3 className="font-semibold text-lg text-gray-800">Media Files</h3>
                    <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                      {question.media.length} file{question.media.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {question.media.map((media: any, idx: number) => (
                      isImage(media.originalname) ? (
                        <div key={idx} className="group relative">
                          <img
                            src={getFileUrl(media.url)}
                            alt={media.originalname}
                            className="w-full h-32 object-cover rounded-xl border border-gray-200 cursor-pointer transition-all duration-300 group-hover:shadow-lg group-hover:scale-105"
                            onClick={() => setImgModal({ src: getFileUrl(media.url), alt: media.originalname })}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl transition-all duration-300 flex items-center justify-center">
                            <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </div>
                          <div className="mt-2 text-sm text-gray-600 truncate">{media.originalname}</div>
                        </div>
                      ) : (
                        <a
                          key={idx}
                          href={getFileUrl(media.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col items-center p-4 border border-gray-200 rounded-xl hover:shadow-lg transition-all duration-300 hover:border-purple-300 group"
                        >
                          <div className="bg-purple-100 p-3 rounded-xl mb-2 group-hover:bg-purple-200 transition-colors">
                            <FileText className="w-6 h-6 text-purple-600" />
                          </div>
                          <span className="text-sm text-gray-700 text-center truncate w-full">{media.originalname}</span>
                          <span className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                            <Download className="w-3 h-3" />
                            Download
                          </span>
                        </a>
                      )
                    ))}
                  </div>
                </div>
              )}

              {/* Documents */}
              {question.documents?.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-100 p-2 rounded-xl">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-lg text-gray-800">Documents</h3>
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                      {question.documents.length} file{question.documents.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {question.documents.map((doc: any, idx: number) => {
                      const fileUrl = getFileUrl(doc.url);
                      const isOffice = isOfficeDoc(doc.originalname);
                      const isPdfFile = isPDF(doc.originalname);

                      return (
                        <div key={idx} className="border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all duration-300 hover:border-blue-300">
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`p-2 rounded-lg ${isPdfFile ? 'bg-red-100' : isOffice ? 'bg-blue-100' : 'bg-gray-100'}`}>
                              <FileText className={`w-5 h-5 ${isPdfFile ? 'text-red-600' : isOffice ? 'text-blue-600' : 'text-gray-600'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 truncate">{doc.originalname}</div>
                              <div className="text-sm text-gray-500">
                                {isPdfFile ? 'PDF Document' : isOffice ? 'Office Document' : 'Document'}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {(isOffice || isPdfFile) && (
                              <button
                                onClick={() => {
                                  if (isPdfFile) {
                                    setPdfModal({ url: fileUrl, alt: doc.originalname });
                                  } else {
                                    setDocModal({ url: fileUrl, alt: doc.originalname });
                                  }
                                }}
                                className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                              >
                                <Eye className="w-4 h-4" />
                                Preview
                              </button>
                            )}
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                            >
                              <Download className="w-4 h-4" />
                              Download
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* YouTube Videos */}
              {question.youtubeLinks?.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-red-100 p-2 rounded-xl">
                      <Youtube className="w-5 h-5 text-red-600" />
                    </div>
                    <h3 className="font-semibold text-lg text-gray-800">Video Resources</h3>
                    <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
                      {question.youtubeLinks.length} video{question.youtubeLinks.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {question.youtubeLinks.map((yt: string, idx: number) => {
                      const ytId = getYouTubeId(yt);
                      if (ytId) {
                        return (
                          <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300">
                            <div className="relative group">
                              <iframe
                                width="100%"
                                height="200"
                                src={`https://www.youtube.com/embed/${ytId}`}
                                title="YouTube video preview"
                                className="border-0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                            <div className="p-4">
                              <a
                                href={yt}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-red-600 hover:text-red-700 font-medium flex items-center gap-2"
                              >
                                <Play className="w-4 h-4" />
                                Watch on YouTube
                              </a>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={idx} className="border border-red-200 rounded-xl p-4 bg-red-50">
                          <div className="text-red-600 text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Invalid YouTube link: {yt}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* External Links */}
              {question.links?.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-green-100 p-2 rounded-xl">
                      <ExternalLink className="w-5 h-5 text-green-600" />
                    </div>
                    <h3 className="font-semibold text-lg text-gray-800">External Links</h3>
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                      {question.links.length} link{question.links.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {question.links.map((link: string, idx: number) => (
                      <a
                        key={idx}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:shadow-lg transition-all duration-300 hover:border-green-300 group"
                      >
                        <div className="bg-green-100 p-2 rounded-lg group-hover:bg-green-200 transition-colors">
                          <ExternalLink className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-green-700 font-medium truncate">{link}</div>
                          <div className="text-sm text-gray-500">External resource</div>
                        </div>
                        <div className="text-green-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalLink className="w-4 h-4" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>

              )}
            </div>
          </div>

        )}

        <div>
          <QuestionCommentSection questionId={questionId} />
        </div>
        {/* Footer */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Clock className="w-4 h-4" />
            <span className="text-sm">
              Created on {question.createdAt ? new Date(question.createdAt).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }) : "Unknown date"}
            </span>
          </div>
        </div>
      </div>
      {/* Confirm Delete Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border">
            <div className="text-lg font-semibold mb-2">Delete question?</div>
            <p className="text-sm text-gray-600">
              This action cannot be undone.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded bg-gray-100"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteQuestion}
                className={`px-4 py-2 rounded text-white ${deleting ? "bg-red-400" : "bg-red-600 hover:bg-red-700"}`}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
{/* edit modal */}
{showEdit && question && (
  <QuestionEditForm
    QuestionId={questionId}
    courseInstanceId={
      typeof question.courseInstance === "string"
        ? question.courseInstance
        : question.courseInstance?._id
    }
    courseName={
      typeof question.courseInstance === "object"
        ? (question.courseInstance.code || question.courseInstance.course?.title || "Course")
        : "Course"
    }
    onSuccess={() => {
      setShowEdit(false);     // close modal
      setRefreshTick(t => t + 1); // trigger useEffect -> loadQuestion()
    }}
    onCancel={() => setShowEdit(false)}
  />
)}


    </div>
  );
}
