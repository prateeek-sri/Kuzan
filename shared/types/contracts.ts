/**
 * Unified TypeScript Type Contracts for AI Bug Prediction System
 * Standard: api-and-interface-design
 */

// ============================================================================
// 1. Error Envelope Contracts
// ============================================================================

export type APIErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMIT_EXCEEDED'
  | 'CONFLICT'
  | 'ML_SERVICE_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_SERVER_ERROR';

export interface APIErrorDetail {
  [field: string]: string[];
}

export interface APIErrorBody {
  code: APIErrorCode;
  message: string;
  details?: APIErrorDetail;
}

export interface APIErrorResponse {
  error: APIErrorBody;
}

// ============================================================================
// 2. Authentication & User Contracts (D1 User DB)
// ============================================================================

export interface UserDTO {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: UserDTO;
  token?: string;
}

// ============================================================================
// 3. Repository & Metric Contracts (D2 Repo Metric DB)
// ============================================================================

export type SupportedLanguage =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'java'
  | 'c'
  | 'cpp'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'php'
  | 'ruby'
  | 'kotlin'
  | 'swift'
  | 'scala'
  | 'generic';

export interface RepoSourceFile {
  path: string;
  content: string;
  language: SupportedLanguage;
}

export interface FileChange {
  path: string;
  added: number;
  deleted: number;
}

export interface CommitRecord {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  filesChanged: FileChange[];
}

export interface FileMetricVector {
  filePath: string;
  loc: number;
  sloc: number;
  cyclomaticComplexity: number;
  halsteadVolume?: number;
  commitCount: number;
  churnLines: number;
  authorCount: number;
  bugFixCount: number;
}

export interface MetricsExtractionRequest {
  files: RepoSourceFile[];
  commits: CommitRecord[];
}

export interface MetricsExtractionResponse {
  metrics: FileMetricVector[];
}

// ============================================================================
// 4. ML Prediction & Scoring Contracts (D3 Prediction DB, D4 Model Store)
// ============================================================================

export type MLModelType =
  | 'AutoSelectBest' // Automatically benchmarks all models & selects highest F1 champion
  | 'RandomForest'
  | 'XGBoost'
  | 'LightGBM'
  | 'GradientBoosting'
  | 'ExtraTrees'
  | 'AdaBoost'
  | 'LogisticRegression'
  | 'SVM'
  | 'KNN'
  | 'NaiveBayes'
  | 'NeuralNetwork_MLP'
  | 'VotingEnsemble'
  | 'StackingEnsemble';

export type DefectRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface FilePredictionDTO {
  filePath: string;
  defectProbability: number; // 0.0 to 1.0
  riskLevel: DefectRiskLevel;
  rank: number;
  defects?: CodeDefectItem[];
}

export interface PredictionRequest {
  modelType: MLModelType;
  metrics: FileMetricVector[];
}

export interface PredictionResponse {
  modelVersion: string;
  predictions: FilePredictionDTO[];
}

// ============================================================================
// 5. Analysis Lifecycle & Dashboard Summary Contracts
// ============================================================================

export type AnalysisStatus = 'QUEUED' | 'FETCHING' | 'EXTRACTING_METRICS' | 'PREDICTING' | 'COMPLETED' | 'FAILED';

export interface AnalyzeRepoRequest {
  repoUrl: string;
  githubToken?: string;
  branch?: string;
  selectedModel?: MLModelType;
}

export interface AnalyzeRepoResponse {
  analysisId: string;
  repo: {
    owner: string;
    name: string;
    url: string;
    defaultBranch: string;
  };
  status: AnalysisStatus;
  statusUrl: string;
}

export interface AnalysisSummary {
  totalFiles: number;
  analyzedFiles: number;
  defectProneFiles: number;
  averageComplexity: number;
  totalChurnLines: number;
  highRiskCount: number;
  criticalRiskCount: number;
}

export interface AnalysisDetailResponse {
  analysisId: string;
  status: AnalysisStatus;
  progressPercent: number;
  summary?: AnalysisSummary;
  topVulnerableFiles?: (FilePredictionDTO & {
    cyclomaticComplexity: number;
    commitCount: number;
    churnLines: number;
    bugFixCount: number;
    defects?: CodeDefectItem[];
  })[];
  errorMessage?: string;
  completedAt?: string;
}

// ============================================================================
// 6. Concrete Code Defect & Remediation Contracts (Actionable Diagnostics)
// ============================================================================

export type DefectPatternCategory =
  | 'UNHANDLED_NULL'
  | 'SWALLOWED_EXCEPTION'
  | 'DEEP_NESTING'
  | 'COMPLEX_BRANCHING'
  | 'RESOURCE_LEAK'
  | 'UNSAFE_EQUALITY'
  | 'MISSING_BOUNDARY';

export interface CodeDefectItem {
  id: string;
  category: DefectPatternCategory;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  functionName?: string;
  lineNumber: number;
  endLineNumber?: number;
  cause: string;
  impact: string;
  buggyCodeSnippet: string;
  remediedCodeSnippet: string;
}

// ============================================================================
// 6. Report Export Contracts
// ============================================================================

export interface ReportSummaryDTO {
  reportId: string;
  analysisId: string;
  repoName: string;
  analyzedAt: string;
  metricsDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  files: (FileMetricVector & FilePredictionDTO)[];
}

// ============================================================================
// 7. Remediation & "Apply All Fixes" Contracts
// ============================================================================

export interface ApplyFixesRequest {
  selectedDefectIds?: string[];
  action?: 'preview-patch' | 'create-pr';
  githubToken?: string;
  prTitle?: string;
  prBranchName?: string;
}

export interface RemediationPatchResponse {
  analysisId: string;
  repo: {
    owner: string;
    name: string;
    defaultBranch: string;
  };
  totalFilesModified: number;
  totalFixesApplied: number;
  unifiedPatch: string;
  applyCommand: string;
  modifiedFiles: Array<{
    filePath: string;
    defectsFixedCount: number;
    fileDiff: string;
  }>;
  pullRequest?: {
    htmlUrl: string;
    number: number;
    branchName: string;
  };
}


