// app/schedule/page.tsx (or any parent)
// "use client" is required because this uses state.
"use client";

import { useState } from "react";
import AvailabilityAdminList from "./availability-list";
import AdminScheduleSolverPage from "./schedule";

type TabsProps = {
  availability: React.ReactNode;
  schedule: React.ReactNode;
  defaultTab?: "availability" | "schedule";
};

export default function TimeTabs({
  availability,
  schedule,
  defaultTab = "availability",
}: TabsProps) {
  const [tab, setTab] = useState<"availability" | "schedule">(defaultTab);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Time &amp; Schedule</h1>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Time and schedule tabs"
        className="inline-flex rounded-lg border bg-white shadow-sm overflow-hidden"
      >
        <button
          role="tab"
          aria-selected={tab === "availability"}
          aria-controls="availability-panel"
          onClick={() => setTab("availability")}
          className={`px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 ${
            tab === "availability"
              ? "bg-blue-600 text-white"
              : "hover:bg-gray-50"
          }`}
        >
          Availability Management
        </button>

        <button
          role="tab"
          aria-selected={tab === "schedule"}
          aria-controls="schedule-panel"
          onClick={() => setTab("schedule")}
          className={`px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 ${
            tab === "schedule" ? "bg-blue-600 text-white" : "hover:bg-gray-50"
          }`}
        >
          Schedule Management
        </button>
      </div>

      {/* Panels */}
      <div className="mt-6">
        {tab === "availability" ? (
          <div id="availability-panel" role="tabpanel">
            <AvailabilityAdminList/>
          </div>
        ) : (
          <div id="schedule-panel" role="tabpanel">
            <AdminScheduleSolverPage />
          </div>
        )}
      </div>
    </div>
  );
}
