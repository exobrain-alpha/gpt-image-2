import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const tagFilePath = path.join(process.cwd(), "data", "prompt-tags.json");

export async function GET() {
  const tags = await readTags();

  return NextResponse.json({ tags });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { tag?: unknown }
    | null;
  const tag = typeof body?.tag === "string" ? body.tag.trim() : "";

  if (!tag) {
    return NextResponse.json({ error: "Tag is required." }, { status: 400 });
  }

  if (tag.length > 32) {
    return NextResponse.json(
      { error: "Tag must be 32 characters or fewer." },
      { status: 400 },
    );
  }

  const tags = await readTags();
  const nextTags = tags.includes(tag) ? tags : [...tags, tag];

  await mkdir(path.dirname(tagFilePath), { recursive: true });
  await writeFile(tagFilePath, `${JSON.stringify(nextTags, null, 2)}\n`);

  return NextResponse.json({ tags: nextTags });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { tag?: unknown }
    | null;
  const tag = typeof body?.tag === "string" ? body.tag.trim() : "";

  if (!tag) {
    return NextResponse.json({ error: "Tag is required." }, { status: 400 });
  }

  const tags = await readTags();
  const nextTags = tags.filter((currentTag) => currentTag !== tag);

  await mkdir(path.dirname(tagFilePath), { recursive: true });
  await writeFile(tagFilePath, `${JSON.stringify(nextTags, null, 2)}\n`);

  return NextResponse.json({ tags: nextTags });
}

async function readTags() {
  const content = await readFile(tagFilePath, "utf8").catch(() => "[]");
  const parsed = JSON.parse(content) as unknown;

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
