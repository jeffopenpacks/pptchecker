"use client";

import { use } from "react";

import { PresentLoader } from "@/components/PresentLoader";

export default function PresenterPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  return <PresentLoader sessionId={sessionId} mode="presenter" />;
}
