import { storyStorage } from '@/lib/storyStorage';

/**
 * Seed two demo stories on first launch so the list view is never empty.
 * Idempotent: only creates stories when none are persisted yet.
 */
export function ensureSeedStories(): void {
  const existing = storyStorage.listStories();
  if (existing.length > 0) return;

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  storyStorage.upsertStory({
    id: 'seed-the-lighthouse',
    title: 'The Lighthouse Keeper',
    author: 'Ada Marlowe',
    lastModified: yesterday.toISOString(),
    nodes: [
      {
        id: 'start',
        text: 'Fog rolls in over the harbor. A light flickers in the lighthouse.',
        choices: [
          { id: 'c-climb', label: 'Climb the tower', targetNodeId: 'tower' },
          { id: 'c-stay', label: 'Wait on the shore', targetNodeId: 'shore' },
        ],
      },
      {
        id: 'tower',
        text: 'The keeper is gone, but a lamp still burns.',
        choices: [],
      },
      {
        id: 'shore',
        text: 'A rowboat drifts ashore, empty.',
        choices: [],
      },
    ],
  });

  storyStorage.upsertStory({
    id: 'seed-neon-alley',
    title: 'Neon Alley',
    author: 'R. Vance',
    lastModified: now.toISOString(),
    nodes: [
      {
        id: 'start',
        text: 'The rain smells like static. A vending machine hums at the end of the alley.',
        choices: [
          { id: 'c-cyber', label: 'Jack in', targetNodeId: 'grid' },
          { id: 'c-run', label: 'Run', targetNodeId: 'rooftops' },
        ],
      },
      {
        id: 'grid',
        text: 'The city\u2019s memory unfolds around you, pixel by pixel.',
        choices: [],
      },
      {
        id: 'rooftops',
        text: 'You vanish into the rain-slick skyline.',
        choices: [],
      },
    ],
  });
}
