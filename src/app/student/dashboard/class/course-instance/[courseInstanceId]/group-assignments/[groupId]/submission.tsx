"use client"
import React, { useRef, useState } from "react";
import {
  Loader2, Undo2 as UndoArrow, FileText, Link as LinkIcon, Eye, ExternalLink, Trash2, Trophy, AlertCircle, Plus
} from "lucide-react";
import toast from "react-hot-toast";

interface SubmissionFile {
  url: string;
  originalname: string;
  mimetype?: string;
}
interface Submission {
  _id: string;
  status: "submitted" | "draft";
  files: SubmissionFile[];
  links: string[];
  submittedAt?: string;
  feedback?: string;
  grade?: number;
}

interface Props {
  submission: Submission | null;
  groupAssignmentId: string;
  groupId: string;
  loadingUndo: boolean;
  setLoadingUndo: (v: boolean) => void;
  error: string | null;
  setError: (msg: string | null) => void;
  refreshSubmission: () => void;
  getFileUrl: (url: string) => string;
  getFileIcon: (name: string) => React.ReactNode;
  isImage: (name: string) => boolean;
  isOfficeDoc: (name: string) => boolean;
  isPDF: (name: string) => boolean;
  setMediaPreview: (preview: any) => void;
  user: any; // <-- Pass user object (from context)
  onPlagiarismCheck?: (result: any) => void; // Optional, just like your solo version
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function GroupSubmissionPanel({
  submission, groupAssignmentId, groupId, loadingUndo, setLoadingUndo,
  error, setError, refreshSubmission,
  getFileUrl, getFileIcon, isImage, isOfficeDoc, isPDF, setMediaPreview,
  user, onPlagiarismCheck
}: Props) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [plagiarismResult, setPlagiarismResult] = useState<any>(null);

  // ----- Group Submission -----
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!groupAssignmentId || !groupId) return;
    setError(null);

    const formData = new FormData();
    selectedFiles.forEach(f => formData.append("files", f));
    links.forEach(l => formData.append("links", l));
    if (user?._id || user?.id) {
      formData.append("student_id", user._id || user.id);
      console.log("user",user)
    }
    formData.append("questionId", groupAssignmentId);
    formData.append("groupId", groupId);

    setSubmitting(true);
    try {
      const res = await fetch(
        `${BACKEND_URL}/submission/submit-assignment`,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " +
              (localStorage.getItem("token_student") ||
                sessionStorage.getItem("token_student") ||
                ""),
          },
          body: formData,
        }
      );
      console.log("Raw response status:", res.status);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("Submission error body:", body);
        throw new Error(body.error || "Submission failed");
      }
      const data = await res.json();
      console.log("Plagiarism check result:", data);

      setSelectedFiles([]);
      setLinks([]);
      toast.success("🎉 Group submission successful!");
      refreshSubmission();
      if (onPlagiarismCheck) onPlagiarismCheck(data); // Parent callback, if provided
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
  const filesList = e.target.files;
  if (!filesList) return;

  const newFiles: File[] = [];
  for (let i = 0; i < filesList.length; i++) {
    newFiles.push(filesList[i]);
  }
  setSelectedFiles(prev => [...prev, ...newFiles]);

  if (fileInputRef.current) fileInputRef.current.value = "";
}

  function handleRemoveFile(idx: number) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
  }
  function handleAddLink() {
    if (!newLink.trim()) return;
    setLinks(prev => [...prev, newLink.trim()]);
    setNewLink("");
  }
  function handleRemoveLink(idx: number) {
    setLinks(prev => prev.filter((_, i) => i !== idx));
  }

  // ----- Undo Group Submission -----
  async function handleUndoSubmission() {
    if (!groupAssignmentId || !groupId || !submission) return;
    if (!window.confirm("Are you sure you want to undo your group submission?")) return;
    setError(null);
    setLoadingUndo(true);

    try {
      const res = await fetch(
        `${BACKEND_URL}/submission/${groupAssignmentId}/group/${groupId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: "Bearer " +
              (localStorage.getItem("token_student") ||
                sessionStorage.getItem("token_student") ||
                ""),
          },
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to undo submission");
      }
      toast.success("Group submission undone!");
      refreshSubmission();
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoadingUndo(false);
    }
  }

  return (
    <div className="bg-white/80 rounded-3xl shadow-2xl overflow-hidden border border-white/20">
      <div className="p-8">
        {submission && submission.status === "submitted" ? (
          <div className="space-y-6">
            {/* Success Header */}
            <div className="text-center p-6 bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl border border-emerald-200">
              <div className="p-4 bg-emerald-500 rounded-full w-fit mx-auto mb-4">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-emerald-800 mb-2">Group Submitted!</h3>
              <p className="text-emerald-600 text-sm">
                {submission.submittedAt && new Date(submission.submittedAt).toLocaleString()}
              </p>
            </div>
            {/* Submitted Files */}
            {submission.files?.length > 0 && (
              <div>
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-600" />
                  Group Submitted Files
                </h4>
                <div className="space-y-3">
                  {submission.files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl group">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                          {getFileIcon(file.originalname)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">{file.originalname}</div>
                          <div className="text-xs text-gray-500">Group file</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
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
            {submission.links?.length > 0 && (
              <div>
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-gray-600" />
                  Group Submitted Links
                </h4>
                <div className="space-y-3">
                  {submission.links.map((l, idx) => (
                    <a
                      key={idx}
                      href={l}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100"
                    >
                      <div className="p-2 bg-blue-500 rounded-lg text-white">
                        <LinkIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-blue-700 hover:underline truncate font-medium">{l}</div>
                        <div className="text-xs text-gray-500">External link</div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-400" />
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
            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-700">{error}</span>
              </div>
            )}
          </div>
        ) : (
          // --------- Submission form ---------
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="text-lg font-semibold text-center text-indigo-700 mb-2">
              No group submission found yet. Submit your group's work below.
            </div>
            {/* File Upload */}
            <div className="space-y-2">
              <label className="block font-bold text-gray-800">
                Upload Group Files
              </label>
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-600"
              />
              {/* Selected Files */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2 mt-2">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl">
                      <span>{file.name}</span>
                      <button
                        type="button"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleRemoveFile(idx)}
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Links */}
            <div className="space-y-2">
              <label className="block font-bold text-gray-800">
                Add Links (optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={newLink}
                  onChange={e => setNewLink(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-xl"
                />
                <button type="button" onClick={handleAddLink} className="bg-blue-500 text-white px-4 py-2 rounded-xl">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {links.length > 0 && (
                <div className="space-y-2 mt-2">
                  {links.map((l, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl">
                      <a href={l} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline flex-1 truncate">{l}</a>
                      <button
                        type="button"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleRemoveLink(idx)}
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Submit Button */}
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white hover:from-indigo-700 hover:to-purple-700 hover:to-pink-700 hover:scale-105 hover:shadow-xl"
              disabled={submitting || (selectedFiles.length === 0 && links.length === 0)}
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin w-6 h-6" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <FileText className="w-6 h-6" />
                  <span>Submit Group Assignment</span>
                </>
              )}
            </button>
            {/* Error Display */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-700">{error}</span>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
