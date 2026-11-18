/**
 * GitHub API Client & Code Repository Ingestion Service
 * Standard: api-and-interface-design & incremental-implementation
 */

import { detectLanguage } from './metrics/complexity';
import type { CommitRecord, FileChange } from '@shared/types/contracts';

export type GitHubErrorCode =
  | 'NOT_FOUND'
  | 'RATE_LIMIT_EXCEEDED'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_SERVER_ERROR';

export class GitHubError extends Error {
  code: GitHubErrorCode;
  status: number;

  constructor(message: string, code: GitHubErrorCode, status: number) {
    super(message);
    this.name = 'GitHubError';
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, GitHubError.prototype);
  }
}

export interface GitHubRepoMetadata {
  owner: string;
  repo: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  description: string | null;
  stars: number;
}

export interface GitHubFileEntry {
  path: string;
  size: number;
  sha: string;
  language: string;
}

const SUPPORTED_EXTENSIONS = new Set([
  'py', 'pyw',
  'js', 'jsx', 'mjs', 'cjs',
  'ts', 'tsx', 'mts', 'cts',
  'java',
  'c', 'h',
  'cpp', 'cc', 'cxx', 'hpp', 'hxx',
  'cs',
  'go',
  'rs',
  'php',
  'rb',
  'kt', 'kts',
  'swift',
  'scala',
]);

const IGNORED_DIRECTORY_PATTERNS = [
  /(^|\/)node_modules\//i,
  /(^|\/)\.git\//i,
  /(^|\/)dist\//i,
  /(^|\/)build\//i,
  /(^|\/)\.next\//i,
  /(^|\/)\.venv\//i,
  /(^|\/)venv\//i,
  /(^|\/)env\//i,
  /(^|\/)target\//i,
  /(^|\/)vendor\//i,
  /(^|\/)\.idea\//i,
  /(^|\/)\.vscode\//i,
  /(^|\/)__pycache__\//i,
  /(^|\/)\.cache\//i,
];

/**
 * Parses any GitHub URL or shorthand string into owner and repo name
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim().replace(/\/+$/, '');

  // Case 1: owner/repo shorthand (e.g. "psf/requests")
  const shorthandMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\s*\/\s*([a-zA-Z0-9_.-]+)$/);
  if (shorthandMatch) {
    const [, owner, repo] = shorthandMatch;
    return {
      owner,
      repo: repo.endsWith('.git') ? repo.slice(0, -4) : repo,
    };
  }

  // Case 2: SSH clone URL (e.g. "git@github.com:psf/requests.git" or "ssh://git@github.com/psf/requests.git")
  const sshMatch = trimmed.match(/^(?:ssh:\/\/)?git@github\.com[:/]([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?$/);
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2],
    };
  }

  // Case 3: Full URL (http, https, or git://)
  try {
    const normalizedUrl =
      trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('git://')
        ? trimmed
        : `https://${trimmed}`;

    const parsed = new URL(normalizedUrl);
    const host = parsed.hostname.toLowerCase();
    if (host !== 'github.com' && host !== 'www.github.com') {
      return null;
    }

    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length < 2) return null;

    const owner = segments[0];
    let repo = segments[1];
    if (repo.endsWith('.git')) {
      repo = repo.slice(0, -4);
    }

    return { owner, repo };
  } catch {
    return null;
  }
}

/**
 * Checks if a given filepath is a supported programming language source file
 */
export function isSupportedSourceFile(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') return false;
  if (shouldIgnorePath(filePath)) return false;

  const parts = filePath.split('.');
  if (parts.length <= 1) return false;

  const ext = parts.pop()!.toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

/**
 * Checks if a filepath belongs to ignored directories or vendor files
 */
export function shouldIgnorePath(filePath: string): boolean {
  if (!filePath) return true;
  const normalized = filePath.replace(/\\/g, '/');

  for (const pattern of IGNORED_DIRECTORY_PATTERNS) {
    if (pattern.test(normalized)) {
      return true;
    }
  }

  // Also ignore minified files and lockfiles
  if (
    normalized.endsWith('.min.js') ||
    normalized.endsWith('.min.css') ||
    normalized.endsWith('.map') ||
    normalized.endsWith('package-lock.json') ||
    normalized.endsWith('yarn.lock') ||
    normalized.endsWith('pnpm-lock.yaml') ||
    normalized.endsWith('Cargo.lock') ||
    normalized.endsWith('Gemfile.lock')
  ) {
    return true;
  }

  return false;
}

/**
 * Build standard GitHub request headers
 */
function getGitHubHeaders(token?: string, skipEnvAuth: boolean = false): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'AI-Bug-Prediction-Agent/1.0.0',
  };

  const authToken = token || (!skipEnvAuth ? (process.env.GITHUB_PAT || process.env.GITHUB_TOKEN) : undefined);
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return headers;
}

