import { describe, expect, it } from 'vitest';
import {
  MAX_CHOICE_LABEL_LENGTH,
  connectNodes,
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
