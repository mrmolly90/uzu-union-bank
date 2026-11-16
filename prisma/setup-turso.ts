import { createClient } from '@libsql/client';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const requiredTables = [
  'Account',
  'Admin',
  'AuditLog',
  'CryptoAddress',
  'ExchangeRate',
  'Notification',
  'RefreshToken',
  'Transaction',
  'User',
];

async function main() {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (!url) {
    console.log('TURSO_DATABASE_URL not set — skipping Turso schema setup.');
    return;
  }

  const isLocalFile = url.startsWith('file:');
  const isRemoteLibSQL = url.startsWith('libsql://') || url.startsWith('https://');

  if (!isLocalFile && !isRemoteLibSQL) {
    throw new Error('TURSO_DATABASE_URL must use file:, libsql:, or https:.');
  }

  if (isRemoteLibSQL && !authToken) {
    throw new Error('TURSO_AUTH_TOKEN must be configured for a remote Turso database.');
  }

  if (process.env.VERCEL && isLocalFile) {
    throw new Error('Vercel Preview requires a remote Turso database, not a local SQLite file.');
  }

  const client = createClient({
    url,
    ...(authToken ? { authToken } : {}),
  });

  try {
    const result = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
    );
    const tables = new Set(result.rows.map((row) => String(row.name)));
    const missingTables = requiredTables.filter((table) => !tables.has(table));

    if (tables.size === 0) {
      const schemaPath = resolve(process.cwd(), 'prisma/turso-schema.sql');
      const schema = (await readFile(schemaPath, 'utf8')).replace(/^\uFEFF/, '');
      await client.executeMultiple(schema);

      const initializedResult = await client.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
      );
      const initializedTables = new Set(initializedResult.rows.map((row) => String(row.name)));
      const stillMissing = requiredTables.filter((table) => !initializedTables.has(table));

      if (stillMissing.length > 0) {
        throw new Error(`Schema initialization is incomplete; missing tables: ${stillMissing.join(', ')}.`);
      }

      console.log('Initialized the empty SQLite-compatible database schema; no records were imported.');
      return;
    }

    if (missingTables.length > 0) {
      throw new Error(
        `Database is non-empty but missing required tables (${missingTables.join(', ')}); refusing to alter it.`
      );
    }

    console.log('SQLite-compatible database schema is present; no changes were made.');
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unexpected error.';
  let safeMessage = message.replace(/(?:libsql|https?):\/\/\S+/gi, '[database URL redacted]');
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (authToken) {
    safeMessage = safeMessage.split(authToken).join('[auth token redacted]');
  }

  console.error(`Turso schema setup failed: ${safeMessage}`);
  process.exitCode = 1;
});
