/**
 * Zero-dependency YAML parser for the rules.yaml subset used by spec-injector.
 *
 * Supported constructs:
 *   - Block mappings (key: value, key: <block>)
 *   - Block sequences (- item, - key: val)
 *   - Scalar types: string, number, boolean, null
 *   - Quoted strings (single and double)
 *   - Comments (full-line and inline, not inside quotes)
 *   - Explicit empty sequences []
 *
 * NOT supported: anchors, aliases, multi-line strings, flow mappings,
 * explicit tags, or any other advanced YAML features.
 */

// ---------------------------------------------------------------------------
// Internal line representation
// ---------------------------------------------------------------------------

interface ParsedLine {
  /** Original 1-based line number (for error messages). */
  lineNo: number;
  /** Number of leading spaces. */
  indent: number;
  /** Content after stripping leading spaces only — inline comments are stripped later during scalar parsing. */
  content: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip an inline comment from a scalar value string (the RHS after the colon,
 * or a bare sequence item). The comment is only stripped when the value is
 * NOT a quoted string.
 *
 * @param raw - the value portion only (not the full "key: value # comment" line)
 */
function stripInlineComment(raw: string): string {
  const trimmed = raw.trim();
  // If the value is quoted, never strip — the hash is part of the string.
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed;
  }
  // Strip at first occurrence of space-hash
  const hashIdx = trimmed.indexOf(' #');
  if (hashIdx !== -1) {
    return trimmed.slice(0, hashIdx).trim();
  }
  return trimmed;
}

/**
 * Parse a scalar string into its proper JS type:
 *   numbers, booleans, null, or string (possibly unquoting).
 */
function parseScalar(raw: string): unknown {
  // Strip inline comments before type-coercing
  const v = stripInlineComment(raw);

  if (v === '' || v === 'null' || v === '~') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;

  // Unquote double-quoted string
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
    return v
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t');
  }

  // Unquote single-quoted string
  if (v.startsWith("'") && v.endsWith("'") && v.length >= 2) {
    return v.slice(1, -1).replace(/''/g, "'");
  }

  // Integer
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);

  // Float
  if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);

  // Everything else is a plain string
  return v;
}

/**
 * Preprocess raw text into an array of ParsedLine objects, discarding blank
 * lines and full-line comments.
 */
