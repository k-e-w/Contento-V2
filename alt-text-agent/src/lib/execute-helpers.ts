import type { ClientAPI } from 'contentful-management';
import {
  createClient,
  getImageAssetCandidates,
  updateAssetDescription,
} from '@/lib/contentful';
import { generateAltTextWithAiAction } from '@/lib/alt-text';

const DEFAULT_LOCALE = 'en-US';
const TARGET_TRANSLATION_LOCALE = 'es'; // or es-ES depending on space

export type CandidateEntry = { id: string; title: string; contentTypeId: string };
export type CandidateAsset = { id: string; fileName: string };

/**
 * Get up to `limit` published entries that are missing content for the target locale.
 * Uses getEntries and filters: has sys.publishedVersion, and for targetLocale the entry has no meaningful content.
 */
export async function getEntriesMissingTranslation(
  client: ClientAPI,
  spaceId: string,
  environmentId: string,
  options: { limit: number; targetLocale: string; sourceLocale?: string }
): Promise<CandidateEntry[]> {
  const space = await client.getSpace(spaceId);
  const environment = await space.getEnvironment(environmentId);
  const locales = await environment.getLocales();
  const localeCodes = locales.items.map((l) => l.code);
  const targetLocale = options.targetLocale;
  const sourceLocale = options.sourceLocale ?? DEFAULT_LOCALE;
  if (!localeCodes.includes(targetLocale)) {
    return [];
  }

  const result: CandidateEntry[] = [];
  let skip = 0;
  const pageSize = 50;

  while (result.length < options.limit) {
    const response = await environment.getEntries({
      skip,
      limit: pageSize,
      order: '-sys.updatedAt',
      'sys.publishedVersion[exists]': 'true',
    });

    for (const entry of response.items) {
      if (result.length >= options.limit) break;
      const ct = entry.sys.contentType?.sys?.id ?? 'unknown';
      const title =
        (entry.fields as Record<string, Record<string, string>>).title?.[sourceLocale] ??
        (entry.fields as Record<string, Record<string, string>>).name?.[sourceLocale] ??
        entry.sys.id;
      const targetValue =
        (entry.fields as Record<string, Record<string, string>>).title?.[targetLocale] ??
        (entry.fields as Record<string, Record<string, string>>).name?.[targetLocale];
      const hasTarget = targetValue != null && String(targetValue).trim() !== '';
      if (!hasTarget) {
        result.push({ id: entry.sys.id, title: String(title), contentTypeId: ct });
      }
    }

    if (response.items.length < pageSize) break;
    skip += response.items.length;
    if (response.total <= skip) break;
  }

  return result.slice(0, options.limit);
}

/**
 * Get up to `limit` most recently updated published entries of the given content type (e.g. blog post).
 */
export async function getRecentPublishedEntries(
  client: ClientAPI,
  spaceId: string,
  environmentId: string,
  options: { limit: number; contentTypeId: string; locale?: string }
): Promise<CandidateEntry[]> {
  const space = await client.getSpace(spaceId);
  const environment = await space.getEnvironment(environmentId);
  const locale = options.locale ?? DEFAULT_LOCALE;

  const response = await environment.getEntries({
    content_type: options.contentTypeId,
    order: '-sys.updatedAt',
    limit: options.limit,
    'sys.publishedVersion[exists]': 'true',
    locale,
  });

  return response.items.map((entry) => {
    const ct = entry.sys.contentType?.sys?.id ?? 'unknown';
    const title =
      (entry.fields as Record<string, Record<string, string>>).title?.[locale] ??
      (entry.fields as Record<string, Record<string, string>>).name?.[locale] ??
      entry.sys.id;
    return { id: entry.sys.id, title: String(title), contentTypeId: ct };
  });
}

/**
 * Get up to `limit` image assets missing alt text (empty description).
 */
export async function getImagesMissingAltText(
  client: ClientAPI,
  spaceId: string,
  environmentId: string,
  options: { limit: number; locales?: string[] }
): Promise<CandidateAsset[]> {
  const candidates = await getImageAssetCandidates(client, spaceId, environmentId, {
    limit: options.limit,
    overwriteExisting: false,
    mimetypeStartsWith: 'image/',
    locales: options.locales ?? [DEFAULT_LOCALE],
  });
  return candidates.map((c) => ({ id: c.id, fileName: c.fileName }));
}

/**
 * Run alt text generation for the given asset IDs and save to draft.
 */
