import { Faculty } from "./type.faculty"; // adjust import path if needed

export type SemesterOrYear = {
  _id: string;
  faculty: Faculty; // Populated Faculty object
  semesterNumber?: number;
  yearNumber?: number;
  name: string;
  description?: string;
  courses: string[]; // Or: Array<string | Course> if you populate
  slug: string;
  createdAt: string;
  updatedAt: string;
};
