"use client";

import React from "react";

const sampleUsers = [
  // Students: username can have spaces, email uses simplified username.number
  {
    username: "john doe",
    email: "john.1@gpkmc.edu.np",
    password: "Password@123",
    role: "student",
    faculty: "Bachelor of Computer Application",
    batch: "BCA_2029",
  },
  {
    username: "jane smith",
    email: "jane.2@gpkmc.edu.np",
    password: "Password@123",
    role: "student",
    faculty: "Bachelor of Computer Application",
    batch: "BCA_2027",
  },

  // Teacher and Admin: username and email match, no spaces
  {
    username: "teachermike",
    email: "teachermike@gpkmc.edu.np",
    password: "Password@123",
    role: "teacher",
    faculty: "",
    batch: "",
  },
  {
    username: "adminjane",
    email: "adminjane@gpkmc.edu.np",
    password: "Password@123",
    role: "admin",
    faculty: "",
    batch: "",
  },
];

function convertToCSV(users: typeof sampleUsers) {
  const header = ["username", "email", "password", "role", "faculty", "batch"];
  const rows = users.map((u) =>
    header
      .map((field) => {
        const value = u[field as keyof typeof u] ?? "";
        return `"${value}"`;
      })
      .join(",")
  );
  return [header.join(","), ...rows].join("\r\n");
}

export default function DownloadCSV() {
  const downloadCSV = () => {
    const csv = convertToCSV(sampleUsers);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "users_sample.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={downloadCSV}
      className="bg-blue-600 text-white px-4 py-2 rounded"
    >
      Download Sample CSV
    </button>
  );
}
