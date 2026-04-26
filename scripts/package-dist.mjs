import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const distDirectory = path.join(projectDirectory, "dist");
const packageJsonPath = path.join(projectDirectory, "package.json");

const requiredItems = [
  ".next",
  ".env.example",
  "package.json",
  "package-lock.json",
  "README.md",
];
const optionalItems = ["public"];

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const archiveName = `${packageJson.name}-${packageJson.version}.zip`;

run("npm", ["run", "build"]);

await rm(distDirectory, { recursive: true, force: true });
await mkdir(distDirectory, { recursive: true });

const copiedItems = [];

for (const item of requiredItems) {
  await copyProjectItem(item);
  copiedItems.push(item);
}

for (const item of optionalItems) {
  const copied = await copyProjectItem(item, { optional: true });

  if (copied) {
    copiedItems.push(item);
  }
}

run("zip", ["-qry", archiveName, ...copiedItems], { cwd: distDirectory });

console.log(`打包完成：${path.join("dist", archiveName)}`);

async function copyProjectItem(item, { optional = false } = {}) {
  const source = path.join(projectDirectory, item);
  const target = path.join(distDirectory, item);

  try {
    await cp(source, target, {
      recursive: true,
      filter: (sourcePath) => path.basename(sourcePath) !== ".DS_Store",
    });
    return true;
  } catch (error) {
    if (optional && error?.code === "ENOENT") {
      console.warn(`跳过可选项：${item}`);
      return false;
    }

    throw error;
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? projectDirectory,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
