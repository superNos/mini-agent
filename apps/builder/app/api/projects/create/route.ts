import { NextResponse } from "next/server";
import { createProject } from "@/generator/create-project";
import { createProjectRequestSchema } from "@/schemas/agent-config";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = createProjectRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await createProject({ request: parsed.data });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
