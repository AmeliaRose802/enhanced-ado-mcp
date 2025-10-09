import { join } from 'path';
import { cwd } from 'process';

const thisFileDir = join(cwd(), 'src', 'utils');
export const repoRoot = join(thisFileDir, '..', '..');
export const promptsDir = join(repoRoot, 'prompts');
