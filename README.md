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

Documents are stored in the user's browser through IndexedDB and OPFS by default. Optional **Supabase cloud sync** lets you upload and download your library across devices.

### Supabase cloud sync (optional)

1. Create a free project at [supabase.com](https://supabase.com).
2. Run `supabase/migrations/001_library.sql` in the Supabase SQL Editor.
3. Copy your project URL and anon key into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. In Supabase Auth settings, enable email/password sign-up (or disable email confirmation for personal use).
5. Run the migration once (required — creates `library_documents` table and `library-blobs` bucket):

```bash
# Option A: paste supabase/migrations/001_library.sql in SQL Editor
# Option B: with a personal access token from supabase.com/dashboard/account/tokens
set SUPABASE_ACCESS_TOKEN=sbp_...
npm run supabase:migrate
```

6. Restart the dev server. Click **Cloud** in the header, sign in, then **Upload to cloud** / **Download & merge**.

Cloud storage uses a Postgres index table plus a private `library-blobs` bucket (50 MB per file on the free tier migration).

## License

MechSweep is open source under the MIT License. See `LICENSE` for details.
