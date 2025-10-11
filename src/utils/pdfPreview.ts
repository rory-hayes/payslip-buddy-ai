import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/build/pdf.worker.mjs";

export async function renderFirstPageToPNG(file: File, scale = 2): Promise<Blob> {
  const arrayBuf = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuf });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  // @ts-ignore
  await page.render({ canvasContext: ctx, viewport }).promise;
  return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
}
