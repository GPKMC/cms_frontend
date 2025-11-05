"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  BookOpen,
  Calendar,
  Clock,
  ChevronLeft,
  AlertCircle,
  CheckCircle,
  Play,
  Pause,
  FileText,
  Award,
  Users,
  TrendingUp,
  MapPin,
} from "lucide-react";
import axios from "axios";

type Course = {
  _id: string;
  code: string;
  name: string;
  credits?: number;
  type?: string;
  assignedTeacher?:
    | {
        _id: string;
        fullName?: string;
        username?: string;
        email?: string;
      }
    | null;
  courseInstanceId?: string;
};

type BatchPeriod = {
  _id: string;
  status: string;
  startDate: string;
  endDate: string;
  semesterOrYear: {
    _id: string;
    name: string;
    courses: Course[];
  };
};

export default function MyClassSemesterDetail() {
  const rawParams = useParams() || ({} as Record<string, string | string[]>);
  const router = useRouter();

  const slugParam = (rawParams as { slug?: string | string[] }).slug;
  const slug: string[] = Array.isArray(slugParam)
    ? slugParam
    : slugParam
    ? [slugParam]
    : [];

  const type = slug[0]; // "semester" or "year"
  const semesterOrYearId = slug[1];

  const [batchPeriod, setBatchPeriod] = useState<BatchPeriod | null>(null);
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

    axios
      .get(
        `${baseurl}/student/batch-period/by-semester-or-year/${semesterOrYearId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      .then((res) => {
        setBatchPeriod(res.data.batchPeriod);
        setLoading(false);
      })
      .catch((err) => {
        if (err.response && err.response.data && err.response.data.message) {
          setError(err.response.data.message);
        } else {
          setError("Something went wrong. Please try again.");
        }
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
            <p className="text-gray-600 text-lg">
              Loading batch period details...
            </p>
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
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Error Loading Data
            </h3>
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
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              No Data Found
            </h3>
            <p className="text-gray-500">
              No data found for this {type || "period"}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Unique instructors
  const uniqueTeacherIds = [
    ...new Set(
      batchPeriod.semesterOrYear.courses
        .map((c) => c.assignedTeacher?._id)
        .filter(Boolean)
    ),
  ];
  const instructorCount = uniqueTeacherIds.length;

  const statusConfig = getStatusConfig(batchPeriod.status);
  const totalCredits = batchPeriod.semesterOrYear.courses.reduce(
    (sum, course) => sum + (course.credits || 0),
    0
  );

  const courseTypes = [
    ...new Set(
      batchPeriod.semesterOrYear.courses
        .map((course) =>
          course.type === "compulsory" || course.type === "elective"
            ? course.type
            : undefined
        )
        .filter(Boolean)
    ),
  ] as Array<"compulsory" | "elective">;

  const prettyType: Record<"compulsory" | "elective", string> = {
    compulsory: "Compulsory",
    elective: "Elective",
  };

  // Duration + progress
  const startDate = new Date(batchPeriod.startDate);
  const endDate = new Date(batchPeriod.endDate);
  const currentDate = new Date();
  const totalDuration = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysCompleted = Math.max(
    0,
    Math.ceil(
      (currentDate.getTime() - startDate.getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
  const progressPercentage = Math.min(
    100,
    Math.max(0, (daysCompleted / totalDuration) * 100)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Back Navigation */}
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 mb-6 transition-colors duration-200"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="font-medium">Back to Semesters</span>
        </button>

        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-100 p-3 rounded-xl">
                <Calendar className="h-8 w-8 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {type === "semester" ? "Semester" : "Year"}:{" "}
                  {batchPeriod.semesterOrYear.name}
                </h1>
                <div
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${statusConfig.bgColor} ${statusConfig.borderColor} border`}
                >
                  <div
                    className={`text-white bg-gradient-to-r ${statusConfig.color} p-1 rounded-full`}
                  >
                    {statusConfig.icon}
                  </div>
                  <span
                    className={`font-semibold capitalize ${statusConfig.textColor}`}
                  >
                    {batchPeriod.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                Period Progress
              </span>
              <span className="text-sm font-medium text-indigo-600">
                {Math.round(progressPercentage)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{startDate.toLocaleDateString()}</span>
              <span>{endDate.toLocaleDateString()}</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-600 font-medium">
                    Total Courses
                  </p>
                  <p className="text-2xl font-bold text-blue-800">
                    {batchPeriod.semesterOrYear.courses.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
              <div className="flex items-center gap-3">
                <Award className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-green-600 font-medium">
                    Total Credits
                  </p>
                  <p className="text-2xl font-bold text-green-800">
                    {totalCredits}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm text-purple-600 font-medium">
                    Instructors
                  </p>
                  <p className="text-2xl font-bold text-purple-800">
                    {instructorCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-sm text-orange-600 font-medium">
                    Duration
                  </p>
                  <p className="text-2xl font-bold text-orange-800">
                    {totalDuration}d
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Period Details */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <MapPin className="h-6 w-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Period Timeline
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-green-500 text-white p-2 rounded-lg">
                  <Calendar className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-green-800">Start Date</h3>
              </div>
              <p className="text-2xl font-bold text-green-900">
                {startDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-50 p-6 rounded-xl border border-blue-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-blue-500 text-white p-2 rounded-lg">
                  <Calendar className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-blue-800">End Date</h3>
              </div>
              <p className="text-2xl font-bold text-blue-900">
                {endDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Courses Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="h-6 w-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-900">Course Catalog</h2>
          </div>

          {batchPeriod.semesterOrYear.courses.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📚</div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                No Courses Available
              </h3>
              <p className="text-gray-500">
                No courses are assigned to this {type || "period"}.
              </p>
            </div>
          ) : (
            <div className="grid gap-6">
              {batchPeriod.semesterOrYear.courses.map((course) => {
                const typeColorsMap: Record<string, string> = {
                  Core: "from-blue-500 to-blue-600",
                  Mathematics: "from-green-500 to-green-600",
                  General: "from-purple-500 to-purple-600",
                  Elective: "from-orange-500 to-orange-600",
                };
                const defaultColor = "from-gray-500 to-gray-600";
                const gradientColor =
                  typeColorsMap[course.type || ""] || defaultColor;

                return (
                  <div
                    key={course._id}
                    className="bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div
                          className={`bg-gradient-to-r ${gradientColor} text-white rounded-lg p-3 min-w-0`}
                        >
                          <span className="font-bold text-sm whitespace-nowrap">
                            {course.code}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xl font-bold text-gray-900 mb-2">
                            {course.name}
                          </h3>
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
                            {course.credits != null && (
                              <div className="flex items-center gap-1">
                                <Award className="h-4 w-4" />
                                <span>
                                  {course.credits} Credit
                                  {course.credits !== 1 ? "s" : ""}
                                </span>
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
                            router.push(
                              `/student/dashboard/class/course-instance/${course.courseInstanceId}`
                            );
                          } else {
                            alert("Course instance not found for this course.");
                          }
                        }}
                        className="ml-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 text-sm font-medium whitespace-nowrap"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Summary Section */}
        <div className="mt-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-xl p-8 text-white">
          <div className="text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-yellow-300" />
            <h3 className="text-2xl font-bold mb-2">
              {batchPeriod.semesterOrYear.name} Overview
            </h3>
            <p className="text-indigo-100 text-lg mb-4">
              {batchPeriod.semesterOrYear.courses.length} courses •{" "}
              {totalCredits} credits • {instructorCount} instructors
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              {courseTypes.map((t) => (
                <div
                  key={t}
                  className="bg-white bg-opacity-20 rounded-full px-4 py-2"
                >
                  <span className="font-medium">
                    {prettyType[t] ?? t ?? "Unknown"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
