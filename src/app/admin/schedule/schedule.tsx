"use client";

import React, { useEffect, useState } from "react";
import ScheduleBuilderPage from "./schedulingform";

interface ScheduleEvent {
  _id: string;
  type: string;
  startDate: string;
  endDate: string;
  startMinutes: number;
  endMinutes: number;
  teacher?: { name: string };
  batch?: { batchname: string };
  notes?: string;
  isCancelled?: boolean;
}

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const Api = process.env.NEXT_PUBLIC_BACKEND_URL || "";

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token_admin") || "";
      const res = await fetch(`${Api}/schedule/schedule-events`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.ok) {
        setSchedules(data.events);
      } else {
        console.error(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Schedules</h1>

        {/* Schedule builder */}
        <div className="mb-8">
          <ScheduleBuilderPage />
        </div>

        {/* Schedule list */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Scheduled Events</h2>

          {loading ? (
            <p>Loading schedules...</p>
          ) : schedules.length === 0 ? (
            <p>No schedules found.</p>
          ) : (
            <table className="w-full border border-gray-300 rounded">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border">Type</th>
                  <th className="p-2 border">Start Date</th>
                  <th className="p-2 border">End Date</th>
                  <th className="p-2 border">Time</th>
                  <th className="p-2 border">Teacher</th>
                  <th className="p-2 border">Batch</th>
                  <th className="p-2 border">Notes</th>
                  <th className="p-2 border">Cancelled</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s._id} className="text-center border-b">
                    <td className="p-2 border">{s.type}</td>
                    <td className="p-2 border">{new Date(s.startDate).toLocaleDateString()}</td>
                    <td className="p-2 border">{new Date(s.endDate).toLocaleDateString()}</td>
                    <td className="p-2 border">
                      {formatTime(s.startMinutes)} - {formatTime(s.endMinutes)}
                    </td>
                    <td className="p-2 border">{s.teacher?.name || "-"}</td>
                    <td className="p-2 border">{s.batch?.batchname || "-"}</td>
                    <td className="p-2 border">{s.notes || "-"}</td>
                    <td className="p-2 border">{s.isCancelled ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
