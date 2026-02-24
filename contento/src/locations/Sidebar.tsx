import React, { useState, useCallback } from 'react';
import { useSDK } from '@contentful/react-apps-toolkit';
import {
  Box,
  Button,
  Textarea,
  Paragraph,
  Spinner,
  Note,
  Flex,
} from '@contentful/f36-components';

const DEFAULT_BACKEND_URL = import.meta.env.VITE_CONTENTO_BACKEND_URL ?? '';
const DEFAULT_SPACE_ID = import.meta.env.VITE_DEFAULT_SPACE_ID ?? '';
const DEFAULT_ENV_ID = import.meta.env.VITE_DEFAULT_ENVIRONMENT_ID ?? 'master';

export type Message = { role: 'user' | 'assistant'; content: string };
export type PendingState =
  | { type: 'list'; intent: Intent; candidates: CandidateItem[]; prompt: string }
  | { type: 'followup'; intent: Intent }
  | null;

export type Intent = 'translate' | 'seo' | 'alt_text';
export type CandidateItem = { id: string; title?: string; fileName?: string };

type InstallationParams = { backendUrl?: string };

export function Sidebar() {
  const sdk = useSDK<{
    ids?: { space?: string; environment?: string };
    parameters?: { installation?: InstallationParams };
  }>();
  const spaceId = sdk?.ids?.space ?? DEFAULT_SPACE_ID;
  const environmentId = sdk?.ids?.environment ?? DEFAULT_ENV_ID;
  const backendUrl =
    (sdk?.parameters?.installation?.backendUrl as string)?.trim() || DEFAULT_BACKEND_URL;

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingState>(null);

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      const url = backendUrl ? `${backendUrl.replace(/\/$/, '')}/api/execute` : '/api/execute';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, spaceId, environmentId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || `Request failed: ${res.status}`);
      }
      return res.json();
    },
    [spaceId, environmentId, backendUrl]
  );

  const addAssistant = useCallback((content: string) => {
    setMessages((m) => [...m, { role: 'assistant', content }]);
  }, []);

  const handleFreeForm = useCallback(async () => {
    const text = message.trim();
    if (!text) return;
    setMessage('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setLoading(true);
    setError(null);
    try {
      const data = await post({ message: text });
      addAssistant(data.reply ?? data.message ?? JSON.stringify(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
      addAssistant(`Error: ${e instanceof Error ? e.message : 'Request failed'}`);
    } finally {
      setLoading(false);
    }
  }, [message, post, addAssistant]);

  const handleButton = useCallback(
    async (intent: Intent) => {
      setLoading(true);
      setError(null);
      try {
        const data = await post({ intent, step: 'list' });
        if (data.candidates && Array.isArray(data.candidates)) {
          setPending({
            type: 'list',
            intent,
            candidates: data.candidates,
            prompt: data.prompt ?? 'Proceed with these items? (Yes / No)',
          });
          addAssistant(
            [
              data.heading ?? `Found ${data.candidates.length} item(s):`,
              ...data.candidates.map(
                (c: CandidateItem) => `• ${c.title ?? c.fileName ?? c.id}`
              ),
              data.prompt ?? 'Proceed? Reply Yes or No.',
            ].join('\n')
          );
        } else {
          addAssistant(data.reply ?? data.message ?? 'Done.');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Request failed');
        addAssistant(`Error: ${e instanceof Error ? e.message : 'Request failed'}`);
      } finally {
        setLoading(false);
      }
    },
    [post, addAssistant]
  );

  const handleYesNo = useCallback(
    async (answer: 'yes' | 'no') => {
      if (!pending || pending.type !== 'list') return;
      const { intent, candidates } = pending;
      setPending(null);
      const reply = answer === 'yes' ? 'Yes' : 'No';
      setMessages((m) => [...m, { role: 'user', content: reply }]);
      setLoading(true);
      setError(null);
      try {
        const data = await post({
          intent,
          step: answer === 'yes' ? 'confirm_yes' : 'confirm_no_followup',
          [intent === 'alt_text' ? 'assetIds' : 'entryIds']:
            answer === 'yes' ? candidates.map((c) => c.id) : undefined,
          message: answer === 'no' ? reply : undefined,
        });
        addAssistant(data.reply ?? data.message ?? 'Done.');
        if (answer === 'no') {
          setPending({ type: 'followup', intent });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Request failed');
        addAssistant(`Error: ${e instanceof Error ? e.message : 'Request failed'}`);
      } finally {
        setLoading(false);
      }
    },
    [pending, post, addAssistant]
  );

  const handleSend = useCallback(async () => {
    const text = message.trim();
    if (!text) return;
    setMessage('');
    if (pending?.type === 'followup') {
      const intent = pending.intent;
      setPending(null);
      setMessages((m) => [...m, { role: 'user', content: text }]);
      setLoading(true);
      setError(null);
      try {
        const data = await post({ intent, step: 'followup', message: text });
        addAssistant(data.reply ?? data.message ?? 'Done.');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Request failed');
        addAssistant(`Error: ${e instanceof Error ? e.message : 'Request failed'}`);
      } finally {
        setLoading(false);
      }
      return;
    }
    handleFreeForm();
  }, [message, pending, post, addAssistant, handleFreeForm]);

  const showYesNo = pending?.type === 'list';

  return (
    <Box padding="spacingM" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Paragraph marginBottom="spacingM" fontWeight="fontWeightDemiBold">
        Contento
      </Paragraph>
      <Flex gap="spacingXs" marginBottom="spacingM" flexWrap="wrap">
        <Button size="small" onClick={() => handleButton('translate')} isDisabled={loading}>
          Translate content
        </Button>
        <Button size="small" onClick={() => handleButton('seo')} isDisabled={loading}>
          SEO optimize blog posts
        </Button>
        <Button size="small" onClick={() => handleButton('alt_text')} isDisabled={loading}>
          Generate alt text
        </Button>
      </Flex>
      <Box marginBottom="spacingM" style={{ borderBottom: '1px solid #e0e0e0' }} />
      <Box flex="1" overflow="auto" marginBottom="spacingM" style={{ minHeight: 120 }}>
        {messages.map((msg, i) => (
          <Note
            key={i}
            variant={msg.role === 'user' ? 'positive' : 'primary'}
            title={msg.role === 'user' ? 'You' : 'Contento'}
            style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}
          >
            {msg.content}
          </Note>
        ))}
      </Box>
      {showYesNo && pending?.type === 'list' && (
        <Flex gap="spacingXs" marginBottom="spacingM">
          <Button size="small" onClick={() => handleYesNo('yes')} isDisabled={loading}>
            Yes
          </Button>
          <Button size="small" variant="secondary" onClick={() => handleYesNo('no')} isDisabled={loading}>
            No
          </Button>
        </Flex>
      )}
      <Flex gap="spacingXs">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (showYesNo) return;
              handleSend();
            }
          }}
          placeholder="Plain-language request or reply..."
          rows={2}
          isDisabled={loading}
          style={{ flex: 1 }}
        />
        <Button onClick={handleSend} isDisabled={loading}>
          {loading ? <Spinner size="small" /> : 'Send'}
        </Button>
      </Flex>
      {error && (
        <Note variant="negative" title="Error" style={{ marginTop: 8 }}>
          {error}
        </Note>
      )}
    </Box>
  );
}
