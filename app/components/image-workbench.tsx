"use client";

import { useEffect, useState } from "react";
import {
  backgroundModes,
  imageFormats,
  imageQualities,
  imageSizes,
  type BackgroundMode,
  type GeneratedImageResult,
  type ImageFormat,
  type ImageQuality,
  type ImageSize,
} from "@/lib/image-options";
import Image from "next/image";
import { ImageProvider, useImageState } from "./image-state";

export function ImageWorkbench() {
  return (
    <ImageProvider>
      <main className="min-h-screen bg-stone-50 text-zinc-950">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
          <div className="grid items-stretch gap-6 lg:grid-cols-2">
            <PromptPanel />
            <PreviewPanel />
          </div>
          <HistoryPanel />
        </div>
        <BackToTopButton />
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
    background,
    setBackground,
    tags,
    applyTag,
    generateImage,
    isGenerating,
    error,
  } = useImageState();

  return (
    <section
      aria-labelledby="prompt-title"
      className="flex min-h-[560px] flex-col justify-between rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-medium text-teal-700">
            Microsoft Foundry GPT-Image-2
          </p>
          <h1 id="prompt-title" className="mt-2 text-3xl font-semibold">
            本地文生图工作台
          </h1>
        </div>

        <label
          htmlFor="prompt"
          className="text-sm font-semibold text-zinc-700"
        >
          Prompt 输入框
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="描述画面主体、风格、构图、光线和材质..."
          className="min-h-52 resize-y rounded-md border border-zinc-300 bg-zinc-50 p-4 text-base leading-7 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-100"
        />

        <GenerationOptions
          size={size}
          setSize={setSize}
          quality={quality}
          setQuality={setQuality}
          outputFormat={outputFormat}
          setOutputFormat={setOutputFormat}
          background={background}
          setBackground={setBackground}
        />
      </div>

      <div className="mt-6 flex flex-col gap-5">
        <section aria-labelledby="tags-title">
          <h2 id="tags-title" className="text-sm font-semibold text-zinc-700">
            常用词或短语标签列表
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => applyTag(tag)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-teal-600 hover:text-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-100"
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={generateImage}
          disabled={isGenerating || prompt.trim().length < 2}
          className="inline-flex h-12 items-center justify-center rounded-md bg-zinc-950 px-5 text-base font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-200 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-600"
        >
          {isGenerating ? "生成中..." : "生成图片"}
        </button>
      </div>
    </section>
  );
}

function GenerationOptions({
  size,
  setSize,
  quality,
  setQuality,
  outputFormat,
  setOutputFormat,
  background,
  setBackground,
}: {
  size: ImageSize;
  setSize: (value: ImageSize) => void;
  quality: ImageQuality;
  setQuality: (value: ImageQuality) => void;
  outputFormat: ImageFormat;
  setOutputFormat: (value: ImageFormat) => void;
  background: BackgroundMode;
  setBackground: (value: BackgroundMode) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SelectField
        id="size"
        label="尺寸"
        value={size}
        options={imageSizes}
        onChange={setSize}
      />
      <SelectField
        id="quality"
        label="质量"
        value={quality}
        options={imageQualities}
        onChange={setQuality}
      />
      <SelectField
        id="output-format"
        label="格式"
        value={outputFormat}
        options={imageFormats}
        onChange={(value) => {
          setOutputFormat(value);

          if (value === "jpeg" && background === "transparent") {
            setBackground("auto");
          }
        }}
      />
      <SelectField
        id="background"
        label="背景"
        value={background}
        options={backgroundModes}
        onChange={setBackground}
        disabledOptions={outputFormat === "jpeg" ? ["transparent"] : []}
      />
    </div>
  );
}

