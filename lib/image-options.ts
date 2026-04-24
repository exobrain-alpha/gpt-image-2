export const imageSizes = [
  "720x1024",
  "1024x1024",
  "1024x1536",
  "1536x1024",
  "1920x1080",
] as const;

export const imageQualities = ["low", "medium", "high"] as const;
export const imageFormats = ["png", "jpeg"] as const;
export const backgroundModes = ["auto", "transparent"] as const;

export type ImageSize = (typeof imageSizes)[number];
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
