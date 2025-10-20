"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Calendar, 
  ChevronRight, 
  BookOpen, 
  Clock,
  CheckCircle,
  GraduationCap,
  Users,
  Star,
  TrendingUp,
  BookmarkCheck
} from "lucide-react";
import axios from "axios";

type SemesterOrYear = {
  _id: string;
  slug?: string;
  name: string;
  unlocked: boolean;
  semesterNumber?: number;
  yearNumber?: number;
};

type Faculty = {
  name: string;
  type: "semester" | "yearly";
  total: number;
};

type Batch = {
  batchname: string;
  current: number; // current sem/year
};

type ApiResponse = {
  batch: Batch;
  faculty: Faculty;
  semestersOrYears: SemesterOrYear[];
};

export default function SemListMinimal() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token =
      localStorage.getItem("token_student") ||
      sessionStorage.getItem("token_student");
    if (!token) {
      alert("No student token found. Please login.");
      setLoading(false);
      return;
    }
    const baseurl = process.env.NEXT_PUBLIC_BACKEND_URL;
    axios
      .get(`${baseurl}/student/my-batch-semesters`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
        alert("Error loading semesters: " + (err.response?.data?.message || err.message));
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-8">
              <div className="animate-pulse flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-2xl"></div>
                <div>
                  <div className="h-8 bg-white/20 rounded w-64 mb-2"></div>
                  <div className="h-4 bg-white/20 rounded w-48"></div>
                </div>
              </div>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-24 bg-gray-100 rounded-xl"></div>
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse h-20 bg-gray-100 rounded-xl"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <div className="bg-white rounded-2xl shadow-2xl p-12 text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">No Data Available</h3>
            <p className="text-gray-600 text-lg">Unable to load your semester information at this time.</p>
          </div>
        </div>
      </div>
    );
  }

  const { faculty, batch, semestersOrYears } = data;
  const current = batch.current;

  // Only semesters/years up to current (inclusive), and unlocked
  const filtered = semestersOrYears.filter((s) =>
    faculty.type === "semester"
      ? (s.semesterNumber ?? 0) <= current && s.unlocked
      : (s.yearNumber ?? 0) <= current && s.unlocked
  );

  // Calculate progress
  const progressPercentage = (filtered.length / faculty.total) * 100;

  const urlType = faculty.type === "yearly" ? "year" : "semester";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-4 sm:py-8 px-3 sm:px-6 pb-20 md:pb-8">
      <div className="max-w-6xl mx-auto">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-12">
          <div className="bg-white rounded-lg sm:rounded-2xl shadow-lg p-3 sm:p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-blue-100 rounded-lg sm:rounded-xl flex items-center justify-center mx-auto sm:mx-0">
                <Users className="w-5 h-5 sm:w-7 sm:h-7 text-blue-600" />
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{batch.batchname}</h3>
                <p className="text-gray-600 font-medium text-xs sm:text-base">Your Batch</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg sm:rounded-2xl shadow-lg p-3 sm:p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-green-100 rounded-lg sm:rounded-xl flex items-center justify-center mx-auto sm:mx-0">
                <TrendingUp className="w-5 h-5 sm:w-7 sm:h-7 text-green-600" />
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900">{current}</h3>
                <p className="text-gray-600 font-medium text-xs sm:text-base">Current {faculty.type === "semester" ? "Sem" : "Year"}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg sm:rounded-2xl shadow-lg p-3 sm:p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-purple-100 rounded-lg sm:rounded-xl flex items-center justify-center mx-auto sm:mx-0">
                <BookmarkCheck className="w-5 h-5 sm:w-7 sm:h-7 text-purple-600" />
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900">{filtered.length}</h3>
                <p className="text-gray-600 font-medium text-xs sm:text-base">Available</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg sm:rounded-2xl shadow-lg p-3 sm:p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-orange-100 rounded-lg sm:rounded-xl flex items-center justify-center mx-auto sm:mx-0">
                <Star className="w-5 h-5 sm:w-7 sm:h-7 text-orange-600" />
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900">{Math.round(progressPercentage)}%</h3>
                <p className="text-gray-600 font-medium text-xs sm:text-base">Progress</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-4 py-6 sm:px-8 sm:py-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0">
              <div className="flex items-center gap-3 sm:gap-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl flex items-center justify-center">
                  <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">
                    Assignment Timeline
                  </h2>
                  <p className="text-blue-100 text-sm sm:text-lg">
                    Choose a {faculty.type} to view assignments
                  </p>
                </div>
              </div>
              <div className="hidden md:block">
                <div className="text-right text-white">
                  <div className="text-2xl sm:text-3xl font-bold">{faculty.name}</div>
                  <div className="text-blue-200">Faculty</div>
                </div>
              </div>
            </div>
            {/* Progress Bar */}
            <div className="mt-4 sm:mt-8">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className="text-white font-medium text-sm sm:text-base">Academic Progress</span>
                <span className="text-white font-bold text-sm sm:text-base">{Math.round(progressPercentage)}%</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2 sm:h-3">
                <div 
                  className="bg-white h-2 sm:h-3 rounded-full transition-all duration-1000 ease-out shadow-lg"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <p className="text-blue-100 text-xs sm:text-sm mt-1 sm:mt-2">
                {filtered.length} of {faculty.total} {faculty.type}s completed
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <GraduationCap className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                  No {faculty.type}s Available
                </h3>
                <p className="text-gray-600 text-lg">
                  No unlocked {faculty.type}s found for your current progress level.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filtered.map((sem, index) => {
                  const isCurrent = faculty.type === "semester" 
                    ? sem.semesterNumber === current 
                    : sem.yearNumber === current;
                  const url = `/student/dashboard/myAssignment/${urlType}/${sem._id}`;
                  return (
                    <div
                      key={sem._id}
                      className="group relative bg-gradient-to-br from-gray-50 to-white rounded-2xl border-2 border-gray-100 hover:border-blue-300 hover:shadow-xl transition-all duration-300 overflow-hidden"
                    >
                      {/* Card Background Pattern */}
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="relative p-8">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-6">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 ${
                              isCurrent 
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' 
                                : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 group-hover:from-blue-500 group-hover:to-indigo-500 group-hover:text-white'
                            }`}>
                              {isCurrent ? <CheckCircle className="w-8 h-8" /> : <BookOpen className="w-8 h-8" />}
                            </div>
                            <div>
                              <h3 className="text-2xl font-bold text-gray-900 group-hover:text-blue-900 mb-2">
                                {sem.name}
                              </h3>
                              <div className="flex items-center gap-3 text-sm">
                                {isCurrent && (
                                  <>
                                    <div className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full">
                                      <Clock className="w-4 h-4" />
                                      <span className="font-medium">Current Semester</span>
                                    </div>
                                  </>
                                )}
                                {!isCurrent && (
                                  <div className="flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1 rounded-full group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                                    <span className="font-medium">
                                      {faculty.type === "semester" ? `Semester ${sem.semesterNumber}` : `Year ${sem.yearNumber}`}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          {isCurrent && (
                            <div className="hidden sm:flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-xl border border-green-200">
                              <Star className="w-5 h-5" />
                              <span className="font-semibold">Active</span>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end">
                          {sem.unlocked ? (
                            <Link
                              href={url}
                              className={`px-8 py-4 rounded-xl font-semibold transition-all duration-300 flex items-center gap-3 text-lg shadow-lg hover:shadow-xl transform hover:scale-105 ${
                                isCurrent
                                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                              }`}
                            >
                              <span>View Assignments</span>
                              <ChevronRight className="w-6 h-6" />
                            </Link>
                          ) : (
                            <button
                              className="px-8 py-4 rounded-xl font-semibold flex items-center gap-3 text-lg bg-gray-300 text-gray-500 cursor-not-allowed"
                              disabled
                            >
                              Locked
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* Footer */}
          {filtered.length > 0 && (
            <div className="bg-gray-50 px-8 py-6 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <p className="text-gray-600">
                  Showing <span className="font-semibold text-gray-900">{filtered.length}</span> available {faculty.type}{filtered.length !== 1 ? 's' : ''}
                </p>
                <p className="text-gray-600">
                  Batch: <span className="font-semibold text-gray-900">{batch.batchname}</span> • Faculty: <span className="font-semibold text-gray-900">{faculty.name}</span>
                </p>
              </div>
            </div>
          )}
        </div>
        {/* Bottom Action */}
        <div className="text-center mt-12">
          <p className="text-gray-600 text-lg">
            Need help? <a href="#" className="text-blue-600 hover:text-blue-700 font-medium hover:underline">Contact Support</a>
          </p>
        </div>
      </div>
    </div>
  );
}
