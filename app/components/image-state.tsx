"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type BackgroundMode,
  type GeneratedImageResult,
  type GenerateImageResponse,
  type ImageFormat,
  type ImageQuality,
  type ImageSize,
} from "@/lib/image-options";

type GenerateImageErrorResponse = {
  error?: string;
  code?: string;
  type?: string;
  innerCode?: string;
};

type ImageContextValue = {
  prompt: string;
  size: ImageSize;
  quality: ImageQuality;
  outputFormat: ImageFormat;
  background: BackgroundMode;
  referenceImage: string | null;
  activeResult: GeneratedImageResult | null;
  history: GeneratedImageResult[];
  tags: string[];
  activeTags: string[];
  isGenerating: boolean;
  isAutoGenerating: boolean;
  generationPhase: "idle" | "waiting" | "generating";
  generationSeconds: number;
  rateLimitWaitSeconds: number;
  error: string | null;
  setPrompt: (value: string) => void;
  setSize: (value: ImageSize) => void;
  setQuality: (value: ImageQuality) => void;
  setOutputFormat: (value: ImageFormat) => void;
  setBackground: (value: BackgroundMode) => void;
  setReferenceImage: (value: string | null) => void;
  applyTag: (tag: string) => void;
  addTag: (tag: string) => Promise<void>;
  generateImage: () => Promise<void>;
  startAutoGeneration: () => void;
  stopAutoGeneration: () => void;
  selectResult: (result: GeneratedImageResult) => void;
  clearHistory: () => void;
};

const ImageContext = createContext<ImageContextValue | null>(null);
const minimumRequestIntervalMs = 30_000;

