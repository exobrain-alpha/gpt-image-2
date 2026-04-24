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
      <main className="app-surface">
        <div className="workbench-shell">
          <div className="workbench-grid">
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
    deleteTag,
    generateImage,
    startAutoGeneration,
    stopAutoGeneration,
    isGenerating,
    isAutoGenerating,
    error,
  } = useImageState();
  const [newTag, setNewTag] = useState("");
  const [isDraggingReference, setIsDraggingReference] = useState(false);
  const [tagPendingDelete, setTagPendingDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const applyReferenceFile = (file: File | undefined) => {
    if (!file?.type.startsWith("image/")) {
      return;
    }

    setReferenceImage(URL.createObjectURL(file));
  };

  return (
    <section className="prompt-zone">
      <h1 className="product-title">
        GPT-Image-2
      </h1>

      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Prompt"
        className="prompt-input"
      />

      <div className="tag-cloud">
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
          <DeletableTag
            key={tag}
            active={activeTags.includes(tag)}
            onClick={() => applyTag(tag)}
            onDelete={() => setTagPendingDelete(tag)}
          >
            {tag}
          </DeletableTag>
        ))}
      </div>

      <form
        className="tag-form"
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
          className="tag-input"
        />
        <button
          type="submit"
          className="small-command"
          disabled={!newTag.trim()}
        >
          添加
        </button>
      </form>

      <div className="reference-zone">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            applyReferenceFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDraggingReference(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setIsDraggingReference(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDraggingReference(false);
            applyReferenceFile(event.dataTransfer.files[0]);
          }}
          className={`reference-dropzone ${
            isDraggingReference ? "reference-dropzone-active" : ""
          }`}
        >
          {referenceImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={referenceImage} alt="" className="reference-image" />
          ) : (
            <span className="reference-empty">拖入参考图或点击选择</span>
          )}
        </button>
        {referenceImage ? (
          <button
            type="button"
            onClick={() => setReferenceImage(null)}
            className="reference-remove"
          >
            移除参考图
          </button>
        ) : null}
      </div>

      {tagPendingDelete ? (
        <ConfirmDialog
          title="删除标签"
          message={`删除「${tagPendingDelete}」？`}
          confirmText="删除"
          cancelText="取消"
          onCancel={() => setTagPendingDelete(null)}
          onConfirm={() => {
            void deleteTag(tagPendingDelete);
            setTagPendingDelete(null);
          }}
        />
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      <div className="generation-actions">
        <button
          type="button"
          onClick={generateImage}
          disabled={isGenerating || prompt.trim().length < 2}
          className="generate-command"
        >
          {isGenerating ? "生成中..." : "生成图片"}
        </button>
        {isAutoGenerating ? (
          <button
            type="button"
            onClick={stopAutoGeneration}
            className="stop-command"
          >
            停止
          </button>
        ) : (
          <button
            type="button"
            onClick={startAutoGeneration}
            disabled={isGenerating || prompt.trim().length < 2}
            className="auto-command"
          >
            持续生成
          </button>
        )}
      </div>
    </section>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="confirm-layer" role="presentation" onClick={onCancel}>
      <section
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        <div className="confirm-actions">
          <button type="button" className="confirm-cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button type="button" className="confirm-danger" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </section>
    </div>
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
      className={`tag-button ${active ? "tag-button-active" : ""}`}
    >
      {children}
    </button>
  );
}

