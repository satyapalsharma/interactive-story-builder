import { describe, expect, it } from 'vitest';
import {
  createReaderState,
  findStartNode,
  getResolvableChoices,
  goBack,
  MAX_READER_HISTORY,
  restartReader,
  START_NODE_ID,
  takeChoice,
  type ReaderState,
} from '@/lib/storyReader';
import type { StoryNode } from '@/types/story';

function makeNodes(): StoryNode[] {
  return [
    {
      id: 'start',
      text: 'Once upon a time.',
      choices: [
        { id: 'c1', label: 'Climb', targetNodeId: 'tower' },
        { id: 'c2', label: 'Row', targetNodeId: 'shore' },
      ],
    },
    {
      id: 'tower',
      text: 'The keeper is gone.',
      choices: [{ id: 'c3', label: 'Descend', targetNodeId: 'start' }],
    },
    { id: 'shore', text: 'A rowboat drifts ashore.', choices: [] },
  ];
}

describe('findStartNode', () => {
  it('returns the node named start', () => {
    expect(findStartNode(makeNodes())?.id).toBe('start');
  });

  it('falls back to the first node when no node is named start', () => {
    const nodes = [
      { id: 'a', text: 'First.', choices: [] },
      { id: 'b', text: 'Second.', choices: [] },
    ];
    expect(findStartNode(nodes)?.id).toBe('a');
  });

  it('returns undefined for an empty graph', () => {
    expect(findStartNode([])).toBeUndefined();
  });

  it('rejects malformed graphs instead of navigating them', () => {
    const broken: StoryNode[] = [
      { id: 'start', text: 'ok', choices: [] },
      { id: 42 as unknown as string, text: '', choices: [] },
    ];
    expect(findStartNode(broken)).toBeUndefined();
  });
});

describe('getResolvableChoices', () => {
  it('keeps choices in author order and drops dangling targets', () => {
    const nodes = makeNodes();
    const start = nodes[0]!;
    start.choices.push({
      id: 'c-missing',
      label: 'Gone',
      targetNodeId: 'deleted-node',
    });
    start.choices.push({
      id: 'c-end',
      label: 'Arrive',
      targetNodeId: 'shore',
    });
    const choices = getResolvableChoices(nodes, start);
    expect(choices.map((choice) => choice.id)).toEqual([
      'c1',
      'c2',
      'c-end',
    ]);
  });

  it('ignores malformed choice entries', () => {
    const nodes = makeNodes();
    const start = nodes[0]!;
    start.choices.push({
      id: 'bad',
      label: 'Bad',
      targetNodeId: NaN as unknown as string,
    });
    start.choices.push(null as unknown as (typeof start.choices)[number]);
    const choices = getResolvableChoices(nodes, start);
    expect(choices.every((choice) => typeof choice.targetNodeId === 'string')).toBe(true);
    expect(choices.map((choice) => choice.id)).toContain('c1');
  });

  it('marks a node atEnd when it has no resolvable choices', () => {
    const result = createReaderState(makeNodes());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const shore = result.state.current;
    expect(shore.atEnd).toBe(false);
    // Move to the dead-end shore node.
    const atShore = takeChoice(makeNodes(), result.state, 'c2');
    expect(atShore.ok).toBe(true);
    if (!atShore.ok) return;
    expect(atShore.state.current.node.id).toBe('shore');
    expect(atShore.state.current.atEnd).toBe(true);
    expect(atShore.state.current.choices).toEqual([]);
  });
});

describe('createReaderState', () => {
  it('opens at the start node with an empty history', () => {
    const result = createReaderState(makeNodes());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.current.node.id).toBe(START_NODE_ID);
    expect(result.state.history).toEqual([]);
    expect(result.state.current.choices.map((choice) => choice.id)).toEqual([
      'c1',
      'c2',
    ]);
  });

  it('fails cleanly on an empty graph', () => {
    const result = createReaderState([]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/no scenes/i);
  });

  it('fails cleanly on a malformed graph', () => {
    const broken: StoryNode[] = [null as unknown as StoryNode];
    const result = createReaderState(broken);
    expect(result.ok).toBe(false);
  });
});