export function ImageProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<ImageSize>("720x1024");
  const [quality, setQuality] = useState<ImageQuality>("medium");
  const [outputFormat, setOutputFormat] = useState<ImageFormat>("png");
  const [background, setBackground] = useState<BackgroundMode>("auto");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [history, setHistory] = useState<GeneratedImageResult[]>([]);
  const [activeResult, setActiveResult] =
    useState<GeneratedImageResult | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] =
    useState<ImageContextValue["generationPhase"]>("idle");
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const [rateLimitWaitSeconds, setRateLimitWaitSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const isGeneratingRef = useRef(false);
  const isAutoGeneratingRef = useRef(false);
  const isAutoLoopRunningRef = useRef(false);
  const lastRequestStartedAtRef = useRef(0);
  const requestRef = useRef({
    prompt,
    size,
    quality,
    outputFormat,
  });

  useEffect(() => {
    requestRef.current = {
      prompt,
      size,
      quality,
      outputFormat,
    };
  }, [outputFormat, prompt, quality, size]);

  useEffect(() => {
    if (generationPhase !== "generating") {
      return;
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setGenerationSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [generationPhase]);

  useEffect(() => {
    let isMounted = true;

    fetch("/api/tags")
      .then((response) => response.json())
      .then((data: { tags?: string[] }) => {
        if (isMounted && Array.isArray(data.tags)) {
          setTags(data.tags);
        }
      })
      .catch(() => {
        if (isMounted) {
          setTags([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const applyTag = useCallback((tag: string) => {
    const isActive = activeTags.includes(tag);

    setActiveTags((current) =>
      isActive
        ? current.filter((activeTag) => activeTag !== tag)
        : [...current, tag],
    );
    setPrompt((current) => {
      const normalized = current.trim();

      if (isActive) {
        return normalized
          .split("，")
          .map((part) => part.trim())
          .filter((part) => part && part !== tag)
          .join("，");
      }

      if (!normalized) {
        return tag;
      }

      if (normalized.includes(tag)) {
        return current;
      }

      return `${normalized}，${tag}`;
    });
  }, [activeTags]);

  const addTag = useCallback(async (tag: string) => {
    const normalized = tag.trim();

    if (!normalized) {
      return;
    }

    const response = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag: normalized }),
    });
    const data = (await response.json()) as { tags?: string[]; error?: string };

    if (!response.ok || !Array.isArray(data.tags)) {
      throw new Error(data.error ?? "保存常用词失败。");
    }

    setTags(data.tags);
    setActiveTags((current) =>
      current.includes(normalized) ? current : [...current, normalized],
    );
    setPrompt((current) => {
      const normalizedPrompt = current.trim();

      if (!normalizedPrompt) {
        return normalized;
      }

      if (normalizedPrompt.includes(normalized)) {
        return current;
      }

      return `${normalizedPrompt}，${normalized}`;
    });
  }, []);

  const waitForRateLimit = useCallback(async (cancelWhenStopped: boolean) => {
    const elapsed = Date.now() - lastRequestStartedAtRef.current;
    let remaining = Math.max(0, minimumRequestIntervalMs - elapsed);

    if (remaining <= 0) {
      return true;
    }

    setGenerationPhase("waiting");

    while (remaining > 0) {
      if (cancelWhenStopped && !isAutoGeneratingRef.current) {
        setRateLimitWaitSeconds(0);
        return false;
      }

      setRateLimitWaitSeconds(Math.ceil(remaining / 1000));
      await new Promise((resolve) => setTimeout(resolve, Math.min(250, remaining)));
      remaining = Math.max(
        0,
        minimumRequestIntervalMs - (Date.now() - lastRequestStartedAtRef.current),
      );
    }

    setRateLimitWaitSeconds(0);

    return true;
  }, []);

  const runGeneration = useCallback(async (cancelWhenStopped = false) => {
    if (isGeneratingRef.current) {
      return;
    }

    isGeneratingRef.current = true;
    setGenerationSeconds(0);
    setRateLimitWaitSeconds(0);
    setIsGenerating(true);
    setError(null);

    try {
      const canContinue = await waitForRateLimit(cancelWhenStopped);

      if (!canContinue) {
        return;
      }

      const {
        prompt: currentPrompt,
        size,
        quality,
        outputFormat,
      } = requestRef.current;
      const normalized = currentPrompt.trim();

      if (!normalized) {
        return;
      }

      setGenerationPhase("generating");
      setGenerationSeconds(0);
      lastRequestStartedAtRef.current = Date.now();

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: normalized,
          size,
          quality,
          outputFormat,
        }),
      });
      const data = (await response.json()) as
        | GenerateImageResponse
        | GenerateImageErrorResponse;

      if (!response.ok || !("images" in data)) {
        const message = "error" in data ? data.error : undefined;
        const failure = "images" in data ? null : data;

        if (isContentSafetyFailure(failure)) {
          const blockedResult = buildBlockedResult({
            prompt: normalized,
            size,
            quality,
            outputFormat,
            message: message ?? "这次请求被内容安全策略拦截。",
            code: failure?.innerCode ?? failure?.code,
          });

          setHistory((current) => [blockedResult, ...current].slice(0, 20));
        }

        throw new Error(message ?? "生成失败，请稍后重试。");
      }

      const nextResult = data.images[0];

      if (!nextResult) {
        throw new Error("生成成功但未返回图片。");
      }

      setActiveResult(nextResult);
      setHistory((current) => [nextResult, ...current].slice(0, 20));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成失败。");
    } finally {
      isGeneratingRef.current = false;
      setIsGenerating(false);
      setGenerationPhase("idle");
      setRateLimitWaitSeconds(0);
    }
  }, [waitForRateLimit]);

  const generateImage = useCallback(async () => {
    await runGeneration();
  }, [runGeneration]);

  const runAutoGeneration = useCallback(async () => {
    if (isAutoLoopRunningRef.current) {
      return;
    }

    isAutoLoopRunningRef.current = true;

    while (isAutoGeneratingRef.current) {
      await runGeneration(true);

      if (isAutoGeneratingRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    isAutoLoopRunningRef.current = false;
  }, [runGeneration]);

  const startAutoGeneration = useCallback(() => {
    if (
      requestRef.current.prompt.trim().length < 2 ||
      isGeneratingRef.current
    ) {
      return;
    }

    isAutoGeneratingRef.current = true;
    setIsAutoGenerating(true);
    void runAutoGeneration();
  }, [runAutoGeneration]);

  const stopAutoGeneration = useCallback(() => {
    isAutoGeneratingRef.current = false;
    setIsAutoGenerating(false);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setActiveResult(null);
  }, []);

  const value = useMemo(
    () => ({
      prompt,
      size,
      quality,
      outputFormat,
      background,
      referenceImage,
      activeResult,
      history,
      tags,
      activeTags,
      isGenerating,
      isAutoGenerating,
      generationPhase,
      generationSeconds,
      rateLimitWaitSeconds,
      error,
      setPrompt,
      setSize,
      setQuality,
      setOutputFormat,
      setBackground,
      setReferenceImage,
      applyTag,
      addTag,
      generateImage,
      startAutoGeneration,
      stopAutoGeneration,
      selectResult: setActiveResult,
      clearHistory,
    }),
    [
      activeResult,
      activeTags,
      applyTag,
      addTag,
      background,
      clearHistory,
      error,
      generateImage,
      generationPhase,
      generationSeconds,
      history,
      isAutoGenerating,
      isGenerating,
      outputFormat,
      prompt,
      quality,
      referenceImage,
      rateLimitWaitSeconds,
      size,
      startAutoGeneration,
      stopAutoGeneration,
      tags,
    ],
  );

  return (
    <ImageContext.Provider value={value}>{children}</ImageContext.Provider>
  );
}

export function useImageState() {
  const value = useContext(ImageContext);

  if (!value) {
    throw new Error("useImageState must be used within ImageProvider");
  }

  return value;
}

function isContentSafetyFailure(error: GenerateImageErrorResponse | null) {
  const text = [
    error?.error,
    error?.code,
    error?.type,
    error?.innerCode,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("content_policy_violation") ||
    text.includes("responsibleaipolicyviolation") ||
    text.includes("content filter") ||
    text.includes("content_filter") ||
    text.includes("safety") ||
    text.includes("内容安全") ||
    text.includes("安全策略") ||
    text.includes("有害内容")
  );
}

function buildBlockedResult({
  prompt,
  size,
  quality,
  outputFormat,
  message,
  code,
}: {
  prompt: string;
  size: ImageSize;
  quality: ImageQuality;
  outputFormat: ImageFormat;
  message: string;
  code?: string;
}): GeneratedImageResult {
  return {
    id: `blocked-${Date.now()}`,
    prompt,
    imageUrl: "",
    filePath: "",
    metadataPath: "",
    size,
    quality,
    outputFormat,
    background: "auto",
    createdAt: new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date()),
    status: "blocked",
    errorMessage: message,
    errorCode: code,
  };
}
