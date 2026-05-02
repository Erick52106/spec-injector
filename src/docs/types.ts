export type DocSourceKind =
  | 'always'
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
  reasons?: string[];
}
