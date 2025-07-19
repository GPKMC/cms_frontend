export interface Course {
  _id: string;
  name: string;
  code: string;
  slug: string;
  description?: string;
  type: "compulsory" | "elective";
  semesterOrYear: {
    _id: string;
    name: string;
    faculty: {
      _id: string;
      code: string;
      name: string;
    };
    semesterNumber?: number;
    yearNumber?: number;
  };
  createdAt: string;
  updatedAt: string;
}
