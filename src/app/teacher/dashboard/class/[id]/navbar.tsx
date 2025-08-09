"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = ["Class", "workspace", "People", "Grades", "Notifications","Attendance"];

export default function CourseNavbar() {
  const pathname = usePathname();

  const parts = pathname.split("/");

  const classId = parts[4]; // ✅ the real class ID
  const currentTab = parts[5] || "class"; // fallback to "class" if undefined

  return (
    <nav className="w-full border-b border-gray-200 px-6 py-3 bg-white shadow-sm">
      <ul className="flex space-x-8">
        {tabs.map((tab) => {
          const tabSlug = tab.toLowerCase();
          const path =
            tabSlug === "class"
              ? `/teacher/dashboard/class/${classId}`
              : `/teacher/dashboard/class/${classId}/${tabSlug}`;

          const isActive = currentTab === tabSlug || (!currentTab && tabSlug === "class");

          return (
            <li key={tab}>
              <Link
                href={path}
                className={`text-lg font-medium transition ${
                  isActive
                    ? "text-blue-700 border-b-2 border-blue-700 pb-1"
                    : "text-gray-700 hover:text-blue-600"
                }`}
              >
                {tab}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
