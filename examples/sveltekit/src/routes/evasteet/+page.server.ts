import { cookieTable } from 'keksi';
import config from '../../../keksi.config';

export const prerender = true;

export const load = () => ({ table: cookieTable(config, { lang: 'fi' }) });