/**
 * Fetches repository metadata from GitHub API
 */
export async function fetchGitHubRepoMetadata(
  owner: string,
  repo: string,
  token?: string
): Promise<GitHubRepoMetadata> {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  let response: Response;
  try {
    response = await fetch(url, { headers: getGitHubHeaders(token) });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    throw new GitHubError(
      `Network error connecting to GitHub API (${errMsg}). Please check your internet connection.`,
      'NETWORK_ERROR',
      503
    );
  }

  // Graceful degradation: if system environment token is stale/expired and user did not pass custom token, retry unauthenticated
  if (response.status === 401 && !token && (process.env.GITHUB_PAT || process.env.GITHUB_TOKEN)) {
    try {
      const fallback = await fetch(url, { headers: getGitHubHeaders(undefined, true) });
      response = fallback;
    } catch {
      // keep original response
    }
  }

  if (response.status === 404) {
    throw new GitHubError(
      `Repository "${owner}/${repo}" was not found or is private. If it is private, provide a GitHub Personal Access Token in advanced settings.`,
      'NOT_FOUND',
      404
    );
  }

  if (response.status === 401) {
    throw new GitHubError(
      token
        ? 'GitHub authentication failed. The provided GitHub Personal Access Token is invalid or expired.'
        : 'GitHub API authentication failed. The server environment token is invalid or expired. Please provide your own GitHub Personal Access Token in advanced settings.',
      'UNAUTHORIZED',
      401
    );
  }

  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const retryAfter = response.headers.get('retry-after');
    let message = '';
    try {
      const data = await response.json();
      message = data.message || '';
    } catch {
      // not json
    }

    const isRateLimit =
      remaining === '0' ||
      response.status === 429 ||
      Boolean(retryAfter) ||
      message.toLowerCase().includes('rate limit') ||
      message.toLowerCase().includes('secondary rate limit') ||
      message.toLowerCase().includes('too many requests');

    if (isRateLimit) {
      throw new GitHubError(
        retryAfter
          ? `GitHub API rate limit exceeded (Retry after ${retryAfter}s). Please provide a GitHub Personal Access Token (PAT) in advanced settings or wait before retrying.`
          : 'GitHub API rate limit exceeded. Please provide a GitHub Personal Access Token (PAT) in advanced settings.',
        'RATE_LIMIT_EXCEEDED',
        403
      );
    }

    throw new GitHubError(
      message ? `GitHub access forbidden: ${message}` : 'GitHub API access was forbidden (HTTP 403).',
      'FORBIDDEN',
      403
    );
  }

  if (response.status >= 500) {
    throw new GitHubError(
      `GitHub API server error (${response.status}): ${response.statusText || 'Service Unavailable'}`,
      'SERVICE_UNAVAILABLE',
      503
    );
  }

  if (!response.ok) {
    throw new GitHubError(
      `GitHub API error (${response.status}): ${response.statusText}`,
      'INTERNAL_SERVER_ERROR',
      response.status
    );
  }

  const data = await response.json();
  return {
    owner: data.owner?.login || owner,
    repo: data.name || repo,
    name: data.name || repo,
    fullName: data.full_name || `${owner}/${repo}`,
    defaultBranch: data.default_branch || 'main',
    isPrivate: !!data.private,
    description: data.description || null,
    stars: data.stargazers_count || 0,
  };
}

/**
 * Fetches repository file tree recursively
 */
