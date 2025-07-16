"use client";

import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Eye, Pencil, Trash2 } from "lucide-react";
import SemesterOrYearDetailsModal from "./semyeardetails";
import { useRouter } from "next/navigation";
import SemesterOrYearEditForm from "./editsemoryear";

type Semester = {
    _id: string;
    semesterName: string;
    faculty: string;
    facultyName?: string;
    batch: string;
    batchStartYear?: number | null;
    startDate?: string;
    endDate?: string;
    courses: string[];
    status: string;
};

type Faculty = {
    _id: string;
    code: string;
};

type Batch = {
    _id: string;
    batchname: string;
};

type Toast = {
    id: string;
    message: string;
    type: "success" | "error";
};

const statusColors: Record<string, string> = {
    not_started: "bg-gray-200 text-gray-700",
    ongoing: "bg-yellow-200 text-yellow-800",
    completed: "bg-green-200 text-green-800",
};

const MIN_LIMIT = 10;

export default function SemesterOrYearList() {
    const [semesters, setSemesters] = useState<Semester[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [search, setSearch] = useState("");
    const [facultyId, setFacultyId] = useState<string>("");
    const [facultyList, setFacultyList] = useState<Faculty[]>([]);
    const [batchId, setBatchId] = useState<string>("");
    const [batchList, setBatchList] = useState<Batch[]>([]);
    const [editId, setEditId] = useState<string | null>(null);
    // Pagination
    const [limit, setLimit] = useState<number>(MIN_LIMIT);
    const [page, setPage] = useState<number>(1);
    const [totalCount, setTotalCount] = useState(0);

    // Delete modal states
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const [detailsId, setDetailsId] = useState<string | null>(null);
    // inside SemesterOrYearList component state:

    // Toasts state
    const [toasts, setToasts] = useState<Toast[]>([]);

    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
    const url = `${baseUrl}/sem-api/semesterOrYear`;
    const facultyUrl = `${baseUrl}/faculty-api/facultycode`;
    const batchUrl = `${baseUrl}/batch-api/batchcode`;

    const router = useRouter();

    // Toast helper
    const addToast = useCallback((message: string, type: "success" | "error") => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 10000); // 10 seconds
    }, []);

    // Fetch faculties on mount
    useEffect(() => {
        axios
            .get(facultyUrl)
            .then((res) => {
                const faculties =
                    Array.isArray(res.data) ? res.data : res.data.faculties || [];
                setFacultyList(faculties.map((f: any) => ({ _id: f._id, code: f.code })));
            })
            .catch(() => setFacultyList([]));
    }, []);

    // Fetch batches on faculty change
    useEffect(() => {
        if (!facultyId) {
            setBatchList([]);
            setBatchId("");
            return;
        }
        axios
            .get(batchUrl, { params: { faculty: facultyId } })
            .then((res) => {
                const batches = Array.isArray(res.data) ? res.data : res.data.batches || [];
                setBatchList(batches);
                setBatchId("");
            })
            .catch(() => {
                setBatchList([]);
                setBatchId("");
            });
    }, [facultyId]);

    // Fetch semesters when filters/pagination change
    useEffect(() => {
        fetchSemesters();
    }, [search, facultyId, batchId, limit, page]);

    function fetchSemesters() {
        setLoading(true);
        setError(null);

        const params: any = {
            limit: limit === 0 ? 0 : limit,
            search: search || undefined,
            faculty: facultyId || undefined,
            batch: batchId || undefined,
            page,
        };

        axios
            .get(url, { params })
            .then((res) => {
                if (res.data.success && Array.isArray(res.data.semesters)) {
                    setSemesters(res.data.semesters);
                    setTotalCount(res.data.totalCount || 0);
                    setError(null);
                } else {
                    setError("Failed to fetch semesters");
                    addToast("Failed to fetch semesters", "error");
                    setSemesters([]);
                    setTotalCount(0);
                }
            })
            .catch(() => {
                setError("Error fetching semesters");
                addToast("Error fetching semesters", "error");
                setSemesters([]);
                setTotalCount(0);
            })
            .finally(() => setLoading(false));
    }

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return "-";
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "2-digit",
        });
    };

    // Pagination helpers
    const totalPages = limit === 0 ? 1 : Math.ceil(totalCount / limit);
    const goToPage = (pageNum: number) => {
        if (pageNum < 1 || pageNum > totalPages) return;
        setPage(pageNum);
    };
    const showMin = () => {
        setLimit(MIN_LIMIT);
        setPage(1);
    };
    const decreaseLimit = () => {
        setLimit((prev) => Math.max(MIN_LIMIT, prev - 10));
        setPage(1);
    };
    const increaseLimit = () => {
        setLimit((prev) => (prev + 10 > totalCount ? totalCount : prev + 10));
        setPage(1);
    };
    const showFixedLimit = (val: number) => {
        setLimit(val);
        setPage(1);
    };
    const showAll = () => {
        setLimit(0);
        setPage(1);
    };

    // Delete modal handlers
    const openDeleteModal = (id: string) => {
        setDeleteId(id);
        setDeleteError(null);
    };
    const closeDeleteModal = () => {
        setDeleteId(null);
        setDeleteError(null);
    };
    const confirmDelete = async () => {
        if (!deleteId) return;
        setDeleting(true);
        setDeleteError(null);
        try {
            const res = await axios.delete(`${url}/${deleteId}`);
            if (res.data.success) {
                setSemesters(semesters.filter((s) => s._id !== deleteId));
                addToast("Semester deleted successfully", "success");
                closeDeleteModal();
            } else {
                setDeleteError(res.data.message || "Failed to delete");
                addToast(res.data.message || "Failed to delete", "error");
            }
        } catch (error: any) {
            const msg = error?.response?.data?.message || "Error deleting semester";
            setDeleteError(msg);
            addToast(msg, "error");
        } finally {
            setDeleting(false);
        }
    };

    const openDetailsModal = (id: string) => setDetailsId(id);
    const closeDetailsModal = () => setDetailsId(null);



    // Open/Close handlers
    const openEditModal = (id: string) => {console.log("Opening edit modal for:", id);
  setEditId(id);
};
    const closeEditModal = () => setEditId(null);

    // Optional: callback after successful update to refresh list
    const handleEditSuccess = () => {
        closeEditModal();
        fetchSemesters(); // re-fetch to show updated data
        addToast("Semester updated successfully", "success");
    };

    return (
        <div className="max-w-7xl mx-auto p-6 bg-white rounded shadow relative">
            <h2 className="text-2xl font-bold mb-6 text-center">Semester / Year List</h2>

            {/* Toast Container */}
            <div className="fixed top-4 right-4 flex flex-col gap-2 z-50">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`max-w-xs px-4 py-2 rounded shadow text-white ${toast.type === "success" ? "bg-green-600" : "bg-red-600"
                            }`}
                    >
                        {toast.message}
                    </div>
                ))}
            </div>

            {/* Filters and Add button */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
                    <input
                        type="text"
                        placeholder="Search semester, batch, description..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="border rounded px-3 py-2 min-w-[180px]"
                    />
                    <select
                        value={facultyId}
                        onChange={(e) => setFacultyId(e.target.value)}
                        className="border rounded px-3 py-2 min-w-[140px]"
                    >
                        <option value="">Filter by Faculty</option>
                        {facultyList.map((f) => (
                            <option key={f._id} value={f._id}>
                                {f.code}
                            </option>
                        ))}
                    </select>
                    <select
                        value={batchId}
                        onChange={(e) => setBatchId(e.target.value)}
                        className="border rounded px-3 py-2 min-w-[140px]"
                        disabled={!facultyId || batchList.length === 0}
                    >
                        <option value="">Filter by Batch</option>
                        {batchList.map((b) => (
                            <option key={b._id} value={b._id}>
                                {b.batchname}
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={() => router.push("/admin/semOryear/form")}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                    type="button"
                >
                    Add Semester/Year
                </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-300 divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300">
                                #
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300">
                                Semester/Year
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300">
                                Faculty
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300">
                                Batch
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300">
                                Courses
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300">
                                Start Date
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300">
                                End Date
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-300">
                                Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {semesters.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="text-center p-4 text-gray-600">
                                    No semesters found.
                                </td>
                            </tr>
                        ) : (
                            semesters.map((sem, idx) => (
                                <tr
                                    key={sem._id}
                                    className={
                                        idx % 2 === 0 ? "bg-white hover:bg-gray-200" : "bg-gray-50 hover:bg-gray-200"
                                    }
                                >
                                    <td className="px-4 py-3 whitespace-nowrap border-r border-gray-300">
                                        {(page - 1) * limit + idx + 1}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap border-r border-gray-300">{sem.semesterName}</td>
                                    <td
                                        className="px-4 py-3 whitespace-nowrap border-r border-gray-300"
                                        title={sem.facultyName}
                                    >
                                        {sem.faculty}
                                    </td>
                                    <td
                                        className="px-4 py-3 whitespace-nowrap border-r border-gray-300"
                                        title={sem.batchStartYear ? `Start Year: ${sem.batchStartYear}` : undefined}
                                    >
                                        {sem.batch}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap border-r border-gray-300">
                                        {sem.courses.join(", ")}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap border-r border-gray-300">
                                        {formatDate(sem.startDate)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap border-r border-gray-300">
                                        {formatDate(sem.endDate)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap border-r border-gray-300">
                                        <span
                                            className={`inline-block px-2 py-1 rounded text-xs font-semibold ${statusColors[sem.status] || "bg-gray-200 text-gray-700"
                                                }`}
                                        >
                                            {sem.status.replace("_", " ").toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap flex gap-3">
                                        <button
                                            aria-label="View"
                                            className="text-blue-600 hover:text-blue-800"
                                            onClick={() => openDetailsModal(sem._id)}
                                        >
                                            <Eye size={18} />
                                        </button>
                                        <button
                                            aria-label="Edit"
                                            className="text-green-600 hover:text-green-800"
                                            onClick={() => openEditModal(sem._id)}
                                        >
                                            <Pencil size={18} />
                                        </button>
                                        <button
                                            aria-label="Delete"
                                            className="text-red-600 hover:text-red-800"
                                            onClick={() => openDeleteModal(sem._id)}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalCount > 0 && (
                <div className="mt-4 flex justify-end flex-wrap gap-2 items-center">
                    <div className="mr-4 font-semibold whitespace-nowrap">
                        Showing {limit === 0 ? totalCount : Math.min(limit, totalCount)} / {totalCount} entries
                    </div>
                    <button
                        onClick={showMin}
                        disabled={loading || limit === MIN_LIMIT}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                        Show Min
                    </button>
                    <button
                        onClick={decreaseLimit}
                        disabled={loading || limit === MIN_LIMIT || limit === 0}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                        −10
                    </button>
                    <button
                        onClick={increaseLimit}
                        disabled={loading || (limit !== 0 && limit >= totalCount)}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                        +10
                    </button>
                    <button
                        onClick={() => showFixedLimit(50)}
                        disabled={loading || limit === 50}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                        Show 50
                    </button>
                    <button
                        onClick={() => showFixedLimit(100)}
                        disabled={loading || limit === 100}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                        Show 100
                    </button>
                    <button
                        onClick={showAll}
                        disabled={loading || totalCount <= MIN_LIMIT || limit === 0}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                        Show All
                    </button>

                    {/* Page navigation */}
                    {totalPages > 1 && (
                        <div className="ml-6 flex gap-1 flex-wrap">
                            <button
                                onClick={() => goToPage(page - 1)}
                                disabled={page === 1}
                                className="px-2 py-1 border rounded disabled:opacity-50"
                            >
                                Prev
                            </button>
                            {[...Array(totalPages).keys()].map((_, i) => {
                                const pageNum = i + 1;
                                if (
                                    pageNum === 1 ||
                                    pageNum === totalPages ||
                                    (pageNum >= page - 2 && pageNum <= page + 2)
                                ) {
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => goToPage(pageNum)}
                                            disabled={pageNum === page}
                                            className={`px-2 py-1 border rounded ${pageNum === page ? "bg-blue-600 text-white" : ""
                                                }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                }
                                if (pageNum === page - 3 || pageNum === page + 3) {
                                    return (
                                        <span key={pageNum} className="px-2 py-1">
                                            ...
                                        </span>
                                    );
                                }
                                return null;
                            })}
                            <button
                                onClick={() => goToPage(page + 1)}
                                disabled={page === totalPages}
                                className="px-2 py-1 border rounded disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteId && (
                <div className="fixed inset-0 bg-transparent bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white bg-opacity-80 rounded-lg shadow-lg max-w-sm w-full p-6">
                        <h3 className="text-lg font-semibold mb-4">Confirm Deletion</h3>
                        <p className="mb-6">Are you sure you want to delete this semester/year?</p>
                        {deleteError && <p className="mb-4 text-red-600">{deleteError}</p>}
                        <div className="flex justify-end gap-4">
                            <button
                                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                                onClick={closeDeleteModal}
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                                onClick={confirmDelete}
                                disabled={deleting}
                            >
                                {deleting ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {detailsId && <SemesterOrYearDetailsModal id={detailsId} onClose={closeDetailsModal} />}
             {/* Edit Modal */}
      {editId && (
        <SemesterOrYearEditForm
          id={editId}
          onClose={closeEditModal}
          onUpdateSuccess={handleEditSuccess} // pass if your form supports this
        />
      )}

        </div>
    );
}
