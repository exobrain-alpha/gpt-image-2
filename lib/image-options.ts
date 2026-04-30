export const defaultImageSize = "1024x1536" as const;
export const minimumImagePixels = 655_360;
export const maximumImagePixels = 8_294_400;
export const maximumImageEdge = 2048;
export const imageDimensionStep = 16;
export const maximumImageAspectRatio = 3;

export const imageSizePresets = {
  landscape: ["1024x768", "1536x1024", "2048x1024", "2048x1152"],
  portrait: ["768x1024", "1024x1536", "1024x2048", "1152x2048"],
  square: ["1024x1024", "1536x1536", "2048x2048"],
} as const;

export const imageSizePresetList = [
  ...imageSizePresets.landscape,
  ...imageSizePresets.portrait,
  ...imageSizePresets.square,
] as const;

export const imageDimensionOptions = Array.from(
  new Set(
    imageSizePresetList.flatMap((size) =>
      size.split("x").map((dimension) => Number(dimension)),
    ),
  ),
).sort((a, b) => a - b);

export const imageQualities = ["low", "medium", "high"] as const;
export const imageFormats = ["png", "jpeg"] as const;
export const backgroundModes = ["auto", "transparent"] as const;

export type ImageSize = `${number}x${number}`;
export type ImageQuality = (typeof imageQualities)[number];
export type ImageFormat = (typeof imageFormats)[number];
export type BackgroundMode = (typeof backgroundModes)[number];

export type GenerateImageRequest = {
  prompt: string;
  size: ImageSize;
  quality: ImageQuality;
  outputFormat: ImageFormat;
  background?: BackgroundMode;
};

export type GeneratedImageResult = {
  id: string;
  prompt: string;
  imageUrl: string;
  filePath: string;
  metadataPath: string;
  size: ImageSize;
  quality: ImageQuality;
  outputFormat: ImageFormat;
  background: BackgroundMode;
  createdAt: string;
  status?: "generated" | "blocked";
  errorMessage?: string;
  errorCode?: string;
};

export type GenerateImageResponse = {
  images: GeneratedImageResult[];
};

export function buildImageSize(width: number, height: number): ImageSize {
  return `${width}x${height}`;
}

export function getLegalHeightsForWidth(width: number) {
  return getPresetDimensions()
    .filter((dimensions) => dimensions.width === width)
    .map((dimensions) => dimensions.height);
}

export function getLegalWidthsForHeight(height: number) {
  return getPresetDimensions()
    .filter((dimensions) => dimensions.height === height)
    .map((dimensions) => dimensions.width);
}

export function isValidImageSize(size: unknown): size is ImageSize {
  if (typeof size !== "string") {
    return false;
  }

  const match = /^(\d+)x(\d+)$/.exec(size);

  if (!match) {
    return false;
  }

  return (
    imageSizePresetList.includes(size as (typeof imageSizePresetList)[number]) &&
    isValidImageDimensions(Number(match[1]), Number(match[2]))
  );
}

export function isValidImageDimensions(width: number, height: number) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return false;
  }

  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);
  const totalPixels = width * height;

  return (
    longEdge <= maximumImageEdge &&
    width % imageDimensionStep === 0 &&
    height % imageDimensionStep === 0 &&
    longEdge / shortEdge <= maximumImageAspectRatio &&
    totalPixels >= minimumImagePixels &&
    totalPixels <= maximumImagePixels
  );
}

function getPresetDimensions() {
  return imageSizePresetList.map((size) => {
    const [width, height] = size.split("x").map((dimension) => Number(dimension));

    return { width, height };
  });
}
