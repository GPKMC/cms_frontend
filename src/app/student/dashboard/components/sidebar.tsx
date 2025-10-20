"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FaUser,
  FaClipboardList,
  FaSignOutAlt,
  FaBookOpen,
} from "react-icons/fa";
import { Home } from "lucide-react";

const sidebarTeacherItems = [
  { id: 1, label: "Home", icon: <Home size={20} />, page: "/student/dashboard" },
  { id: 2, label: "My Classes", icon: <FaBookOpen size={20} />, page: "/student/dashboard/class" },
  { id: 3, label: "Assignments", icon: <FaClipboardList size={20} />, page: "/student/dashboard/myAssignment" },
  { id: 7, label: "Profile", icon: <FaUser size={20} />, page: "/student/dashboard/myProfile" },
];

export default function SidebarStudent() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    try {
      localStorage.removeItem("token_student");
      sessionStorage.removeItem("token_student");
    } finally {
      router.push("/");
    }
  };

  const isActive = (page: string) =>
    page === "/student/dashboard"
      ? pathname === "/student/dashboard"
      : pathname.startsWith(page || "");

  return (
    <>
      {/* Desktop / Tablet sidebar (md and up) */}
      <aside className="hidden md:block fixed left-0 top-24 h-screen bg-[#F5F5F5] z-50 text-[#2E3094] group transition-all duration-300 w-20 hover:w-64 overflow-hidden overflow-y-auto">
        <ul className="space-y-3 px-2">
          {sidebarTeacherItems.map((item) => (
            <li key={item.id}>
              <Link
                href={item.page || ""}
                className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                  isActive(item.page)
                    ? "bg-[#2E3094] text-[#F5F5F5]"
                    : "hover:bg-[#e0ec83]"
                }`}
              >
                <div className="text-xl">{item.icon}</div>
                <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {item.label}
                </span>
              </Link>
            </li>
          ))}

          {/* LOGOUT BUTTON */}
          <li>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 p-2 rounded w-full text-left transition-colors hover:bg-red-500 hover:text-white"
            >
              <div className="text-xl">
                <FaSignOutAlt />
              </div>
              <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Logout
              </span>
            </button>
          </li>
        </ul>
      </aside>

      {/* Mobile bottom tab bar (below md) — exact height, no extra gap */}
      <nav
        className="
          md:hidden fixed inset-x-0 bottom-0 z-50
          h-14
          border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70
          shadow-sm
          pb-[env(safe-area-inset-bottom)]
        "
        aria-label="Student bottom navigation"
      >
        <ul className="flex items-stretch justify-between h-full">
          {sidebarTeacherItems.map((item) => {
            const active = isActive(item.page);
            return (
              <li key={item.id} className="flex-1">
                <Link
                  href={item.page || ""}
                  className="h-full w-full flex flex-col items-center justify-center gap-1"
                >
                  <span className={active ? "text-[#2E3094]" : "text-gray-500"}>
                    {item.icon}
                  </span>
                  <span
                    className={`text-[11px] ${
                      active ? "text-[#2E3094] font-medium" : "text-gray-600"
                    }`}
                  >
                    {item.label}
                  </span>
                  <span
                    className={`mt-0.5 h-0.5 w-6 rounded-full ${
                      active ? "bg-[#2E3094]" : "bg-transparent"
                    }`}
                  />
                </Link>
              </li>
            );
          })}

          {/* Logout as a tab */}
          <li className="flex-1">
            <button
              onClick={handleLogout}
              className="h-full w-full flex flex-col items-center justify-center gap-1 text-red-600"
            >
              <FaSignOutAlt size={20} />
              <span className="text-[11px] font-medium">Logout</span>
              <span className="mt-0.5 h-0.5 w-6 rounded-full bg-transparent" />
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
