import { Faculty } from "./type.faculty";

export type Batch = {
  _id: string;
  batchname?: string;
  faculty: Faculty;
  startYear: number;
  endYear?: number;
  isCompleted: boolean;
  currentSemesterOrYear: number;
  slug?: string;
  createdAt: string;
  updatedAt: string;
}
export type BatchInput = {
  facultyCode: Faculty["code"];
  startYear: number;
  endYear?: number;
  isCompleted: boolean;
  currentSemesterOrYear: number;
};