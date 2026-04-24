"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  imageFormats,
  imageQualities,
  imageSizes,
  type GeneratedImageResult,
  type ImageQuality,
  type ImageSize,
} from "@/lib/image-options";
import { ImageProvider, useImageState } from "./image-state";

export function ImageWorkbench() {
  return (
    <ImageProvider>
      <main className="min-h-screen bg-white text-zinc-950">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-5 py-8 sm:px-8 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <PromptPanel />
            <PreviewPanel />
          </div>
          <HistoryPanel />
        </div>
      </main>
    </ImageProvider>
  );
}

function PromptPanel() {
  const {
    prompt,
    setPrompt,
    size,
    setSize,
    quality,
    setQuality,
    outputFormat,
    setOutputFormat,
    referenceImage,
    setReferenceImage,
    tags,
    activeTags,
    applyTag,
    addTag,
    generateImage,
    isGenerating,
    error,
  } = useImageState();
  const [newTag, setNewTag] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-3xl font-semibold tracking-normal text-zinc-950">
        Microsoft Foundry GPT-Image-2
      </h1>

      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Prompt"
        className="min-h-56 resize-y rounded-xl border border-zinc-200 bg-white p-4 text-base leading-7 shadow-[0_18px_55px_rgba(24,24,27,0.08)] outline-none transition focus:border-zinc-950 focus:shadow-[0_22px_70px_rgba(24,24,27,0.12)]"
      />

      <div className="flex flex-wrap gap-2">
        {imageSizes.map((nextSize) => (
          <TagButton
            key={nextSize}
            active={size === nextSize}
            onClick={() => setSize(nextSize)}
          >
            {formatSizeLabel(nextSize)}
          </TagButton>
        ))}
        {imageQualities.map((nextQuality) => (
          <TagButton
            key={nextQuality}
            active={quality === nextQuality}
            onClick={() => setQuality(nextQuality)}
          >
            {qualityLabel(nextQuality)}
          </TagButton>
        ))}
        {imageFormats.map((format) => (
          <TagButton
            key={format}
            active={outputFormat === format}
            onClick={() => setOutputFormat(format)}
          >
            {format.toUpperCase()}
          </TagButton>
        ))}
        {tags.map((tag) => (
          <TagButton
            key={tag}
            active={activeTags.includes(tag)}
            onClick={() => applyTag(tag)}
          >
            {tag}
          </TagButton>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          addTag(newTag)
            .then(() => setNewTag(""))
            .catch(() => setNewTag(""));
        }}
      >
        <input
          value={newTag}
          onChange={(event) => setNewTag(event.target.value)}
          placeholder="新增常用词"
          className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm shadow-[0_10px_28px_rgba(24,24,27,0.06)] outline-none transition focus:border-zinc-950 focus:shadow-[0_14px_38px_rgba(24,24,27,0.10)]"
        />
        <button
          type="submit"
          className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white shadow-[0_14px_34px_rgba(24,24,27,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(24,24,27,0.22)] disabled:translate-y-0 disabled:bg-zinc-300 disabled:shadow-none"
          disabled={!newTag.trim()}
        >
          添加
        </button>
      </form>

      <div className="flex flex-col gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (!file) {
              return;
            }

            setReferenceImage(URL.createObjectURL(file));
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-fit rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium shadow-[0_10px_28px_rgba(24,24,27,0.06)] transition hover:-translate-y-0.5 hover:border-zinc-950 hover:shadow-[0_16px_36px_rgba(24,24,27,0.10)]"
        >
          选择参考图
        </button>
        {referenceImage ? (
          <button
            type="button"
            onClick={() => setReferenceImage(null)}
            className="w-fit"
            aria-label="移除参考图"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={referenceImage}
              alt=""
              className="max-h-48 max-w-full object-contain shadow-[0_18px_48px_rgba(24,24,27,0.12)]"
            />
          </button>
        ) : (
          <div className="grid min-h-28 place-items-center text-sm text-zinc-400">
            暂无参考图
          </div>
        )}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="button"
        onClick={generateImage}
        disabled={isGenerating || prompt.trim().length < 2}
        className="h-12 rounded-xl bg-zinc-950 px-5 text-base font-semibold text-white shadow-[0_18px_46px_rgba(24,24,27,0.22)] transition hover:-translate-y-0.5 hover:bg-zinc-800 hover:shadow-[0_24px_58px_rgba(24,24,27,0.26)] disabled:translate-y-0 disabled:bg-zinc-300 disabled:text-zinc-600 disabled:shadow-none"
      >
        {isGenerating ? "生成中..." : "生成图片"}
      </button>
    </section>
  );
}

function TagButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "border-zinc-950 bg-zinc-950 text-white shadow-[0_14px_32px_rgba(24,24,27,0.18)]"
          : "border-zinc-200 bg-white text-zinc-700 shadow-[0_8px_22px_rgba(24,24,27,0.05)] hover:-translate-y-0.5 hover:border-zinc-950 hover:shadow-[0_14px_32px_rgba(24,24,27,0.10)]"
      }`}
    >
      {children}
    </button>
  );
}

function PreviewPanel() {
  const { activeResult, isGenerating } = useImageState();

  return (
    <section className="grid min-h-[420px] place-items-center lg:min-h-[620px]">
      {activeResult ? (
        <PreviewImage result={activeResult} />
      ) : (
        <p className="text-sm text-zinc-400">
          {isGenerating ? "生成中..." : "暂无图片"}
        </p>
      )}
    </section>
  );
}

function PreviewImage({ result }: { result: GeneratedImageResult }) {
  const { width, height } = getImageDimensions(result.size);

  return (
    <Image
      src={result.imageUrl}
      alt={result.prompt}
      width={width}
      height={height}
      unoptimized
      priority
      className="max-h-[72vh] max-w-full object-contain shadow-[0_28px_80px_rgba(24,24,27,0.16)]"
    />
  );
}

function HistoryPanel() {
  const { history, selectResult, clearHistory } = useImageState();
  const [columns, setColumns] = useState(1);
  const [lightboxResult, setLightboxResult] =
    useState<GeneratedImageResult | null>(null);
  const distributedHistory = useMemo(
    () => distributeHistory(history, columns),
    [columns, history],
  );

  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;

      if (width >= 1280) {
        setColumns(4);
      } else if (width >= 900) {
        setColumns(3);
      } else if (width >= 560) {
        setColumns(2);
      } else {
        setColumns(1);
      }
    };

    updateColumns();
    window.addEventListener("resize", updateColumns);

    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  if (history.length === 0) {
    return <section className="min-h-36" />;
  }

  return (
    <section>
      <div
        className="grid items-start gap-1.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {distributedHistory.map((column, columnIndex) => (
          <div key={columnIndex} className="flex flex-col gap-1.5">
            {column.map((result) => (
              <HistoryItem
                key={result.id}
                result={result}
                onClick={() => {
                  selectResult(result);
                  setLightboxResult(result);
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={clearHistory}
        className="mt-6 text-sm font-medium text-zinc-500 transition hover:text-zinc-950"
      >
        清空
      </button>
      {lightboxResult ? (
        <Lightbox
          result={lightboxResult}
          onClose={() => setLightboxResult(null)}
        />
      ) : null}
    </section>
  );
}

function HistoryItem({
  result,
  onClick,
}: {
  result: GeneratedImageResult;
  onClick: () => void;
}) {
  const { width, height } = getImageDimensions(result.size);

  return (
    <button type="button" onClick={onClick} className="block w-full">
      <Image
        src={result.imageUrl}
        alt=""
        width={width}
        height={height}
        unoptimized
        className="h-auto w-full object-cover shadow-[0_16px_42px_rgba(24,24,27,0.10)] transition hover:-translate-y-1 hover:shadow-[0_24px_58px_rgba(24,24,27,0.16)]"
      />
    </button>
  );
}

function Lightbox({
  result,
  onClose,
}: {
  result: GeneratedImageResult;
  onClose: () => void;
}) {
  const { width, height } = getImageDimensions(result.size);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-20 grid bg-white p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭"
        className="absolute right-5 top-5 z-10 text-3xl leading-none text-zinc-500 hover:text-zinc-950"
      >
        ×
      </button>
      <div className="grid min-h-0 place-items-center">
        <Image
          src={result.imageUrl}
          alt={result.prompt}
          width={width}
          height={height}
          unoptimized
          className="max-h-[90vh] max-w-full object-contain shadow-[0_28px_80px_rgba(24,24,27,0.16)]"
        />
      </div>
      <aside className="mt-6 flex flex-col gap-3 text-sm leading-6 text-zinc-700 lg:mt-0 lg:justify-center">
        <p className="text-base leading-7 text-zinc-950">{result.prompt}</p>
        <p>{result.size}</p>
        <p>{result.quality}</p>
        <p>{result.outputFormat}</p>
        <p>{result.createdAt}</p>
      </aside>
    </div>
  );
}

function distributeHistory(results: GeneratedImageResult[], columnCount: number) {
  const count = Math.max(1, columnCount);
  const columns = Array.from({ length: count }, () => [] as GeneratedImageResult[]);
  const heights = Array.from({ length: count }, () => 0);

  results.forEach((result) => {
    const targetIndex = heights.indexOf(Math.min(...heights));
    const { width, height } = getImageDimensions(result.size);

    columns[targetIndex].push(result);
    heights[targetIndex] += height / width;
  });

  return columns;
}

function getImageDimensions(size: ImageSize) {
  const [width, height] = size.split("x").map(Number);

  return { width, height };
}

function formatSizeLabel(size: ImageSize) {
  return size.replace("x", " x ");
}

function qualityLabel(quality: ImageQuality) {
  const labels: Record<ImageQuality, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
  };

  return labels[quality];
}
