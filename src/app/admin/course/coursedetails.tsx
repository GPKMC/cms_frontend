import React, { useEffect } from "react";
import { Course } from "../types/type.course"; // Adjust import path!

type CourseDetailsProps = {
  course: Course;
  onClose: () => void;
};

const getOrdinal = (n?: number) => {
  if (!n) return "";
  const j = n % 10, k = n % 100;
  if (j === 1 && k !== 11) return n + "st";
  if (j === 2 && k !== 12) return n + "nd";
  if (j === 3 && k !== 13) return n + "rd";
  return n + "th";
};

const CourseDetails: React.FC<CourseDetailsProps> = ({ course, onClose }) => {
  // Allow ESC to close modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!course) return null;

  const { name, code, type, slug, description, createdAt, updatedAt, semesterOrYear } = course;
  
let semesterYearLabel = "";
if (semesterOrYear) {
  if (typeof semesterOrYear === "string") {
    semesterYearLabel = semesterOrYear;
  } else if (semesterOrYear.semesterNumber) {
    semesterYearLabel = `${getOrdinal(semesterOrYear.semesterNumber)} Semester`;
  } else if (semesterOrYear.yearNumber) {
    semesterYearLabel = `${getOrdinal(semesterOrYear.yearNumber)} Year`;
  }
}


  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-600 hover:text-black text-2xl font-bold"
          aria-label="Close"
        >
          &times;
        </button>
        <h2 className="text-xl font-bold mb-4">{name}</h2>
        <table className="w-full mb-4">
          <tbody>
            <tr>
              <td className="font-semibold pr-4 py-2">Code:</td>
              <td>{code}</td>
            </tr>
            <tr>
              <td className="font-semibold pr-4 py-2">Type:</td>
              <td className="capitalize">{type}</td>
            </tr>
            <tr>
              <td className="font-semibold pr-4 py-2">Slug:</td>
              <td>{slug}</td>
            </tr>
            <tr>
              <td className="font-semibold pr-4 py-2">Description:</td>
              <td>{description || <span className="text-gray-400">No description</span>}</td>
            </tr>
            {semesterOrYear && (
              <>
                <tr>
                  <td className="font-semibold pr-4 py-2">Semester/Year:</td>
                  <td>{semesterYearLabel}</td>
                </tr>
              </>
            )}
            <tr>
              <td className="font-semibold pr-4 py-2">Created:</td>
              <td>{new Date(createdAt).toLocaleDateString()}</td>
            </tr>
            <tr>
              <td className="font-semibold pr-4 py-2">Updated:</td>
              <td>{new Date(updatedAt).toLocaleDateString()}</td>
            </tr>
          </tbody>
        </table>
        <div className="flex justify-end">
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseDetails;
