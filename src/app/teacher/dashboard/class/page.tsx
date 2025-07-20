"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import CourseCard from "../components/card"; // Your card component
import { useUser } from "../teacherContext";

interface CourseInstance {
  _id: string;
  course: {
    name: string;
    semesterOrYear?: {
      name?: string;
      semesterNumber?: number;
      yearNumber?: number;
    };
  };
  batch: {
    batchname: string;
  };
  teacher: {
    _id: string;
    name: string;
    email?: string;
  };
  studentCount: number;
}

export default function MyCourseInstances() {
  const router = useRouter();
  const { user } = useUser();
  const [instances, setInstances] = useState<CourseInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher")
      : null;

  useEffect(() => {
    console.log("User from context:", user);
  }, [user]);

  useEffect(() => {
    const fetchCourseInstances = async () => {
      if (!user?.id) {
        console.log("⛔ User not loaded yet, skipping fetch.");
        return;
      }

      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/teacher-routes/my-course-instances`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        console.log("✅ Course Instances fetched:", res.data.courseInstances);
        setInstances(res.data.courseInstances || []);
      } catch (error: any) {
        console.error("❌ Axios error:", error.response?.data?.message || error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCourseInstances();
  }, [user, token]);

  if (loading || !user) {
    return <p className="text-center text-gray-600">Loading your courses...</p>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">My Courses</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {instances.map((item) => (
          <div
            key={item._id}
            className="cursor-pointer"
            onClick={() => router.push(`/teacher/dashboard/class/${item._id}`)}
          >
            <CourseCard
              title={item.course.name}
              semesterOrYear={
                item.course.semesterOrYear?.semesterNumber
                  ? `Semester ${item.course.semesterOrYear.semesterNumber}`
                  : item.course.semesterOrYear?.yearNumber
                  ? `Year ${item.course.semesterOrYear.yearNumber}`
                  : item.course.semesterOrYear?.name || "No Semester"
              }
              batchName={item.batch.batchname}
              teacherName={item.teacher.name}
              studentCount={item.studentCount}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
