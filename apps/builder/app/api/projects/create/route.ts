import { NextResponse } from "next/server";
import { createProject } from "@/generator/create-project";
import { createProjectRequestSchema } from "@/schemas/agent-config";

const expectedCreateProjectErrors = new Set([
  "Output directory already exists",
  "Invalid project slug",
  "Invalid project path",
]);

function expectedCreateProjectError(error: unknown) {
  if (!(error instanceof Error)) return null;
  if (!expectedCreateProjectErrors.has(error.message)) return null;
  return error.message;
}

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
    const expectedError = expectedCreateProjectError(error);
    if (expectedError) {
      return NextResponse.json({ error: expectedError }, { status: 400 });
    }

    return NextResponse.json({ error: "Project generation failed" }, { status: 500 });
  }
}
