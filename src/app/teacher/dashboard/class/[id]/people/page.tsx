"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Mail, MoreVertical } from "lucide-react";

interface CourseInstanceDetail {
  _id: string;
  batch: { batchname: string };
  teacher: {
    _id: string;
    username: string;
    email: string;
    role: string;
  };
  studentCount: number;
  students: {
    _id: string;
    username: string;
    email: string;
  }[];
  course: {
    name: string;
    semesterOrYear?: { semesterNumber?: number; name?: string };
  };
}

function getInitials(name: string) {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? parts[0][0].toUpperCase() + parts[1][0].toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export default function CourseInstanceDetailPage() {
  const params = useParams();
  const id = params.id;
  const [data, setData] = useState<CourseInstanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const token =
          localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher");
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/course-api/courseInstance/${id}`, {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "Failed to fetch");

        setData(json.instance);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  if (loading) return <p className="p-6 text-center">Loading...</p>;
  if (error) return <p className="p-6 text-red-600 text-center">Error: {error}</p>;
  if (!data) return <p className="p-6 text-center">No data found.</p>;

  return (
    <div className="p-6 space-y-10">
      {/* Teacher section */}
      <div className="bg-white rounded shadow p-6">
        <h2 className="text-xl font-bold mb-4">Teachers</h2>
        <div className="flex items-center space-x-4">
          <div className="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
            {getInitials(data.teacher.username)}
          </div>
          <p className="font-semibold text-gray-800">{data.teacher.username}</p>
        </div>
      </div>

      {/* Student section */}
      <div className="bg-white rounded shadow p-6">
        <h2 className="text-xl font-bold mb-4">Students ({data.studentCount})</h2>
        <ul className="divide-y divide-gray-200">
          {data.students.map((student) => (
            <li key={student._id} className="flex items-center justify-between py-3">
              <div className="flex items-center space-x-4">
                <div className="h-9 w-9 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold">
                  {getInitials(student.username)}
                </div>
                <div>
                  <p className="font-medium text-gray-800">{student.username}</p>
                  <p className="text-sm text-gray-500">{student.email}</p>
                </div>
              </div>

              {/* Icons */}
              <div className="flex items-center space-x-4 text-black">
                <Mail className="w-5 h-5 hover:text-blue-600 cursor-pointer" title="Message" />
                <MoreVertical className="w-5 h-5 cursor-pointer" title="Options" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
