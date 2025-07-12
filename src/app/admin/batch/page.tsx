"use client";

import { useEffect, useState } from "react";
import { Batch } from "../types/type.batch";
import { Eye, Pencil, Trash2 } from "lucide-react";
import BatchDetails from "./batchdetails";
import { useRouter } from "next/navigation";

const MIN_LIMIT = 20;

const BatchList = () => {
    const [batches, setBatches] = useState<Batch[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [limit, setLimit] = useState<number>(MIN_LIMIT);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [inputValue, setInputValue] = useState<string>("");
    const [search, setSearch] = useState<string>("");
    const [filterBy, setFilterBy] = useState<string>("all");
    const [error, setError] = useState<string>("");

     const router = useRouter();
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
    const url = `${baseUrl}/batch-api/batch`;

    // Reset input, search, and error on filter change
    useEffect(() => {
        setInputValue("");
        setSearch("");
        setError("");
    }, [filterBy]);

    // If error exists, clear batches and totalCount and stop loading
    useEffect(() => {
        if (error) {
            setBatches([]);
            setTotalCount(0);
            setLoading(false);
            return;
        }
        fetchBatches(limit, search);
    }, [limit, search, filterBy, error]);

    // Auto-reset search when clearing input in 'all' filter mode
    useEffect(() => {
        if (filterBy === "all" && inputValue.trim() === "" && search) {
            setSearch("");
        }
    }, [inputValue, filterBy, search]);

    const fetchBatches = async (fetchLimit: number, searchTerm = "") => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            if (fetchLimit) queryParams.append("limit", fetchLimit.toString());

            switch (filterBy) {
                case "semester":
                    queryParams.append("facultyType", "semester");
                    break;
                case "year":
                    queryParams.append("facultyType", "yearly");
                    break;
                case "completed":
                    queryParams.append("isCompleted", "true");
                    break;
                case "notCompleted":
                    queryParams.append("isCompleted", "false");
                    break;
            }

            if (searchTerm) queryParams.append("search", searchTerm);

            const response = await fetch(`${url}?${queryParams.toString()}`);
            const data = await response.json();

            if (data.success) {
                setBatches(data.batches);
                setTotalCount(data.totalCount ?? data.batches.length);
            } else {
                console.error("Error:", data.message);
                setBatches([]);
                setTotalCount(0);
            }
        } catch (err) {
            console.error("Fetch error:", err);
            setBatches([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    };

    const handleView = (batch: Batch) => {
        setSelectedBatch(batch);
        setIsDetailsOpen(true);
    };

    const closeDetails = () => {
        setIsDetailsOpen(false);
        setSelectedBatch(null);
    };

    const confirmDelete = (batch: Batch) => {
        setSelectedBatch(batch);
        setIsModalOpen(true);
    };

    const handleDelete = async () => {
        if (!selectedBatch) return;
        try {
            const res = await fetch(`${url}/${selectedBatch._id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                setBatches((prev) => prev.filter((b) => b._id !== selectedBatch._id));
                setTotalCount((count) => count - 1);
                setIsModalOpen(false);
                setSelectedBatch(null);
            } else {
                alert("Failed to delete: " + data.message);
            }
        } catch (err) {
            console.error("Delete error:", err);
            alert("Something went wrong.");
        }
    };

    const cancelSearch = () => {
        setInputValue("");
        setSearch(""); // triggers refetch
        setError("");
    };

    const onSearchClick = () => {
        setSearch(inputValue.trim());
    };

    const showMin = () => setLimit(MIN_LIMIT);
    const decreaseLimit = () => {
        if (limit === 0) return;
        const newLimit = Math.max(MIN_LIMIT, limit - 10);
        if (newLimit !== limit) setLimit(newLimit);
    };
    const increaseLimit = () => {
        if (limit === 0) return;
        const newLimit = Math.min(totalCount, limit + 10);
        if (newLimit !== limit) setLimit(newLimit);
    };
    const showFixedLimit = (fixedLimit: number) => setLimit(fixedLimit);
    const showAll = () => setLimit(0);

    const inputPlaceholder =
        filterBy === "completed" || filterBy === "notCompleted"
            ? "Search within completed batches"
            : filterBy === "semester" || filterBy === "year"
                ? "Search by faculty-based batches"
                : "Search all batches";

    return (
        <div className="p-4 relative">
            <h1 className="text-2xl font-semibold mb-4">Batch List</h1>

            {/* Filter + Search Controls */}
            <div className="flex flex-row justify-between gap-2 mb-4 w-full">
                {/* Filter dropdown */}
                <div className="flex items-center gap-2">
                    <select
                        value={filterBy}
                        onChange={(e) => setFilterBy(e.target.value)}
                        className="px-3 py-2 border rounded"
                    >
                        <option value="all">All</option>
                        <option value="semester">Semester</option>
                        <option value="year">Yearly</option>
                        <option value="completed">Completed</option>
                        <option value="notCompleted">Not Completed</option>
                    </select>

                    {/* Search Input + Buttons */}
                    <div className="relative flex-grow flex items-center max-w-md w-full gap-2">
                        <input
                            type="text"
                            placeholder={inputPlaceholder}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            className={`px-4 py-2 border rounded w-full ${error ? "border-red-500" : ""}`}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") onSearchClick();
                            }}
                        />

                        <button
                            onClick={onSearchClick}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            type="button"
                        >
                            Search
                        </button>
                        {inputValue && (
                            <button
                                onClick={cancelSearch}
                                className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                                aria-label="Clear"
                                type="button"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </div>
                <div>
                    <button
    
                          onClick={() => router.push("/admin/batch/batchform")}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        type="button"
                    >
                        Add batch
                    </button>
                </div>
            </div>

            {loading ? (
                <p className="text-gray-600">Loading...</p>
            ) : batches.length === 0 ? (
                <p className="text-gray-600">No batches found.</p>
            ) : (
                <>
                    {/* Table */}
                    <div className="overflow-x-auto border border-gray-300 rounded-lg">
                        <table className="min-w-full bg-white shadow-sm rounded-lg overflow-hidden border border-gray-300">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="text-left px-4 py-2 border">S.N.</th>
                                    <th className="text-left px-4 py-2 border">Batch</th>
                                    <th className="text-left px-4 py-2 border">Faculty</th>
                                    <th className="text-left px-4 py-2 border">Faculty Type</th>
                                    <th className="text-left px-4 py-2 border">Start Year</th>
                                    <th className="text-left px-4 py-2 border">End Year</th>
                                    <th className="text-left px-4 py-2 border">Current Sem/Year</th>
                                    <th className="text-left px-4 py-1 border">Total Sem/Year</th>
                                    <th className="text-left px-4 py-2 border">Created</th>
                                    <th className="text-left px-4 py-2 border">Updated</th>
                                    <th className="text-left px-4 py-2 border">Completed</th>
                                    <th className="text-left px-4 py-2 border">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {batches.map((batch, index) => (
                                    <tr key={batch._id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 border">{index + 1}</td>
                                        <td className="px-4 py-2 border">{batch.batchname}</td>
                                        <td className="px-4 py-2 border">
                                            {batch.faculty.name} ({batch.faculty.code})
                                        </td>
                                        <td className="px-4 py-2 border">{batch.faculty.type}</td>
                                        <td className="px-4 py-2 border">{batch.startYear}</td>
                                        <td className="px-4 py-2 border">{batch.endYear || "—"}</td>
                                        <td className="px-4 py-2 border">
                                            {batch.faculty.type === "semester"
                                                ? `${batch.currentSemesterOrYear} Sem`
                                                : `${batch.currentSemesterOrYear} Year`}
                                        </td>
                                        <td className="px-4 py-2 border">
                                            {batch.faculty.totalSemestersOrYears}{" "}
                                            {batch.faculty.type === "semester" ? "Sem" : "Year"}
                                        </td>
                                        <td className="px-4 py-1 border">{new Date(batch.createdAt).toLocaleDateString()}</td>
                                        <td className="px-4 py-2 border">{new Date(batch.updatedAt).toLocaleDateString()}</td>
                                        <td className="px-4 py-2 border">{batch.isCompleted ? "Yes" : "No"}</td>
                                        <td className="px-4 py-5 border">
                                               <div className="flex items-center gap-2">
                                         <Eye
                                                className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
                                                onClick={() => handleView(batch)}
                                   />
                                            <Pencil className="p-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 cursor-pointer" />
                                            <Trash2
                                                className="p-1 bg-red-500 text-white rounded hover:bg-red-600 cursor-pointer"
                                                onClick={() => confirmDelete(batch)}
                                            />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="mt-4 flex justify-end flex-wrap gap-2 items-center">
                        <div className="mr-4 font-semibold whitespace-nowrap">
                            Showing {limit === 0 ? totalCount : Math.min(limit, totalCount)} / {totalCount} batches
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
                    </div>
                </>
            )}

            {isModalOpen && selectedBatch && (
                <div className="fixed inset-0 bg-white/10 backdrop-blur-sm flex justify-center items-center z-50">
                    <div className="bg-white/70 backdrop-blur-md p-6 rounded-lg shadow-xl w-full max-w-md border border-white/30">
                        <h2 className="text-xl font-bold mb-4">Confirm Deletion</h2>
                        <p className="mb-4">
                            Are you sure you want to delete batch <strong>{selectedBatch.batchname}</strong>?
                        </p>
                        <div className="flex justify-end gap-4">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isDetailsOpen && selectedBatch && <BatchDetails batch={selectedBatch} onClose={closeDetails} />}
        </div>
    );
};

export default BatchList;
