<template>
  <div class="extension-store-page">
    <input
      ref="localDirectoryInput"
      class="local-directory-input"
      type="file"
      webkitdirectory
      directory
      multiple
      @change="handleLocalDirectoryChange"
    />

    <div
      v-if="extensionStore.discoveryStatus === 'legacy' || (extensionStore.error && ['unknown', 'failed'].includes(extensionStore.discoveryStatus))"
      class="compatibility-note"
      :class="{ warning: extensionStore.discoveryStatus !== 'legacy' }"
      role="status"
    >
      <font-awesome-icon icon="fa-solid fa-circle-info" />
      <span>{{ extensionStore.discoveryStatus === 'legacy' ? labels.compatibility : labels.discoveryFailed }}</span>
      <button type="button" @click="refresh">{{ labels.retry }}</button>
    </div>

    <section v-if="activeTasks.length" class="extension-task-strip" aria-live="polite">
      <div class="task-strip-heading">
        <font-awesome-icon icon="fa-solid fa-clock-rotate-left" />
        <span>{{ labels.tasks }}</span>
      </div>
      <div v-for="task in activeTasks" :key="task.id" class="task-row">
        <span class="task-row-name">{{ task.extensionId || task.id }}</span>
        <span class="task-row-stage">{{ task.stage || task.status || labels.pending }}</span>
        <span v-if="typeof task.progress === 'number'" class="task-row-progress">{{ Math.round(task.progress) }}%</span>
      </div>
    </section>

    <div v-if="extensionStore.loading && !installedCards.length" class="store-state">
      <span class="store-loading-spinner" aria-hidden="true" />
      <span>{{ labels.loading }}</span>
    </div>

    <div v-else-if="!launcherCards.length" class="store-state store-state-empty">
      <div class="store-empty-icon" aria-hidden="true">
        <font-awesome-icon :icon="listSearchStore.hasQuery ? 'fa-solid fa-magnifying-glass' : 'fa-solid fa-puzzle-piece'" />
      </div>
      <h3>{{ listSearchStore.hasQuery ? labels.empty : labels.noInstalled }}</h3>
      <p>{{ listSearchStore.hasQuery ? labels.emptyDescription : labels.noInstalledDescription }}</p>
    </div>

    <Draggable
      v-else
      v-model="launcherCards"
      item-key="id"
      tag="section"
      class="extension-app-grid"
      :class="{ managing: appManagementMode, dragging: appDragging }"
      :disabled="!appManagementMode"
      ghost-class="extension-app-ghost"
      chosen-class="extension-app-chosen"
      drag-class="extension-app-drag"
      :animation="180"
      :force-fallback="true"
      :fallback-on-body="true"
      :fallback-tolerance="4"
      :delay="0"
      :touch-start-threshold="4"
      @start="appDragging = true"
      @end="appDragging = false"
    >
      <template #item="{ element: card }">
        <article class="extension-app-item">
          <div class="extension-app-icon-shell">
            <button
              type="button"
              class="extension-app-launcher"
              :class="{ unavailable: !canOpenExtension(card) }"
              :aria-label="`${appManagementMode ? labels.details : labels.open} ${card.manifest?.name || card.name}`"
              @click="openMobileExtension(card)"
              @pointerdown="startAppLongPress(card)"
              @pointerup="cancelAppLongPress"
              @pointercancel="cancelAppLongPress"
              @pointerleave="cancelAppLongPress"
              @contextmenu.prevent="enterAppManagement(card)"
            >
              <span class="extension-app-icon" :class="{ image: isImageIcon(card.manifest?.icon) }">
                <img v-if="isImageIcon(card.manifest?.icon)" :src="card.manifest?.icon as string" alt="" />
                <font-awesome-icon v-else :icon="card.manifest?.icon || 'fa-solid fa-puzzle-piece'" />
              </span>
              <span
                class="extension-app-status"
                :class="statusTone(card.availability.status)"
                :title="statusLabel(card.availability.status, card.availability.source, card.manifest?.kind)"
              />
            </button>

            <div v-if="appManagementMode" class="extension-app-controls">
              <button
                v-if="canUninstall(card)"
                type="button"
                class="extension-app-remove"
                :disabled="uninstallDisabled(card)"
                :aria-label="`${labels.uninstall} ${card.manifest?.name || card.name}`"
                :title="uninstallDisabled(card) ? managementHint(card) : labels.uninstall"
                @click="confirmUninstall(card)"
              >
                <span aria-hidden="true">−</span>
              </button>
              <button
                type="button"
                class="extension-app-details"
                :aria-label="`${labels.details} ${card.manifest?.name || card.name}`"
                :title="labels.details"
                @click="openDetails(card.id)"
              >
                <font-awesome-icon icon="fa-solid fa-circle-info" />
              </button>
            </div>
          </div>
          <span class="extension-app-title" :title="card.manifest?.name || card.name">
            {{ card.manifest?.name || card.name }}
          </span>
        </article>
      </template>
    </Draggable>

    <nut-popup
      v-model:visible="addVisible"
      :position="isMobileViewport ? 'bottom' : 'center'"
      pop-class="extension-add-popup"
      :style="{ width: isMobileViewport ? '100%' : 'min(560px, calc(100% - 48px))', maxHeight: isMobileViewport ? 'calc(100vh - 28px)' : 'min(720px, calc(100vh - 48px))' }"
      :close-on-click-overlay="true"
      :lock-scroll="true"
      z-index="12000"
    >
      <div class="extension-add-panel">
        <div class="source-panel-header">
          <h2>{{ labels.addExtension }}</h2>
          <button type="button" class="detail-close" :aria-label="labels.close" @click="addVisible = false">
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </button>
        </div>

        <div class="extension-add-scroll">
          <div class="extension-add-shortcuts">
            <button
              v-if="extensionStore.supportsLocalPackageInstall"
              type="button"
              class="extension-add-shortcut"
              :disabled="localInspecting || localInstalling"
              @click="openLocalDirectoryFromAdd"
            >
              <font-awesome-icon icon="fa-solid fa-folder-open" />
              <span>{{ labels.localInstall }}</span>
            </button>
            <button type="button" class="extension-add-shortcut" @click="openSourcesFromAdd">
              <font-awesome-icon icon="fa-solid fa-link" />
              <span>{{ labels.sourceSubscription }}</span>
            </button>
          </div>

          <section v-if="availableCards.length" class="extension-add-available">
            <h3>{{ labels.availableExtensions }}</h3>
            <button
              v-for="card in availableCards"
              :key="card.id"
              type="button"
              class="extension-add-item"
              @click="openAvailableExtension(card)"
            >
              <span class="extension-add-item-icon" :class="{ image: isImageIcon(card.manifest?.icon) }">
                <img v-if="isImageIcon(card.manifest?.icon)" :src="card.manifest?.icon as string" alt="" />
                <font-awesome-icon v-else :icon="card.manifest?.icon || 'fa-solid fa-puzzle-piece'" />
              </span>
              <span class="extension-add-item-copy">
                <strong>{{ card.manifest?.name || card.name }}</strong>
                <small class="extension-add-item-description">{{ card.manifest?.description || card.description || labels.noDescription }}</small>
                <span class="extension-add-item-meta">
                  <span><font-awesome-icon icon="fa-solid fa-user" /> {{ labels.author }}：{{ extensionPublisherLabel(card) }}</span>
                  <span :title="extensionSourceLabel(card)"><font-awesome-icon icon="fa-solid fa-link" /> {{ labels.source }}：{{ extensionSourceLabel(card) }}</span>
                </span>
              </span>
              <span class="extension-add-item-action">{{ card.availability.status === 'reinstall-required' ? labels.reinstall : labels.install }}</span>
            </button>
          </section>
        </div>
      </div>
    </nut-popup>

    <nut-popup
      v-model:visible="detailVisible"
      :position="isMobileViewport ? 'bottom' : 'center'"
      pop-class="extension-detail-popup"
      :style="{ width: isMobileViewport ? '100%' : 'min(620px, calc(100% - 48px))', maxHeight: isMobileViewport ? 'calc(100vh - 28px)' : 'min(800px, calc(100vh - 48px))' }"
      :close-on-click-overlay="true"
      :lock-scroll="true"
      z-index="12000"
    >
      <div v-if="selectedCard" class="extension-detail">
        <div class="detail-header">
          <div class="detail-icon" :class="{ image: isImageIcon(selectedCard.manifest?.icon) }">
            <img v-if="isImageIcon(selectedCard.manifest?.icon)" :src="selectedCard.manifest?.icon as string" alt="" />
            <font-awesome-icon v-else :icon="selectedCard.manifest?.icon || 'fa-solid fa-puzzle-piece'" />
          </div>
          <div class="detail-heading">
            <div class="detail-title-row">
              <h2>{{ selectedCard.manifest?.name || selectedCard.name }}</h2>
              <span class="status-pill" :class="statusTone(selectedCard.availability.status)">
                {{ statusLabel(selectedCard.availability.status, selectedCard.availability.source, selectedCard.manifest?.kind) }}
              </span>
            </div>
            <p>{{ versionSummary(selectedCard) }} · {{ publisherName(selectedCard.manifest) }}</p>
          </div>
          <button type="button" class="detail-close" :aria-label="labels.close" @click="detailVisible = false">
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </button>
        </div>

        <div class="detail-scroll">
          <p class="detail-description">{{ selectedCard.manifest?.description || selectedCard.description || labels.noDescription }}</p>

          <div class="detail-section detail-provenance-section">
            <h3>{{ labels.provenance }}</h3>
            <dl class="detail-facts">
              <div><dt>{{ labels.author }}</dt><dd>{{ extensionPublisherLabel(selectedCard) }}</dd></div>
              <div><dt>{{ labels.source }}</dt><dd :title="extensionSourceLabel(selectedCard)">{{ extensionSourceLabel(selectedCard) }}</dd></div>
            </dl>
          </div>

          <div v-if="selectedCard.manifest?.capabilities?.length" class="detail-section">
            <h3>{{ labels.capabilities }}</h3>
            <div class="detail-chips">
              <span v-for="capability in capabilityLabels(selectedCard.manifest)" :key="capability" class="capability-chip">
                {{ capability }}
              </span>
            </div>
          </div>

          <div v-if="permissionLabels(selectedCard.manifest).length" class="detail-section">
            <h3>{{ labels.permissions }}</h3>
            <div class="detail-chips">
              <span v-for="permission in permissionLabels(selectedCard.manifest)" :key="permission" class="capability-chip">
                {{ permission }}
              </span>
            </div>
          </div>

          <div class="detail-section detail-status-section">
            <h3>{{ labels.runtimeStatus }}</h3>
            <dl class="detail-facts">
              <div><dt>{{ labels.status }}</dt><dd>{{ statusLabel(selectedCard.availability.status, selectedCard.availability.source, selectedCard.manifest?.kind) }}</dd></div>
              <div v-if="installedVersion(selectedCard)"><dt>{{ labels.installedVersion }}</dt><dd>v{{ installedVersion(selectedCard) }}</dd></div>
              <div v-if="availableVersion(selectedCard) && availableVersion(selectedCard) !== installedVersion(selectedCard)"><dt>{{ labels.availableVersion }}</dt><dd>v{{ availableVersion(selectedCard) }}</dd></div>
              <div><dt>{{ labels.runtime }}</dt><dd>{{ runtimeLabel(selectedCard) }}</dd></div>
              <div v-if="selectedCard.availability.receipt?.selectedVariant"><dt>{{ labels.variant }}</dt><dd>{{ selectedCard.availability.receipt.selectedVariant }}</dd></div>
              <div v-if="selectedCard.availability.receipt?.codeStatus"><dt>{{ labels.codeStatus }}</dt><dd>{{ selectedCard.availability.receipt.codeStatus }}</dd></div>
              <div v-if="selectedCard.availability.backendRevision !== undefined"><dt>{{ labels.revision }}</dt><dd>{{ selectedCard.availability.backendRevision }}</dd></div>
              <div v-if="extensionStore.runtime?.dataGeneration !== undefined"><dt>{{ labels.generation }}</dt><dd>{{ extensionStore.runtime.dataGeneration }}</dd></div>
              <div v-if="selectedCard.availability.receipt?.manifestDigest"><dt>{{ labels.manifestDigest }}</dt><dd :title="selectedCard.availability.receipt.manifestDigest">{{ shortDigest(selectedCard.availability.receipt.manifestDigest) }}</dd></div>
              <div v-if="selectedCard.availability.receipt?.packageDigest"><dt>{{ labels.packageDigest }}</dt><dd :title="selectedCard.availability.receipt.packageDigest">{{ shortDigest(selectedCard.availability.receipt.packageDigest) }}</dd></div>
              <div v-if="selectedCard.availability.retainedReason"><dt>{{ labels.data }}</dt><dd>{{ retainedReasonLabel(selectedCard.availability.retainedReason) }}</dd></div>
            </dl>
          </div>

          <details
            v-if="remoteReleases(selectedCard).length"
            class="detail-section detail-version-section"
            :open="versionHistoryOpen"
            @toggle="syncVersionHistoryOpen"
          >
            <summary class="version-history-summary">
              <span>{{ labels.remoteVersions }}</span>
              <span class="version-history-count">{{ remoteReleases(selectedCard).length }}</span>
              <font-awesome-icon class="version-history-chevron" icon="fa-solid fa-chevron-right" />
            </summary>
            <div class="release-list">
              <article
                v-for="release in remoteReleases(selectedCard)"
                :key="release.version"
                class="release-item"
              >
                <div class="release-copy">
                  <div class="release-title-row">
                    <strong>v{{ release.version }}</strong>
                    <span v-if="release.version === installedVersion(selectedCard)" class="release-badge current">
                      {{ labels.currentVersion }}
                    </span>
                    <span v-if="isLatestRelease(selectedCard, release)" class="release-badge latest">
                      {{ labels.latestVersion }}
                    </span>
                    <span v-if="release.yanked" class="release-badge yanked">
                      {{ labels.yankedVersion }}
                    </span>
                  </div>
                  <span v-if="formatReleaseDate(release.releasedAt)" class="release-meta">
                    {{ labels.releaseDate }} {{ formatReleaseDate(release.releasedAt) }}
                  </span>
                  <span v-if="release.gitTag || release.gitCommit" class="release-meta" :title="releaseRevisionTitle(release)">
                    {{ labels.gitRevision }} · {{ releaseRevisionLabel(release) }}
                  </span>
                </div>
                <button
                  type="button"
                  class="details-button release-action"
                  :disabled="releaseActionDisabled(selectedCard, release)"
                  :title="sourceIsMissing(selectedCard) ? labels.sourceUnavailable : ''"
                  @click="confirmVersionSwitch(selectedCard, release)"
                >
                  {{ visibleReleaseActionLabel(selectedCard, release) }}
                </button>
              </article>
            </div>
          </details>

          <div v-if="canRollback(selectedCard)" class="detail-section detail-local-rollback-section">
            <h3>{{ labels.localRollback }}</h3>
            <div class="local-rollback-summary">
              <span>
                {{ rollbackVersions(selectedCard).length
                  ? rollbackVersions(selectedCard).map(version => `v${version}`).join('、')
                  : labels.previousVerifiedVersion }}
              </span>
              <button
                type="button"
                class="details-button"
                :disabled="isActionLoading(selectedCard.id) || !extensionStore.canManage"
                @click="performVersionAction(selectedCard, 'rollback')"
              >
                {{ labels.rollback }}
              </button>
            </div>
          </div>

          <div v-if="sourceIsMissing(selectedCard)" class="detail-source-warning" role="status">
            <font-awesome-icon icon="fa-solid fa-triangle-exclamation" />
            <div>
              <strong>{{ labels.sourceRemoved }}</strong>
              <span>{{ labels.sourceRemovedDescription }}</span>
            </div>
          </div>

          <div v-if="requiresAdminToken(selectedCard)" class="detail-token-section">
            <h3>{{ labels.adminToken }}</h3>
            <p>{{ labels.adminTokenDescription }}</p>
            <div class="token-row">
              <input v-model="adminTokenInput" type="password" autocomplete="off" :placeholder="labels.adminTokenPlaceholder" />
              <button
                v-if="extensionStore.adminToken"
                type="button"
                class="details-button"
                @click="clearAdminToken"
              >
                {{ labels.clearToken }}
              </button>
              <button type="button" class="details-button" @click="saveAdminToken">{{ labels.save }}</button>
            </div>
          </div>

          <div v-if="canUninstall(selectedCard) && !extensionStore.canManage" class="detail-action-hint" role="status">
            <font-awesome-icon icon="fa-solid fa-circle-info" />
            <span>{{ managementHint(selectedCard) }}</span>
          </div>

          <div v-if="extensionStore.lastActionError" class="detail-error" role="alert">
            <font-awesome-icon icon="fa-solid fa-triangle-exclamation" />
            <span>{{ extensionStore.lastActionError }}</span>
          </div>
        </div>

        <div class="detail-actions">
          <button
            v-if="canUninstall(selectedCard)"
            type="button"
            class="details-button detail-uninstall-button"
            :disabled="uninstallDisabled(selectedCard)"
            :title="uninstallDisabled(selectedCard) ? managementHint(selectedCard) : labels.uninstall"
            @click="confirmUninstall(selectedCard)"
          >
            {{ labels.uninstall }}
          </button>
          <button
            v-if="canUpdate(selectedCard)"
            type="button"
            class="details-button version-update-button"
            :disabled="isActionLoading(selectedCard.id) || !extensionStore.canManage"
            @click="performVersionAction(selectedCard, 'update')"
          >
            {{ labels.update }}
          </button>
          <button type="button" class="details-button" @click="detailVisible = false">{{ labels.close }}</button>
          <button
            v-if="canOpenExtension(selectedCard) && canDisable(selectedCard.id)"
            type="button"
            class="details-button"
            @click="openExtension(selectedCard)"
          >
            {{ labels.open }}
          </button>
          <button
            v-if="hasPrimaryAction(selectedCard)"
            type="button"
            class="primary-action"
            :class="{ danger: canDisable(selectedCard.id) }"
            :disabled="isActionLoading(selectedCard.id) || isActionDisabled(selectedCard)"
            @click="performPrimaryAction(selectedCard)"
          >
            <span v-if="isActionLoading(selectedCard.id)" class="button-spinner" />
            <template v-else>{{ primaryActionLabel(selectedCard) }}</template>
          </button>
        </div>
      </div>
    </nut-popup>

    <nut-popup
      v-model:visible="sourcesVisible"
      :position="isMobileViewport ? 'bottom' : 'center'"
      pop-class="extension-sources-popup"
      :style="{ width: isMobileViewport ? '100%' : 'min(640px, calc(100% - 48px))', maxHeight: isMobileViewport ? 'calc(100vh - 28px)' : 'min(760px, calc(100vh - 48px))' }"
      :close-on-click-overlay="true"
      :lock-scroll="true"
      z-index="12000"
    >
      <div class="source-panel">
        <div class="source-panel-header">
          <div>
            <h2>{{ labels.sources }}</h2>
            <p>{{ labels.sourcesDescription }}</p>
          </div>
          <button type="button" class="detail-close" :aria-label="labels.close" @click="sourcesVisible = false">
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </button>
        </div>

        <div v-if="extensionStore.managementMode === 'token' && !extensionStore.canManage" class="source-auth-panel">
          <div class="source-auth-copy">
            <font-awesome-icon icon="fa-solid fa-shield-halved" />
            <div>
              <strong>{{ labels.adminToken }}</strong>
              <span>{{ labels.sourceAdminTokenDescription }}</span>
            </div>
          </div>
          <div class="token-row">
            <input v-model="adminTokenInput" type="password" autocomplete="off" :placeholder="labels.adminTokenPlaceholder" />
            <button type="button" class="details-button" @click="saveAdminToken">{{ labels.save }}</button>
          </div>
        </div>

        <form class="source-form" @submit.prevent="addSource">
          <label class="source-field">
            <span>{{ labels.sourceUrl }}</span>
            <input v-model.trim="sourceUrlInput" type="url" :placeholder="labels.sourceUrlPlaceholder" autocomplete="url" />
          </label>
          <label class="source-field">
            <span>{{ labels.sourceName }} <em>{{ labels.optional }}</em></span>
            <input v-model.trim="sourceNameInput" type="text" :placeholder="labels.sourceNamePlaceholder" maxlength="120" />
          </label>
          <p v-if="sourceUrlInput && !isValidSourceUrl" class="source-field-error" role="alert">{{ labels.sourceUrlInvalid }}</p>
          <div class="source-form-actions">
            <button type="submit" class="primary-action" :disabled="sourceSubmitting || !isValidSourceUrl || !extensionStore.canManage">
              <span v-if="sourceSubmitting" class="button-spinner" />
              <template v-else>{{ labels.addSource }}</template>
            </button>
            <button type="button" class="details-button" :disabled="extensionStore.sourcesLoading" @click="refreshSources">
              <span v-if="extensionStore.sourcesLoading" class="button-spinner" />
              <template v-else>{{ labels.refreshSources }}</template>
            </button>
          </div>
          <p v-if="!extensionStore.canManage && extensionStore.managementMode !== 'token'" class="source-management-hint">{{ managementHint() }}</p>
        </form>

        <div v-if="extensionStore.sourcesError || extensionStore.sourceActionError" class="source-error" role="alert">
          <font-awesome-icon icon="fa-solid fa-triangle-exclamation" />
          <span>{{ extensionStore.sourceActionError || extensionStore.sourcesError }}</span>
        </div>

        <div class="source-list" aria-live="polite">
          <div v-if="!extensionStore.sources.length && !extensionStore.sourcesLoading" class="source-empty">
            <font-awesome-icon icon="fa-solid fa-link" />
            <span>{{ labels.sourcesEmpty }}</span>
          </div>
          <article v-for="source in extensionStore.sources" :key="source.id" class="source-item">
            <div class="source-item-icon"><font-awesome-icon icon="fa-solid fa-link" /></div>
            <div class="source-item-copy">
              <div class="source-item-title-row">
                <h3>{{ source.name || source.url }}</h3>
                <span class="status-pill" :class="sourceStatusTone(source)">{{ sourceStatusLabel(source) }}</span>
              </div>
              <p :title="source.url">{{ source.url }}</p>
              <div class="source-item-meta">
                <small><font-awesome-icon icon="fa-solid fa-user" /> {{ labels.author }}：{{ sourcePublisherName(source) }}</small>
                <small v-if="source.extensionCount !== undefined">{{ source.extensionCount }} {{ labels.extensionsCount }}</small>
              </div>
              <small v-if="source.error" class="source-item-error">{{ source.error }}</small>
            </div>
            <div class="source-item-actions">
              <button type="button" class="details-button" :disabled="sourceLoadingId === source.id || !extensionStore.canManage" :aria-label="labels.refreshSource" :title="labels.refreshSource" @click="refreshOneSource(source.id)">
                <span v-if="sourceLoadingId === source.id" class="button-spinner" />
                <font-awesome-icon v-else icon="fa-solid fa-arrow-rotate-right" />
              </button>
              <button type="button" class="details-button source-delete-button" :disabled="sourceLoadingId === source.id || !extensionStore.canManage" :aria-label="labels.removeSource" :title="labels.removeSource" @click="removeOneSource(source.id)">
                <font-awesome-icon icon="fa-solid fa-trash-can" />
              </button>
            </div>
          </article>
        </div>
      </div>
    </nut-popup>

    <nut-popup
      v-model:visible="localInstallVisible"
      :position="isMobileViewport ? 'bottom' : 'center'"
      pop-class="extension-local-popup"
      :style="{ width: isMobileViewport ? '100%' : 'min(620px, calc(100% - 48px))', maxHeight: isMobileViewport ? 'calc(100vh - 28px)' : 'min(780px, calc(100vh - 48px))' }"
      :close-on-click-overlay="!localInstalling"
      :lock-scroll="true"
      z-index="12000"
    >
      <div v-if="localInspection && localProjection" class="extension-detail local-install-detail">
        <div class="detail-header">
          <div class="detail-icon" :class="{ image: isImageIcon(localInspection.manifest.icon) }">
            <img v-if="isImageIcon(localInspection.manifest.icon)" :src="localInspection.manifest.icon" alt="" />
            <font-awesome-icon v-else :icon="localInspection.manifest.icon || 'fa-solid fa-puzzle-piece'" />
          </div>
          <div class="detail-heading">
            <div class="detail-title-row">
              <h2>{{ localInspection.manifest.name }}</h2>
              <span class="status-pill success">{{ labels.localChecked }}</span>
            </div>
            <p>v{{ localInspection.manifest.version }} · {{ publisherName(localInspection.manifest) }}</p>
          </div>
          <button
            type="button"
            class="detail-close"
            :aria-label="labels.close"
            :disabled="localInstalling"
            @click="closeLocalInstall"
          >
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </button>
        </div>

        <div class="detail-scroll">
          <p class="detail-description">{{ labels.localInstallDescription }}</p>

          <div class="detail-section detail-status-section">
            <h3>{{ labels.localPackage }}</h3>
            <dl class="detail-facts">
              <div><dt>ID</dt><dd :title="localInspection.extensionId">{{ localInspection.extensionId }}</dd></div>
              <div><dt>{{ labels.localFolder }}</dt><dd :title="localProjection.rootName">{{ localProjection.rootName }}</dd></div>
              <div><dt>{{ labels.localVersion }}</dt><dd>{{ localInspection.manifest.version }}</dd></div>
              <div><dt>{{ labels.localPublisher }}</dt><dd>{{ publisherName(localInspection.manifest) }}</dd></div>
              <div><dt>{{ labels.localFiles }}</dt><dd>{{ localFileCount }}</dd></div>
              <div><dt>{{ labels.localSize }}</dt><dd>{{ formatBytes(localTotalBytes) }}</dd></div>
              <div v-if="localSelectedVariant"><dt>{{ labels.variant }}</dt><dd>{{ localSelectedVariant }}</dd></div>
              <div v-if="localPackageDigest"><dt>{{ labels.packageDigest }}</dt><dd :title="localPackageDigest">{{ shortDigest(localPackageDigest) }}</dd></div>
            </dl>
          </div>

          <div v-if="localWarnings.length" class="local-inspection-list warning" role="status">
            <h3><font-awesome-icon icon="fa-solid fa-triangle-exclamation" /> {{ labels.localWarnings }}</h3>
            <ul>
              <li v-for="(warning, index) in localWarnings" :key="`warning-${index}`">{{ warning }}</li>
            </ul>
          </div>

          <div v-if="localDiagnostics.length" class="local-inspection-list" role="status">
            <h3><font-awesome-icon icon="fa-solid fa-circle-info" /> {{ labels.localDiagnostics }}</h3>
            <ul>
              <li v-for="(diagnostic, index) in localDiagnostics" :key="`diagnostic-${index}`">{{ diagnostic }}</li>
            </ul>
          </div>

          <div v-if="localInstallError" class="detail-error" role="alert">
            <font-awesome-icon icon="fa-solid fa-triangle-exclamation" />
            <span>{{ localInstallError }}</span>
          </div>
        </div>

        <div class="detail-actions">
          <button type="button" class="details-button" :disabled="localInstalling" @click="closeLocalInstall">
            {{ labels.close }}
          </button>
          <button type="button" class="primary-action" :disabled="localInstalling || !extensionStore.canManage" @click="installLocalPackage">
            <span v-if="localInstalling" class="button-spinner" />
            <template v-else>{{ labels.localConfirm }}</template>
          </button>
        </div>
      </div>
    </nut-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useExtensionsStore } from '@/store/extensions';
