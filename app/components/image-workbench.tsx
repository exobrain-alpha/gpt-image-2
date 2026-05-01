"use client";

import {
  ArrowUpCircleIcon,
  StopCircleIcon,
} from "@heroicons/react/24/solid";
import Image from "next/image";
import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type RefObject,
  type ReactNode,
} from "react";
import {
  buildImageSize,
  getLegalHeightsForWidth,
  getLegalWidthsForHeight,
  imageFormats,
  imageQualities,
  type GeneratedImageResult,
  type ImageQuality,
  type ImageSize,
} from "@/lib/image-options";
import { ImageProvider, useImageState } from "./image-state";

const historyDragDataType = "application/x-gpt-image-history";

type PromptAssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

type PromptAssistantDialogState = {
  initialMessage: string;
  initialDraft: string;
  autoSendInitialMessage: boolean;
  mode: "create" | "adjust";
};

export function ImageWorkbench({
  outputDirectory,
}: {
  outputDirectory: string;
}) {
  const promptPanelRef = useRef<HTMLElement | null>(null);
  const [promptPanelHeight, setPromptPanelHeight] = useState(0);

  useEffect(() => {
    const promptPanel = promptPanelRef.current;

    if (!promptPanel) {
      return;
    }

    const updatePromptPanelHeight = () => {
      setPromptPanelHeight(
        Math.ceil(promptPanel.getBoundingClientRect().height),
      );
    };
    const resizeObserver = new ResizeObserver(updatePromptPanelHeight);

    updatePromptPanelHeight();
    resizeObserver.observe(promptPanel);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <ImageProvider>
      <main className="app-surface">
        <div className="workbench-shell">
          <div className="workbench-grid">
            <PromptPanel panelRef={promptPanelRef} />
            <PreviewPanel promptPanelHeight={promptPanelHeight} />
          </div>
          <HistoryPanel outputDirectory={outputDirectory} />
        </div>
      </main>
    </ImageProvider>
  );
}

function PromptPanel({
  panelRef,
}: {
  panelRef: RefObject<HTMLElement | null>;
}) {
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
    deleteTag,
    generateImage,
    startAutoGeneration,
    stopAutoGeneration,
    isGenerating,
    isAutoGenerating,
    generationPhase,
    generationSeconds,
    rateLimitWaitSeconds,
    error,
  } = useImageState();
  const [isDraggingReference, setIsDraggingReference] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [tagPendingDelete, setTagPendingDelete] = useState<string | null>(null);
  const [assistantDialogState, setAssistantDialogState] =
    useState<PromptAssistantDialogState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { width, height } = getImageDimensions(size);
  const widthOptions = useMemo(() => getLegalWidthsForHeight(height), [height]);
  const heightOptions = useMemo(() => getLegalHeightsForWidth(width), [width]);
  const updateWidth = (nextWidth: number) => {
    const nextHeight = getClosestOption(
      getLegalHeightsForWidth(nextWidth),
      height,
    );

    setSize(buildImageSize(nextWidth, nextHeight));
  };
  const updateHeight = (nextHeight: number) => {
    const nextWidth = getClosestOption(
      getLegalWidthsForHeight(nextHeight),
      width,
    );

    setSize(buildImageSize(nextWidth, nextHeight));
  };
  const applyReferenceFile = (file: File | undefined) => {
    if (!file?.type.startsWith("image/")) {
      setReferenceError("参考图必须是图片文件。");
      return;
    }

    setReferenceError(null);
    setReferenceImage(file);
  };
  const applyReferenceDrop = async (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDraggingReference(false);

    const droppedFile = event.dataTransfer.files[0];

    if (droppedFile) {
      applyReferenceFile(droppedFile);
      return;
    }

    const draggedHistoryImage = readDraggedHistoryImage(event.dataTransfer);

    if (!draggedHistoryImage) {
      return;
    }

    try {
      const file = await fetchHistoryImageFile(draggedHistoryImage);

      applyReferenceFile(file);
    } catch {
      setReferenceError("无法读取历史图片，请稍后重试。");
    }
  };

  return (
    <section ref={panelRef} className="prompt-zone">
      <h1 className="product-title">
        GPT-Image-2
      </h1>

      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Prompt"
        className="prompt-input"
      />

      <div className="assistant-launch-row">
        <button
          type="button"
          className="assistant-command"
          onClick={() =>
            setAssistantDialogState({
              initialMessage: "",
              initialDraft: "",
              autoSendInitialMessage: false,
              mode: "create",
            })
          }
        >
          智能提示词
        </button>
        <button
          type="button"
          className="assistant-adjust-command"
          onClick={() =>
            setAssistantDialogState({
              initialMessage: "",
              initialDraft: buildPromptAdjustmentDraft(prompt),
              autoSendInitialMessage: false,
              mode: "adjust",
            })
          }
          disabled={!prompt.trim()}
        >
          调整提示词
        </button>
      </div>

      <div className="size-controls">
        <label className="dimension-field">
          <span>宽</span>
          <select
            value={width}
            onChange={(event) => updateWidth(Number(event.target.value))}
          >
            {widthOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <span className="dimension-separator">×</span>
        <label className="dimension-field">
          <span>高</span>
          <select
            value={height}
            onChange={(event) => updateHeight(Number(event.target.value))}
          >
            {heightOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <span className="size-summary">{formatSizeLabel(size)}</span>
      </div>

      <div className="format-controls">
        <div className="inline-option-group">
          {imageQualities.map((nextQuality) => (
            <TagButton
              key={nextQuality}
              active={quality === nextQuality}
              onClick={() => setQuality(nextQuality)}
            >
              {qualityLabel(nextQuality)}
            </TagButton>
          ))}
        </div>
        <div className="inline-option-group">
          {imageFormats.map((format) => (
            <TagButton
              key={format}
              active={outputFormat === format}
              onClick={() => setOutputFormat(format)}
            >
              {format.toUpperCase()}
            </TagButton>
          ))}
        </div>
      </div>

      {tags.length > 0 ? (
        <div className="tag-cloud">
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
      ) : null}

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
            void applyReferenceDrop(event);
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

      {assistantDialogState ? (
        <PromptAssistantDialog
          initialMessage={assistantDialogState.initialMessage}
          initialDraft={assistantDialogState.initialDraft}
          autoSendInitialMessage={assistantDialogState.autoSendInitialMessage}
          mode={assistantDialogState.mode}
          onCancel={() => setAssistantDialogState(null)}
          onApply={(nextPrompt) => {
            setPrompt(nextPrompt);
            setAssistantDialogState(null);
          }}
        />
      ) : null}

      {error || referenceError ? (
        <p className="error-text">{error ?? referenceError}</p>
      ) : null}

      <div className="generation-actions">
        <button
          type="button"
          onClick={generateImage}
          disabled={isGenerating || prompt.trim().length < 2}
          className="generate-command"
        >
          <GenerateButtonLabel
            generationPhase={generationPhase}
            generationSeconds={generationSeconds}
            rateLimitWaitSeconds={rateLimitWaitSeconds}
          />
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

function PromptAssistantDialog({
  initialMessage,
  initialDraft,
  autoSendInitialMessage,
  mode,
  onApply,
  onCancel,
}: {
  initialMessage: string;
  initialDraft: string;
  autoSendInitialMessage: boolean;
  mode: "create" | "adjust";
  onApply: (prompt: string) => void;
  onCancel: () => void;
}) {
  const normalizedInitialMessage = initialMessage.trim();
  const [messages, setMessages] = useState<PromptAssistantMessage[]>(
    normalizedInitialMessage
      ? [{ role: "user", content: normalizedInitialMessage }]
      : [],
  );
  const [draft, setDraft] = useState(initialDraft);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const didSendInitialMessageRef = useRef(false);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const draftInputRef = useRef<HTMLTextAreaElement | null>(null);
  const activeRequestControllerRef = useRef<AbortController | null>(null);
  const latestPrompt = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.content;
  const draftPlaceholder =
    mode === "create" && messages.length === 0
      ? "请填写提示词或主题"
      : "请输入要调整的内容或补充优化要求";

  const sendMessages = useCallback(async (nextMessages: PromptAssistantMessage[]) => {
    const abortController = new AbortController();

    activeRequestControllerRef.current = abortController;
    setIsSending(true);
    setError(null);

    try {
      const response = await fetch("/api/prompt-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
        signal: abortController.signal,
      });
      const data = (await response.json()) as {
        prompt?: string;
        error?: string;
      };

      if (!response.ok || typeof data.prompt !== "string") {
        throw new Error(data.error ?? "智能提示词生成失败。");
      }

      const assistantPrompt = data.prompt.trim();

      setMessages((current) => [
        ...current,
        { role: "assistant", content: assistantPrompt },
      ]);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setError(null);
        return;
      }

      setError(caught instanceof Error ? caught.message : "智能提示词生成失败。");
    } finally {
      if (activeRequestControllerRef.current === abortController) {
        activeRequestControllerRef.current = null;
      }

      setIsSending(false);
    }
  }, []);

  const stopSending = useCallback(() => {
    activeRequestControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (
      didSendInitialMessageRef.current ||
      !autoSendInitialMessage ||
      !normalizedInitialMessage
    ) {
      return;
    }

    didSendInitialMessageRef.current = true;
    void sendMessages([{ role: "user", content: normalizedInitialMessage }]);
  }, [autoSendInitialMessage, normalizedInitialMessage, sendMessages]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  useEffect(() => {
    draftInputRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => activeRequestControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    messageListRef.current?.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isSending]);

  useEffect(() => {
    const draftInput = draftInputRef.current;

    if (!draftInput) {
      return;
    }

    draftInput.style.height = "auto";
    draftInput.style.height = `${draftInput.scrollHeight}px`;
  }, [draft]);

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedDraft = draft.trim();

    if (!normalizedDraft || isSending) {
      return;
    }

    const nextMessages: PromptAssistantMessage[] = [
      ...messages,
      { role: "user", content: normalizedDraft },
    ];

    setMessages(nextMessages);
    setDraft("");
    void sendMessages(nextMessages);
  };

  return (
    <div className="assistant-layer" role="presentation" onClick={onCancel}>
      <section
        className="assistant-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assistant-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="assistant-header">
          <div>
            <h2 id="assistant-title">智能提示词</h2>
            <span>claude-opus-4-7</span>
          </div>
          <button
            type="button"
            className="assistant-close"
            onClick={onCancel}
            aria-label="关闭"
          >
            ×
          </button>
        </header>

        <div ref={messageListRef} className="assistant-messages">
          {messages.map((message, index) => (
            <article
              key={`${message.role}-${index}`}
              className={`assistant-message assistant-message-${message.role}`}
            >
              <span>{message.role === "assistant" ? "AI" : "你"}</span>
              <div className="assistant-message-bubble">
                <p>{message.content}</p>
                <footer className="assistant-message-actions">
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(message.content)}
                  >
                    复制
                  </button>
                  {message.role === "assistant" ? (
                    <button type="button" onClick={() => onApply(message.content)}>
                      应用
                    </button>
                  ) : null}
                </footer>
              </div>
            </article>
          ))}
          {isSending ? (
            <article className="assistant-message assistant-message-assistant">
              <span>AI</span>
              <div className="assistant-message-bubble">
                <p>生成中...</p>
              </div>
            </article>
          ) : null}
        </div>

        {error ? <p className="assistant-error">{error}</p> : null}

        <form className="assistant-input-row" onSubmit={submitMessage}>
          <div className="assistant-input-wrap">
            <textarea
              ref={draftInputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={draftPlaceholder}
              rows={1}
            />
            <footer className="assistant-input-footer">
              {isSending ? (
                <button
                  type="button"
                  onClick={stopSending}
                  aria-label="终止"
                  title="终止"
                >
                  <StopCircleIcon aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  aria-label="发送"
                  title="发送"
                >
                  <ArrowUpCircleIcon aria-hidden="true" />
                </button>
              )}
            </footer>
          </div>
        </form>

        {latestPrompt ? (
          <button
            type="button"
            className="assistant-apply-latest"
            onClick={() => onApply(latestPrompt)}
          >
            应用最新提示词
          </button>
        ) : null}
      </section>
    </div>
  );
}

function buildPromptAdjustmentDraft(prompt: string) {
  const normalized = prompt.trim();

  if (!normalized) {
    return "";
  }

  return `请基于以下提示词继续优化：\n\n${normalized}\n\n优化要求：`;
}

function GenerateButtonLabel({
  generationPhase,
  generationSeconds,
  rateLimitWaitSeconds,
}: {
  generationPhase: "idle" | "waiting" | "generating";
  generationSeconds: number;
  rateLimitWaitSeconds: number;
}) {
  if (generationPhase === "waiting") {
    return (
      <>
        <span>等待请求窗口</span>
        <span className="generate-command-timer">
          {formatSeconds(rateLimitWaitSeconds)}
        </span>
      </>
    );
  }

  if (generationPhase === "generating") {
    return (
      <>
        <span>生成中...</span>
        <span className="generate-command-timer">
          {formatSeconds(generationSeconds)}
        </span>
      </>
    );
  }

  return <span>生成图片</span>;
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

function PreviewPanel({
  promptPanelHeight,
}: {
  promptPanelHeight: number;
}) {
  const {
    activeResult,
    isGenerating,
    generationPhase,
  } = useImageState();
  const previewStyle =
    promptPanelHeight > 0
      ? ({
          "--preview-height": `${promptPanelHeight}px`,
        } as CSSProperties)
      : undefined;

  return (
    <section className="preview-zone" style={previewStyle}>
      {activeResult ? (
        <PreviewImage result={activeResult} />
      ) : (
        <PreviewStatus
          isEmpty
          isGenerating={isGenerating}
          generationPhase={generationPhase}
        />
      )}
    </section>
  );
}

function PreviewStatus({
  isEmpty = false,
  isGenerating = false,
  generationPhase,
}: {
  isEmpty?: boolean;
  isGenerating?: boolean;
  generationPhase: "idle" | "waiting" | "generating";
}) {
  if (generationPhase === "waiting") {
    return (
      <p className={isEmpty ? "preview-empty" : "preview-status"}>
        <span>等待请求窗口</span>
        <span>官方限制为 2 RPM，请求按约 30 秒间隔发送。</span>
      </p>
    );
  }

  if (generationPhase === "generating") {
    return (
      <p className={isEmpty ? "preview-empty" : "preview-status"}>
        <span>生成中...</span>
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
  if (result.status === "blocked") {
    return null;
  }

  return (
    <Image
      src={result.imageUrl}
      alt={result.prompt}
      fill
      sizes="(max-width: 1023px) 100vw, 55vw"
      unoptimized
      priority
      className="preview-image"
    />
  );
}

function HistoryPanel({ outputDirectory }: { outputDirectory: string }) {
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
    return (
      <section className="history-section">
        <p className="history-directory">历史记录 · {outputDirectory}</p>
      </section>
    );
  }

  return (
    <section className="history-section">
      <p className="history-directory">历史记录 · {outputDirectory}</p>
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
  const canDrag = result.status !== "blocked";

  return (
    <button
      type="button"
      onClick={onClick}
      draggable={canDrag}
      onDragStart={(event) => {
        if (canDrag) {
          writeDraggedHistoryImage(event.dataTransfer, result);
        }
      }}
      className="history-item"
    >
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

type DraggedHistoryImage = {
  imageUrl: string;
  fileName: string;
};

function writeDraggedHistoryImage(
  dataTransfer: DataTransfer,
  result: GeneratedImageResult,
) {
  const fileName = `${result.id}.${result.outputFormat}`;
  const data = JSON.stringify({
    imageUrl: result.imageUrl,
    fileName,
  } satisfies DraggedHistoryImage);

  dataTransfer.effectAllowed = "copy";
  dataTransfer.setData(historyDragDataType, data);
  dataTransfer.setData("text/uri-list", result.imageUrl);
}

function readDraggedHistoryImage(dataTransfer: DataTransfer) {
  const data = dataTransfer.getData(historyDragDataType);

  if (!data) {
    return null;
  }

  try {
    const parsed = JSON.parse(data) as Partial<DraggedHistoryImage>;

    if (typeof parsed.imageUrl !== "string" || typeof parsed.fileName !== "string") {
      return null;
    }

    return {
      imageUrl: parsed.imageUrl,
      fileName: parsed.fileName,
    };
  } catch {
    return null;
  }
}

async function fetchHistoryImageFile({
  imageUrl,
  fileName,
}: DraggedHistoryImage) {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error("Failed to load history image.");
  }

  const blob = await response.blob();
  const contentType = blob.type || getImageContentType(fileName);

  return new File([blob], fileName, { type: contentType });
}

function getImageContentType(fileName: string) {
  return fileName.toLowerCase().endsWith(".jpeg") ||
    fileName.toLowerCase().endsWith(".jpg")
    ? "image/jpeg"
    : "image/png";
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

function getClosestOption(options: number[], target: number) {
  if (options.length === 0) {
    return target;
  }

  return options.reduce((closest, option) =>
    Math.abs(option - target) < Math.abs(closest - target) ? option : closest,
  );
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
