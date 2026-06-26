import { NextResponse } from "next/server";
import { skillMetadata } from "@/registry/skills";

export function GET() {
  return NextResponse.json({ skills: skillMetadata });
}
