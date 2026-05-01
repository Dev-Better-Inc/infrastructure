import * as core from '@actions/core';
import * as fs from 'node:fs';
import NodeVault from 'node-vault';

type AuthMethod = 'jwt' | 'userpass' | 'token';

interface TplEntry {
  key: string;
  mount: string;
  path: string;
  vaultKey: string;
}

function parseTemplate(contents: string): TplEntry[] {
  const entries: TplEntry[] = [];
  for (const raw of contents.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) throw new Error(`Malformed line (missing '='): ${raw}`);
    const key = line.slice(0, eq).trim();
    const ref = line.slice(eq + 1).trim();

    // ref = <mount>/<path>/<vaultKey>. Split on the last '/' to get the key,
    // first '/' to get the mount, middle segments are the secret path.
    const lastSlash = ref.lastIndexOf('/');
    const firstSlash = ref.indexOf('/');
    if (firstSlash === -1 || firstSlash === lastSlash) {
      throw new Error(`Malformed vault ref (expected 'mount/path/key'): ${ref}`);
    }
    entries.push({
      key,
      mount: ref.slice(0, firstSlash),
      path: ref.slice(firstSlash + 1, lastSlash),
      vaultKey: ref.slice(lastSlash + 1),
    });
  }
  return entries;
}

function isAuthMethod(value: string): value is AuthMethod {
  return value === 'jwt' || value === 'userpass' || value === 'token';
}

function require_(name: string, value: string): string {
  if (!value) throw new Error(`auth_method requires '${name}' to be set`);
  return value;
}

async function authenticate(endpoint: string, method: AuthMethod): Promise<string> {
  if (method === 'token') {
    return require_('vault_token', core.getInput('vault_token'));
  }

  const vault = NodeVault({ endpoint });

  if (method === 'userpass') {
    const username = require_('vault_username', core.getInput('vault_username'));
    const password = require_('vault_password', core.getInput('vault_password'));
    const res = await vault.write(`auth/userpass/login/${encodeURIComponent(username)}`, { password });
    const token = res?.auth?.client_token;
    if (!token) throw new Error('Vault userpass login returned no client_token');
    return token;
  }

  // method === 'jwt'
  const role = require_('vault_role', core.getInput('vault_role'));
  const audience = core.getInput('vault_audience') || 'https://github.com/Dev-Better-Inc';
  const jwt = await core.getIDToken(audience);
  const res = await vault.write('auth/jwt/login', { role, jwt });
  const token = res?.auth?.client_token;
  if (!token) throw new Error('Vault JWT login returned no client_token');
  return token;
}

function splitMountPath(ref: string): { mount: string; path: string } {
  const slash = ref.indexOf('/');
  if (slash === -1) throw new Error(`Malformed vault path (expected 'mount/path'): ${ref}`);
  return { mount: ref.slice(0, slash), path: ref.slice(slash + 1) };
}

async function readSecret(
  vault: NodeVault.client,
  cache: Map<string, Record<string, unknown>>,
  mount: string,
  path: string,
): Promise<Record<string, unknown>> {
  const cacheKey = `${mount}|${path}`;
  let secrets = cache.get(cacheKey);
  if (!secrets) {
    const res = await vault.read(`${mount}/data/${path}`);
    secrets = (res?.data?.data as Record<string, unknown> | undefined) ?? {};
    cache.set(cacheKey, secrets);
  }
  return secrets;
}

function toEnvValue(raw: unknown): string {
  if (raw === undefined || raw === null) return '';
  return String(raw);
}

async function main(): Promise<void> {
  const endpoint = core.getInput('vault_url', { required: true }).replace(/\/$/, '');
  const tplFile = core.getInput('template_file');
  const vaultPath = core.getInput('vault_path');
  const outFile = core.getInput('output_file');
  const exposeRaw = core.getInput('expose_outputs').trim();

  if (tplFile && vaultPath) {
    throw new Error('template_file and vault_path are mutually exclusive');
  }
  if (!tplFile && !vaultPath) {
    throw new Error('Either template_file or vault_path is required');
  }

  const methodInput = core.getInput('auth_method') || 'jwt';
  if (!isAuthMethod(methodInput)) {
    throw new Error(`Invalid auth_method '${methodInput}' — must be one of jwt | userpass | token`);
  }

  const token = await authenticate(endpoint, methodInput);
  core.setSecret(token);

  const vault = NodeVault({ endpoint, token });
  const cache = new Map<string, Record<string, unknown>>();
  const lines: string[] = [];

  const exposeAll = exposeRaw === '*';
  const exposeSet = exposeAll
    ? null
    : new Set(exposeRaw.split(',').map((s) => s.trim()).filter(Boolean));

  const shouldExpose = (key: string): boolean => exposeAll || (exposeSet?.has(key) ?? false);

  const emit = (envKey: string, value: string): void => {
    if (value) core.setSecret(value);
    lines.push(`${envKey}=${value}`);
    if (shouldExpose(envKey)) {
      core.setOutput(envKey, value);
    }
  };

  if (tplFile) {
    const entries = parseTemplate(fs.readFileSync(tplFile, 'utf8'));
    for (const entry of entries) {
      const secrets = await readSecret(vault, cache, entry.mount, entry.path);
      const raw = secrets[entry.vaultKey];
      if (raw === undefined) {
        core.warning(`Vault path ${entry.mount}/${entry.path} has no key '${entry.vaultKey}' (for ${entry.key})`);
      }
      emit(entry.key, toEnvValue(raw));
    }
    core.info(`Wrote ${lines.length} keys to ${outFile} from ${tplFile} (auth: ${methodInput})`);
  } else {
    const { mount, path } = splitMountPath(vaultPath);
    const secrets = await readSecret(vault, cache, mount, path);
    for (const [key, raw] of Object.entries(secrets)) {
      emit(key, toEnvValue(raw));
    }
    core.info(`Resolved ${lines.length} keys from vault_path=${vaultPath} (auth: ${methodInput})`);
  }

  if (outFile) {
    fs.writeFileSync(outFile, lines.join('\n') + '\n');
    core.info(`Wrote ${outFile}`);
  } else {
    core.info('output_file is empty — skipping file write (outputs-only mode)');
  }
}

main().catch((err: unknown) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
