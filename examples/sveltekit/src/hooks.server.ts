import type { Handle } from '@sveltejs/kit/hooks';
import { renderKeksi } from 'keksi';
import config from '../keksi.config';

const keksi = renderKeksi(config, { lang: 'fi' });

// Outside the Svelte root, so hydration and client navigation never touch it.
export const handle: Handle = ({ event, resolve }) =>
  resolve(event, { transformPageChunk: ({ html }) => html.replace(/<body([^>]*)>/, `<body$1>${keksi}`) });
