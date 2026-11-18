import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGitHubUrl,
  isSupportedSourceFile,
  shouldIgnorePath,
  fetchGitHubRepoMetadata,
  fetchGitHubRepoTree,
  fetchGitHubFileContent,
  GitHubError,
} from '../lib/github';

describe('GitHub Ingestion & Analysis Helpers (TDD)', () => {
  describe('parseGitHubUrl', () => {
    it('parses standard https github URL', () => {
      const parsed = parseGitHubUrl('https://github.com/facebook/react');
      assert.deepEqual(parsed, { owner: 'facebook', repo: 'react' });
    });

    it('parses URLs with .git suffix', () => {
      const parsed = parseGitHubUrl('https://github.com/pallets/flask.git');
      assert.deepEqual(parsed, { owner: 'pallets', repo: 'flask' });
    });

    it('parses owner/repo shorthand strings', () => {
      const parsed = parseGitHubUrl('psf/requests');
      assert.deepEqual(parsed, { owner: 'psf', repo: 'requests' });

      const parsedWithSpaces = parseGitHubUrl('psf / requests');
      assert.deepEqual(parsedWithSpaces, { owner: 'psf', repo: 'requests' });
    });

    it('parses URLs with trailing slashes or subpaths', () => {
      const parsed = parseGitHubUrl('https://github.com/torvalds/linux/');
      assert.deepEqual(parsed, { owner: 'torvalds', repo: 'linux' });
    });

    it('parses SSH clone URLs and git protocols', () => {
      const ssh1 = parseGitHubUrl('git@github.com:psf/requests.git');
      assert.deepEqual(ssh1, { owner: 'psf', repo: 'requests' });

      const ssh2 = parseGitHubUrl('git@github.com:pallets/flask');
      assert.deepEqual(ssh2, { owner: 'pallets', repo: 'flask' });

      const gitProto = parseGitHubUrl('git://github.com/facebook/react.git');
      assert.deepEqual(gitProto, { owner: 'facebook', repo: 'react' });
    });

    it('returns null for invalid non-github URLs', () => {
      assert.equal(parseGitHubUrl('https://gitlab.com/owner/repo'), null);
      assert.equal(parseGitHubUrl('not-a-url'), null);
      assert.equal(parseGitHubUrl(''), null);
    });
  });

  describe('isSupportedSourceFile', () => {
    it('recognizes supported code files across 15+ languages', () => {
      assert.equal(isSupportedSourceFile('src/index.ts'), true);
      assert.equal(isSupportedSourceFile('src/App.tsx'), true);
      assert.equal(isSupportedSourceFile('main.py'), true);
      assert.equal(isSupportedSourceFile('server.go'), true);
      assert.equal(isSupportedSourceFile('lib.rs'), true);
      assert.equal(isSupportedSourceFile('App.java'), true);
      assert.equal(isSupportedSourceFile('kernel.c'), true);
      assert.equal(isSupportedSourceFile('engine.cpp'), true);
      assert.equal(isSupportedSourceFile('controller.php'), true);
      assert.equal(isSupportedSourceFile('model.rb'), true);
      assert.equal(isSupportedSourceFile('App.swift'), true);
      assert.equal(isSupportedSourceFile('MainActivity.kt'), true);
      assert.equal(isSupportedSourceFile('Worker.cs'), true);
      assert.equal(isSupportedSourceFile('Service.scala'), true);
    });

    it('rejects unsupported files like binaries, images, docs, and lockfiles', () => {
      assert.equal(isSupportedSourceFile('image.png'), false);
      assert.equal(isSupportedSourceFile('README.md'), false);
      assert.equal(isSupportedSourceFile('package.json'), false);
      assert.equal(isSupportedSourceFile('yarn.lock'), false);
      assert.equal(isSupportedSourceFile('binary.exe'), false);
      assert.equal(isSupportedSourceFile('lib.so'), false);
      assert.equal(isSupportedSourceFile('.gitignore'), false);
    });
  });

  describe('shouldIgnorePath', () => {
    it('ignores dependencies and build directories', () => {
      assert.equal(shouldIgnorePath('node_modules/express/index.js'), true);
      assert.equal(shouldIgnorePath('.git/config'), true);
      assert.equal(shouldIgnorePath('dist/bundle.js'), true);
      assert.equal(shouldIgnorePath('build/output.js'), true);
      assert.equal(shouldIgnorePath('.venv/lib/python3.11/site-packages/os.py'), true);
      assert.equal(shouldIgnorePath('target/debug/app.rs'), true);
      assert.equal(shouldIgnorePath('vendor/bundle/ruby.rb'), true);
    });

    it('does not ignore valid source code in application directories', () => {
      assert.equal(shouldIgnorePath('src/controllers/auth.ts'), false);
      assert.equal(shouldIgnorePath('app/api/route.ts'), false);
      assert.equal(shouldIgnorePath('pkg/server/handler.go'), false);
      assert.equal(shouldIgnorePath('backend/models/user.py'), false);
    });
  });

  describe('fetchGitHubRepoMetadata & Error Differentiation', () => {
    const originalFetch = globalThis.fetch;

    it('returns parsed metadata on successful 200 response', async () => {
      globalThis.fetch = async () =>
        new Response(
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

      try {
        const meta = await fetchGitHubRepoMetadata('psf', 'requests');
        assert.equal(meta.owner, 'psf');
        assert.equal(meta.repo, 'requests');
        assert.equal(meta.defaultBranch, 'main');
        assert.equal(meta.isPrivate, false);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('throws GitHubError with NOT_FOUND and 404 for missing or private repos', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ message: 'Not Found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });

      try {
        await assert.rejects(
          async () => fetchGitHubRepoMetadata('nonexistent', 'repo-xyz'),
          (err: any) => {
            assert.ok(err instanceof GitHubError);
            assert.equal(err.code, 'NOT_FOUND');
            assert.equal(err.status, 404);
            assert.ok(err.message.includes('not found or is private'));
            return true;
          }
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('throws GitHubError with RATE_LIMIT_EXCEEDED and 403 when x-ratelimit-remaining is 0', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'x-ratelimit-remaining': '0',
          },
        });

      try {
        await assert.rejects(
          async () => fetchGitHubRepoMetadata('facebook', 'react'),
          (err: any) => {
            assert.ok(err instanceof GitHubError);
            assert.equal(err.code, 'RATE_LIMIT_EXCEEDED');
            assert.equal(err.status, 403);
            return true;
          }
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('throws GitHubError with RATE_LIMIT_EXCEEDED on 429 Too Many Requests', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ message: 'Too Many Requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });

      try {
        await assert.rejects(
          async () => fetchGitHubRepoMetadata('pallets', 'flask'),
          (err: any) => {
            assert.ok(err instanceof GitHubError);
            assert.equal(err.code, 'RATE_LIMIT_EXCEEDED');
            assert.equal(err.status, 403);
            return true;
          }
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('throws GitHubError with UNAUTHORIZED and 401 when token is invalid', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ message: 'Bad credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });

      try {
        await assert.rejects(
          async () => fetchGitHubRepoMetadata('private', 'secret-repo', 'invalid_token'),
          (err: any) => {
            assert.ok(err instanceof GitHubError);
            assert.equal(err.code, 'UNAUTHORIZED');
            assert.equal(err.status, 401);
            return true;
          }
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('throws GitHubError with NETWORK_ERROR and 503 when network fetch fails', async () => {
      globalThis.fetch = async () => {
        throw new TypeError('fetch failed: getaddrinfo ENOTFOUND api.github.com');
      };

      try {
        await assert.rejects(
          async () => fetchGitHubRepoMetadata('torvalds', 'linux'),
          (err: any) => {
            assert.ok(err instanceof GitHubError);
            assert.equal(err.code, 'NETWORK_ERROR');
            assert.equal(err.status, 503);
            assert.ok(err.message.includes('Network error'));
            return true;
          }
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('throws GitHubError with SERVICE_UNAVAILABLE and 503 on GitHub 5xx errors', async () => {
      globalThis.fetch = async () =>
        new Response('Service Unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
        });

      try {
        await assert.rejects(
          async () => fetchGitHubRepoMetadata('golang', 'go'),
          (err: any) => {
            assert.ok(err instanceof GitHubError);
            assert.equal(err.code, 'SERVICE_UNAVAILABLE');
            assert.equal(err.status, 503);
            return true;
          }
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('throws GitHubError with RATE_LIMIT_EXCEEDED and 403 when Retry-After header is present (secondary rate limit)', async () => {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            message: 'You have exceeded a secondary rate limit. Please wait a few minutes before you try again.',
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'retry-after': '60',
              'x-ratelimit-remaining': '50',
            },
          }
        );

      try {
        await assert.rejects(
          async () => fetchGitHubRepoMetadata('octocat', 'Hello-World'),
          (err: any) => {
            assert.ok(err instanceof GitHubError);
            assert.equal(err.code, 'RATE_LIMIT_EXCEEDED');
            assert.equal(err.status, 403);
            assert.ok(err.message.includes('Retry after 60s'));
            return true;
          }
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('throws GitHubError with FORBIDDEN and 403 when repository access is blocked by SAML SSO or forbidden', async () => {
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
        await assert.rejects(
          async () => fetchGitHubRepoMetadata('enterprise-org', 'private-repo'),
          (err: any) => {
            assert.ok(err instanceof GitHubError);
            assert.equal(err.code, 'FORBIDDEN');
            assert.equal(err.status, 403);
            assert.ok(err.message.includes('SAML'));
            return true;
          }
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('fetchGitHubRepoTree throws GitHubError with UNAUTHORIZED on 401 response', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ message: 'Bad credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });

      try {
        await assert.rejects(
          async () => fetchGitHubRepoTree('owner', 'repo', 'main', 'expired_token'),
          (err: any) => {
            assert.ok(err instanceof GitHubError);
            assert.equal(err.code, 'UNAUTHORIZED');
            assert.equal(err.status, 401);
            return true;
          }
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('fetchGitHubRepoTree throws GitHubError with RATE_LIMIT_EXCEEDED on 429 response', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ message: 'Too Many Requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });

      try {
        await assert.rejects(
          async () => fetchGitHubRepoTree('owner', 'repo', 'main'),
          (err: any) => {
            assert.ok(err instanceof GitHubError);
            assert.equal(err.code, 'RATE_LIMIT_EXCEEDED');
            assert.equal(err.status, 403);
            return true;
          }
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('falls back to unauthenticated fetch and returns 404 NOT_FOUND when server token returns 401 on missing public repo', async () => {
      const originalToken = process.env.GITHUB_TOKEN;
      process.env.GITHUB_TOKEN = 'stale_expired_system_token';

      let callCount = 0;
      globalThis.fetch = async (_url: any, options: any) => {
        callCount++;
        // First call with system token returns 401 Bad credentials
        if (options?.headers?.Authorization) {
          return new Response(JSON.stringify({ message: 'Bad credentials' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        // Second unauthenticated fallback call returns 404
        return new Response(JSON.stringify({ message: 'Not Found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      try {
        await assert.rejects(
          async () => fetchGitHubRepoMetadata('torvalds', 'nonexistent-linux-fork'),
          (err: any) => {
            assert.ok(err instanceof GitHubError);
            // Must accurately return NOT_FOUND (404), NOT 401 Bad credentials
            assert.equal(err.code, 'NOT_FOUND');
            assert.equal(err.status, 404);
            return true;
          }
        );
        assert.equal(callCount, 2);
      } finally {
        globalThis.fetch = originalFetch;
        process.env.GITHUB_TOKEN = originalToken;
      }
    });

    it('falls back to unauthenticated fetch in fetchGitHubRepoTree when server token returns 401', async () => {
      const originalToken = process.env.GITHUB_TOKEN;
      process.env.GITHUB_TOKEN = 'stale_expired_system_token';

      let callCount = 0;
      globalThis.fetch = async (_url: any, options: any) => {
        callCount++;
        if (options?.headers?.Authorization) {
          return new Response(JSON.stringify({ message: 'Bad credentials' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({
            tree: [{ path: 'main.py', size: 100, sha: 'abc123', type: 'blob' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      try {
        const files = await fetchGitHubRepoTree('psf', 'requests', 'main');
        assert.equal(files.length, 1);
        assert.equal(files[0].path, 'main.py');
        assert.equal(callCount, 2);
      } finally {
        globalThis.fetch = originalFetch;
        process.env.GITHUB_TOKEN = originalToken;
      }
    });

    it('fetchGitHubFileContent retrieves file content from raw.githubusercontent.com', async () => {
      globalThis.fetch = async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('raw.githubusercontent.com')) {
          return new Response('print("hello world")', { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      };

      try {
        const content = await fetchGitHubFileContent('psf', 'requests', 'src/hello.py', 'main');
        assert.equal(content, 'print("hello world")');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('fetchGitHubFileContent falls back to GitHub Contents API when raw URL fails without user token', async () => {
      let rawCalled = false;
      let contentsCalled = false;

      globalThis.fetch = async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('raw.githubusercontent.com')) {
          rawCalled = true;
          return new Response('Not Found', { status: 404 });
        }
        if (urlStr.includes('/contents/src/hello.py')) {
          contentsCalled = true;
          const encoded = Buffer.from('def fallback_code(): pass').toString('base64');
          return new Response(
            JSON.stringify({ encoding: 'base64', content: encoded }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('Not found', { status: 404 });
      };

      try {
        const content = await fetchGitHubFileContent('psf', 'requests', 'src/hello.py', 'main');
        assert.equal(rawCalled, true);
        assert.equal(contentsCalled, true);
        assert.equal(content, 'def fallback_code(): pass');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});

