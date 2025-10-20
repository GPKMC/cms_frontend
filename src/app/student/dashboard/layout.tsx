"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserProvider, useUser } from "./studentContext";
import Navbarteacher from "./components/navbar";
import SidebarStudent from "./components/sidebar";

function AuthChecker({ children }: { children: ReactNode }) {
  const { user, setUser } = useUser();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token_student") ||
          sessionStorage.getItem("token_student")
        : null;

    if (!token) {
      router.push("/");
      return;
    }

    async function fetchUser() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/userAuth/me`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error("Unauthorized");
        const data = await res.json();
        setUser(data.user);
        console.log("Logged in user:", data.user);
      } catch {
        localStorage.removeItem("token_student");
        sessionStorage.removeItem("token_student");
        router.push("/");
      } finally {
        setCheckingAuth(false);
      }
    }

    fetchUser();
  }, [router, setUser]);

  if (checkingAuth) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-gray-500">
        Checking authentication...
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <AuthChecker>
        <Navbarteacher />

        <div className="relative min-h-dvh md:min-h-screen">
          <SidebarStudent />

          <main
            className="
              flex-grow
              pt-24
              ml-0 md:ml-20 xl:ml-24        /* match sidebar widths; no gap on phone */
              px-0 md:px-4                    /* remove padding near sidebar; add only on md+ */
              pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-8

              overflow-y-auto md:overflow-visible
              min-h-[calc(100dvh-96px)]
            "
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {children}
          </main>
        </div>
      </AuthChecker>
    </UserProvider>
  );
}
