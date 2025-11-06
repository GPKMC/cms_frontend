"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen,
  FileText,
  Calendar,
  User,
  Filter,
  Grid,
  List,
  Search,
  Eye,
} from "lucide-react";

type Material = {
  _id: string;
  title: string;
  postedBy?: { username?: string; email?: string };
  createdAt?: string;
  updatedAt?: string;
};

type TopicGroup = {
  topic: { _id: string | null; title: string };
  materials: Material[];
};

export default function CourseMaterialsFeed() {
  const params = useParams();
  const courseInstanceId = params?.courseInstanceId as string;
  const router = useRouter();

  const [groups, setGroups] = useState<TopicGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState("all");
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!courseInstanceId) return;
    setLoading(true);
    setError(null);

    fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/student/materials/${courseInstanceId}`,
      {
        headers: {
          Authorization:
            "Bearer " +
            (localStorage.getItem("token_student") ||
              sessionStorage.getItem("token_student") ||
              ""),
        },
      }
    )
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch materials");
        return r.json();
      })
      .then((data) => setGroups(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [courseInstanceId]);

  // Topic filter options
  const topicOptions = [
    { id: "all", title: "All Topics" },
    ...groups
      .filter((g) => g.topic._id !== null)
      .map((g) => ({
        id: g.topic._id as string,
        title: g.topic.title || "Untitled topic",
      })),
    ...(groups.some((g) => g.topic._id === null)
      ? [{ id: "uncategorized", title: "Uncategorized" }]
      : [{ id: "uncategorized", title: "Uncategorized" }]),
  ].filter(
    (opt, idx, arr) => arr.findIndex((o) => o.id === opt.id) === idx // dedupe
  );

  // Filtered groups by topic
  let filteredGroups: TopicGroup[] = [];
  if (selectedTopicId === "all") {
    const uncategorized = groups.find((g) => g.topic._id === null);
    const topicGroups = groups.filter((g) => g.topic._id !== null);
    filteredGroups = [...(uncategorized ? [uncategorized] : []), ...topicGroups];
  } else if (selectedTopicId === "uncategorized") {
    filteredGroups = groups.filter((g) => g.topic._id === null);
  } else {
    filteredGroups = groups.filter((g) => g.topic._id === selectedTopicId);
  }

  // Search filter
  let visibleGroups = filteredGroups
    .map((group) => ({
      ...group,
      materials: group.materials.filter((material) =>
        material.title.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    }))
    .filter((group) => group.materials.length > 0);

  if (!searchTerm) {
    visibleGroups = filteredGroups.filter((g) => g.materials.length > 0);
  }

  const totalMaterials = groups.reduce(
    (sum, group) => sum + group.materials.length,
    0
  );

  if (loading)
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4 text-gray-500">
        <svg
          className="animate-spin mr-2 h-5 w-5 sm:h-6 sm:w-6 text-blue-400"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="text-sm sm:text-base">Loading materials...</span>
      </div>
    );

  if (error)
    return (
      <div className="min-h-[40vh] flex items-center justify-center px-4">
        <div className="flex items-center gap-2 p-4 bg-red-50 rounded-lg text-red-600 text-sm sm:text-base max-w-md">
          <span>❌</span> {error}
        </div>
      </div>
    );

  if (!groups.length)
    return (
      <div className="min-h-[40vh] flex items-center justify-center px-4">
        <div className="py-8 text-center text-gray-500 text-sm sm:text-base">
          No materials found.
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-5 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 sm:p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                Course Materials
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">
                {totalMaterials} materials available
              </p>
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col gap-4">
            {/* Search - full width */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search materials..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 sm:py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center sm:justify-between">
              {/* Topic Filter */}
              <div className="relative flex-1 min-w-0">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  className="w-full pl-10 pr-8 py-2.5 sm:py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer transition-all duration-200 text-sm sm:text-base"
                >
                  {topicOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* View Toggle */}
              <div className="flex items-center justify-center sm:justify-end">
                <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                  <button
                    type="button"
                    onClick={() => setViewMode("card")}
                    className={`p-2 sm:p-2.5 rounded-lg transition-all duration-200 ${
                      viewMode === "card"
                        ? "bg-white shadow-sm text-blue-600"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`p-2 sm:p-2.5 rounded-lg transition-all duration-200 ${
                      viewMode === "list"
                        ? "bg-white shadow-sm text-blue-600"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Materials */}
        <div className="space-y-5 sm:space-y-8">
          {visibleGroups.map((group) => (
            <div key={group.topic._id ?? "uncategorized"} className="group">
              {/* Topic header */}
              {(group.topic._id !== null || selectedTopicId !== "all") && (
                <div className="flex items-center gap-3 mb-3 sm:mb-4">
                  <div className="w-1 h-5 sm:h-7 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full" />
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-xl font-semibold text-gray-900 truncate">
                      {group.topic.title || "Uncategorized"}
                    </h2>
                    <p className="text-[11px] sm:text-xs text-gray-500">
                      {group.materials.length} material
                      {group.materials.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              )}

              {/* Cards/List */}
              <div
                className={`grid gap-3 sm:gap-4 ${
                  viewMode === "card" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
                }`}
              >
                {group.materials.map((material) => (
                  <div
                    key={material._id}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200 p-4 sm:p-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                      {/* Info */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                          <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm sm:text-base text-gray-900 leading-tight mb-2 break-words">
                            {material.title}
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-[11px] sm:text-xs text-gray-500">
                            {material.postedBy?.username && (
                              <span className="flex items-center gap-1 min-w-0">
                                <User className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate max-w-[180px] sm:max-w-xs">
                                  {material.postedBy.username}
                                </span>
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 flex-shrink-0" />
                              {new Date(
                                material.updatedAt ||
                                  material.createdAt ||
                                  ""
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Button */}
                      <div className="flex justify-end sm:justify-start w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => {
                            router.push(
                              `/student/dashboard/class/course-instance/${courseInstanceId}/materials/${material._id}`
                            );
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2.5 sm:px-4 sm:py-2 bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200 w-full sm:w-auto justify-center"
                        >
                          <Eye className="w-4 h-4" />
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Empty after filters/search */}
        {visibleGroups.every((group) => group.materials.length === 0) && (
          <div className="text-center py-10 sm:py-14 px-4">
            <div className="max-w-md mx-auto">
              <div className="p-4 bg-gray-100 rounded-full w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 flex items-center justify-center">
                <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
              </div>
              <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-2">
                No materials found
              </h3>
              <p className="text-sm sm:text-base text-gray-500 leading-relaxed">
                {searchTerm
                  ? `No materials match your search for "${searchTerm}"`
                  : "No materials available for the selected topic."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
