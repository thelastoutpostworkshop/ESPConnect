<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from 'vuetify';
import arduinoMakerWorkshopThumbnail from '../assets/tool-thumbnails/arduino-maker-workshop.jpg';
import espBoardVaultThumbnail from '../assets/tool-thumbnails/esp-board-vault.jpg';
import espImageServerThumbnail from '../assets/tool-thumbnails/esp-image-server.png';
import espPinoutExplorerThumbnail from '../assets/tool-thumbnails/esp-pinout-explorer.png';
import gpioViewerThumbnail from '../assets/tool-thumbnails/gpio-viewer.jpg';
import partitionBuilderThumbnail from '../assets/tool-thumbnails/partition-builder.jpg';
import videoConversionThumbnail from '../assets/tool-thumbnails/video-conversion.jpg';

interface ToolItem {
  key: string;
  titleKey: string;
  icon: string;
  url?: string;
  descriptionKey: string;
  thumbnailSrc: string;
  actionIcon?: string;
  actionLabelKey?: string;
  sourceUrl?: string;
  sourceLabelKey?: string;
  tutorialUrl?: string;
}

interface ToolCardItem extends ToolItem {
  title: string;
  description: string;
  actionLabel: string;
  sourceLabel: string | null;
  tutorialActionUrl: string | null;
}

const { t } = useI18n();
const theme = useTheme();
const isDarkTheme = computed(() => theme.global.current.value.dark);

const coffeeUrl = 'https://buymeacoffee.com/thelastoutpostworkshop';

const toolItems: ToolItem[] = [
  {
    key: 'esp-image-server',
    titleKey: 'makerTools.items.espImageServer.title',
    icon: 'mdi-image-multiple-outline',
    descriptionKey: 'makerTools.items.espImageServer.description',
    thumbnailSrc: espImageServerThumbnail,
    sourceUrl: 'https://github.com/thelastoutpostworkshop/ESPImageServer',
    sourceLabelKey: 'makerTools.items.espImageServer.sourceLabel',
    tutorialUrl: 'https://youtu.be/4_eT38NmxBw',
  },
  {
    key: 'esp-pinout-explorer',
    titleKey: 'makerTools.items.espPinoutExplorer.title',
    icon: 'mdi-chip',
    url: 'https://thelastoutpostworkshop.github.io/esp-pinout-explorer/',
    descriptionKey: 'makerTools.items.espPinoutExplorer.description',
    thumbnailSrc: espPinoutExplorerThumbnail,
    sourceUrl: 'https://github.com/thelastoutpostworkshop/esp-pinout-explorer',
    sourceLabelKey: 'makerTools.items.espPinoutExplorer.sourceLabel',
    tutorialUrl: 'https://youtu.be/l357x8bTJg0',
  },
  {
    key: 'esp-board-vault',
    titleKey: 'makerTools.items.espBoardVault.title',
    icon: 'mdi-database-lock-outline',
    descriptionKey: 'makerTools.items.espBoardVault.description',
    thumbnailSrc: espBoardVaultThumbnail,
    sourceUrl: 'https://github.com/thelastoutpostworkshop/ESPVault',
    sourceLabelKey: 'makerTools.items.espBoardVault.sourceLabel',
    tutorialUrl: 'https://youtu.be/YwYP-eET9Oo',
  },
  {
    key: 'partition-builder',
    titleKey: 'makerTools.items.partitionBuilder.title',
    icon: 'mdi-table-cog',
    url: 'https://thelastoutpostworkshop.github.io/ESP32PartitionBuilder/',
    descriptionKey: 'makerTools.items.partitionBuilder.description',
    thumbnailSrc: partitionBuilderThumbnail,
    sourceUrl: 'https://github.com/thelastoutpostworkshop/ESP32PartitionBuilder',
    sourceLabelKey: 'makerTools.items.partitionBuilder.sourceLabel',
    tutorialUrl: 'https://www.youtube.com/watch?v=EuHxodrye6E',
  },
  {
    key: 'video-conversion',
    titleKey: 'makerTools.items.videoConversion.title',
    icon: 'mdi-movie-cog-outline',
    url: 'https://thelastoutpostworkshop.github.io/video_conversion/',
    descriptionKey: 'makerTools.items.videoConversion.description',
    thumbnailSrc: videoConversionThumbnail,
    sourceUrl: 'https://github.com/thelastoutpostworkshop/video_conversion',
    sourceLabelKey: 'makerTools.items.videoConversion.sourceLabel',
    tutorialUrl: 'https://www.youtube.com/watch?v=bFq05qXqin0',
  },
  {
    key: 'gpio-viewer',
    titleKey: 'makerTools.items.gpioViewer.title',
    icon: 'mdi-chip',
    url: 'https://www.youtube.com/watch?v=JJzRXcQrl3I',
    actionIcon: 'mdi-youtube',
    actionLabelKey: 'makerTools.actions.watchTutorial',
    descriptionKey: 'makerTools.items.gpioViewer.description',
    thumbnailSrc: gpioViewerThumbnail,
    sourceUrl: 'https://github.com/thelastoutpostworkshop/gpio_viewer',
    sourceLabelKey: 'makerTools.items.gpioViewer.sourceLabel',
  },
  {
    key: 'arduino-maker-workshop',
    titleKey: 'makerTools.items.arduinoMakerWorkshop.title',
    icon: 'mdi-microsoft-visual-studio-code',
    url: 'https://marketplace.visualstudio.com/items?itemName=TheLastOutpostWorkshop.arduino-maker-workshop',
    descriptionKey: 'makerTools.items.arduinoMakerWorkshop.description',
    thumbnailSrc: arduinoMakerWorkshopThumbnail,
    sourceLabelKey: 'makerTools.items.arduinoMakerWorkshop.sourceLabel',
    tutorialUrl: 'https://www.youtube.com/watch?v=rduTUUVkzqM',
  },
];

