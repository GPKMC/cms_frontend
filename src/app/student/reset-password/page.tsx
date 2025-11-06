// app/student/reset-password/page.tsx

import ResetPasswordClient from "./resetpassword-client";


export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const emailFromUrl = typeof email === "string" ? email : "";

  return <ResetPasswordClient initialEmail={emailFromUrl} />;
}
