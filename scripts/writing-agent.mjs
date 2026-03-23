/**
 * Writing Agent — reviews blog posts using Claude.
 *
 * Triggered by GitHub Actions when an MDX file changes on main.
 * For each changed post it runs three Claude passes in parallel:
 *   1. Voice analysis — mirrors the author's writing style
 *   2. Fact-check    — flags incorrect / outdated / oversimplified claims
 *   3. Philosopher rewrite — rewrites the intro in a deeper, first-principles style
 *
 * Results are posted as a GitHub Issue labelled "writing-review".
 */

import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getChangedMdxFiles() {
  try {
    const raw = execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf8' });
    return raw
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f.startsWith('src/content/blog/') && f.endsWith('.mdx'));
  } catch {
    // First commit — compare against empty tree
    const raw = execSync('git diff --name-only 4b825dc642cb6eb9a060e54bf8d69288fbee4904 HEAD', {
      encoding: 'utf8',
    });
    return raw
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f.startsWith('src/content/blog/') && f.endsWith('.mdx'));
  }
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { body: content, fm: {} };
  const body = content.slice(match[0].length).trim();
  const fm = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    fm[key] = val;
  }
  return { body, fm };
}

async function postIssue(title, body) {
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ title, body, labels: ['writing-review'] }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const issue = await res.json();
  console.log(`✅ Issue created: ${issue.html_url}`);
}

// ── Prompts ───────────────────────────────────────────────────────────────────

const VOICE_SYSTEM = `You are a literary analyst specialising in technical writing.
Analyse the author's voice across five dimensions and return ONLY a valid JSON object
(no markdown fences) with these exact keys:
{
  "rhythm": "1-2 sentences on sentence length / cadence patterns",
  "vocabulary": "1-2 sentences on register, jargon level, word choices",
  "metaphors": "1-2 sentences on how they use analogy and concrete examples",
  "structure": "1-2 sentences on their structural patterns (section headers, lists, code ratio)",
  "signatureMoves": "1-2 sentences on their most distinctive habits a reader would recognise"
}`;

const FACTCHECK_SYSTEM = `You are a senior software engineer and technical fact-checker.
Review the post for technical accuracy. Find any claims that are incorrect, outdated,
oversimplified to the point of being misleading, or missing important caveats.
Return ONLY a valid JSON array (no markdown fences). Each item:
{ "claim": "exact quote or close paraphrase", "verdict": "correct"|"incorrect"|"needs-caveat"|"outdated", "explanation": "1-2 sentences" }
Return [] if everything is accurate.`;

const REWRITE_SYSTEM = `You are a philosopher-technologist writer in the tradition of Paul Graham,
Richard Feynman, and Scott Alexander. Your hallmarks:
- Open with a disarming question or an unexpected paradox
- Locate the universal tension inside the specific technical problem
- Use a concrete analogy from outside software to make the abstract tangible
- Trust the reader's intelligence — don't over-explain
- Close the intro with the exact promise of what they will understand

Rewrite ONLY the opening paragraph(s) of the post — stop before the first ## heading.
Do not touch code blocks, callouts, or body content.
Return ONLY the rewritten intro text, no commentary, no fences.`;

// ── Core ──────────────────────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function reviewPost(filePath) {
  const abs = resolve(process.cwd(), filePath);
  if (!existsSync(abs)) {
    console.log(`Skipping deleted file: ${filePath}`);
    return;
  }

  const raw = readFileSync(abs, 'utf8');
  const { body, fm } = parseFrontmatter(raw);
  const slug = filePath.split('/').pop().replace(/\.mdx$/, '');
  const title = fm.title ?? slug;

  console.log(`\n📝 Reviewing: "${title}"`);

  // Extract intro (everything before the first ## heading)
  const introMatch = body.match(/^([\s\S]*?)(?=\n##\s)/);
  const intro = introMatch ? introMatch[1].trim() : body.slice(0, 600);

  // Three passes in parallel
  const [voiceRes, factRes, rewriteRes] = await Promise.all([
    client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      system: VOICE_SYSTEM,
      messages: [{ role: 'user', content: body }],
    }),
    client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: FACTCHECK_SYSTEM,
      messages: [{ role: 'user', content: body }],
    }),
    client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: REWRITE_SYSTEM,
      messages: [{
        role: 'user',
        content: `Title: ${title}\nTags: ${fm.tags ?? ''}\n\nOriginal intro:\n${intro}`,
      }],
    }),
  ]);

  // Parse JSON responses
  let voice = {};
  try { voice = JSON.parse(voiceRes.content[0].text); }
  catch { voice = { raw: voiceRes.content[0].text }; }

  let facts = [];
  try { facts = JSON.parse(factRes.content[0].text); }
  catch { facts = []; }

  const rewrite = rewriteRes.content[0].text.trim();

  // Build issue body
  const EMOJI = { correct: '🟢', incorrect: '🔴', 'needs-caveat': '🟡', outdated: '🟠' };

  const factSection = facts.length === 0
    ? '_No technical issues found — looks accurate!_'
    : facts.map((f) =>
        `- ${EMOJI[f.verdict] ?? '⚪'} **${f.verdict.toUpperCase()}**\n  > ${f.claim}\n  \n  ${f.explanation}`
      ).join('\n\n');

  const voiceSection = Object.entries(voice)
    .map(([k, v]) => `**${k.charAt(0).toUpperCase() + k.slice(1)}:** ${v}`)
    .join('\n\n');

  const sha = process.env.GITHUB_SHA?.slice(0, 7) ?? 'unknown';

  const issueBody = `## ✍️ Writing Agent Review

> **Post:** [\`${slug}\`](https://wesleysum.dev/blog/${slug})
> **Commit:** [\`${sha}\`](https://github.com/${process.env.GITHUB_REPOSITORY}/commit/${process.env.GITHUB_SHA})
> **Model:** \`claude-sonnet-4-6\`

---

## 🎙️ Your Writing Voice

${voiceSection}

---

## 🔍 Technical Fact-Check

${factSection}

---

## 🧠 Philosopher Intro Rewrite

*How Paul Graham + Feynman + Scott Alexander might open this:*

${rewrite}

---

*Generated by the Writing Agent. Close this issue once you've reviewed.*`;

  await postIssue(`Writing Review: "${title}"`, issueBody);
}

// ── Entry point ───────────────────────────────────────────────────────────────

const changed = getChangedMdxFiles();

if (changed.length === 0) {
  console.log('No MDX blog files changed. Nothing to review.');
  process.exit(0);
}

console.log(`Found ${changed.length} changed post(s):`, changed);

for (const file of changed) {
  await reviewPost(file);
}
