import { ImageWorkbench } from "./components/image-workbench";
import { getOutputDirectory } from "@/lib/output-directory";

export default function Home() {
  return <ImageWorkbench outputDirectory={getOutputDirectory()} />;
}