const toolCards = computed<ToolCardItem[]>(() =>
  toolItems.map(tool => ({
    ...tool,
    title: t(tool.titleKey),
    description: t(tool.descriptionKey),
    actionLabel: t(tool.actionLabelKey ?? 'makerTools.actions.openTool'),
    sourceLabel: tool.sourceLabelKey ? t(tool.sourceLabelKey) : null,
    tutorialActionUrl: getTutorialActionUrl(tool),
  })),
);

function getTutorialActionUrl(tool: ToolItem): string | null {
  if (tool.tutorialUrl) {
    return tool.tutorialUrl;
  }

  return getYoutubeVideoId(tool.url) ? tool.url ?? null : null;
}

function getYoutubeVideoId(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, '');

    if (hostname === 'youtu.be') {
      return normalizeYoutubeVideoId(parsedUrl.pathname.split('/').filter(Boolean)[0]);
    }

    if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
      if (parsedUrl.pathname === '/watch') {
        return normalizeYoutubeVideoId(parsedUrl.searchParams.get('v'));
      }

      const pathMatch = parsedUrl.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
      return normalizeYoutubeVideoId(pathMatch?.[1]);
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeYoutubeVideoId(value: string | null | undefined): string | null {
  const videoId = value?.trim();
  return videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId) ? videoId : null;
}
</script>

