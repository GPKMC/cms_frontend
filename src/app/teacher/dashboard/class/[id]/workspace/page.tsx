// src/CreateMenu.tsx
"use client";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  PlusCircle,
  FileText,
  HelpCircle,
  Book,
  ListChecks,
  List
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

import TopicModal from "./topicform";
import TopicSelector from "./topicSelect";
import CourseMaterialForm from "./materialform";
import AssignmentForm from "./assignmentform";
import QuestionForm from "./question/question";
import QuizForm from "./quiz/quizform";
import GroupAssignmentForm from "./groupAssignment/groupAssignmentform";

const menuOptions = [
  { label: "Assignment", icon: <FileText size={18} />, value: "assignment" },
  { label: "Group Assignment", icon: <ListChecks size={18} />, value: "group-assignment" },
  { label: "Quiz Assignment", icon: <ListChecks size={18} />, value: "quiz" },
  { label: "Question", icon: <HelpCircle size={18} />, value: "question" },
  { label: "Material", icon: <Book size={18} />, value: "material" },
  { label: "Topic", icon: <List size={18} />, value: "Topic" },
];

export default function CreateMenu() {
  const params = useParams();
  const courseInstanceId =
    (params?.id as string) ||
    (params?.courseInstanceId as string) ||
    "";

  const token = typeof window !== "undefined"
    ? localStorage.getItem("token_teacher") || sessionStorage.getItem("token_teacher") || ""
    : "";

  const [courseName, setCourseName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [showGroupAssignmentForm, setShowGroupAssignmentForm] = useState(false);
  const [showQuizForm, setShowQuizForm] = useState(false);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(false);

  useEffect(() => {
    if (!courseInstanceId) return;
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/course-api/courseInstance/${courseInstanceId}`, {
      headers: { Authorization: token ? `Bearer ${token}` : "" },
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setCourseName(data.instance.course.name))
      .catch(() => setCourseName("Course"));
  }, [courseInstanceId, token]);

  function handleMenu(option: { value: string }) {
    setMenuOpen(false);
    // reset
    setShowMaterialForm(false);
    setShowAssignmentForm(false);
    setShowGroupAssignmentForm(false);
    setShowQuizForm(false);
    setShowQuestionForm(false);
    setShowTopicModal(false);

    switch (option.value) {
      case "material":
        setShowMaterialForm(true);
        break;
      case "assignment":
        setShowAssignmentForm(true);
        break;
      case "group-assignment":
        setShowGroupAssignmentForm(true);
        break;
      case "quiz":
        setShowQuizForm(true);
        break;
      case "question":
        setShowQuestionForm(true);
        break;
      case "Topic":
        setShowTopicModal(true);
        break;
    }
  }

  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 5000 }} />

      <button
        className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-full font-semibold text-lg shadow hover:bg-blue-700"
        onClick={() => setMenuOpen(open => !open)}
      >
        <PlusCircle size={22} /> Create
      </button>

      {menuOpen && (
        <div className="absolute mt-2 left-0 bg-white border rounded-xl shadow-xl py-1 z-50 min-w-[200px]">
          {menuOptions.map(opt => (
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
        <TopicSelector courseInstanceId={courseInstanceId} token={token} />
      )}

      {showMaterialForm && (
        <CourseMaterialForm
          courseInstanceId={courseInstanceId}
          courseName={courseName}
          onSuccess={() => setShowMaterialForm(false)}
        />
      )}
      {showAssignmentForm && (
        <AssignmentForm
          courseInstanceId={courseInstanceId}
          courseName={courseName}
          onSuccess={() => setShowAssignmentForm(false)}
        />
      )}
      {showGroupAssignmentForm && (
        <GroupAssignmentForm
          open={true}
          courseInstanceId={courseInstanceId}
          courseName={courseName}
          onClose={() => setShowGroupAssignmentForm(false)}
          onSuccess={() => {
            setShowGroupAssignmentForm(false);
            toast.success("Group assignment created!");
          }}
        />
      )}

      {showQuizForm && (
        <QuizForm
          courseInstanceId={courseInstanceId}
          courseName={courseName}
          onClose={() => setShowQuizForm(false)}
          onSuccess={() => {
            setShowQuizForm(false);
            toast.success("Quiz created!");
          }}
        />
      )}

      {showQuestionForm && (
        <QuestionForm
          courseInstanceId={courseInstanceId}
          courseName={courseName}
          onSuccess={() => setShowQuestionForm(false)}
        />
      )}

      {showTopicModal && (
        <TopicModal
          courseInstanceId={courseInstanceId}
          open={true}
          onClose={() => setShowTopicModal(false)}
          onSuccess={msg => {
            toast.success(msg || "Topic created!");
            setShowTopicModal(false);
          }}
        />
      )}
    </>
  );
}