function preprocess(text: string): ParsedLine[] {
  const raw = text.split('\n');
  const result: ParsedLine[] = [];

  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    const stripped = line.trimStart();

    // Skip blank lines
    if (stripped === '') continue;

    // Skip full-line comments
    if (stripped.startsWith('#')) continue;

    const indent = line.length - stripped.length;

    // Keep the full content as-is; inline comments are stripped later, only
    // when we parse the scalar value portion (after the colon), so that we
    // never accidentally trim a `#` inside a quoted value.
    const content = stripped.trimEnd();

    result.push({ lineNo: i + 1, indent, content });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Recursive descent parser
// ---------------------------------------------------------------------------

/**
 * Find the colon that separates a mapping key from its value.
 * Returns -1 if not found.
 *
 * A valid separator colon must be followed by a space, end-of-string, or
 * nothing (i.e. the colon is the last character — meaning empty value).
 */
function findMappingColon(content: string): number {
  for (let i = 0; i < content.length; i++) {
    if (content[i] === ':') {
      const after = content[i + 1];
      if (after === undefined || after === ' ' || after === '\t') {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Parse a block value starting at lines[pos].
 * `baseIndent` is the indent level of the first line to consume.
 * Returns [value, nextPos].
 */
function parseBlock(
  lines: ParsedLine[],
  pos: number,
  baseIndent: number,
): [unknown, number] {
  if (pos >= lines.length) return [null, pos];

  const first = lines[pos];

  // Sequence item?
  if (first.content.startsWith('- ') || first.content === '-') {
    return parseSequence(lines, pos, baseIndent);
  }

  // Must be a mapping
  return parseMapping(lines, pos, baseIndent);
}

/**
 * Parse a block mapping (key: value pairs) at exactly `baseIndent`.
 * Continues while lines share the same indent level.
 */
function parseMapping(
  lines: ParsedLine[],
  pos: number,
  baseIndent: number,
): [Record<string, unknown>, number] {
  const obj: Record<string, unknown> = {};

  while (pos < lines.length) {
    const line = lines[pos];

    // Stop when indent changes from baseIndent
    if (line.indent !== baseIndent) break;

    const content = line.content;

    // Must be "key:" or "key: value"
    const colonIdx = findMappingColon(content);
    if (colonIdx === -1) {
      throw new Error(
        `YAML parse error at line ${line.lineNo}: expected mapping entry (key: value), got: ${content}`,
      );
    }

    const key = content.slice(0, colonIdx).trim();
    const rest = content.slice(colonIdx + 1).trim();

    pos++; // consume the key line

    if (rest === '[]') {
      obj[key] = [];
    } else if (rest === '{}') {
      obj[key] = {};
    } else if (rest === '') {
      // Block value follows on next lines — must be more deeply indented
      if (pos < lines.length && lines[pos].indent > baseIndent) {
        const childIndent = lines[pos].indent;
        const [child, nextPos] = parseBlock(lines, pos, childIndent);
        obj[key] = child;
        pos = nextPos;
      } else {
        // No following deeper block → null
        obj[key] = null;
      }
    } else {
      // Inline scalar
      obj[key] = parseScalar(rest);
    }
  }

  return [obj, pos];
}

/**
 * Parse a block sequence (list of `- …` items) at exactly `baseIndent`.
 *
 * Each item is introduced by `- ` at column `baseIndent`. The item body
 * (keys/values of a sub-mapping, or a nested sequence) lives at column
 * `baseIndent + 2`.
 */
function parseSequence(
  lines: ParsedLine[],
  pos: number,
  baseIndent: number,
): [unknown[], number] {
  const arr: unknown[] = [];

  while (pos < lines.length) {
    const line = lines[pos];

    // Not at our indent → done
    if (line.indent !== baseIndent) break;

    const content = line.content;

    if (!content.startsWith('- ') && content !== '-') {
      // Not a sequence item at this indent — stop
      break;
    }

    if (content === '-') {
      pos++;
      arr.push(null);
      continue;
    }

    // Item body content (what comes after `- `)
    const itemContent = content.slice(2); // raw, not trimmed

    pos++; // consume the `- …` line

    if (itemContent.trim() === '[]') {
      arr.push([]);
      continue;
    }

    if (itemContent.trim() === '{}') {
      arr.push({});
      continue;
    }

    if (itemContent.trim() === '') {
      // The item body starts on the NEXT line(s) at indent > baseIndent
      if (pos < lines.length && lines[pos].indent > baseIndent) {
        const childIndent = lines[pos].indent;
        const [child, nextPos] = parseBlock(lines, pos, childIndent);
        arr.push(child);
        pos = nextPos;
      } else {
        arr.push(null);
      }
      continue;
    }

    // The first key/value of a sub-mapping (or a sub-sequence) is inline
    // after `- `. In block-sequence shorthand, the item-body indent is
    // baseIndent + 2 (the `- ` prefix).
    const itemIndent = baseIndent + 2;
    const colonIdx = findMappingColon(itemContent.trim());

    if (colonIdx !== -1) {
      // Sub-mapping: first key is on this line, more keys follow at itemIndent
      // We inject a synthetic ParsedLine for the first key, then continue
      // parsing more mapping entries at itemIndent from the real lines array.
      const syntheticFirst: ParsedLine = {
        lineNo: line.lineNo,
        indent: itemIndent,
        content: itemContent.trim(),
      };

      // Build a virtual lines array: synthetic first line + tail of real lines
      // We can't mutate `lines`, so we build a wrapper view.
      const virtualLines: ParsedLine[] = [syntheticFirst, ...lines.slice(pos)];
      const [subObj, virtualNext] = parseMapping(virtualLines, 0, itemIndent);
      arr.push(subObj);

      // virtualNext tells us how many lines were consumed from virtualLines.
      // virtualLines[0] = synthetic (1 line), virtualLines[1..] = lines[pos..]
      // So actual next pos = pos + (virtualNext - 1)
      pos = pos + (virtualNext - 1);
    } else {
      // Plain scalar item
      arr.push(parseScalar(itemContent.trim()));
    }
  }

  return [arr, pos];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseYaml(text: string): unknown {
  const lines = preprocess(text);

  if (lines.length === 0) return null;

  const [value, remaining] = parseBlock(lines, 0, lines[0].indent);

  if (remaining < lines.length) {
    const stray = lines[remaining];
    throw new Error(
      `YAML parse error at line ${stray.lineNo}: unexpected content at indent ${stray.indent}: ${stray.content}`,
    );
  }

  return value;
}
