# MechSweep
MechSweep.Vercel.App

MechSweep is an open-source Next.js application for collecting, processing, searching, analyzing, and exporting mechanical engineering documents for RAG pipelines.

It helps engineers and researchers turn PDFs, text files, CSV datasets, and public web documents into structured, searchable, export-ready corpora.

## Features

- Web sweep for public mechanical engineering resources
- PDF, TXT, and CSV upload
- AI-assisted document summaries, tags, and categories
- IndexedDB browser-local document library for 1000+ resources
- Tile-based library with search, filters, pagination, and bulk actions
- Full-text and semantic search support
- PDF page-level extraction metadata
- Table extraction from CSV, HTML, and text-like tables
- Language, engineering unit, and OCR-needed detection
- Export single documents, selected documents, or the full library
- Export formats: TXT, JSON, CSV, PDF, ZIP
- RAG export presets: plain corpus, LangChain, LlamaIndex, OpenAI batch
- Chunking controls for size, overlap, and metadata inclusion

## Use Cases

- Build a mechanical engineering knowledge base for RAG
- Collect technical documents from public sources
- Prepare training or reference corpora for engineering assistants
- Organize PDFs, datasheets, reports, and CSV datasets in one local library
- Export cleaned, chunked, metadata-rich documents for downstream AI systems
- Search engineering documents by content, tags, category, source, units, and semantic meaning

## Tech Stack

- Next.js 14
- React
- TypeScript
- Tailwind CSS
- IndexedDB for browser-local storage
- OpenRouter for AI analysis, web sweep, and embeddings
- Vitest for unit tests

## Local Development

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```env
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=google/gemini-2.5-flash-lite
OPENROUTER_ANALYZE_MODEL=google/gemini-2.5-flash-lite
OPENROUTER_SEARCH_MODEL=perplexity/sonar-pro
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Run the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Testing

```bash
npm test
npm run build
```

## Deployment

MechSweep can be deployed on Vercel as a standard Next.js app. Add the same OpenRouter environment variables in Vercel project settings before deploying.

Documents are stored in the user's browser through IndexedDB, so each user's library is local to their browser/device unless a backend database is added later.

## License

MechSweep is open source under the MIT License. See `LICENSE` for details.
