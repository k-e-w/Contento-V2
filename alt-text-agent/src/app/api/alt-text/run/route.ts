import { NextResponse } from 'next/server';
import {
  createClient,
  getImageAssetCandidates,
  updateAssetDescription,
} from '@/lib/contentful';
import { generateAltTextWithAiAction } from '@/lib/alt-text';

type RunRequestBody = {
  spaceId: string;
  environmentId: string;
  locales: string[];
  limit: number;
  overwriteExisting: boolean;
  dryRun: boolean;
  altTextFieldId: string;
  filters: {
    mimetypeStartsWith: string;
    contentTypeId: string | null;
    tagIds: string[];
  };
};

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RunRequestBody;
    const {
      spaceId,
      environmentId,
      locales: requestedLocales = ['en-US'],
      limit = 50,
      overwriteExisting = false,
      dryRun = false,
      filters = {},
    } = body;

    const locales = Array.isArray(requestedLocales) ? requestedLocales : ['en-US'];
    const mimetypeStartsWith =
      (filters as { mimetypeStartsWith?: string } | undefined)?.mimetypeStartsWith ?? 'image/';

    const contentfulToken = process.env.CONTENTFUL_MANAGEMENT_ACCESS_TOKEN;
    const aiActionId = process.env.CONTENTFUL_ALT_TEXT_AI_ACTION_ID;
    const assetVariableId = process.env.CONTENTFUL_ALT_TEXT_AI_ACTION_ASSET_VARIABLE_ID;

    if (!contentfulToken) {
      return NextResponse.json(
        { error: { message: 'CONTENTFUL_MANAGEMENT_ACCESS_TOKEN is not set' } },
        { status: 500 }
      );
    }
    if (!aiActionId) {
      return NextResponse.json(
        { error: { message: 'CONTENTFUL_ALT_TEXT_AI_ACTION_ID is not set (use your alt-text AI Action id)' } },
        { status: 500 }
      );
    }

    const client = createClient(contentfulToken);
    const candidates = await getImageAssetCandidates(client, spaceId, environmentId, {
      limit,
      overwriteExisting,
      mimetypeStartsWith,
      locales,
    });

    const runId = `run-${Date.now()}`;
    const summary = {
      totalCandidates: candidates.length,
      processed: 0,
      skipped: 0,
      applied: 0,
    };
    const items: AltTextItem[] = [];

    for (const asset of candidates) {
      const firstLocale = locales[0] ?? 'en-US';
      let proposedAlt: string;
      let status: string;
      let err: string | null = null;

      try {
        proposedAlt = await generateAltTextWithAiAction({
          client,
          spaceId,
          environmentId,
          aiActionId,
          assetId: asset.id,
          assetVariableId: assetVariableId || undefined,
          locale: firstLocale,
        });
        status = 'generated';
      } catch (e) {
        proposedAlt = '';
        err = e instanceof Error ? e.message : 'Alt text generation failed';
        status = 'error';
      }

      if (!dryRun && proposedAlt && !err) {
        const descriptionByLocale: Record<string, string> = {};
        for (const loc of locales) {
          descriptionByLocale[loc] = proposedAlt;
        }
        try {
          await updateAssetDescription(
            client,
            spaceId,
            environmentId,
            asset.id,
            descriptionByLocale
          );
          status = 'applied';
          summary.applied += 1;
        } catch (e) {
          err = e instanceof Error ? e.message : 'Contentful update failed';
          status = 'error';
        }
      }

      if (status === 'generated' || status === 'applied') summary.processed += 1;

      items.push({
        assetId: asset.id,
        fileName: asset.fileName,
        url: asset.url,
        locale: firstLocale,
        previousAlt: asset.descriptionByLocale[firstLocale]?.trim() || null,
        proposedAlt,
        status,
        error: err,
      });
    }

    return NextResponse.json({
      runId,
      spaceId,
      environmentId,
      locales,
      dryRun,
      summary,
      items,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed';
    return NextResponse.json(
      { error: { message } },
      { status: 400 }
    );
  }
}
