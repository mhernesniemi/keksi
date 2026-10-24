import { expect, it } from 'vitest';
import { glob } from '../src/glob.js';

it('matches wildcards anywhere and escapes the rest', () => {
  expect(glob('ph_*_posthog', 'ph_phc_123_posthog')).toBe(true);
  expect(glob('ph_*_posthog', 'ph_phc_123_window_id')).toBe(false);
  expect(glob('_ga_*', '_ga_ABC')).toBe(true);
  expect(glob('_ga', '_gax')).toBe(false);
  expect(glob('connect.sid', 'connectXsid')).toBe(false);
});
