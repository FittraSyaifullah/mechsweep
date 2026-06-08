import type { DocumentPage } from "@/types";

interface PdfParseResult {
  text: string;
  numpages: number;
}

interface PdfTextItem {
  str?: string;
}

export async function parsePdfWithPages(buffer: Buffer): Promise<{
  text: string;
  pageCount: number;
  pages: DocumentPage[];
}> {
  const pages: DocumentPage[] = [];
  const pdfParse = (await import("pdf-parse")).default;
  const data = (await pdfParse(buffer, {
    pagerender: async (pageData: {
      pageIndex?: number;
      getTextContent: () => Promise<{ items: PdfTextItem[] }>;
    }) => {
      const textContent = await pageData.getTextContent();
      const text = textContent.items.map((item) => item.str ?? "").join(" ").trim();
      pages.push({
        pageNumber: (pageData.pageIndex ?? pages.length) + 1,
        text,
      });
      return text;
    },
  })) as PdfParseResult;

  return {
    text: data.text,
    pageCount: data.numpages,
    pages: pages.sort((a, b) => a.pageNumber - b.pageNumber),
  };
}
