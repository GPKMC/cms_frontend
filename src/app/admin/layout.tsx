"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./components/sidebar";
import Navbar from "./components/navbar";
import { UserProvider, useUser } from "./userContext";

function AuthChecker({ children }: { children: ReactNode }) {
  const { user, setUser } = useUser();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/admin_login");
      return;
    }

    async function fetchUser() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/userAuth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error("Unauthorized");
        const data = await res.json();
        setUser(data.user);
      } catch {
        localStorage.removeItem("token");
        router.push("/admin_login");
      } finally {
        setCheckingAuth(false);
      }
    }

    fetchUser();
  }, [router, setUser]);

  if (checkingAuth) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Checking authentication...</div>;
  }

  if (!user) return null;

  return <>{children}</>;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <AuthChecker>
        <Navbar />
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-grow border-2 relative top-24 border-amber-100 ml-24 mr-4">{children}</main>
        </div>
      </AuthChecker>
    </UserProvider>
  );
}