import type {
  ExtensionAvailability,
  ExtensionCatalogEntry,
  ExtensionCatalogRelease,
  ExtensionLocalPackageInspection,
  ExtensionManifest,
  ExtensionSource,
  ExtensionStatus,
} from '@/extensions/contracts';
import {
  buildExtensionDirectoryProjection,
  type ExtensionDirectoryProjection,
} from '@/extensions/localDirectory';
import { resolveExtensionOpenPath } from '@/extensions/frontend-catalog';
import { useAppNotifyStore } from '@/store/appNotify';
import { useListSearchStore } from '@/store/listSearch';
import { useMethodStore } from '@/store/methodStore';
import { EXTENSION_STORE_COMMANDS } from '@/extensions/registry';
import { Dialog } from '@nutui/nutui';
import Draggable from 'vuedraggable';

type ExtensionCard = ExtensionCatalogEntry & {
  id: string;
  availability: ExtensionAvailability;
  manifest?: ExtensionManifest;
  source?: string;
  sourceName?: string;
};

type ReleaseActionKind = 'install' | 'upgrade' | 'downgrade' | 'reinstall' | 'current';

const EXTENSION_LAUNCHER_ORDER_KEY = 'sub-store-extension-launcher-order';
const INSTALLED_EXTENSION_STATUSES = new Set<ExtensionStatus>([
  'bundled',
  'installed',
  'enabled',
  'disabled',
  'installing',
  'updating',
  'rolling-back',
  'restoring',
  'frontend-load-failed',
  'activation-failed',
]);

