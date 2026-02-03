<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ensureSeedStories } from '@/lib/seedStories';
import { storyStorage } from '@/lib/storyStorage';
import type { StorySummary } from '@/types/story';

const stories = ref<StorySummary[]>([]);

onMounted(() => {
  ensureSeedStories();
  stories.value = storyStorage.listStories();
});

const rows = computed(() => stories.value);

function formatLastModified(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return 'Unknown date';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(time));
}

function describeStory(story: StorySummary): string {
  const when = formatLastModified(story.lastModified);
  const description =
    story.description.length > 0 ? ` Description: ${story.description}.` : '';
  return `Story "${story.title}" by ${story.author}, last modified ${when} (UTC).${description}`;
}
</script>

<template>
  <section class="story-list" aria-label="Story list">
    <h2>Your stories</h2>
    <p v-if="rows.length === 0" class="empty" data-testid="story-list-empty">
      No stories yet. Create one to start a new branch of adventure.
    </p>
    <ul v-else class="story-list__items">
      <li
        v-for="story in rows"
        :key="story.id"
        class="story-card"
        :aria-label="describeStory(story)"
      >
        <div class="story-card__main">
          <h3 class="story-card__title">
            {{ story.title }}
          </h3>
          <p class="story-card__author">by {{ story.author }}</p>
          <p
            v-if="story.description.length > 0"
            class="story-card__description"
            data-testid="story-list-item-description"
          >
            {{ story.description }}
          </p>
        </div>
        <time
          class="story-card__modified"
          :datetime="story.lastModified"
          data-testid="story-list-item"
        >
          {{ formatLastModified(story.lastModified) }}
        </time>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.story-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.story-list h2 {
  margin: 0;
  font-size: 1.25rem;
}

.empty {
  color: #5c6470;
  font-style: italic;
}

.story-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}

.story-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid #d8dde5;
  border-radius: 8px;
  background: #fff;
}

.story-card__title {
  margin: 0;
  font-size: 1rem;
}

.story-card__author {
  margin: 0.15rem 0 0;
  color: #5c6470;
  font-size: 0.85rem;
}

.story-card__description {
  margin: 0.25rem 0 0;
  color: #333;
  font-size: 0.85rem;
}

.story-card__modified {
  color: #5c6470;
  font-size: 0.8rem;
  white-space: nowrap;
}
</style>
