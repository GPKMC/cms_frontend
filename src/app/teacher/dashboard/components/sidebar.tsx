"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FaUser,
  FaClipboardList,
  FaBullhorn,
  FaSignOutAlt,
  FaBookOpen,
  FaCalendarCheck,
  FaStar,
} from "react-icons/fa";
import { Home, Users } from "lucide-react";

const sidebarTeacherItems = [
  { id: 1, label: "Home", icon: <Home />, page: "/teacher/dashboard" },
  { id: 2, label: "My Classes", icon: <FaBookOpen />, page: "/teacher/dashboard/class" },
  { id: 3, label: "Assignments", icon: <FaClipboardList />, page: "/teacher/dashboard/assignments" },
  // { id: 4, label: "Attendance", icon: <FaCalendarCheck />, page: "/teacher/dashboard/attendance" },
  { id: 5, label: "Exam/practical", icon: <FaStar />, page: "/teacher/dashboard/exam" },
  // { id: 6, label: "Announcements", icon: <FaBullhorn />, page: "/teacher/dashboard/announcements" },
  { id: 7, label: "Profile", icon: <FaUser />, page: "/teacher/dashboard/myProfile" },
];

export default function SidebarTeacher() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/teacher/login");
  };

  return (
    <aside className="fixed top-24 h-screen bg-[#F5F5F5] z-50 text-[#2E3094] group transition-all duration-300 w-20 hover:w-64 overflow-hidden overflow-y-auto">
      <ul className="space-y-3 px-2">
        {sidebarTeacherItems.map((item) => {
          const isActive = item.page === "/teacher/dashboard"
            ? pathname === "/teacher/dashboard"
            : pathname.startsWith(item.page || "");

          return (
            <li key={item.id}>
              <Link
                href={item.page || ""}
                className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                  isActive ? "bg-[#2E3094] text-[#F5F5F5]" : "hover:bg-[#e0ec83]"
                }`}
              >
                <div className="text-xl">{item.icon}</div>
                <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
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
  );
}
