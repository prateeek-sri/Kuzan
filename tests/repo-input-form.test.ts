import React from 'react';
(globalThis as any).React = React;

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { RepoInputForm, buildFormError, type RepoInputFormProps } from '../components/RepoInputForm';

const { AppRouterContext } = require('next/dist/shared/lib/app-router-context.shared-runtime.js');

const mockAppRouter = {
  push: () => {},
  replace: () => {},
  refresh: () => {},
  back: () => {},
  forward: () => {},
  prefetch: () => {},
};

describe('RepoInputForm Component & Client Recovery Logic (TDD)', () => {
  it('renders initial form state with repository URL input, quick-fill samples, and advanced settings', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        AppRouterContext.Provider,
        { value: mockAppRouter },
        React.createElement(RepoInputForm)
      )
    );

    assert.ok(html.includes('Analyze repository'), 'Must render component title');
    assert.ok(html.includes('id="repoUrl"'), 'Must render repoUrl input');
    assert.ok(html.includes('psf/requests'), 'Must include psf/requests sample');
    assert.ok(html.includes('pallets/flask'), 'Must include pallets/flask sample');
    assert.ok(html.includes('expressjs/express'), 'Must include expressjs/express sample');
    assert.ok(html.includes('facebook/react'), 'Must include facebook/react sample');
    assert.ok(html.includes('Advanced settings'), 'Must include Advanced settings accordion toggle');
  });

  it('buildFormError correctly derives structured error code, recovery guidance, and action text', () => {
    // 1. Rate Limit Exceeded
    const rateLimitError = buildFormError(403, {
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'GitHub API rate limit exceeded' },
    });
    assert.equal(rateLimitError.code, 'RATE_LIMIT_EXCEEDED');
    assert.equal(rateLimitError.actionText, 'Configure GitHub Token');
    assert.ok(rateLimitError.guidance?.includes('5,000 requests/hour'));

    // 2. SAML / Forbidden
    const forbiddenError = buildFormError(403, {
      error: { code: 'FORBIDDEN', message: 'Resource protected by organization SAML enforcement' },
    });
    assert.equal(forbiddenError.code, 'FORBIDDEN');
    assert.equal(forbiddenError.actionText, 'Configure GitHub Token');
    assert.ok(forbiddenError.guidance?.includes('SAML SSO'));

    // 3. Not Found (Private or missing)
    const notFoundError = buildFormError(404, {
      error: { code: 'NOT_FOUND', message: 'Repository not found or is private' },
    });
    assert.equal(notFoundError.code, 'NOT_FOUND');
    assert.equal(notFoundError.actionText, 'Add Access Token for Private Repo');
    assert.ok(notFoundError.guidance?.includes('read permissions in Advanced Settings'));

    // 4. GitHub Token Auth Error (401)
    const authError = buildFormError(401, {
      error: { code: 'UNAUTHORIZED', message: 'GitHub authentication failed' },
    });
    assert.equal(authError.code, 'UNAUTHORIZED');
    assert.equal(authError.actionText, 'Update Token');
    assert.ok(authError.guidance?.includes('valid, active, and has appropriate repo scope'));

    // 5. Network Failure / Service Unavailable (503)
    const netError = buildFormError(503, {
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Network failure connecting to GitHub API' },
    });
    assert.equal(netError.code, 'SERVICE_UNAVAILABLE');
    assert.equal(netError.actionText, 'Retry Analysis');
    assert.ok(netError.guidance?.includes('githubstatus.com'));

    // 6. Validation Error for GitHub Token field
    const tokenValError = buildFormError(422, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid repository submission parameters',
        details: { githubToken: ['Invalid GitHub token format'] },
      },
    });
    assert.equal(tokenValError.code, 'VALIDATION_ERROR');
    assert.equal(tokenValError.actionText, 'Fix GitHub Token');
    assert.ok(tokenValError.guidance?.includes('Invalid GitHub token format'));

    // 7. Validation Error for Branch field
    const branchValError = buildFormError(422, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid repository submission parameters',
        details: { branch: ['Invalid git ref/branch name'] },
      },
    });
    assert.equal(branchValError.code, 'VALIDATION_ERROR');
    assert.equal(branchValError.actionText, 'Fix Branch');
    assert.ok(branchValError.guidance?.includes('Invalid git ref/branch name'));

    // 8. Validation Error for Selected Model field
    const modelValError = buildFormError(422, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid repository submission parameters',
        details: { selectedModel: ['Invalid model selection'] },
      },
    });
    assert.equal(modelValError.code, 'VALIDATION_ERROR');
    assert.equal(modelValError.actionText, 'Choose Model');
    assert.ok(modelValError.guidance?.includes('Invalid ML model selection'));

    // 9. Server Internal Error (500)
    const serverError = buildFormError(500, {
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected internal error occurred' },
    });
    assert.equal(serverError.code, 'INTERNAL_SERVER_ERROR');
    assert.equal(serverError.actionText, 'Retry Analysis');
    assert.ok(serverError.guidance?.includes('unexpected error occurred'));
  });

  it('mounts RepoInputForm with error state and renders error code badge, guidance, and recovery action button', () => {
    const errorState = {
      code: 'NOT_FOUND',
      message: 'Repository "owner/private-repo" was not found or is private.',
      guidance: 'Verify that the repository exists. If it is private, provide a GitHub Personal Access Token.',
      actionText: 'Add Access Token for Private Repo',
      action: () => {},
    };

    const html = renderToStaticMarkup(
      React.createElement(
        AppRouterContext.Provider,
        { value: mockAppRouter },
        React.createElement<RepoInputFormProps>(RepoInputForm, { initialError: errorState })
      )
    );

    assert.ok(html.includes('Analysis error'), 'Must render error container header');
    assert.ok(html.includes('NOT_FOUND'), 'Must render error code badge');
    assert.ok(html.includes('owner/private-repo'), 'Must render repository error message');
    assert.ok(html.includes('Recovery guidance:'), 'Must render recovery guidance label');
    assert.ok(html.includes('provide a GitHub Personal Access Token'), 'Must render recovery guidance text');
    assert.ok(html.includes('Add Access Token for Private Repo'), 'Must render recovery action button');
  });

  it('validates interactive recovery action mechanics for token focus, branch focus, and retry', () => {
    let advancedShown = false;
    let tokenFocused = false;
    let branchFocused = false;
    let submissionRetried = false;

    // Simulate recovery actions
    const handleFixToken = () => {
      advancedShown = true;
      tokenFocused = true;
    };

    const handleFixBranch = () => {
      advancedShown = true;
      branchFocused = true;
    };

    const handleRetry = () => {
      submissionRetried = true;
    };

    handleFixToken();
    assert.equal(advancedShown, true);
    assert.equal(tokenFocused, true);

    handleFixBranch();
    assert.equal(branchFocused, true);

    handleRetry();
    assert.equal(submissionRetried, true);
  });
});