<template>
  <section :class="['maker-tools', isDarkTheme ? 'maker-tools--dark' : 'maker-tools--light']">
    <header class="maker-tools__header">
      <div>
        <h2 class="maker-tools__title">{{ t('makerTools.title') }}</h2>
        <p class="maker-tools__subtitle">
          {{ t('makerTools.subtitle') }}
        </p>
      </div>
    </header>

    <div class="maker-tools__support">
      <div class="maker-tools__support-icon" aria-hidden="true">
        <v-icon icon="mdi-coffee-outline" size="28" />
      </div>
      <div class="maker-tools__support-copy">
        <div class="maker-tools__support-title">{{ t('makerTools.support.title') }}</div>
        <p>{{ t('makerTools.support.description') }}</p>
      </div>
      <v-btn class="maker-tools__support-button" prepend-icon="mdi-coffee-outline" :href="coffeeUrl" target="_blank"
        rel="noopener">
        {{ t('makerTools.support.action') }}
      </v-btn>
    </div>

    <div class="maker-tools__grid">
      <article v-for="(tool, index) in toolCards" :key="tool.key" class="maker-tools__card">
        <div class="maker-tools__card-body">
          <div class="maker-tools__media">
            <a
              v-if="tool.tutorialActionUrl"
              class="maker-tools__thumbnail"
              :href="tool.tutorialActionUrl"
              target="_blank"
              rel="noopener"
              :aria-label="t('makerTools.actions.watchSpecific', { title: tool.title })"
              :style="{ '--maker-tools-thumbnail-delay': `${index * 70}ms` }"
            >
              <img
                :src="tool.thumbnailSrc"
                :alt="t('makerTools.thumbnailAlt', { title: tool.title })"
                loading="lazy"
              />
              <span class="maker-tools__thumbnail-icon" aria-hidden="true">
                <v-icon :icon="tool.icon" size="18" />
              </span>
            </a>
            <div v-else class="maker-tools__icon" aria-hidden="true">
              <v-icon :icon="tool.icon" size="28" />
            </div>
          </div>

          <div class="maker-tools__copy">
            <h3>{{ tool.title }}</h3>
            <p>{{ tool.description }}</p>
            <a
              v-if="tool.sourceUrl && tool.sourceLabel"
              class="maker-tools__source"
              :href="tool.sourceUrl"
              target="_blank"
              rel="noopener"
            >
              {{ tool.sourceLabel }}
            </a>
            <div v-else-if="tool.sourceLabel" class="maker-tools__source-label">
              {{ tool.sourceLabel }}
            </div>
          </div>
        </div>

        <v-divider />

        <div class="maker-tools__actions">
          <v-btn
            v-if="tool.tutorialUrl"
            color="primary"
            class="maker-tools__action-btn"
            prepend-icon="mdi-youtube"
            variant="text"
            :href="tool.tutorialUrl"
            target="_blank"
            rel="noopener"
          >
            {{ t('makerTools.actions.watchTutorial') }}
          </v-btn>
          <v-spacer />
          <v-btn
            v-if="tool.url"
            class="maker-tools__action-btn"
            variant="text"
            :prepend-icon="tool.actionIcon ?? 'mdi-open-in-new'"
            :href="tool.url"
            target="_blank"
            rel="noopener"
          >
            {{ tool.actionLabel }}
          </v-btn>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.maker-tools {
  display: grid;
  gap: 16px;
  color: rgb(var(--v-theme-on-surface));
}

.maker-tools--light {
  --maker-tools-accent: #0f766e;
  --maker-tools-accent-contrast: #ffffff;
  --maker-tools-accent-wash: rgba(15, 118, 110, 0.08);
  --maker-tools-card-wash: rgba(15, 118, 110, 0.05);
  --maker-tools-panel: rgb(var(--v-theme-surface));
  --maker-tools-panel-strong: color-mix(in srgb, rgb(var(--v-theme-surface)) 88%, #ccfbf1 12%);
  --maker-tools-line: rgba(15, 118, 110, 0.18);
  --maker-tools-icon-bg: rgba(15, 118, 110, 0.1);
  --maker-tools-icon-border: rgba(15, 118, 110, 0.24);
  --maker-tools-actions-bg: color-mix(in srgb, rgb(var(--v-theme-surface)) 92%, #ccfbf1 8%);
  --maker-tools-card-shadow: 0 12px 26px rgba(15, 23, 42, 0.1);
  --maker-tools-inset-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.65);
}

.maker-tools--dark {
  --maker-tools-accent: #35d6b8;
  --maker-tools-accent-contrast: #06251f;
  --maker-tools-accent-wash: rgba(53, 214, 184, 0.08);
  --maker-tools-card-wash: rgba(53, 214, 184, 0.06);
  --maker-tools-panel: #11201d;
  --maker-tools-panel-strong: #152824;
  --maker-tools-line: rgba(93, 210, 185, 0.2);
  --maker-tools-icon-bg: rgba(53, 214, 184, 0.1);
  --maker-tools-icon-border: rgba(53, 214, 184, 0.28);
  --maker-tools-actions-bg: rgba(9, 24, 21, 0.5);
  --maker-tools-card-shadow: 0 12px 26px rgba(0, 0, 0, 0.18);
  --maker-tools-inset-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.maker-tools__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.maker-tools__title {
  margin: 0;
  font-size: 1.55rem;
  font-weight: 750;
  line-height: 1.2;
}

.maker-tools__subtitle {
  max-width: 720px;
  margin: 8px 0 0;
  color: rgba(var(--v-theme-on-surface), 0.68);
  line-height: 1.55;
}

.maker-tools__support {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  border: 1px solid var(--maker-tools-line);
  border-radius: 8px;
  padding: 16px;
  background:
    linear-gradient(90deg, var(--maker-tools-accent-wash), transparent 70%),
    var(--maker-tools-panel);
  box-shadow: var(--maker-tools-inset-highlight);
}

.maker-tools__support-icon,
.maker-tools__icon {
  display: grid;
  place-items: center;
  border: 1px solid var(--maker-tools-icon-border);
  border-radius: 8px;
  background: var(--maker-tools-icon-bg);
  color: var(--maker-tools-accent);
}

.maker-tools__support-icon {
  width: 52px;
  height: 52px;
}

.maker-tools__support-title {
  font-weight: 750;
}

.maker-tools__support-copy {
  min-width: 0;
}

.maker-tools__support-copy p {
  margin: 6px 0 0;
  color: rgba(var(--v-theme-on-surface), 0.68);
  line-height: 1.5;
}

.maker-tools__support-button {
  background: var(--maker-tools-accent) !important;
  color: var(--maker-tools-accent-contrast) !important;
  font-weight: 750;
}

.maker-tools__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.maker-tools__card {
  position: relative;
  display: flex;
  min-height: 252px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--maker-tools-line);
  border-radius: 8px;
  background:
    linear-gradient(120deg, var(--maker-tools-card-wash), transparent 42%),
    var(--maker-tools-panel);
  box-shadow:
    var(--maker-tools-card-shadow),
    var(--maker-tools-inset-highlight);
}

.maker-tools__card-body {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: minmax(200px, 250px) minmax(0, 1fr);
  align-items: start;
  gap: 18px;
  padding: 16px;
}

.maker-tools__media {
  min-width: 0;
}

.maker-tools__thumbnail {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1px solid rgba(53, 214, 184, 0.22);
  border-radius: 8px;
  background: var(--maker-tools-panel-strong);
  color: #ffffff;
  opacity: 0;
  transform: translateY(8px) scale(0.985);
  animation: maker-tools-thumbnail-enter 460ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: var(--maker-tools-thumbnail-delay, 0ms);
}

.maker-tools__thumbnail img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition:
    filter 180ms ease,
    transform 180ms ease;
}

