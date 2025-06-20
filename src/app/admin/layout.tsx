"use client";

import { ReactNode } from "react";
import Sidebar from "./components/sidebar";
import Navbar from "./components/navbar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className=" flex flex-col gap-4">
      <Navbar />
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-grow border-2 relative top-24 border-amber-100 ml-24 mr-4">
          {children} {/* Content shifted right so it's never hidden */}
        </main>
      </div>
    </div>
  );
}
