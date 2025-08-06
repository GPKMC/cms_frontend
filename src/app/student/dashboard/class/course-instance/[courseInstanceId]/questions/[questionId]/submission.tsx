"use client";
import React, { useEffect, useState } from "react";
import {
  Upload, Sparkles, Loader2, AlertCircle,
  Trophy, Star, MessageSquare, Undo2 as UndoArrow
} from "lucide-react";
import toast from "react-hot-toast";
import { useUser } from "@/app/student/dashboard/studentContext";
import TiptapEditor from "../../components/rtecomponet";

interface Submission {
  _id: string;
  status: "draft" | "submitted";
  content?: string;
  submittedAt?: string;
  feedback?: string;
  grade?: number;
}
interface Props {
  submission: Submission | null;
  submitting: boolean;
  error: string | null;
  setError: (msg: string | null) => void;
  questionId: string;
  refreshSubmission: () => void;
  onPlagiarismCheck?: (result: any) => void;
}
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function QuestionSubmissionPanel({
  submission, submitting, error, setError,
  questionId, refreshSubmission, onPlagiarismCheck,
}: Props) {
  const { user } = useUser();
  const [content, setContent] = useState(submission?.content || "");
  const [plagiarismResult, setPlagiarismResult] = useState<any>(null);
  const [undoing, setUndoing] = useState(false);
console.log("submission panel props", submission);

  // --- SUBMIT HANDLER ---
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!questionId) return;
    setError(null);
    if (!content.trim() || content === "<p></p>") {
      setError("Submission content cannot be empty.");
      return;
    }
    fetch(
      `${BACKEND_URL}/questionsubmission/`, // backend route for question submission
      {
        method: "POST",
        headers: {
          Authorization:
            "Bearer " +
            (localStorage.getItem("token_student") ||
              sessionStorage.getItem("token_student") ||
              ""),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: questionId,              // match backend key `question`
          student: user?._id || user?.id,   // match backend key `student`
          answerText: content,               // match backend key `answerText`
        }),
      }
    )
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Submission failed");
        }
        return res.json();
      })
      .then((data) => {
        toast.success("🎉 Submission successful!");
        setContent(""); // clear editor on success
        refreshSubmission();
        if (onPlagiarismCheck) onPlagiarismCheck(data);
        if (data?.plagiarismResult) setPlagiarismResult(data.plagiarismResult);
      })
      .catch((err) => {
        setError(err.message);
        toast.error(err.message);
      });
  }
useEffect(() => {
  setContent(submission?.content || "");
}, [submission]);

  // --- UNDO SUBMISSION HANDLER ---
  async function handleUndoSubmission() {
    if (!submission?._id) return;
    if (!confirm("Are you sure you want to unsubmit your answer?")) return;
    setUndoing(true);
    try {
      const res = await fetch(
        `${BACKEND_URL}/questionsubmission/${submission._id}/unsubmit`,
        {
          method: "DELETE",
          headers: {
            Authorization:
              "Bearer " +
              (localStorage.getItem("token_student") ||
                sessionStorage.getItem("token_student") ||
                ""),
            "Content-Type": "application/json",
          },
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to unsubmit answer");
      }
      toast.success("Submission undone! You can resubmit.");
      setContent("");
      setPlagiarismResult(null);
      refreshSubmission(); // refetch so that panel updates
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setUndoing(false);
    }
  }

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/20">
      <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white p-8 overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Upload className="w-6 h-6" />
            </div>
            <Sparkles className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-bold">Your Submission</h2>
          <p className="text-indigo-100 text-sm mt-1">Write and submit your work below</p>
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

            {/* --- ANSWER PREVIEW --- */}
            {submission.content && (
              <div className="mb-6">
                <h4 className="font-bold text-indigo-700 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-6 h-6 text-indigo-600" />
                  <span>Answer Preview</span>
                </h4>
                <div
                  className="prose prose-indigo bg-indigo-50 rounded-xl p-4 border border-indigo-200 shadow"
                  style={{
                    minHeight: "80px",
                    fontSize: "1.1rem",
                    fontFamily: "inherit"
                  }}
                  dangerouslySetInnerHTML={{ __html: submission.content }}
                />
              </div>
            )}

            {/* --- UNDO SUBMISSION BUTTON --- */}
            <button
              type="button"
              className="w-full inline-flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-2xl hover:from-red-600 hover:to-pink-600 transition-all duration-300 transform hover:scale-105 shadow-lg font-semibold"
              onClick={handleUndoSubmission}
              disabled={undoing}
            >
              {undoing ? (
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
        ) : (
          // Submission form
          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <label className="block text-lg font-bold text-gray-800 mb-2  items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                Assignment Content
              </label>
              <TiptapEditor
                content={content}
                onChange={setContent}
                placeholder="Write your answer here..."
                className="bg-white"
              />
            </div>
            <div className="space-y-4 pt-6 border-t border-gray-200">
              <button
                type="submit"
                className={`w-full inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform shadow-lg ${submitting || !content.trim() || content === "<p></p>"
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 hover:scale-105 hover:shadow-xl'
                  }`}
                disabled={submitting || !content.trim() || content === "<p></p>"}
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin w-6 h-6" />
                    <span>Submitting...</span>
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
        {/* Show plagiarismResult UI if you want */}
        {plagiarismResult && (
          <div className="mb-6 p-6 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl shadow space-y-2">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="w-6 h-6 text-yellow-500" />
              <span className="font-bold text-yellow-800 text-lg">Plagiarism Check Result</span>
            </div>
            {/* ...your existing plagiarism display here... */}
          </div>
        )}
      </div>
    </div>
  );
}
