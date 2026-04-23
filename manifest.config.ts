import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'tab-notes',
  version: '1.1.2',
  description: 'A minimalist Markdown editor that replaces your new tab page.',
  permissions: ['storage', 'unlimitedStorage', 'downloads'],
  chrome_url_overrides: {
    newtab: 'src/newtab.html'
  }
});
