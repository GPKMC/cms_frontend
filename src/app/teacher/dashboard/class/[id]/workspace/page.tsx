// CreateMenu.tsx (main dropdown)
"use client";
import React, { useState } from "react";
import {
  PlusCircle, FileText, HelpCircle, Book, ListChecks
} from "lucide-react";
import CourseMaterialForm from "../workspaceform";
// Your big sidebar-enabled form

const menuOptions = [
  { label: "Assignment", icon: <FileText size={18} />, value: "assignment" },
  { label: "Quiz Assignment", icon: <ListChecks size={18} />, value: "quiz" },
  { label: "Question", icon: <HelpCircle size={18} />, value: "question" },
  { label: "Material", icon: <Book size={18} />, value: "material" },
  // etc
];

interface CreateMenuProps {
  courseInstanceId: string;
  courseName: string;
}

export default function CreateMenu({ courseInstanceId, courseName }: CreateMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMaterialForm, setShowMaterialForm] = useState(false);

  function handleMenu(option: { label: string; icon: React.ReactNode; value: string }) {
    setMenuOpen(false);
    if (option.value === "material") setShowMaterialForm(true);
  }

  return (
    <>
      <button
        className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-full font-semibold text-lg shadow hover:bg-blue-700"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <PlusCircle size={22} /> Create
      </button>
      {menuOpen && (
        <div className="absolute mt-2 left-0 bg-white border rounded-xl shadow-xl py-1 z-50 min-w-[200px]">
          {menuOptions.map((opt) => (
            <button
              key={opt.value}
              className="flex items-center w-full px-4 py-2 text-left hover:bg-gray-100 gap-2"
              onClick={() => handleMenu(opt)}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      )}
      {showMaterialForm && (
        <CourseMaterialForm
          courseInstanceId={courseInstanceId}
          courseName={courseName}
          onSuccess={() => setShowMaterialForm(false)}
        />
      )}
    </>
  );
}
