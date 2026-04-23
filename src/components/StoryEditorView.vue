<script setup lang="ts">
import { computed, ref } from 'vue';
import NodeEditor from '@/components/NodeEditor.vue';
import {
  assignPositions,
  connectNodes,
  deleteChoice,
  getConnections,
} from '@/lib/nodeGraph';
import {
  nodeBackground,
  nodeHeading,
  updateNodeContent,
} from '@/lib/nodeContent';
import { downloadStory, storyFileName } from '@/lib/storyExport';
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
  /** The user wants to preview-read this story from its start node. */
  (e: 'read', storyId: string): void;
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
  persistNodes(result.nodes);
}

/**
 * Persist updated node arrays back to storage, carrying session-assigned
 * positions over the result so the session layout survives a save.
 */
function persistNodes(nextNodes: StoryNode[]): void {
  const story = storyStorage.getStory(props.story.id);
  if (story === undefined) return;
  const updated: Story = {
    ...story,
    nodes: nextNodes.map((node) => {
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

// ---- Drag-to-connect interaction -----------------------------------------

/**
 * Native HTML5 drag state: the id of the node the user started dragging a
 * new choice from, or null when no drag is in progress.
 */
const draggingSourceId = ref<string | null>(null);

/** The id of the card under the pointer during a drag, for drop styling. */
const dropTargetId = ref<string | null>(null);

/** True while the user is dragging a new choice from a source node. */
const isDragging = computed(() => draggingSourceId.value !== null);

/** Whether a hovered node would be an invalid link destination. */
function isInvalidTarget(nodeId: string | null): boolean {
  return nodeId !== null && nodeId === draggingSourceId.value;
}

/** Whether a hovered node already has an outgoing choice from the source. */
function isLinkedTarget(nodeId: string | null): boolean {
  if (nodeId === null || draggingSourceId.value === null) return false;
  const source = nodes.value.find((n) => n.id === draggingSourceId.value);
  if (source === undefined) return false;
  return source.choices.some((choice) => choice.targetNodeId === nodeId);
}

function onDragStart(event: DragEvent, node: StoryNode) {
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', node.id);
    event.dataTransfer.effectAllowed = 'link';
  }
  draggingSourceId.value = node.id;
  dropTargetId.value = null;
}

function onDragEnd() {
  draggingSourceId.value = null;
  dropTargetId.value = null;
}

function onDragOver(event: DragEvent, node: StoryNode) {
  // Only accept drops on a valid target; this also makes the browser show
  // the "link" drop cursor and lets the drop actually fire.
  if (draggingSourceId.value === null || node.id === draggingSourceId.value) {
    return;
  }
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'link';
  }
  dropTargetId.value = node.id;
}

function onDragLeave(node: StoryNode) {
  if (dropTargetId.value === node.id) {
    dropTargetId.value = null;
  }
}

// ---- Delete-connection interaction --------------------------------------

/**
 * Remove a single choice link. `sourceId` and `choiceId` identify the
 * specific edge to drop; `deleteChoice` returns a new node array with that
 * choice gone from its source node (other nodes are untouched). The result
 * is persisted so the deletion survives a reload, and a confirmation is
 * shown in the status line. `deleteChoice` is a safe no-op when the source
 * node or the choice no longer exists (e.g. a double-click on a stale row),
 * so calling it with unknown ids never corrupts the graph.
 */
function removeConnection(
  sourceId: string,
  choiceId: string,
  label: string,
) {
  const result = deleteChoice(props.story.nodes, sourceId, choiceId);
  persistNodes(result);
  setStatus(`Removed choice “${label}”.`);
}

/**
 * Context-menu (right-click) handler for a connection row: confirms the
 * deletion directly, so a link can be removed without locating the visible
 * button. The browser's default context menu is suppressed.
 */
function onContextRemoveConnection(
  event: MouseEvent,
  sourceId: string,
  choiceId: string,
  label: string,
) {
  event.preventDefault();
  removeConnection(sourceId, choiceId, label);
}

/**
 * Drop on a target node: confirm a new choice from the dragged source.
 * The label defaults inside `connectNodes` (a truncated source-text
 * preview); any rejected connection (self, duplicate) is surfaced in the
 * status line instead of silently disappearing.
 */
function onDrop(event: DragEvent, node: StoryNode) {
  event.preventDefault();
  const sourceId = draggingSourceId.value;
  draggingSourceId.value = null;
  dropTargetId.value = null;

  if (sourceId === null || sourceId === node.id) return;

  const result = connectNodes(props.story.nodes, sourceId, node.id);
  if (!result.ok) {
    setStatus(result.error, 'error');
    return;
  }
  const sourceNode = props.story.nodes.find((n) => n.id === sourceId);
  const sourceHeading = sourceNode !== undefined ? nodeHeading(sourceNode) : sourceId;
  setStatus(
    `Added choice “${result.choice.label}” from ${sourceHeading} to ${nodeHeading(node)}.`,
  );
  persistNodes(result.nodes);
}

// ---- Connection status line -----------------------------------------------

const statusMessage = ref('');
const statusKind = ref<'info' | 'error'>('info');

function setStatus(message: string, kind: 'info' | 'error' = 'info') {
  statusMessage.value = message;
  statusKind.value = kind;
}

/**
 * Export the story as a JSON file for backup. The exported document is
 * always the latest persisted state (freshly re-read from storage), so an
 * unsaved session edit cannot leak a stale copy out of the app; the
 * download is reported through the status line.
 */
function exportStory() {
  const current = storyStorage.getStory(props.story.id) ?? props.story;
  const ok = downloadStory(current);
  if (ok) {
    setStatus(`Exported “${storyFileName(current)}”.`);
  } else {
    setStatus(
      'Export failed: this browser cannot trigger file downloads.',
      'error',
    );
  }
}

// ---- Dragging state visual hints ------------------------------------------

function cardClassList(node: StoryNode): string[] {
  const classes: string[] = [];
  if (node.id === selectedNodeId.value) classes.push('scene-card--selected');
  if (isDragging.value && node.id === dropTargetId.value && !isInvalidTarget(node.id)) {
    classes.push('scene-card--drop-target');
  }
  if (isDragging.value && isInvalidTarget(node.id)) {
    classes.push('scene-card--drop-invalid');
  }
  if (isDragging.value && isLinkedTarget(node.id)) {
    classes.push('scene-card--drop-linked');
  }
  return classes;
}
</script>

<template>
  <section class="story-editor" :aria-label="`Story editor for ${story.title}`">
    <header class="story-editor__header">
      <div>
        <h2 class="story-editor__title">{{ story.title }}</h2>
        <p class="story-editor__author">by {{ story.author }}</p>
      </div>
      <div class="story-editor__header-actions">
        <button
          type="button"
          class="story-editor__read"
          data-testid="story-editor-read"
          @click="emit('read', story.id)"
        >
          Read story
        </button>
        <button
          type="button"
          class="story-editor__export"
          data-testid="story-editor-export"
          aria-label="Export story as JSON"
          @click="exportStory"
        >
          Export JSON
        </button>
        <button
          type="button"
          class="story-editor__close"
          data-testid="story-editor-close"
          @click="emit('close')"
        >
          Close editor
        </button>
      </div>
    </header>

    <p class="story-editor__hint" data-testid="story-editor-hint">
      Click a scene card to edit its text, title and background color.
      Drag a card onto another card to add a choice from the source to the
      target. Right-click a connection (or use its “remove” button) to
      delete it.
    </p>

    <p
      v-if="statusMessage !== ''"
      class="story-editor__status"
      :class="{
        'story-editor__status--error': statusKind === 'error',
      }"
      :data-testid="statusKind === 'error' ? 'story-editor-status-error' : 'story-editor-status'"
      :role="statusKind === 'error' ? 'alert' : 'status'"
    >
      {{ statusMessage }}
    </p>

    <div
      class="story-editor__canvas"
      role="group"
      aria-label="Scene graph"
      data-testid="story-editor-canvas"
    >
      <template v-for="node in nodes" :key="node.id">
        <div
          class="scene-card-wrap"
          :class="{
            'scene-card-wrap--dragging': node.id === draggingSourceId,
          }"
          :data-dragging-source="node.id === draggingSourceId ? 'true' : 'false'"
        >
          <button
            type="button"
            class="scene-card"
            :class="cardClassList(node)"
            :style="nodeStyle(node)"
            :aria-pressed="node.id === selectedNodeId"
            :draggable="isDragging ? 'false' : 'true'"
            :data-testid="`scene-card-${node.id}`"
            @click="selectNode(node)"
            @dragstart="onDragStart($event, node)"
            @dragend="onDragEnd"
            @dragover="onDragOver($event, node)"
            @dragleave="onDragLeave(node)"
            @drop="onDrop($event, node)"
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
            <span
              class="scene-card__handle"
              :data-testid="`scene-card-handle-${node.id}`"
            >
              + add choice
            </span>
          </button>
        </div>

        <p
          v-for="connection in connections"
          v-show="connection.source.id === node.id"
          :key="connection.choice.id"
          class="scene-card__link"
          :data-testid="`scene-link-${node.id}-${connection.choice.targetNodeId}`"
          @contextmenu="onContextRemoveConnection($event, connection.source.id, connection.choice.id, connection.choice.label)"
        >
          <span class="scene-card__link-text">
            {{ connection.choice.label }} &rarr;
            {{ nodes.find((n) => n.id === connection.choice.targetNodeId)?.text.slice(0, 24) }}
          </span>
          <button
            type="button"
            class="scene-card__link-remove"
            :aria-label="`Remove choice ${connection.choice.label}`"
            :data-testid="`scene-link-remove-${node.id}-${connection.choice.id}`"
            @click="removeConnection(node.id, connection.choice.id, connection.choice.label)"
          >
            remove
          </button>
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