export async function fetchGitHubRepoTree(
  owner: string,
  repo: string,
  branch: string,
  token?: string
): Promise<GitHubFileEntry[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  let response: Response;
  try {
    response = await fetch(url, { headers: getGitHubHeaders(token) });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    throw new GitHubError(
      `Network error fetching repository tree (${errMsg})`,
      'NETWORK_ERROR',
      503
    );
  }

  // Graceful degradation: if system environment token is stale/expired and user did not pass custom token, retry unauthenticated
  if (response.status === 401 && !token && (process.env.GITHUB_PAT || process.env.GITHUB_TOKEN)) {
    try {
      const fallback = await fetch(url, { headers: getGitHubHeaders(undefined, true) });
      response = fallback;
    } catch {
      // keep original response
    }
  }

  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const retryAfter = response.headers.get('retry-after');
    let message = '';
    try {
      const data = await response.json();
      message = data.message || '';
    } catch {
      // not json
    }

    const isRateLimit =
      remaining === '0' ||
      response.status === 429 ||
      Boolean(retryAfter) ||
      message.toLowerCase().includes('rate limit') ||
      message.toLowerCase().includes('secondary rate limit') ||
      message.toLowerCase().includes('too many requests');

    if (isRateLimit) {
      throw new GitHubError(
        retryAfter
          ? `GitHub API rate limit exceeded (Retry after ${retryAfter}s). Please provide a PAT in advanced settings.`
          : 'GitHub API rate limit exceeded. Please provide a PAT in advanced settings.',
        'RATE_LIMIT_EXCEEDED',
        403
      );
    }

    throw new GitHubError(
      message ? `GitHub access forbidden: ${message}` : 'GitHub API access was forbidden (HTTP 403).',
      'FORBIDDEN',
      403
    );
  }

  if (response.status === 401) {
    throw new GitHubError(
      token
        ? 'GitHub authentication failed. The provided GitHub Personal Access Token is invalid or expired.'
        : 'GitHub API authentication failed. The server environment token is invalid or expired. Please provide your own GitHub Personal Access Token in advanced settings.',
      'UNAUTHORIZED',
      401
    );
  }

  if (response.status === 404) {
    throw new GitHubError(
      `File tree for "${owner}/${repo}" on branch "${branch}" was not found.`,
      'NOT_FOUND',
      404
    );
  }

  if (!response.ok) {
    throw new GitHubError(
      `Failed to fetch file tree for ${owner}/${repo}@${branch} (${response.status})`,
      'SERVICE_UNAVAILABLE',
      response.status >= 500 ? 503 : response.status
    );
  }

  const data = await response.json();
  if (!Array.isArray(data.tree)) {
    return [];
  }

  const files: GitHubFileEntry[] = [];
  const MAX_FILE_SIZE_BYTES = 500_000; // 500 KB limit to prevent OOM on huge generated files

  for (const item of data.tree) {
    const size = item.size || 0;
    if (item.type === 'blob' && size <= MAX_FILE_SIZE_BYTES && isSupportedSourceFile(item.path)) {
      files.push({
        path: item.path,
        size,
        sha: item.sha,
        language: detectLanguage(item.path),
      });
    }
  }

  return files;
}

/**
 * Fetches raw source code content of a file
 */
export async function fetchGitHubFileContent(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  token?: string
): Promise<string> {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const headers = getGitHubHeaders(token);

  // If PAT is provided or private repo, prioritize authenticated GitHub Contents API
  if (token) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
    const apiResponse = await fetch(apiUrl, { headers });

    if (apiResponse.ok) {
      const data = await apiResponse.json();
      if (data.encoding === 'base64' && data.content) {
        const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
        // Prevent PostgreSQL UTF-8 null byte corruption
        return decoded.includes('\0') ? '' : decoded;
      }
    }
  }

  // Fallback / standard raw content retrieval
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${encodedPath}`;
  try {
    const response = await fetch(rawUrl, { headers });
    if (response.ok) {
      const text = await response.text();
      // Guard against binary files containing null bytes
      return text.includes('\0') ? '' : text;
    }
  } catch {
    // raw fetch failed, continue to contents fallback below
  }

  // Graceful fallback to GitHub Contents API if raw retrieval failed without explicit token
  if (!token) {
    try {
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
      let apiResponse = await fetch(apiUrl, { headers: getGitHubHeaders(undefined) });

      // If server env token failed with 401, retry unauthenticated
      if (apiResponse.status === 401 && (process.env.GITHUB_PAT || process.env.GITHUB_TOKEN)) {
        try {
          const fallback = await fetch(apiUrl, { headers: getGitHubHeaders(undefined, true) });
          apiResponse = fallback;
        } catch {
          // keep original response
        }
      }

      if (apiResponse.ok) {
        const data = await apiResponse.json();
        if (data.encoding === 'base64' && data.content) {
          const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
          return decoded.includes('\0') ? '' : decoded;
        }
      }
    } catch {
      // contents api fallback failed
    }
  }

  return '';
}

/**
 * Fetches recent commit history from GitHub API
 */
export async function fetchGitHubCommits(
  owner: string,
  repo: string,
  branch: string,
  token?: string,
  limit: number = 50
): Promise<CommitRecord[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=${Math.min(
    limit,
    100
  )}`;
  let response: Response;
  try {
    response = await fetch(url, { headers: getGitHubHeaders(token) });
  } catch {
    return [];
  }

  // Graceful degradation: if system environment token is stale/expired and user did not pass custom token, retry unauthenticated
  if (response.status === 401 && !token && (process.env.GITHUB_PAT || process.env.GITHUB_TOKEN)) {
    try {
      const fallback = await fetch(url, { headers: getGitHubHeaders(undefined, true) });
      response = fallback;
    } catch {
      // keep original response
    }
  }

  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const retryAfter = response.headers.get('retry-after');
    let message = '';
    try {
      const data = await response.json();
      message = data.message || '';
    } catch {
      // not json
    }

    const isRateLimit =
      remaining === '0' ||
      response.status === 429 ||
      Boolean(retryAfter) ||
      message.toLowerCase().includes('rate limit') ||
      message.toLowerCase().includes('secondary rate limit') ||
      message.toLowerCase().includes('too many requests');

    if (isRateLimit) {
      throw new GitHubError(
        retryAfter
          ? `GitHub API rate limit exceeded (Retry after ${retryAfter}s).`
          : 'GitHub API rate limit exceeded.',
        'RATE_LIMIT_EXCEEDED',
        403
      );
    }

    throw new GitHubError(
      message ? `GitHub access forbidden: ${message}` : 'GitHub API access was forbidden (HTTP 403).',
      'FORBIDDEN',
      403
    );
  }

  if (response.status === 401) {
    throw new GitHubError(
      token
        ? 'GitHub authentication failed. The provided GitHub Personal Access Token is invalid or expired.'
        : 'GitHub API authentication failed. The server environment token is invalid or expired. Please provide your own GitHub Personal Access Token in advanced settings.',
      'UNAUTHORIZED',
      401
    );
  }

  if (!response.ok) {
    return [];
  }

  const commitsData = await response.json();
  if (!Array.isArray(commitsData)) {
    return [];
  }

  const result: CommitRecord[] = [];

  for (const item of commitsData) {
    const hash = item.sha;
    const message = item.commit?.message || '';
    const author = item.commit?.author?.name || item.author?.login || 'unknown';
    const timestamp = item.commit?.author?.date || new Date().toISOString();

    // Map files changed if included in commit or initialize empty
    const filesChanged: FileChange[] = [];
    if (Array.isArray(item.files)) {
      for (const f of item.files) {
        if (f.filename && isSupportedSourceFile(f.filename)) {
          filesChanged.push({
            path: f.filename,
            added: f.additions || 0,
            deleted: f.deletions || 0,
          });
        }
      }
    }

    result.push({
      hash,
      message,
      author,
      timestamp,
      filesChanged,
    });
  }

  return result;
}

