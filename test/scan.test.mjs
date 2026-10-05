import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  newSince, parseCargo, parseCsproj, parseGemfile, parseGoMod, parseGradle, parsePackageJson, parsePipfile,
  parsePom, parsePyproject, parseRequirements, pythonImports, scan,
} from '../src/scan.mjs';
import { toCsv, toMarkdown, toText } from '../src/report.mjs';
import { CATEGORIES, SIGNATURES } from '../src/signatures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const BIN = join(here, '..', 'bin', 'ai-act-scan.mjs');
const EXAMPLES = join(here, '..', 'examples');

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'ai-act-scan-'));
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), body);
  }
  return dir;
}
const ids = (r) => r.systems.map((s) => s.id).sort();

test('signature table is well formed', () => {
  const seen = new Set();
  for (const s of SIGNATURES) {
    assert.ok(!seen.has(s.id), `duplicate id ${s.id}`);
    seen.add(s.id);
    assert.ok(CATEGORIES[s.category], `${s.id}: unknown category ${s.category}`);
    assert.ok(s.name && s.vendor);
  }
});

test('parsers extract declared dependencies', () => {
  assert.deepEqual(parsePackageJson('{"dependencies":{"openai":"1"},"devDependencies":{"vitest":"1"}}'), ['openai', 'vitest']);
  assert.deepEqual(parsePackageJson('not json'), []);
  assert.deepEqual(parseRequirements('# c\ntorch==2.1\nfastapi[standard]>=0.1 ; python_version>"3.8"\n-r other.txt\nScikit_Learn\n'), ['torch', 'fastapi', 'Scikit_Learn']);
  assert.deepEqual(
    parsePyproject('[project]\nname = "x"\nkeywords = ["openai"]\ndependencies = [\n  "anthropic>=0.30",\n  "httpx",\n]\n[project.optional-dependencies]\nml = ["torch"]\n[tool.poetry.dependencies]\npython = "^3.11"\nlangchain = "^0.3"\n'),
    ['anthropic', 'httpx', 'torch', 'langchain'],
  );
  assert.deepEqual(parsePipfile('[packages]\nopenai = "*"\n[requires]\npython_version = "3.11"\n'), ['openai']);
  assert.deepEqual(parseGoMod('module x\nrequire (\n\tgithub.com/sashabaranov/go-openai v1.2.0\n\tgithub.com/foo/bar v1.0.0 // indirect\n)\n'), ['github.com/sashabaranov/go-openai']);
  assert.deepEqual(parseGemfile("source 'x'\ngem 'ruby-openai', '~> 7'\n"), ['ruby-openai']);
  assert.deepEqual(parseCargo('[package]\nname = "x"\n[dependencies]\nasync-openai = "0.2"\n[dependencies.ort]\nversion = "2"\n'), ['async-openai', 'ort']);
  assert.deepEqual(parsePom('<dependency><groupId>dev.langchain4j</groupId>\n<artifactId>langchain4j</artifactId></dependency>'), ['dev.langchain4j:langchain4j']);
  assert.deepEqual(parseGradle('implementation("com.openai:openai-java:1.0.0")'), ['com.openai:openai-java']);
  assert.deepEqual(parseCsproj('<PackageReference Include="Azure.AI.OpenAI" Version="2.0.0" />'), ['Azure.AI.OpenAI']);
  assert.deepEqual(pythonImports('import torch\nfrom sklearn.ensemble import X\n  import os, sys\n# import fake\n').sort(), ['os', 'sklearn', 'torch']);
});