function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  disabledOptions = [],
}: {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  disabledOptions?: T[];
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-2 text-sm font-semibold">
      {label}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
      >
        {options.map((option) => (
          <option
            key={option}
            value={option}
            disabled={disabledOptions.includes(option)}
          >
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function PreviewPanel() {
  const { activeResult, isGenerating } = useImageState();

  return (
    <section
      aria-labelledby="preview-title"
      className="flex min-h-[560px] flex-col rounded-lg border border-zinc-200 bg-zinc-950 p-5 text-white shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-200">生成结果预览区</p>
          <h2 id="preview-title" className="mt-2 text-2xl font-semibold">
            当前预览
          </h2>
        </div>
        {activeResult ? (
          <span className="rounded-md border border-white/15 px-3 py-1 text-sm text-zinc-200">
            {activeResult.size}
          </span>
        ) : null}
      </div>

      <div className="mt-6 flex flex-1 overflow-hidden rounded-lg border border-white/10 bg-black">
        {activeResult ? (
          <PreviewImage result={activeResult} />
        ) : (
          <EmptyPreview isGenerating={isGenerating} />
        )}
      </div>
    </section>
  );
}

function EmptyPreview({ isGenerating }: { isGenerating: boolean }) {
  return (
    <div className="grid flex-1 place-items-center p-6 text-center text-zinc-300">
      <div>
        <p className="text-lg font-semibold">
          {isGenerating ? "正在生成图片" : "还没有生成结果"}
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          输入 prompt 并点击生成后，图片会显示在这里。
        </p>
      </div>
    </div>
  );
}

function PreviewImage({ result }: { result: GeneratedImageResult }) {
  const { width, height } = getImageDimensions(result.size);

  return (
    <article className="flex flex-1 flex-col">
      <div className="grid min-h-[380px] flex-1 place-items-center bg-zinc-900 p-4">
        <Image
          src={result.imageUrl}
          alt={result.prompt}
          width={width}
          height={height}
          unoptimized
          className="max-h-[70vh] max-w-full rounded-md object-contain"
        />
      </div>
      <div className="border-t border-white/10 p-4">
        <p className="text-sm font-medium text-teal-200">{result.createdAt}</p>
        <p className="mt-2 text-base leading-7 text-zinc-100">{result.prompt}</p>
        <p className="mt-3 break-all rounded-md bg-white/10 px-3 py-2 text-xs leading-5 text-zinc-300">
          已保存：{result.filePath}
        </p>
      </div>
    </article>
  );
}

function HistoryPanel() {
  const { history, selectResult, clearHistory } = useImageState();

  return (
    <section aria-labelledby="history-title">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-700">历史生成结果列表</p>
          <h2 id="history-title" className="mt-1 text-2xl font-semibold">
            历史结果
          </h2>
        </div>
        {history.length > 0 ? (
          <button
            type="button"
            onClick={clearHistory}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-red-500 hover:text-red-600 focus:outline-none focus:ring-4 focus:ring-red-100"
          >
            清空
          </button>
        ) : null}
      </div>

      {history.length > 0 ? (
        <div className="masonry">
          {history.map((result) => (
            <HistoryItem
              key={result.id}
              result={result}
              selectResult={selectResult}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-600">
          生成后的图片会保存在这里，页面使用 body 滚动。
        </div>
      )}
    </section>
  );
}

function HistoryItem({
  result,
  selectResult,
}: {
  result: GeneratedImageResult;
  selectResult: (result: GeneratedImageResult) => void;
}) {
  const { width, height } = getImageDimensions(result.size);

  return (
    <button
      type="button"
      onClick={() => selectResult(result)}
      className="masonry-item mb-4 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-500 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-teal-100"
    >
      <span className="block bg-zinc-100 p-2">
        <Image
          src={result.imageUrl}
          alt=""
          width={width}
          height={height}
          unoptimized
          className="h-auto w-full rounded-md object-cover"
        />
      </span>
      <span className="block p-4">
        <span className="block text-sm font-medium text-teal-700">
          {result.createdAt} / {result.size}
        </span>
        <span className="mt-1 block break-all text-xs leading-5 text-zinc-500">
          {result.imageUrl}
        </span>
        <span className="mt-2 block text-base font-semibold leading-7 text-zinc-900">
          {result.prompt}
        </span>
      </span>
    </button>
  );
}

function BackToTopButton() {
  const [visible] = useStateFromScroll();

  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label="返回顶部"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-5 right-5 z-10 grid h-12 w-12 place-items-center rounded-md bg-zinc-950 text-xl font-bold text-white shadow-lg transition hover:bg-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-200"
    >
      ↑
    </button>
  );
}

function useStateFromScroll() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > 24);

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });

    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  return [visible, setVisible] as const;
}

function getImageDimensions(size: ImageSize) {
  const [width, height] = size.split("x").map(Number);

  return { width, height };
}
