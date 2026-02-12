import type {
  NodePosition,
  StoryChoice,
  StoryNode,
} from '@/types/story';

/**
 * Hard bounds on the node graph editor's canvas coordinate space.
 * Node positions are finite values clamped into this range. The range is
 * generous enough to hold large graphs but rejects absurd / non-finite
 * input (NaN, +/-Infinity, or values far beyond the usable viewport).
 */
export const MIN_NODE_COORD = -100_000;
export const MAX_NODE_COORD = 100_000;

/** Maximum number of graph nodes a single story may hold. */
export const MAX_NODES = 500;

/** Maximum character length for a node's narrative text. */
export const MAX_NODE_TEXT_LENGTH = 5000;

/** Maximum character length for a choice label. */
export const MAX_CHOICE_LABEL_LENGTH = 200;

export function makeNodeId(
  existing: Iterable<string>,
  random: () => number = Math.random,
): string {
  const taken = new Set(existing);
  let candidate = `node-${Math.floor(random() * 1e9)}`;
  while (taken.has(candidate)) {
    candidate = `node-${Math.floor(random() * 1e9)}`;
  }
  return candidate;
}

export function makeChoiceId(
  existing: Iterable<string>,
  random: () => number = Math.random,
): string {
  const taken = new Set(existing);
  let candidate = `choice-${Math.floor(random() * 1e9)}`;
  while (taken.has(candidate)) {
    candidate = `choice-${Math.floor(random() * 1e9)}`;
  }
  return candidate;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validate and normalize a position value at the boundary. Returns a safe
 * `NodePosition` when `value` holds two finite numbers (clamped into the
 * documented coordinate bounds); returns `undefined` when either component
 * is missing or non-finite (NaN, Infinity, or a non-number).
 */
export function normalizePosition(
  value: unknown,
): NodePosition | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  const candidate = value as Partial<NodePosition>;
  if (!isFiniteNumber(candidate.x) || !isFiniteNumber(candidate.y)) {
    return undefined;
  }
  return {
    x: Math.min(Math.max(candidate.x, MIN_NODE_COORD), MAX_NODE_COORD),
    y: Math.min(Math.max(candidate.y, MIN_NODE_COORD), MAX_NODE_COORD),
  };
}

function hasValidPosition(node: StoryNode): boolean {
  return normalizePosition(node.position) !== undefined;
}

/**
 * Fill in canvas positions for any nodes that lack a valid one, using a
 * simple left-to-right grid layout. Existing valid positions are preserved.
 * Returns a new array (input array is not mutated).
 */
export function assignPositions(
  nodes: StoryNode[],
  grid?: {
    cols?: number;
    spacingX?: number;
    spacingY?: number;
    originX?: number;
    originY?: number;
  },
): StoryNode[] {
  const cols = grid?.cols ?? 3;
  const spacingX = grid?.spacingX ?? 220;
  const spacingY = grid?.spacingY ?? 140;
  const originX = grid?.originX ?? 60;
  const originY = grid?.originY ?? 60;

  let slot = 0;
  return nodes.map((node) => {
    if (hasValidPosition(node)) return node;
    const col = slot % cols;
    const row = Math.floor(slot / cols);
    slot += 1;
    return {
      ...node,
      position: {
        x: originX + col * spacingX,
        y: originY + row * spacingY,
      },
    };
  });
}

export type AddNodeResult =
  | { ok: true; nodes: StoryNode[]; node: StoryNode }
  | { ok: false; error: string };

/**
 * Append a new node to the graph. Validates the text at the boundary: the
 * trimmed text may not exceed the documented max length. The node is placed
 * at the supplied (validated) position, or at a fresh grid slot when none is
 * given.
 */
export function addNode(
  nodes: StoryNode[],
  text: string,
  position?: NodePosition,
): AddNodeResult {
  if (nodes.length >= MAX_NODES) {
    return { ok: false, error: `A story may hold at most ${MAX_NODES} nodes.` };
  }
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (trimmed.length > MAX_NODE_TEXT_LENGTH) {
    return {
      ok: false,
      error: `Node text must be at most ${MAX_NODE_TEXT_LENGTH} characters.`,
    };
  }

  const allIds = new Set<string>();
  for (const node of nodes) {
    allIds.add(node.id);
    for (const choice of node.choices) allIds.add(choice.id);
  }

  const node: StoryNode = {
    id: makeNodeId(allIds),
    text: trimmed.length > 0 ? trimmed : 'New scene',
    choices: [],
  };
  if (position !== undefined) {
    const valid = normalizePosition(position);
    if (valid !== undefined) node.position = valid;
  }
  return { ok: true, nodes: [...nodes, node], node };
}

