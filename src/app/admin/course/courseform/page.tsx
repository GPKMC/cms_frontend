// Server Component (no "use client" here)
import CreateCourseForm from "./CreateCourseForm";

export default function Page() {
  // No props; Next.js page must only use { params, searchParams } if needed
  return <CreateCourseForm />;
}
