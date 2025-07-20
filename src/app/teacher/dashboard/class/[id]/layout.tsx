
import React from "react";
import CourseNavbar from "./navbar";
export default function ClassLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full">
      {/* Top Navbar */}
     <CourseNavbar />

      {/* Main Layout with Right Sidebar */}
      <div className="flex relative">
        {/* Left Main Content */}
        <main className="flex-1 p-10">{children}</main>

      </div>
    </div>
  );
}
