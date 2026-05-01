import path from "node:path";

export function getOutputDirectory() {
  const configuredDirectory = process.env.OUTPUT_DIRECTORY?.trim();

  if (!configuredDirectory) {
    return path.join(process.cwd(), "outputs");
  }

  if (path.isAbsolute(configuredDirectory)) {
    return configuredDirectory;
  }

  return path.join(
    /* turbopackIgnore: true */ process.cwd(),
    configuredDirectory,
  );
}
