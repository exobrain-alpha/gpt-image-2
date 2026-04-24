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
  generationSeconds: number;
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
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const isGeneratingRef = useRef(false);
  const isAutoGeneratingRef = useRef(false);
  const isAutoLoopRunningRef = useRef(false);
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
    if (!isGenerating) {
      return;
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setGenerationSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isGenerating]);

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

  const runGeneration = useCallback(async () => {
    const { prompt: currentPrompt, size, quality, outputFormat } = requestRef.current;
    const normalized = currentPrompt.trim();

    if (!normalized || isGeneratingRef.current) {
      return;
    }

    isGeneratingRef.current = true;
    setGenerationSeconds(0);
    setIsGenerating(true);
    setError(null);

    try {
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
        | { error?: string };

      if (!response.ok || !("images" in data)) {
        const message = "error" in data ? data.error : undefined;

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
    }
  }, []);

  const generateImage = useCallback(async () => {
    await runGeneration();
  }, [runGeneration]);

  const runAutoGeneration = useCallback(async () => {
    if (isAutoLoopRunningRef.current) {
      return;
    }

    isAutoLoopRunningRef.current = true;

    while (isAutoGeneratingRef.current) {
      await runGeneration();

      if (isAutoGeneratingRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 300));
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
      generationSeconds,
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
      generationSeconds,
      history,
      isAutoGenerating,
      isGenerating,
      outputFormat,
      prompt,
      quality,
      referenceImage,
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