const router = useRouter();
const route = useRoute();
const { locale } = useI18n();
const extensionStore = useExtensionsStore();
const listSearchStore = useListSearchStore();
const methodStore = useMethodStore();
const { catalog } = storeToRefs(extensionStore);
const { showNotify } = useAppNotifyStore();

const addVisible = ref(false);
const detailVisible = ref(false);
const versionHistoryOpen = ref(false);
const sourcesVisible = ref(false);
const localInstallVisible = ref(false);
const localDirectoryInput = ref<HTMLInputElement | null>(null);
const localProjection = ref<ExtensionDirectoryProjection | null>(null);
const localInspection = ref<ExtensionLocalPackageInspection | null>(null);
const localInspecting = ref(false);
const localInstalling = ref(false);
const localInstallError = ref('');
const selectedId = ref('');
const actionLoadingId = ref('');
const sourceLoadingId = ref('');
const sourceSubmitting = ref(false);
const sourceUrlInput = ref('');
const sourceNameInput = ref('');
const adminTokenInput = ref('');
const isMobileViewport = ref(typeof window !== 'undefined' && window.innerWidth < 600);
const appDragging = ref(false);
const appManagementMode = computed({
  get: () => extensionStore.launcherManagementMode,
  set: value => extensionStore.setLauncherManagementMode(value),
});
const appPressTimer = ref<number | null>(null);
const appLongPressResetTimer = ref<number | null>(null);
const appLongPressTriggered = ref(false);

const readLauncherOrder = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(EXTENSION_LAUNCHER_ORDER_KEY) || '[]');
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && Boolean(item))
      : [];
  } catch {
    return [];
  }
};

const launcherOrder = ref<string[]>(readLauncherOrder());

const isZh = computed(() => String(locale.value || '').toLowerCase().startsWith('zh'));
const labelsBase = computed(() => isZh.value ? {
  title: '扩展', subtitle: '按需安装和管理 Sub-Store 功能', refresh: '刷新扩展列表', search: '搜索扩展', clear: '清除搜索', discover: '发现', installed: '已安装', loading: '正在读取扩展状态…', empty: '没有匹配的扩展', emptyDescription: '可以清除搜索条件，或稍后重试。', compatibility: '当前后端尚未提供扩展清单，已保留兼容模式。', discoveryFailed: '暂时无法读取扩展运行状态。已保持最后一次可信状态，未将插件自动恢复为兼容模式。', retry: '重新读取', details: '详情', noDescription: '暂无描述', capabilities: '能力', permissions: '权限', runtimeStatus: '运行状态', status: '状态', runtime: '运行实现', variant: '运行变体', codeStatus: '代码状态', revision: '后端版本', generation: '数据代次', manifestDigest: '清单摘要', packageDigest: '包摘要', data: '数据', close: '关闭', save: '保存', adminToken: '管理凭据', adminTokenDescription: '安装、启用、停用和卸载需要管理员控制面令牌。令牌只保存在当前页面内存中。', adminTokenPlaceholder: '输入管理令牌', adminRequiredAction: '填写管理凭据', install: '安装', enable: '启用', disable: '停用', open: '打开', reinstall: '重新安装', uninstall: '卸载', uninstallTitle: '卸载扩展？', uninstallDescription: '扩展代码和安装记录会被移除，配置数据默认保留，可在之后重新安装恢复。', unavailable: '需要后端支持', legacy: '兼容模式', bundled: '内置', embedded: '内置运行实现', nodePackage: 'Node 已验证安装包', contentPackage: '已校验内容包', managed: '已安装', pending: '处理中', incompatible: '不兼容', missing: '未安装', retainedUser: '数据已保留', retainedBackup: '数据已恢复，需重新安装', installSuccess: '扩展安装任务已提交', actionSuccess: '扩展状态已更新', actionFailed: '扩展操作失败', controlReadOnly: '当前后端为只读模式', clearToken: '清除凭据', tasks: '安装任务', sources: '来源', sourcesDescription: '添加可信的第三方扩展目录；支持 GitHub 文件、Raw/Release 链接和 HTTPS JSON 地址。', sourceUrl: '来源 URL', sourceUrlPlaceholder: 'https://github.com/… 或 https://example.com/catalog.json', sourceName: '来源名称', sourceNamePlaceholder: '例如：我的扩展仓库', optional: '可选', sourceUrlInvalid: '外部来源必须使用 HTTPS；HTTP 仅支持本机地址。', sourceHelp: 'Sub-Store 会校验目录、包摘要和文件完整性，防止下载内容漂移；Node 可执行扩展会在后端进程中运行，请只添加你信任的来源。', sourceAdminTokenDescription: '添加、刷新或删除来源前，请输入管理令牌。', sourceRemoved: '扩展来源已移除', sourceRemovedDescription: '已安装内容仍可查看和卸载；如需重新安装，请先重新添加原来源。', sourceUnavailable: '来源已移除', addSource: '添加来源', refreshSources: '重新读取', refreshSource: '刷新来源', removeSource: '删除来源', sourcesEmpty: '还没有第三方来源', extensionsCount: '个扩展', sourceStatusActive: '正常', sourceStatusRefreshing: '刷新中', sourceStatusFailed: '异常', sourceStatusDisabled: '已停用', sourceStatusUnknown: '未知', managementNoToken: '当前后端需要管理令牌。请先在此处填写管理凭据。', managementReadOnly: '当前后端处于只读模式，暂时不能执行管理操作。', localInstall: '本地安装', localInstallDescription: '选择由扩展发布工具生成、同时包含 manifest.json、receipt.json 和 package.json 的完整扩展包文件夹。', localChecking: '正在检查…', localChecked: '检查通过', localConfirm: '确认安装', localPackage: '扩展包', localFolder: '文件夹', localFiles: '文件数', localSize: '文件大小', localVersion: '版本', localPublisher: '发布者', localWarnings: '检查警告', localDiagnostics: '检查信息', localInvalid: '无法读取该扩展文件夹', localAdminRequired: '本地安装需要管理凭据，请先填写管理令牌。',
} : {
  title: 'Extensions', subtitle: 'Install and manage Sub-Store features', refresh: 'Refresh extensions', search: 'Search extensions', clear: 'Clear search', discover: 'Discover', installed: 'Installed', loading: 'Loading extension status…', empty: 'No matching extensions', emptyDescription: 'Clear the search or try again later.', compatibility: 'This backend does not expose the extension manifest yet; compatibility mode is active.', discoveryFailed: 'Extension runtime status is temporarily unavailable. The last trusted state is retained and compatibility mode was not reopened.', retry: 'Retry', details: 'Details', noDescription: 'No description', capabilities: 'Capabilities', permissions: 'Permissions', runtimeStatus: 'Runtime status', status: 'Status', runtime: 'Implementation', variant: 'Variant', codeStatus: 'Code status', revision: 'Backend revision', generation: 'Data generation', manifestDigest: 'Manifest digest', packageDigest: 'Package digest', data: 'Data', close: 'Close', save: 'Save', adminToken: 'Admin credential', adminTokenDescription: 'Install, enable, disable, and uninstall actions require an administrator token. It remains in this page memory only.', adminTokenPlaceholder: 'Enter admin token', adminRequiredAction: 'Enter credential', install: 'Install', enable: 'Enable', disable: 'Disable', open: 'Open', reinstall: 'Reinstall', uninstall: 'Uninstall', uninstallTitle: 'Uninstall extension?', uninstallDescription: 'Extension code and its receipt will be removed. Data remains available for a later reinstall by default.', unavailable: 'Backend support required', legacy: 'Compatibility mode', bundled: 'Bundled', embedded: 'Embedded implementation', nodePackage: 'Verified Node package', contentPackage: 'Verified content package', managed: 'Installed', pending: 'Working', incompatible: 'Incompatible', missing: 'Not installed', retainedUser: 'Data retained', retainedBackup: 'Data restored; reinstall required', installSuccess: 'Extension install task submitted', actionSuccess: 'Extension state updated', actionFailed: 'Extension action failed', controlReadOnly: 'This backend is read-only', clearToken: 'Clear credential', tasks: 'Install tasks', sources: 'Sources', sourcesDescription: 'Add trusted third-party extension catalogs. GitHub files, Raw/Release links, and HTTPS JSON URLs are supported.', sourceUrl: 'Source URL', sourceUrlPlaceholder: 'https://github.com/… or https://example.com/catalog.json', sourceName: 'Source name', sourceNamePlaceholder: 'For example: My extension catalog', optional: 'optional', sourceUrlInvalid: 'External sources must use HTTPS; HTTP is limited to loopback hosts.', sourceHelp: 'Sub-Store verifies the catalog, package digest, and every file so downloaded content cannot drift unnoticed. Executable Node extensions run inside the backend process, so add only sources you trust.', sourceAdminTokenDescription: 'Enter the admin token before adding, refreshing, or removing a source.', sourceRemoved: 'Extension source removed', sourceRemovedDescription: 'Installed content remains inspectable and uninstallable. Add the original source again before reinstalling.', sourceUnavailable: 'Source removed', addSource: 'Add source', refreshSources: 'Reload list', refreshSource: 'Refresh source', removeSource: 'Remove source', sourcesEmpty: 'No third-party sources yet', extensionsCount: 'extensions', sourceStatusActive: 'Ready', sourceStatusRefreshing: 'Refreshing', sourceStatusFailed: 'Failed', sourceStatusDisabled: 'Disabled', sourceStatusUnknown: 'Unknown', managementNoToken: 'This backend requires an admin token. Enter the management credential above first.', managementReadOnly: 'This backend is read-only, so management actions are unavailable.', localInstall: 'Local install', localInstallDescription: 'Choose a complete package folder generated by the extension release tooling. It must contain manifest.json, receipt.json, and package.json.', localChecking: 'Checking…', localChecked: 'Checked', localConfirm: 'Confirm install', localPackage: 'Extension package', localFolder: 'Folder', localFiles: 'Files', localSize: 'Package size', localVersion: 'Version', localPublisher: 'Publisher', localWarnings: 'Inspection warnings', localDiagnostics: 'Inspection details', localInvalid: 'Unable to read this extension folder', localAdminRequired: 'Local installation requires an admin credential. Enter the management token first.',
});

