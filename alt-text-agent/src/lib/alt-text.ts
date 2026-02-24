import type { ClientAPI } from 'contentful-management';

type AiActionVariable = { id: string; type: string; configuration?: { allowedEntities?: string[] } };

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60_000;

export type InvokeAltTextAiActionOptions = {
  client: ClientAPI;
  spaceId: string;
  environmentId: string;
  aiActionId: string;
  assetId: string;
  /** Variable id for the image/asset input. If not set, first MediaReference variable from the AI Action is used. */
  assetVariableId?: string;
  /** Locale used for entityPath when referencing the asset file (e.g. "en-US"). */
  locale: string;
};

type VariablePayload =
  | { id: string; value: string }
  | { id: string; value: { entityType: 'Asset' | 'Entry' | 'ResourceLink'; entityId: string; entityPath: string } };

/**
 * Build the full variables array required by the AI Action. Contentful returns 422 if any variable is missing.
 */
function buildVariablePayloads(
  variables: AiActionVariable[],
  assetId: string,
  locale: string,
  assetVariableId: string
): VariablePayload[] {
  return variables.map((v) => {
    if (v.id === assetVariableId || v.type === 'MediaReference' || (v.type === 'Reference' && (v.configuration as { allowedEntities?: string[] })?.allowedEntities?.includes?.('Asset'))) {
      return {
        id: v.id,
        value: {
          entityType: 'Asset' as const,
          entityId: assetId,
          entityPath: `fields.file.${locale}`,
        },
      };
    }
    if (v.type === 'Locale') {
      return { id: v.id, value: locale };
    }
    if (v.type === 'Text' || v.type === 'StandardInput' || v.type === 'ResourceLink' || v.type === 'Reference' || v.type === 'SmartContext') {
      return { id: v.id, value: '' };
    }
    return { id: v.id, value: '' };
  });
}

/**
 * Invoke the Contentful AI Action that generates alt text for an asset, poll until complete, and return the plain text result.
 */
export async function generateAltTextWithAiAction(
  options: InvokeAltTextAiActionOptions
): Promise<string> {
  const {
    client,
    spaceId,
    environmentId,
    aiActionId,
    assetId,
    locale,
  } = options;

  const space = await client.getSpace(spaceId);
  const aiAction = await space.getAiAction(aiActionId);
  const variables = aiAction.instruction?.variables ?? [];

  const mediaVar = variables.find(
    (v) => v.type === 'MediaReference' || (v.type === 'Reference' && (v.configuration as { allowedEntities?: string[] })?.allowedEntities?.includes?.('Asset'))
  );
  const assetVariableId = options.assetVariableId ?? mediaVar?.id;
  if (!assetVariableId) {
    throw new Error(
      'AI Action has no MediaReference (or Asset Reference) variable. Set CONTENTFUL_ALT_TEXT_AI_ACTION_ASSET_VARIABLE_ID to the variable id for the image input.'
    );
  }

  const variablePayloads = buildVariablePayloads(variables as AiActionVariable[], assetId, locale, assetVariableId);
  const environment = await space.getEnvironment(environmentId);

  const invocation = await environment.invokeAiAction(aiActionId, {
    outputFormat: 'PlainText',
    variables: variablePayloads,
  });

  const invocationId = invocation.sys.id;
  const start = Date.now();

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const current = await environment.getAiActionInvocation({
      aiActionId,
      invocationId,
    });

    if (current.sys.status === 'COMPLETED') {
      const result = current.result;
      if (!result || result.type !== 'text') {
        throw new Error('AI Action did not return text result');
      }
      const content = typeof result.content === 'string' ? result.content : null;
      if (content == null || content.trim() === '') {
        throw new Error('AI Action returned empty alt text');
      }
      return content.trim();
    }

    if (current.sys.status === 'FAILED' || current.sys.status === 'CANCELLED') {
      const errCode = current.sys.errorCode ?? 'Unknown';
      throw new Error(`AI Action invocation ${current.sys.status}: ${errCode}`);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error('AI Action invocation timed out');
}
