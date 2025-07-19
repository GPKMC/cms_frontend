"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserProvider, useUser } from "./context";        // UserProvider/context as you have
import Navbarteacher from "./components/navbar";
import SidebarTeacher from "./components/sidebar";

// AuthChecker component
function AuthChecker({ children }: { children: ReactNode }) {
  const { user, setUser } = useUser();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Look for token in both localStorage and sessionStorage
    const token = typeof window !== "undefined"
      ? localStorage.getItem("token") || sessionStorage.getItem("token")
      : null;

    if (!token) {
      router.push("/teacher/login");
      return;
    }

    async function fetchUser() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/userAuth/me`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!res.ok) throw new Error("Unauthorized");
        const data = await res.json();
        setUser(data.user);
      } catch {
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");
        router.push("/teacher/login");
      } finally {
        setCheckingAuth(false);
      }
    }

    fetchUser();
  }, [router, setUser]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Checking authentication...
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}

// Main Layout
export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <AuthChecker>
        <Navbarteacher />
        <div className="flex min-h-screen">
          <SidebarTeacher />
          <main className="flex-grow border-2 relative top-24 border-amber-100 ml-24 mr-4">
            {children}
          </main>
        </div>
      </AuthChecker>
    </UserProvider>
  );
}
