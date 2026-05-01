import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getOutputDirectory } from "@/lib/output-directory";

export type PromptAssistantSessionMode = "create" | "adjust";

export type PromptAssistantSessionMessage = {
  role: "user" | "assistant";
  content: string;
};

export type PromptAssistantSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
  mode: PromptAssistantSessionMode;
  messages: PromptAssistantSessionMessage[];
};

const sessionDirectoryName = "prompt-assistant-sessions";

export function getPromptAssistantSessionDirectory() {
  return path.join(getOutputDirectory(), sessionDirectoryName);
}

export function createPromptAssistantSessionId(date = new Date()) {
  return `${formatDateForFileName(date)}-${date.getTime()}`;
}

export async function createPromptAssistantSession({
  mode,
  messages = [],
}: {
  mode: PromptAssistantSessionMode;
  messages?: PromptAssistantSessionMessage[];
}) {
  const now = new Date();
  const session: PromptAssistantSession = {
    id: createPromptAssistantSessionId(now),
    createdAt: formatDateTime(now),
    updatedAt: formatDateTime(now),
    mode,
    messages: normalizeMessages(messages),
  };

  await writePromptAssistantSession(session);

  return session;
}

export async function updatePromptAssistantSession({
  id,
  mode,
  messages,
}: {
  id: string;
  mode: PromptAssistantSessionMode;
  messages: PromptAssistantSessionMessage[];
}) {
  const existing = await readPromptAssistantSession(id);
  const now = new Date();
  const session: PromptAssistantSession = {
    id,
    createdAt: existing?.createdAt ?? formatDateTime(now),
    updatedAt: formatDateTime(now),
    mode,
    messages: normalizeMessages(messages),
  };

  await writePromptAssistantSession(session);

  return session;
}

export async function listPromptAssistantSessions() {
  const directory = getPromptAssistantSessionDirectory();

  await mkdir(directory, { recursive: true });

  const fileNames = await readdir(directory);
  const sessions = await Promise.all(
    fileNames
      .filter((fileName) => fileName.endsWith(".json"))
      .map(async (fileName) => {
        const filePath = path.join(directory, fileName);
        const content = await readFile(filePath, "utf8").catch(() => "");

        return parsePromptAssistantSession(content);
      }),
  );

  return sessions
    .filter((session): session is PromptAssistantSession => Boolean(session))
    .filter((session) => session.messages.length > 0)
    .sort((left, right) => right.id.localeCompare(left.id));
}

async function readPromptAssistantSession(id: string) {
  if (!isSafeSessionId(id)) {
    return null;
  }

  const content = await readFile(getSessionPath(id), "utf8").catch(() => "");

  return parsePromptAssistantSession(content);
}

async function writePromptAssistantSession(session: PromptAssistantSession) {
  const directory = getPromptAssistantSessionDirectory();

  await mkdir(directory, { recursive: true });
  await writeFile(
    getSessionPath(session.id),
    `${JSON.stringify(session, null, 2)}\n`,
  );
}

function getSessionPath(id: string) {
  return path.join(getPromptAssistantSessionDirectory(), `${id}.json`);
}

function parsePromptAssistantSession(content: string) {
  if (!content) {
    return null;
  }

  try {
    const value = JSON.parse(content) as Partial<PromptAssistantSession>;

    if (
      !value.id ||
      !isSafeSessionId(value.id) ||
      (value.mode !== "create" && value.mode !== "adjust")
    ) {
      return null;
    }

    return {
      id: value.id,
      createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
      mode: value.mode,
      messages: normalizeMessages(value.messages),
    };
  } catch {
    return null;
  }
}

export function isSafeSessionId(id: string) {
  return /^\d{4}-\d{2}-\d{2}-\d{13}$/u.test(id);
}

export function normalizeMessages(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const message = item as Partial<PromptAssistantSessionMessage>;
    const content = typeof message.content === "string"
      ? message.content.trim()
      : "";

    if (
      (message.role !== "user" && message.role !== "assistant") ||
      !content
    ) {
      return [];
    }

    return [{ role: message.role, content: content.slice(0, 4000) }];
  });
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatDateForFileName(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