.story-editor__header-actions {
  display: flex;
  gap: 0.5rem;
}

.story-editor__read {
  border: 1px solid #2b6cb0;
  border-radius: 6px;
  background: #fff;
  color: #2b6cb0;
  font: inherit;
  padding: 0.4rem 0.8rem;
  cursor: pointer;
}

.story-editor__read:hover {
  background: #e8f0fb;
}

.story-editor__export {
  border: 1px solid #c9cfda;
  border-radius: 6px;
  background: #fff;
  font: inherit;
  padding: 0.4rem 0.8rem;
  cursor: pointer;
}

.story-editor__export:hover {
  background: #f2f4f8;
  border-color: #2b6cb0;
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

.story-editor__status {
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  background: #e5f5ea;
  color: #1d6b3a;
  font-size: 0.9rem;
}

.story-editor__status--error {
  background: #fdecec;
  color: #c0392b;
}

.story-editor__canvas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 1rem;
}

.scene-card-wrap {
  display: flex;
  flex-direction: column;
}

.scene-card-wrap--dragging {
  opacity: 0.6;
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
  cursor: grab;
  font: inherit;
}

.scene-card:active {
  cursor: grabbing;
}

.scene-card:hover {
  box-shadow: 0 2px 6px rgba(43, 108, 176, 0.2);
}

.scene-card--selected {
  outline: 3px solid #2b6cb0;
  outline-offset: 1px;
}

.scene-card--drop-target {
  border-color: #2b6cb0;
  box-shadow: 0 0 0 2px rgba(43, 108, 176, 0.35);
}

.scene-card--drop-invalid {
  border-style: dashed;
  border-color: #c0392b;
  cursor: not-allowed;
}

.scene-card--drop-linked {
  border-color: #5c6470;
  opacity: 0.65;
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

.scene-card__handle {
  margin-top: 0.15rem;
  font-size: 0.72rem;
  color: #2b6cb0;
  cursor: grab;
}

.scene-card__link {
  grid-column: 1 / -1;
  margin: 0;
  color: #5c6470;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  cursor: context-menu;
}

.scene-card__link:hover {
  background: #f2f4f8;
}

.scene-card__link-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scene-card__link-remove {
  flex: 0 0 auto;
  border: 1px solid #c9cfda;
  border-radius: 5px;
  background: #fff;
  color: #c0392b;
  font: inherit;
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  cursor: pointer;
}

.scene-card__link-remove:hover {
  background: #fdecec;
  border-color: #c0392b;
}
</style>
