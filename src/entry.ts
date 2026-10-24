import { boot } from './runtime.js';

boot(JSON.parse(document.getElementById('keksi-data')!.textContent!));
