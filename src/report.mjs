const SITE = 'https://eurogpsr.com';
const utm = (path, medium) => `${SITE}${path}?utm_source=ai-act-scan&utm_medium=${medium}`;

const ATTENTION = {
  'review-first': { label: 'REVIEW FIRST', md: '🔴 Review first', color: 31 },
  transparency: { label: 'TRANSPARENCY', md: '🟡 Transparency duties likely', color: 33 },
  classify: { label: 'CLASSIFY', md: '🔵 Classify by purpose', color: 36 },
  info: { label: 'INFO', md: '⚪ Supporting component', color: 90 },
};

const DISCLAIMER =
  'These are signals found in code, not a legal classification: the risk tier depends on what each system is used for. Not legal advice.';

function evidenceLine(system, max = 3) {
  const files = [...new Set(system.evidence.map((e) => e.file))];
  const shown = files.slice(0, max).join(', ');
  return files.length > max ? `${shown} (+${files.length - max} more)` : shown;
}

export function toText(result, { color = false, fresh = null } = {}) {
  const c = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
  const lines = [];
  lines.push(c(1, `ai-act-scan ${result.version}`) + `  ·  ${result.filesScanned} files scanned in ${result.root}`);
  lines.push('');
  if (!result.systems.length && !result.modelFiles.length) {
    lines.push('No AI components detected in dependencies, imports, API hosts or env templates.');
    lines.push('AI can still reach you through SaaS features (a CV screener in your ATS, a chatbot in your helpdesk):');
    lines.push(`list those by hand: ${utm('/tools/ai-inventory-template', 'cli')}`);
    return lines.join('\n');
  }
  lines.push(c(1, `${result.summary.total} AI component${result.summary.total === 1 ? '' : 's'} found`) +
    `  (${result.summary.reviewFirst} review first, ${result.summary.transparency} transparency, ${result.summary.classify} classify, ${result.summary.info} info)`);
  lines.push('');
  for (const s of result.systems) {
    const a = ATTENTION[s.attention];
    const isNew = fresh?.some((f) => f.id === s.id) ? c(35, '  NEW') : '';
    lines.push(`${c(a.color, a.label.padEnd(13))} ${c(1, s.name)}  ${c(90, `(${s.vendor})`)}${isNew}`);
    lines.push(`${' '.repeat(14)}${s.categoryLabel}`);
    lines.push(`${' '.repeat(14)}${c(90, evidenceLine(s))}`);
  }
  if (result.modelFiles.length) {
    lines.push('');
    lines.push(c(1, `${result.modelFiles.length} model weight file${result.modelFiles.length === 1 ? '' : 's'} in the repository`) + c(90, `  ${result.modelFiles.slice(0, 3).join(', ')}${result.modelFiles.length > 3 ? ' ...' : ''}`));
  }
  const categories = [...new Map(result.systems.map((s) => [s.category, s])).values()];
  lines.push('');
  lines.push(c(1, 'What the EU AI Act says about these'));
  for (const s of categories) {
    lines.push(`  ${c(ATTENTION[s.attention].color, '•')} ${c(1, s.categoryLabel)}: ${s.pointer}`);
  }
  lines.push('');
  lines.push(c(1, 'Next steps'));
  lines.push(`  1. Save the register:        ai-act-scan --csv ai-inventory.csv`);
  lines.push(`  2. Classify each system:     ${utm('/ai-act/assess', 'cli')}  (free, 7 questions)`);
  lines.push(`  3. Dates that apply to you:  ${SITE}/ai-act/deadlines`);
  lines.push(`  4. Catch new AI in CI:       ai-act-scan --json > .ai-inventory.json, then --baseline .ai-inventory.json --fail-on new`);
  lines.push('');
  lines.push(c(90, DISCLAIMER));
  if (result.truncated) lines.push(c(33, 'Scan stopped at the file limit: results may be incomplete. Scan sub-directories separately.'));
  return lines.join('\n');
}

const mdCell = (s) => String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

export function toMarkdown(result, { fresh = null } = {}) {
  const out = [];
  out.push('## AI inventory (ai-act-scan)');
  out.push('');
  if (!result.systems.length && !result.modelFiles.length) {
    out.push('No AI components detected in dependencies, imports, API hosts or env templates.');
    return out.join('\n');
  }
  out.push(`**${result.summary.total} AI component${result.summary.total === 1 ? '' : 's'}** found in ${result.filesScanned} files` +
    (fresh ? ` · **${fresh.length} new** since the baseline` : '') + '.');
  out.push('');
  out.push('| | Component | Vendor | Kind | Found in |');
  out.push('|---|---|---|---|---|');
  for (const s of result.systems) {
    const isNew = fresh?.some((f) => f.id === s.id) ? ' 🆕' : '';
    out.push(`| ${ATTENTION[s.attention].md} | ${mdCell(s.name)}${isNew} | ${mdCell(s.vendor)} | ${mdCell(s.categoryLabel)} | ${mdCell(evidenceLine(s).split(', ').map((f) => `\`${f}\``).join(', '))} |`);
  }
  if (result.modelFiles.length) {
    out.push('');
    out.push(`Model weight files in the repository: ${result.modelFiles.slice(0, 5).map((f) => `\`${f}\``).join(', ')}${result.modelFiles.length > 5 ? ` and ${result.modelFiles.length - 5} more` : ''}.`);
  }
  out.push('');
  out.push('<details><summary>What the EU AI Act says about these</summary>');
  out.push('');
  for (const s of [...new Map(result.systems.map((x) => [x.category, x])).values()]) out.push(`- **${s.categoryLabel}**: ${s.pointer}`);
  out.push('');
  out.push('</details>');
  out.push('');
  out.push(`Next: [classify each system](${utm('/ai-act/assess', 'action')}) (free, 7 questions) · [inventory template](${utm('/tools/ai-inventory-template', 'action')}) · [AI Act deadlines](${SITE}/ai-act/deadlines)`);
  out.push('');
  out.push(`<sub>${DISCLAIMER}</sub>`);
  return out.join('\n');
}

// Spreadsheet formula injection guard, then RFC 4180 quoting.
const csvCell = (v) => {
  const s = String(v ?? '');
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

/**
 * Same leading columns as the EuroComply inventory template, so the file can be
 * merged with a register kept there. Purpose and Owner are left for a human:
 * code cannot know them, and they are what decides the tier.
 */
export function toCsv(result) {
  const head = ['System', 'Purpose', 'Vendor', 'Owner', 'Personal data', 'Affects people', 'Risk tier', 'Needs attention', 'Kind', 'Detected in', 'AI Act pointer'];
  const rows = result.systems.map((s) => [
    s.name, '', s.vendor, '', '', '', 'Not classified yet', s.attention === 'review-first' ? 'Yes' : '',
    s.categoryLabel, [...new Set(s.evidence.map((e) => e.file))].join('; '), s.pointer,
  ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
