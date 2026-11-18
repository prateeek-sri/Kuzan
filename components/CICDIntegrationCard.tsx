'use client';

import { useState } from 'react';
import { Copy, Check, Terminal, GitPullRequest } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface CICDIntegrationCardProps {
  repoUrl: string;
}

export function CICDIntegrationCard({ repoUrl }: CICDIntegrationCardProps) {
  const [copiedAction, setCopiedAction] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const actionYaml = `name: BugPulse Defect Gate
on:
  pull_request:
    branches: [main, master]

jobs:
  defect-prediction:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 50

      - name: Scan PR changes for defect risk
        run: |
          RESPONSE=$(curl -s -X POST "http://localhost:3000/api/repos/analyze" \\
            -H "Content-Type: application/json" \\
            -d '{"repoUrl": "${repoUrl}", "selectedModel": "AutoSelectBest"}')
          echo "BugPulse Response: $RESPONSE"
`;

  const curlSnippet = `curl -X POST "http://localhost:3000/api/repos/analyze" \\
  -H "Content-Type: application/json" \\
  -d '{"repoUrl": "${repoUrl}", "selectedModel": "AutoSelectBest"}'`;

  const copyToClipboard = (text: string, isAction: boolean) => {
    navigator.clipboard.writeText(text);
    if (isAction) {
      setCopiedAction(true);
      setTimeout(() => setCopiedAction(false), 2000);
    } else {
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {/* GitHub Actions Snippet */}
      <Card className="border-neutral-800 bg-[#141416] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitPullRequest className="h-4 w-4 text-neutral-400" />
            <span className="text-xs font-semibold text-neutral-200">GitHub Actions workflow</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(actionYaml, true)}
            className="gap-1.5 h-7 text-xs border-neutral-800 bg-[#1a1a1d] text-neutral-300 hover:text-white"
          >
            {copiedAction ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-neutral-400" />
                <span>Copy YAML</span>
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-neutral-400 font-mono">
          Save as <code className="text-neutral-200">.github/workflows/bugpulse-gate.yml</code> in your repository
        </p>
        <pre className="rounded border border-neutral-800 bg-[#070708] p-4 text-xs font-mono text-neutral-300 overflow-x-auto">
          {actionYaml}
        </pre>
      </Card>

      {/* cURL Webhook Snippet */}
      <Card className="border-neutral-800 bg-[#141416] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-neutral-400" />
            <span className="text-xs font-semibold text-neutral-200">Direct webhook or CLI trigger</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(curlSnippet, false)}
            className="gap-1.5 h-7 text-xs border-neutral-800 bg-[#1a1a1d] text-neutral-300 hover:text-white"
          >
            {copiedCurl ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-neutral-400" />
                <span>Copy cURL</span>
              </>
            )}
          </Button>
        </div>
        <pre className="rounded border border-neutral-800 bg-[#070708] p-4 text-xs font-mono text-emerald-400 overflow-x-auto">
          {curlSnippet}
        </pre>
      </Card>
    </div>
  );
}
