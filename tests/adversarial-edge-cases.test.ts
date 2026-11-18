import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseGitHubUrl, isSupportedSourceFile, shouldIgnorePath } from '../lib/github';
import { prisma } from '../lib/prisma';
import { signToken } from '../lib/auth';
import { POST } from '../app/api/repos/analyze/route';
import { buildFormError } from '../components/RepoInputForm';

describe('Adversarial Reviewer Edge Cases & Hardening (R1 & R2)', () => {
  const originalFetch = globalThis.fetch;
  const originalUserFindUnique = prisma.user.findUnique;
  const originalRepoFindUnique = prisma.repository.findUnique;
  const originalRepoUpsert = prisma.repository.upsert;
  const originalRunCreate = prisma.predictionRun.create;
  const originalRunUpdate = prisma.predictionRun.update;

  const validToken = signToken({
    userId: 'usr_edge_1',
    username: 'tester',
    email: 'tester@bugpulse.ai',
  });

  const createRequest = (body: any, auth?: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (auth) {
      headers.authorization = `Bearer ${auth}`;
    }
    return new Request('http://localhost:3000/api/repos/analyze', {
      method: 'POST',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  it('correctly parses various URL formats including SSH, trailing slashes, and spaces', () => {
    assert.deepEqual(parseGitHubUrl('  psf/requests  '), { owner: 'psf', repo: 'requests' });
    assert.deepEqual(parseGitHubUrl('psf / requests'), { owner: 'psf', repo: 'requests' });
    assert.deepEqual(parseGitHubUrl('https://github.com/psf/requests/'), { owner: 'psf', repo: 'requests' });
    assert.deepEqual(parseGitHubUrl('https://github.com/psf/requests.git'), { owner: 'psf', repo: 'requests' });
    assert.deepEqual(parseGitHubUrl('git@github.com:psf/requests.git'), { owner: 'psf', repo: 'requests' });
    assert.deepEqual(parseGitHubUrl('ssh://git@github.com/psf/requests.git'), { owner: 'psf', repo: 'requests' });
    assert.deepEqual(parseGitHubUrl('github.com/psf/requests'), { owner: 'psf', repo: 'requests' });
    assert.deepEqual(parseGitHubUrl('http://github.com/psf/requests'), { owner: 'psf', repo: 'requests' });

    assert.equal(parseGitHubUrl(''), null);
    assert.equal(parseGitHubUrl('   '), null);
    assert.equal(parseGitHubUrl('https://gitlab.com/psf/requests'), null);
    assert.equal(parseGitHubUrl('not_a_valid_repo_path'), null);
  });

  it('rejects completely whitespace repoUrl with 422 VALIDATION_ERROR', async () => {
    (prisma.user as any).findUnique = async () => ({
      id: 'usr_edge_1',
      username: 'tester',
      email: 'tester@bugpulse.ai',
      createdAt: new Date(),
    });

    try {
      const req = createRequest({ repoUrl: '    ' }, validToken);
      const res = await POST(req);
      assert.equal(res.status, 422);
      const data = await res.json();
      assert.equal(data.error.code, 'VALIDATION_ERROR');
    } finally {
      prisma.user.findUnique = originalUserFindUnique;
    }
  });

  it('accepts repoUrl with leading/trailing whitespace and trailing slashes', async () => {
    (prisma.user as any).findUnique = async () => ({
      id: 'usr_edge_1',
      username: 'tester',
      email: 'tester@bugpulse.ai',
      createdAt: new Date(),
    });
    (prisma.repository as any).findUnique = async () => null;
    (prisma.repository as any).upsert = async () => ({
      id: 'repo_edge_1',
      owner: 'psf',
      name: 'requests',
      url: 'https://github.com/psf/requests',
      defaultBranch: 'main',
      isPrivate: false,
    });
    (prisma.predictionRun as any).create = async () => ({
      id: 'run_edge_1',
      repoId: 'repo_edge_1',
      status: 'QUEUED',
    });
    (prisma.predictionRun as any).update = async () => ({});

    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          name: 'requests',
          full_name: 'psf/requests',
          owner: { login: 'psf' },
          default_branch: 'main',
          private: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

    try {
      const req = createRequest({ repoUrl: '   https://github.com/psf/requests/   ' }, validToken);
      const res = await POST(req);
      assert.equal(res.status, 202);
      const data = await res.json();
      assert.equal(data.status, 'QUEUED');
      assert.equal(data.repo.owner, 'psf');
      assert.equal(data.repo.name, 'requests');
      await new Promise((r) => setTimeout(r, 50));
    } finally {
      globalThis.fetch = originalFetch;
      prisma.user.findUnique = originalUserFindUnique;
      prisma.repository.findUnique = originalRepoFindUnique;
      prisma.repository.upsert = originalRepoUpsert;
      prisma.predictionRun.create = originalRunCreate;
      prisma.predictionRun.update = originalRunUpdate;
    }
  });

  it('rejects invalid or unknown ML model with 422 VALIDATION_ERROR', async () => {
    (prisma.user as any).findUnique = async () => ({
      id: 'usr_edge_1',
      username: 'tester',
      email: 'tester@bugpulse.ai',
      createdAt: new Date(),
    });

    try {
      const req = createRequest(
        { repoUrl: 'psf/requests', selectedModel: 'NonExistentModel123' },
        validToken
      );
      const res = await POST(req);
      assert.equal(res.status, 422);
      const data = await res.json();
      assert.equal(data.error.code, 'VALIDATION_ERROR');
      assert.ok(data.error.details?.selectedModel);
    } finally {
      prisma.user.findUnique = originalUserFindUnique;
    }
  });

  it('rejects invalid branch ref with 422 VALIDATION_ERROR', async () => {
    (prisma.user as any).findUnique = async () => ({
      id: 'usr_edge_1',
      username: 'tester',
      email: 'tester@bugpulse.ai',
      createdAt: new Date(),
    });

    try {
      const req = createRequest(
        { repoUrl: 'psf/requests', branch: 'feature/bad ref with spaces!*' },
        validToken
      );
      const res = await POST(req);
      assert.equal(res.status, 422);
      const data = await res.json();
      assert.equal(data.error.code, 'VALIDATION_ERROR');
      assert.ok(data.error.details?.branch);
    } finally {
      prisma.user.findUnique = originalUserFindUnique;
    }
  });

  it('handles server 500 error from GitHub API gracefully as 503 SERVICE_UNAVAILABLE', async () => {
    (prisma.user as any).findUnique = async () => ({
      id: 'usr_edge_1',
      username: 'tester',
      email: 'tester@bugpulse.ai',
      createdAt: new Date(),
    });

    globalThis.fetch = async () =>
      new Response('Internal Server Error from upstream', {
        status: 500,
        statusText: 'Internal Server Error',
      });

    try {
      const req = createRequest({ repoUrl: 'psf/requests' }, validToken);
      const res = await POST(req);
      assert.equal(res.status, 503);
      const data = await res.json();
      assert.equal(data.error.code, 'SERVICE_UNAVAILABLE');
    } finally {
      globalThis.fetch = originalFetch;
      prisma.user.findUnique = originalUserFindUnique;
    }
  });

  it('buildFormError handles null, undefined, string, and malformed data objects without crashing', () => {
    const errNull = buildFormError(500, null);
    assert.equal(errNull.code, 'HTTP_500');
    assert.equal(errNull.actionText, 'Retry Analysis');

    const errUndefined = buildFormError(503, undefined);
    assert.equal(errUndefined.code, 'SERVICE_UNAVAILABLE');
    assert.equal(errUndefined.actionText, 'Retry Analysis');

    const errString = buildFormError(404, 'String response');
    assert.equal(errString.code, 'NOT_FOUND');
    assert.equal(errString.message, 'String response');
    assert.equal(errString.actionText, 'Add Access Token for Private Repo');

    const errNoCode = buildFormError(403, { error: { message: 'Forbidden' } });
    assert.equal(errNoCode.code, 'FORBIDDEN');
    assert.equal(errNoCode.actionText, 'Configure GitHub Token');
  });
});
