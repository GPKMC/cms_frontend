"use client";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import {
  BookOpen, Calendar, Clock, ChevronLeft, AlertCircle,
  CheckCircle, Play, Pause, FileText, Award, Users,
  TrendingUp, MapPin, ArrowLeft
} from 'lucide-react';

export default function MyClassSemesterDetail() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string[];
  const semesterOrYearId = slug?.[1];

  const [batchPeriod, setBatchPeriod] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!semesterOrYearId) return;
    setLoading(true);
    setError(null);
    const token =
      localStorage.getItem("token_student") ||
      sessionStorage.getItem("token_student");
    const baseurl = process.env.NEXT_PUBLIC_BACKEND_URL;

    fetch(`${baseurl}/student/batch-period/by-semester-or-year/${semesterOrYearId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.message || "Failed to fetch data.");
        }
        return res.json();
      })
      .then((data) => {
        setBatchPeriod(data.batchPeriod);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Could not load semester details.");
        setLoading(false);
      });
  }, [semesterOrYearId]);

  const getStatusConfig = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return {
          icon: <Play className="h-5 w-5" />,
          color: "from-green-500 to-emerald-600",
          bgColor: "from-green-50 to-emerald-50",
          textColor: "text-green-800",
          borderColor: "border-green-200",
        };
      case "completed":
        return {
          icon: <CheckCircle className="h-5 w-5" />,
          color: "from-blue-500 to-blue-600",
          bgColor: "from-blue-50 to-blue-50",
          textColor: "text-blue-800",
          borderColor: "border-blue-200",
        };
      case "paused":
        return {
          icon: <Pause className="h-5 w-5" />,
          color: "from-orange-500 to-amber-600",
          bgColor: "from-orange-50 to-amber-50",
          textColor: "text-orange-800",
          borderColor: "border-orange-200",
        };
      default:
        return {
          icon: <Clock className="h-5 w-5" />,
          color: "from-gray-500 to-gray-600",
          bgColor: "from-gray-50 to-gray-50",
          textColor: "text-gray-800",
          borderColor: "border-gray-200",
        };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Loading batch period details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Data</h3>
            <p className="text-red-600 text-lg">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!batchPeriod) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No Data Found</h3>
            <p className="text-gray-500">No data found for this semester.</p>
          </div>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(batchPeriod.status);
  const totalCredits = batchPeriod.semesterOrYear.courses.reduce(
    (sum: number, course: any) => sum + (course.credits || 0),
    0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 mb-6 transition-colors duration-200"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">Back</span>
          </button>

          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Course Catalog</h1>
            <p className="text-lg text-gray-600 mb-4">{batchPeriod.semesterOrYear.name}</p>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${statusConfig.bgColor} border ${statusConfig.borderColor}`}>
              {statusConfig.icon}
              <span className={`font-semibold ${statusConfig.textColor} capitalize`}>
                {batchPeriod.status}
              </span>
            </div>
          </div>
        </div>

        {/* Course List */}
        {batchPeriod.semesterOrYear.courses.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No Courses Available</h3>
            <p className="text-gray-500">No courses are assigned to this semester.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {batchPeriod.semesterOrYear.courses.map((course: any) => {
              const typeColors: Record<string, string> = {
                Core: 'from-blue-500 to-blue-600',
                Mathematics: 'from-green-500 to-green-600',
                General: 'from-purple-500 to-purple-600',
                Elective: 'from-orange-500 to-orange-600'
              };
              const defaultColor = 'from-gray-500 to-gray-600';
              const gradientColor = typeColors[course.type as string] || defaultColor;

              return (
                <div
                  key={course._id}
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`bg-gradient-to-r ${gradientColor} text-white rounded-lg p-3`}>
                        <span className="font-bold text-sm">{course.code}</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{course.name}</h3>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                          {course.assignedTeacher && (
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              <span>
                                {course.assignedTeacher.fullName ||
                                  course.assignedTeacher.username ||
                                  course.assignedTeacher.email ||
                                  "Unassigned"}
                              </span>
                            </div>
                          )}
                          {course.credits && (
                            <div className="flex items-center gap-1">
                              <Award className="h-4 w-4" />
                              <span>{course.credits} Credit{course.credits !== 1 ? 's' : ''}</span>
                            </div>
                          )}
                          {course.type && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{course.type}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (course.courseInstanceId) {
                          router.push(`/student/dashboard/myAssignment/courseInstance/${course.courseInstanceId}`);
                        }
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                        course.courseInstanceId
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                      disabled={!course.courseInstanceId}
                    >
                      View Assignments
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
