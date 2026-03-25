import type { StoryChoice, StoryNode } from '@/types/story';

/**
 * Id of the story's starting node. Story creation and seeding always name
 * the first node this; the reader tolerates graphs that lost it by falling
 * back to the first node in the array.
 */
export const START_NODE_ID = 'start';

/**
 * Back-stack cap: the reader remembers at most this many previous scenes so
 * "Back" works, but a user who loops a cyclic graph forever cannot grow the
 * stack without bound (oldest entries are dropped first).
 */
export const MAX_READER_HISTORY = 50;

/** The scene the reader is on, plus its resolvable outgoing choices. */
export type ReaderPosition = {
  node: StoryNode;
  /** Choices whose target still exists in the graph, in node order. */
  choices: StoryChoice[];
  /** True when the node has no resolvable choices (a story ending). */
  atEnd: boolean;
};

export type ReaderResult =
  | { ok: true; state: ReaderState }
  | { ok: false; error: string };

/** A full reader session: current position plus the back stack. */
export type ReaderState = {
  current: ReaderPosition;
  /** Previously visited scenes, oldest first. Empty at the start node. */
  history: ReaderPosition[];
};

function isNode(value: unknown): value is StoryNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as StoryNode).id === 'string' &&
    typeof (value as StoryNode).text === 'string' &&
    Array.isArray((value as StoryNode).choices)
  );
}

/**
 * Resolve the reader's opening scene: the node named `start` when present,
 * otherwise the first node in the array. Returns `undefined` for empty or
 * malformed graphs (a graph whose entries are not valid node objects is
 * rejected wholesale rather than navigating a broken one).
 */
export function findStartNode(nodes: StoryNode[]): StoryNode | undefined {
  if (!Array.isArray(nodes) || nodes.length === 0) return undefined;
  if (nodes.some((node) => !isNode(node))) return undefined;
  const named = nodes.find((node) => node.id === START_NODE_ID);
  if (named !== undefined) return named;
  return nodes[0];
}

/**
 * Filter a node's choices down to the ones whose target node still exists
 * in the graph, preserving the author's ordering. Dangling choices (their
 * target was deleted) are dropped so the reader can never navigate into
 * nothing.
 */
export function getResolvableChoices(
  nodes: StoryNode[],
  node: StoryNode,
): StoryChoice[] {
  const ids = new Set(
    Array.isArray(nodes)
      ? nodes
          .filter((entry): entry is StoryNode => isNode(entry))
          .map((entry) => entry.id)
      : [],
  );
  if (!Array.isArray(node.choices)) return [];
  return node.choices.filter(
    (choice) =>
      typeof choice === 'object' &&
      choice !== null &&
      typeof choice.id === 'string' &&
      typeof choice.targetNodeId === 'string' &&
      ids.has(choice.targetNodeId),
  );
}

function positionFor(nodes: StoryNode[], node: StoryNode): ReaderPosition {
  const choices = getResolvableChoices(nodes, node);
  return { node, choices, atEnd: choices.length === 0 };
}

/**
 * Create a reader session at the story's start node. Fails cleanly when the
 * graph is empty or malformed (there is no scene to open on).
 */
export function createReaderState(nodes: StoryNode[]): ReaderResult {
  const start = findStartNode(nodes);
  if (start === undefined) {
    return {
      ok: false,
      error: 'This story has no scenes to read yet. Add a node in the editor first.',
    };
  }
  return { ok: true, state: { current: positionFor(nodes, start), history: [] } };
}

/**
 * Navigate to a scene's target. The choice is validated at the boundary:
 * it must be one of the current node's choices *and* its target must still
 * exist in the graph. Both failures are reported, never silently ignored,
 * so a stale click (e.g. after the graph changed) can not corrupt the
 * session.
 */
export function takeChoice(
  nodes: StoryNode[],
  state: ReaderState,
  choiceId: string,
): ReaderResult {
  const current = state.current;
  const match = getResolvableChoices(nodes, current.node).find(
    (choice) => choice.id === choiceId,
  );
  if (match === undefined) {
    return {
      ok: false,
      error: 'That choice is no longer available in this scene.',
    };
  }
  const target = Array.isArray(nodes)
    ? nodes.find((node) => isNode(node) && node.id === match.targetNodeId)
    : undefined;
  if (target === undefined) {
    return {
      ok: false,
      error: 'The scene this choice leads to no longer exists.',
    };
  }
  const history = [...state.history, current];
  if (history.length > MAX_READER_HISTORY) history.shift();
  return {
    ok: true,
    state: { current: positionFor(nodes, target), history },
  };
}

/**
 * Step back to the most recent previously-visited scene. A no-op (with an
 * explanation) when there is nothing to go back to.
 */
export function goBack(
  nodes: StoryNode[],
  state: ReaderState,
): ReaderResult {
  if (state.history.length === 0) {
    return {
      ok: false,
      error: 'You are already at the beginning of the story.',
    };
  }
  const previous = state.history[state.history.length - 1];
  return {
    ok: true,
    state: {
      current: positionFor(nodes, previous.node),
      history: state.history.slice(0, -1),
    },
  };
}

/**
 * Jump back to the story's start node and clear the back stack.
 */
export function restartReader(
  nodes: StoryNode[],
  state: ReaderState,
): ReaderResult {
  void state;
  const start = findStartNode(nodes);
  if (start === undefined) {
    return {
      ok: false,
      error: 'This story has no scenes to read anymore.',
    };
  }
  return { ok: true, state: { current: positionFor(nodes, start), history: [] } };
}
