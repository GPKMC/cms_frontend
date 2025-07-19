"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BatchPeriodForm from "./form"; // Add modal for adding period
import BatchPeriodViewModal from "./details"; // View modal
import BatchPeriodEditForm from "./editform"; // Edit modal
import { BatchPeriod } from "@/app/admin/types/type.batchPeriod";
import { Eye, Pencil, Trash2 } from "lucide-react";

export default function BatchPeriodsPage() {
  const params = useParams();
  const slug = params.slug;

  const [batchId, setBatchId] = useState<string>("");
  const [facultyId, setFacultyId] = useState<string>("");
  const [periods, setPeriods] = useState<BatchPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add modal state
  const [modalOpen, setModalOpen] = useState(false);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // View modal state
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewData, setViewData] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
 const router = useRouter();
  // Fetch batch info by slug
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`${baseUrl}/batch-api/batch/by-slug/${slug}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || ""}`,
      },
    })
      .then(async (res) => {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (res.ok && data.batch) {
            setBatchId(data.batch._id);
            setFacultyId(data.batch.faculty);
            setError(null);
          } else {
            setError(data.message || "Batch not found");
          }
        } catch {
          console.error("Invalid JSON response:", text);
          setError("Failed to parse batch info");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetch batch info error:", err);
        setError("Failed to fetch batch info");
        setLoading(false);
      });
  }, [slug, baseUrl, token]);

  // Fetch batch periods
  const fetchPeriods = () => {
    if (!batchId) return;
    setLoading(true);
    setError(null);
    fetch(`${baseUrl}/batch-api/batchPeriod/by-batch/${batchId}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || ""}`,
      },
    })
      .then(async (res) => {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (res.ok) {
            setPeriods(data.batchPeriods || []);
            setError(null);
          } else {
            setError(data.message || "Failed to fetch batch periods");
          }
        } catch {
          console.error("Invalid JSON response:", text);
          setError("Failed to parse batch periods");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetch batch periods error:", err);
        setError("Failed to fetch batch periods");
        setLoading(false);
      });
  };

  useEffect(() => {
    if (batchId) fetchPeriods();
  }, [batchId]);

  // Delete modal handlers
  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`${baseUrl}/batch-api/batchPeriod/${deleteId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
      });
      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.message || "Failed to delete period.");
      } else {
        fetchPeriods();
      }
    } catch {
      alert("Failed to delete period.");
    } finally {
      setDeleteModalOpen(false);
      setDeleteId(null);
    }
  };

  // View modal open with data fetch
  const handleView = async (id: string) => {
    setViewModalOpen(true);
    setViewLoading(true);
    setViewError(null);
    setViewData(null);
    try {
      const res = await fetch(`${baseUrl}/batch-api/batchPeriod/${id}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.batchPeriod) {
        setViewData(data.batchPeriod);
      } else {
        setViewError(data.message || "Failed to load details");
      }
    } catch {
      setViewError("Failed to load details");
    } finally {
      setViewLoading(false);
    }
  };

  // Edit modal open with data fetch
  const handleEdit = async (id: string) => {
    setEditModalOpen(true);
    setEditLoading(true);
    setEditError(null);
    setEditData(null);
    try {
      const res = await fetch(`${baseUrl}/batch-api/batchPeriod/${id}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.batchPeriod) {
        setEditData(data.batchPeriod);
      } else {
        setEditError(data.message || "Failed to load edit data");
      }
    } catch {
      setEditError("Failed to load edit data");
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="relative p-4">
         <button
          onClick={() => router.push("/admin/batch")}
          className="mb-4 text-blue-600 hover:underline"
        >
          &larr; Back to Batches
        </button>
      <h1 className="text-2xl font-bold mb-4">
        Batch: <span className="text-indigo-600">{slug || "Loading..."}</span> - Periods List
      </h1>

      <div className="flex justify-end mb-3">
        <button
          onClick={() => setModalOpen(true)}
          className="bg-blue-600 text-white px-5 py-2 rounded-xl font-semibold hover:bg-blue-700"
          disabled={!batchId || !facultyId}
        >
          + Add Period
        </button>
      </div>

      {modalOpen && (
        <BatchPeriodForm
          batchId={batchId}
          facultyId={facultyId}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setModalOpen(false);
            fetchPeriods();
          }}
        />
      )}

      {deleteModalOpen && (
        <DeleteConfirmModal
          open={deleteModalOpen}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setDeleteModalOpen(false);
            setDeleteId(null);
          }}
        />
      )}

      {viewModalOpen && (
        <BatchPeriodViewModal
          open={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          data={viewData}
          loading={viewLoading}
          error={viewError}
        />
      )}

      {editModalOpen && (
        <BatchPeriodEditForm
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          batchId={batchId}
          facultyId={facultyId}
          initialData={editData}
          loading={editLoading}
          error={editError}
          onSuccess={() => {
            setEditModalOpen(false);
            fetchPeriods();
          }}
        />
      )}

      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : periods.length === 0 ? (
        <div>No periods found for this batch.</div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm bg-white border border-gray-200">
            <thead>
              <tr className="bg-gray-100 text-gray-900">
                <th className="px-4 py-2 border">Semester/Year</th>
                <th className="px-4 py-2 border">Period</th>
                <th className="px-4 py-2 border">Start Date</th>
                <th className="px-4 py-2 border">End Date</th>
                <th className="px-4 py-2 border">Status</th>
                <th className="px-4 py-2 border">Courses</th>
                <th className="px-4 py-2 border">Description</th>
                <th className="px-4 py-2 border">Created</th>
                <th className="px-4 py-2 border">Updated</th>
                <th className="px-4 py-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => {
                const semYear = p.semesterOrYear;
                return (
                  <tr key={p._id}>
                    <td className="border px-4 py-2 font-medium">
                      {semYear?.name ||
                        (semYear?.semesterNumber
                          ? `Semester ${semYear.semesterNumber}`
                          : semYear?.yearNumber
                          ? `Year ${semYear.yearNumber}`
                          : "-")}
                    </td>
                    <td className="border px-4 py-2">{p.slug}</td>
                    <td className="border px-4 py-2">
                      {p.startDate ? new Date(p.startDate).toLocaleDateString() : "-"}
                    </td>
                    <td className="border px-4 py-2">
                      {p.endDate ? new Date(p.endDate).toLocaleDateString() : "-"}
                    </td>
                    <td className="border px-4 py-2 capitalize">{p.status.replace("_", " ")}</td>
                    <td className="border px-4 py-2">
                      <ul>
                        {(semYear?.courses || []).map((c) => (
                          <li key={c._id}>
                            {c.code} - {c.name}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="border px-4 py-2">{p.description || "-"}</td>
                    <td className="border px-4 py-2">
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "-"}
                    </td>
                    <td className="border px-4 py-2">
                      {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "-"}
                    </td>
                    <td className="flex border px-4 py-2 text-center space-x-3 justify-center">
                      <Eye
                        className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
                        onClick={() => handleView(p._id)}
                      />
                      <Pencil
                        className="p-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 cursor-pointer"
                        onClick={() => handleEdit(p._id)}
                      />
                      <Trash2
                        className="p-1 bg-red-500 text-white rounded hover:bg-red-600 cursor-pointer"
                        onClick={() => {
                          setDeleteId(p._id);
                          setDeleteModalOpen(true);
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Delete confirmation modal component
function DeleteConfirmModal({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur">
      <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
        <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
        <p className="mb-6">Are you sure you want to delete this period?</p>
        <div className="flex justify-end space-x-4">
          <button onClick={onCancel} className="px-4 py-2 border rounded hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