const labels = computed(() => ({
  ...labelsBase.value,
  manage: isZh.value ? '管理' : 'Manage',
  done: isZh.value ? '完成' : 'Done',
  adminToken: isZh.value ? '管理令牌' : 'Admin token',
  adminTokenDescription: isZh.value
    ? '这是 Sub-Store 后端的管理令牌，不是插件密码。它用于阻止其他网页或局域网设备擅自安装、停用和删除扩展；只保存在当前页面内存中，刷新后会清除。'
    : 'This is the Sub-Store backend management token, not a plugin password. It prevents other websites or LAN devices from installing, disabling, or deleting extensions. It stays in page memory and is cleared on refresh.',
  adminRequiredAction: isZh.value ? '填写管理令牌' : 'Enter admin token',
  clearToken: isZh.value ? '清除令牌' : 'Clear token',
  sourceAdminTokenDescription: isZh.value
    ? '添加、刷新或删除扩展来源属于后端管理操作，需要使用同一个管理令牌。'
    : 'Adding, refreshing, or removing extension sources is a backend management action and uses the same admin token.',
  managementNoToken: isZh.value
    ? '当前后端需要管理令牌。请先在详情中填写同一个后端管理令牌。'
    : 'This backend requires its admin token. Enter the same backend management token in Details first.',
  localAdminRequired: isZh.value
    ? '本地安装属于后端管理操作，请先填写管理令牌。'
    : 'Local installation is a backend management action. Enter the admin token first.',
  addExtension: isZh.value ? '添加扩展' : 'Add extensions',
  sourceSubscription: isZh.value ? '订阅源' : 'Sources',
  availableExtensions: isZh.value ? '可安装的扩展' : 'Available extensions',
  noInstalled: isZh.value ? '还没有安装扩展' : 'No extensions installed',
  noInstalledDescription: isZh.value
    ? '使用左上角的 + 安装扩展或添加扩展来源。'
    : 'Use the + button in the top-left corner to install an extension or add a source.',
  author: isZh.value ? '作者' : 'Author',
  source: isZh.value ? '来源' : 'Source',
  provenance: isZh.value ? '来源信息' : 'Provenance',
  unknownAuthor: isZh.value ? '未声明' : 'Unspecified',
  unknownSource: isZh.value ? '未声明' : 'Unspecified',
  bundledSource: isZh.value ? 'Sub-Store 内置' : 'Bundled with Sub-Store',
  legacySource: isZh.value ? 'Sub-Store 兼容入口' : 'Sub-Store compatibility entry',
  officialCatalogSource: isZh.value ? 'Sub-Store 官方扩展目录' : 'Sub-Store official extension catalog',
  localInstallSource: isZh.value ? '本地文件夹安装' : 'Installed from a local folder',
  installedVersion: isZh.value ? '已安装版本' : 'Installed version',
  availableVersion: isZh.value ? '可用版本' : 'Available version',
  rollbackVersions: isZh.value ? '可回滚版本' : 'Rollback versions',
  update: isZh.value ? '更新' : 'Update',
  rollback: isZh.value ? '回滚' : 'Roll back',
  localRollback: isZh.value ? '本地回滚' : 'Local rollback',
  previousVerifiedVersion: isZh.value ? '上一已验证版本' : 'Previous verified version',
  remoteVersions: isZh.value ? '历史版本' : 'Version history',
  currentVersion: isZh.value ? '当前' : 'Current',
  latestVersion: isZh.value ? '最新' : 'Latest',
  yankedVersion: isZh.value ? '已撤回' : 'Yanked',
  viewOnlyVersion: isZh.value ? '仅供查看' : 'View only',
  installVersion: isZh.value ? '安装此版本' : 'Install this version',
  upgradeVersion: isZh.value ? '升级到此版本' : 'Upgrade to this version',
  downgradeVersion: isZh.value ? '降级到此版本' : 'Downgrade to this version',
  reinstallVersion: isZh.value ? '重新安装' : 'Reinstall',
  downgradeTitle: isZh.value ? '降级扩展？' : 'Downgrade extension?',
  downgradeDescription: isZh.value
    ? '旧版本可能无法读取新版本写入的数据。确认后将切换到所选的历史版本。'
    : 'An older release may not understand data written by the current version. Continue with the selected release?',
  releaseDate: isZh.value ? '发布于' : 'Released',
  gitRevision: isZh.value ? 'Git 版本' : 'Git revision',
}));

const extensionCard = (entry: ExtensionCatalogEntry): ExtensionCard => ({
  ...entry,
  id: entry.id,
  availability: extensionStore.availability(entry.id),
  manifest: extensionStore.manifest(entry.id),
});

const allCards = computed(() => catalog.value.map(extensionCard));
const isInstalledCard = (card: ExtensionCard) => {
  if (card.availability.source === 'bundled' || card.availability.source === 'legacy-fallback') return true;
  if (card.availability.receipt?.installationStatus === 'installed') return true;
  return INSTALLED_EXTENSION_STATUSES.has(card.availability.status);
};

