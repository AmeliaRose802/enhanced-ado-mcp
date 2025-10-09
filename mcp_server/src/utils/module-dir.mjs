import { dirname } from 'path';
import { fileURLToPath } from 'url';
export const moduleDir = dirname(fileURLToPath(import.meta.url));
