import path from "node:path";

export function getOutputDirectory() {
  const configuredDirectory = process.env.OUTPUT_DIRECTORY?.trim();

  if (!configuredDirectory) {
    return path.join(process.cwd(), "outputs");
  }

  const resolvedDirectory = path.isAbsolute(configuredDirectory)
    ? configuredDirectory
    : path.join(
        /* turbopackIgnore: true */ process.cwd(),
        configuredDirectory,
      );

  return ensureOutputsDirectory(resolvedDirectory);
}

function ensureOutputsDirectory(directory: string) {
  const normalizedDirectory = path.normalize(directory);

  if (path.basename(normalizedDirectory) === "outputs") {
    return normalizedDirectory;
  }

  return path.join(normalizedDirectory, "outputs");
}