.maker-tools__thumbnail::after {
  position: absolute;
  inset: 0;
  content: '';
  background:
    linear-gradient(180deg, rgba(5, 20, 18, 0.08), rgba(5, 20, 18, 0.34)),
    linear-gradient(90deg, color-mix(in srgb, var(--v-theme-primary) 24%, transparent), transparent 44%);
}

.maker-tools__thumbnail:hover img {
  filter: saturate(1.08) contrast(1.03);
  transform: scale(1.025);
}

.maker-tools__thumbnail:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 3px;
}

.maker-tools__thumbnail-icon {
  position: absolute;
  z-index: 1;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.28);
  box-shadow: 0 10px 24px rgba(3, 13, 10, 0.22);
}

.maker-tools__thumbnail-icon {
  top: 8px;
  left: 8px;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: rgba(5, 20, 18, 0.62);
}

.maker-tools__icon {
  width: 52px;
  height: 52px;
}

.maker-tools__copy {
  min-width: 0;
}

.maker-tools__copy h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 750;
  line-height: 1.3;
}

.maker-tools__copy p {
  margin: 8px 0 12px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  line-height: 1.5;
}

.maker-tools__source,
.maker-tools__source-label {
  color: var(--maker-tools-accent);
  font-size: 0.86rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.maker-tools__source:hover {
  text-decoration: underline;
}

.maker-tools__card :deep(.v-divider) {
  border-color: var(--maker-tools-line);
  opacity: 1;
}

.maker-tools__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--maker-tools-actions-bg);
}

.maker-tools__action-btn {
  color: var(--maker-tools-accent) !important;
  font-weight: 750;
}

.maker-tools__actions :deep(.v-btn) {
  min-width: 0;
}

.maker-tools__actions :deep(.v-btn__content) {
  white-space: normal;
}

@keyframes maker-tools-thumbnail-enter {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.985);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .maker-tools__thumbnail {
    opacity: 1;
    transform: none;
    animation: none;
  }
}

@media (max-width: 1180px) {
  .maker-tools__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .maker-tools__support,
  .maker-tools__card-body {
    grid-template-columns: 1fr;
  }

  .maker-tools__actions {
    flex-wrap: wrap;
  }

  .maker-tools__thumbnail {
    max-width: 420px;
  }
}
</style>
