export function formatIssueId(n: number): string {
  return `ISS-${String(n).padStart(3, '0')}`;
}

export function parseIssueNumber(id: string): number {
  return parseInt(id.replace('ISS-', ''), 10);
}