/**
 * Remove a node and cascade the change through the graph:
 *  - the node itself is dropped,
 *  - every choice in *other* nodes that pointed at the removed node is
 *    removed,
 *  - the removed node's own outgoing choices vanish with it.
 * Returns a new array (input array is not mutated).
 */
export function deleteNode(nodes: StoryNode[], nodeId: string): StoryNode[] {
  return nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => {
      const remaining = node.choices.filter(
        (choice) => choice.targetNodeId !== nodeId,
      );
      return remaining.length === node.choices.length
        ? node
        : { ...node, choices: remaining };
    });
}

export type MoveNodeResult =
  | { ok: true; nodes: StoryNode[] }
  | { ok: false; error: string };

/**
 * Move a node to a new (validated) position. When the new position is not
 * two finite numbers, the move is rejected and the original array is
 * returned unchanged.
 */
export function moveNode(
  nodes: StoryNode[],
  nodeId: string,
  x: number,
  y: number,
): MoveNodeResult {
  const position = normalizePosition({ x, y });
  if (position === undefined) {
    return {
      ok: false,
      error: 'Node position must be two finite numbers.',
    };
  }
  return {
    ok: true,
    nodes: nodes.map((node) =>
      node.id === nodeId ? { ...node, position } : node,
    ),
  };
}

export type ConnectNodesResult =
  | { ok: true; nodes: StoryNode[]; choice: StoryChoice }
  | { ok: false; error: string };

/**
 * Add a choice on `sourceId` pointing to `targetId`. Rejects:
 *  - self-connections,
 *  - duplicate connections (same source -> target already present),
 *  - a missing source or target in the graph,
 *  - a label that exceeds the documented bound.
 */
export function connectNodes(
  nodes: StoryNode[],
  sourceId: string,
  targetId: string,
  label?: string,
): ConnectNodesResult {
  if (sourceId === targetId) {
    return { ok: false, error: 'A node cannot point to itself.' };
  }

  const source = nodes.find((node) => node.id === sourceId);
  if (!source) return { ok: false, error: 'Source node not found.' };
  const target = nodes.find((node) => node.id === targetId);
  if (!target) return { ok: false, error: 'Target node not found.' };

  const trimmed =
    label !== undefined && label !== null ? String(label).trim() : '';
  const finalLabel =
    trimmed.length > 0 ? trimmed : `From ${source.text.slice(0, 24)}`;
  if (finalLabel.length > MAX_CHOICE_LABEL_LENGTH) {
    return {
      ok: false,
      error: `Choice label must be at most ${MAX_CHOICE_LABEL_LENGTH} characters.`,
    };
  }

  const alreadyLinked = source.choices.some(
    (choice) => choice.targetNodeId === targetId,
  );
  if (alreadyLinked) {
    return {
      ok: false,
      error: 'A choice from this node to that node already exists.',
    };
  }

  const allIds = new Set<string>();
  for (const node of nodes) {
    allIds.add(node.id);
    for (const choice of node.choices) allIds.add(choice.id);
  }

  const choice: StoryChoice = {
    id: makeChoiceId(allIds),
    label: finalLabel,
    targetNodeId: targetId,
  };
  return {
    ok: true,
    nodes: nodes.map((node) =>
      node.id === sourceId ? { ...node, choices: [...node.choices, choice] } : node,
    ),
    choice,
  };
}

/**
 * Remove a single choice from a node. No-op when the node or choice does
 * not exist.
 */
export function deleteChoice(
  nodes: StoryNode[],
  sourceId: string,
  choiceId: string,
): StoryNode[] {
  return nodes.map((node) => {
    if (node.id !== sourceId) return node;
    const remaining = node.choices.filter((choice) => choice.id !== choiceId);
    return remaining.length === node.choices.length
      ? node
      : { ...node, choices: remaining };
  });
}

/** A resolved edge: source + target nodes plus the choice that links them. */
export type Connection = {
  source: StoryNode;
  target: StoryNode;
  choice: StoryChoice;
};

/**
 * Resolve all choices to their concrete source and target nodes, skipping
 * any choice whose target no longer exists (defensive against stale data).
 */
export function getConnections(nodes: StoryNode[]): Connection[] {
  const byId = new Map<string, StoryNode>();
  for (const node of nodes) byId.set(node.id, node);

  const connections: Connection[] = [];
  for (const source of nodes) {
    for (const choice of source.choices) {
      const target = byId.get(choice.targetNodeId);
      if (target) connections.push({ source, target, choice });
    }
  }
  return connections;
}

/** Number of choices whose target no longer exists in the graph. */
export function countDanglingChoices(nodes: StoryNode[]): number {
  const ids = new Set(nodes.map((node) => node.id));
  let dangling = 0;
  for (const node of nodes) {
    for (const choice of node.choices) {
      if (!ids.has(choice.targetNodeId)) dangling += 1;
    }
  }
  return dangling;
}
