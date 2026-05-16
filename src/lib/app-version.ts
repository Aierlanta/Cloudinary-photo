import { readFile } from 'fs/promises';
import { join } from 'path';

export async function readAppVersion(): Promise<string> {
  try {
    const versionPath = join(process.cwd(), '.version');
    const version = await readFile(versionPath, 'utf-8');
    return version.trim() || 'dev';
  } catch {
    return 'dev';
  }
}
