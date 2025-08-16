"use client";
import React from "react";
import { useParams } from "next/navigation";

import { useRouter } from "next/navigation"; // App Router version

type Props = {
  type: string;
  id: string;
  isExpanded: boolean;
};

export default function FeedItemFooter({ type, id, isExpanded }: Props) {
  const router = useRouter();
 const params = useParams();
  const classid = params.id as string;
  const baseBtn =
    "inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold";
  const ghost =
    baseBtn + " border border-gray-300 bg-white hover:bg-gray-50";
  const primary =
    baseBtn + " bg-blue-600 text-white hover:bg-blue-700";

  if (!isExpanded) return null;

  switch (type) {
    case "question":
      return (
        <div className="mt-4 border-t border-gray-200 pt-4 flex justify-end gap-3">
          <button
            type="button"
            className={ghost}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/teacher/dashboard/class/${classid}/Details/Question/${id}`);
            }}
          >
            View Question
          </button>
          <button
            type="button"
            className={primary}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/teacher/dashboard/class/${classid}/Details/Question/${id}`);
            }}
          >
            View Answer
          </button>
        </div>
      );

    case "assignment":
      return (
        <div className="mt-4 border-t border-gray-200 pt-4 flex justify-end gap-3">
          <button
            type="button"
            className={ghost}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/teacher/dashboard/class/${classid}/Details/Assignment/${id}`);
            }}
          >
            View Assignment
          </button>
          <button
            type="button"
            className={primary}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/assignments/${id}/submissions`);
            }}
          >
            View Submissions
          </button>
        </div>
      );

    case "groupAssignment":
      return (
        <div className="mt-4 border-t border-gray-200 pt-4 flex justify-end gap-3">
          <button
            type="button"
            className={ghost}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/teacher/dashboard/class/${classid}/Details/groupAssignment/${id}`);
            }}
          >
            View Group Assignment
          </button>
          <button
            type="button"
            className={primary}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/teacher/dashboard/class/${classid}/Details/groupAssignment/${id}`);
            }}
          >
            Manage Groups
          </button>
        </div>
      );

    case "quiz":
      return (
        <div className="mt-4 border-t border-gray-200 pt-4 flex justify-end gap-3">
          <button
            type="button"
            className={ghost}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/teacher/dashboard/class/${classid}/Details/quiz/${id}`);
            }}
          >
            View Quiz
          </button>
       
        </div>
      );
 case "material":
      return (
        <div className="mt-4 border-t border-gray-200 pt-4 flex justify-end gap-3">
          <button
            type="button"
            className={primary}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/teacher/dashboard/class/${classid}/Details/materials/${id}`);
            }}
          >
            View  Details
          </button>
        </div>
      );
    default:
      return null;
  }
}
