import React, { useState, useCallback } from 'react';
import { useSDK } from '@contentful/react-apps-toolkit';
import { Box, TextInput, Paragraph, Form, Button } from '@contentful/f36-components';

export function Config() {
  const sdk = useSDK<{ app: { onConfigure: (cb: () => object) => void } }>();
  const [backendUrl, setBackendUrl] = useState(
    () => (sdk?.parameters?.installation?.backendUrl as string) ?? ''
  );

  const handleConfigure = useCallback(() => {
    return {
      parameters: {
        installation: {
          backendUrl: backendUrl.trim() || undefined,
        },
      },
    };
  }, [backendUrl]);

  React.useEffect(() => {
    sdk?.app?.onConfigure?.(handleConfigure);
  }, [sdk?.app, handleConfigure]);

  return (
    <Box padding="spacingL">
      <Paragraph marginBottom="spacingM" fontWeight="fontWeightDemiBold">
        Contento configuration
      </Paragraph>
      <Form>
        <Form.Control>
          <Form.Label htmlFor="backendUrl">Backend API URL</Form.Label>
          <TextInput
            id="backendUrl"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="https://your-alt-text-agent.vercel.app"
            helpText="The URL of your deployed alt-text-agent backend (e.g. on Vercel). Must include https://"
          />
        </Form.Control>
      </Form>
    </Box>
  );
}
