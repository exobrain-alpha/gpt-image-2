import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type PromptAssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

type AnthropicMessageResponse = {
  content?: AnthropicContent[];
  error?: {
    type?: string;
    message?: string;
  };
};

type AnthropicContent = {
  type?: string;
  text?: string;
};

type PromptAssistantRequest = {
  messages?: unknown;
};

const anthropicVersion = "2023-06-01";
const defaultDeployment = "claude-opus-4-7";
const systemPrompt = [
  "你是一个图像生成提示词优化器。",
  "你的任务是根据用户主题和后续要求，生成或改写可直接用于图像生成模型的 prompt。",
  "只返回提示词本身，不要寒暄、解释、标题、Markdown、引号、编号或附加说明。",
  "提示词需要具体、可执行，包含主体、场景、构图、光线、材质、风格、色彩、镜头和质量细节。",
  "如果用户要求调整上一版提示词，直接输出调整后的完整提示词。",
].join("\n");

export async function POST(request: Request) {
  const validation = await readAndValidateRequest(request);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const endpoint =
    process.env.PROMPT_ASSISTANT_AZURE_OPENAI_ENDPOINT ??
    process.env.AZURE_CLAUDE_ENDPOINT ??
    process.env.AZURE_OPENAI_ENDPOINT ??
    process.env.AZURE_AI_ENDPOINT;
  const apiKey =
    process.env.PROMPT_ASSISTANT_AZURE_OPENAI_API_KEY ??
    process.env.AZURE_CLAUDE_API_KEY ??
    process.env.AZURE_OPENAI_API_KEY ??
    process.env.AZURE_AI_API_KEY;
  const deployment =
    process.env.PROMPT_ASSISTANT_DEPLOYMENT_NAME ??
    process.env.AZURE_CLAUDE_DEPLOYMENT_NAME ??
    defaultDeployment;

  if (!endpoint || !apiKey) {
    return NextResponse.json(
      {
        error:
          "缺少智能提示词模型配置。请设置 AZURE_CLAUDE_ENDPOINT 和 AZURE_CLAUDE_API_KEY。",
      },
      { status: 500 },
    );
  }

  let response: Response;

  try {
    response = await fetch(buildAnthropicMessagesUrl(endpoint), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": anthropicVersion,
      },
      body: JSON.stringify({
        model: deployment,
        messages: validation.value,
        system: systemPrompt,
        max_tokens: 1200,
        stream: false,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `无法连接智能提示词模型：${error.message}`
            : "无法连接智能提示词模型。",
      },
      { status: 502 },
    );
  }

  const responseBody = (await response.json().catch(() => null)) as
    | AnthropicMessageResponse
    | null;

  if (!response.ok || responseBody?.error) {
    return NextResponse.json(
      {
        error:
          responseBody?.error?.message ??
          `智能提示词模型请求失败，HTTP ${response.status}。`,
        code: responseBody?.error?.type,
      },
      { status: response.ok ? 502 : response.status },
    );
  }

  const prompt = normalizeAssistantContent(responseBody?.content);

  if (!prompt) {
    return NextResponse.json(
      { error: "智能提示词模型未返回有效内容。" },
      { status: 502 },
    );
  }

  return NextResponse.json({ prompt });
}

function buildAnthropicMessagesUrl(endpoint: string) {
  const trimmedEndpoint = endpoint.replace(/\/+$/u, "");

  if (trimmedEndpoint.endsWith("/anthropic/v1/messages")) {
    return trimmedEndpoint;
  }

  if (trimmedEndpoint.endsWith("/anthropic")) {
    return `${trimmedEndpoint}/v1/messages`;
  }

  return `${trimmedEndpoint}/anthropic/v1/messages`;
}

async function readAndValidateRequest(request: Request) {
  let body: PromptAssistantRequest;

  try {
    body = (await request.json()) as PromptAssistantRequest;
  } catch {
    return { ok: false as const, error: "请求体不是有效 JSON。" };
  }

  if (!Array.isArray(body.messages)) {
    return { ok: false as const, error: "请输入有效的对话内容。" };
  }

  const messages: PromptAssistantMessage[] = [];

  for (const message of body.messages) {
    if (!isPromptAssistantMessage(message)) {
      return { ok: false as const, error: "对话内容格式无效。" };
    }

    const normalized = message.content.trim();

    if (!normalized) {
      continue;
    }

    messages.push({
      role: message.role,
      content: normalized.slice(0, 4000),
    });
  }

  if (messages.length === 0) {
    return { ok: false as const, error: "请输入主题内容。" };
  }

  return { ok: true as const, value: messages.slice(-12) };
}

function isPromptAssistantMessage(
  value: unknown,
): value is PromptAssistantMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Partial<PromptAssistantMessage>;

  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
}

function normalizeAssistantContent(content: AnthropicContent[] | undefined) {
  if (Array.isArray(content)) {
    return cleanPrompt(
      content
        .map((part) => (part.type === "text" ? part.text ?? "" : ""))
        .join("\n"),
    );
  }

  return "";
}

function cleanPrompt(value: string) {
  return value
    .trim()
    .replace(/^```(?:\w+)?\s*/u, "")
    .replace(/\s*```$/u, "")
    .replace(/^["“”']|["“”']$/gu, "")
    .trim();
}
