export type DocSourceKind =
  | 'always'
  | 'built-in-preset'
  | 'discovered'
  | 'rule'
  | 'missing'
  | 'source'
  | 'issue-doc'
  | 'issue-source';

export interface DocSection {
  filePath: string;         // relative path from repo root
  content: string;          // file content (empty string when missing)
  found: boolean;
  kind: DocSourceKind;
  readStatus?: 'missing' | 'unreadable' | 'read-error';
  readErrorCode?: string;
  reasons?: string[];
  pathAliasHints?: PathAliasHint[];
}

export interface PathAliasHint {
  kind: 'possible-moved-path' | 'ambiguous-same-basename-candidates';
  reason: 'same basename';
  candidatePaths: string[];
  candidateCount: number;
}