test('finds components across ecosystems and kinds of evidence', async () => {
  const r = await scan(fixture({
    'package.json': '{"dependencies":{"openai":"^4","left-pad":"1"}}',
    'api/requirements.txt': 'Face_Recognition==1.3\nrequests\n',
    'api/train.py': 'import torch\n',
    'svc/go.mod': 'module svc\nrequire github.com/anthropics/anthropic-sdk-go/v2 v2.0.0\n',
    'web/call.ts': 'fetch("https://api.mistral.ai/v1/chat/completions")',
    '.env.example': 'GROQ_API_KEY=\nexport HUME_API_KEY=""\nSTRIPE_KEY=\n',
    'models/ranker.onnx': 'x',
  }));
  assert.deepEqual(ids(r), ['anthropic', 'emotion', 'face-recognition', 'groq', 'mistral', 'openai', 'pytorch']);
  assert.equal(r.systems[0].attention, 'review-first');
  assert.equal(r.summary.reviewFirst, 2);
  assert.deepEqual(r.modelFiles, ['models/ranker.onnx']);
  assert.equal(r.systems.find((s) => s.id === 'mistral').evidence[0].kind, 'api-host');
});

test('ignores vendored code, real .env files and unrelated dependencies', async () => {
  const r = await scan(fixture({
    'node_modules/openai/package.json': '{"dependencies":{"openai":"1"}}',
    '.venv/lib/x.py': 'import torch\n',
    '.env': 'OPENAI_API_KEY=sk-secret\n',
    'package.json': '{"dependencies":{"express":"5"}}',
    'README.md': 'We call api.openai.com',
  }));
  assert.equal(r.summary.total, 0);
  assert.match(toText(r), /No AI components detected/);
});

test('never prints env values', async () => {
  const r = await scan(fixture({ '.env.example': 'OPENAI_API_KEY=sk-should-not-appear\n' }));
  assert.deepEqual(ids(r), ['openai']);
  for (const out of [JSON.stringify(r), toText(r), toMarkdown(r), toCsv(r)]) assert.ok(!out.includes('sk-should-not-appear'));
});

test('baseline diff reports only new components', async () => {
  const r = await scan(EXAMPLES);
  assert.deepEqual(newSince(r, r), []);
  const fresh = newSince(r, { systems: r.systems.filter((s) => s.id !== 'elevenlabs') });
  assert.deepEqual(fresh.map((s) => s.id), ['elevenlabs']);
  assert.deepEqual(newSince(r, { systems: r.systems.map((s) => s.id) }), []);
});

test('reports: csv is injection-safe and markdown escapes pipes', async () => {
  const r = await scan(EXAMPLES);
  const csv = toCsv(r);
  assert.match(csv.split('\r\n')[0], /^"System","Purpose","Vendor","Owner"/);
  assert.equal(csv.trim().split('\r\n').length, r.systems.length + 1);
  r.systems[0].name = '=HYPERLINK("x")|y';
  assert.ok(toCsv(r).includes(`"'=HYPERLINK(""x"")|y"`));
  assert.ok(toMarkdown(r).includes('\\|y'));
});

test('cli: formats, exit codes and argument errors', () => {
  const json = JSON.parse(execFileSync('node', [BIN, EXAMPLES, '--json'], { encoding: 'utf8' }));
  assert.equal(json.tool, 'ai-act-scan');
  assert.equal(json.summary.total, 7);

  assert.equal(spawnSync('node', [BIN, EXAMPLES]).status, 0);
  assert.equal(spawnSync('node', [BIN, EXAMPLES, '--fail-on', 'review-first']).status, 1);
  assert.equal(spawnSync('node', [BIN, join(EXAMPLES, 'support-bot'), '--fail-on', 'review-first']).status, 0);
  assert.equal(spawnSync('node', [BIN, EXAMPLES, '--fail-on', 'new']).status, 2);
  assert.equal(spawnSync('node', [BIN, EXAMPLES, '--bogus']).status, 2);
  assert.equal(spawnSync('node', [BIN, join(EXAMPLES, 'nope')]).status, 2);

  const dir = fixture({ 'base.json': JSON.stringify({ systems: json.systems.filter((s) => s.id !== 'anthropic') }) });
  const res = spawnSync('node', [BIN, EXAMPLES, '--baseline', join(dir, 'base.json'), '--fail-on', 'new'], { encoding: 'utf8' });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /Anthropic Claude API/);
  writeFileSync(join(dir, 'full.json'), JSON.stringify(json));
  assert.equal(spawnSync('node', [BIN, EXAMPLES, '--baseline', join(dir, 'full.json'), '--fail-on', 'new']).status, 0);
});
