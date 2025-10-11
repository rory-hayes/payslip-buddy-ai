import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/build/pdf.worker.mjs";

/**
 * Renders the first page of a PDF File to a PNG Blob.
 */
export async function renderFirstPageToPNG(file: File, scale = 2): Promise<Blob> {
  const buf = await file.arrayBuffer();
  // @ts-expect-error -- pdfjs types are partial
  const loadingTask = pdfjsLib.getDocument({ data: buf });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  // @ts-expect-error -- pdfjs render typing incomplete
  await page.render({ canvasContext: ctx, viewport }).promise;

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b as Blob), "image/png");
  });
}
