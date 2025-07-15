"use client";

import { useEffect, useState } from "react";
import { Batch } from "../types/type.batch";
import { Eye, Pencil, Trash2, Download, Printer } from "lucide-react";
import BatchDetails from "./batchdetails";
import { useRouter } from "next/navigation";
import { saveAs } from "file-saver";
import EditBatchForm from "./editbatch";

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
    const [editingBatch, setEditingBatch] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // NEW: For dynamic faculty code filter
    const [facultyCode, setFacultyCode] = useState<string>("");
    const [facultyOptions, setFacultyOptions] = useState<{ name: string, code: string }[]>([]);

    const router = useRouter();
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
    const url = `${baseUrl}/batch-api/batch`;
    const facultyUrl = `${baseUrl}/faculty-api/facultycode`;
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    useEffect(() => {
        setInputValue("");
        setSearch("");
        setError("");
        // Clear faculty code when filter changes
        setFacultyCode("");
    }, [filterBy]);

    const triggerRefresh = () => {
        setRefreshKey(prev => prev + 1);
    };

    useEffect(() => {
        if (error) {
            setBatches([]);
            setTotalCount(0);
            setLoading(false);
            return;
        }
        fetchBatches(limit, search);
    }, [limit, search, filterBy, facultyCode, error, refreshKey]);

    useEffect(() => {
        if (filterBy === "all" && inputValue.trim() === "" && search) {
            setSearch("");
        }
    }, [inputValue, filterBy, search]);

    // Fetch faculties for programLevel = bachelor/master for code dropdown
    useEffect(() => {
    if (filterBy === "bachelor" || filterBy === "master") {
        const fetchFaculties = async () => {
            try {
                const res = await fetch(`${facultyUrl}?programLevel=${filterBy}`, {
                    method: "GET",
                    headers, // now headers is stable
                });
                const data = await res.json();
                if (Array.isArray(data)) {
                    setFacultyOptions(data.map((fac: any) => ({ name: fac.name, code: fac.code })));
                } else if (data.success && Array.isArray(data.faculties)) {
                    setFacultyOptions(data.faculties.map((fac: any) => ({ name: fac.name, code: fac.code })));
                } else {
                    setFacultyOptions([]);
                }
            } catch {
                setFacultyOptions([]);
            }
        };
        fetchFaculties();
    } else {
        setFacultyOptions([]);
        setFacultyCode("");
    }
}, [filterBy, facultyUrl, token]); // <-- use token instead of headers


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
                case "bachelor":
                    queryParams.append("programLevel", "bachelor");
                    break;
                case "master":
                    queryParams.append("programLevel", "master");
                    break;
                case "completed":
                    queryParams.append("isCompleted", "true");
                    break;
                case "notCompleted":
                    queryParams.append("isCompleted", "false");
                    break;
            }
            // Add faculty code if selected
            if ((filterBy === "bachelor" || filterBy === "master") && facultyCode) {
                queryParams.append("facultyCode", facultyCode);
            }

            if (searchTerm) queryParams.append("search", searchTerm);

            const response = await fetch(`${url}?${queryParams.toString()}`, {
                method: "GET",
                headers,
            });
            const data = await response.json();

            if (data.success) {
                setBatches(data.batches);
                setTotalCount(data.totalCount ?? data.batches.length);
            } else {
                setBatches([]);
                setTotalCount(0);
            }
        } catch (err) {
            setBatches([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    };

    const exportCSV = () => {
        const headers = [
            "Batch",
            "Faculty",
            "Faculty Type",
            "Program Level",
            "Start Year",
            "End Year",
            "Current",
            "Total",
            "Created",
            "Updated",
            "Completed"
        ];

        const rows = batches.map(b => [
            b.batchname,
            `${b.faculty.name} (${b.faculty.code})`,
            b.faculty.type,
            b.faculty.programLevel,
            b.startYear,
            b.endYear ?? "",
            b.currentSemesterOrYear,
            b.faculty.totalSemestersOrYears,
            new Date(b.createdAt).toLocaleDateString(),
            new Date(b.updatedAt).toLocaleDateString(),
            b.isCompleted ? "Yes" : "No"
        ]);

        const csv = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        saveAs(blob, `batches-${filterBy}.csv`);
    };

    const printData = () => {
        const printWindow = window.open("", "", "width=900,height=700");
        const rows = batches.map(b => `
            <tr>
                <td>${b.batchname}</td>
                <td>${b.faculty.name} (${b.faculty.code})</td>
                <td>${b.faculty.type}</td>
                <td>${b.faculty.programLevel}</td>
                <td>${b.startYear}</td>
                <td>${b.endYear ?? ""}</td>
                <td>${b.currentSemesterOrYear}</td>
                <td>${b.faculty.totalSemestersOrYears}</td>
                <td>${new Date(b.createdAt).toLocaleDateString()}</td>
                <td>${new Date(b.updatedAt).toLocaleDateString()}</td>
                <td>${b.isCompleted ? "Yes" : "No"}</td>
            </tr>
        `).join("");

        printWindow?.document.write(`
            <html>
                <head><title>Print Batches</title></head>
                <body>
                    <h1>Batch List - Filter: ${filterBy}</h1>
                    <table border="1" cellpadding="5" cellspacing="0">
                        <thead>
                            <tr>
                                <th>Batch</th>
                                <th>Faculty</th>
                                <th>Faculty Type</th>
                                <th>Program Level</th>
                                <th>Start Year</th>
                                <th>End Year</th>
                                <th>Current</th>
                                <th>Total</th>
                                <th>Created</th>
                                <th>Updated</th>
                                <th>Completed</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </body>
            </html>
        `);
        printWindow?.document.close();
        printWindow?.print();
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
            const res = await fetch(`${url}/${selectedBatch._id}`, { method: "DELETE", headers, });
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
            alert("Something went wrong.");
        }
    };

    const cancelSearch = () => {
        setInputValue("");
        setSearch("");
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
                {/* Filter dropdowns */}
                <div className="flex items-center gap-2">
                    <select
                        value={filterBy}
                        onChange={(e) => setFilterBy(e.target.value)}
                        className="px-3 py-2 border rounded"
                    >
                        <option value="all">All</option>
                        <option value="semester">Semester</option>
                        <option value="year">Yearly</option>
                        <option value="bachelor">Bachelor</option>
                        <option value="master">Master</option>
                        <option value="completed">Completed</option>
                        <option value="notCompleted">Not Completed</option>
                    </select>
                    {/* Faculty code select only if Bachelor/Master */}
                    {(filterBy === "bachelor" || filterBy === "master") && (
                        <select
                            value={facultyCode}
                            onChange={e => setFacultyCode(e.target.value)}
                            className="px-3 py-2 border rounded"
                        >
                            <option value="">All Faculties</option>
                            {facultyOptions.map((fac) => (
                                <option key={fac.code} value={fac.code}>{fac.code} ({fac.name})</option>
                            ))}
                        </select>
                    )}
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
                <div className="flex gap-2">
                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                    >
                        <Download size={16} /> Export CSV
                    </button>
                    <button
                        onClick={printData}
                        className="flex items-center gap-2 bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800"
                    >
                        <Printer size={16} /> Print
                    </button>
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
                                    <th className="text-left px-4 py-2 border">Program Level</th>
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
                                        <td className="px-4 py-2 border">{batch.faculty.programLevel}</td>
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
                                                <Pencil
                                                    className="p-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 cursor-pointer"
                                                    onClick={() => setEditingBatch(batch._id)}
                                                />
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
            {editingBatch && (
                <EditBatchForm id={editingBatch} onClose={() => setEditingBatch(null)} onUpdateSuccess={triggerRefresh} />
            )}

        </div>
    );
};

export default BatchList;
