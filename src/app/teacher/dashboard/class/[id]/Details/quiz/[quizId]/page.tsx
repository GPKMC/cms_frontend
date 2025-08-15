"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  Hash,
  Check,
  AlertCircle,
  UserCircle2,
  Clock3,
  Percent
} from "lucide-react";

type OptionDoc = { _id: string; text: string };
type QuestionDoc = {
  _id: string;
  text: string;
  type: "mcq";
  points: number;
  options: OptionDoc[];
  correctOption?: string | null;
  feedbackCorrect?: string;
  feedbackIncorrect?: string;
};
type QuizDoc = {
  _id: string;
  title: string;
  description?: string;
  courseInstance: string;
  dueDate?: string | null;
  published?: boolean;
  questions: QuestionDoc[];
};

type Stats = { submittedCount: number; startedCount: number };

// Returned by /quiz-submissions?quiz=...&status=submitted with populate('student','username email')
type SubmissionRow = {
  _id: string;
  quiz: string;
  student: { _id: string; username?: string; email?: string } | string;
  status: "draft" | "submitted";
  totalScore?: number;
  submittedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const fmtDateTime = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.toLocaleDateString()} • ${d.toLocaleTimeString()}`;
};

export default function TeacherQuizDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string; quizId: string }>();
  const classId = String(params?.id ?? "");
  const quizId = String(params?.quizId ?? "");

  const [quiz, setQuiz] = useState<QuizDoc | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [subs, setSubs] = useState<SubmissionRow[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token_teacher") ||
        sessionStorage.getItem("token_teacher") ||
        ""
      : "";

  // total points possible for the quiz
  const maxPoints = useMemo(
    () => (quiz?.questions || []).reduce((sum, q) => sum + (q.points || 0), 0),
    [quiz?.questions]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const headers = { Authorization: `Bearer ${token}` };

        const [qRes, sRes, listRes] = await Promise.all([
          fetch(`${BACKEND}/quizrouter/${quizId}`, { headers, cache: "no-store" }),
          fetch(`${BACKEND}/quiz-submissions/stats?quizId=${quizId}`, { headers, cache: "no-store" }),
          fetch(`${BACKEND}/quiz-submissions?quiz=${quizId}&status=submitted`, { headers, cache: "no-store" })
        ]);

        if (!qRes.ok) {
          const t = await qRes.text();
          throw new Error(`Quiz load failed (${qRes.status}): ${t || qRes.statusText}`);
        }
        const quizJson = (await qRes.json()) as QuizDoc;

        let statsJson: Stats | null = null;
        if (sRes.ok) statsJson = (await sRes.json()) as Stats;

        let subsJson: SubmissionRow[] | null = null;
        if (listRes.ok) subsJson = (await listRes.json()) as SubmissionRow[];

        if (!alive) return;
        setQuiz(quizJson);
        setStats(statsJson);
        setSubs(subsJson ?? []);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load quiz.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [quizId, token]);

  const due = useMemo(() => {
    if (!quiz?.dueDate) return null;
    const d = new Date(quiz.dueDate);
    return {
      date: d.toLocaleDateString(),
      time: d.toLocaleTimeString(),
      isPast: d.getTime() < Date.now(),
    };
  }, [quiz?.dueDate]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="rounded-2xl border bg-white/80 backdrop-blur p-8 shadow-2xl">
          <div className="h-6 w-48 bg-gray-200 rounded mb-4 animate-pulse" />
          <div className="h-4 w-80 bg-gray-100 rounded mb-2 animate-pulse" />
          <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (err || !quiz) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-red-50 to-pink-50 p-4">
        <div className="max-w-md w-full bg-white/90 backdrop-blur rounded-2xl p-6 shadow-xl border">
          <div className="flex items-center gap-3 text-red-600 mb-3">
            <AlertCircle className="w-6 h-6" />
            <h2 className="font-semibold text-lg">Unable to load quiz</h2>
          </div>
          <p className="text-gray-700 mb-4">{err || "Quiz not found."}</p>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Top bar */}
      <div className="sticky top-14 z-20 -mx-6 mb-6 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-3 flex flex-wrap gap-3 justify-between items-center">
          <button
            onClick={() => router.push(`/teacher/dashboard/class/${classId}/workspace`)}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm shadow-sm hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to workspace
          </button>

          {/* Turned in count */}
          <div className="inline-flex items-center gap-3 rounded-xl border bg-white px-3 py-2 shadow-sm">
            <Hash className="h-4 w-4 text-indigo-600" />
            <div className="text-sm">
              <div className="font-semibold text-gray-800">
                Turned in: {stats ? stats.submittedCount : subs?.length ?? 0}
              </div>
              {stats && (
                <div className="text-gray-500 text-xs">
                  Started: {stats.startedCount}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      </div>

      {/* Main card */}
      <div className="mx-auto max-w-6xl rounded-2xl border bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white p-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium bg-white/20 px-2 py-1 rounded-full">
              Quiz
            </span>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h1 className="text-3xl font-bold leading-tight">{quiz.title}</h1>
            <div className="flex items-center gap-3 bg-white/15 rounded-lg px-3 py-2">
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  quiz.published ? "bg-emerald-500" : "bg-yellow-500"
                }`}
              >
                {quiz.published ? "Published" : "Unpublished"}
              </span>
              {due && (
                <div className="flex items-center gap-2 text-sm">
                  <CalendarClock className="w-4 h-4" />
                  <span>Due: {due.date} • {due.time}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8">
          {/* Description */}
          {quiz.description && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-2 text-gray-800">Description</h3>
              <div
                className="prose max-w-none text-gray-800"
                dangerouslySetInnerHTML={{ __html: quiz.description }}
              />
            </div>
          )}

          {/* Questions */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Hash className="w-5 h-5 text-fuchsia-600" />
              <h3 className="text-lg font-semibold">
                Questions ({quiz.questions?.length || 0})
              </h3>
            </div>

            {quiz.questions?.length ? (
              <div className="space-y-6">
                {quiz.questions.map((q, idx) => (
                  <div key={q._id} className="border rounded-2xl p-5 bg-white shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-fuchsia-500 rounded-lg flex items-center justify-center text-white">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">
                            {q.text}
                          </div>
                          <div className="text-xs text-gray-500">
                            Points: {q.points}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {q.options.map((o, oi) => {
                        const isCorrect = String(o._id) === String(q.correctOption || "");
                        return (
                          <div
                            key={o._id}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 border ${
                              isCorrect
                                ? "bg-emerald-50 border-emerald-200"
                                : "bg-gray-50 border-gray-200"
                            }`}
                          >
                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                              {String.fromCharCode(65 + oi)}
                            </div>
                            <div className="text-sm text-gray-800 flex-1">
                              {o.text}
                            </div>
                            {isCorrect && (
                              <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold">
                                <Check className="w-4 h-4" /> Correct
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {(q.feedbackCorrect || q.feedbackIncorrect) && (
                      <div className="grid sm:grid-cols-2 gap-3 mt-4">
                        {q.feedbackCorrect && (
                          <div className="text-xs p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                            <span className="font-semibold">Feedback (correct): </span>
                            {q.feedbackCorrect}
                          </div>
                        )}
                        {q.feedbackIncorrect && (
                          <div className="text-xs p-3 rounded-lg bg-amber-50 border border-amber-200">
                            <span className="font-semibold">Feedback (incorrect): </span>
                            {q.feedbackIncorrect}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500 border rounded-xl p-4">
                No questions added yet.
              </div>
            )}
          </div>

          {/* Submissions list */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <UserCircle2 className="w-5 h-5 text-indigo-600" />
                Submissions ({subs?.length ?? 0})
              </h3>
              <div className="text-sm text-gray-500">
                Max points: <span className="font-semibold text-gray-700">{maxPoints}</span>
              </div>
            </div>

            {subs && subs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border rounded-xl overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-sm text-gray-600">
                      <th className="px-4 py-3 border-b">Student</th>
                      <th className="px-4 py-3 border-b"><Clock3 className="inline w-4 h-4 mr-1" />Submitted</th>
                      <th className="px-4 py-3 border-b">Points</th>
                      <th className="px-4 py-3 border-b"><Percent className="inline w-4 h-4 mr-1" />Score</th>
                      <th className="px-4 py-3 border-b">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {subs.map((s) => {
                      const stu = s.student as SubmissionRow["student"];
                      const name =
                        typeof stu === "string"
                          ? stu
                          : stu?.username || stu?.email || "(unknown)";
                      const email =
                        typeof stu === "string" ? "" : (stu?.email || "");
                      const pts = typeof s.totalScore === "number" ? s.totalScore : 0;
                      const pct = maxPoints ? Math.round((pts / maxPoints) * 100) : 0;

                      return (
                        <tr key={s._id} className="border-t text-sm">
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-800">{name}</span>
                              {email && <span className="text-gray-500 text-xs">{email}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{fmtDateTime(s.submittedAt)}</td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-gray-800">
                              {pts} / {maxPoints}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 font-medium">
                              {pct}%
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                s.status === "submitted"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-yellow-50 text-yellow-700"
                              }`}
                            >
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-gray-500 border rounded-xl p-4">
                No submissions yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
