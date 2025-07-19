"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Trash2, Download, Printer } from "lucide-react";
import { Course } from "../types/type.course"; // Adjust path!
// Modal edit
import { saveAs } from "file-saver";
import CourseDetails from "./coursedetails";
import EditCourseForm from "./editCourseform";

const MIN_LIMIT = 20;

const CourseList = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [limit, setLimit] = useState<number>(MIN_LIMIT);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [inputValue, setInputValue] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [error, setError] = useState<string>("");
  const [editingCourse, setEditingCourse] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const router = useRouter();
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const url = `${baseUrl}/course-api/course`;

  // Helper: Auth headers
  const getAuthHeaders = () => {
    if (typeof window === "undefined")
      return { "Content-Type": "application/json" };
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const triggerRefresh = () => setRefreshKey((prev) => prev + 1);

  useEffect(() => {
    setInputValue("");
    setSearch("");
    setError("");
  }, [typeFilter]);

  useEffect(() => {
    if (error) {
      setCourses([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    fetchCourses(limit, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, search, typeFilter, error, refreshKey]);

  const fetchCourses = async (fetchLimit: number, searchTerm = "") => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (fetchLimit) queryParams.append("limit", fetchLimit.toString());
      if (searchTerm) queryParams.append("search", searchTerm);
      if (typeFilter !== "all") queryParams.append("type", typeFilter);

      const response = await fetch(`${url}?${queryParams.toString()}`, {
        method: "GET",
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (Array.isArray(data.courses)) {
        setCourses(data.courses);
        setTotalCount(data.courses.length);
      } else if (data.courses) {
        setCourses(data.courses);
        setTotalCount(data.courses.length);
      } else {
        setCourses([]);
        setTotalCount(0);
      }
    } catch {
      setCourses([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  // const exportCSV = () => {
  //   const headers = [
  //     "Course Name", "Code", "Slug", "Type", "Semester/Year", "Created", "Updated"
  //   ];
  //   const rows = courses.map((c) => [
  //     c.name,
  //     c.code,
  //     c.slug,
  //     c.type,
  //     c.semesterOrYear
  //       ? (c.semesterOrYear.semesterNumber
  //           ? `${c.semesterOrYear.semesterNumber} Sem`
  //           : `${c.semesterOrYear.yearNumber} Year`)
  //       : "",
  //     c.semesterOrYear?.faculty?.code || "",
  //     new Date(c.createdAt).toLocaleDateString(),
  //     new Date(c.updatedAt).toLocaleDateString(),
  //   ]);
  //   const csv = [headers, ...rows].map((e) => e.join(",")).join("\n");
  //   const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  //   saveAs(blob, `courses-${typeFilter}.csv`);
  // };

  const printData = () => {
    const printWindow = window.open("", "", "width=900,height=700");
    const rows = courses
      .map(
        (c) => `
          <tr>
            <td>${c.name}</td>
            <td>${c.code}</td>
            <td>${c.slug}</td>
            <td>${c.type}</td>
           <td>${
            typeof c.semesterOrYear === "string"
              ? c.semesterOrYear
              : c.semesterOrYear
                ? c.semesterOrYear.semesterNumber
                  ? `${c.semesterOrYear.semesterNumber} Sem`
                  : c.semesterOrYear.yearNumber
                    ? `${c.semesterOrYear.yearNumber} Year`
                    : ""
                : ""
          }</td>
            <td>${new Date(c.createdAt).toLocaleDateString()}</td>
            <td>${new Date(c.updatedAt).toLocaleDateString()}</td>
          </tr>
      `
      )
      .join("");

    printWindow?.document.write(`
      <html>
        <head><title>Print Courses</title></head>
        <body>
          <h1>Course List - Filter: ${typeFilter}</h1>
          <table border="1" cellpadding="5" cellspacing="0">
            <thead>
              <tr>
                <th>Course Name</th>
                <th>Code</th>
                <th>Slug</th>
                <th>Type</th>
                <th>Semester/Year</th>
                <th>Created</th>
                <th>Updated</th>
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

  const handleView = (course: Course) => {
    setSelectedCourse(course);
    setIsDetailsOpen(true);
  };

  const closeDetails = () => {
    setIsDetailsOpen(false);
    setSelectedCourse(null);
  };

  const confirmDelete = (course: Course) => {
    setSelectedCourse(course);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedCourse) return;
    try {
      const res = await fetch(`${url}/${selectedCourse._id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success || data.message === "Course deleted successfully") {
        setCourses((prev) => prev.filter((c) => c._id !== selectedCourse._id));
        setTotalCount((count) => count - 1);
        setIsModalOpen(false);
        setSelectedCourse(null);
      } else {
        alert("Failed to delete: " + data.message);
      }
    } catch {
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

  // Pagination helpers
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

  return (
    <div className="p-4 relative">
      <h1 className="text-2xl font-semibold mb-4">Course List</h1>
      {/* Filter + Search Controls */}
      <div className="flex flex-row justify-between gap-2 mb-4 w-full">
        {/* Filter dropdowns */}
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border rounded"
          >
            <option value="all">All</option>
            <option value="compulsory">Compulsory</option>
            <option value="elective">Elective</option>
          </select>
          {/* Search Input + Buttons */}
          <div className="relative flex-grow flex items-center max-w-md w-full gap-2">
            <input
              type="text"
              placeholder="Search course name/code/description"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className={`px-4 py-2 border rounded w-full ${
                error ? "border-red-500" : ""
              }`}
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
          {/* <button
            onClick={exportCSV}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            <Download size={16} /> Export CSV
          </button> */}
          <button
            onClick={printData}
            className="flex items-center gap-2 bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800"
          >
            <Printer size={16} /> Print
          </button>
          <button
            onClick={() => router.push("/admin/course/courseform")}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            type="button"
          >
            Add course
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-600">Loading...</p>
      ) : courses.length === 0 ? (
        <p className="text-gray-600">No courses found.</p>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto border border-gray-300 rounded-lg">
            <table className="min-w-full bg-white shadow-sm rounded-lg overflow-hidden border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left px-4 py-2 border">S.N.</th>
                  <th className="text-left px-4 py-2 border">Name</th>
                  <th className="text-left px-4 py-2 border">Code</th>
                  <th className="text-left px-4 py-2 border">Type</th>
                  <th className="text-left px-4 py-2 border">Semester/Year</th>
                  <th className="text-left px-4 py-2 border">Created</th>
                  <th className="text-left px-4 py-2 border">Updated</th>
                  <th className="text-left px-4 py-2 border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course, index) => (
                  <tr key={course._id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border">{index + 1}</td>
                    <td className="px-4 py-2 border">{course.name}</td>
                    <td className="px-4 py-2 border">{course.code}</td>
                    <td className="px-4 py-2 border">{course.type}</td>
                    <td className="px-4 py-2 border">
                      {typeof course.semesterOrYear === "string"
                        ? course.semesterOrYear
                        : course.semesterOrYear?.semesterNumber
                        ? `${course.semesterOrYear.semesterNumber} Sem`
                        : course.semesterOrYear?.yearNumber
                        ? `${course.semesterOrYear.yearNumber} Year`
                        : ""}
                    </td>

                    <td className="px-4 py-2 border">
                      {new Date(course.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 border">
                      {new Date(course.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 border">
                      <div className="flex items-center gap-2">
                        <Eye
                          className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
                          onClick={() => handleView(course)}
                        />
                        <Pencil
                          className="p-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 cursor-pointer"
                          onClick={() => setEditingCourse(course._id)}
                        />
                        <Trash2
                          className="p-1 bg-red-500 text-white rounded hover:bg-red-600 cursor-pointer"
                          onClick={() => confirmDelete(course)}
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
              Showing {limit === 0 ? totalCount : Math.min(limit, totalCount)} /{" "}
              {totalCount} courses
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

      {isModalOpen && selectedCourse && (
        <div className="fixed inset-0 bg-white/10 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white/70 backdrop-blur-md p-6 rounded-lg shadow-xl w-full max-w-md border border-white/30">
            <h2 className="text-xl font-bold mb-4">Confirm Deletion</h2>
            <p className="mb-4">
              Are you sure you want to delete course{" "}
              <strong>{selectedCourse.name}</strong>?
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

      {isDetailsOpen && selectedCourse && (
        <CourseDetails course={selectedCourse} onClose={closeDetails} />
      )}

      {editingCourse && (
        <EditCourseForm
          id={editingCourse}
          onClose={() => setEditingCourse(null)}
          onUpdateSuccess={triggerRefresh}
        />
      )}
    </div>
  );
};

export default CourseList;
