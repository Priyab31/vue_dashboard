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
const https = require('https');

// ── Constants ──────────────────────────────────────────────────────────────
// Trim to remove any accidental whitespace/newlines from the secret values
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const GITHUB_TOKEN = (process.env.GITHUB_TOKEN || '').trim();
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

/**
 * Performs an HTTPS request using Node's built-in https module.
 * More reliable than native fetch in GitHub Actions environments.
 */
function httpsRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = https.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, body: raw });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function githubRequest(path, method = 'GET', body = null, acceptHeader = 'application/vnd.github.v3+json') {
  const url = `https://api.github.com${path}`;
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: acceptHeader,
    'User-Agent': 'ai-code-review-bot',
  };

  let bodyStr = null;
  if (body) {
    bodyStr = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(bodyStr);
  }

  const { status, body: resBody } = await httpsRequest(url, { method, headers }, bodyStr);

  if (status < 200 || status >= 300) {
    throw new Error(`GitHub API error ${status} on ${path}: ${resBody}`);
  }

  return resBody ? JSON.parse(resBody) : null;
}

async function getPRDiff(owner, repo, prNumber) {
  const path = `/repos/${owner}/${repo}/pulls/${prNumber}`;
  const url = `https://api.github.com${path}`;
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3.diff',
    'User-Agent': 'ai-code-review-bot',
  };

  const { status, body } = await httpsRequest(url, { method: 'GET', headers });

  if (status < 200 || status >= 300) {
    throw new Error(`Failed to fetch PR diff (${status}): ${body}`);
  }

  return body;
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

  const requestBody = JSON.stringify({
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    max_tokens: 1500,
  });

  const headers = {
    Authorization: `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(requestBody),
  };

  const { status, body } = await httpsRequest(
    'https://api.openai.com/v1/chat/completions',
    { method: 'POST', headers },
    requestBody
  );

  if (status < 200 || status >= 300) {
    throw new Error(`OpenAI API error (${status}): ${body}`);
  }

  const data = JSON.parse(body);
  return data.choices[0].message.content;
}

async function postComment(owner, repo, prNumber, body) {
  const comment = `## 🤖 AI Code Review\n\n${body}\n\n---\n*Reviewed by OpenAI ${OPENAI_MODEL} via GitHub Actions*`;

  await githubRequest(
    `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
    'POST',
    { body: comment }
  );

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
