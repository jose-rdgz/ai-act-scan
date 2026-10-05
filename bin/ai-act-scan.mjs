#!/usr/bin/env node
import { appendFile, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { newSince, scan, VERSION } from '../src/scan.mjs';
import { toCsv, toMarkdown, toText } from '../src/report.mjs';

const HELP = `ai-act-scan ${VERSION}
Find the AI in a codebase and turn it into an EU AI Act inventory.

Usage
  ai-act-scan [path] [options]

Output
  (default)             readable report
  --json                machine-readable inventory on stdout
  --md                  Markdown report on stdout (pull request comments, wikis)
  --csv [file]          CSV register (stdout if no file is given)

CI
  --baseline <file>     an earlier --json output; marks components that are new
  --fail-on <rule>      exit 1 when: new | review-first | any
  --github-summary      also write the Markdown report to the GitHub job summary

Other
  --no-color            plain text
  -h, --help  -v, --version

Runs locally. Reads dependency manifests, source files and .env templates
(never a real .env). Sends nothing anywhere.`;

function parseArgs(argv) {
  const o = { path: '.', format: 'text', csvFile: null, baseline: null, failOn: null, color: process.stdout.isTTY && !process.env.NO_COLOR, githubSummary: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => (argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[++i] : null);
    if (a === '-h' || a === '--help') o.help = true;
    else if (a === '-v' || a === '--version') o.version = true;
    else if (a === '--json') o.format = 'json';
    else if (a === '--md') o.format = 'md';
    else if (a === '--csv') { o.csvFile = next(); if (!o.csvFile) o.format = 'csv'; }
    else if (a === '--baseline') o.baseline = next();
    else if (a === '--fail-on') o.failOn = next();
    else if (a === '--github-summary') o.githubSummary = true;
    else if (a === '--no-color') o.color = false;
    else if (a.startsWith('-')) throw new Error(`Unknown option ${a}`);
    else o.path = a;
  }
  if (o.failOn && !['new', 'review-first', 'any'].includes(o.failOn)) throw new Error('--fail-on takes: new, review-first or any');
  if (o.failOn === 'new' && !o.baseline) throw new Error('--fail-on new needs --baseline <file>');
  return o;
}

async function main() {
  let o;
  try { o = parseArgs(process.argv.slice(2)); } catch (e) { console.error(`${e.message}\n\n${HELP}`); return 2; }
  if (o.help) { console.log(HELP); return 0; }
  if (o.version) { console.log(VERSION); return 0; }

  const root = resolve(o.path);
  try {
    if (!(await stat(root)).isDirectory()) throw new Error();
  } catch { console.error(`Not a directory: ${o.path}`); return 2; }

  const result = await scan(root);

  let fresh = null;
  if (o.baseline) {
    try { fresh = newSince(result, JSON.parse(await readFile(resolve(o.baseline), 'utf8'))); }
    catch { console.error(`Could not read baseline ${o.baseline} (expected an earlier --json output)`); return 2; }
    result.newSinceBaseline = fresh.map((s) => s.id);
  }

  if (o.csvFile) await writeFile(resolve(o.csvFile), toCsv(result));
  if (o.githubSummary && process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, toMarkdown(result, { fresh }) + '\n');
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `total=${result.summary.total}\nreview-first=${result.summary.reviewFirst}\nnew=${fresh ? fresh.length : ''}\n`);
  }

  if (o.format === 'json') console.log(JSON.stringify(result, null, 2));
  else if (o.format === 'md') console.log(toMarkdown(result, { fresh }));
  else if (o.format === 'csv') process.stdout.write(toCsv(result));
  else {
    console.log(toText(result, { color: o.color, fresh }));
    if (o.csvFile) console.log(`\nRegister written to ${o.csvFile}`);
  }

  const failed =
    (o.failOn === 'any' && result.summary.total > 0) ||
    (o.failOn === 'review-first' && result.summary.reviewFirst > 0) ||
    (o.failOn === 'new' && fresh.length > 0);
  if (failed) {
    const why = o.failOn === 'new'
      ? `new AI component${fresh.length === 1 ? '' : 's'} not in the baseline: ${fresh.map((s) => s.name).join(', ')}. Add ${fresh.length === 1 ? 'it' : 'them'} to your inventory and refresh the baseline.`
      : o.failOn === 'review-first' ? 'components that need review first were found.' : 'AI components were found.';
    console.error(`\nai-act-scan: ${why}`);
    return 1;
  }
  return 0;
}

process.exitCode = await main();
