<template>
  <nut-swipe
    class="sub-item-swipe"
    :class="{ 'is-dual-column': isDualColumn }"
  >
    <article
      class="sub-item-wrapper"
      :class="{ 'is-dual-column': isDualColumn }"
      :style="{ padding: itemPadding }"
      @click="$emit('publish')"
    >
      <div class="sub-img-wrappers">
        <div
          class="config-target-avatar"
          role="img"
          :aria-label="targetNames"
          :style="{ width: `${avatarSize}px`, height: `${avatarSize}px` }"
        >
          <img
            v-for="target in CONFIG_GENERATOR_TARGET_DEFINITIONS"
            :key="target.target"
            :src="target.icon"
            alt=""
            aria-hidden="true"
          >
        </div>
      </div>

      <div class="sub-item-content">
        <div class="sub-item-title-wrapper">
          <h3 class="sub-item-title" :title="displayName">
            <span class="sub-item-name">{{ displayName }}</span>
          </h3>
          <div class="sub-item-menu" :class="{ 'simple-mode': appearanceSetting.isSimpleMode }">
            <button
              type="button"
              class="copy-sub-link"
              :title="$t('configGenerator.edit')"
              @click.stop="$emit('edit')"
            >
              <font-awesome-icon icon="fa-solid fa-pen-nib" />
            </button>
          </div>
        </div>

        <p :class="appearanceSetting.isSimpleMode ? 'sub-item-detail-isSimple' : 'sub-item-detail'">
          <span>{{ detail }}</span>
        </p>
        <p v-if="project.remark" class="sub-item-remark">
          <span>{{ project.remark }}</span>
        </p>
      </div>
    </article>

    <template v-if="appearanceSetting.isLeftRight" #left>
      <div class="sub-item-swipe-btn-wrapper">
        <nut-button shape="square" type="danger" class="sub-item-swipe-btn" @click="$emit('remove')">
          <font-awesome-icon icon="fa-solid fa-trash-can" />
        </nut-button>
      </div>
    </template>
    <template v-else #right>
      <div class="sub-item-swipe-btn-wrapper">
        <nut-button shape="square" type="danger" class="sub-item-swipe-btn" @click="$emit('remove')">
          <font-awesome-icon icon="fa-solid fa-trash-can" />
        </nut-button>
      </div>
    </template>
  </nut-swipe>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '@/store/settings';
import { CONFIG_GENERATOR_TARGET_DEFINITIONS } from '@/views/extensions/configGeneratorTargets';

const props = defineProps<{
  project: ConfigProject;
  detail: string;
  isDualColumn?: boolean;
}>();

defineEmits<{
  publish: [];
  edit: [];
  remove: [];
}>();

const settingsStore = useSettingsStore();
const { appearanceSetting } = storeToRefs(settingsStore);
const displayName = computed(() => props.project.displayName || props.project.name);
const avatarSize = computed(() => appearanceSetting.value.isSimpleMode ? 36 : (props.isDualColumn ? 40 : 48));
const targetNames = CONFIG_GENERATOR_TARGET_DEFINITIONS.map(target => target.displayName).join('、');
const itemPadding = computed(() => appearanceSetting.value.isSimpleMode ? '9px' : (props.isDualColumn ? '12px' : '16px'));
</script>

<style lang="scss" scoped>
.sub-item-swipe {
  position: relative;
  display: block;
  min-width: 0;
  user-select: none;
}

.sub-item-wrapper {
  display: flex;
  position: relative;
  min-width: 0;
  overflow: hidden;
  border-radius: var(--item-card-radios);
  background: var(--card-color);
  cursor: pointer;
  line-height: 1.4;
}

.config-target-avatar {
  display: grid;
  box-sizing: border-box;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  flex-shrink: 0;
  padding: 2px;
  margin-right: 15px;
  overflow: hidden;
  border: 1px solid var(--divider-color);
  border-radius: 12px;
  background: var(--background-color);
  box-shadow: 0 5px 14px rgba(18, 24, 38, 0.05);

  img {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    object-fit: contain;
    border-radius: 4px;
  }
}

.sub-item-content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  line-height: 1.6;
}

.sub-item-title-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2px;
}

.sub-item-title {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: center;
  overflow: hidden;
  margin: 0;
  color: var(--primary-text-color);
  font-size: 16px;
  white-space: nowrap;
}

.sub-item-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub-item-menu {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  padding: 4px 0;

  &.simple-mode {
    position: relative;
    top: 8px;
  }
}

.copy-sub-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  padding: 0 6px;
  background: transparent;
  cursor: pointer;

  svg {
    width: 16px;
    height: 16px;
    color: var(--comment-text-color);
  }
}

.sub-item-detail,
.sub-item-remark,
.sub-item-detail-isSimple {
  display: -webkit-box;
  overflow: hidden;
  margin: 4px 0 0;
  color: var(--comment-text-color);
  font-size: 12px;
  word-break: break-all;
  -webkit-box-orient: vertical;
}

.sub-item-detail,
.sub-item-remark {
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.sub-item-detail-isSimple {
  max-width: 80%;
  margin-top: 2px;
  -webkit-line-clamp: 1;
  line-clamp: 1;
}

.sub-item-swipe.is-dual-column {
  .config-target-avatar {
    margin-right: 12px;
  }

  .sub-item-title-wrapper {
    align-items: flex-start;
    gap: 6px;
  }

  .sub-item-title {
    font-size: 15px;
  }

  .sub-item-detail,
  .sub-item-remark {
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }

  .sub-item-detail-isSimple {
    max-width: 100%;
  }
}

:deep(.nut-swipe__left),
:deep(.nut-swipe__right) {
  display: flex;
  align-items: center;
  justify-content: space-around;

  .sub-item-swipe-btn-wrapper {
    padding-left: 14px;

    &:last-child {
      padding-right: 14px;
    }
  }

  .sub-item-swipe-btn {
    width: 44px;
    height: 46px;
    border-radius: 50%;
  }
}
</style>
