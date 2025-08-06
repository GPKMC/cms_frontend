'use client';

import React, { useEffect, useState } from 'react';
import {
  Loader2,
  AlertCircle,
  Clock,
  Award,
  CheckCircle,
  XCircle,
  BookOpen
} from 'lucide-react';
import { useParams } from 'next/navigation';

// --- Date formatting helper ---
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return {
    full: date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }),
    short: date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }),
    time: date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  };
};

// ---- Types ----
type Option = { _id: string; text: string };
type Question = {
  _id: string;
  text: string;
  type: 'mcq';
  points: number;
  options?: Option[];
  correctOption?: string;
  feedbackCorrect?: string;
  feedbackIncorrect?: string;
};
type Quiz = {
  _id: string;
  title: string;
  description: string;
  dueDate: string;
  questions: Question[];
};

type PopulatedAnswer = {
  question: Question;
  selectedOption: string;
  earnedPoints: number;
  teacherFeedback: string;
};

type FullSubmission = {
  _id: string;
  quiz: Quiz;
  student: string;
  status: 'in-progress' | 'submitted';
  answers: PopulatedAnswer[];
  totalScore: number;
};

export default function QuizDetail() {
  const { quizId } = useParams() as { quizId?: string };
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL!;
  const SUB_API = `${BACKEND}/quiz-submissions`;

  const [fullSub, setFullSub] = useState<FullSubmission | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize: start/get submission and fetch populated data
  useEffect(() => {
    if (!quizId) return;
    const token =
      localStorage.getItem('token_student') ||
      sessionStorage.getItem('token_student') ||
      '';

    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1) Fetch or start submission
        const startRes = await fetch(SUB_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ quiz: quizId })
        });
        if (!startRes.ok) throw new Error('Failed to start/fetch submission');
        const startBody = await startRes.json();
        const subId: string = (startBody.submission ?? startBody)._id;

        // 2) Fetch fully populated submission
        const fullRes = await fetch(`${SUB_API}/${subId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!fullRes.ok) throw new Error('Failed to load submission');
        const fetched: FullSubmission = await fullRes.json();

        setFullSub(fetched);

        // Prefill local userAnswers if still in-progress
        if (fetched.status === 'submitted') {
          setShowResults(true);
        } else {
          const map: Record<string, string> = {};
          fetched.answers.forEach(a => {
            map[a.question._id] = a.selectedOption;
          });
          setUserAnswers(map);
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [quizId]);

  // Handle option click (only if not yet answered & not showing results)
  const handleOptionClick = (qId: string, optId: string) => {
    if (showResults || userAnswers[qId]) return;
    setUserAnswers(prev => ({ ...prev, [qId]: optId }));
  };

  // Submit answers and re-fetch full submission
  const handleShowResults = async () => {
    if (!fullSub) return;
    const token =
      localStorage.getItem('token_student') ||
      sessionStorage.getItem('token_student') ||
      '';
    const answersPayload = fullSub.quiz.questions
      .filter(q => userAnswers[q._id])
      .map(q => ({ question: q._id, selectedOption: userAnswers[q._id] }));

    try {
      // PATCH answers
      await fetch(`${SUB_API}/${fullSub._id}/answers`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ answers: answersPayload })
      });
      // POST submit
      await fetch(`${SUB_API}/${fullSub._id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      // re-fetch populated
      const fullRes = await fetch(`${SUB_API}/${fullSub._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const fetched: FullSubmission = await fullRes.json();
      setFullSub(fetched);
      setShowResults(true);
    } catch (err) {
      console.error('Error submitting quiz:', err);
    }
  };

  // Derive UI metrics
  const quiz = fullSub?.quiz;
  const mcqCount = quiz?.questions.length ?? 0;
  const answeredCount = Object.keys(userAnswers).length;
  const allAnswered = mcqCount > 0 && answeredCount === mcqCount;
  const totalPoints = quiz?.questions.reduce((sum, q) => sum + q.points, 0) ?? 0;
  const earnedPoints = showResults
    ? fullSub?.totalScore ?? 0
    : quiz?.questions.reduce(
        (sum, q) => sum + (userAnswers[q._id] === q.correctOption ? q.points : 0),
        0
      ) ?? 0;
  const percent = totalPoints ? Math.round((earnedPoints / totalPoints) * 100) : 0;

  // Loading, error, or no quiz states
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="animate-spin w-16 h-16 text-indigo-600" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-pink-100">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }
  if (!quiz) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <BookOpen className="w-16 h-16 text-gray-400 mb-4" />
        <p className="text-gray-600">Quiz not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header & Progress */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8 border border-gray-100">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-800 mb-4">
                {quiz.title}
              </h1>
              <div
                className="prose prose-blue max-w-none text-gray-600"
                dangerouslySetInnerHTML={{ __html: quiz.description }}
              />
            </div>
            <div className="ml-6 text-right">
              <div className="bg-blue-100 rounded-lg p-4">
                <Clock className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-blue-800">Due Date</p>
                <p className="text-sm text-blue-600">
                  {formatDate(quiz.dueDate).short}
                </p>
                <p className="text-xs text-blue-500">
                  {formatDate(quiz.dueDate).time}
                </p>
              </div>
            </div>
          </div>
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-600">
                Progress
              </span>
              <span className="text-sm text-gray-500">
                {answeredCount}/{mcqCount} answered
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${mcqCount ? (answeredCount / mcqCount) * 100 : 0}%`
                }}
              />
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {quiz.questions.map((q, idx) => {
            const isAnswered = Boolean(userAnswers[q._id]);
            const showAnswer = showResults || isAnswered;
            const answerRecord = fullSub?.answers.find(
              a => a.question._id === q._id
            );

            return (
              <div
                key={q._id}
                className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
              >
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-white font-semibold text-lg">
                      Question {idx + 1}
                    </h3>
                    <div className="bg-white/20 rounded-full px-3 py-1">
                      <span className="text-white text-sm font-medium">
                        {q.points} point{q.points !== 1 && 's'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-gray-800 text-lg mb-6">{q.text}</p>

                  {/* Options */}
                  <div className="space-y-3">
                    {q.options?.map((opt, optIdx) => {
                      const isSelected = userAnswers[q._id] === opt._id;
                      const isCorrect = opt._id === q.correctOption;
                      let cls =
                        'w-full text-left px-6 py-4 border-2 rounded-lg flex items-center space-x-3 ';
                      if (showAnswer) {
                        if (isSelected && isCorrect)
                          cls += 'bg-green-50 border-green-300 text-green-800';
                        else if (isSelected && !isCorrect)
                          cls += 'bg-red-50 border-red-300 text-red-800';
                        else if (isCorrect)
                          cls += 'bg-green-50 border-green-300 text-green-800';
                        else cls += 'bg-gray-50 border-gray-200 text-gray-600';
                      } else {
                        cls +=
                          'border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700';
                      }
                      return (
                        <button
                          key={opt._id}
                          disabled={isAnswered || showResults}
                          onClick={() => handleOptionClick(q._id, opt._id)}
                          className={cls}
                        >
                          <div className="flex items-center w-full">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mr-4">
                              {String.fromCharCode(65 + optIdx)}
                            </div>
                            <span className="flex-1">{opt.text}</span>
                            {showAnswer && isSelected && (
                              <div className="ml-auto">
                                {isCorrect ? (
                                  <CheckCircle className="w-6 h-6 text-green-600" />
                                ) : (
                                  <XCircle className="w-6 h-6 text-red-600" />
                                )}
                              </div>
                            )}
                            {showAnswer && !isSelected && isCorrect && (
                              <div className="ml-auto">
                                <CheckCircle className="w-6 h-6 text-green-600" />
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Feedback */}
                  {showResults && answerRecord && (
                    <div className="mt-6 p-4 rounded-lg border-l-4">
                      {answerRecord.earnedPoints === q.points ? (
                        <div className="border-l-green-500 bg-green-50 p-4 flex items-start">
                          <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                          <div>
                            <p className="font-medium text-green-800 mb-1">
                              Correct!
                            </p>
                            <p className="text-green-700 text-sm">
                              {q.feedbackCorrect}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="border-l-red-500 bg-red-50 p-4 flex items-start">
                          <XCircle className="w-5 h-5 text-red-600 mr-3" />
                          <div>
                            <p className="font-medium text-red-800 mb-1">
                              Incorrect
                            </p>
                            <p className="text-red-700 text-sm">
                              {q.feedbackIncorrect}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit & Show Results */}
        {allAnswered && !showResults && (
          <div className="mt-8 text-center">
            <button
              onClick={handleShowResults}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-3 rounded-lg font-semibold"
            >
              Submit & Show Results
            </button>
          </div>
        )}

        {/* Final Results Summary */}
        {showResults && (
          <div className="mt-8 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-8 py-6 flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Quiz Results</h3>
                <p className="text-green-100">Well done!</p>
              </div>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="text-center p-6 bg-blue-50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {earnedPoints}
                  </div>
                  <div className="text-sm text-blue-600 font-medium">
                    Points Earned
                  </div>
                </div>
                <div className="text-center p-6 bg-indigo-50 rounded-lg">
                  <div className="text-3xl font-bold text-indigo-600 mb-2">
                    {totalPoints}
                  </div>
                  <div className="text-sm text-indigo-600 font-medium">
                    Total Points
                  </div>
                </div>
                <div className="text-center p-6 bg-green-50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {percent}%
                  </div>
                  <div className="text-sm text-green-600 font-medium">
                    Score
                  </div>
                </div>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center space-x-2 bg-gray-100 rounded-full px-6 py-2">
                  <span className="text-gray-600">
                    {percent >= 80
                      ? '🎉 Excellent!'
                      : percent >= 60
                      ? '👍 Good job!'
                      : '📚 Keep studying!'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
