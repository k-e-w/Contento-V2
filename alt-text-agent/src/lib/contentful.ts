import * as contentful from 'contentful-management';
import type { ClientAPI } from 'contentful-management';

const DEFAULT_LOCALE = 'en-US';

export type ContentfulAssetCandidate = {
  id: string;
  fileName: string;
  url: string;
  contentType: string;
  descriptionByLocale: Record<string, string>;
};

/**
 * Create Contentful Management API client (standard client with getSpace).
 */
export function createClient(accessToken: string): ClientAPI {
  return contentful.createClient({ accessToken }) as ClientAPI;
}

/**
 * Fetch image assets, optionally only those missing alt text.
 * Respects limit and mimetype filter.
 */
export async function getImageAssetCandidates(
  client: ClientAPI,
  spaceId: string,
  environmentId: string,
  options: {
    limit: number;
    overwriteExisting: boolean;
    mimetypeStartsWith: string;
    locales: string[];
  }
): Promise<ContentfulAssetCandidate[]> {
  const space = await client.getSpace(spaceId);
  const environment = await space.getEnvironment(environmentId);
  const candidates: ContentfulAssetCandidate[] = [];
  const limit = Math.min(Math.max(1, options.limit), 100);
  let skip = 0;
  const pageSize = 100;

  while (candidates.length < limit) {
    const response = await environment.getAssets({
      skip,
      limit: pageSize,
      locale: options.locales[0] ?? DEFAULT_LOCALE,
    });

    for (const asset of response.items) {
      if (candidates.length >= limit) break;

      const file = asset.fields.file?.[options.locales[0] ?? DEFAULT_LOCALE]
        ?? Object.values(asset.fields.file ?? {})[0];
      if (!file?.contentType?.startsWith(options.mimetypeStartsWith)) continue;

      const url = file.url;
      if (!url) continue;

      const descriptionByLocale: Record<string, string> = {};
      for (const loc of options.locales) {
        const desc = asset.fields.description?.[loc];
        descriptionByLocale[loc] = typeof desc === 'string' ? desc : '';
      }

      const hasAlt = options.locales.some(
        (loc) => (descriptionByLocale[loc] ?? '').trim() !== ''
      );
      if (!options.overwriteExisting && hasAlt) continue;

      candidates.push({
        id: asset.sys.id,
        fileName: file.fileName ?? 'unknown',
        url: url.startsWith('//') ? `https:${url}` : url,
        contentType: file.contentType ?? '',
        descriptionByLocale,
      });
    }

    if (response.items.length < pageSize) break;
    skip += response.items.length;
    if (response.total <= skip) break;
  }

  return candidates.slice(0, limit);
}

/**
 * Update asset description (alt text) for the given locales.
 */
export async function updateAssetDescription(
  client: ClientAPI,
  spaceId: string,
  environmentId: string,
  assetId: string,
  descriptionByLocale: Record<string, string>
): Promise<void> {
  const space = await client.getSpace(spaceId);
  const environment = await space.getEnvironment(environmentId);
  const asset = await environment.getAsset(assetId);

  if (!asset.fields.description) {
    asset.fields.description = {};
  }
  for (const [locale, value] of Object.entries(descriptionByLocale)) {
    asset.fields.description[locale] = value;
  }
  await asset.update();
}
