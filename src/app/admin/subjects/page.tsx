"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  Eye,
  Pencil,
  RefreshCw,
  Plus,
  Search,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

/** ===== Inline Types (kept here so everything compiles in one file) ===== */
type CourseInstance = {
  _id: string;
  batch?: {
    _id: string;
    batchname: string;
  } | null;
  course?: {
    _id: string;
    name: string;
    type: "compulsory" | "elective";
    code?: string; // <- added so you can safely render course code
  } | null;
  teacher?: {
    _id: string;
    username: string;
    email: string;
  } | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};
/** ====================================================================== */

const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";

type SortKey =
  | "batch"
  | "course"
  | "type"
  | "teacher"
  | "isActive"
  | "createdAt"
  | "updatedAt";

type SortState = {
  key: SortKey;
  dir: "asc" | "desc";
};

export default function CourseInstanceList() {
  const router = useRouter();

  // data
  const [instances, setInstances] = useState<CourseInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ui state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  // filters
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | "compulsory" | "elective">("all");
  const [active, setActive] = useState<"all" | "true" | "false">("all");

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // sorting
  const [sort, setSort] = useState<SortState>({ key: "createdAt", dir: "desc" });

  function getAuthHeaders() {
    if (typeof window === "undefined") return { "Content-Type": "application/json" } as const;
    const token = localStorage.getItem("token_admin");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    } as const;
  }

  async function fetchInstances() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/course-api/courseInstance`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to fetch");
      setInstances(Array.isArray(data?.instances) ? data.instances : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInstances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // derived: filtered + sorted
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = instances
      .filter((i) => (type === "all" ? true : i.course?.type === type))
      .filter((i) =>
        active === "all" ? true : String(Boolean(i.isActive)) === (active === "true" ? "true" : "false")
      )
      .filter((i) => {
        if (!needle) return true;
        const hay = [
          i.batch?.batchname,
          i.course?.name,
          i.course?.code,
          i.course?.type,
          i.teacher?.username,
          i.teacher?.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      });

    const sorted = [...base].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      const getVal = (it: CourseInstance) => {
        switch (sort.key) {
          case "batch":
            return it.batch?.batchname || "";
          case "course":
            return `${it.course?.name || ""}`.toLowerCase();
          case "type":
            return it.course?.type || "";
          case "teacher":
            return it.teacher?.username || "";
          case "isActive":
            return it.isActive ? 1 : 0;
          case "createdAt":
            return new Date(it.createdAt || 0).getTime();
          case "updatedAt":
            return new Date(it.updatedAt || 0).getTime();
          default:
            return 0;
        }
      };
      const va = getVal(a);
      const vb = getVal(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });

    return sorted;
  }, [instances, q, type, active, sort]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(Math.max(page, 1), totalPages);
  const paged = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSafe, pageSize]);

  function onHeaderClick(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`${baseUrl}/course-api/courseInstance/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      setInstances((prev) => prev.filter((inst) => inst._id !== id));
      setDeleteId(null);
    } catch (err: any) {
      alert(err?.message || "Failed to delete.");
      setDeleteId(null);
    }
  }

  function resetFilters() {
    setQ("");
    setType("all");
    setActive("all");
    setPage(1);
    setSort({ key: "createdAt", dir: "desc" });
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Course Instances</h1>
          <p className="text-gray-600 text-sm mt-1">Search, filter, sort and manage course offerings.</p>
        </div>
        <div className="flex gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white shadow hover:bg-indigo-700"
            onClick={() => router.push("/admin/subjects/courseInstanceForm")}
          >
            <Plus className="h-4 w-4" /> Add Course Instance
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-gray-700 hover:bg-gray-50"
            onClick={() => fetchInstances()}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search batch, course, teacher..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div>
          <select
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={type}
            onChange={(e) => {
              setType(e.target.value as any);
              setPage(1);
            }}
          >
            <option value="all">All types</option>
            <option value="compulsory">Compulsory</option>
            <option value="elective">Elective</option>
          </select>
        </div>
        <div>
          <select
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={active}
            onChange={(e) => {
              setActive(e.target.value as any);
              setPage(1);
            }}
          >
            <option value="all">All statuses</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </select>
        </div>
        <div className="flex gap-2">
          <select
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
          <AlertTriangle className="h-5 w-5 mt-0.5" />
          <div>
            <p className="font-semibold">Couldn’t load course instances</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-100 text-sm">
            <tr>
              <SortableTh label="Batch" active={sort.key === "batch"} dir={sort.dir} onClick={() => onHeaderClick("batch")} />
              <SortableTh label="Course" active={sort.key === "course"} dir={sort.dir} onClick={() => onHeaderClick("course")} />
              <SortableTh label="Type" active={sort.key === "type"} dir={sort.dir} onClick={() => onHeaderClick("type")} />
              <SortableTh label="Teacher" active={sort.key === "teacher"} dir={sort.dir} onClick={() => onHeaderClick("teacher")} />
              <SortableTh label="Active?" center active={sort.key === "isActive"} dir={sort.dir} onClick={() => onHeaderClick("isActive")} />
              <SortableTh label="Created" active={sort.key === "createdAt"} dir={sort.dir} onClick={() => onHeaderClick("createdAt")} />
              <SortableTh label="Updated" active={sort.key === "updatedAt"} dir={sort.dir} onClick={() => onHeaderClick("updatedAt")} />
              <th className="text-center px-4 py-2 border">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="px-4 py-3 border">
                      <div className="h-3 w-24 rounded bg-gray-200" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading && paged.length === 0 && (
              <tr>
                <td colSpan={8} className="py-16 text-center text-gray-500">
                  No course instances found.
                </td>
              </tr>
            )}

            {!loading &&
              paged.map((instance) => (
                <tr key={instance._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border">{instance.batch?.batchname}</td>
                  <td className="px-4 py-2 border">
                    <div className="font-medium">{instance.course?.name}</div>
                    {instance.course?.code && (
                      <div className="text-xs text-gray-500">{instance.course.code}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 border capitalize">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        instance.course?.type === "compulsory"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {instance.course?.type}
                    </span>
                  </td>
                  <td className="px-4 py-2 border">
                    <div>{instance.teacher?.username}</div>
                    <div className="text-xs text-gray-500">{instance.teacher?.email}</div>
                  </td>
                  <td className="px-4 py-2 border text-center">
                    {instance.isActive ? (
                      <span className="bg-green-200 text-green-900 px-2 py-1 rounded text-xs font-bold">Yes</span>
                    ) : (
                      <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded text-xs font-bold">No</span>
                    )}
                  </td>
                  <td className="px-4 py-2 border">
                    {instance.createdAt ? new Date(instance.createdAt).toLocaleDateString() : ""}
                  </td>
                  <td className="px-4 py-2 border">
                    {instance.updatedAt ? new Date(instance.updatedAt).toLocaleDateString() : ""}
                  </td>
                  <td className="px-4 py-2 border text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        className="inline-flex items-center justify-center rounded bg-blue-500 p-1.5 text-white hover:bg-blue-600"
                        title="View"
                        onClick={() => setViewId(instance._id)}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        className="inline-flex items-center justify-center rounded bg-yellow-500 p-1.5 text-white hover:bg-yellow-600"
                        title="Edit"
                        onClick={() => setEditId(instance._id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="inline-flex items-center justify-center rounded bg-red-500 p-1.5 text-white hover:bg-red-600"
                        title="Delete"
                        onClick={() => setDeleteId(instance._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <div className="text-gray-600">
            Showing <span className="font-medium">{(pageSafe - 1) * pageSize + 1}</span>–
            <span className="font-medium">{Math.min(pageSafe * pageSize, total)}</span> of
            <span className="font-medium"> {total}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded border px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
              disabled={pageSafe <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span className="text-gray-600">
              Page <span className="font-medium">{pageSafe}</span> / {totalPages}
            </span>
            <button
              className="rounded border px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {deleteId && (
        <ConfirmModal
          title="Confirm Delete"
          message="Are you sure you want to delete this course instance?"
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {/* If you use separate modal components, import them above. */}
      {viewId && (
        // @ts-ignore – keep if your local modal types differ
        <CourseInstanceViewModal instanceId={viewId} onClose={() => setViewId(null)} />
      )}

      {editId && (
        // @ts-ignore – keep if your local modal types differ
        <CourseInstanceEditModal
          instanceId={editId}
          onClose={() => setEditId(null)}
          onUpdated={() => {
            setEditId(null);
            fetchInstances();
          }}
        />
      )}
    </div>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  center,
}: {
  label: string;
  active?: boolean;
  dir?: "asc" | "desc";
  onClick?: () => void;
  center?: boolean;
}) {
  return (
    <th className={`px-4 py-2 border ${center ? "text-center" : "text-left"}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 ${center ? "justify-center w-full" : ""} text-gray-700 hover:text-gray-900`}
        title={onClick ? `Sort by ${label}` : undefined}
      >
        <span>{label}</span>
        {active && (dir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
      </button>
    </th>
  );
}

function ConfirmModal({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-lg border px-4 py-2 text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={onConfirm} className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
