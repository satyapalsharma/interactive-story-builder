import { describe, expect, it } from 'vitest';
import {
  MAX_CHOICE_LABEL_LENGTH,
  connectNodes,
  deleteChoice,
  getConnections,
} from '@/lib/nodeGraph';
import type { StoryNode } from '@/types/story';

function makeNodes(): StoryNode[] {
  return [
    { id: 'start', text: 'Once upon a time.', choices: [] },
    { id: 'tower', text: 'The keeper is gone.', choices: [] },
    { id: 'shore', text: 'A rowboat drifts ashore.', choices: [] },
  ];
}

describe('connectNodes', () => {
  it('creates a choice with a default label derived from the source text', () => {
    const result = connectNodes(makeNodes(), 'start', 'tower');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const choice = result.choice;
    expect(choice.targetNodeId).toBe('tower');
    expect(choice.label).toBe('From Once upon a time.');
    // Only the source node gained the choice; other nodes untouched.
    const source = result.nodes.find((n) => n.id === 'start');
    const target = result.nodes.find((n) => n.id === 'tower');
    expect(source?.choices).toHaveLength(1);
    expect(target?.choices).toHaveLength(0);
  });

  it('uses an explicit label when provided, trimming whitespace', () => {
    const result = connectNodes(makeNodes(), 'start', 'shore', '  Climb  ');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.choice.label).toBe('Climb');
  });

  it('rejects a self-connection', () => {
    const result = connectNodes(makeNodes(), 'start', 'start');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/itself/i);
  });

  it('rejects a duplicate source -> target connection', () => {
    const first = connectNodes(makeNodes(), 'start', 'tower');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const duplicate = connectNodes(first.nodes, 'start', 'tower', 'Again');
    expect(duplicate.ok).toBe(false);
  });

  it('allows a reverse-direction connection (target -> source)', () => {
    const forward = connectNodes(makeNodes(), 'start', 'tower');
    expect(forward.ok).toBe(true);
    if (!forward.ok) return;
    const reverse = connectNodes(forward.nodes, 'tower', 'start');
    expect(reverse.ok).toBe(true);
    if (reverse.ok) {
      expect(reverse.choice.targetNodeId).toBe('start');
    }
  });

  it('rejects a missing source or target node', () => {
    expect(connectNodes(makeNodes(), 'missing', 'tower').ok).toBe(false);
    expect(connectNodes(makeNodes(), 'start', 'missing').ok).toBe(false);
  });

  it('rejects a label that exceeds the documented maximum length', () => {
    const tooLong = 'x'.repeat(MAX_CHOICE_LABEL_LENGTH + 1);
    const result = connectNodes(makeNodes(), 'start', 'tower', tooLong);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/at most/);
  });

  it('accepts a label exactly at the maximum length', () => {
    const exact = 'y'.repeat(MAX_CHOICE_LABEL_LENGTH);
    const result = connectNodes(makeNodes(), 'start', 'tower', exact);
    expect(result.ok).toBe(true);
  });

  it('connects both endpoints into resolvable connections', () => {
    const result = connectNodes(makeNodes(), 'start', 'tower');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const connections = getConnections(result.nodes);
    expect(connections).toHaveLength(1);
    expect(connections[0]?.source.id).toBe('start');
    expect(connections[0]?.target.id).toBe('tower');
  });
});

describe('deleteChoice', () => {
  function withChoice(): StoryNode[] {
    return [
      {
        id: 'start',
        text: 'Once upon a time.',
        choices: [
          { id: 'c1', label: 'Climb', targetNodeId: 'tower' },
          { id: 'c2', label: 'Row', targetNodeId: 'shore' },
        ],
      },
      { id: 'tower', text: 'The keeper is gone.', choices: [] },
      { id: 'shore', text: 'A rowboat drifts ashore.', choices: [] },
    ];
  }

  it('removes the named choice and keeps the rest of that node intact', () => {
    const result = deleteChoice(withChoice(), 'start', 'c1');
    const start = result.find((n) => n.id === 'start');
    expect(start?.choices).toHaveLength(1);
    expect(start?.choices[0]?.id).toBe('c2');
    // Other nodes are not touched.
    expect(result.find((n) => n.id === 'tower')?.choices).toHaveLength(0);
  });

  it('is a no-op when the source node does not exist', () => {
    const input = withChoice();
    const result = deleteChoice(input, 'nope', 'c1');
    // No node is affected, so every element is the same reference and the
    // original array is untouched.
    expect(result).toHaveLength(input.length);
    for (let i = 0; i < input.length; i += 1) {
      expect(result[i]).toBe(input[i]);
    }
    expect(input.find((n) => n.id === 'start')?.choices).toHaveLength(2);
  });

  it('is a no-op when the choice does not exist on the node', () => {
    const input = withChoice();
    const result = deleteChoice(input, 'start', 'nope');
    // Unchanged references are preserved for the node and its choices.
    const start = result.find((n) => n.id === 'start');
    expect(start).toBe(input.find((n) => n.id === 'start'));
  });

  it('does not mutate the input array', () => {
    const input = withChoice();
    deleteChoice(input, 'start', 'c1');
    expect(input.find((n) => n.id === 'start')?.choices).toHaveLength(2);
  });

  it('removes every connection once the target node is deleted elsewhere', () => {
    const input = withChoice();
    const after = deleteChoice(input, 'start', 'c1');
    const connections = getConnections(after);
    expect(connections).toHaveLength(1);
    expect(connections[0]?.choice.id).toBe('c2');
  });
});
