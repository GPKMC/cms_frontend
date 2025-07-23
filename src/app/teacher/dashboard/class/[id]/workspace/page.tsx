// CreateMenu.tsx
"use client";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  PlusCircle,
  FileText,
  HelpCircle,
  Book,
  ListChecks,
  List,
} from "lucide-react";
import TopicModal from "./topicform";
import toast, { Toaster } from "react-hot-toast";
import CourseMaterialForm from "./materialform";
import AssignmentForm from "./assignmentform";
import MaterialList from "./workspacelist";
import TopicSelector from "./topicSelect";
// import CourseFeed from "./workspacelist";


const menuOptions = [
  { label: "Assignment", icon: <FileText size={18} />, value: "assignment" },
  { label: "Quiz Assignment", icon: <ListChecks size={18} />, value: "quiz" },
  { label: "Question", icon: <HelpCircle size={18} />, value: "question" },
  { label: "Material", icon: <Book size={18} />, value: "material" },
  { label: "Topic", icon: <List size={18} />, value: "Topic" },
  // etc
];

export default function CreateMenu() {
  const params = useParams();
  // Adjust based on your dynamic segment: [id] or [courseInstanceId]
  const courseInstanceId: string | undefined =
    (params?.id && params.id.toString()) ||
    (params?.courseInstanceId && params.courseInstanceId.toString());

  // Get token ONCE, so you don't repeat code
  const token =
    (typeof window !== "undefined" &&
      (localStorage.getItem("token_teacher") ||
        sessionStorage.getItem("token_teacher"))) ||
    "";

  const [courseName, setCourseName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  // Fetch courseInstance details (for courseName, if needed)
  useEffect(() => {
    if (!courseInstanceId) return;
    async function fetchCourseInstance() {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/course-api/courseInstance/${courseInstanceId}`,
        { headers: { Authorization: token ? `Bearer ${token}` : "" } }
      );
      if (res.ok) {
        const data = await res.json();
        setCourseName(data?.instance?.course?.name || "Course");
      }
    }
    fetchCourseInstance();
  }, [courseInstanceId, token]);

  function handleMenu(option: {
    label: string;
    icon: React.ReactNode;
    value: string;
  }) {
    setMenuOpen(false);
    if (option.value === "material") {
      setShowMaterialForm(true);
      setShowAssignmentForm(false);
    }
    if (option.value === "assignment") {
      setShowAssignmentForm(true);
      setShowMaterialForm(false);
    }
    if (option.value === "Topic") setShowTopicModal(true);
  }

  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 5000 }} />

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
      {courseInstanceId && (
        <div>
          <TopicSelector
            courseInstanceId={courseInstanceId}
            token={token}
          
          />
          <MaterialList courseInstanceId={courseInstanceId} />
          {/* <CourseFeed courseInstanceId={courseInstanceId}/> */}
        </div>

      )}
      {showMaterialForm && courseInstanceId && (
        <CourseMaterialForm
          courseInstanceId={courseInstanceId}
          courseName={courseName}
          onSuccess={() => setShowMaterialForm(false)}
        />
      )}
      {showAssignmentForm && courseInstanceId && (
        <AssignmentForm
          courseInstanceId={courseInstanceId}
          courseName={courseName}
          onSuccess={() => setShowAssignmentForm(false)}
        />
      )}

      {showTopicModal && courseInstanceId && (
        <TopicModal
          courseInstanceId={courseInstanceId}
          open={showTopicModal}
          onClose={() => setShowTopicModal(false)}
          onSuccess={(msg) => {
            toast.success(msg || "Topic created!");
            setShowTopicModal(false);
          }}
        />
      )}
    </>
  );
}
