"use client";

import Sidebar from "./Sidebar";

export default function AppShell({ children }) {
  return (
    <div className="flex min-h-screen bg-[#FAFAFA]">
      <Sidebar />
      <main className="flex-1 ml-[260px] transition-all duration-300 relative">
        <div className="relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
