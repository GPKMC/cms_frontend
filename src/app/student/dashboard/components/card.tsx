// components/CourseCard.tsx
import { FC } from "react";

interface CourseCardProps {
  title: string;
  semesterOrYear: string;
  batchName: string;
  teacherName: string;
  studentCount: number;
  color?: string; // optional theme color
}

const CourseCard: FC<CourseCardProps> = ({
  title,
  semesterOrYear,
  batchName,
  teacherName,
  studentCount,
  color = "bg-blue-500"
}) => {
  return (
    <div className={`rounded-xl shadow-md overflow-hidden ${color} text-white w-full sm:w-[300px]`}>
      <div className="p-4 h-28 flex flex-col justify-between">
        <div className="text-xl font-semibold truncate">{title}</div>
        <div className="text-sm">{semesterOrYear}</div>
      </div>
      <div className="bg-white text-gray-800 p-4 flex flex-col gap-1 text-sm">
        <div><strong>Batch:</strong> {batchName}</div>
        <div><strong>Teacher:</strong> {teacherName}</div>
        <div><strong>Students:</strong> {studentCount}</div>
      </div>
    </div>
  );
};

export default CourseCard;
