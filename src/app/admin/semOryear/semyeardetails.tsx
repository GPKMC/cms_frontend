"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { X } from "lucide-react";

type Faculty = {
  code: string;
};

type Batch = {
  batchname: string;
};

type SemesterDetail = {
  _id: string;
  semesterName?: string;  // optional now
  name?: string;          // fallback option
  faculty: Faculty | null;
  batch: Batch | null;
  description?: string;
  courses: string[];
  startDate?: string;
  endDate?: string;
  status: string;
};

const statusColors: Record<string, string> = {
  not_started: "bg-gray-200 text-gray-700 shadow-sm",
  ongoing: "bg-yellow-200 text-yellow-900 shadow-sm",
  completed: "bg-green-200 text-green-900 shadow-sm",
};

interface Props {
  id: string;
  onClose: () => void;
}

export default function SemesterOrYearDetailsModal({ id, onClose }: Props) {
  const [details, setDetails] = useState<SemesterDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const url = `${baseUrl}/sem-api/semesterOrYear`;

  useEffect(() => {
    async function fetchDetails() {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${url}/${id}`);
        if (res.data.success) {
          console.log("Details fetched:", res.data.semester); // Debug log
          setDetails(res.data.semester);
        } else {
          setError("Failed to fetch details");
        }
      } catch {
        setError("Error fetching details");
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [id]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 bg-transparent bg-opacity-30 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full p-8 relative overflow-auto max-h-[80vh] transition-transform duration-300 ease-in-out transform hover:scale-[1.02]">
        {/* Header with batchname, semesterName/name, and close button */}
        <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-3">
          <h2 className="text-xl font-semibold text-gray-900">
           
            {(details?.semesterName || details?.name)
              ? ` ${details.semesterName || details.name}`
              : ""}
          </h2>
          <button
            className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full p-1 transition-colors"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {loading && (
          <p className="text-center text-gray-600 text-lg font-medium">Loading details...</p>
        )}

        {error && (
          <p className="text-center text-red-600 font-semibold text-lg">{error}</p>
        )}

        {details && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6 text-gray-800 text-base leading-relaxed">
            <div>
              <h4 className="font-semibold mb-1 text-gray-700 uppercase tracking-wide">Faculty</h4>
              <p className="text-gray-900">{details.faculty?.code || "-"}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1 text-gray-700 uppercase tracking-wide">Batch</h4>
              <p className="text-gray-900">{details.batch?.batchname || "-"}</p>
            </div>
            <div className="md:col-span-2">
              <h4 className="font-semibold mb-1 text-gray-700 uppercase tracking-wide">Description</h4>
              <p className="text-gray-900 whitespace-pre-line min-h-[60px]">{details.description || "-"}</p>
            </div>
            <div className="md:col-span-2">
              <h4 className="font-semibold mb-1 text-gray-700 uppercase tracking-wide">Courses</h4>
              <p className="text-gray-900">{details.courses.length > 0 ? details.courses.join(", ") : "-"}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1 text-gray-700 uppercase tracking-wide">Start Date</h4>
              <p className="text-gray-900">{formatDate(details.startDate)}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1 text-gray-700 uppercase tracking-wide">End Date</h4>
              <p className="text-gray-900">{formatDate(details.endDate)}</p>
            </div>
            <div className="md:col-span-2">
              <h4 className="font-semibold mb-1 text-gray-700 uppercase tracking-wide">Status</h4>
              <span
                className={`inline-block px-4 py-1 rounded-full text-sm font-semibold tracking-wide uppercase ${
                  statusColors[details.status] || "bg-gray-200 text-gray-700"
                }`}
              >
                {details.status.replace("_", " ")}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
