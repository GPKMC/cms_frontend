"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

const tabs = [
  { label: "Class", slug: "class" },
  { label: "Workspace", slug: "workspace" },
  { label: "People", slug: "people" },
  { label: "Grades", slug: "grades" },
  { label: "Notifications", slug: "notifications" }
];

export default function CourseNavbar() {
  const params = useParams();
  const pathname = usePathname();

  // Assumes your folder is .../course-instance/[id]/...
 const courseInstanceId = params.courseInstanceId as string;


  // Get the current tab from URL: e.g. /student/dashboard/class/course-instance/123/workspace
  // parts[0]: "", [1]: "student", [2]: "dashboard", [3]: "class", [4]: "course-instance", [5]: "123", [6]: "workspace"
  const parts = pathname.split("/");
  const currentTab = parts[6] ? parts[6].toLowerCase() : "class"; // fallback to "class"

  return (
    <nav className="w-full border-b border-gray-200 px-6 py-3 bg-white shadow-sm">
      <ul className="flex space-x-8">
        {tabs.map(tab => {
          // If "Class", omit extra path
          const path =
            tab.slug === "class"
              ? `/student/dashboard/class/course-instance/${courseInstanceId}`
              : `/student/dashboard/class/course-instance/${courseInstanceId}/${tab.slug}`;

          const isActive =
            currentTab === tab.slug || (!currentTab && tab.slug === "class");

          return (
            <li key={tab.slug}>
              <Link
                href={path}
                className={`text-lg font-medium transition ${
                  isActive
                    ? "text-blue-700 border-b-2 border-blue-700 pb-1"
                    : "text-gray-700 hover:text-blue-600"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
