"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import CourseBanner from "../../components/banner";
import AnnouncementForm from "./announcementForm";
import { Plus } from "lucide-react";
import { Toaster } from "react-hot-toast";
import AnnouncementsList from "./announcementlist";

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

  // Modal open state
  const [modalOpen, setModalOpen] = useState(false);

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
    <div className="p-6 space-y-8 ">
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
        showImage={false}
      />

      {/* Mini Add Announcement Card */}
      <div className="flex justify-end pr-0">
  <div
    className="w-4xl h-[110px] flex flex-col items-center justify-center bg-amber-50 border-2 border-dashed border-blue-300 rounded-2xl shadow cursor-pointer hover:bg-blue-100 transition"
    onClick={() => setModalOpen(true)}
  >
    {/* <Plus className="mb-1 text-blue-600" size={32} /> */}
    <span className="text-lg font-semibold text-blue-700">Add your announcement</span>
    <span className="text-xs text-blue-500 mt-1">Click to open form</span>
  </div>
</div>


      {/* AnnouncementForm Modal */}
{modalOpen && (

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
        courseInstanceId={String(id)}
        courseName={data.course.name}
        onSuccess={() => setModalOpen(false)}
      />
  //   </div>
  // </div>
)}


        <AnnouncementsList courseInstanceId={String(id)} />
    </div>
  );
}
