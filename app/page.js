"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const verified = !!user && user.emailVerified;
    router.replace(verified ? "/dashboard" : "/login");
  }, [loading, user, router]);

  return null;
}
