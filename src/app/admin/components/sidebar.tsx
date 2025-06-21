"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SidebarItems } from "../types/type.sidebar";
import {
  FaUser,
  FaBook,
  FaClipboardList,
  FaChalkboardTeacher,
  FaCalendarAlt,
  FaBullhorn,
  FaFileAlt,
  FaSignOutAlt,
} from "react-icons/fa";
import { BsFillPeopleFill } from "react-icons/bs";
import { MdAssignment } from "react-icons/md";
import { Home } from "lucide-react";

const sidebarItems: SidebarItems = [
  { id: 1, label: "Home", icon: <Home />, page: "/admin" },
  { id: 3, label: "User Management", icon: <FaUser />, page: "/admin/users" },
  { id: 4, label: "Batch Management", icon: <BsFillPeopleFill />, page: "/admin/batch" },
  { id: 5, label: "Course Management", icon: <FaBook />, page: "/admin/courses" },
  { id: 6, label: "Subject Management", icon: <FaClipboardList />, page: "/admin/subjects" },
  { id: 7, label: "Semester Management", icon: <FaChalkboardTeacher />, page: "/admin/semesters" },
  { id: 8, label: "Schedule Management", icon: <FaCalendarAlt />, page: "/admin/schedule" },
  { id: 9, label: "Assignment Monitoring", icon: <MdAssignment />, page: "/admin/assignments" },
  { id: 10, label: "Announcements", icon: <FaBullhorn />, page: "/admin/announcements" },
  { id: 11, label: "Reports & Analytics", icon: <FaFileAlt />, page: "/admin/reports" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("token"); // Clear the token
    router.push("/admin_login"); // Redirect to login
  };

  return (
    <aside className="fixed top-24 h-screen bg-[#F5F5F5] z-50 text-[#2E3094] group transition-all duration-300 w-20 hover:w-64 overflow-hidden overflow-y-auto">
      <ul className="space-y-3 px-2">
        {sidebarItems.map((item) => {
          const isActive = item.page === "/admin"
            ? pathname === "/admin"
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
