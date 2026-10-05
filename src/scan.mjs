import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, extname, join, relative, sep } from 'node:path';
import { CATEGORIES, MODEL_FILE_EXTENSIONS, SIGNATURES } from './signatures.mjs';

export const VERSION = '1.0.1';

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn', 'dist', 'build', 'out', '.next', '.nuxt', '.turbo', '.cache', 'coverage',
  'venv', '.venv', 'env', '__pycache__', '.tox', '.mypy_cache', 'site-packages', 'vendor', 'target', 'obj',
  '.idea', '.vscode', '.gradle', 'Pods', '.terraform', '.claude', '.worktrees',
]);
const SOURCE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.go', '.rb', '.java', '.kt', '.kts', '.php', '.cs', '.rs', '.swift', '.scala', '.vue', '.svelte']);
// Only template files: a real .env holds secrets and is never opened.
const ENV_TEMPLATES = new Set(['.env.example', '.env.sample', '.env.template', '.env.dist', '.env.local.example', 'env.example']);
const MAX_FILES = 50_000;
const MAX_BYTES = 512 * 1024;
const ATTENTION_ORDER = ['review-first', 'transparency', 'classify', 'info'];

const norm = (s) => s.toLowerCase().replace(/[-_.]+/g, '-');

// ── Manifest parsers: each returns the declared dependency names ──

export function parsePackageJson(text) {
  try {
    const j = JSON.parse(text);
    return ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].flatMap((k) => Object.keys(j?.[k] ?? {}));
  } catch { return []; }
}

export function parseRequirements(text) {
  return text.split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim())
    .filter((l) => l && !l.startsWith('-'))
    .map((l) => l.split(/[\s=<>!~;[@]/)[0]).filter(Boolean);
}

export function parsePyproject(text) {
  const out = [];
  let table = '';
  let inDepArray = false;
  const depTable = () => /dependencies|dependency-groups/.test(table);
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '').trim();
    const header = line.match(/^\[+([^\]]+)\]+$/);
    if (header) { table = header[1].trim(); inDepArray = false; continue; }
    const assign = line.match(/^([\w.-]+)\s*=\s*(.*)$/);
    if (assign) {
      const [, key, rest] = assign;
      const isArray = rest.startsWith('[');
      // [project] dependencies = [...], [build-system] requires = [...], and any array inside a dependency table.
      inDepArray = isArray && (key === 'dependencies' || depTable()) && !rest.includes(']');
      if (isArray && (key === 'dependencies' || depTable())) out.push(...quoted(rest));
      // Poetry / uv style: name = "^1.0" under [tool.poetry.dependencies]
      else if (!isArray && depTable() && key !== 'python') out.push(key);
      continue;
    }
    if (inDepArray) {
      out.push(...quoted(line));
      if (line.includes(']')) inDepArray = false;
    }
  }
  return out;
}
const quoted = (s) => [...s.matchAll(/["']([A-Za-z0-9][A-Za-z0-9._-]*)/g)].map((m) => m[1]);

export function parsePipfile(text) {
  const out = [];
  let on = false;
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^\s*\[([^\]]+)\]/);
    if (h) { on = /packages/.test(h[1]); continue; }
    const k = on && line.match(/^\s*["']?([\w.-]+)["']?\s*=/);
    if (k) out.push(k[1]);
  }
  return out;
}

export function parseGoMod(text) {
  return text.split(/\r?\n/).filter((l) => !/\/\/\s*indirect/.test(l))
    .map((l) => l.trim().replace(/^require\s+/, '').match(/^([a-z0-9.-]+\.[a-z]+\/\S+)\s+v/i)?.[1]).filter(Boolean);
}

export const parseGemfile = (text) => [...text.matchAll(/^\s*gem\s+["']([^"']+)["']/gm)].map((m) => m[1]);

export function parseCargo(text) {
  const out = [];
  let table = '';
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^\s*\[([^\]]+)\]/);
    if (h) {
      table = h[1];
      const named = table.match(/dependencies\.([\w-]+)$/);
      if (named) out.push(named[1]);
      continue;
    }
    const k = /dependencies$/.test(table) && line.match(/^\s*([\w-]+)\s*=/);
    if (k) out.push(k[1]);
  }
  return out;
}

export const parsePom = (text) =>
  [...text.matchAll(/<groupId>\s*([^<\s]+)\s*<\/groupId>\s*<artifactId>\s*([^<\s]+)\s*<\/artifactId>/g)].map((m) => `${m[1]}:${m[2]}`);

export const parseGradle = (text) =>
  [...text.matchAll(/["']([\w.-]+:[\w.-]+)(?::[^"']*)?["']/g)].map((m) => m[1]);

export const parseCsproj = (text) =>
  [...text.matchAll(/<Package(?:Reference|Version)\s+[^>]*Include\s*=\s*"([^"]+)"/gi)].map((m) => m[1]);

export function parseComposer(text) {
  try {
    const j = JSON.parse(text);
    return [...Object.keys(j?.require ?? {}), ...Object.keys(j?.['require-dev'] ?? {})];
  } catch { return []; }
}

/** Which ecosystem and parser a file name maps to, if any. */
function manifestFor(name) {
  if (name === 'package.json') return ['npm', parsePackageJson];
  if (/^(requirements|constraints)[\w.-]*\.(txt|in)$/.test(name)) return ['pypi', parseRequirements];
  if (name === 'pyproject.toml') return ['pypi', parsePyproject];
  if (name === 'Pipfile') return ['pypi', parsePipfile];
  if (name === 'go.mod') return ['go', parseGoMod];
  if (name === 'Gemfile') return ['gem', parseGemfile];
  if (name === 'Cargo.toml') return ['cargo', parseCargo];
  if (name === 'pom.xml') return ['maven', parsePom];
  if (name === 'build.gradle' || name === 'build.gradle.kts' || name === 'libs.versions.toml') return ['maven', parseGradle];
  if (/\.(cs|fs|vb)proj$/.test(name) || name === 'Directory.Packages.props') return ['nuget', parseCsproj];
  if (name === 'composer.json') return ['composer', parseComposer];
  return null;
}

