"use client";
import React, { useEffect, useState } from "react";
import {
  FaGraduationCap,
  FaPlus,
  FaEdit,
  FaTrash,
  FaEye,
} from "react-icons/fa";
import { useRouter } from "next/navigation";
import { Faculty } from "../types/type.faculty";

export default function FacultyManagement() {
  const router = useRouter();
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<"all" | "bachelor" | "master">("all");

  const adminToken =
    typeof window !== "undefined"
      ? localStorage.getItem("token_admin") || ""
      : "";

  useEffect(() => {
    fetchFaculties();
  }, []);

  const fetchFaculties = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/faculty-api/faculties`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const data = await res.json();
      setFaculties(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading faculties:", error);
      setFaculties([]);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this faculty?")) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/faculty-api/faculties/${id}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      fetchFaculties();
    } catch (error) {
      console.error("Error deleting faculty:", error);
    }
  };

  const handleView = (faculty: Faculty) => {
    setSelectedFaculty(faculty);
    setShowModal(true);
  };

  // Filter faculties based on dropdown
  const filteredFaculties =
    filter === "all"
      ? faculties
      : faculties.filter((f) => f.programLevel === filter);

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FaGraduationCap /> Program Management
        </h1>
        <button
          onClick={() => router.push("/admin/faculty/faculty-form")}
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 transition"
        >
          <FaPlus /> Add Program
        </button>
      </div>

      {/* Filter */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <label className="mr-2 font-medium text-gray-700">Filter:</label>
          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as "all" | "bachelor" | "master")
            }
            className="border border-gray-300 rounded px-2 py-1"
          >
            <option value="all">All Programs</option>
            <option value="bachelor">Bachelor Programs</option>
            <option value="master">Master Programs</option>
          </select>
        </div>
        <div className="text-sm text-gray-600">
          Showing {filteredFaculties.length} of {faculties.length} programs
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow rounded overflow-x-auto">
        <table className="w-full text-sm border border-gray-300">
          <thead>
            <tr className="bg-gray-100 text-left border-b border-gray-300">
              <th className="p-3 border-r border-gray-300">Name</th>
              <th className="p-3 border-r border-gray-300">Code</th>
              <th className="p-3 border-r border-gray-300">Type</th>
              <th className="p-3 border-r border-gray-300">Level</th>
              <th className="p-3 border-r border-gray-300">Total</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredFaculties.map((f, i) => (
              <tr
                key={f._id}
                className={`${
                  i % 2 === 0 ? "bg-white" : "bg-gray-50"
                } hover:bg-blue-50 transition`}
              >
                <td className="p-3 border-t border-r border-gray-300">
                  {f.name}
                </td>
                <td className="p-3 border-t border-r border-gray-300">
                  {f.code.toUpperCase()}
                </td>
                <td className="p-3 border-t border-r border-gray-300 capitalize">
                  {f.type}
                </td>
                <td className="p-3 border-t border-r border-gray-300 capitalize">
                  {f.programLevel}
                </td>
                <td className="p-3 border-t border-r border-gray-300">
                  {f.totalSemestersOrYears}
                </td>
                <td className="p-3 border-t border-gray-300 flex gap-3">
                  <button
                    onClick={() =>
                      router.push(`/admin/faculty/faculty-edit/${f._id}`)
                    }
                    className="text-yellow-500 hover:text-yellow-600"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => handleDelete(f._id!)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <FaTrash />
                  </button>
                  <button
                    onClick={() => handleView(f)}
                    className="text-blue-500 hover:text-blue-600"
                  >
                    <FaEye />
                  </button>
                </td>
              </tr>
            ))}
            {filteredFaculties.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="text-center p-6 text-gray-500 border-t border-gray-300"
                >
                  No programs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && selectedFaculty && (
        <div className="fixed inset-0 bg-transparent backdrop-blur-sm bg-opacity-30 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md border border-gray-200">
            <h2 className="text-xl font-bold mb-4">Program Details</h2>
            <div className="space-y-2 text-gray-700">
              <p>
                <strong>Name:</strong> {selectedFaculty.name}
              </p>
              <p>
                <strong>Code:</strong> {selectedFaculty.code.toUpperCase()}
              </p>
              <p>
                <strong>Type:</strong> {selectedFaculty.type}
              </p>
              <p>
                <strong>Level:</strong> {selectedFaculty.programLevel}
              </p>
              <p>
                <strong>Total:</strong>{" "}
                {selectedFaculty.totalSemestersOrYears}
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
