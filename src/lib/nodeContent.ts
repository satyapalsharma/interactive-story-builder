import { MAX_NODE_TEXT_LENGTH } from '@/lib/nodeGraph';
import type { StoryNode } from '@/types/story';

/** Maximum character length for a node's short title. */
export const MAX_NODE_TITLE_LENGTH = 80;

/**
 * Default background for node cards, used when no valid color is set so the
 * reader/editor always renders a known-safe surface.
 */
export const DEFAULT_NODE_BACKGROUND = '#ffffff';

/**
 * Hard upper bound for a valid hex color: `#rgb`, `#rgba`, `#rrggbb` or
 * `#rrggbbaa` are the only accepted forms, so at most 9 characters.
 */
export const MAX_COLOR_LENGTH = 9;

/**
 * Accepts exactly the safe hex color forms (3/4 or 6/8 hex digits with a
 * leading `#`), case-insensitive. This rejects injection vectors
 * (`url(...)`, `javascript:`, newlines, trailing junk) and anything that is
 * not a finite literal color.
 */
export function isValidHexColor(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  // Reject control characters (e.g. newline injection) in the raw input so a
  // color can never smuggle bytes past rendering.
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  const normalized = value.trim();
  if (normalized.length < 4 || normalized.length > MAX_COLOR_LENGTH) {
    return false;
  }
  return /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(normalized);
}

/**
 * Normalize an arbitrary user-supplied background color to a value that is
 * safe to render and persist.
 *
 * - empty/blank input keeps the default (removes any previously invalid
 *   value),
 * - a valid hex color is lowercased and its whitespace trimmed,
 * - any other value (non-string, too long, wrong characters) falls back to
 *   the documented default.
 */
export function normalizeNodeColor(value: unknown): string {
  const trimmed =
    typeof value === 'string' ? value.trim() : DEFAULT_NODE_BACKGROUND;
  if (trimmed.length === 0) return DEFAULT_NODE_BACKGROUND;
  return isValidHexColor(trimmed) ? trimmed.toLowerCase() : DEFAULT_NODE_BACKGROUND;
}

/**
 * Validate and normalize a node title at the boundary: trimmed, length-capped
 * by the documented bound. An empty title clears the node's heading (the UI
 * falls back to a preview of the node text).
 */
export function normalizeNodeTitle(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed.length === 0) return '';
  return trimmed.slice(0, MAX_NODE_TITLE_LENGTH);
}

/**
 * Validate and normalize a node's narrative text at the boundary: trimmed and
 * length-capped by the documented bound. Blank input is rejected (the
 * message describes what to fix) so a node can never end up silent.
 */
export function normalizeNodeText(
  value: unknown,
): { ok: true; text: string } | { ok: false; error: string } {
  if (typeof value !== 'string') {
    return { ok: false, error: 'Node text is required.' };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Node text cannot be empty.' };
  }
  if (trimmed.length > MAX_NODE_TEXT_LENGTH) {
    return {
      ok: false,
      error: `Node text must be at most ${MAX_NODE_TEXT_LENGTH} characters.`,
    };
  }
  return { ok: true, text: trimmed };
}

/**
 * Apply a content edit to one node, immutably. Each field is normalized at
 * the boundary; when the node cannot be found the input array is returned
 * unchanged. Text validation failure rejects the whole edit so an invalid
 * field can never be half-applied.
 */
export function updateNodeContent(
  nodes: StoryNode[],
  nodeId: string,
  edit: { text?: unknown; title?: unknown; backgroundColor?: unknown },
): { ok: true; nodes: StoryNode[]; node: StoryNode } | { ok: false; error: string } {
  const target = nodes.find((node) => node.id === nodeId);
  if (target === undefined) {
    return { ok: false, error: 'Node not found.' };
  }

  let text = target.text;
  if (edit.text !== undefined) {
    const result = normalizeNodeText(edit.text);
    if (!result.ok) return result;
    text = result.text;
  }

  const title = edit.title !== undefined ? normalizeNodeTitle(edit.title) : target.title;
  const backgroundColor =
    edit.backgroundColor !== undefined
      ? normalizeNodeColor(edit.backgroundColor)
      : target.backgroundColor;

  const node: StoryNode = {
    ...target,
    text,
  };
  if (title !== undefined && title.length > 0) node.title = title;
  else delete node.title;
  if (backgroundColor !== undefined) node.backgroundColor = backgroundColor;
  else delete node.backgroundColor;

  return {
    ok: true,
    nodes: nodes.map((existing) => (existing.id === nodeId ? node : existing)),
    node,
  };
}

/**
 * Resolve the visible background for a node: its validated color when
 * present, otherwise the documented default.
 */
export function nodeBackground(node: StoryNode): string {
  return node.backgroundColor ?? DEFAULT_NODE_BACKGROUND;
}

/**
 * Resolve the visible heading for a node: its title when present, otherwise
 * a short preview of the narrative text so the card is never unlabeled.
 */
export function nodeHeading(node: StoryNode): string {
  if (typeof node.title === 'string' && node.title.length > 0) {
    return node.title;
  }
  const text = typeof node.text === 'string' ? node.text : '';
  const preview = text.length > 28 ? `${text.slice(0, 28)}\u2026` : text;
  return preview.length > 0 ? preview : 'Untitled scene';
}
