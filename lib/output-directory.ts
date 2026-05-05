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

  return path.join(path.normalize(resolvedDirectory), "outputs");
}
