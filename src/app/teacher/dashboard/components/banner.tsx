"use client";

import Image from "next/image";

interface CourseBannerProps {
  courseName: string;
  batchName: string;
  teacherName: string;
  semesterLabel: string;
  studentCount: number;
  showImage?: boolean;
}

export default function CourseBanner({
  courseName,
  batchName,
  teacherName,
  semesterLabel,
  studentCount,
  showImage = true,
}: CourseBannerProps) {
  return (
    <div className="relative flex justify-between items-start bg-green-500 rounded-xl overflow-hidden h-[300px] w-full p-8 text-white font-sans shadow-lg">
      {/* Left Content */}
      <div className="absolute left-4 bottom-4 text-left">
        <h1 className="text-4xl font-bold mb-2">{courseName}</h1>
        <p className="text-xl font-medium">{batchName}</p>
        <p className="text-base font-mono italic">{semesterLabel}</p>
      </div>

      {/* Right Illustration (optional) */}
      {showImage && (
        <div className="absolute right-0 bottom-0 h-full w-[45%] pointer-events-none opacity-90">
          <Image
            src="/images/books-illustration.png"
            alt="Books illustration"
            fill
            className="object-contain"
          />
        </div>
      )}

      {/* Info Block at Bottom Right */}
      <div className="absolute bottom-4 right-4 text-right">
        <p className="text-sm font-semibold text-white/80">Teacher</p>
        <p className="text-lg font-bold">{teacherName}</p>
        
        <p className="text-sm font-semibold text-white/80 mt-2">Total Students</p>
        <p className="text-2xl font-extrabold">{studentCount}</p>
      </div>

      {/* Customize Button */}
      <button
        className="absolute top-4 right-4 bg-white text-blue-700 font-semibold px-4 py-1.5 rounded-full shadow hover:bg-gray-100 transition"
        aria-label="Customize"
      >
        ✎ Customize
      </button>
    </div>
  );
}
