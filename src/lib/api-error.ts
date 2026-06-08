import { NextResponse } from "next/server";

export function handleApiError(error: unknown, context: string): NextResponse {
  const message = error instanceof Error ? error.message : "Unknown error";
  const stack = error instanceof Error ? error.stack : undefined;

  console.error(JSON.stringify({
    level: "error",
    context,
    message,
    stack,
    timestamp: new Date().toISOString(),
  }));

  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
