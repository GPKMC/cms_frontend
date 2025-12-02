// app/components/CourseInstanceViewModal.tsx
"use client";

import { useEffect, useState } from "react";

interface CourseInstanceViewModalProps {
  instanceId: string;
  onClose: () => void;
}

type CourseInstanceDetail = {
  _id: string;
  batch: { batchname: string };
  course: {
    name: string;
    code: string;
    type: string;
    semesterOrYear: {
      name: string;
      semesterNumber?: number;
      yearNumber?: number;
      faculty: { name: string; code: string };
    };
  };
  teacher: { name: string; email: string };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  assignments: any[];
  materials: any[];
  attendanceRecords: any[];
  grades: any[];
};

export default function CourseInstanceViewModal({ instanceId, onClose }: CourseInstanceViewModalProps) {
  const [loading, setLoading] = useState(true);
  const [instance, setInstance] = useState<CourseInstanceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";

  useEffect(() => {
    async function fetchInstance() {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("token_admin");
        const res = await fetch(`${baseUrl}/course-api/courseInstance/${instanceId}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch details");
        setInstance(data.instance);
      } catch (err: any) {
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchInstance();
  }, [instanceId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur">
      <div className="bg-white max-w-2xl w-full p-6 rounded shadow-lg max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Course Instance Details</h2>

        {loading && <p>Loading...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {instance && (
          <div className="space-y-3 text-sm">
            <p><strong>Batch:</strong> {instance.batch.batchname}</p>
            <p><strong>Course:</strong> {instance.course.name} ({instance.course.code})</p>
            <p><strong>Type:</strong> {instance.course.type}</p>
            <p>
              <strong>Semester/Year:</strong> {instance.course.semesterOrYear.name}{" "}
              {instance.course.semesterOrYear.semesterNumber
                ? `(${instance.course.semesterOrYear.semesterNumber} Semester)`
                : instance.course.semesterOrYear.yearNumber
                  ? `(${instance.course.semesterOrYear.yearNumber} Year)`
                  : ""}
              {" - "}
              {instance.course.semesterOrYear.faculty.code} ({instance.course.semesterOrYear.faculty.name})
            </p>
            <p><strong>Teacher:</strong> {instance.teacher.name} ({instance.teacher.email})</p>
            <p><strong>Active:</strong> {instance.isActive ? "Yes" : "No"}</p>
            <p><strong>Created At:</strong> {new Date(instance.createdAt).toLocaleString()}</p>
            <p><strong>Updated At:</strong> {new Date(instance.updatedAt).toLocaleString()}</p>

            <p><strong>Assignments:</strong> {instance.assignments?.length ?? 0}</p>
            <p><strong>Materials:</strong> {instance.materials?.length ?? 0}</p>
            <p><strong>Attendance Records:</strong> {instance.attendanceRecords?.length ?? 0}</p>
            <p><strong>Grades:</strong> {instance.grades?.length ?? 0}</p>

          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
