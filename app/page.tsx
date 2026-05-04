import { connection } from "next/server";

import { ImageWorkbench } from "./components/image-workbench";
import { getOutputDirectory } from "@/lib/output-directory";

export default async function Home() {
  await connection();

  return <ImageWorkbench outputDirectory={getOutputDirectory()} />;
}
