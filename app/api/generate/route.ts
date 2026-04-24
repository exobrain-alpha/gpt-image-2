import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  backgroundModes,
  imageFormats,
  imageQualities,
  imageSizes,
  type GenerateImageRequest,
} from "@/lib/image-options";

export const runtime = "nodejs";
export const maxDuration = 60;

type AzureImageResponse = {
  created?: number;
  data?: Array<{ b64_json?: string }>;
  error?: {
    code?: string;
    message?: string;
  };
};

type GenerationContext = {
  apiVersion: string;
  deployment: string;
  endpointKind: string;
};

const defaultApiVersion = "2025-04-01-preview";
const defaultDeployment = "gpt-image-2";
const outputDirectory = path.join(process.cwd(), "outputs");

export async function POST(request: Request) {
  const validation = await readAndValidateRequest(request);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const endpoint =
    process.env.AZURE_OPENAI_ENDPOINT ?? process.env.AZURE_AI_ENDPOINT;
  const apiKey =
    process.env.AZURE_OPENAI_API_KEY ?? process.env.AZURE_AI_API_KEY;
  const deployment =
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME ?? defaultDeployment;
  const apiVersion =
    process.env.AZURE_OPENAI_API_VERSION ?? defaultApiVersion;

  if (!endpoint || !apiKey) {
    return NextResponse.json(
      {
        error:
          "缺少 Azure 配置。请设置 AZURE_OPENAI_ENDPOINT 和 AZURE_OPENAI_API_KEY。",
      },
      { status: 500 },
    );
  }

  const payload = validation.value;
  const url = buildGenerationUrl(endpoint, deployment, apiVersion);
  const endpointKind = endpoint.includes(".services.ai.azure.com")
    ? "services.ai.azure.com"
    : "openai.azure.com";
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: payload.prompt,
        n: 1,
        size: payload.size,
        quality: payload.quality,
        output_format: payload.outputFormat,
        background: payload.background,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `无法连接 Azure OpenAI：${error.message}`
            : "无法连接 Azure OpenAI。",
      },
      { status: 502 },
    );
  }

  const responseBody = (await response.json().catch(() => null)) as
    | AzureImageResponse
    | null;

  if (!response.ok || responseBody?.error) {
    const azureMessage = responseBody?.error?.message;
    const azureCode = responseBody?.error?.code;
    const deploymentNotFound =
      response.status === 404 ||
      azureCode === "DeploymentNotFound";
    return NextResponse.json(
      {
        error: deploymentNotFound
          ? `找不到 Azure OpenAI deployment：${deployment}。当前使用 ${endpointKind} endpoint，api-version=${apiVersion}。Azure 原始错误：${azureCode ?? response.status} ${azureMessage ?? ""}`
          : azureMessage ?? `生成失败，Azure 返回 HTTP ${response.status}`,
      },
      { status: response.ok ? 502 : response.status },
    );
  }

  const images = await Promise.all(
    responseBody?.data?.flatMap((item, index) =>
      item.b64_json
        ? [
            buildImageResult(item.b64_json, index, payload, {
              apiVersion,
              deployment,
              endpointKind,
            }),
          ]
        : [],
    ) ?? [],
  );

  if (images.length === 0) {
    return NextResponse.json(
      { error: "生成成功但未返回图片数据。" },
      { status: 502 },
    );
  }

  return NextResponse.json({ images });
}

function buildGenerationUrl(
  endpoint: string,
  deployment: string,
  apiVersion: string,
) {
  const normalizedEndpoint = endpoint.endsWith("/")
    ? endpoint
    : `${endpoint}/`;

  return `${normalizedEndpoint}openai/deployments/${encodeURIComponent(
    deployment,
  )}/images/generations?api-version=${encodeURIComponent(apiVersion)}`;
}

async function buildImageResult(
  b64Json: string,
  index: number,
  payload: GenerateImageRequest,
  context: GenerationContext,
) {
  await mkdir(outputDirectory, { recursive: true });

  const timestamp = Date.now();
  const id = `${formatDateForFileName(new Date(timestamp))}-${timestamp}-${index}`;
  const fileName = `${id}.${payload.outputFormat}`;
  const metadataFileName = `${id}.json`;
  const diskPath = path.join(outputDirectory, fileName);
  const metadataPath = path.join(outputDirectory, metadataFileName);
  const outputUrl = `/api/outputs/${encodeURIComponent(fileName)}`;
  const imageBuffer = Buffer.from(b64Json, "base64");
  const createdAt = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());

  await writeFile(diskPath, imageBuffer);

  const result = {
    id,
    prompt: payload.prompt,
    imageUrl: outputUrl,
    filePath: diskPath,
    metadataPath,
    size: payload.size,
    quality: payload.quality,
    outputFormat: payload.outputFormat,
    background: payload.background,
    createdAt,
  };

  await writeFile(
    metadataPath,
    `${JSON.stringify(
      {
        ...result,
        request: {
          prompt: payload.prompt,
          size: payload.size,
          quality: payload.quality,
          outputFormat: payload.outputFormat,
          background: payload.background,
        },
        provider: context,
      },
      null,
      2,
    )}\n`,
  );

  return result;
}

async function readAndValidateRequest(request: Request): Promise<
  | { ok: true; value: GenerateImageRequest }
  | { ok: false; error: string }
> {
  const body = (await request.json().catch(() => null)) as Partial<
    GenerateImageRequest
  > | null;

  if (!body || typeof body.prompt !== "string") {
    return { ok: false, error: "请输入有效的 prompt。" };
  }

  const prompt = body.prompt.trim();

  if (prompt.length < 2) {
    return { ok: false, error: "Prompt 至少需要 2 个字符。" };
  }

  if (prompt.length > 4000) {
    return { ok: false, error: "Prompt 不能超过 4000 个字符。" };
  }

  const size = pickOption(body.size, imageSizes, "1024x1024");
  const quality = pickOption(body.quality, imageQualities, "medium");
  const outputFormat = pickOption(body.outputFormat, imageFormats, "png");
  const background = pickOption(body.background, backgroundModes, "auto");

  if (background === "transparent" && outputFormat !== "png") {
    return { ok: false, error: "透明背景只支持 PNG 输出。" };
  }

  return {
    ok: true,
    value: {
      prompt,
      size,
      quality,
      outputFormat,
      background,
    },
  };
}

function pickOption<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
) {
  return options.includes(value as T) ? (value as T) : fallback;
}

function formatDateForFileName(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
