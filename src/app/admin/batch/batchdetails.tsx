"use client";

import { Batch } from "../types/type.batch";

type BatchDetailsProps = {
  batch: Batch;
  onClose: () => void;
};

// Helper to format date as "YYYY-MMM-DD" e.g. "2025-Jul-12"
function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).replace(",", "");
}

export default function BatchDetails({ batch, onClose }: BatchDetailsProps) {
  return (
    <div className="fixed inset-0 bg-white/20 backdrop-blur-md flex justify-center items-center z-50">
      <div className="bg-white/90 backdrop-blur-sm p-8 rounded-lg shadow-lg max-w-md w-full border border-gray-200">
        <h2 className="text-2xl font-semibold mb-6 text-gray-900 border-b pb-3">
          Batch Details
        </h2>
        <div className="mb-6 space-y-3 text-gray-800">
          <p><strong>Batch Name:</strong> {batch.batchname}</p>
          <p><strong>Faculty:</strong> {batch.faculty.name} ({batch.faculty.code})</p>
          <p><strong>Start Year:</strong> {batch.startYear}</p>
          <p><strong>End Year:</strong> {batch.endYear ?? "—"}</p>
          <p><strong>Current Semester/Year:</strong> {batch.currentSemesterOrYear}</p>
          <p><strong>Created At:</strong> {formatDate(batch.createdAt)}</p>
          <p><strong>Updated At:</strong> {formatDate(batch.updatedAt)}</p>
          <p><strong>Completed:</strong> {batch.isCompleted ? "Yes" : "No"}</p>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