const installedCards = computed(() => allCards.value.filter(isInstalledCard));
const availableCards = computed(() => allCards.value.filter(card => !isInstalledCard(card)));
const cards = computed(() => {
  const normalizedQuery = listSearchStore.normalizedQuery;
  return installedCards.value.filter(card => {
    if (!normalizedQuery) return true;
    const haystack = [
      card.id,
      card.name,
      card.description,
      card.manifest?.name,
      card.manifest?.description,
      card.manifest?.publisher?.name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
});

const sortedLauncherCards = computed(() => {
  const positions = new Map(launcherOrder.value.map((id, index) => [id, index]));
  return [...cards.value].sort((left, right) => {
    const leftIndex = positions.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = positions.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });
});

const launcherCards = computed({
  get: () => sortedLauncherCards.value,
  set: (next: ExtensionCard[]) => {
    const nextIds = next.map(card => card.id);
    const retainedIds = launcherOrder.value.filter(id => !nextIds.includes(id));
    launcherOrder.value = [...nextIds, ...retainedIds];
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        EXTENSION_LAUNCHER_ORDER_KEY,
        JSON.stringify(launcherOrder.value),
      );
    }
  },
});

const selectedCard = computed(() => allCards.value.find(card => card.id === selectedId.value));
const activeTasks = computed(() => extensionStore.tasks.filter(task => !['succeeded', 'failed', 'cancelled'].includes(String(task.status))).slice(-4));

const localFileCount = computed(() => {
  const inspectedCount = Number(localInspection.value?.fileCount);
  if (Number.isFinite(inspectedCount) && inspectedCount >= 0) return inspectedCount;
  return Object.keys(localProjection.value?.files || {}).length;
});

const localTotalBytes = computed(() => {
  const inspectedBytes = Number(localInspection.value?.totalBytes);
  if (Number.isFinite(inspectedBytes) && inspectedBytes >= 0) return inspectedBytes;
  return Object.values(localProjection.value?.files || {}).reduce(
    (total, content) => total + new TextEncoder().encode(content).byteLength,
    0,
  );
});

const localSelectedVariant = computed(() => {
  const receipt = localInspection.value?.receipt as Record<string, unknown> | undefined;
  return String(localInspection.value?.selectedVariant || receipt?.selectedVariant || '');
});

const localPackageDigest = computed(() => {
  const receipt = localInspection.value?.receipt as Record<string, unknown> | undefined;
  return String(localInspection.value?.packageDigest || receipt?.packageDigest || '');
});

const formatInspectionMessage = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  const record = value as Record<string, unknown>;
  const code = typeof record.code === 'string' ? record.code : '';
  const message = typeof record.message === 'string'
    ? record.message
    : typeof record.reason === 'string'
      ? record.reason
      : '';
  const path = typeof record.path === 'string' ? record.path : '';
  const readable = [code && `[${code}]`, message, path && `(${path})`].filter(Boolean).join(' ');
  if (readable) return readable;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const localWarnings = computed(() => (localInspection.value?.warnings || [])
  .map(formatInspectionMessage)
  .filter(Boolean));
const localDiagnostics = computed(() => (localInspection.value?.diagnostics || [])
  .map(formatInspectionMessage)
  .filter(Boolean));

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** unitIndex);
  return `${value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
};

const isImageIcon = (icon?: unknown): icon is string => typeof icon === 'string' && /^(https?:|data:|\/)/.test(icon);

const publisherName = (manifest?: ExtensionManifest) => manifest?.publisher?.name || labels.value.unknownAuthor;

const extensionPublisherLabel = (card: ExtensionCard) => card.manifest?.publisher?.name
  || card.publisher?.name
  || labels.value.unknownAuthor;

const sourcePublisherName = (source: ExtensionSource) => {
  const candidates = [source.publisher, source.author, source.publisherName];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (candidate && typeof candidate === 'object' && 'name' in candidate) {
      const name = String((candidate as { name?: unknown }).name || '').trim();
      if (name) return name;
    }
  }
  return labels.value.unknownAuthor;
};

const extensionSourceLabel = (card: ExtensionCard) => {
  const rawSource = String(card.source || '').trim();
  const rawSourceUrl = String(card.sourceUrl || '').trim();
  const sourceUrl = /^https?:\/\//i.test(rawSourceUrl)
    ? rawSourceUrl
    : /^https?:\/\//i.test(rawSource)
      ? rawSource
      : '';
  const officialSourceMarkers = ['local-official-seed', 'release-embedded-adoption', 'official-catalog'];
  const configuredSource = extensionStore.sources.find(source => (
    (card.sourceId && source.id === card.sourceId)
    || (sourceUrl && source.url === sourceUrl)
  ));
  const explicitName = String(card.sourceName || configuredSource?.name || '').trim();
  const hasOfficialSourceMarker = officialSourceMarkers.includes(explicitName)
    || officialSourceMarkers.includes(rawSource)
    || officialSourceMarkers.includes(rawSourceUrl);
  if (explicitName && !hasOfficialSourceMarker && sourceUrl) return `${explicitName} · ${sourceUrl}`;
  if (explicitName && !hasOfficialSourceMarker) return explicitName;
  if (sourceUrl) return sourceUrl;
  if (card.sourceId) return card.sourceId;
  if (['local-directory', 'local-folder', 'local-package'].includes(rawSource)
    || ['local-directory', 'local-folder', 'local-package'].includes(rawSourceUrl)) return labels.value.localInstallSource;
  if (card.availability.source === 'bundled') return labels.value.bundledSource;
  if (card.availability.source === 'legacy-fallback') return labels.value.legacySource;
  if (
    card.manifest?.publisher?.id === 'org.substore'
    || card.publisher?.id === 'org.substore'
    || hasOfficialSourceMarker
  ) return labels.value.officialCatalogSource;
  if (card.availability.source === 'catalog') return labels.value.officialCatalogSource;
  if (rawSource) return rawSource;
  if (rawSourceUrl) return rawSourceUrl;
  return labels.value.unknownSource;
};

const capabilityLabels = (manifest?: ExtensionManifest) => {
  const map: Record<string, string> = {
    artifacts: isZh.value ? '托管配置' : 'Hosted artifacts',
    sync: isZh.value ? '同步' : 'Sync',
    archive: isZh.value ? '归档' : 'Archive',
    publisher: isZh.value ? '发布链接' : 'Publishers',
    scheduler: isZh.value ? '定时任务' : 'Scheduler',
    'config-project': isZh.value ? '配置项目' : 'Config projects',
    preview: isZh.value ? '预览' : 'Preview',
    'artifact-source': isZh.value ? '来源扩展' : 'Artifact source',
  };
  return (manifest?.capabilities || []).map(capability => map[capability] || capability).slice(0, 5);
};

const permissionLabels = (manifest?: ExtensionManifest) => {
  const map: Record<string, string> = {
    'storage.own': isZh.value ? '插件数据存储' : 'Plugin data storage',
    'resources.list': isZh.value ? '读取资源列表' : 'List resources',
    'resources.read': isZh.value ? '读取资源内容' : 'Read resources',
    'resources.produce': isZh.value ? '生产配置内容' : 'Produce content',
    'references.manage-own': isZh.value ? '管理自身引用' : 'Manage own references',
    'publishers.use': isZh.value ? '使用发布器' : 'Use publishers',
    'credentials.use-handle': isZh.value ? '使用凭据句柄' : 'Use credential handles',
    'scheduler.jobs': isZh.value ? '注册定时任务' : 'Schedule jobs',
    'crypto.age.encrypt': isZh.value ? '使用 Age 加密' : 'Use Age encryption',
    'archive.contribute': isZh.value ? '参与归档' : 'Contribute archives',
    'backup.contribute': isZh.value ? '参与备份' : 'Contribute backups',
    'settings.contribute': isZh.value ? '贡献设置' : 'Contribute settings',
    'routes.namespaced': isZh.value ? '命名空间路由' : 'Namespaced routes',
    'routes.legacy-alias': isZh.value ? '兼容旧路由' : 'Legacy aliases',
    'navigation.register': isZh.value ? '注册导航' : 'Register navigation',
    'commands.register': isZh.value ? '注册命令' : 'Register commands',
  };
  return (manifest?.permissions || []).map(permission => {
    const name = typeof permission === 'string' ? permission : (permission as any)?.name;
    return map[name] || name;
  }).filter(Boolean).slice(0, 12);
};

const runtimeLabel = (card: ExtensionCard) => {
  if (sourceIsMissing(card)) return labels.value.sourceUnavailable;
  if (card.availability.source === 'legacy-fallback') return labels.value.legacy;
  if (card.availability.source === 'bundled') return labels.value.bundled;
  if (card.manifest?.kind === 'content') return labels.value.contentPackage;
  if (card.availability.receipt?.codeStatus === 'embedded-inactive' || card.manifest?.distribution === 'embedded') return labels.value.embedded;
  if (card.availability.receipt?.selectedVariant === 'node' || String(card.availability.receipt?.codeStatus || '').startsWith('verified-package')) return labels.value.nodePackage;
  if (card.availability.status === 'installing' || card.availability.status === 'updating') return labels.value.pending;
  return card.manifest?.host?.runtimes?.join(' / ') || (isZh.value ? '当前后端' : 'Current backend');
};

const statusTone = (status: ExtensionStatus) => {
  if (status === 'enabled') return 'success';
  if (['installing', 'updating', 'rolling-back', 'restoring'].includes(status)) return 'pending';
  if (['unknown', 'incompatible', 'missing', 'reinstall-required', 'frontend-load-failed', 'activation-failed'].includes(status)) return 'warning';
  return 'muted';
};

const statusLabel = (
  status: ExtensionStatus,
  source?: ExtensionAvailability['source'],
  kind?: ExtensionManifest['kind'],
) => {
  if (source === 'legacy-fallback') return labels.value.legacy;
  if (kind === 'content' && ['installed', 'enabled', 'disabled'].includes(status)) return labels.value.managed;
  const map: Partial<Record<ExtensionStatus, string>> = {
    bundled: labels.value.bundled,
    installed: labels.value.managed,
    enabled: labels.value.managed,
    disabled: `${labels.value.disable} · ${isZh.value ? '已停用' : 'disabled'}`,
    unknown: labels.value.unavailable,
    missing: labels.value.missing,
    incompatible: labels.value.incompatible,
    'reinstall-required': labels.value.reinstall,
    installing: labels.value.pending,
    updating: labels.value.pending,
    'rolling-back': labels.value.pending,
    restoring: labels.value.pending,
    'frontend-load-failed': labels.value.unavailable,
  };
  return map[status] || status;
};

const sourceStatusLabel = (source: ExtensionSource) => {
  const status = String(source.status || (source.enabled === false ? 'disabled' : 'active')).toLowerCase();
  if (status.includes('refresh')) return labels.value.sourceStatusRefreshing;
  if (status.includes('fail') || status.includes('error')) return labels.value.sourceStatusFailed;
  if (status.includes('disable')) return labels.value.sourceStatusDisabled;
  if (status === 'active' || status === 'ready' || status === 'ok' || status === 'success') return labels.value.sourceStatusActive;
  return labels.value.sourceStatusUnknown;
};

const sourceStatusTone = (source: ExtensionSource) => {
  const status = String(source.status || '').toLowerCase();
  if (status.includes('refresh')) return 'pending';
  if (status.includes('fail') || status.includes('error') || status.includes('disable')) return 'warning';
  if (status === 'active' || status === 'ready' || status === 'ok' || status === 'success') return 'success';
  return 'muted';
};

const shortDigest = (digest?: string) => digest ? `${digest.slice(0, 10)}…${digest.slice(-8)}` : '';

const installedVersion = (card: ExtensionCard) => String(
  card.installedVersion
  || card.availability.receipt?.version
  || (isInstalledCard(card) ? card.availability.manifest?.version : '')
  || '',
);

const availableVersion = (card: ExtensionCard) => String(
  card.availableVersion || card.version || '',
);

const rollbackVersions = (card: ExtensionCard) => {
  const versions = card.rollbackVersions || card.availability.receipt?.rollbackVersions;
  return Array.isArray(versions) ? versions.filter((version): version is string => typeof version === 'string') : [];
};

const compareVersionIdentifiers = (left: string, right: string) => {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);
  if (leftNumeric && rightNumeric) return Number(left) - Number(right);
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  return left.localeCompare(right);
};

const compareVersions = (left: string, right: string) => {
  const parse = (version: string) => {
    const match = version.trim().replace(/^v/i, '').match(
      /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/,
    );
    if (!match) return null;
    return {
      numbers: [Number(match[1]), Number(match[2] || 0), Number(match[3] || 0)],
      prerelease: match[4]?.match(/[^.]+/g) || [],
    };
  };
  const parsedLeft = parse(left);
  const parsedRight = parse(right);
  if (!parsedLeft || !parsedRight) return left.localeCompare(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = parsedLeft.numbers[index] - parsedRight.numbers[index];
    if (difference) return difference;
  }
  if (!parsedLeft.prerelease.length || !parsedRight.prerelease.length) {
    if (!parsedLeft.prerelease.length && !parsedRight.prerelease.length) return 0;
    return parsedLeft.prerelease.length ? -1 : 1;
  }
  const length = Math.max(parsedLeft.prerelease.length, parsedRight.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    if (parsedLeft.prerelease[index] === undefined) return -1;
    if (parsedRight.prerelease[index] === undefined) return 1;
    const difference = compareVersionIdentifiers(
      parsedLeft.prerelease[index],
      parsedRight.prerelease[index],
    );
    if (difference) return difference;
  }
  return 0;
};

const remoteReleases = (card: ExtensionCard) => {
  if (!Array.isArray(card.releases)) return [];
  return card.releases
    .filter((release): release is ExtensionCatalogRelease => Boolean(release?.version))
    .slice()
    .sort((left, right) => compareVersions(right.version, left.version));
};

const isLatestRelease = (card: ExtensionCard, release: ExtensionCatalogRelease) => (
  release.latest === true
  || release.version === availableVersion(card)
);

const formatReleaseDate = (value?: string | number) => {
  if (value === undefined || value === null || value === '') return '';
  const numeric = typeof value === 'number' ? value : Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric < 1_000_000_000_000 ? numeric * 1000 : numeric)
    : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(isZh.value ? 'zh-CN' : 'en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const shortCommit = (commit?: string) => commit?.trim().slice(0, 8) || '';

const releaseRevisionLabel = (release: ExtensionCatalogRelease) => [
  release.gitTag?.trim(),
  shortCommit(release.gitCommit),
].filter(Boolean).join(' · ');

const releaseRevisionTitle = (release: ExtensionCatalogRelease) => [
  release.gitTag?.trim(),
  release.gitCommit?.trim(),
].filter(Boolean).join(' · ');

const hasInstalledPackage = (card: ExtensionCard) => (
  card.availability.receipt?.installationStatus === 'installed'
  || ['installed', 'enabled', 'disabled', 'frontend-load-failed', 'activation-failed'].includes(card.availability.status)
);

const needsPackageRestore = (card: ExtensionCard) => (
  card.availability.status === 'reinstall-required'
  || ['removed', 'missing'].includes(String(card.availability.receipt?.codeStatus || ''))
);

const releaseActionKind = (card: ExtensionCard, release: ExtensionCatalogRelease): ReleaseActionKind => {
  const current = installedVersion(card);
  if (needsPackageRestore(card)) return 'reinstall';
  if (!hasInstalledPackage(card)) return 'install';
  const comparison = compareVersions(release.version, current);
  if (comparison > 0) return 'upgrade';
  if (comparison < 0) return 'downgrade';
  return 'current';
};

const releaseActionLabel = (card: ExtensionCard, release: ExtensionCatalogRelease) => ({
  install: labels.value.installVersion,
  upgrade: labels.value.upgradeVersion,
  downgrade: labels.value.downgradeVersion,
  reinstall: labels.value.reinstallVersion,
  current: labels.value.reinstallVersion,
})[releaseActionKind(card, release)];

const visibleReleaseActionLabel = (card: ExtensionCard, release: ExtensionCatalogRelease) => (
  release.installable === false || release.yanked === true
    ? labels.value.viewOnlyVersion
    : releaseActionLabel(card, release)
);

const releaseActionDisabled = (card: ExtensionCard, release: ExtensionCatalogRelease) => (
  release.installable === false
  || release.yanked === true
  || sourceIsMissing(card)
  || isActionLoading(card.id)
  || !extensionStore.canManage
);

const versionSummary = (card: ExtensionCard) => {
  const installed = installedVersion(card);
  const available = availableVersion(card);
  if (installed && available && installed !== available) {
    return `${labels.value.installedVersion} v${installed} · ${labels.value.availableVersion} v${available}`;
  }
  return `v${installed || available || '0.0.0'}`;
};

const retainedReasonLabel = (reason?: 'user-uninstalled' | 'backup-restored') => reason === 'backup-restored'
  ? labels.value.retainedBackup
  : labels.value.retainedUser;

const canDisable = (id: string) => {
  const availability = extensionStore.availability(id);
  return availability.status === 'enabled' && extensionStore.canManage;
};

const canUninstall = (card: ExtensionCard) => card.availability.source === 'runtime'
  && card.manifest?.kind !== 'bundled'
  && (
    card.availability.receipt?.installationStatus === 'installed'
    || ['enabled', 'disabled', 'installed', 'frontend-load-failed', 'activation-failed'].includes(card.availability.status)
  );

const canUpdate = (card: ExtensionCard) => card.updateAvailable === true
  && !sourceIsMissing(card)
  && card.availability.receipt?.installationStatus === 'installed';

const canRollback = (card: ExtensionCard) => (
  card.rollbackAvailable === true
  || card.availability.receipt?.rollbackAvailable === true
  || rollbackVersions(card).length > 0
) && card.availability.receipt?.installationStatus === 'installed';

const sourceIsMissing = (card: ExtensionCard) => card.sourceMissing === true
  || card.availability.sourceMissing === true;

const managementHint = (card?: ExtensionCard) => {
  if (extensionStore.canManage) return '';
  if (extensionStore.managementMode === 'token' || (card && requiresAdminToken(card))) {
    return labels.value.managementNoToken;
  }
  return labels.value.managementReadOnly;
};

const uninstallDisabled = (card: ExtensionCard) => !extensionStore.canManage || isActionLoading(card.id);

const extensionOpenPath = (id: string) => resolveExtensionOpenPath(
  id,
  extensionStore.manifest(id),
);

const canOpenExtension = (card: ExtensionCard) => Boolean(extensionOpenPath(card.id))
  && ['enabled', 'bundled'].includes(card.availability.status);

const openExtension = async (card: ExtensionCard) => {
  const path = extensionOpenPath(card.id);
  if (!path) return;
  detailVisible.value = false;
  await router.push(path);
};

const primaryActionLabel = (card: ExtensionCard) => {
  if (sourceIsMissing(card) && ['missing', 'reinstall-required'].includes(card.availability.status)) {
    return labels.value.sourceUnavailable;
  }
  if (card.manifest?.kind === 'content' && ['installed', 'enabled', 'disabled'].includes(card.availability.status)) {
    return labels.value.managed;
  }
  const managementUnavailableLabel = extensionStore.managementMode === 'token'
    ? labels.value.adminRequiredAction
    : labels.value.unavailable;
  switch (card.availability.status) {
    case 'bundled': return extensionOpenPath(card.id) ? labels.value.open : labels.value.managed;
    case 'enabled': return canDisable(card.id) ? labels.value.disable : extensionOpenPath(card.id) ? labels.value.open : labels.value.managed;
    case 'installed': return extensionStore.canManage ? labels.value.enable : managementUnavailableLabel;
    case 'disabled': return extensionStore.canManage ? labels.value.enable : managementUnavailableLabel;
    case 'reinstall-required':
    case 'missing': return extensionStore.canManage ? (card.availability.status === 'reinstall-required' ? labels.value.reinstall : labels.value.install) : managementUnavailableLabel;
    case 'unknown':
    case 'incompatible': return labels.value.unavailable;
    default: return labels.value.pending;
  }
};

const hasPrimaryAction = (card: ExtensionCard) => !(
  card.manifest?.kind === 'content'
  && ['installed', 'enabled', 'disabled'].includes(card.availability.status)
);

const isActionDisabled = (card: ExtensionCard) => {
  if (sourceIsMissing(card) && ['missing', 'reinstall-required'].includes(card.availability.status)) return true;
  if (card.manifest?.kind === 'content' && ['installed', 'enabled', 'disabled'].includes(card.availability.status)) return true;
  if ((card.availability.status === 'enabled' || card.availability.status === 'bundled') && extensionOpenPath(card.id)) return false;
  if (['installing', 'updating', 'rolling-back', 'restoring'].includes(card.availability.status)) return true;
  if (['unknown', 'incompatible'].includes(card.availability.status)) return true;
  return !extensionStore.canManage && !(
    card.availability.status === 'enabled' && card.availability.source === 'legacy-fallback'
  );
};

const isActionLoading = (id: string) => actionLoadingId.value === id;

const requiresAdminToken = (card: ExtensionCard) => card.availability.source !== 'bundled'
  && card.availability.source !== 'legacy-fallback'
  && extensionStore.managementMode === 'token';

const saveAdminToken = () => {
  extensionStore.setAdminToken(adminTokenInput.value);
  adminTokenInput.value = '';
};

const clearAdminToken = () => {
  extensionStore.clearAdminToken();
  adminTokenInput.value = '';
};

const openAddExtensions = () => {
  extensionStore.lastActionError = '';
  listSearchStore.close();
  addVisible.value = true;
};

const openLocalDirectoryFromAdd = () => {
  addVisible.value = false;
  openLocalDirectoryPicker();
};

const openSourcesFromAdd = () => {
  addVisible.value = false;
  openSources();
};

const openAvailableExtension = (card: ExtensionCard) => {
  addVisible.value = false;
  openDetails(card.id);
};

const openLocalDirectoryPicker = () => {
  localInstallError.value = '';
  extensionStore.lastActionError = '';
  if (!extensionStore.supportsLocalPackageInstall) return;
  if (!extensionStore.canManage) {
    if (extensionStore.managementMode === 'token') {
      openSources();
      showNotify({ title: labels.value.localAdminRequired, type: 'danger' });
    } else {
      showNotify({ title: labels.value.managementReadOnly, type: 'danger' });
    }
    return;
  }
  localDirectoryInput.value?.click();
};

const handleLocalDirectoryChange = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  localInstallError.value = '';
  localProjection.value = null;
  localInspection.value = null;
  extensionStore.lastActionError = '';

  if (!input.files?.length) {
    input.value = '';
    return;
  }

  localInspecting.value = true;
  try {
    const projection = await buildExtensionDirectoryProjection(input.files);
    localProjection.value = projection;
    const inspection = await extensionStore.inspectLocalPackage(projection);
    if (!inspection) throw new Error(extensionStore.lastActionError || labels.value.localInvalid);
    localInspection.value = inspection;
    localInstallVisible.value = true;
  } catch (error) {
    const reason = error instanceof Error ? error.message : '';
    localInstallError.value = reason || extensionStore.lastActionError || labels.value.localInvalid;
    if (!extensionStore.canManage && extensionStore.managementMode === 'token') sourcesVisible.value = true;
    showNotify({ title: localInstallError.value, type: 'danger' });
  } finally {
    localInspecting.value = false;
    input.value = '';
  }
};

const closeLocalInstall = () => {
  if (localInstalling.value) return;
  localInstallVisible.value = false;
  localProjection.value = null;
  localInspection.value = null;
  localInstallError.value = '';
};

const installLocalPackage = async () => {
  if (localInstalling.value || !localProjection.value || !localInspection.value) return;
  if (!extensionStore.canManage) {
    localInstallError.value = extensionStore.managementMode === 'token'
      ? labels.value.localAdminRequired
      : labels.value.managementReadOnly;
    return;
  }

  localInstalling.value = true;
  localInstallError.value = '';
  const succeeded = await extensionStore.installLocal(
    localInspection.value.extensionId,
    localProjection.value,
  );
  localInstalling.value = false;

  if (succeeded) {
    localInstallVisible.value = false;
    localProjection.value = null;
    localInspection.value = null;
    showNotify({ title: labels.value.actionSuccess, type: 'primary' });
    return;
  }

  localInstallError.value = extensionStore.lastActionError || labels.value.actionFailed;
  showNotify({ title: localInstallError.value, type: 'danger' });
};

const isValidSourceUrl = computed(() => {
  const value = sourceUrlInput.value.trim();
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    if (url.protocol !== 'http:') return false;
    return ['localhost', 'localhost.localdomain', '127.0.0.1', '0.0.0.0', '[::1]'].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
});

const openSources = () => {
  extensionStore.sourceActionError = '';
  sourcesVisible.value = true;
  if (!extensionStore.sources.length) extensionStore.refreshSources();
};

const addSource = async () => {
  if (!isValidSourceUrl.value || sourceSubmitting.value || !extensionStore.canManage) return;
  sourceSubmitting.value = true;
  const succeeded = await extensionStore.addSource(sourceUrlInput.value, sourceNameInput.value);
  sourceSubmitting.value = false;
  if (succeeded) {
    sourceUrlInput.value = '';
    sourceNameInput.value = '';
    showNotify({ title: labels.value.actionSuccess, type: 'primary' });
  } else {
    showNotify({ title: extensionStore.sourceActionError || labels.value.actionFailed, type: 'danger' });
  }
};

const refreshSources = async () => {
  await extensionStore.refreshSources();
};

const refreshOneSource = async (sourceId: string) => {
  if (sourceLoadingId.value || !extensionStore.canManage) return;
  sourceLoadingId.value = sourceId;
  const succeeded = await extensionStore.refreshSource(sourceId);
  sourceLoadingId.value = '';
  if (!succeeded) showNotify({ title: extensionStore.sourceActionError || labels.value.actionFailed, type: 'danger' });
};

const extensionConfirmDialogLayer = Object.freeze({
  overlayClass: 'extension-store-confirm-overlay',
  popClass: 'auto-dialog extension-store-confirm-dialog',
});

const removeOneSource = (sourceId: string) => {
  if (sourceLoadingId.value || !extensionStore.canManage) return;
  Dialog({
    ...extensionConfirmDialogLayer,
    title: labels.value.removeSource,
    content: isZh.value ? '删除来源不会卸载已经安装的扩展。' : 'Removing a source does not uninstall extensions already installed from it.',
    textAlign: 'left',
    okText: labels.value.removeSource,
    cancelText: labels.value.close,
    closeOnPopstate: true,
    lockScroll: false,
    onOk: async () => {
      sourceLoadingId.value = sourceId;
      const succeeded = await extensionStore.removeSource(sourceId);
      sourceLoadingId.value = '';
      if (succeeded) showNotify({ title: labels.value.actionSuccess, type: 'primary' });
      else showNotify({ title: extensionStore.sourceActionError || labels.value.actionFailed, type: 'danger' });
    },
  });
};

const openDetails = (id: string) => {
  selectedId.value = id;
  versionHistoryOpen.value = false;
  extensionStore.lastActionError = '';
  detailVisible.value = true;
};

const syncVersionHistoryOpen = (event: Event) => {
  versionHistoryOpen.value = (event.currentTarget as HTMLDetailsElement).open;
};

const cancelAppLongPress = () => {
  if (appPressTimer.value !== null && typeof window !== 'undefined') {
    window.clearTimeout(appPressTimer.value);
  }
  appPressTimer.value = null;
};

const enterAppManagement = (card: ExtensionCard) => {
  cancelAppLongPress();
  selectedId.value = card.id;
  listSearchStore.close();
  appManagementMode.value = true;
};

const startAppLongPress = (card: ExtensionCard) => {
  cancelAppLongPress();
  appLongPressTriggered.value = false;
  if (typeof window === 'undefined') return;
  appPressTimer.value = window.setTimeout(() => {
    appPressTimer.value = null;
    appLongPressTriggered.value = true;
    enterAppManagement(card);
    if (appLongPressResetTimer.value !== null) {
      window.clearTimeout(appLongPressResetTimer.value);
    }
    appLongPressResetTimer.value = window.setTimeout(() => {
      appLongPressTriggered.value = false;
      appLongPressResetTimer.value = null;
    }, 900);
  }, 450);
};

const toggleAppManagement = () => {
  cancelAppLongPress();
  appLongPressTriggered.value = false;
  if (!appManagementMode.value) listSearchStore.close();
  appManagementMode.value = !appManagementMode.value;
};

const openMobileExtension = async (card: ExtensionCard) => {
  if (appLongPressTriggered.value) {
    appLongPressTriggered.value = false;
    return;
  }
  if (appManagementMode.value) return;
  if (canOpenExtension(card)) return openExtension(card);
  openDetails(card.id);
};

const performPrimaryAction = async (card: ExtensionCard) => {
  if ((card.availability.status === 'enabled' || card.availability.status === 'bundled') && !canDisable(card.id) && extensionOpenPath(card.id)) {
    detailVisible.value = false;
    await router.push(extensionOpenPath(card.id) as string);
    return;
  }
  if (isActionDisabled(card)) return;
  actionLoadingId.value = card.id;
  let succeeded = false;
  if (card.availability.status === 'enabled') succeeded = await extensionStore.disable(card.id);
  else if (card.availability.status === 'bundled') succeeded = false;
  else if (card.availability.status === 'installed') succeeded = await extensionStore.enable(card.id);
  else if (card.availability.status === 'disabled') succeeded = await extensionStore.enable(card.id);
  else if (card.availability.status === 'reinstall-required' || card.availability.status === 'missing') succeeded = await extensionStore.install(card.id);
  actionLoadingId.value = '';
  if (succeeded) {
    showNotify({ title: labels.value.actionSuccess, type: 'primary' });
    detailVisible.value = false;
  } else {
    showNotify({ title: extensionStore.lastActionError || labels.value.actionFailed, type: 'danger' });
  }
};

const performVersionAction = async (card: ExtensionCard, action: 'update' | 'rollback') => {
  if (!extensionStore.canManage || isActionLoading(card.id)) return;
  actionLoadingId.value = card.id;
  const succeeded = action === 'update'
    ? await extensionStore.update(card.id)
    : await extensionStore.rollback(card.id);
  actionLoadingId.value = '';
  if (succeeded) {
    showNotify({ title: labels.value.actionSuccess, type: 'primary' });
  } else {
    showNotify({ title: extensionStore.lastActionError || labels.value.actionFailed, type: 'danger' });
  }
};

const performReleaseAction = async (card: ExtensionCard, release: ExtensionCatalogRelease) => {
  if (releaseActionDisabled(card, release)) return;
  actionLoadingId.value = card.id;
  const kind = releaseActionKind(card, release);
  const succeeded = kind === 'current'
    ? await extensionStore.reinstallVersion(card.id, release.version)
    : hasInstalledPackage(card) && !needsPackageRestore(card)
    ? await extensionStore.switchVersion(card.id, release.version)
    : await extensionStore.installVersion(card.id, release.version);
  actionLoadingId.value = '';
  if (succeeded) {
    showNotify({ title: labels.value.actionSuccess, type: 'primary' });
  } else {
    showNotify({ title: extensionStore.lastActionError || labels.value.actionFailed, type: 'danger' });
  }
};

const confirmVersionSwitch = (card: ExtensionCard, release: ExtensionCatalogRelease) => {
  if (releaseActionDisabled(card, release)) return;
  if (releaseActionKind(card, release) !== 'downgrade') {
    void performReleaseAction(card, release);
    return;
  }
  Dialog({
    ...extensionConfirmDialogLayer,
    title: labels.value.downgradeTitle,
    content: `${labels.value.downgradeDescription}\n${installedVersion(card)} → ${release.version}`,
    textAlign: 'left',
    okText: labels.value.downgradeVersion,
    cancelText: labels.value.close,
    closeOnPopstate: true,
    lockScroll: false,
    onOk: async () => performReleaseAction(card, release),
  });
};

const confirmUninstall = (card: ExtensionCard) => {
  Dialog({
    ...extensionConfirmDialogLayer,
    title: labels.value.uninstallTitle,
    content: labels.value.uninstallDescription,
    textAlign: 'left',
    okText: labels.value.uninstall,
    cancelText: labels.value.close,
    closeOnPopstate: true,
    lockScroll: false,
    onOk: async () => {
      actionLoadingId.value = card.id;
      const succeeded = await extensionStore.uninstall(card.id);
      actionLoadingId.value = '';
      if (succeeded) {
        showNotify({ title: labels.value.actionSuccess, type: 'primary' });
        detailVisible.value = false;
      } else {
        showNotify({ title: extensionStore.lastActionError || labels.value.actionFailed, type: 'danger' });
      }
    },
  });
};

const refresh = async () => {
  await extensionStore.refresh({ force: true });
};

const handleResize = () => {
  isMobileViewport.value = window.innerWidth < 600;
};

onMounted(() => {
  methodStore.registerMethod(
    EXTENSION_STORE_COMMANDS.add,
    openAddExtensions,
  );
  methodStore.registerMethod(
    EXTENSION_STORE_COMMANDS.toggleManagement,
    toggleAppManagement,
  );
  extensionStore.refresh({ silent: true });
  extensionStore.startRevisionSync();
  window.addEventListener('resize', handleResize);
  if (typeof route.query.id === 'string') openDetails(route.query.id);
});

onBeforeUnmount(() => {
  methodStore.removeMethod(EXTENSION_STORE_COMMANDS.add);
  methodStore.removeMethod(EXTENSION_STORE_COMMANDS.toggleManagement);
  extensionStore.setLauncherManagementMode(false);
  window.removeEventListener('resize', handleResize);
  cancelAppLongPress();
  if (appLongPressResetTimer.value !== null) {
    window.clearTimeout(appLongPressResetTimer.value);
  }
});
</script>

<style lang="scss" scoped>
.extension-store-page {
  width: 100%;
  min-height: 100%;
  padding: 16px var(--safe-area-side) calc(24px + var(--safe-area-bottom, 0px));
  box-sizing: border-box;
}

.compatibility-note {
  border-radius: var(--item-card-radios);
  background: var(--card-color);
  color: var(--second-text-color);
}

.detail-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 12%, var(--card-color));
}

.detail-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  color: var(--comment-text-color);
  cursor: pointer;
}

.detail-close:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.local-directory-input {
  display: none;
}

.detail-close:hover,
.detail-close:focus-visible {
  color: var(--primary-color);
}

.compatibility-note {
  display: flex;
  max-width: 920px;
  align-items: center;
  gap: 8px;
  margin: 0 auto 12px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--primary-color) 25%, var(--divider-color));
  color: var(--comment-text-color);
  font-size: 12px;
}

.compatibility-note svg {
  flex: 0 0 auto;
  color: var(--primary-color);
}

.compatibility-note.warning {
  border-color: color-mix(in srgb, var(--danger-color) 25%, var(--divider-color));
}

.compatibility-note.warning svg {
  color: var(--danger-color);
}

.compatibility-note span {
  min-width: 0;
  flex: 1;
}

.compatibility-note button {
  border: 0;
  padding: 0;
  color: var(--primary-color);
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
}

.extension-task-strip {
  max-width: 920px;
  margin: 0 auto 12px;
  padding: 10px 12px;
  border: 1px solid var(--divider-color);
  border-radius: var(--item-card-radios);
  color: var(--comment-text-color);
  background: var(--card-color);
  font-size: 11px;
}

.task-strip-heading {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 5px;
  color: var(--primary-text-color);
  font-weight: 600;
}

.task-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 5px;
}

.task-row-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-row-stage { color: var(--primary-color); }
.task-row-progress { color: var(--lowest-text-color); }

.extension-app-grid {
  display: grid;
  max-width: 920px;
  margin: 0 auto;
  grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));
  gap: 24px 10px;
  padding: 16px 2px 28px;
}

.extension-app-item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  -webkit-user-select: none;
  user-select: none;
}

.extension-app-icon-shell {
  position: relative;
  width: 64px;
  height: 64px;
}

.extension-app-launcher {
  position: relative;
  display: block;
  width: 64px;
  height: 64px;
  border: 0;
  border-radius: 17px;
  padding: 0;
  color: var(--primary-color);
  background: transparent;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.extension-app-launcher:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 3px;
}

.extension-app-launcher.unavailable .extension-app-icon {
  opacity: 0.64;
  filter: saturate(0.72);
}

.extension-app-icon {
  display: inline-flex;
  width: 64px;
  height: 64px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--divider-color) 72%, transparent);
  border-radius: 17px;
  color: var(--primary-color);
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--primary-color) 14%, var(--card-color)), var(--card-color));
  box-shadow:
    0 1px 1px color-mix(in srgb, var(--primary-text-color) 7%, transparent),
    0 6px 14px color-mix(in srgb, var(--primary-text-color) 9%, transparent);
  font-size: 26px;
}

.extension-app-icon.image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.extension-app-status {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 9px;
  height: 9px;
  box-sizing: border-box;
  border: 2px solid var(--background-color);
  border-radius: 50%;
  background: var(--comment-text-color);
}

.extension-app-status.success { background: var(--succeed-color); }
.extension-app-status.pending { background: var(--primary-color); }
.extension-app-status.warning { background: var(--warning-color, #d88900); }
.extension-app-status.muted { background: var(--lowest-text-color); }

.extension-app-controls {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.extension-app-remove,
.extension-app-details {
  position: absolute;
  top: -9px;
  display: inline-flex;
  width: 25px;
  height: 25px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--background-color);
  border-radius: 50%;
  padding: 0;
  background: var(--card-color);
  box-shadow: 0 2px 7px color-mix(in srgb, var(--primary-text-color) 18%, transparent);
  cursor: pointer;
  pointer-events: auto;
}

.extension-app-remove::after,
.extension-app-details::after {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  content: '';
}

.extension-app-remove {
  left: -9px;
  color: var(--danger-color);
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
}

.extension-app-remove span {
  transform: translateY(-1px);
}

.extension-app-remove:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.extension-app-details {
  right: -9px;
  color: var(--primary-color);
  font-size: 18px;
}

.extension-app-title {
  display: -webkit-box;
  width: 100%;
  max-width: 78px;
  min-height: 29px;
  overflow: hidden;
  color: var(--primary-text-color);
  font-size: 11px;
  line-height: 1.3;
  text-align: center;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.extension-app-grid.managing .extension-app-icon-shell {
  animation: extension-app-wiggle 0.22s ease-in-out infinite alternate;
}

.extension-app-grid.managing .extension-app-item:nth-child(2n) .extension-app-icon-shell {
  animation-delay: -0.11s;
  animation-direction: alternate-reverse;
}

.extension-app-grid.managing .extension-app-launcher {
  cursor: grab;
  touch-action: none;
}

.extension-app-grid.dragging .extension-app-icon-shell,
.extension-app-chosen .extension-app-icon-shell,
.extension-app-drag .extension-app-icon-shell {
  animation: none !important;
}

.extension-app-ghost {
  opacity: 0.24;
}

.extension-app-chosen .extension-app-icon,
.extension-app-drag .extension-app-icon {
  transform: scale(1.06);
  box-shadow:
    0 2px 4px color-mix(in srgb, var(--primary-text-color) 10%, transparent),
    0 12px 28px color-mix(in srgb, var(--primary-text-color) 22%, transparent);
}

.extension-app-drag {
  opacity: 0.96;
}

.detail-icon.image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}
.detail-title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.detail-title-row h2 {
  min-width: 0;
  overflow: hidden;
  margin: 0;
  color: var(--primary-text-color);
  font-size: 16px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-heading p {
  margin: 3px 0 0;
  color: var(--lowest-text-color);
  font-size: 11px;
}

.status-pill {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 3px 7px;
  font-size: 10px;
  line-height: 1.2;
  white-space: nowrap;
}

.status-pill.success { color: var(--succeed-color); background: color-mix(in srgb, var(--succeed-color) 12%, transparent); }
.status-pill.pending { color: var(--primary-color); background: color-mix(in srgb, var(--primary-color) 12%, transparent); }
.status-pill.warning { color: var(--warning-color, #d88900); background: color-mix(in srgb, var(--warning-color, #d88900) 12%, transparent); }
.status-pill.muted { color: var(--comment-text-color); background: color-mix(in srgb, var(--comment-text-color) 10%, transparent); }

.detail-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 14px;
}

.capability-chip {
  border-radius: 999px;
  padding: 3px 7px;
  color: var(--comment-text-color);
  background: var(--background-color);
  font-size: 10px;
  line-height: 1.2;
}

.detail-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
}

.details-button,
.primary-action {
  min-height: 30px;
  border-radius: 8px;
  padding: 0 10px;
  font-size: 11px;
  cursor: pointer;
}

.details-button {
  border: 1px solid var(--divider-color);
  color: var(--comment-text-color);
  background: transparent;
}

.detail-uninstall-button {
  margin-right: auto;
  border-color: color-mix(in srgb, var(--danger-color) 35%, var(--divider-color));
  color: var(--danger-color);
}

.primary-action {
  border: 1px solid var(--primary-color);
  color: var(--primary-color);
  background: transparent;
}

.primary-action:not(:disabled):hover {
  color: var(--card-color);
  background: var(--primary-color);
}

.primary-action.danger {
  border-color: var(--danger-color);
  color: var(--danger-color);
}

.primary-action.danger:not(:disabled):hover {
  color: var(--card-color);
  background: var(--danger-color);
}

.primary-action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.button-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: extension-spin 0.8s linear infinite;
}

.store-state {
  display: flex;
  min-height: 220px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--comment-text-color);
  font-size: 13px;
}

.store-loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--divider-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: extension-spin 0.8s linear infinite;
}

.store-state-empty {
  flex-direction: column;
  gap: 6px;
  text-align: center;
}

.store-empty-icon {
  display: inline-flex;
  width: 58px;
  height: 58px;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  border-radius: 18px;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 10%, var(--card-color));
  font-size: 23px;
}

.store-state-empty h3 {
  margin: 0;
  color: var(--primary-text-color);
  font-size: 15px;
}

.store-state-empty p {
  max-width: 320px;
  margin: 0;
  color: var(--comment-text-color);
  font-size: 11px;
  line-height: 1.55;
}

.extension-add-panel {
  display: flex;
  width: 100%;
  max-height: inherit;
  flex-direction: column;
  overflow: hidden;
  color: var(--second-text-color);
  background: var(--popup-color);
}

.extension-add-scroll {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 16px 20px calc(20px + var(--safe-area-bottom, 0px));
  overscroll-behavior: contain;
}

.extension-add-shortcuts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.extension-add-shortcut {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid var(--divider-color);
  border-radius: 9px;
  padding: 0 12px;
  color: var(--primary-text-color);
  background: var(--card-color);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.extension-add-shortcut:hover,
.extension-add-shortcut:focus-visible {
  border-color: color-mix(in srgb, var(--primary-color) 42%, var(--divider-color));
}

.extension-add-shortcut:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.extension-add-shortcut > svg {
  color: var(--primary-color);
}

.extension-add-available {
  margin-top: 20px;
}

.extension-add-available > h3 {
  margin: 0 0 8px;
  color: var(--primary-text-color);
  font-size: 13px;
}

.extension-add-item {
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: 46px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border: 0;
  border-bottom: 1px solid var(--divider-color);
  padding: 11px 0;
  color: var(--comment-text-color);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.extension-add-item:last-of-type {
  border-bottom: 0;
}

.extension-add-item-icon {
  display: inline-flex;
  width: 46px;
  height: 46px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--divider-color) 72%, transparent);
  border-radius: 13px;
  color: var(--primary-color);
  background: linear-gradient(145deg, color-mix(in srgb, var(--primary-color) 14%, var(--card-color)), var(--card-color));
  font-size: 19px;
}

.extension-add-item-icon.image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.extension-add-item-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.extension-add-item-copy > strong {
  overflow: hidden;
  color: var(--primary-text-color);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.extension-add-item-description {
  display: -webkit-box;
  overflow: hidden;
  color: var(--comment-text-color);
  font-size: 10px;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.extension-add-item-meta {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 3px 10px;
  color: var(--lowest-text-color);
  font-size: 9px;
  line-height: 1.35;
}

.extension-add-item-meta > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.extension-add-item-action {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 5px 9px;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 10%, transparent);
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

.extension-detail {
  display: flex;
  width: 100%;
  max-height: inherit;
  flex-direction: column;
  overflow: hidden;
  color: var(--second-text-color);
  background: var(--popup-color);
}

.detail-header {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  padding: 20px 20px 14px;
  border-bottom: 1px solid var(--divider-color);
}

.detail-scroll {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 0 20px 20px;
  overscroll-behavior: contain;
}

.detail-icon {
  width: 54px;
  height: 54px;
  border-radius: 16px;
  font-size: 23px;
}

.detail-heading {
  min-width: 0;
  flex: 1;
}

.detail-close {
  width: 30px;
  height: 30px;
  border-radius: 50%;
}

.detail-description {
  margin: 18px 0 0;
  color: var(--comment-text-color);
  font-size: 13px;
  line-height: 1.6;
}

.detail-section {
  margin-top: 20px;
}

.detail-section h3,
.detail-token-section h3 {
  margin: 0;
  color: var(--primary-text-color);
  font-size: 13px;
}

.detail-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 8px 0 0;
  overflow: hidden;
  border-radius: 9px;
  background: var(--divider-color);
}

.detail-facts > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
  padding: 9px;
  background: var(--card-color);
}

.detail-facts dt {
  color: var(--lowest-text-color);
  font-size: 10px;
}

.detail-facts dd {
  overflow: hidden;
  margin: 0;
  color: var(--second-text-color);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.release-list {
  display: grid;
  gap: 1px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: 9px;
  background: var(--divider-color);
}

.version-history-summary {
  display: flex;
  min-height: 38px;
  align-items: center;
  gap: 8px;
  border-radius: 9px;
  padding: 0 10px;
  color: var(--primary-text-color);
  background: var(--card-color);
  font-size: 13px;
  cursor: pointer;
  list-style: none;
}

.version-history-summary::-webkit-details-marker { display: none; }

.version-history-count {
  margin-left: auto;
  color: var(--lowest-text-color);
  font-size: 10px;
}

.version-history-chevron {
  color: var(--lowest-text-color);
  font-size: 9px;
  transition: transform 160ms ease;
}

.detail-version-section[open] .version-history-chevron { transform: rotate(90deg); }

.release-item {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: var(--card-color);
}

.release-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3px;
}

.release-title-row {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}

.release-title-row strong {
  color: var(--primary-text-color);
  font-size: 12px;
}

.release-badge {
  border-radius: 999px;
  padding: 2px 6px;
  color: var(--comment-text-color);
  background: var(--background-color);
  font-size: 9px;
  line-height: 1.2;
}

.release-badge.current {
  color: var(--succeed-color);
  background: color-mix(in srgb, var(--succeed-color) 12%, transparent);
}

.release-badge.latest {
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 12%, transparent);
}

.release-badge.yanked {
  color: var(--danger-color);
  background: color-mix(in srgb, var(--danger-color) 10%, transparent);
}

.release-meta {
  overflow: hidden;
  color: var(--lowest-text-color);
  font-size: 10px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.release-action {
  flex: 0 0 auto;
  white-space: nowrap;
}

.local-rollback-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  border-radius: 9px;
  padding: 9px 10px;
  background: var(--card-color);
}

.local-rollback-summary > span {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--comment-text-color);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-token-section {
  margin-top: 20px;
}

.detail-token-section p {
  margin: 5px 0 8px;
  color: var(--comment-text-color);
  font-size: 11px;
  line-height: 1.5;
}

.token-row {
  display: flex;
  gap: 6px;
}

.token-row input {
  min-width: 0;
  flex: 1;
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  padding: 7px 9px;
  outline: 0;
  color: var(--primary-text-color);
  background: var(--card-color);
  font-size: 12px;
}

.detail-error {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: 16px;
  padding: 9px;
  border-radius: 8px;
  color: var(--danger-color);
  background: color-mix(in srgb, var(--danger-color) 8%, transparent);
  font-size: 11px;
  line-height: 1.4;
}

.local-inspection-list {
  margin-top: 16px;
  padding: 10px 11px;
  border: 1px solid color-mix(in srgb, var(--primary-color) 20%, var(--divider-color));
  border-radius: 9px;
  color: var(--comment-text-color);
  background: color-mix(in srgb, var(--primary-color) 5%, transparent);
}

.local-inspection-list.warning {
  border-color: color-mix(in srgb, var(--warning-color, #d88900) 26%, var(--divider-color));
  background: color-mix(in srgb, var(--warning-color, #d88900) 7%, transparent);
}

.local-inspection-list h3 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--primary-text-color);
  font-size: 12px;
}

.local-inspection-list h3 svg {
  color: var(--primary-color);
}

.local-inspection-list.warning h3 svg {
  color: var(--warning-color, #d88900);
}

.local-inspection-list ul {
  margin: 7px 0 0;
  padding-left: 18px;
  font-size: 11px;
  line-height: 1.5;
}

.local-inspection-list li + li {
  margin-top: 4px;
}

.detail-source-warning {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-top: 16px;
  padding: 10px;
  border: 1px solid color-mix(in srgb, var(--warning-color, #d88900) 24%, var(--divider-color));
  border-radius: 9px;
  color: var(--warning-color, #d88900);
  background: color-mix(in srgb, var(--warning-color, #d88900) 8%, transparent);
}

.detail-source-warning > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.detail-source-warning strong {
  color: var(--primary-text-color);
  font-size: 12px;
}

.detail-source-warning span {
  color: var(--comment-text-color);
  font-size: 11px;
  line-height: 1.45;
}

.detail-action-hint,
.source-management-hint {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: 14px;
  color: var(--comment-text-color);
  font-size: 11px;
  line-height: 1.45;
}

.detail-action-hint svg,
.source-management-hint svg {
  flex: 0 0 auto;
  margin-top: 2px;
  color: var(--primary-color);
}

.detail-actions {
  justify-content: flex-end;
  margin-top: 0;
  padding: 12px 20px calc(14px + var(--safe-area-bottom, 0px));
  border-top: 1px solid var(--divider-color);
  background: var(--popup-color);
}

.detail-actions .details-button:disabled,
.source-item-actions .details-button:disabled,
.source-form-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.source-panel {
  display: flex;
  max-height: inherit;
  flex-direction: column;
  overflow: hidden;
  color: var(--second-text-color);
  background: var(--popup-color);
}

.source-panel-header {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 20px 14px;
  border-bottom: 1px solid var(--divider-color);
}

.source-panel-header h2 {
  margin: 0;
  color: var(--primary-text-color);
  font-size: 17px;
}

.source-panel-header p {
  max-width: 520px;
  margin: 5px 0 0;
  color: var(--comment-text-color);
  font-size: 11px;
  line-height: 1.5;
}

.source-auth-panel {
  padding: 13px 20px;
  border-bottom: 1px solid var(--divider-color);
  background: color-mix(in srgb, var(--primary-color) 5%, var(--popup-color));
}

.source-auth-copy {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  color: var(--primary-color);
}

.source-auth-copy > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.source-auth-copy strong {
  color: var(--primary-text-color);
  font-size: 12px;
}

.source-auth-copy span {
  color: var(--comment-text-color);
  font-size: 11px;
  line-height: 1.45;
}

.source-auth-panel .token-row {
  margin-top: 10px;
}

.source-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.75fr);
  gap: 10px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--divider-color);
}

.source-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
  color: var(--primary-text-color);
  font-size: 11px;
  font-weight: 600;
}

.source-field em {
  color: var(--lowest-text-color);
  font-size: 10px;
  font-style: normal;
  font-weight: 400;
}

.source-field input {
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  padding: 8px 9px;
  outline: 0;
  color: var(--primary-text-color);
  background: var(--card-color);
  font-size: 12px;
  font-weight: 400;
}

.source-field input:focus {
  border-color: var(--primary-color);
}

.source-field-error {
  grid-column: 1 / -1;
  margin: -2px 0 0;
  font-size: 11px;
  line-height: 1.4;
}

.source-field-error { color: var(--danger-color); }

.source-form-actions {
  display: flex;
  grid-column: 1 / -1;
  justify-content: flex-end;
  gap: 7px;
}

.source-form-actions .primary-action,
.source-form-actions .details-button {
  min-height: 32px;
}

.source-error {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin: 14px 20px 0;
  padding: 9px;
  border-radius: 8px;
  color: var(--danger-color);
  background: color-mix(in srgb, var(--danger-color) 8%, transparent);
  font-size: 11px;
  line-height: 1.4;
}

.source-list {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 14px 20px 20px;
}

.source-empty {
  display: flex;
  min-height: 84px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--lowest-text-color);
  font-size: 12px;
}

.source-item {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 10px;
  padding: 11px 0;
  border-bottom: 1px solid var(--divider-color);
}

.source-item:last-child { border-bottom: 0; }

.source-item-icon {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 12%, var(--card-color));
  font-size: 14px;
}

.source-item-copy {
  min-width: 0;
  flex: 1 1 auto;
}

.source-item-title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.source-item-title-row h3 {
  min-width: 0;
  overflow: hidden;
  margin: 0;
  color: var(--primary-text-color);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-item-copy p {
  overflow: hidden;
  margin: 4px 0 0;
  color: var(--comment-text-color);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-item-copy small {
  display: block;
  margin-top: 4px;
  color: var(--lowest-text-color);
  font-size: 10px;
}

.source-item-meta {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 3px 10px;
}

.source-item-meta small {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
}

.source-item-copy .source-item-error { color: var(--danger-color); }

.source-item-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 5px;
}

.source-item-actions .details-button {
  display: inline-flex;
  width: 30px;
  min-height: 30px;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.source-delete-button:not(:disabled) { color: var(--danger-color); }

/* NutUI applies the popup class to the fixed shell. Keep the shell itself
 * from becoming a second scroll container; the inner panes own scrolling. */
:global(.extension-detail-popup),
:global(.extension-add-popup),
:global(.extension-sources-popup),
:global(.extension-local-popup) {
  overflow: hidden !important;
  border-radius: var(--item-card-radios) !important;
  background: var(--popup-color) !important;
}

:global(.extension-sources-popup.popup-bottom),
:global(.extension-add-popup.popup-bottom),
:global(.extension-detail-popup.popup-bottom),
:global(.extension-local-popup.popup-bottom) {
  border-radius: var(--item-card-radios) var(--item-card-radios) 0 0 !important;
}

:global(.extension-store-confirm-overlay) {
  z-index: 13000 !important;
}

:global(.extension-store-confirm-dialog) {
  z-index: 13001 !important;
}

@keyframes extension-spin {
  to { transform: rotate(360deg); }
}

@keyframes extension-app-wiggle {
  from { transform: rotate(-1.3deg); }
  to { transform: rotate(1.3deg); }
}

@media screen and (max-width: 767px) {
  .extension-store-page { padding-top: 10px; }
  .source-form { grid-template-columns: minmax(0, 1fr); }
  .source-form-actions { justify-content: stretch; }
  .source-form-actions > button { flex: 1 1 0; }
  .detail-actions { flex-wrap: wrap; }
  .detail-actions .detail-uninstall-button { margin-right: 0; }
  .extension-add-shortcut { flex: 1 1 0; }
}

@media screen and (max-width: 599px) {
  .extension-store-page {
    padding-top: 6px;
  }

  .extension-app-grid {
    width: 100%;
    box-sizing: border-box;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 22px 8px;
    padding: 12px 2px 24px;
  }

  .extension-add-scroll {
    padding-right: 16px;
    padding-left: 16px;
  }

  .extension-add-item {
    grid-template-columns: 44px minmax(0, 1fr) auto;
  }

  .extension-add-item-icon {
    width: 44px;
    height: 44px;
  }
}

@media screen and (max-width: 420px) {
  .detail-facts { grid-template-columns: minmax(0, 1fr); }
  .release-item {
    align-items: stretch;
    flex-direction: column;
  }
  .release-action { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .extension-app-grid.managing .extension-app-icon-shell { animation: none; }
  .button-spinner { animation: none; }
}
</style>