/**
 * Creates an automated GitHub Pull Request applying verified bug remediation patches
 */
export async function createGitHubPullRequest(
  owner: string,
  repo: string,
  defaultBranch: string,
  token: string,
  modifiedFiles: Array<{ filePath: string; content: string }>,
  title: string = 'fix: automated bug fixes by BugPulse AI',
  description: string = 'This PR applies automated code defect fixes generated by BugPulse AI.'
): Promise<{ htmlUrl: string; number: number; branchName: string }> {
  const headers = {
    ...getGitHubHeaders(token),
    'Content-Type': 'application/json',
  };

  // 1. Get base branch commit SHA
  const refRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(defaultBranch)}`,
    { headers }
  );

  if (!refRes.ok) {
    const errText = await refRes.text();
    throw new Error(`Failed to get ref for branch "${defaultBranch}": ${errText}`);
  }

  const refData = await refRes.json();
  const baseSha = refData.object.sha;

  // 2. Create new branch
  const branchName = `bugpulse/fix-defects-${Date.now().toString(36)}`;
  const createRefRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      }),
    }
  );

  if (!createRefRes.ok) {
    const errText = await createRefRes.text();
    throw new Error(`Failed to create branch "${branchName}": ${errText}`);
  }

  // 3. Commit modified files to the new branch
  for (const file of modifiedFiles) {
    // Get existing file sha on the branch
    const encodedPath = file.filePath.split('/').map(encodeURIComponent).join('/');
    const fileRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branchName)}`,
      { headers }
    );

    let fileSha: string | undefined = undefined;
    if (fileRes.ok) {
      const fileData = await fileRes.json();
      fileSha = fileData.sha;
    }

    const base64Content = Buffer.from(file.content, 'utf-8').toString('base64');
    const updateRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: `fix(${file.filePath}): apply BugPulse AI remediation patch`,
          content: base64Content,
          branch: branchName,
          ...(fileSha ? { sha: fileSha } : {}),
        }),
      }
    );

    if (!updateRes.ok) {
      console.warn(`Failed to commit file "${file.filePath}" to branch:`, await updateRes.text());
    }
  }

  // 4. Open Pull Request
  const prRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title,
        head: branchName,
        base: defaultBranch,
        body: description,
      }),
    }
  );

  if (!prRes.ok) {
    const errText = await prRes.text();
    throw new Error(`Failed to open Pull Request: ${errText}`);
  }

  const prData = await prRes.json();
  return {
    htmlUrl: prData.html_url,
    number: prData.number,
    branchName,
  };
}
