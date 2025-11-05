"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const tabs = [
  { label: "Overview", slug: "overview" },
  { label: "Study Material", slug: "materials" },
  { label: "Assignment", slug: "assignment" },
  { label: "People", slug: "people" },
  { label: "Grades", slug: "grades" },
  { label: "Notifications", slug: "notifications" },
  { label: "Attendance", slug: "attendance" },
];

// Mobile priority tabs (shown directly on mobile)
const mobilePriorityTabs = ["overview", "materials", "assignment", "people", "grades"];

export default function CourseNavbar() {
  // params might be typed as possibly null in your setup
  const params = useParams() as { courseInstanceId?: string | string[] } | null;

  // pathname can be string | null -> normalize it
  const rawPathname = usePathname();
  const pathname = rawPathname ?? "";

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Safely extract courseInstanceId (handles string | string[] | undefined)
  const courseInstanceIdParam = params?.courseInstanceId;
  const courseInstanceId = Array.isArray(courseInstanceIdParam)
    ? courseInstanceIdParam[0]
    : courseInstanceIdParam || "";

  // Get the current tab from URL:
  // e.g. /student/dashboard/class/course-instance/123/workspace
  // parts[0]: "", [1]: "student", [2]: "dashboard", [3]: "class",
  // [4]: "course-instance", [5]: "123", [6]: "workspace"
  const parts = pathname.split("/");
  const currentTab = parts[6]?.toLowerCase?.() || "overview";

  const priorityTabs = tabs.filter((tab) => mobilePriorityTabs.includes(tab.slug));
  const remainingTabs = tabs.filter((tab) => !mobilePriorityTabs.includes(tab.slug));

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <nav className="w-full border-b border-gray-200 bg-white shadow-sm relative">
      {/* Desktop Navigation */}
      <div className="hidden md:block px-6 py-3">
        <ul className="flex space-x-8">
          {tabs.map((tab) => {
            const path =
              tab.slug === "overview"
                ? `/student/dashboard/class/course-instance/${courseInstanceId}`
                : `/student/dashboard/class/course-instance/${courseInstanceId}/${tab.slug}`;

            const isActive =
              currentTab === tab.slug || (!currentTab && tab.slug === "overview");

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
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Priority tabs shown directly */}
          <div className="flex space-x-4 overflow-x-auto flex-1">
            {priorityTabs.map((tab) => {
              const path =
                tab.slug === "overview"
                  ? `/student/dashboard/class/course-instance/${courseInstanceId}`
                  : `/student/dashboard/class/course-instance/${courseInstanceId}/${tab.slug}`;

              const isActive =
                currentTab === tab.slug || (!currentTab && tab.slug === "overview");

              return (
                <Link
                  key={tab.slug}
                  href={path}
                  className={`text-sm font-medium whitespace-nowrap px-3 py-2 rounded-lg transition-all duration-200 ${
                    isActive
                      ? "text-blue-700 bg-blue-50 border border-blue-200"
                      : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                  }`}
                  onClick={closeMobileMenu}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          {/* Hamburger Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="ml-4 p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors duration-200 flex-shrink-0"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5 text-gray-700" />
            ) : (
              <Menu className="h-5 w-5 text-gray-700" />
            )}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-50 animate-in slide-in-from-top duration-200">
            <div className="px-4 py-3 space-y-1">
              {remainingTabs.map((tab) => {
                const path = `/student/dashboard/class/course-instance/${courseInstanceId}/${tab.slug}`;
                const isActive = currentTab === tab.slug;

                return (
                  <Link
                    key={tab.slug}
                    href={path}
                    className={`block px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 ${
                      isActive
                        ? "text-blue-700 bg-blue-50 border border-blue-200"
                        : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                    }`}
                    onClick={closeMobileMenu}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={closeMobileMenu}
        />
      )}
    </nav>
  );
}
