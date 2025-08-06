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

  // Get the admin token once
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
      console.log("Fetched faculties:", data);
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
      // Refresh list
      fetchFaculties();
    } catch (error) {
      console.error("Error deleting faculty:", error);
    }
  };

  const handleView = (faculty: Faculty) => {
    setSelectedFaculty(faculty);
    setShowModal(true);
  };

  const groupedFaculties = faculties.reduce(
    (acc, f) => {
      acc[f.programLevel].push(f);
      return acc;
    },
    { bachelor: [] as Faculty[], master: [] as Faculty[] }
  );

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FaGraduationCap /> Faculty Management
        </h1>
        <button
          onClick={() => router.push("/admin/faculty/faculty-form")}
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
        >
          <FaPlus /> Add Faculty
        </button>
      </div>

      {(["bachelor", "master"] as const).map((level) => (
        <div key={level} className="mb-8">
          <h2 className="text-xl font-semibold mb-2 capitalize">
            {level} Programs
          </h2>
          <div className="bg-white shadow rounded overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-2">Name</th>
                  <th className="p-2">Code</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Total</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedFaculties[level].map((f) => (
                  <tr key={f._id} className="border-t">
                    <td className="p-2">{f.name}</td>
                    <td className="p-2">{f.code.toUpperCase()}</td>
                    <td className="p-2 capitalize">{f.type}</td>
                    <td className="p-2">{f.totalSemestersOrYears}</td>
                    <td className="p-2 flex gap-2">
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
                {groupedFaculties[level].length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center p-4 text-gray-500">
                      No faculties found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {showModal && selectedFaculty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Faculty Details</h2>
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

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="bg-blue-600 text-white px-4 py-2 rounded"
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
