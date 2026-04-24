import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const outputDirectory = path.join(process.cwd(), "outputs");
const contentTypes: Record<string, string> = {
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileName: string }> },
) {
  const { fileName } = await params;
  const safeFileName = path.basename(fileName);
  const extension = path.extname(safeFileName).toLowerCase();
  const contentType = contentTypes[extension];

  if (!contentType) {
    return NextResponse.json({ error: "Unsupported file type." }, { status: 404 });
  }

  const filePath = path.join(outputDirectory, safeFileName);
  const file = await readFile(filePath).catch(() => null);

  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  return new NextResponse(file, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": contentType,
    },
  });
}
