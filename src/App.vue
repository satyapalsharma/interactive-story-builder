<script setup lang="ts">
import { computed, ref } from 'vue';
import StoryList from '@/components/StoryList.vue';
import CreateStoryForm from '@/components/CreateStoryForm.vue';
import ImportStoryForm from '@/components/ImportStoryForm.vue';
import StoryEditorView from '@/components/StoryEditorView.vue';
import StoryReader from '@/components/StoryReader.vue';
import { storyStorage } from '@/lib/storyStorage';
import type { Story, StorySummary } from '@/types/story';

// Bumped after a story is created or edited; re-keys the list so it re-reads storage.
const listVersion = ref(0);

// Story whose node editor is currently open, or null when it is not.
const editingStoryId = ref<string | null>(null);
const editingStory = computed<Story | null>(() => {
  if (editingStoryId.value === null) return null;
  return storyStorage.getStory(editingStoryId.value) ?? null;
});

// Story currently open in the preview reader, or null when it is not.
const readingStoryId = ref<string | null>(null);
const readingStory = computed<Story | null>(() => {
  if (readingStoryId.value === null) return null;
  return storyStorage.getStory(readingStoryId.value) ?? null;
});

function onStoryCreated(_summary: StorySummary) {
  listVersion.value += 1;
}

function onStoryImported(_storyId: string) {
  listVersion.value += 1;
}

function onOpenStory(storyId: string) {
  readingStoryId.value = null;
  editingStoryId.value = storyId;
}

function onOpenReader(storyId: string) {
  editingStoryId.value = null;
  readingStoryId.value = storyId;
}

function onCloseEditor() {
  editingStoryId.value = null;
}

function onCloseReader() {
  readingStoryId.value = null;
}
</script>

<template>
  <main>
    <h1>Interactive Story Builder</h1>
    <template v-if="editingStory !== null">
      <StoryEditorView
        :story="editingStory"
        @updated="listVersion += 1"
        @close="onCloseEditor"
        @read="onOpenReader"
      />
    </template>
    <template v-else-if="readingStory !== null">
      <StoryReader
        :story="readingStory"
        @close="onCloseReader"
      />
    </template>
    <template v-else>
      <CreateStoryForm @created="onStoryCreated" />
      <ImportStoryForm @imported="onStoryImported" />
      <StoryList
        :key="listVersion"
        @open="onOpenStory"
        @read="onOpenReader"
      />
    </template>
  </main>
</template>

<style>
main {
  max-width: 42rem;
  margin: 0 auto;
  padding: 1.5rem;
  font-family: system-ui, sans-serif;
}

main > * {
  margin-bottom: 1.25rem;
}

h1 {
  margin: 0 0 1rem;
  font-size: 1.6rem;
}
</style>
