import { defineConfig } from 'keksi';
import necessary from './keksi.cookies.json' with { type: 'json' };

export default defineConfig({
  ga: 'G-TEST123',
  googleAds: 'AW-123456',
  meta: '1234567890',
  youtube: true,
  policyUrl: '/evasteet',
  necessary,
});
