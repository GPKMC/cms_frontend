"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  Upload, Sparkles, Loader2, Undo2 as UndoArrow, FileText, Link as LinkIcon,
  Eye, Trash2, AlertCircle, Trophy, Star, MessageSquare, ExternalLink, Plus
} from "lucide-react";
import toast from "react-hot-toast";
import { useUser } from "@/app/student/dashboard/studentContext";

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
type User = {
  _id?: string;
  id?: string;
  username?: string;
  email?: string;
};

interface Props {
  submission: Submission | null;
    groupId: string; 
  loadingUndo: boolean;
  submitting: boolean;
  setSubmitting: (isLoading: boolean) => void;  // new setter prop
   setLoadingUndo: (loading: boolean) => void; // <-- Add this!
  error: string | null;
  setError: (msg: string | null) => void;     // <-- Add this!
  groupAssignmentId: string;
  refreshSubmission: () => void;
  getFileUrl: (url: string) => string;
  getFileIcon: (name: string) => React.ReactNode;
  isImage: (name: string) => boolean;
  isOfficeDoc: (name: string) => boolean;
  isPDF: (name: string) => boolean;
  setMediaPreview: (preview: any) => void;
  onPlagiarismCheck?: (result: any) => void;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function SubmissionPanel({
  groupId,submission, loadingUndo, submitting,setSubmitting, error, setError,
  groupAssignmentId, refreshSubmission, getFileUrl,
  getFileIcon, isImage, isOfficeDoc, isPDF, setMediaPreview, onPlagiarismCheck
}: Props) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<string[]>(submission?.links || []);
  const [newLink, setNewLink] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useUser();
  const [plagiarismResult, setPlagiarismResult] = useState<any>(null);
 const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch logic (no argument needed, uses props)
  const fetchSubmission = async () => {
    if (!groupAssignmentId || !groupId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/submission/by-assignment/${groupAssignmentId}/${groupId}`,
        {
          headers: {
            Authorization: "Bearer " + (localStorage.getItem("token_student") || ""),
          },
        }
      );
      if (res.status === 404) {
        setSubmission(null);
      } else if (!res.ok) {
        throw new Error((await res.json()).error || "Failed to fetch submission");
      } else {
        const data = await res.json();
        setSubmission(data.submission || null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmission();
  }, [groupAssignmentId, groupId]);
useEffect(() => {
  if (!submission) {
    setSelectedFiles([]);
    setLinks([]);
    setNewLink("");
    setError(null);
    setPlagiarismResult(null);
  } else {
    setLinks(submission.links || []);
  }
}, [submission]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  };
  console.log("Submission prop:", submission);
  console.log("Submission status:", submission?.status);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setSelectedFiles(prev => [...prev, ...Array.from(files)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddLink = () => {
    if (!newLink.trim()) return;
    setLinks(prev => [...prev, newLink.trim()]);
    setNewLink("");
  };
  const handleRemoveLink = (idx: number) => setLinks(prev => prev.filter((_, i) => i !== idx));
  const handleRemoveFile = (idx: number) => setSelectedFiles(prev => prev.filter((_, i) => i !== idx));

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (!groupAssignmentId) return;
  setError(null);

  if (typeof setSubmitting === "function") setSubmitting(true);

  const formData = new FormData();
  selectedFiles.forEach(f => formData.append("files", f));
  links.forEach(l => formData.append("links", l));
  if (user?._id || user?.id) {
    formData.append("submittedBy", user._id || user.id);
  }
  formData.append("groupAssignmentId", groupAssignmentId);
  formData.append("groupId", groupId);

  // === CRUCIAL: This ensures the submission is NOT saved as draft! ===
  formData.append("status", "submitted");

  try {
    const res = await fetch(
      `${BACKEND_URL}/submission/group-assignment-submission`,
      {
        method: "POST",
        headers: {
          Authorization:
            "Bearer " +
            (localStorage.getItem("token_student") ||
              sessionStorage.getItem("token_student") ||
              ""),
          // DO NOT set Content-Type, browser will handle it for FormData!
        },
        body: formData,
      }
    );

    const data = await res.json();

    if (data.plagiarismPercentage !== undefined) {
      const plagiarismStatus = data.status || (data.error ? "PLAGIARIZED" : "ACCEPTED");
      const plagiarismData = {
        status: plagiarismStatus,
        plagiarism: data.plagiarismPercentage,
        matches: data.matches || [],
        message: data.message || data.error || "No plagiarism detected.",
      };
      setPlagiarismResult(plagiarismData);

      if (typeof onPlagiarismCheck === "function") {
        onPlagiarismCheck(plagiarismData);
      }

      if (plagiarismStatus === "PLAGIARIZED") {
        toast.error(plagiarismData.message || "Submission rejected due to plagiarism.");
        return;
      }

      // Success!
      toast.success("🎉 Submission successful!");
      setSelectedFiles([]);
      setLinks([]);
      refreshSubmission();
      return;
    } else {
      // No plagiarism info returned, clear state
      setPlagiarismResult(null);
    }

    // Success (for non-plagiarism cases)
    toast.success("🎉 Submission successful!");
    setSelectedFiles([]);
    setLinks([]);
    refreshSubmission();

  } catch (err: any) {
    setError(err.message);
    toast.error(err.message);
  } finally {
    if (typeof setSubmitting === "function") setSubmitting(false);
  }
}


  async function handleUndoSubmission() {
    if (!submission?._id) return;
    if (!confirm("Are you sure you want to undo your submission?")) return;

    try {
      const res = await fetch(
        `${BACKEND_URL}/submission/${submission._id}/unsubmit`,
        {
          method: "DELETE",
          headers: {
            Authorization:
              "Bearer " +
              (localStorage.getItem("token_student") ||
                sessionStorage.getItem("token_student") ||
                ""),
          },
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to undo submission");
      }
      toast.success("Submission undone!");
      refreshSubmission();
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    }
  }


  // --- Main UI ---
  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/20">
      <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white p-8 overflow-hidden">
        {/* Header */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Upload className="w-6 h-6" />
            </div>
            <Sparkles className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-bold">Your Submission</h2>
          <p className="text-indigo-100 text-sm mt-1">Upload your work below</p>
        </div>
      </div>

      <div className="p-8">
        {submission && submission.status === "submitted" ? (
          <div className="space-y-6">
            {/* Success Header */}
            <div className="text-center p-6 bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl border border-emerald-200">
              <div className="p-4 bg-emerald-500 rounded-full w-fit mx-auto mb-4">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-emerald-800 mb-2">Successfully Submitted!</h3>
              <p className="text-emerald-600 text-sm">
                {submission.submittedAt && new Date(submission.submittedAt).toLocaleString()}
              </p>
            </div>
            {/* Feedback/Grade */}
            {(submission.grade !== undefined || submission.feedback) && (
              <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200">
                {submission.grade !== undefined && (
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-500 rounded-xl text-white">
                      <Star className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-blue-800 text-lg">Grade: {submission.grade}</div>
                      <div className="text-blue-600 text-sm">Your performance score</div>
                    </div>
                  </div>
                )}
                {submission.feedback && (
                  <div className="flex gap-3">
                    <div className="p-2 bg-blue-500 rounded-xl text-white flex-shrink-0">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-blue-800 mb-2">Instructor Feedback:</div>
                      <div className="text-blue-700 bg-white/60 p-4 rounded-xl">{submission.feedback}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Submitted Files */}
            {submission.files && submission.files.length > 0 && (
              <div>
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-600" />
                  Submitted Files
                </h4>
                <div className="space-y-3">
                  {submission.files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                          {getFileIcon(file.originalname)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">{file.originalname}</div>
                          <div className="text-xs text-gray-500">Submitted file</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        onClick={() =>
                          isImage(file.originalname)
                            ? setMediaPreview({ url: file.url, type: "img", originalname: file.originalname })
                            : isOfficeDoc(file.originalname)
                              ? setMediaPreview({ url: file.url, type: "office", originalname: file.originalname })
                              : isPDF(file.originalname)
                                ? setMediaPreview({ url: file.url, type: "pdf", originalname: file.originalname })
                                : window.open(getFileUrl(file.url), "_blank")
                        }
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submitted Links */}
            {submission.links && submission.links.length > 0 && (
              <div>
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-gray-600" />
                  Submitted Links
                </h4>
                <div className="space-y-3">
                  {submission.links.map((l, idx) => (
                    <a
                      key={idx}
                      href={l}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
                    >
                      <div className="p-2 bg-blue-500 rounded-lg text-white">
                        <LinkIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-blue-700 hover:underline truncate font-medium">{l}</div>
                        <div className="text-xs text-gray-500">External link</div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Undo Submission */}
            <button
              className="w-full inline-flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-2xl hover:from-red-600 hover:to-pink-600 transition-all duration-300 transform hover:scale-105 shadow-lg font-semibold"
              onClick={handleUndoSubmission}
              disabled={loadingUndo}
              type="button"
            >
              {loadingUndo ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Undoing...
                </>
              ) : (
                <>
                  <UndoArrow className="w-5 h-5" />
                  Undo Submission
                </>
              )}
            </button>
          </div>
        ) : submission ? (
          <div className="p-4 text-center text-red-600 font-bold">
            Submission exists but status is: "{submission.status}"
          </div>
        ) : (
          // Submission form
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* File Upload Area */}
            <div className="space-y-4">
              <label className="block text-lg font-bold text-gray-800  items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                Upload Files
              </label>
              <div
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${dragActive
                  ? 'border-indigo-400 bg-indigo-50 scale-105'
                  : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50'
                  }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl w-fit mx-auto">
                    <Upload className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-gray-700 font-medium mb-2">Drop files here or click to browse</p>
                    <p className="text-sm text-gray-500">Support for images, PDFs, and documents</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 font-semibold"
                  >
                    <Plus className="w-5 h-5" />
                    Choose Files
                  </button>
                </div>
              </div>

              {/* Selected Files Preview */}
              {selectedFiles.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Selected Files ({selectedFiles.length})
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 group">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="p-2 bg-white rounded-lg shadow-sm">
                            {getFileIcon(file.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-800 truncate">{file.name}</div>
                            <div className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Link Input */}
            <div className="space-y-4">
              <label className="block text-lg font-bold text-gray-800  items-center gap-2">
                <LinkIcon className="w-5 h-5 text-emerald-600" />
                Add Links (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={newLink}
                  onChange={e => setNewLink(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all duration-300 bg-white/80 backdrop-blur-sm"
                />
                <button
                  type="button"
                  onClick={handleAddLink}
                  className="px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {links.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                    <LinkIcon className="w-5 h-5" />
                    Added Links ({links.length})
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {links.map((l, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 group">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="p-2 bg-emerald-500 rounded-lg text-white">
                            <LinkIcon className="w-4 h-4" />
                          </div>
                          <a
                            href={l}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 hover:underline truncate flex-1 font-medium"
                          >
                            {l}
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveLink(idx)}
                          className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove link"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Submit Section */}
            <div className="space-y-4 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  {selectedFiles.length > 0 && (
                    <span className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {selectedFiles.length > 0 && links.length > 0 && <span>•</span>}
                  {links.length > 0 && (
                    <span className="flex items-center gap-1">
                      <LinkIcon className="w-4 h-4" />
                      {links.length} link{links.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="submit"
                className={`w-full inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform shadow-lg ${submitting || (selectedFiles.length === 0 && links.length === 0)
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 hover:scale-105 hover:shadow-xl'
                  }`}
                disabled={submitting || (selectedFiles.length === 0 && links.length === 0)}
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin w-6 h-6" />
                    <span>Submitting...</span>
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6" />
                    <span>Submit Assignment</span>
                    <Sparkles className="w-6 h-6" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
        {/* Error Display */}
        {error && (
          <div className="mt-6 p-6 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500 rounded-xl text-white">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-red-800">Error</div>
                <div className="text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}
        {plagiarismResult && (
          <div className="mb-6 p-6 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl shadow space-y-2">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="w-6 h-6 text-yellow-500" />
              <span className="font-bold text-yellow-800 text-lg">Plagiarism Check Result</span>
            </div>
            {/* Plagiarism Status */}
            {plagiarismResult.status && (
              <div className="text-md font-semibold mb-1">
                Status:{" "}
                <span className={
                  plagiarismResult.status === "PLAGIARIZED"
                    ? "text-red-600"
                    : plagiarismResult.status === "ACCEPTED"
                      ? "text-green-600"
                      : "text-gray-700"
                }>
                  {plagiarismResult.status}
                </span>
              </div>
            )}
            {/* Main Similarity Percentage */}
            {typeof plagiarismResult.plagiarism === "number" && (
              <div className="text-xl font-bold text-orange-600 mb-2">
                Similarity: {plagiarismResult.plagiarism.toFixed(2)}%
              </div>
            )}
            {/* Human-readable message if available */}
            {plagiarismResult.message && (
              <div className="text-gray-700">{plagiarismResult.message}</div>
            )}
            {/* Show Top Matches */}
            {plagiarismResult.matches && plagiarismResult.matches.length > 0 && (
              <div>
                <div className="font-semibold mb-1">Top Matches:</div>
                <ul className="pl-4 space-y-1">
                  {plagiarismResult.matches.slice(0, 5).map((match: any, idx: any) => (
                    <li key={idx} className="text-xs text-gray-800">
                      <span className={match.type === "submission" ? "text-blue-600" : "text-purple-600"}>
                        [{match.type}]
                      </span>{" "}
                      <span className="font-mono">ID: {match.source_id}</span>
                      {" - "}
                      <span>
                        Similarity: {(match.similarity * 100).toFixed(2)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Raw result (for debugging) */}
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-gray-400">Raw details</summary>
              <pre className="text-xs text-gray-600 bg-gray-100 p-2 rounded">
                {JSON.stringify(plagiarismResult, null, 2)}
              </pre>
            </details>
          </div>
        )}

      </div>

    </div>
  );
}
