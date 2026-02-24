import { NextResponse } from 'next/server';
import { createClient } from '@/lib/contentful';
import {
  getEntriesMissingTranslation,
  getRecentPublishedEntries,
  getImagesMissingAltText,
  runAltTextForAssets,
  runTranslateForEntries,
  runSeoForEntries,
} from '@/lib/execute-helpers';

type Intent = 'translate' | 'seo' | 'alt_text';
type Step = 'list' | 'confirm_yes' | 'confirm_no_followup' | 'followup';

type ExecuteBody = {
  spaceId: string;
  environmentId: string;
  message?: string;
  intent?: Intent;
  step?: Step;
  entryIds?: string[];
  assetIds?: string[];
};

const LIMIT = 3;
const DEFAULT_LOCALE = 'en-US';
const TARGET_TRANSLATION_LOCALE = process.env.CONTENTFUL_TARGET_TRANSLATION_LOCALE ?? 'es';
const BLOG_CONTENT_TYPE_ID = process.env.CONTENTFUL_BLOG_CONTENT_TYPE_ID ?? 'blogPost';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExecuteBody;
    const { spaceId, environmentId, message, intent, step, entryIds, assetIds } = body;

    if (!spaceId || !environmentId) {
      return NextResponse.json(
        { error: { message: 'spaceId and environmentId are required' } },
        { status: 400 }
      );
    }

    const token = process.env.CONTENTFUL_MANAGEMENT_ACCESS_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: { message: 'CONTENTFUL_MANAGEMENT_ACCESS_TOKEN is not set' } },
        { status: 500 }
      );
    }

    const client = createClient(token);

    // ----- Button flows -----
    if (intent && step === 'list') {
      if (intent === 'translate') {
        const candidates = await getEntriesMissingTranslation(client, spaceId, environmentId, {
          limit: LIMIT,
          targetLocale: TARGET_TRANSLATION_LOCALE,
          sourceLocale: DEFAULT_LOCALE,
        });
        return NextResponse.json({
          candidates: candidates.map((c) => ({ id: c.id, title: c.title })),
          heading: 'Entries missing translation (Spanish):',
          prompt: `Translate these ${candidates.length} entries into Spanish and save to draft?`,
        });
      }
      if (intent === 'seo') {
        const candidates = await getRecentPublishedEntries(client, spaceId, environmentId, {
          limit: LIMIT,
          contentTypeId: BLOG_CONTENT_TYPE_ID,
          locale: DEFAULT_LOCALE,
        });
        return NextResponse.json({
          candidates: candidates.map((c) => ({ id: c.id, title: c.title })),
          heading: 'Most recent published blog posts:',
          prompt: `Optimize these ${candidates.length} blog posts for SEO and save updates to draft?`,
        });
      }
      if (intent === 'alt_text') {
        const candidates = await getImagesMissingAltText(client, spaceId, environmentId, {
          limit: LIMIT,
          locales: [DEFAULT_LOCALE],
        });
        return NextResponse.json({
          candidates: candidates.map((c) => ({ id: c.id, fileName: c.fileName })),
          heading: 'Images missing alt text:',
          prompt: `Generate alt text for these ${candidates.length} images and save to draft?`,
        });
      }
    }

    if (intent && (step === 'confirm_yes' || step === 'confirm_no_followup')) {
      const ids = intent === 'alt_text' ? assetIds : entryIds;
      const list = Array.isArray(ids) ? ids : [];

      if (step === 'confirm_no_followup' && list.length === 0) {
        const ask =
          intent === 'alt_text'
            ? 'Which images do you want alt text for? (Paste asset IDs, comma-separated.)'
            : intent === 'translate'
              ? 'Which entries do you want to translate? (Paste entry IDs, comma-separated.)'
              : 'Which blog posts do you want optimized? (Paste entry IDs, comma-separated.)';
        return NextResponse.json({ reply: ask });
      }

      if (intent === 'alt_text') {
        const aiActionId = process.env.CONTENTFUL_ALT_TEXT_AI_ACTION_ID;
        const assetVariableId = process.env.CONTENTFUL_ALT_TEXT_AI_ACTION_ASSET_VARIABLE_ID;
        if (!aiActionId) {
          return NextResponse.json(
            { error: { message: 'CONTENTFUL_ALT_TEXT_AI_ACTION_ID is not set' } },
            { status: 500 }
          );
        }
        const { applied, errors } = await runAltTextForAssets(
          client,
          spaceId,
          environmentId,
          list,
          { aiActionId, assetVariableId, locale: DEFAULT_LOCALE }
        );
        const reply =
          errors.length > 0
            ? `Updated ${applied} asset(s) as draft. Errors: ${errors.join('; ')}`
            : `Updated ${applied} image(s) with alt text (saved as draft).`;
        return NextResponse.json({ reply });
      }

      if (intent === 'translate') {
        const aiActionId = process.env.CONTENTFUL_TRANSLATE_AI_ACTION_ID;
        if (!aiActionId) {
          return NextResponse.json(
            { error: { message: 'CONTENTFUL_TRANSLATE_AI_ACTION_ID is not set' } },
            { status: 500 }
          );
        }
        const { applied, errors } = await runTranslateForEntries(
          client,
          spaceId,
          environmentId,
          list,
          {
            aiActionId,
            targetLocale: TARGET_TRANSLATION_LOCALE,
            locale: DEFAULT_LOCALE,
          }
        );
        const reply =
          errors.length > 0
            ? `Translated ${applied} entry(ies) to draft. Errors: ${errors.join('; ')}`
            : `Translated ${applied} entry(ies) into Spanish (saved as draft).`;
        return NextResponse.json({ reply });
      }

      if (intent === 'seo') {
        const aiActionId = process.env.CONTENTFUL_SEO_AI_ACTION_ID;
        if (!aiActionId) {
          return NextResponse.json(
            { error: { message: 'CONTENTFUL_SEO_AI_ACTION_ID is not set' } },
            { status: 500 }
          );
        }
        const { applied, errors } = await runSeoForEntries(
          client,
          spaceId,
          environmentId,
          list,
          { aiActionId, locale: DEFAULT_LOCALE }
        );
        const reply =
          errors.length > 0
            ? `Optimized ${applied} post(s) for SEO (draft). Errors: ${errors.join('; ')}`
            : `Optimized ${applied} blog post(s) for SEO (saved as draft).`;
        return NextResponse.json({ reply });
      }
    }

    if (intent && step === 'followup' && typeof message === 'string' && message.trim()) {
      const possibleIds = message
        .trim()
        .split(/[\s,]+/)
        .filter((s) => s.length > 0 && /^[a-zA-Z0-9_-]+$/.test(s));
      if (possibleIds.length > 0) {
        const list = possibleIds;
        if (intent === 'alt_text') {
          const aiActionId = process.env.CONTENTFUL_ALT_TEXT_AI_ACTION_ID;
          const assetVariableId = process.env.CONTENTFUL_ALT_TEXT_AI_ACTION_ASSET_VARIABLE_ID;
          if (!aiActionId) {
            return NextResponse.json(
              { error: { message: 'CONTENTFUL_ALT_TEXT_AI_ACTION_ID is not set' } },
              { status: 500 }
            );
          }
          const { applied, errors } = await runAltTextForAssets(client, spaceId, environmentId, list, {
            aiActionId,
            assetVariableId,
            locale: DEFAULT_LOCALE,
          });
          const reply = errors.length > 0
            ? `Updated ${applied} asset(s) as draft. Errors: ${errors.join('; ')}`
            : `Updated ${applied} image(s) with alt text (saved as draft).`;
          return NextResponse.json({ reply });
        }
        if (intent === 'translate') {
          const aiActionId = process.env.CONTENTFUL_TRANSLATE_AI_ACTION_ID;
          if (!aiActionId) {
            return NextResponse.json(
              { error: { message: 'CONTENTFUL_TRANSLATE_AI_ACTION_ID is not set' } },
              { status: 500 }
            );
          }
          const { applied, errors } = await runTranslateForEntries(client, spaceId, environmentId, list, {
            aiActionId,
            targetLocale: TARGET_TRANSLATION_LOCALE,
            locale: DEFAULT_LOCALE,
          });
          const reply = errors.length > 0
            ? `Translated ${applied} entry(ies) to draft. Errors: ${errors.join('; ')}`
            : `Translated ${applied} entry(ies) into Spanish (saved as draft).`;
          return NextResponse.json({ reply });
        }
        if (intent === 'seo') {
          const aiActionId = process.env.CONTENTFUL_SEO_AI_ACTION_ID;
          if (!aiActionId) {
            return NextResponse.json(
              { error: { message: 'CONTENTFUL_SEO_AI_ACTION_ID is not set' } },
              { status: 500 }
            );
          }
          const { applied, errors } = await runSeoForEntries(client, spaceId, environmentId, list, {
            aiActionId,
            locale: DEFAULT_LOCALE,
          });
          const reply = errors.length > 0
            ? `Optimized ${applied} post(s) for SEO (draft). Errors: ${errors.join('; ')}`
            : `Optimized ${applied} blog post(s) for SEO (saved as draft).`;
          return NextResponse.json({ reply });
        }
      }
      return NextResponse.json({
        reply: `Please specify which ${intent === 'alt_text' ? 'images' : 'entries'} to process (e.g. paste entry or asset IDs).`,
      });
    }

    // ----- Free-form message -----
    if (message != null && typeof message === 'string' && message.trim()) {
      // Optional: run Claude agent with tools. For now return a short reply.
      const reply =
        'You can use the buttons above for: Translate content, SEO optimize blog posts, or Generate alt text. Or describe what you need in plain language and we’ll try to help.';
      return NextResponse.json({ reply });
    }

    return NextResponse.json(
      { error: { message: 'Provide message or intent+step' } },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed';
    return NextResponse.json({ error: { message } }, { status: 400 });
  }
}
