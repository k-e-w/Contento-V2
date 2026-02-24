// app/page.tsx
'use client';

import { useState } from 'react';

type AltTextItem = {
  assetId: string;
  fileName: string;
  url: string;
  locale: string;
  previousAlt: string | null;
  proposedAlt: string;
  status: string;
  error: string | null;
};

type AltTextRunResponse = {
  runId: string;
  spaceId: string;
  environmentId: string;
  locales: string[];
  dryRun: boolean;
  summary: {
    totalCandidates: number;
    processed: number;
    skipped: number;
    applied: number;
  };
  items: AltTextItem[];
};

export default function AltTextPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AltTextRunResponse | null>(null);

  const runJob = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/alt-text/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spaceId: 'a7d65bkvekfx',
          environmentId: 'master',
          locales: ['en-US'],
          limit: 5,
          overwriteExisting: false,
          dryRun: false,
          altTextFieldId: 'description',
          filters: {
            mimetypeStartsWith: 'image/',
            contentTypeId: null,
            tagIds: []
          }
        })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `Request failed with ${res.status}`);
      }

      const data = (await res.json()) as AltTextRunResponse;
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
      <button
        type="button"
        onClick={runJob}
        disabled={loading}
        style={{
          padding: '1rem 2rem',
          fontSize: '1.25rem',
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1
        }}
      >
        {loading ? 'Running…' : 'alt text me!'}
      </button>

      {error && (
        <div style={{ marginTop: '1.5rem', color: 'red' }}>{error}</div>
      )}

      {result && (
        <section style={{ marginTop: '1.5rem' }}>
          <p style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Done!</p>
          <a
            href="https://app.contentful.com/spaces/a7d65bkvekfx/environments/master/views/assets"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 500,
              color: 'inherit',
              textDecoration: 'none',
              border: '1px solid currentColor',
              borderRadius: 6,
              cursor: 'pointer'
            }}
          >
            Review your new drafts
          </a>
        </section>
      )}
    </main>
  );
}
