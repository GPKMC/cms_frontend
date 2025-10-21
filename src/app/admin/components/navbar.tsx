"use client";

import Image from "next/image";
import Link from "next/link";
import { useUser } from "../adminContext"; // Adjust this import to your file location

export default function Navbar() {
  const { user } = useUser();

  return (
    <div className="fixed top-0 left-0 w-full z-50 flex items-center py-4 px-4 bg-[#2E3094] gap-4">
      {/* Clickable logo -> /admin */}
      <Link
        href="/admin"
        aria-label="Go to home dashboard"
        title="Go to home dashboard"
      >
        <Image
          src="/images/gpkoiralalogo.svg"
          width={60}
          height={60}
          alt="logo"
          className="cursor-pointer"
          priority
        />
      </Link>

      <h2 className="text-xl font-bold text-white flex-grow">Admin Panel</h2>

      {user && (
        <span className="text-white font-medium whitespace-nowrap">
          Welcome, {user.username}!
        </span>
      )}
    </div>
  );
}
