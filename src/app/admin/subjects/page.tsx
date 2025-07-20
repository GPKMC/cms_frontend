"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Eye, Pencil } from "lucide-react";
import { CourseInstance } from "../types/type.courseInstance";

const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export default function CourseInstanceList() {
  const [instances, setInstances] = useState<CourseInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function getAuthHeaders() {
    if (typeof window === "undefined") return { "Content-Type": "application/json" };
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  useEffect(() => {
    async function fetchInstances() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${baseUrl}/course-api/courseInstance`, {
          headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch");
        setInstances(data.instances || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchInstances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(id: string) {
    if (!window.confirm("Are you sure you want to delete this course instance?")) return;
    try {
      const res = await fetch(`${baseUrl}/course-api/courseInstance/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setInstances((prev) => prev.filter((inst) => inst._id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete.");
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-6">Course Instances</h1>
      <div className="mb-4 flex gap-4">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          onClick={() => router.push("/admin/subjects/courseInstanceForm")}
        >
          Add Course Instance
        </button>
      </div>
      {loading && <div className="text-gray-500">Loading...</div>}
      {error && <div className="text-red-600">{error}</div>}
      {!loading && !error && (
        <div className="overflow-x-auto border border-gray-300 rounded-lg">
          <table className="min-w-full bg-white shadow rounded-lg overflow-hidden border">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-4 py-2 border">Batch</th>
                <th className="text-left px-4 py-2 border">Course</th>
                <th className="text-left px-4 py-2 border">Type</th>
                <th className="text-left px-4 py-2 border">Teacher</th>
                <th className="text-center px-4 py-2 border">Assignments</th>
                <th className="text-center px-4 py-2 border">Materials</th>
                <th className="text-center px-4 py-2 border">Attendance</th>
                <th className="text-center px-4 py-2 border">Grades</th>
                <th className="text-center px-4 py-2 border">Active?</th>
                <th className="text-left px-4 py-2 border">Created</th>
                <th className="text-left px-4 py-2 border">Updated</th>
                <th className="text-center px-4 py-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {instances.length === 0 && (
                <tr>
                  <td colSpan={12} className="text-center py-8 text-gray-400">
                    No course instances found.
                  </td>
                </tr>
              )}
              {instances.map((instance) => (
                <tr key={instance._id} className="hover:bg-gray-50">
                <td className="px-4 py-2 border">{instance.batch?.batchname}</td>
                  <td className="px-4 py-2 border">{instance.course?.name}</td>
                  <td className="px-4 py-2 border capitalize">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      instance.course?.type === "compulsory"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {instance.course?.type}
                    </span>
                  </td>
                  <td className="px-4 py-2 border">
                    <span>{instance.teacher?.username}</span>
                    <div className="text-xs text-gray-500">{instance.teacher?.email}</div>
                  </td>
                  <td className="px-4 py-2 border text-center">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                      {Array.isArray(instance.assignments) ? instance.assignments.length : 0}
                    </span>
                  </td>
                  <td className="px-4 py-2 border text-center">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                      {Array.isArray(instance.materials) ? instance.materials.length : 0}
                    </span>
                  </td>
                  <td className="px-4 py-2 border text-center">
                    <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">
                      {Array.isArray(instance.attendanceRecords) ? instance.attendanceRecords.length : 0}
                    </span>
                  </td>
                  <td className="px-4 py-2 border text-center">
                    <span className="bg-pink-100 text-pink-700 px-2 py-1 rounded text-xs">
                      {Array.isArray(instance.grades) ? instance.grades.length : 0}
                    </span>
                  </td>
                  <td className="px-4 py-2 border text-center">
                    {instance.isActive ? (
                      <span className="bg-green-200 text-green-900 px-2 py-1 rounded text-xs font-bold">Yes</span>
                    ) : (
                      <span className="bg-gray-200 text-gray-500 px-2 py-1 rounded text-xs font-bold">No</span>
                    )}
                  </td>
                  <td className="px-4 py-2 border">{instance.createdAt ? new Date(instance.createdAt).toLocaleDateString() : ""}</td>
                  <td className="px-4 py-2 border">{instance.updatedAt ? new Date(instance.updatedAt).toLocaleDateString() : ""}</td>
                  <td className="px-4 py-2 border text-center">
                    <div className="flex items-center gap-2 justify-center">
                      <Eye className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer" />
                      <Pencil className="p-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 cursor-pointer" />
                      <Trash2
                        className="p-1 bg-red-500 text-white rounded hover:bg-red-600 cursor-pointer"
                        onClick={() => handleDelete(instance._id)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
