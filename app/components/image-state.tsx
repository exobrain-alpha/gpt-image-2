"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
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
  activeResult: GeneratedImageResult | null;
  history: GeneratedImageResult[];
  tags: string[];
  isGenerating: boolean;
  error: string | null;
  setPrompt: (value: string) => void;
  setSize: (value: ImageSize) => void;
  setQuality: (value: ImageQuality) => void;
  setOutputFormat: (value: ImageFormat) => void;
  setBackground: (value: BackgroundMode) => void;
  applyTag: (tag: string) => void;
  generateImage: () => Promise<void>;
  selectResult: (result: GeneratedImageResult) => void;
  clearHistory: () => void;
};

const ImageContext = createContext<ImageContextValue | null>(null);

const tagList = [
  "电影感",
  "产品摄影",
  "浅景深",
  "暖色灯光",
  "极简构图",
  "赛博朋克",
  "水彩插画",
  "真实质感",
];

export function ImageProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<ImageSize>("1024x1024");
  const [quality, setQuality] = useState<ImageQuality>("medium");
  const [outputFormat, setOutputFormat] = useState<ImageFormat>("png");
  const [background, setBackground] = useState<BackgroundMode>("auto");
  const [history, setHistory] = useState<GeneratedImageResult[]>([]);
  const [activeResult, setActiveResult] =
    useState<GeneratedImageResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyTag = useCallback((tag: string) => {
    setPrompt((current) => {
      const normalized = current.trim();

      if (!normalized) {
        return tag;
      }

      if (normalized.includes(tag)) {
        return current;
      }

      return `${normalized}，${tag}`;
    });
  }, []);

  const generateImage = useCallback(async () => {
    const normalized = prompt.trim();

    if (!normalized || isGenerating) {
      return;
    }

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
          background,
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
      setIsGenerating(false);
    }
  }, [background, isGenerating, outputFormat, prompt, quality, size]);

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
      activeResult,
      history,
      tags: tagList,
      isGenerating,
      error,
      setPrompt,
      setSize,
      setQuality,
      setOutputFormat,
      setBackground,
      applyTag,
      generateImage,
      selectResult: setActiveResult,
      clearHistory,
    }),
    [
      activeResult,
      applyTag,
      background,
      clearHistory,
      error,
      generateImage,
      history,
      isGenerating,
      outputFormat,
      prompt,
      quality,
      size,
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
