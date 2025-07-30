"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  User,
  Users,
  Calendar,
  BookOpen,
  GraduationCap
} from "lucide-react";
import AnnouncementForm from "./components/announcement";
import CourseFeed from "./components/courseFeed";

interface CourseInstanceOverview {
  _id: string;
  teacher: { username: string; email: string };
  course: {
    name: string;
    code: string;
    description: string;
    semesterOrYear?: {
      semesterNumber?: number;
      yearNumber?: number;
      name?: string;
      status?: string;
    };
  };
  batch: {
    batchname: string;
    faculty: {
      code: string;
      type: string;
      programLevel: string;
    };
  };
  studentCount?: number;
}

export default function CourseInstanceOverview() {
  const params = useParams();
  const courseInstanceId = params?.courseInstanceId as string;

  const [data, setData] = useState<CourseInstanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [openAnncouncement ,setOpenAnnouncement]= useState(false);
  useEffect(() => {
    if (!courseInstanceId) return;

    const fetchOverview = async () => {
      setLoading(true);
      setError(null);

      try {
        const token =
          localStorage.getItem("token_student") ||
          sessionStorage.getItem("token_student");
        if (!token) throw new Error("Authentication token not found");

        const res = await fetch(
          `http://localhost:5000/course-api/courseInstance/${courseInstanceId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            }
          }
        );

        if (!res.ok) {
          throw new Error(`Failed to fetch course instance: ${res.status}`);
        }

        const result = await res.json();
        console.log("📦 Course Overview:", result);
        setData(result.instance || result.courseInstance || null);
      } catch (err) {
        console.error("❌ Error fetching course instance:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, [courseInstanceId]);

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4 w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded mb-3 w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded mb-6 w-full"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded w-2/3"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div>
            <h3 className="text-red-800 font-medium">Error Loading Course</h3>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Course Not Found</h3>
          <p className="text-gray-600">
            The requested course instance could not be found.
          </p>
        </div>
      </div>
    );
  }

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim();
  };

  const descriptionPreview = data.course.description
    ? truncateText(data.course.description, 150)
    : "";

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{data.course.name}</h1>
        <div className="flex items-center gap-4 text-sm text-gray-600 mb-6">
          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
            {data.course.code}
          </span>
          <span className="flex items-center gap-1">
            <GraduationCap className="h-4 w-4" />
            {data.batch.faculty.programLevel}
          </span>
        </div>

        {/* Top Row with Key Details */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Instructor */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-medium text-blue-900">Instructor</h3>
            </div>
            <p className="font-semibold text-gray-900">{data.teacher.username}</p>
          </div>

          {/* Batch Details */}
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-medium text-green-900">Batch</h3>
            </div>
            <p className="font-semibold text-gray-900">{data.batch.batchname}</p>
            <p className="text-xs text-gray-600 mt-1">{data.batch.faculty.code}</p>
          </div>

          {/* Academic Period */}
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              <h3 className="text-sm font-medium text-purple-900">Period</h3>
            </div>
            <div className="space-y-1">
              {data.course.semesterOrYear?.name && (
                <p className="font-semibold text-gray-900">{data.course.semesterOrYear.name}</p>
              )}
              {data.course.semesterOrYear?.semesterNumber && (
                <p className="text-xs text-gray-600">
                  Semester {data.course.semesterOrYear.semesterNumber}
                </p>
              )}
              {data.course.semesterOrYear?.yearNumber && (
                <p className="text-xs text-gray-600">
                  Year {data.course.semesterOrYear.yearNumber}
                </p>
              )}
            </div>
          </div>

          {/* Enrollment */}
          {data.studentCount !== undefined && (
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-orange-600" />
                <h3 className="text-sm font-medium text-orange-900">Enrollment</h3>
              </div>
              <p className="text-2xl font-bold text-gray-900">{data.studentCount}</p>
              <p className="text-xs text-gray-600">Students</p>
            </div>
          )}
        </div>

        {/* Course Overview Section */}
        {data.course.description && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">Course Overview</h3>

          <div
  className={`text-gray-700 leading-relaxed transition-all duration-300 ease-in-out ${
    showFullDescription ? "max-h-[600px] overflow-y-auto" : "max-h-[120px] overflow-hidden"
  }`}
>
  <p>
    {showFullDescription
      ? data.course.description
      : descriptionPreview + (data.course.description.length > 150 ? "..." : "")}
  </p>
</div>


            {data.course.description.length > 150 && (
              <button
                onClick={() => setShowFullDescription(!showFullDescription)}
                className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors duration-200 flex items-center gap-1"
              >
                {showFullDescription ? (
                  <>
                    <span>Read Less</span>
                    <svg
                      className="w-4 h-4 transform rotate-180"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </>
                ) : (
                  <>
                    <span>Read More</span>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
       <div
    className="w-4xl h-[110px] flex flex-col items-center justify-center bg-amber-50 border-2 border-dashed border-blue-300 rounded-2xl shadow cursor-pointer hover:bg-blue-100 transition"
    onClick={() => setOpenAnnouncement(true)}
  >
    {/* <Plus className="mb-1 text-blue-600" size={32} /> */}
    <span className="text-lg font-semibold text-blue-700">Add your announcement</span>
    <span className="text-xs text-blue-500 mt-1">Click to open form</span>
  </div>
  <CourseFeed courseInstanceId={courseInstanceId}/>
  {openAnncouncement && (
  
    // <div className="fixed inset-0 z-50 flex items-center justify-center bg-white backdrop-blur-md p-3">
    //   <div className="bg-white rounded-xl shadow-lg p-0 max-w-2xl w-full relative">
    //     <button
    //       className="absolute top-3 right-4 text-gray-400 hover:text-gray-700 text-xl"
    //       onClick={() => setModalOpen(false)}
    //       aria-label="Close"
    //     >
    //       ×
    //     </button>
        <AnnouncementForm
          courseInstanceId={String(courseInstanceId)}
          courseName={data.course.name}
          onSuccess={() => setOpenAnnouncement(false)}
        />
    //   </div>
    // </div>
  )}
    </div>
  );
}
