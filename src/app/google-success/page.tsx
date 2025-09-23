"use client";

import { useEffect, useState } from "react";

type JwtPayload = {
  role?: "student" | "teacher" | string;
  [k: string]: unknown;
};

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const base64 = token.split(".")[1];
    const padded =
      base64.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export default function GoogleSuccess() {
  const [msg, setMsg] = useState("Finishing sign-in…");

  useEffect(() => {
    try {
      const hash = window.location.hash || "";
      const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
      const token = params.get("token");

      if (!token) {
        setMsg("Missing token from Google sign-in. Please try again.");
        return;
      }

      const payload = decodeJwtPayload(token);
      const role = payload?.role;

      if (role !== "student" && role !== "teacher") {
        setMsg("Signed in, but your account role isn’t allowed for Google sign-in.");
        return;
      }

      // Respect “Remember me”
      const remember = localStorage.getItem("oauth_remember") === "1";
      const storage = remember ? localStorage : sessionStorage;

      // Store under role-appropriate key
      const storageKey = role === "teacher" ? "token_teacher" : "token_student";
      storage.setItem(storageKey, token);

      // Cleanup ephemeral hints
      localStorage.removeItem("oauth_remember");
      localStorage.removeItem("oauth_return");

      // Role-based destination
      const dest = role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";

      // Replace so Back doesn’t revisit this page
      window.location.replace(dest);
    } catch (e) {
      console.error(e);
      setMsg("Signed in, but redirect failed. Try going to your dashboard.");
    }
  }, []);

  return (
    <main style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
      <p style={{ fontSize: 16, opacity: 0.85 }}>{msg}</p>
    </main>
  );
}