function DeletableTag({
  active,
  canDelete = true,
  onClick,
  onDelete,
  children,
}: {
  active: boolean;
  canDelete?: boolean;
  onClick: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  if (!canDelete) {
    return (
      <TagButton active={active} onClick={onClick}>
        {children}
      </TagButton>
    );
  }

  return (
    <span className={`tag-pill ${active ? "tag-pill-active" : ""}`}>
      <button type="button" onClick={onClick} className="tag-pill-main">
        {children}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="tag-pill-delete"
        aria-label="删除"
      >
        ×
      </button>
    </span>
  );
}

function PreviewPanel() {
  const {
    activeResult,
    isGenerating,
    generationPhase,
    generationSeconds,
    rateLimitWaitSeconds,
  } = useImageState();

  return (
    <section className="preview-zone">
      {activeResult ? (
        <div className="preview-stack">
          <PreviewImage result={activeResult} />
          <PreviewStatus
            generationPhase={generationPhase}
            generationSeconds={generationSeconds}
            rateLimitWaitSeconds={rateLimitWaitSeconds}
          />
        </div>
      ) : (
        <PreviewStatus
          isEmpty
          isGenerating={isGenerating}
          generationPhase={generationPhase}
          generationSeconds={generationSeconds}
          rateLimitWaitSeconds={rateLimitWaitSeconds}
        />
      )}
    </section>
  );
}

function PreviewStatus({
  isEmpty = false,
  isGenerating = false,
  generationPhase,
  generationSeconds,
  rateLimitWaitSeconds,
}: {
  isEmpty?: boolean;
  isGenerating?: boolean;
  generationPhase: "idle" | "waiting" | "generating";
  generationSeconds: number;
  rateLimitWaitSeconds: number;
}) {
  if (generationPhase === "waiting") {
    return (
      <p className={isEmpty ? "preview-empty" : "preview-status"}>
        <span>等待请求窗口</span>
        <span>{formatSeconds(rateLimitWaitSeconds)}</span>
        <span>官方限制为 2 RPM，请求按约 30 秒间隔发送。</span>
      </p>
    );
  }

  if (generationPhase === "generating") {
    return (
      <p className={isEmpty ? "preview-empty" : "preview-status"}>
        <span>生成中...</span>
        <span>{formatSeconds(generationSeconds)}</span>
      </p>
    );
  }

  if (!isEmpty) {
    return null;
  }

  return (
    <p className="preview-empty">
      <span>{isGenerating ? "生成中..." : "暂无图片"}</span>
    </p>
  );
}

function PreviewImage({ result }: { result: GeneratedImageResult }) {
  const { width, height } = getImageDimensions(result.size);

  if (result.status === "blocked") {
    return null;
  }

  return (
    <Image
      src={result.imageUrl}
      alt={result.prompt}
      width={width}
      height={height}
      unoptimized
      priority
      className="preview-image"
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
        className="history-grid"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {distributedHistory.map((column, columnIndex) => (
          <div key={columnIndex} className="history-column">
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
        className="clear-history"
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
    <button type="button" onClick={onClick} className="history-item">
      {result.status === "blocked" ? (
        <span className="history-blocked" style={{ aspectRatio: `${width} / ${height}` }}>
          请求被内容安全策略拦截屏蔽
        </span>
      ) : (
        <Image
          src={result.imageUrl}
          alt=""
          width={width}
          height={height}
          unoptimized
          className="history-image"
        />
      )}
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
    <div className="lightbox">
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭"
        className="lightbox-close"
      >
        ×
      </button>
      <div className="lightbox-layout">
        <div className="lightbox-image-wrap">
          {result.status === "blocked" ? (
            <div className="lightbox-blocked" style={{ aspectRatio: `${width} / ${height}` }}>
              <span>已屏蔽</span>
              <span>{result.errorMessage ?? "内容安全策略未允许生成这张图片。"}</span>
            </div>
          ) : (
            <Image
              src={result.imageUrl}
              alt={result.prompt}
              width={width}
              height={height}
              unoptimized
              className="lightbox-image"
            />
          )}
        </div>
        <aside className="lightbox-meta">
          {result.status === "blocked" ? (
            <p className="lightbox-error">
              {result.errorMessage ?? "内容安全策略未允许生成这张图片。"}
            </p>
          ) : null}
          <p className="lightbox-prompt">
            {result.prompt}
          </p>
          <div className="lightbox-facts">
            <span>{formatSizeLabel(result.size)}</span>
            <span>{result.quality}</span>
            <span>{result.outputFormat}</span>
            <span>{result.createdAt}</span>
            {result.errorCode ? <span>{result.errorCode}</span> : null}
          </div>
        </aside>
      </div>
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


function formatSeconds(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function qualityLabel(quality: ImageQuality) {
  const labels: Record<ImageQuality, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
  };

  return labels[quality];
}
