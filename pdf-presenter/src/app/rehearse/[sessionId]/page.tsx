"use client";

import { use } from "react";

import { RehearseLoader } from "@/components/RehearseLoader";

export default function RehearsePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  return <RehearseLoader sessionId={sessionId} />;
}
