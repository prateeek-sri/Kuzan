import React from 'react';
(globalThis as any).React = React;

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { Hero3DCanvas } from '../components/Hero3DCanvas';
import { SyntaxHighlighter } from '../components/SyntaxHighlighter';
import { RecentAnalysesTable } from '../components/RecentAnalysesTable';
import { RepoInputForm } from '../components/RepoInputForm';
import NotFound from '../app/not-found';
import HomePage from '../app/page';

// Next.js App Router context provider for router-dependent components in server-side test harness
const { AppRouterContext } = require('next/dist/shared/lib/app-router-context.shared-runtime.js');

const mockAppRouter = {
  push: () => {},
  replace: () => {},
  refresh: () => {},
  back: () => {},
  forward: () => {},
  prefetch: () => {},
};

describe('React Components & Routes Mounting Suite (TDD - M2 & M3)', () => {
  it('mounts Hero3DCanvas with default props and renders interactive 3D code terminal and telemetry', () => {
    const originalError = console.error;
    const errors: string[] = [];
    console.error = (...args: any[]) => errors.push(args.join(' '));

    try {
      const html = renderToStaticMarkup(React.createElement(Hero3DCanvas));

      assert.ok(html.length > 500, 'Hero3DCanvas should render substantial markup');
      assert.ok(html.includes('auth.ts'), 'Markup must include scenario tabs');
      assert.ok(html.includes('Scan AST'), 'Markup must contain scan control button');
      assert.ok(html.includes('AST Engine: Tree-sitter'), 'Markup must display AST engine telemetry');
      assert.ok(html.includes('NVIDIA NIM LLaMA-3.3-70B'), 'Markup must display AI pipeline telemetry');
      assert.ok(html.includes('99.4% F1-Score'), 'Markup must display calibration score');
      assert.ok(html.includes('Interactive 3D Code Defect Diagnostic Terminal'), 'Markup must include accessible label');

      assert.equal(errors.length, 0, `Expected zero console errors during mount: ${errors.join('; ')}`);
    } finally {
      console.error = originalError;
    }
  });

  it('mounts Hero3DCanvas with custom className without breaking layout structure', () => {
    const html = renderToStaticMarkup(
      React.createElement(Hero3DCanvas, { className: 'custom-hero-class border-sky-500' })
    );

    assert.ok(html.includes('custom-hero-class'), 'Rendered container should contain custom class');
    assert.ok(html.includes('border-sky-500'), 'Rendered container should contain custom border class');
  });

  it('mounts RepoInputForm with input controls, sample repositories, and advanced settings', () => {
    const originalError = console.error;
    const errors: string[] = [];
    console.error = (...args: any[]) => errors.push(args.join(' '));

    try {
      const html = renderToStaticMarkup(
        React.createElement(
          AppRouterContext.Provider,
          { value: mockAppRouter },
          React.createElement(RepoInputForm)
        )
      );

      assert.ok(html.includes('Analyze repository'), 'Must render analysis form title');
      assert.ok(html.includes('Repository URL or owner/repo shorthand'), 'Must render URL input label');
      assert.ok(html.includes('psf/requests'), 'Must render sample repository pills');
      assert.ok(html.includes('Advanced settings'), 'Must render advanced settings toggle');
      assert.ok(html.includes('Sign in to analyze repository') || html.includes('Analyze repository'), 'Must render submit action button');
      assert.equal(errors.length, 0, `Expected 0 console errors when mounting RepoInputForm: ${errors.join('; ')}`);
    } finally {
      console.error = originalError;
    }
  });

  it('mounts SyntaxHighlighter with multi-language code snippets and verified line tokens', () => {
    const tsCode = `function calculateRisk(score: number): boolean {\n  return score > 0.75;\n}`;
    const html = renderToStaticMarkup(
      React.createElement(SyntaxHighlighter, {
        code: tsCode,
        language: 'typescript',
      })
    );

    assert.ok(html.includes('<pre'), 'Markup must contain <pre> block');
    assert.ok(html.includes('calculateRisk'), 'Markup must contain function name');
    assert.ok(html.includes('boolean'), 'Markup must contain type token');
    assert.ok(html.includes('font-mono'), 'Markup must use monospace font');

    // Test with empty code
    const emptyHtml = renderToStaticMarkup(
      React.createElement(SyntaxHighlighter, {
        code: '',
        language: 'python',
      })
    );
    assert.ok(emptyHtml.includes('<pre'), 'Empty code should render valid pre container');
  });

  it('mounts RecentAnalysesTable initial state without runtime errors', () => {
    const originalError = console.error;
    const errors: string[] = [];
    console.error = (...args: any[]) => errors.push(args.join(' '));

    try {
      const html = renderToStaticMarkup(React.createElement(RecentAnalysesTable));

      assert.ok(html.length > 50, 'RecentAnalysesTable should render initial skeleton markup');
      assert.ok(html.includes('bg-[#141416]'), 'Rendered skeleton matches dark theme container');
      assert.equal(errors.length, 0, 'No errors during RecentAnalysesTable mount');
    } finally {
      console.error = originalError;
    }
  });

  it('mounts NotFound route component matching pitch-black aesthetic', () => {
    const html = renderToStaticMarkup(React.createElement(NotFound));

    assert.ok(html.includes('Resource Not Found'), 'Must render not found headline');
    assert.ok(html.includes('Return to Dashboard'), 'Must include navigation return link');
    assert.ok(html.includes('href="/"'), 'Return link must navigate to home');
  });

  it('mounts HomePage route integrating asymmetric split hero and analysis pipeline', () => {
    const originalError = console.error;
    const errors: string[] = [];
    console.error = (...args: any[]) => errors.push(args.join(' '));

    try {
      const html = renderToStaticMarkup(
        React.createElement(
          AppRouterContext.Provider,
          { value: mockAppRouter },
          React.createElement(HomePage)
        )
      );

      assert.ok(html.includes('Predict software defects before release'), 'Must render hero headline');
      assert.ok(html.includes('lg:grid-cols-12'), 'Must use asymmetric 12-col grid');
      assert.ok(html.includes('lg:col-span-5'), 'Must render 5-col value prop column');
      assert.ok(html.includes('lg:col-span-7'), 'Must render 7-col 3D canvas column');
      assert.ok(html.includes('Interactive 3D Code Defect Diagnostic Terminal') || html.includes('auth.ts'), 'Must embed 3D diagnostic viewport');
      assert.ok(html.includes('Pre-release defect prediction'), 'Must render version badge');
      assert.ok(html.includes('Accuracy'), 'Must display calibrated accuracy metric');
      assert.ok(html.includes('99.4%'), 'Must display accuracy score');

      assert.equal(errors.length, 0, `Expected 0 console errors when mounting HomePage: ${errors.join('; ')}`);
    } finally {
      console.error = originalError;
    }
  });
});
