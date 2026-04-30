export interface DocSection {
  filePath: string;   // relative path as listed in rules.yaml
  content: string;    // full file content
  found: boolean;     // false if file was missing
}
