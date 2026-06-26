import { NextResponse } from "next/server";
import { createProject } from "@/generator/create-project";
import { createProjectRequestSchema } from "@/schemas/agent-config";

const expectedCreateProjectErrors = new Set([
  "Output directory already exists",
  "Invalid project slug",
  "Invalid project path",
]);

const createProjectErrorMessages: Record<string, string> = {
  "Output directory already exists": "输出目录已存在",
  "Invalid project slug": "项目标识无效",
  "Invalid project path": "项目路径无效",
};

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
      { error: "请求参数无效", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await createProject({ request: parsed.data });
    return NextResponse.json(result);
  } catch (error) {
    const expectedError = expectedCreateProjectError(error);
    if (expectedError) {
      return NextResponse.json({ error: createProjectErrorMessages[expectedError] }, { status: 400 });
    }

    return NextResponse.json({ error: "项目生成失败" }, { status: 500 });
  }
}
