import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

function resolveEnvPath(): string {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(__dirname, '../../.env'),
    resolve(__dirname, '../../../.env'),
  ];

  const match = candidates.find((path) => existsSync(path));
  return match ?? resolve(process.cwd(), '.env');
}

export const ENV_FILE_PATH = resolveEnvPath();

const result = config({ path: ENV_FILE_PATH, quiet: true });

if (result.error && existsSync(ENV_FILE_PATH)) {
  throw result.error;
}
