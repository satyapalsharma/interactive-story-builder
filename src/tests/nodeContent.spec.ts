import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NODE_BACKGROUND,
  MAX_NODE_TITLE_LENGTH,
  isValidHexColor,
  nodeBackground,
  nodeHeading,
  normalizeNodeColor,
  normalizeNodeText,
  normalizeNodeTitle,
  updateNodeContent,
} from '@/lib/nodeContent';
import { MAX_NODE_TEXT_LENGTH } from '@/lib/nodeGraph';
import type { StoryNode } from '@/types/story';

function makeNode(overrides: Partial<StoryNode> = {}): StoryNode {
  return { id: 'n1', text: 'Once upon a time.', choices: [], ...overrides };
}

describe('isValidHexColor boundary checks', () => {
  it('accepts 3, 4, 6 and 8 digit hex colors', () => {
    expect(isValidHexColor('#fff')).toBe(true);
    expect(isValidHexColor('#ffff')).toBe(true);
    expect(isValidHexColor('#ffffff')).toBe(true);
    expect(isValidHexColor('#ffffffff')).toBe(true);
    expect(isValidHexColor('#FFF')).toBe(true);
  });

  it('rejects malformed, injected or non-string colors', () => {
    expect(isValidHexColor('#ff')).toBe(false); // too short
    expect(isValidHexColor('#fffffff')).toBe(false); // 7 digits: invalid length
    expect(isValidHexColor('#gggggg')).toBe(false); // non-hex chars
    expect(isValidHexColor('red')).toBe(false); // no hash
    expect(isValidHexColor('#ffffff;')).toBe(false); // trailing junk
    expect(isValidHexColor('javascript:alert(1)')).toBe(false);
    expect(isValidHexColor('#ffffff\n')).toBe(false); // newline injection
    expect(isValidHexColor(7 as unknown as string)).toBe(false); // non-string
    expect(isValidHexColor(null)).toBe(false);
  });
});

describe('normalizeNodeColor', () => {
  it('lowercases a valid color and trims whitespace', () => {
    expect(normalizeNodeColor('  #AABBCC  ')).toBe('#aabbcc');
  });

  it('returns the default for blank, invalid or non-string input', () => {
    expect(normalizeNodeColor('')).toBe(DEFAULT_NODE_BACKGROUND);
    expect(normalizeNodeColor('   ')).toBe(DEFAULT_NODE_BACKGROUND);
    expect(normalizeNodeColor('#zzzzzz')).toBe(DEFAULT_NODE_BACKGROUND);
    expect(normalizeNodeColor(undefined)).toBe(DEFAULT_NODE_BACKGROUND);
  });
});

describe('normalizeNodeTitle', () => {
  it('trims a title and caps it at the documented bound', () => {
    const long = 'x'.repeat(MAX_NODE_TITLE_LENGTH + 40);
    const title = normalizeNodeTitle(`  ${long}  `);
    expect(title.length).toBe(MAX_NODE_TITLE_LENGTH);
  });

  it('returns an empty string for blank or non-string input', () => {
    expect(normalizeNodeTitle('   ')).toBe('');
    expect(normalizeNodeTitle(42 as unknown as string)).toBe('');
  });
});

describe('normalizeNodeText', () => {
  it('trims valid text and reports success', () => {
    const result = normalizeNodeText('  hello  ');
    expect(result).toEqual({ ok: true, text: 'hello' });
  });

  it('rejects blank, non-string and over-length text', () => {
    expect(normalizeNodeText('   ')).toEqual({ ok: false, error: expect.any(String) });
    expect(normalizeNodeText(null)).toEqual({ ok: false, error: expect.any(String) });
    expect(normalizeNodeText('x'.repeat(MAX_NODE_TEXT_LENGTH + 1))).toEqual({
      ok: false,
      error: expect.any(String),
    });
  });

  it('accepts text exactly at the maximum length', () => {
    const exact = 'y'.repeat(MAX_NODE_TEXT_LENGTH);
    expect(normalizeNodeText(exact)).toEqual({ ok: true, text: exact });
  });
});

describe('updateNodeContent', () => {
  it('updates text, title and color immutably', () => {
    const original = makeNode();
    const result = updateNodeContent([original], 'n1', {
      text: '  A new beginning.  ',
      title: '  Opening  ',
      backgroundColor: '#AABBCC',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nodes).not.toBe([original]);
    expect(result.nodes[0]?.text).toBe('A new beginning.');
    expect(result.nodes[0]?.title).toBe('Opening');
    expect(result.nodes[0]?.backgroundColor).toBe('#aabbcc');
    // Original untouched.
    expect(original.text).toBe('Once upon a time.');
    expect(original.title).toBeUndefined();
  });

  it('rejects the whole edit when text is invalid', () => {
    const result = updateNodeContent([makeNode()], 'n1', {
      text: '   ',
      title: 'Should not apply',
    });
    expect(result.ok).toBe(false);
  });

  it('returns an error for an unknown node id', () => {
    const result = updateNodeContent([makeNode()], 'missing', { text: 'x' });
    expect(result.ok).toBe(false);
  });

  it('leaves other nodes untouched', () => {
    const other = makeNode({ id: 'n2', text: 'Other.' });
    const result = updateNodeContent([makeNode(), other], 'n1', { text: 'Changed.' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nodes[1]?.text).toBe('Other.');
  });

  it('clears the title when an empty string is supplied', () => {
    const withTitle = makeNode({ title: 'Old' });
    const result = updateNodeContent([withTitle], 'n1', { title: '' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nodes[0]?.title).toBeUndefined();
  });
});

describe('nodeBackground and nodeHeading fallbacks', () => {
  it('falls back to the default background when unset', () => {
    expect(nodeBackground(makeNode())).toBe(DEFAULT_NODE_BACKGROUND);
  });

  it('uses the explicit background when set', () => {
    expect(nodeBackground(makeNode({ backgroundColor: '#123456' }))).toBe('#123456');
  });

  it('falls back to a text preview when no title is set', () => {
    expect(nodeHeading(makeNode({ text: 'Short text.' }))).toBe('Short text.');
  });

  it('uses the title when set', () => {
    expect(nodeHeading(makeNode({ title: 'My Scene' }))).toBe('My Scene');
  });

  it('truncates long previews with an ellipsis', () => {
    const long = 'a'.repeat(60);
    const heading = nodeHeading(makeNode({ text: long }));
    expect(heading.endsWith('\u2026')).toBe(true);
    expect(heading.length).toBeLessThanOrEqual(30);
  });
});
