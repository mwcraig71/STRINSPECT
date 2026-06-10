// Imperative bridge between the pure-function parser (utils/pdfParser.ts) and the
// React-mounted headless extraction WebView (PdfTextExtractorHost). The parser is
// not a component, so it cannot mount a WebView itself; instead the host registers
// its extraction implementation here once it is mounted, and the parser calls
// extractPdfTextNative() to drive it.

export type PdfExtractor = (base64: string) => Promise<string[][]>;

let extractorImpl: PdfExtractor | null = null;

export function registerPdfExtractor(fn: PdfExtractor | null): void {
  extractorImpl = fn;
}

export function extractPdfTextNative(base64: string): Promise<string[][]> {
  if (!extractorImpl) {
    return Promise.reject(
      new Error("PDF reader is not ready yet. Please wait a moment and try again."),
    );
  }
  return extractorImpl(base64);
}
