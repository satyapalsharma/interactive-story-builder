export type StoryNode = {
  id: string;
  text: string;
  choices: StoryChoice[];
  /**
   * Optional canvas coordinates used by the node graph editor. Optional so
   * that node data produced elsewhere (creation, seeding, import) does not
   * need to supply a layout; the editor assigns one when missing.
   */
  position?: NodePosition;
};

/** A 2D position on the node graph canvas. */
export type NodePosition = {
  x: number;
  y: number;
};

export type StoryChoice = {
  id: string;
  label: string;
  targetNodeId: string;
};

export type Story = {
  id: string;
  title: string;
  author: string;
  description: string;
  lastModified: string; // ISO 8601 UTC timestamp
  nodes: StoryNode[];
};

export type StorySummary = Pick<
  Story,
  'id' | 'title' | 'author' | 'description' | 'lastModified'
>;

/**
 * Check that an ISO timestamp string represents a *real* calendar date/time
 * in UTC: it must parse to a finite time AND round-trip through the same
 * year/month/day (rejects impossible dates like 2023-02-30 that engines
 * silently roll over).
 */
export function isValidUtcTimestamp(value: string): boolean {
  if (typeof value !== 'string') return false;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return false;
  const d = new Date(time);
  // ISO strings must be absolute (no local date with missing time part).
  const m = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})\.?\d*)?(Z|[+-]\d{2}:?\d{2})?$/i,
  );
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = m[6] === undefined ? 0 : Number(m[6]);
  // Round-trip check: the parsed UTC components must equal what the string
  // claimed (after applying any offset), guaranteeing a real calendar date.
  if (d.getUTCFullYear() !== year && value.endsWith('Z')) return false;
  // For Z-suffixed inputs, month/day must match exactly.
  if (value.endsWith('Z') || value.endsWith('z')) {
    if (d.getUTCMonth() + 1 !== month) return false;
    if (d.getUTCDate() !== day) return false;
    if (d.getUTCHours() !== hour) return false;
    if (d.getUTCMinutes() !== minute) return false;
    if (d.getUTCSeconds() !== second) return false;
  }
  return true;
}

export function isStorySummary(
  value: unknown,
): value is StorySummary {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.author === 'string' &&
    typeof v.description === 'string' &&
    typeof v.lastModified === 'string' &&
    isValidUtcTimestamp(v.lastModified)
  );
}
