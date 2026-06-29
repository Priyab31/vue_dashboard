/**
 * AI Code Review Script
 *
 * Fetches the PR diff, sends it to OpenAI for review,
 * and posts the result as a PR comment via the GitHub API.
 *
 * Required environment variables:
 *   OPENAI_API_KEY   - Your OpenAI secret key
 *   GITHUB_TOKEN     - Provided automatically by GitHub Actions
 *   GITHUB_REPOSITORY - "owner/repo" (provided by GitHub Actions)
 *   GITHUB_EVENT_PATH - Path to the event JSON (provided by GitHub Actions)
 */

'use strict';

const fs = require('fs');

// ── Constants ──────────────────────────────────────────────────────────────
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const GITHUB_EVENT_PATH = process.env.GITHUB_EVENT_PATH;

const OPENAI_MODEL = 'gpt-4o';
const MAX_DIFF_CHARS = 12000; // stay well within token limits

// ── Helpers ────────────────────────────────────────────────────────────────

function assertEnv(name, value) {
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
}

async function githubRequest(path, options = {}) {
  const url = `https://api.github.com${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'ai-code-review-bot',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status} on ${path}: ${body}`);
  }

  return response.json();
}

async function getPRDiff(owner, repo, prNumber) {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3.diff',
      'User-Agent': 'ai-code-review-bot',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch PR diff (${response.status}): ${body}`);
  }

  return response.text();
}

async function getAIReview(diff) {
  const truncatedDiff =
    diff.length > MAX_DIFF_CHARS
      ? diff.slice(0, MAX_DIFF_CHARS) +
        '\n\n... [diff truncated due to size limits] ...'
      : diff;

  const systemPrompt = `You are an expert Vue.js and JavaScript code reviewer.
Your job is to review pull request diffs for a Vue 3 dashboard application.
Focus on:
- Bug fixes correctness (is the fix complete and accurate?)
- Potential regressions introduced by the change
- Vue 3 best practices (Composition API, reactivity, lifecycle hooks)
- Security issues (XSS, injection, exposed secrets)
- Performance concerns
- Code clarity and maintainability

Respond in clear Markdown with the following sections:
## Summary
A short overview of what the PR changes.

## Bug Fix Assessment
Evaluate whether the bug fix is correct and complete.

## Issues Found
List any problems (use "none" if there are no issues).

## Suggestions
Actionable improvement suggestions (optional, skip if none).

## Verdict
One of: ✅ Approved | ⚠️ Needs Minor Changes | ❌ Needs Major Changes`;

  const userPrompt = `Please review the following pull request diff:\n\n\`\`\`diff\n${truncatedDiff}\n\`\`\``;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${body}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function postComment(owner, repo, prNumber, body) {
  const comment = `## 🤖 AI Code Review\n\n${body}\n\n---\n*Reviewed by OpenAI ${OPENAI_MODEL} via GitHub Actions*`;

  await githubRequest(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body: comment }),
  });

  console.log('AI review comment posted successfully.');
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // Validate environment
  assertEnv('OPENAI_API_KEY', OPENAI_API_KEY);
  assertEnv('GITHUB_TOKEN', GITHUB_TOKEN);
  assertEnv('GITHUB_REPOSITORY', GITHUB_REPOSITORY);
  assertEnv('GITHUB_EVENT_PATH', GITHUB_EVENT_PATH);

  // Parse the GitHub Actions event payload
  const event = JSON.parse(fs.readFileSync(GITHUB_EVENT_PATH, 'utf8'));

  if (!event.pull_request) {
    console.log('Not a pull request event, skipping review.');
    return;
  }

  const prNumber = event.pull_request.number;
  const [owner, repo] = GITHUB_REPOSITORY.split('/');

  console.log(`Reviewing PR #${prNumber} in ${owner}/${repo}...`);

  // Fetch the diff
  const diff = await getPRDiff(owner, repo, prNumber);

  if (!diff || diff.trim().length === 0) {
    console.log('No diff found in this PR. Skipping review.');
    return;
  }

  console.log(`Diff size: ${diff.length} characters. Sending to OpenAI...`);

  // Get AI review
  const review = await getAIReview(diff);

  // Post it back to the PR
  await postComment(owner, repo, prNumber, review);
}

main().catch((err) => {
  console.error('AI review failed:', err.message);
  process.exit(1);
});
