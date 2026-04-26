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
    type?: string;
    inner_error?: {
      code?: string;
    };
  };
};

type GenerationContext = {
  apiVersion: string;
  deployment: string;
  endpointKind: string;
  operation: "generation" | "edit";
  referenceImage?: {
    fileName: string;
    contentType: string;
    size: number;
  };
};

type ReferenceImageInput = {
  file: File;
  fileName: string;
  contentType: string;
  size: number;
};

type ValidatedGenerateRequest = {
  payload: GenerateImageRequest;
  referenceImage?: ReferenceImageInput;
};

type ImageRequestInput = {
  prompt?: unknown;
  size?: unknown;
  quality?: unknown;
  outputFormat?: unknown;
  background?: unknown;
};

const defaultApiVersion = "2025-04-01-preview";
const defaultDeployment = "gpt-image-2";
const outputDirectory = path.join(process.cwd(), "outputs");
const maxReferenceImageBytes = 25 * 1024 * 1024;

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

  const { payload, referenceImage } = validation.value;
  const operation = referenceImage ? "edit" : "generation";
  const url = referenceImage
    ? buildEditUrl(endpoint, deployment, apiVersion)
    : buildGenerationUrl(endpoint, deployment, apiVersion);
  const endpointKind = endpoint.includes(".services.ai.azure.com")
    ? "services.ai.azure.com"
    : "openai.azure.com";
  let response: Response;

  try {
    const azureRequest = buildAzureImageRequest(payload, apiKey, referenceImage);

    response = await fetch(url, {
      method: "POST",
      headers: azureRequest.headers,
      body: azureRequest.body,
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
    const friendlyError = getFriendlyAzureError(
      response.status,
      responseBody?.error,
      deployment,
      endpointKind,
      apiVersion,
    );
    const azureCode = responseBody?.error?.code;
    const deploymentNotFound =
      response.status === 404 ||
      azureCode === "DeploymentNotFound";

    return NextResponse.json(
      {
        error: friendlyError,
        code: responseBody?.error?.code,
        type: responseBody?.error?.type,
        innerCode: responseBody?.error?.inner_error?.code,
      },
      { status: deploymentNotFound ? 404 : response.ok ? 502 : response.status },
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
              operation,
              referenceImage: referenceImage
                ? {
                    fileName: referenceImage.fileName,
                    contentType: referenceImage.contentType,
                    size: referenceImage.size,
                  }
                : undefined,
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

function buildEditUrl(endpoint: string, deployment: string, apiVersion: string) {
  const normalizedEndpoint = endpoint.endsWith("/")
    ? endpoint
    : `${endpoint}/`;

  return `${normalizedEndpoint}openai/deployments/${encodeURIComponent(
    deployment,
  )}/images/edits?api-version=${encodeURIComponent(apiVersion)}`;
}

function buildAzureImageRequest(
  payload: GenerateImageRequest,
  apiKey: string,
  referenceImage?: ReferenceImageInput,
): { headers: HeadersInit; body: BodyInit } {
  if (referenceImage) {
    const formData = new FormData();

    formData.set("image", referenceImage.file, referenceImage.fileName);
    formData.set("prompt", payload.prompt);
    formData.set("n", "1");
    formData.set("size", payload.size);
    formData.set("quality", payload.quality);
    formData.set("output_format", payload.outputFormat);
    formData.set("background", payload.background ?? "auto");

    return {
      headers: {
        "Api-Key": apiKey,
      },
      body: formData,
    };
  }

  return {
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
  };
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
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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
        usedPrompt: payload.prompt,
        request: {
          prompt: payload.prompt,
          usedPrompt: payload.prompt,
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
  | { ok: true; value: ValidatedGenerateRequest }
  | { ok: false; error: string }
> {
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    return readAndValidateMultipartRequest(request);
  }

  const body = (await request.json().catch(() => null)) as
    | ImageRequestInput
    | null;

  const validation = validateImageRequestBody(body);

  if (!validation.ok) {
    return validation;
  }

  return {
    ok: true,
    value: {
      payload: validation.value,
    },
  };
}

async function readAndValidateMultipartRequest(request: Request): Promise<
  | { ok: true; value: ValidatedGenerateRequest }
  | { ok: false; error: string }
> {
  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return { ok: false, error: "请输入有效的表单数据。" };
  }

  const body = {
    prompt: getStringFormValue(formData, "prompt"),
    size: getStringFormValue(formData, "size"),
    quality: getStringFormValue(formData, "quality"),
    outputFormat: getStringFormValue(formData, "outputFormat"),
    background: getStringFormValue(formData, "background"),
  };
  const validation = validateImageRequestBody(body);

  if (!validation.ok) {
    return validation;
  }

  const referenceImage = formData.get("referenceImage");

  if (!isFileLike(referenceImage) || referenceImage.size === 0) {
    return { ok: false, error: "请上传有效的参考图。" };
  }

  if (!referenceImage.type.startsWith("image/")) {
    return { ok: false, error: "参考图必须是图片文件。" };
  }

  if (referenceImage.size > maxReferenceImageBytes) {
    return { ok: false, error: "参考图不能超过 25MB。" };
  }

  return {
    ok: true,
    value: {
      payload: validation.value,
      referenceImage: {
        file: referenceImage,
        fileName: referenceImage.name || "reference-image",
        contentType: referenceImage.type,
        size: referenceImage.size,
      },
    },
  };
}

function validateImageRequestBody(
  body: ImageRequestInput | null,
): { ok: true; value: GenerateImageRequest } | { ok: false; error: string } {
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

  const size = pickOption(body.size, imageSizes, "720x1024");
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

function getStringFormValue(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value : undefined;
}

function isFileLike(value: FormDataEntryValue | null): value is File {
  return value instanceof File;
}

function pickOption<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
) {
  return options.includes(value as T) ? (value as T) : fallback;
}

function getFriendlyAzureError(
  status: number,
  error: AzureImageResponse["error"],
  deployment: string,
  endpointKind: string,
  apiVersion: string,
) {
  const code = error?.code ?? "";
  const innerCode = error?.inner_error?.code ?? "";
  const message = error?.message ?? "";
  const normalized = `${code} ${innerCode} ${message}`.toLowerCase();

  if (
    status === 404 ||
    code === "DeploymentNotFound"
  ) {
    return `找不到 Azure OpenAI deployment：${deployment}。当前使用 ${endpointKind} endpoint，api-version=${apiVersion}。请检查 deployment 名称、endpoint 类型和 API 版本。`;
  }

  if (
    normalized.includes("content_policy_violation") ||
    normalized.includes("responsibleaipolicyviolation") ||
    normalized.includes("content filter") ||
    normalized.includes("content_filter") ||
    normalized.includes("safety system")
  ) {
    return "这次请求被内容安全策略拦截。请调整 prompt，避免包含可能触发安全限制、受保护人物/风格、露骨、暴力或其他敏感内容的描述后再试。";
  }

  if (status === 401 || status === 403) {
    return "Azure 鉴权失败。请检查 API Key、endpoint 和当前资源权限。";
  }

  if (status === 429) {
    return "请求过于频繁或额度暂时不足。请稍后再试，或降低持续生成频率。";
  }

  if (status >= 500) {
    return "Azure 服务暂时不可用或返回异常。请稍后重试。";
  }

  return message || `生成失败，Azure 返回 HTTP ${status}`;
}

function formatDateForFileName(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
