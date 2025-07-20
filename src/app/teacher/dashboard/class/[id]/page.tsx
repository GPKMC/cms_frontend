"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import CourseBanner from "../../components/banner";


interface CourseInstanceDetail {
  _id: string;
  batch: {
    batchname: string;
  };
  teacher: {
    username: string;
  };
  studentCount: number;
  course: {
    name: string;
    semesterOrYear?: {
      semesterNumber?: number;
      name?: string;
    };
  };
}

export default function CourseInstanceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;
  const [data, setData] = useState<CourseInstanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const token =
          localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher");
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/course-api/courseInstance/${id}`,
          {
            headers: {
              Authorization: token ? `Bearer ${token}` : "",
            },
          }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "Failed to fetch data");
        setData(json.instance);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading) return <p className="p-6 text-center text-2xl">Loading...</p>;
  if (error)
    return (
      <p className="p-6 text-center text-red-700 text-xl font-semibold">Error: {error}</p>
    );
  if (!data)
    return <p className="p-6 text-center text-lg font-medium">No data found.</p>;

  return (
    <div className="p-6 space-y-8">
      {/* <button
        onClick={() => router.back()}
        className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 transition"
        aria-label="Go back"
      >
        ← Back
      </button> */}

      {/* Banner Section */}
     <CourseBanner
  courseName={data.course.name}
  batchName={`Batch: ${data.batch.batchname}`}
  teacherName={data.teacher.username}
  semesterLabel={
    data.course.semesterOrYear?.semesterNumber
      ? `Semester ${data.course.semesterOrYear.semesterNumber}`
      : data.course.semesterOrYear?.name || "N/A"
  }
  studentCount={data.studentCount}
  showImage={false} // Set true if you want to show the image
/>


    </div>
  );
}
