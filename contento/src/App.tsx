import React, { useMemo } from 'react';
import { SDKProvider, useSDK } from '@contentful/react-apps-toolkit';
import { Spinner, Box, Paragraph } from '@contentful/f36-components';
import { Sidebar } from './locations/Sidebar';
import { Page } from './locations/Page';
import { Config } from './locations/Config';

// Use string literals to avoid app-sdk import/bundling issues
const LOCATION_ENTRY_SIDEBAR = 'entry-sidebar';
const LOCATION_ASSET_SIDEBAR = 'asset-sidebar';
const LOCATION_PAGE = 'page';
const LOCATION_HOME = 'home';
const LOCATION_APP_CONFIG = 'app-config';
const LOCATION_ENTRY_EDITOR = 'entry-editor';

const LOCATION_COMPONENTS: Array<[string, React.ComponentType]> = [
  [LOCATION_ENTRY_SIDEBAR, Sidebar],
  [LOCATION_ASSET_SIDEBAR, Sidebar],
  [LOCATION_PAGE, Page],
  [LOCATION_HOME, Page],
  [LOCATION_APP_CONFIG, Config],
  [LOCATION_ENTRY_EDITOR, Sidebar],
];

const LoadingFallback = () => (
  <Box padding="spacingL" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 120 }}>
    <Spinner size="large" />
  </Box>
);

const Root = () => {
  const sdk = useSDK();
  const Component = useMemo(() => {
    if (!sdk?.location?.is) return Sidebar;
    for (const [loc, Comp] of LOCATION_COMPONENTS) {
      if (Comp && sdk.location.is(loc)) return Comp;
    }
    return Sidebar;
  }, [sdk?.location]);
  if (!Component) {
    return (
      <Box padding="spacingL">
        <Paragraph>Contento</Paragraph>
        <Paragraph>Unable to determine location. Showing default view.</Paragraph>
        <Sidebar />
      </Box>
    );
  }
  return React.createElement(Component);
};

export default function App() {
  return (
    <SDKProvider loading={<LoadingFallback />}>
      <Root />
    </SDKProvider>
  );
}