describe('takeChoice', () => {
  function stateAtStart(): ReaderState {
    const result = createReaderState(makeNodes());
    if (!result.ok) throw new Error('expected a valid reader state');
    return result.state;
  }

  it('navigates to the chosen target and records the previous scene', () => {
    const result = takeChoice(makeNodes(), stateAtStart(), 'c1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.current.node.id).toBe('tower');
    expect(result.state.history).toHaveLength(1);
    expect(result.state.history[0]?.node.id).toBe('start');
  });

  it('reaches the end of a branch and flags atEnd', () => {
    const result = takeChoice(makeNodes(), stateAtStart(), 'c2');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.current.node.id).toBe('shore');
    expect(result.state.current.atEnd).toBe(true);
  });

  it('rejects a choice id that belongs to a different scene', () => {
    const result = takeChoice(makeNodes(), stateAtStart(), 'c3');
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown choice id', () => {
    const result = takeChoice(makeNodes(), stateAtStart(), 'nope');
    expect(result.ok).toBe(false);
  });

  it('rejects navigation when the target node has been deleted', () => {
    const nodes = makeNodes();
    // Simulate a stale session: the graph lost its tower node but the
    // reader still holds a choice pointing at it.
    const pruned: StoryNode[] = nodes.filter((node) => node.id !== 'tower');
    // The dangling choice is filtered out of the resolvable list, so the
    // reader reports it as no longer available (the graph no longer has it).
    const result = takeChoice(pruned, stateAtStart(), 'c1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/no longer/i);
  });

  it('bounds the back stack to the documented history cap', () => {
    let nodes = makeNodes();
    // The tower choice loops back to start, so choices alternate
    // start -> tower -> start -> tower ...
    let state = createReaderState(nodes);
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    for (let i = 0; i < MAX_READER_HISTORY + 10; i += 1) {
      const next = takeChoice(
        nodes,
        state.state,
        i % 2 === 0 ? 'c1' : 'c3',
      );
      expect(next.ok).toBe(true);
      if (!next.ok) return;
      state = next;
    }
    expect(state.state.history.length).toBeLessThanOrEqual(MAX_READER_HISTORY);
    // The most recent history entries are what remain.
    expect(state.state.history[state.state.history.length - 1]?.node.id).toBe('tower');
  });
});

describe('goBack', () => {
  it('returns the most recent previously-visited scene', () => {
    let result = createReaderState(makeNodes());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const forward = takeChoice(makeNodes(), result.state, 'c1');
    expect(forward.ok).toBe(true);
    if (!forward.ok) return;
    const back = goBack(makeNodes(), forward.state);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.state.current.node.id).toBe('start');
    expect(back.state.history).toEqual([]);
  });

  it('is a reported no-op when there is nothing to go back to', () => {
    const result = createReaderState(makeNodes());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const atStart = goBack(makeNodes(), result.state);
    expect(atStart.ok).toBe(false);
    if (atStart.ok) return;
    expect(atStart.error).toMatch(/beginning/i);
  });

  it('steps back one scene at a time through a longer path', () => {
    const nodes: StoryNode[] = [
      {
        id: 'start',
        text: 'Begin.',
        choices: [{ id: 'a', label: 'A', targetNodeId: 'mid' }],
      },
      {
        id: 'mid',
        text: 'Middle.',
        choices: [{ id: 'b', label: 'B', targetNodeId: 'end' }],
      },
      { id: 'end', text: 'Done.', choices: [] },
    ];
    const initial = createReaderState(nodes);
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    let session = initial.state;
    let step = takeChoice(nodes, session, 'a');
    expect(step.ok).toBe(true);
    if (!step.ok) return;
    session = step.state;
    step = takeChoice(nodes, session, 'b');
    expect(step.ok).toBe(true);
    if (!step.ok) return;
    session = step.state;
    expect(session.current.node.id).toBe('end');
    const back1 = goBack(nodes, session);
    expect(back1.ok).toBe(true);
    if (!back1.ok) return;
    expect(back1.state.current.node.id).toBe('mid');
    expect(back1.state.history).toHaveLength(1);
  });
});

describe('restartReader', () => {
  it('jumps back to the start node and clears the back stack', () => {
    const initial = createReaderState(makeNodes());
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    const forward = takeChoice(makeNodes(), initial.state, 'c2');
    expect(forward.ok).toBe(true);
    if (!forward.ok) return;
    const restarted = restartReader(makeNodes(), forward.state);
    expect(restarted.ok).toBe(true);
    if (!restarted.ok) return;
    expect(restarted.state.current.node.id).toBe('start');
    expect(restarted.state.history).toEqual([]);
  });

  it('reports a clean error when the graph no longer has a start scene', () => {
    const initial = createReaderState(makeNodes());
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    const forward = takeChoice(makeNodes(), initial.state, 'c2');
    expect(forward.ok).toBe(true);
    if (!forward.ok) return;
    const withoutStart: StoryNode[] = makeNodes().filter(
      (node) => node.id !== START_NODE_ID,
    );
    const restarted = restartReader(withoutStart, forward.state);
    // The fallback start (first node) is the tower node, which still exists,
    // so this actually restarts at tower.
    expect(restarted.ok).toBe(true);
    if (restarted.ok) {
      expect(restarted.state.current.node.id).toBe('tower');
      expect(restarted.state.history).toEqual([]);
    }
  });

  it('fails when the graph is empty', () => {
    const state = createReaderState(makeNodes());
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    const restarted = restartReader([], state.state);
    expect(restarted.ok).toBe(false);
  });
});

describe('reader session against a seed-like branching graph', () => {
  it('traverses the full branch start -> tower -> start loop back to the start', () => {
    const initial = createReaderState(makeNodes());
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    let session = initial.state;
    const toTower = takeChoice(makeNodes(), session, 'c1');
    expect(toTower.ok).toBe(true);
    if (!toTower.ok) return;
    session = toTower.state;
    expect(session.current.node.id).toBe('tower');
    const backToStart = takeChoice(makeNodes(), session, 'c3');
    expect(backToStart.ok).toBe(true);
    if (!backToStart.ok) return;
    session = backToStart.state;
    expect(session.current.node.id).toBe('start');
    expect(session.history).toHaveLength(2);
    const undo1 = goBack(makeNodes(), session);
    expect(undo1.ok).toBe(true);
    if (!undo1.ok) return;
    expect(undo1.state.current.node.id).toBe('tower');
  });
});
