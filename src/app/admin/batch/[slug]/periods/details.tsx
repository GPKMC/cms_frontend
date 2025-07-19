"use client";

import React from "react";
import { X } from "lucide-react";

interface BatchPeriodViewModalProps {
  open: boolean;
  onClose: () => void;
  data: any;
  loading: boolean;
  error: string | null;
}

export default function BatchPeriodViewModal({
  open,
  onClose,
  data,
  loading,
  error,
}: BatchPeriodViewModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur">
      <div className="bg-white p-6 rounded shadow-lg max-w-lg w-full relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-600 hover:text-black text-xl"
          aria-label="Close modal"
        >
          <X />
        </button>
        <h3 className="text-lg font-semibold mb-4">Batch Period Details</h3>
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : !data ? (
          <p>No data found.</p>
        ) : (
          <div className="space-y-2">
            <p>
              <strong>Batch:</strong> {data.batch?.batchname || "-"}
            </p>
            <p>
              <strong>Faculty:</strong> {data.batch?.faculty?.name || "-"}
            </p>
            <p>
              <strong>Semester/Year:</strong> {data.semesterOrYear?.name || "-"}
            </p>
            <p>
              <strong>Period Slug:</strong> {data.slug || "-"}
            </p>
            <p>
              <strong>Start Date:</strong>{" "}
              {data.startDate ? new Date(data.startDate).toLocaleDateString() : "-"}
            </p>
            <p>
              <strong>End Date:</strong>{" "}
              {data.endDate ? new Date(data.endDate).toLocaleDateString() : "-"}
            </p>
            <p>
              <strong>Status:</strong> {data.status.replace("_", " ")}
            </p>
            <p>
              <strong>Description:</strong> {data.description || "-"}
            </p>
            <div>
              <strong>Courses:</strong>
              <ul className="list-disc list-inside">
                {(data.semesterOrYear?.courses || []).map((c: any) => (
                  <li key={c._id}>
                    {c.code} - {c.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
