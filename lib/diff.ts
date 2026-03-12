/**
 * Word-level diff using the Myers diff algorithm (LCS-based).
 * Returns an array of segments tagged as "equal", "delete", or "insert".
 */

export type DiffOp = "equal" | "delete" | "insert";
export interface DiffSegment { op: DiffOp; text: string; }

/** Tokenise text into words + whitespace so diffs look natural */
function tokenize(text: string): string[] {
  // Split on whitespace boundaries but keep the whitespace in the tokens
  return text.split(/(\s+)/);
}

/** Classic LCS-based Myers diff on token arrays */
function lcs(a: string[], b: string[]): DiffSegment[] {
  const m = a.length, n = b.length;

  // dp[i][j] = length of LCS of a[0..i) and b[0..j)
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);

  // Backtrack
  const result: DiffSegment[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.push({ op: "equal", text: a[--i] });
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ op: "insert", text: b[--j] });
    } else {
      result.push({ op: "delete", text: a[--i] });
    }
  }
  result.reverse();

  // Merge consecutive same-op segments for cleaner output
  return result.reduce<DiffSegment[]>((acc, seg) => {
    if (acc.length && acc[acc.length - 1].op === seg.op) {
      acc[acc.length - 1] = { op: seg.op, text: acc[acc.length - 1].text + seg.text };
    } else {
      acc.push({ ...seg });
    }
    return acc;
  }, []);
}

/**
 * Compute word-level diff between oldText and newText.
 * @returns array of DiffSegment with op "equal" | "delete" | "insert"
 */
export function wordDiff(oldText: string, newText: string): DiffSegment[] {
  if (oldText === newText) return [{ op: "equal", text: oldText }];
  return lcs(tokenize(oldText), tokenize(newText));
}
