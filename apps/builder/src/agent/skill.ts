export type Skill = {
  id: string;
  name: string;
  description: string;
  content: string;
  toolIds?: string[];
};

type SkillFrontmatter = {
  id?: string;
  name?: string;
  description?: string;
  tools?: string[];
  toolIds?: string[];
};

function parseScalar(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseInlineArray(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return undefined;
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(",").map((item) => parseScalar(item)).filter(Boolean);
}

function parseFrontmatter(value: string): SkillFrontmatter {
  const frontmatter: SkillFrontmatter = {};
  const lines = value.split(/\r?\n/);
  let currentArrayKey: "tools" | "toolIds" | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (currentArrayKey && trimmed.startsWith("- ")) {
      frontmatter[currentArrayKey] = [
        ...(frontmatter[currentArrayKey] ?? []),
        parseScalar(trimmed.slice(2)),
      ];
      continue;
    }

    currentArrayKey = null;
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (key === "tools" || key === "toolIds") {
      const inlineArray = parseInlineArray(rawValue);
      if (inlineArray) {
        frontmatter[key] = inlineArray;
      } else {
        frontmatter[key] = [];
        currentArrayKey = key;
      }
      continue;
    }

    if (key === "id" || key === "name" || key === "description") {
      frontmatter[key] = parseScalar(rawValue);
    }
  }

  return frontmatter;
}

function splitMarkdownSkill(markdown: string) {
  const normalized = markdown.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---")) {
    return { frontmatter: "", content: normalized.trim() };
  }

  const closingMarker = normalized.indexOf("\n---", 3);
  if (closingMarker === -1) {
    return { frontmatter: "", content: normalized.trim() };
  }

  const frontmatter = normalized.slice(3, closingMarker).trim();
  const content = normalized.slice(closingMarker + 4).trim();
  return { frontmatter, content };
}

export function parseSkillMarkdown(markdown: string, fallbackId: string): Skill {
  const { frontmatter, content } = splitMarkdownSkill(markdown);
  const metadata = parseFrontmatter(frontmatter);
  const id = metadata.id ?? fallbackId;

  if (!id) {
    throw new Error("Skill id is required");
  }
  if (!metadata.name) {
    throw new Error(`Skill ${id} is missing name`);
  }
  if (!metadata.description) {
    throw new Error(`Skill ${id} is missing description`);
  }
  if (!content) {
    throw new Error(`Skill ${id} is missing markdown content`);
  }

  return {
    id,
    name: metadata.name,
    description: metadata.description,
    content,
    toolIds: metadata.toolIds ?? metadata.tools ?? [],
  };
}