// ── Lookup tables built once from the signature list ──

const BY_ECOSYSTEM = {};
for (const sig of SIGNATURES) {
  for (const eco of ['npm', 'pypi', 'go', 'gem', 'maven', 'cargo', 'nuget', 'composer']) {
    for (const dep of sig[eco] ?? []) ((BY_ECOSYSTEM[eco] ??= new Map())).set(key(eco, dep), sig);
  }
}
const HOSTS = SIGNATURES.flatMap((sig) => (sig.hosts ?? []).map((h) => [h, sig]));
const ENV_NAMES = new Map(SIGNATURES.flatMap((sig) => (sig.env ?? []).map((e) => [e, sig])));

function key(eco, dep) {
  if (eco === 'pypi') return norm(dep);
  if (eco === 'nuget' || eco === 'go') return dep.toLowerCase();
  return dep;
}

function matchDependency(eco, dep) {
  const table = BY_ECOSYSTEM[eco];
  if (!table) return null;
  const k = key(eco, dep);
  if (table.has(k)) return table.get(k);
  if (eco === 'go') {
    // Sub-packages and major-version suffixes: github.com/x/y/v2/sub
    for (const [mod, sig] of table) if (k.startsWith(`${mod}/`)) return sig;
  }
  return null;
}

/** Top-level modules imported by a Python file. */
export function pythonImports(text) {
  const out = new Set();
  for (const m of text.matchAll(/^[ \t]*(?:import|from)[ \t]+([A-Za-z_][\w]*)/gm)) out.add(m[1]);
  return [...out];
}

// ── The scan ──

/**
 * @param {string} root directory to scan
 * @returns {Promise<object>} inventory (see README for the JSON shape)
 */
export async function scan(root) {
  const found = new Map(); // signature id -> { sig, evidence: Map<string, {file, kind, detail}> }
  const modelFiles = [];
  let filesScanned = 0;
  let truncated = false;

  const add = (sig, file, kind, detail) => {
    const entry = found.get(sig.id) ?? { sig, evidence: new Map() };
    found.set(sig.id, entry);
    const k = `${file}|${kind}|${detail}`;
    if (!entry.evidence.has(k)) entry.evidence.set(k, { file, kind, detail });
  };

  async function walk(dir) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (filesScanned >= MAX_FILES) { truncated = true; return; }
      const full = join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) await walk(full);
        continue;
      }
      if (!e.isFile()) continue;
      filesScanned++;
      const rel = relative(root, full).split(sep).join('/');
      const ext = extname(e.name).toLowerCase();

      if (MODEL_FILE_EXTENSIONS.includes(ext)) { modelFiles.push(rel); continue; }

      const manifest = manifestFor(e.name);
      const isEnv = ENV_TEMPLATES.has(e.name);
      const isSource = SOURCE_EXT.has(ext);
      if (!manifest && !isEnv && !isSource) continue;

      let text;
      try {
        if ((await stat(full)).size > MAX_BYTES) continue;
        text = await readFile(full, 'utf8');
      } catch { continue; }

      if (manifest) {
        const [eco, parse] = manifest;
        for (const dep of parse(text)) {
          const sig = matchDependency(eco, dep);
          if (sig) add(sig, rel, 'dependency', dep);
        }
      }
      if (isEnv) {
        for (const m of text.matchAll(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/gm)) {
          const sig = ENV_NAMES.get(m[1]);
          if (sig) add(sig, rel, 'env-name', m[1]);
        }
      }
      if (isSource) {
        for (const [host, sig] of HOSTS) if (text.includes(host)) add(sig, rel, 'api-host', host);
        if (ext === '.py') {
          for (const mod of pythonImports(text)) {
            const sig = matchDependency('pypi', mod);
            if (sig) add(sig, rel, 'import', mod);
          }
        }
      }
    }
  }

  await walk(root);

  const systems = [...found.values()].map(({ sig, evidence }) => {
    const cat = CATEGORIES[sig.category];
    return {
      id: sig.id,
      name: sig.name,
      vendor: sig.vendor,
      category: sig.category,
      categoryLabel: cat.label,
      attention: cat.attention,
      pointer: cat.pointer,
      evidence: [...evidence.values()].sort((a, b) => a.file.localeCompare(b.file)),
    };
  }).sort((a, b) =>
    ATTENTION_ORDER.indexOf(a.attention) - ATTENTION_ORDER.indexOf(b.attention) || a.name.localeCompare(b.name));

  const count = (a) => systems.filter((s) => s.attention === a).length;
  return {
    tool: 'ai-act-scan',
    version: VERSION,
    root: basename(root) || root,
    filesScanned,
    truncated,
    summary: { total: systems.length, reviewFirst: count('review-first'), transparency: count('transparency'), classify: count('classify'), info: count('info'), modelFiles: modelFiles.length },
    systems,
    modelFiles: modelFiles.sort(),
  };
}

/** Ids present now that the baseline (an earlier --json output) did not have. */
export function newSince(result, baseline) {
  const known = new Set((baseline?.systems ?? []).map((s) => (typeof s === 'string' ? s : s.id)));
  return result.systems.filter((s) => !known.has(s.id));
}
