import { NextResponse } from "next/server";
import {
  createPromptAssistantSession,
  isSafeSessionId,
  listPromptAssistantSessions,
  normalizeMessages,
  updatePromptAssistantSession,
  type PromptAssistantSessionMode,
} from "@/lib/prompt-assistant-sessions";

export const runtime = "nodejs";

type SessionRequest = {
  action?: unknown;
  id?: unknown;
  mode?: unknown;
  messages?: unknown;
};

export async function GET() {
  const sessions = await listPromptAssistantSessions();

  return NextResponse.json({ sessions });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | SessionRequest
    | null;

  if (!body || typeof body.action !== "string") {
    return NextResponse.json({ error: "请求体不是有效 JSON。" }, { status: 400 });
  }

  const mode = normalizeMode(body.mode);

  if (!mode) {
    return NextResponse.json({ error: "会话模式无效。" }, { status: 400 });
  }

  if (body.action === "create") {
    const messages = normalizeMessages(body.messages);

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "空会话不会保存。" },
        { status: 400 },
      );
    }

    const session = await createPromptAssistantSession({
      mode,
      messages,
    });

    return NextResponse.json({ session });
  }

  if (body.action === "update") {
    if (typeof body.id !== "string" || !isSafeSessionId(body.id)) {
      return NextResponse.json({ error: "会话 ID 无效。" }, { status: 400 });
    }

    const messages = normalizeMessages(body.messages);

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "空会话不会保存。" },
        { status: 400 },
      );
    }

    const session = await updatePromptAssistantSession({
      id: body.id,
      mode,
      messages,
    });

    return NextResponse.json({ session });
  }

  return NextResponse.json({ error: "未知会话操作。" }, { status: 400 });
}

function normalizeMode(value: unknown): PromptAssistantSessionMode | null {
  return value === "create" || value === "adjust" ? value : null;
}
