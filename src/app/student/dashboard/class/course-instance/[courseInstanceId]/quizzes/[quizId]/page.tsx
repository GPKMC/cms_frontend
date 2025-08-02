'use client';

import React, { useEffect, useState } from 'react';
// Simple date formatting function
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
import { Loader2, AlertCircle, Clock, Award, CheckCircle, XCircle, BookOpen } from 'lucide-react';
import { useParams } from 'next/navigation';

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

export default function QuizDetail() {
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string,string>>({});
  const [showResults, setShowResults] = useState<boolean>(false);

  const { quizId } = useParams() as { quizId?: string };

  useEffect(() => {
    // Don’t run until quizId is defined
    if (!quizId) return;

    const fetchQuiz = async () => {
      setLoading(true);
      setError(null);
      try {
        const token =
          localStorage.getItem('token_student') ||
          sessionStorage.getItem('token_student') ||
          '';

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/quizrouter/${quizId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            cache: 'no-store',
          }
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || res.statusText);
        }

        const payload = await res.json();
        // API might wrap the quiz in { quiz: {...} }
        setQuiz(payload.quiz ?? payload);
      } catch (err: any) {
        setError(err.message || 'Failed to load quiz');
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId]);

  if (loading) return <div>Loading…</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
  if (!quiz) return <div>No quiz found.</div>;

  // Handle option click
  const handleOptionClick = (qId: string, optId: string) => {
    if (userAnswers[qId]) return;
    setUserAnswers(prev => ({ ...prev, [qId]: optId }));
  };

  // Compute scores
  const totalMcqPoints = quiz
    ? quiz.questions
        .filter(q => q.type === 'mcq')
        .reduce((sum, q) => sum + q.points, 0)
    : 0;
  
  const earnedPoints = quiz
    ? quiz.questions.reduce((sum, q) => {
        if (q.type === 'mcq' && userAnswers[q._id] === q.correctOption) {
          return sum + q.points;
        }
        return sum;
      }, 0)
    : 0;

  const mcqCount = quiz ? quiz.questions.filter(q => q.type === 'mcq').length : 0;
  const answeredMcqCount = Object.keys(userAnswers).length;
  const allMcqsAnswered = mcqCount > 0 && answeredMcqCount === mcqCount;
  const scorePercentage = totalMcqPoints > 0 ? Math.round((earnedPoints / totalMcqPoints) * 100) : 0;

  const handleShowResults = () => {
    setShowResults(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="animate-spin w-16 h-16 text-indigo-600 mx-auto mb-4" />
          <p className="text-lg text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-pink-100">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Oops! Something went wrong</h2>
          <p className="text-gray-600">Error loading quiz: {error}</p>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Quiz Not Found</h2>
          <p className="text-gray-600">The quiz you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header Card */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8 border border-gray-100">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-800 mb-4">{quiz.title}</h1>
              <div 
                className="prose prose-blue max-w-none text-gray-600 mb-4" 
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
          
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-600">Progress</span>
              <span className="text-sm text-gray-500">{answeredMcqCount}/{mcqCount} questions</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${mcqCount > 0 ? (answeredMcqCount / mcqCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {quiz.questions.map((q, idx) => (
            <div key={q._id} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-white font-semibold text-lg">
                    Question {idx + 1}
                  </h3>
                  <div className="bg-white/20 rounded-full px-3 py-1">
                    <span className="text-white text-sm font-medium">
                      {q.points} {q.points === 1 ? 'point' : 'points'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <p className="text-gray-800 text-lg mb-6 leading-relaxed">{q.text}</p>

                {q.type === 'mcq' && q.options && (
                  <div className="space-y-3">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = userAnswers[q._id] === opt._id;
                      const isCorrect = opt._id === q.correctOption;
                      const showAnswer = showResults || userAnswers[q._id];
                      
                      let btnClass = 'w-full text-left px-6 py-4 border-2 rounded-lg transition-all duration-200 flex items-center space-x-3 ';
                      
                      if (showAnswer) {
                        if (isSelected && isCorrect) {
                          btnClass += 'bg-green-50 border-green-300 text-green-800 shadow-md';
                        } else if (isSelected && !isCorrect) {
                          btnClass += 'bg-red-50 border-red-300 text-red-800 shadow-md';
                        } else if (isCorrect) {
                          btnClass += 'bg-green-50 border-green-300 text-green-800 shadow-md';
                        } else {
                          btnClass += 'bg-gray-50 border-gray-200 text-gray-600';
                        }
                      } else {
                        btnClass += 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md text-gray-700';
                      }

                      return (
                        <button
                          key={opt._id}
                          onClick={() => handleOptionClick(q._id, opt._id)}
                          disabled={!!userAnswers[q._id]}
                          className={btnClass}
                        >
                          <div className="flex items-center w-full">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium mr-4">
                              {String.fromCharCode(65 + optIdx)}
                            </div>
                            <span className="flex-1 text-left">{opt.text}</span>
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
                )}

                {/* Feedback */}
                {userAnswers[q._id] && showResults && q.feedbackCorrect && q.feedbackIncorrect && (
                  <div className="mt-6 p-4 rounded-lg border-l-4">
                    {userAnswers[q._id] === q.correctOption ? (
                      <div className="border-l-green-500 bg-green-50">
                        <div className="flex items-start">
                          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-green-800 mb-1">Correct!</p>
                            <p className="text-green-700 text-sm">{q.feedbackCorrect}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="border-l-red-500 bg-red-50">
                        <div className="flex items-start">
                          <XCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-red-800 mb-1">Incorrect</p>
                            <p className="text-red-700 text-sm">{q.feedbackIncorrect}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Results Section */}
        {allMcqsAnswered && (
          <div className="mt-8">
            {!showResults ? (
              <div className="bg-white rounded-xl shadow-lg p-8 text-center border border-gray-100">
                <div className="mb-6">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">Quiz Complete!</h3>
                  <p className="text-gray-600">You've answered all questions. Ready to see your results?</p>
                </div>
                <button
                  onClick={handleShowResults}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Show Results
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-8 py-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                        <Award className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white">Quiz Results</h3>
                        <p className="text-green-100">Great job completing the quiz!</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="text-center p-6 bg-blue-50 rounded-lg">
                      <div className="text-3xl font-bold text-blue-600 mb-2">{earnedPoints}</div>
                      <div className="text-sm text-blue-600 font-medium">Points Earned</div>
                    </div>
                    <div className="text-center p-6 bg-indigo-50 rounded-lg">
                      <div className="text-3xl font-bold text-indigo-600 mb-2">{totalMcqPoints}</div>
                      <div className="text-sm text-indigo-600 font-medium">Total Points</div>
                    </div>
                    <div className="text-center p-6 bg-green-50 rounded-lg">
                      <div className="text-3xl font-bold text-green-600 mb-2">{scorePercentage}%</div>
                      <div className="text-sm text-green-600 font-medium">Score</div>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="inline-flex items-center space-x-2 bg-gray-100 rounded-full px-6 py-2">
                      <span className="text-gray-600">
                        {scorePercentage >= 80 ? '🎉 Excellent work!' : 
                         scorePercentage >= 60 ? '👍 Good job!' : 
                         '📚 Keep studying!'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}