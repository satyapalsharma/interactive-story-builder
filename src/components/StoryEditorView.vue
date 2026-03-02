<script setup lang="ts">
import { computed, ref } from 'vue';
import NodeEditor from '@/components/NodeEditor.vue';
import {
  assignPositions,
  getConnections,
} from '@/lib/nodeGraph';
import {
  nodeBackground,
  nodeHeading,
  updateNodeContent,
} from '@/lib/nodeContent';
import { storyStorage } from '@/lib/storyStorage';
import type { Story, StoryNode } from '@/types/story';

const props = defineProps<{
  story: Story;
}>();

const emit = defineEmits<{
  /** Persisted content changed; the parent can refresh the story list. */
  (e: 'updated'): void;
  /** The editor was dismissed (close button); nothing was saved. */
  (e: 'close'): void;
}>();

// Assign missing canvas positions lazily and keep them for the session.
const nodes = computed<StoryNode[]>(() =>
  assignPositions(props.story.nodes),
);
const connections = computed(() => getConnections(nodes.value));

const selectedNodeId = ref<string | null>(null);
const selectedNode = computed<StoryNode | undefined>(() =>
  nodes.value.find((node) => node.id === selectedNodeId.value),
);

function selectNode(node: StoryNode) {
  selectedNodeId.value = node.id;
}

function closeEditor() {
  selectedNodeId.value = null;
  emit('close');
}

function onContentSaved(
  edit: { text: string; title: string; backgroundColor: string },
) {
  if (selectedNodeId.value === null) return;
  const result = updateNodeContent(
    props.story.nodes,
    selectedNodeId.value,
    edit,
  );
  if (!result.ok) return;

  const story = storyStorage.getStory(props.story.id);
  if (story === undefined) return;
  const updated: Story = {
    ...story,
    nodes: result.nodes.map((node, index) => {
      // Carry session-assigned positions over the persisted result.
      const position =
        nodes.value.find((existing) => existing.id === node.id)?.position;
      return position === undefined ? node : { ...node, position };
    }),
  };
  storyStorage.upsertStory(updated);
  emit('updated');
}

function nodeStyle(node: StoryNode) {
  return { backgroundColor: nodeBackground(node) };
}
</script>

<template>
  <section class="story-editor" :aria-label="`Story editor for ${story.title}`">
    <header class="story-editor__header">
      <div>
        <h2 class="story-editor__title">{{ story.title }}</h2>
        <p class="story-editor__author">by {{ story.author }}</p>
      </div>
      <button
        type="button"
        class="story-editor__close"
        data-testid="story-editor-close"
        @click="emit('close')"
      >
        Close editor
      </button>
    </header>

    <p class="story-editor__hint" data-testid="story-editor-hint">
      Click a scene card to edit its text, title and background color.
    </p>

    <div
      class="story-editor__canvas"
      role="group"
      aria-label="Scene graph"
      data-testid="story-editor-canvas"
    >
      <template v-for="node in nodes" :key="node.id">
        <button
          type="button"
          class="scene-card"
          :class="{ 'scene-card--selected': node.id === selectedNodeId }"
          :style="nodeStyle(node)"
          :aria-pressed="node.id === selectedNodeId"
          :data-testid="`scene-card-${node.id}`"
          @click="selectNode(node)"
        >
          <span
            class="scene-card__heading"
            :data-testid="`scene-card-title-${node.id}`"
          >
            {{ nodeHeading(node) }}
          </span>
          <span
            class="scene-card__text"
            :data-testid="`scene-card-text-${node.id}`"
          >
            {{ node.text }}
          </span>
          <span
            v-if="node.choices.length > 0"
            class="scene-card__choice-count"
          >
            {{ node.choices.length }} choice{{ node.choices.length === 1 ? '' : 's' }}
          </span>
        </button>

        <p
          v-for="connection in connections"
          v-show="connection.source.id === node.id"
          :key="connection.choice.id"
          class="scene-card__link"
          :data-testid="`scene-link-${node.id}-${connection.choice.targetNodeId}`"
        >
          {{ connection.choice.label }} &rarr;
          {{ nodes.find((n) => n.id === connection.choice.targetNodeId)?.text.slice(0, 24) }}
        </p>
      </template>
    </div>

    <NodeEditor
      v-if="selectedNode"
      :key="selectedNode.id"
      :node="selectedNode"
      data-testid="node-editor"
      @save="onContentSaved"
    />
  </section>
</template>

<style scoped>
.story-editor {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.story-editor__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.story-editor__title {
  margin: 0;
  font-size: 1.3rem;
}

.story-editor__author {
  margin: 0.15rem 0 0;
  color: #5c6470;
  font-size: 0.85rem;
}

.story-editor__close {
  border: 1px solid #c9cfda;
  border-radius: 6px;
  background: #fff;
  font: inherit;
  padding: 0.4rem 0.8rem;
  cursor: pointer;
}

.story-editor__hint {
  margin: 0;
  color: #5c6470;
  font-size: 0.85rem;
}

.story-editor__canvas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 1rem;
}

.scene-card {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  align-items: flex-start;
  text-align: left;
  border: 1px solid #d8dde5;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  cursor: pointer;
  font: inherit;
}

.scene-card:hover {
  box-shadow: 0 2px 6px rgba(43, 108, 176, 0.2);
}

.scene-card--selected {
  outline: 3px solid #2b6cb0;
  outline-offset: 1px;
}

.scene-card__heading {
  font-weight: 700;
  font-size: 0.95rem;
}

.scene-card__text {
  font-size: 0.85rem;
  color: #333;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.scene-card__choice-count {
  font-size: 0.75rem;
  color: #5c6470;
}

.scene-card__link {
  grid-column: 1 / -1;
  margin: 0;
  color: #5c6470;
  font-size: 0.75rem;
}
</style>
