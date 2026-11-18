import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseGitHubUrl, isSupportedSourceFile, shouldIgnorePath } from '../lib/github';
import { getOrGenerateFileDefects } from '../lib/metrics/defect-inspector';
import { prisma } from '../lib/prisma';
import { signToken } from '../lib/auth';
import { POST } from '../app/api/repos/analyze/route';

describe('Repository Analysis & Ingestion Logic (TDD)', () => {
  it('validates and formats repository URLs correctly', () => {
    const valid1 = parseGitHubUrl('https://github.com/torvalds/linux');
    assert.deepEqual(valid1, { owner: 'torvalds', repo: 'linux' });

    const valid2 = parseGitHubUrl('expressjs/express');
    assert.deepEqual(valid2, { owner: 'expressjs', repo: 'express' });

    const invalid = parseGitHubUrl('https://other-site.com/foo/bar');
    assert.equal(invalid, null);
  });

  it('filters source files accurately while skipping vendor assets', () => {
    const files = [
      'src/server.ts',
      'src/utils.py',
      'node_modules/lodash/index.js',
      'package-lock.json',
      'docs/guide.md',
      'lib/math.rs',
      'app/main.go',
    ];

    const filtered = files.filter((f) => isSupportedSourceFile(f) && !shouldIgnorePath(f));
    assert.deepEqual(filtered, [
      'src/server.ts',
      'src/utils.py',
      'lib/math.rs',
      'app/main.go',
    ]);
  });

  it('generates concrete defect remediation items with line numbers and before/after fixes', () => {
    const defects = getOrGenerateFileDefects('src/services/payment.ts', undefined, 'typescript', 12);
    assert.ok(defects.length > 0);
    const branchDefect = defects.find((d) => d.category === 'COMPLEX_BRANCHING');
    assert.ok(branchDefect);
    assert.ok(branchDefect.lineNumber > 0);
    assert.ok(branchDefect.cause.includes('McCabe complexity'));
    assert.ok(branchDefect.remediedCodeSnippet.includes('Strategy Pattern') || branchDefect.remediedCodeSnippet.includes('Guard Clauses'));
    assert.ok(branchDefect.buggyCodeSnippet.length > 0);
  });

  describe('POST /api/repos/analyze Route & Error Differentiation', () => {
    const originalFetch = globalThis.fetch;
    const originalUserFindUnique = prisma.user.findUnique;
    const originalRepoFindUnique = prisma.repository.findUnique;
    const originalRepoUpsert = prisma.repository.upsert;
    const originalRunCreate = prisma.predictionRun.create;
    const originalRunUpdate = prisma.predictionRun.update;

    const validAuthToken = signToken({
      userId: 'usr_mock_1',
      username: 'analyst',
      email: 'analyst@bugpulse.ai',
    });

    const createRequest = (body: any, token?: string) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.authorization = `Bearer ${token}`;
      }
      return new Request('http://localhost:3000/api/repos/analyze', {
        method: 'POST',
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    };

    it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
      const req = createRequest({ repoUrl: 'psf/requests' });
      const res = await POST(req);
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error.code, 'UNAUTHORIZED');
    });

    it('rejects empty or invalid parameters with 422 VALIDATION_ERROR', async () => {
      (prisma.user as any).findUnique = async () => ({
        id: 'usr_mock_1',
        username: 'analyst',
        email: 'analyst@bugpulse.ai',
        createdAt: new Date(),
      });

      try {
        const req = createRequest({ repoUrl: '' }, validAuthToken);
        const res = await POST(req);
        assert.equal(res.status, 422);
        const data = await res.json();
        assert.equal(data.error.code, 'VALIDATION_ERROR');
      } finally {
        prisma.user.findUnique = originalUserFindUnique;
      }
    });

    it('rejects malformed GitHub URLs with 422 VALIDATION_ERROR', async () => {
      (prisma.user as any).findUnique = async () => ({
        id: 'usr_mock_1',
        username: 'analyst',
        email: 'analyst@bugpulse.ai',
        createdAt: new Date(),
      });

      try {
        const req = createRequest({ repoUrl: 'https://gitlab.com/unknown/repo' }, validAuthToken);
        const res = await POST(req);
        assert.equal(res.status, 422);
        const data = await res.json();
        assert.equal(data.error.code, 'VALIDATION_ERROR');
      } finally {
        prisma.user.findUnique = originalUserFindUnique;
      }
    });

    it('differentiates non-existent or private repos with HTTP 404 NOT_FOUND', async () => {
      (prisma.user as any).findUnique = async () => ({
        id: 'usr_mock_1',
        username: 'analyst',
        email: 'analyst@bugpulse.ai',
        createdAt: new Date(),
      });

      globalThis.fetch = async () =>
        new Response(JSON.stringify({ message: 'Not Found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });

      try {
        const req = createRequest({ repoUrl: 'owner/nonexistent-repo' }, validAuthToken);
        const res = await POST(req);
        assert.equal(res.status, 404);
        const data = await res.json();
        assert.equal(data.error.code, 'NOT_FOUND');
      } finally {
        globalThis.fetch = originalFetch;
        prisma.user.findUnique = originalUserFindUnique;
      }
    });

    it('differentiates rate limit errors with HTTP 403 RATE_LIMIT_EXCEEDED (not 404)', async () => {
      (prisma.user as any).findUnique = async () => ({
        id: 'usr_mock_1',
        username: 'analyst',
        email: 'analyst@bugpulse.ai',
        createdAt: new Date(),
      });

      globalThis.fetch = async () =>
        new Response(JSON.stringify({ message: 'API rate limit exceeded for ip' }), {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'x-ratelimit-remaining': '0',
          },
        });

      try {
        const req = createRequest({ repoUrl: 'facebook/react' }, validAuthToken);
        const res = await POST(req);
        assert.equal(res.status, 403);
        assert.notEqual(res.status, 404);
        const data = await res.json();
        assert.equal(data.error.code, 'RATE_LIMIT_EXCEEDED');
      } finally {
        globalThis.fetch = originalFetch;
        prisma.user.findUnique = originalUserFindUnique;
      }
    });

    it('differentiates network and connection failures with HTTP 503 SERVICE_UNAVAILABLE (not 404)', async () => {
      (prisma.user as any).findUnique = async () => ({
        id: 'usr_mock_1',
        username: 'analyst',
        email: 'analyst@bugpulse.ai',
        createdAt: new Date(),
      });

      globalThis.fetch = async () => {
        throw new TypeError('fetch failed: getaddrinfo ENOTFOUND api.github.com');
      };

      try {
        const req = createRequest({ repoUrl: 'psf/requests' }, validAuthToken);
        const res = await POST(req);
        // CRITICAL CHECK: must NOT return 404 on network failure
        assert.equal(res.status, 503);
        assert.notEqual(res.status, 404);
        const data = await res.json();
        assert.equal(data.error.code, 'SERVICE_UNAVAILABLE');
      } finally {
        globalThis.fetch = originalFetch;
        prisma.user.findUnique = originalUserFindUnique;
      }
    });

    it('differentiates invalid GitHub token with HTTP 401 UNAUTHORIZED from GitHub (not 404)', async () => {
      (prisma.user as any).findUnique = async () => ({
        id: 'usr_mock_1',
        username: 'analyst',
        email: 'analyst@bugpulse.ai',
        createdAt: new Date(),
      });

      globalThis.fetch = async () =>
        new Response(JSON.stringify({ message: 'Bad credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });

      try {
        const req = createRequest(
          { repoUrl: 'psf/requests', githubToken: 'ghp_invalid_expired_token' },
          validAuthToken
        );
        const res = await POST(req);
        assert.equal(res.status, 401);
        assert.notEqual(res.status, 404);
        const data = await res.json();
        assert.equal(data.error.code, 'UNAUTHORIZED');
        assert.ok(data.error.message.includes('GitHub authentication failed'));
      } finally {
        globalThis.fetch = originalFetch;
        prisma.user.findUnique = originalUserFindUnique;
      }
    });

    it('differentiates forbidden or SAML SSO enforcement with HTTP 403 FORBIDDEN', async () => {
      (prisma.user as any).findUnique = async () => ({
        id: 'usr_mock_1',
        username: 'analyst',
        email: 'analyst@bugpulse.ai',
        createdAt: new Date(),
      });

      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            message: 'Resource protected by organization SAML enforcement. You must grant your personal access token access to this organization.',
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'x-github-sso': 'required; url=https://github.com/orgs/my-org/sso',
              'x-ratelimit-remaining': '4990',
            },
          }
        );

      try {
        const req = createRequest({ repoUrl: 'enterprise-org/private-repo' }, validAuthToken);
        const res = await POST(req);
        assert.equal(res.status, 403);
        assert.notEqual(res.status, 404);
        const data = await res.json();
        assert.equal(data.error.code, 'FORBIDDEN');
        assert.ok(data.error.message.includes('SAML'));
      } finally {
        globalThis.fetch = originalFetch;
        prisma.user.findUnique = originalUserFindUnique;
      }
    });

    it('handles secondary rate limit with Retry-After header without unhandled 404', async () => {
      (prisma.user as any).findUnique = async () => ({
        id: 'usr_mock_1',
        username: 'analyst',
        email: 'analyst@bugpulse.ai',
        createdAt: new Date(),
      });

      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            message: 'You have exceeded a secondary rate limit. Please wait a few minutes before you try again.',
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'retry-after': '30',
              'x-ratelimit-remaining': '40',
            },
          }
        );

      try {
        const req = createRequest({ repoUrl: 'facebook/react' }, validAuthToken);
        const res = await POST(req);
        assert.equal(res.status, 403);
        assert.notEqual(res.status, 404);
        const data = await res.json();
        assert.equal(data.error.code, 'RATE_LIMIT_EXCEEDED');
        assert.ok(data.error.message.includes('Retry after 30s'));
      } finally {
        globalThis.fetch = originalFetch;
        prisma.user.findUnique = originalUserFindUnique;
      }
    });

    it('rejects malformed or empty request body with 422 VALIDATION_ERROR', async () => {
      (prisma.user as any).findUnique = async () => ({
        id: 'usr_mock_1',
        username: 'analyst',
        email: 'analyst@bugpulse.ai',
        createdAt: new Date(),
      });

      try {
        const req = new Request('http://localhost:3000/api/repos/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${validAuthToken}`,
          },
          body: 'not a valid json string {',
        });
        const res = await POST(req);
        assert.equal(res.status, 422);
        const data = await res.json();
        assert.equal(data.error.code, 'VALIDATION_ERROR');
        assert.ok(data.error.message.includes('JSON'));
      } finally {
        prisma.user.findUnique = originalUserFindUnique;
      }
    });

    it('rejects invalid GitHub token format with 422 and structured details', async () => {
      (prisma.user as any).findUnique = async () => ({
        id: 'usr_mock_1',
        username: 'analyst',
        email: 'analyst@bugpulse.ai',
        createdAt: new Date(),
      });

      try {
        const req = createRequest(
          { repoUrl: 'psf/requests', githubToken: 'invalid token with spaces!' },
          validAuthToken
        );
        const res = await POST(req);
        assert.equal(res.status, 422);
        const data = await res.json();
        assert.equal(data.error.code, 'VALIDATION_ERROR');
        assert.ok(data.error.details.githubToken);
      } finally {
        prisma.user.findUnique = originalUserFindUnique;
      }
    });

    it('accepts empty string optional parameters (githubToken, branch, nvidiaApiKey) without validation error', async () => {
      (prisma.user as any).findUnique = async () => ({
        id: 'usr_mock_1',
        username: 'analyst',
        email: 'analyst@bugpulse.ai',
        createdAt: new Date(),
      });
      (prisma.repository as any).findUnique = async () => null;
      (prisma.repository as any).upsert = async () => ({
        id: 'repo_mock_empty_params',
        owner: 'psf',
        name: 'requests',
        url: 'https://github.com/psf/requests',
        defaultBranch: 'main',
        isPrivate: false,
      });
      (prisma.predictionRun as any).create = async () => ({
        id: 'run_mock_empty_params',
        repoId: 'repo_mock_empty_params',
        status: 'QUEUED',
      });
      (prisma.predictionRun as any).update = async () => ({});

      globalThis.fetch = async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/repos/psf/requests/git/trees')) {
          return new Response(JSON.stringify({ tree: [] }), { status: 200 });
        }
        if (urlStr.includes('/repos/psf/requests/commits')) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response(
          JSON.stringify({
            name: 'requests',
            full_name: 'psf/requests',
            owner: { login: 'psf' },
            default_branch: 'main',
            private: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      try {
        const req = createRequest(
            {
              repoUrl: 'psf/requests',
              githubToken: '',
              branch: '   ',
              nvidiaApiKey: '',
            },
            validAuthToken
          );
        const res = await POST(req);
        assert.equal(res.status, 202);
        const data = await res.json();
        assert.equal(data.status, 'QUEUED');
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

    it('accepts null optional parameters (githubToken, branch, nvidiaApiKey, selectedModel) without validation error', async () => {
      (prisma.user as any).findUnique = async () => ({
        id: 'usr_mock_1',
        username: 'analyst',
        email: 'analyst@bugpulse.ai',
        createdAt: new Date(),
      });
      (prisma.repository as any).findUnique = async () => null;
      (prisma.repository as any).upsert = async () => ({
        id: 'repo_mock_null_params',
        owner: 'psf',
        name: 'requests',
        url: 'https://github.com/psf/requests',
        defaultBranch: 'main',
        isPrivate: false,
      });
      (prisma.predictionRun as any).create = async () => ({
        id: 'run_mock_null_params',
        repoId: 'repo_mock_null_params',
        status: 'QUEUED',
      });
      (prisma.predictionRun as any).update = async () => ({});

      globalThis.fetch = async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/repos/psf/requests/git/trees')) {
          return new Response(JSON.stringify({ tree: [] }), { status: 200 });
        }
        if (urlStr.includes('/repos/psf/requests/commits')) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response(
          JSON.stringify({
            name: 'requests',
            full_name: 'psf/requests',
            owner: { login: 'psf' },
            default_branch: 'main',
            private: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      try {
        const req = createRequest(
          {
            repoUrl: 'psf/requests',
            githubToken: null,
            branch: null,
            nvidiaApiKey: null,
            selectedModel: null,
          },
          validAuthToken
        );
        const res = await POST(req);
        assert.equal(res.status, 202);
        const data = await res.json();
        assert.equal(data.status, 'QUEUED');
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

    it('accepts empty string selectedModel and defaults to AutoSelectBest', async () => {
      (prisma.user as any).findUnique = async () => ({
        id: 'usr_mock_1',
        username: 'analyst',
        email: 'analyst@bugpulse.ai',
        createdAt: new Date(),
      });
      (prisma.repository as any).findUnique = async () => null;
      (prisma.repository as any).upsert = async () => ({
        id: 'repo_mock_empty_model',
        owner: 'psf',
        name: 'requests',
        url: 'https://github.com/psf/requests',
        defaultBranch: 'main',
        isPrivate: false,
      });
      (prisma.predictionRun as any).create = async (args: any) => {
        assert.equal(args.data.modelType, 'AutoSelectBest');
        return {
          id: 'run_mock_empty_model',
          repoId: 'repo_mock_empty_model',
          status: 'QUEUED',
        };
      };
      (prisma.predictionRun as any).update = async () => ({});

      globalThis.fetch = async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/repos/psf/requests/git/trees')) {
          return new Response(JSON.stringify({ tree: [] }), { status: 200 });
        }
        if (urlStr.includes('/repos/psf/requests/commits')) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response(
          JSON.stringify({
            name: 'requests',
            full_name: 'psf/requests',
            owner: { login: 'psf' },
            default_branch: 'main',
            private: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      try {
        const req = createRequest(
          {
            repoUrl: 'psf/requests',
            selectedModel: '',
          },
          validAuthToken
        );
        const res = await POST(req);
        assert.equal(res.status, 202);
        const data = await res.json();
        assert.equal(data.status, 'QUEUED');
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

    it('differentiates network host not found failures with HTTP 503 SERVICE_UNAVAILABLE (not 404)', async () => {
      (prisma.user as any).findUnique = async () => ({
        id: 'usr_mock_1',
        username: 'analyst',
        email: 'analyst@bugpulse.ai',
        createdAt: new Date(),
      });

      // Simulate a generic non-GitHubError Error whose message contains "Host not found"
      globalThis.fetch = async () => {
        throw new Error('Network error: Host not found: api.github.com');
      };

      try {
        const req = createRequest({ repoUrl: 'psf/requests' }, validAuthToken);
        const res = await POST(req);
        // CRITICAL CHECK: must NOT return 404 on network "Host not found" error
        assert.equal(res.status, 503);
        assert.notEqual(res.status, 404);
        const data = await res.json();
        assert.equal(data.error.code, 'SERVICE_UNAVAILABLE');
      } finally {
        globalThis.fetch = originalFetch;
        prisma.user.findUnique = originalUserFindUnique;
      }
    });

    it('accepts and normalizes model aliases (MLP_NeuralNet, SoftVotingEnsemble) and StackingEnsemble', async () => {
      (prisma.user as any).findUnique = async () => ({
        id: 'usr_mock_1',
        username: 'analyst',
        email: 'analyst@bugpulse.ai',
        createdAt: new Date(),
      });
      (prisma.repository as any).findUnique = async () => null;
      (prisma.repository as any).upsert = async () => ({
        id: 'repo_mock_model_alias',
        owner: 'psf',
        name: 'requests',
        url: 'https://github.com/psf/requests',
        defaultBranch: 'main',
        isPrivate: false,
      });

      const capturedModels: string[] = [];
      (prisma.predictionRun as any).create = async (args: any) => {
        capturedModels.push(args.data.modelType);
        return {
          id: `run_mock_${capturedModels.length}`,
          repoId: 'repo_mock_model_alias',
          status: 'QUEUED',
        };
      };
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
        // 1. MLP_NeuralNet -> NeuralNetwork_MLP
        const req1 = createRequest(
          { repoUrl: 'psf/requests', selectedModel: 'MLP_NeuralNet' },
          validAuthToken
        );
        const res1 = await POST(req1);
        assert.equal(res1.status, 202);

        // 2. SoftVotingEnsemble -> VotingEnsemble
        const req2 = createRequest(
          { repoUrl: 'psf/requests', selectedModel: 'SoftVotingEnsemble' },
          validAuthToken
        );
        const res2 = await POST(req2);
        assert.equal(res2.status, 202);

        // 3. StackingEnsemble
        const req3 = createRequest(
          { repoUrl: 'psf/requests', selectedModel: 'StackingEnsemble' },
          validAuthToken
        );
        const res3 = await POST(req3);
        assert.equal(res3.status, 202);

        assert.deepEqual(capturedModels, [
          'NeuralNetwork_MLP',
          'VotingEnsemble',
          'StackingEnsemble',
        ]);
      } finally {
        globalThis.fetch = originalFetch;
        prisma.user.findUnique = originalUserFindUnique;
        prisma.repository.findUnique = originalRepoFindUnique;
        prisma.repository.upsert = originalRepoUpsert;
        prisma.predictionRun.create = originalRunCreate;
        prisma.predictionRun.update = originalRunUpdate;
      }
    });

    it('successfully queues analysis for valid repository without unhandled 404', async () => {
      (prisma.user as any).findUnique = async () => ({
        id: 'usr_mock_1',
        username: 'analyst',
        email: 'analyst@bugpulse.ai',
        createdAt: new Date(),
      });
      (prisma.repository as any).findUnique = async () => null;
      (prisma.repository as any).upsert = async () => ({
        id: 'repo_mock_1',
        owner: 'psf',
        name: 'requests',
        url: 'https://github.com/psf/requests',
        defaultBranch: 'main',
        isPrivate: false,
      });
      (prisma.predictionRun as any).create = async () => ({
        id: 'run_mock_1',
        repoId: 'repo_mock_1',
        status: 'QUEUED',
      });
      (prisma.predictionRun as any).update = async () => ({});

      globalThis.fetch = async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/repos/psf/requests/git/trees')) {
          return new Response(JSON.stringify({ tree: [] }), { status: 200 });
        }
        if (urlStr.includes('/repos/psf/requests/commits')) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response(
          JSON.stringify({
            name: 'requests',
            full_name: 'psf/requests',
            owner: { login: 'psf' },
            default_branch: 'main',
            private: false,
            description: 'Python HTTP for Humans.',
            stargazers_count: 50000,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      try {
        const req = createRequest({ repoUrl: 'https://github.com/psf/requests' }, validAuthToken);
        const res = await POST(req);
        assert.equal(res.status, 202);
        assert.notEqual(res.status, 404);
        const data = await res.json();
        assert.equal(data.status, 'QUEUED');
        assert.equal(data.analysisId, 'run_mock_1');
        assert.equal(data.repo.owner, 'psf');
        assert.equal(data.repo.name, 'requests');
        // Allow background promises to resolve cleanly
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

    it('authenticates POST /api/repos/analyze via cookie auth_token after user login', async () => {
      (prisma.user as any).findUnique = async () => ({
        id: 'usr_mock_1',
        username: 'analyst',
        email: 'analyst@bugpulse.ai',
        createdAt: new Date(),
      });
      (prisma.repository as any).findUnique = async () => null;
      (prisma.repository as any).upsert = async () => ({
        id: 'repo_mock_cookie_auth',
        owner: 'psf',
        name: 'requests',
        url: 'https://github.com/psf/requests',
        defaultBranch: 'main',
        isPrivate: false,
      });
      (prisma.predictionRun as any).create = async () => ({
        id: 'run_mock_cookie_auth',
        repoId: 'repo_mock_cookie_auth',
        status: 'QUEUED',
      });
      (prisma.predictionRun as any).update = async () => ({});

      globalThis.fetch = async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/repos/psf/requests/git/trees')) {
          return new Response(JSON.stringify({ tree: [] }), { status: 200 });
        }
        if (urlStr.includes('/repos/psf/requests/commits')) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response(
          JSON.stringify({
            name: 'requests',
            full_name: 'psf/requests',
            owner: { login: 'psf' },
            default_branch: 'main',
            private: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      try {
        const req = new Request('http://localhost:3000/api/repos/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: `auth_token=${validAuthToken}`,
          },
          body: JSON.stringify({ repoUrl: 'psf/requests' }),
        });
        const res = await POST(req);
        assert.equal(res.status, 202);
        const data = await res.json();
        assert.equal(data.status, 'QUEUED');
        assert.equal(data.analysisId, 'run_mock_cookie_auth');
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

    it('rejects POST /api/repos/analyze with invalid or forged cookie auth_token', async () => {
      const req = new Request('http://localhost:3000/api/repos/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: 'auth_token=invalid.tampered.jwt_token',
        },
        body: JSON.stringify({ repoUrl: 'psf/requests' }),
      });
      const res = await POST(req);
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error.code, 'UNAUTHORIZED');
    });

    it('accepts and trims whitespace-padded model names and aliases', async () => {
      (prisma.user as any).findUnique = async () => ({
        id: 'usr_mock_1',
        username: 'analyst',
        email: 'analyst@bugpulse.ai',
        createdAt: new Date(),
      });
      (prisma.repository as any).findUnique = async () => null;
      (prisma.repository as any).upsert = async () => ({
        id: 'repo_mock_padded',
        owner: 'psf',
        name: 'requests',
        url: 'https://github.com/psf/requests',
        defaultBranch: 'main',
        isPrivate: false,
      });

      const modelsReceived: string[] = [];
      (prisma.predictionRun as any).create = async (args: any) => {
        modelsReceived.push(args.data.modelType);
        return {
          id: `run_mock_padded_${modelsReceived.length}`,
          repoId: 'repo_mock_padded',
          status: 'QUEUED',
        };
      };
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
        const req1 = createRequest(
          { repoUrl: 'psf/requests', selectedModel: '  RandomForest  ' },
          validAuthToken
        );
        const res1 = await POST(req1);
        assert.equal(res1.status, 202);

        const req2 = createRequest(
          { repoUrl: 'psf/requests', selectedModel: '  MLP_NeuralNet  ' },
          validAuthToken
        );
        const res2 = await POST(req2);
        assert.equal(res2.status, 202);

        assert.deepEqual(modelsReceived, ['RandomForest', 'NeuralNetwork_MLP']);
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
  });
});