export async function runAltTextForAssets(
  client: ClientAPI,
  spaceId: string,
  environmentId: string,
  assetIds: string[],
  options: { aiActionId: string; assetVariableId?: string; locale?: string }
): Promise<{ applied: number; errors: string[] }> {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const errors: string[] = [];
  let applied = 0;

  for (const assetId of assetIds) {
    try {
      const alt = await generateAltTextWithAiAction({
        client,
        spaceId,
        environmentId,
        aiActionId: options.aiActionId,
        assetId,
        assetVariableId: options.assetVariableId,
        locale,
      });
      await updateAssetDescription(client, spaceId, environmentId, assetId, {
        [locale]: alt,
      });
      applied += 1;
    } catch (e) {
      errors.push(`${assetId}: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  return { applied, errors };
}

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60_000;

/**
 * Invoke an entry-based AI action, poll until complete, return result text.
 */
async function invokeEntryAiActionAndPoll(
  client: ClientAPI,
  spaceId: string,
  environmentId: string,
  aiActionId: string,
  entryId: string,
  options: { entityPath?: string; locale?: string }
): Promise<string> {
  const space = await client.getSpace(spaceId);
  const aiAction = await space.getAiAction(aiActionId);
  const variables = (aiAction.instruction?.variables ?? []) as Array<{
    id: string;
    type: string;
    configuration?: { allowedEntities?: string[] };
  }>;
  const locale = options.locale ?? DEFAULT_LOCALE;
  const entityPath = options.entityPath ?? `fields.body.${locale}`;

  const entryVar = variables.find(
    (v) =>
      v.type === 'Reference' && (v.configuration?.allowedEntities?.includes('Entry') ?? true)
  );
  const entryVarId = entryVar?.id;
  if (!entryVarId) {
    throw new Error('AI Action has no Entry reference variable');
  }

  const variablePayloads = variables.map((v) => {
    if (v.id === entryVarId) {
      return { id: v.id, value: { entityType: 'Entry' as const, entityId: entryId, entityPath } };
    }
    if (v.type === 'Locale') {
      return { id: v.id, value: locale };
    }
    return { id: v.id, value: '' };
  });

  const environment = await space.getEnvironment(environmentId);
  const invocation = await environment.invokeAiAction(aiActionId, {
    outputFormat: 'PlainText',
    variables: variablePayloads,
  });

  const invocationId = invocation.sys.id;
  const start = Date.now();

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const current = await environment.getAiActionInvocation({ aiActionId, invocationId });
    if (current.sys.status === 'COMPLETED') {
      const result = current.result;
      if (!result || result.type !== 'text') {
        throw new Error('AI Action did not return text result');
      }
      const content = typeof result.content === 'string' ? result.content : null;
      if (content == null) throw new Error('AI Action returned empty result');
      return content.trim();
    }
    if (current.sys.status === 'FAILED' || current.sys.status === 'CANCELLED') {
      throw new Error(`AI Action invocation ${current.sys.status}: ${current.sys.errorCode ?? 'Unknown'}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error('AI Action invocation timed out');
}

/**
 * Run Translate AI action for the given entries and write results to draft (target locale).
 * Assumes the action returns plain text; we write to a configurable field (default: body) for target locale.
 */
export async function runTranslateForEntries(
  client: ClientAPI,
  spaceId: string,
  environmentId: string,
  entryIds: string[],
  options: {
    aiActionId: string;
    targetLocale: string;
    targetFieldId?: string;
    locale?: string;
  }
): Promise<{ applied: number; errors: string[] }> {
  const space = await client.getSpace(spaceId);
  const environment = await space.getEnvironment(environmentId);
  const targetFieldId = options.targetFieldId ?? 'body';
  const errors: string[] = [];
  let applied = 0;

  for (const entryId of entryIds) {
    try {
      const content = await invokeEntryAiActionAndPoll(client, spaceId, environmentId, options.aiActionId, entryId, {
        entityPath: `fields.${targetFieldId}.${options.locale ?? DEFAULT_LOCALE}`,
        locale: options.locale ?? DEFAULT_LOCALE,
      });
      const entry = await environment.getEntry(entryId);
      if (!(entry.fields as Record<string, unknown>)[targetFieldId]) {
        (entry.fields as Record<string, Record<string, string>>)[targetFieldId] = {};
      }
      ((entry.fields as Record<string, Record<string, string>>)[targetFieldId] as Record<string, string>)[options.targetLocale] = content;
      await entry.update();
      applied += 1;
    } catch (e) {
      errors.push(`${entryId}: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  return { applied, errors };
}

/**
 * Run SEO AI action for the given entries and write results to draft.
 * Assumes the action returns text; we optionally parse as JSON { metaTitle?, metaDescription? } or write to a single field.
 */
export async function runSeoForEntries(
  client: ClientAPI,
  spaceId: string,
  environmentId: string,
  entryIds: string[],
  options: { aiActionId: string; locale?: string; metaTitleFieldId?: string; metaDescriptionFieldId?: string }
): Promise<{ applied: number; errors: string[] }> {
  const space = await client.getSpace(spaceId);
  const environment = await space.getEnvironment(environmentId);
  const titleField = options.metaTitleFieldId ?? 'metaTitle';
  const descField = options.metaDescriptionFieldId ?? 'metaDescription';
  const errors: string[] = [];
  let applied = 0;

  for (const entryId of entryIds) {
    try {
      const content = await invokeEntryAiActionAndPoll(client, spaceId, environmentId, options.aiActionId, entryId, {
        locale: options.locale ?? DEFAULT_LOCALE,
      });
      const entry = await environment.getEntry(entryId);
      let metaTitle: string | undefined;
      let metaDescription: string | undefined;
      try {
        const parsed = JSON.parse(content) as { metaTitle?: string; metaDescription?: string };
        metaTitle = parsed.metaTitle;
        metaDescription = parsed.metaDescription;
      } catch {
        metaTitle = content.slice(0, 60);
        metaDescription = content;
      }
      if (metaTitle && (entry.fields as Record<string, unknown>)[titleField]) {
        const f = (entry.fields as Record<string, Record<string, string>>)[titleField] as Record<string, string>;
        f[options.locale ?? DEFAULT_LOCALE] = metaTitle;
      }
      if (metaDescription && (entry.fields as Record<string, unknown>)[descField]) {
        const f = (entry.fields as Record<string, Record<string, string>>)[descField] as Record<string, string>;
        f[options.locale ?? DEFAULT_LOCALE] = metaDescription;
      }
      await entry.update();
      applied += 1;
    } catch (e) {
      errors.push(`${entryId}: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  return { applied, errors };
}
