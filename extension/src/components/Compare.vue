<template>
  <div class="h-full min-h-0 overflow-auto p-3 space-y-4 text-sm">
    <div
      v-if="!result"
      class="flex items-center justify-center h-full min-h-[8rem]
             text-surface-500 dark:text-surface-400 text-xs"
    >
      Pick two requests with Compare (A = baseline, B = after).
    </div>

    <template v-else>
      <!-- Action mismatch warning -->
      <div
        v-if="!result.sameAction"
        class="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px]
               text-amber-900 dark:text-amber-200"
      >
        Comparing different actions:
        <span class="font-semibold">{{ result.a.action }}</span>
        vs
        <span class="font-semibold">{{ result.b.action }}</span>
      </div>

      <!-- One-line summary -->
      <div
        class="rounded border border-surface-200 dark:border-surface-700
               bg-surface-50 dark:bg-surface-900/40 px-2.5 py-1.5
               text-[12px] leading-snug text-surface-800 dark:text-surface-100"
        :title="result.summary.text"
      >
        <span class="font-semibold mr-1">B − A</span>
        <span :class="deltaClass(result.totalDelta)">{{ result.summary.text }}</span>
      </div>

      <!-- Header -->
      <div class="flex flex-wrap items-start gap-3 justify-between">
        <div class="min-w-0 flex-1 space-y-1.5">
          <div class="flex flex-wrap items-center gap-2 min-w-0">
            <span
              class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide
                     bg-surface-200 text-surface-800 dark:bg-surface-600 dark:text-surface-100"
            >A</span>
            <span class="font-semibold truncate" :title="result.a.action">{{ result.a.action }}</span>
            <span class="text-surface-500 dark:text-surface-400 tabular-nums">
              {{ result.a.status }} · {{ formatMs(result.a.duration) }}
            </span>
            <span
              v-if="result.a.isExternal"
              class="shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase
                     bg-fuchsia-500/20 text-fuchsia-800 dark:text-fuchsia-200
                     ring-1 ring-fuchsia-500/40"
            >ext</span>
          </div>
          <div class="flex flex-wrap items-center gap-2 min-w-0">
            <span
              class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide
                     bg-primary-500/20 text-primary-800 dark:text-primary-200
                     ring-1 ring-primary-500/35"
            >B</span>
            <span class="font-semibold truncate" :title="result.b.action">{{ result.b.action }}</span>
            <span class="text-surface-500 dark:text-surface-400 tabular-nums">
              {{ result.b.status }} · {{ formatMs(result.b.duration) }}
            </span>
            <span
              v-if="result.b.isExternal"
              class="shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase
                     bg-fuchsia-500/20 text-fuchsia-800 dark:text-fuchsia-200
                     ring-1 ring-fuchsia-500/40"
            >ext</span>
          </div>
        </div>

        <div class="shrink-0 flex flex-col items-end gap-1.5">
          <div
            class="text-lg font-bold tabular-nums leading-none"
            :class="deltaClass(result.totalDelta)"
            :title="`B − A = ${formatSignedMs(result.totalDelta)} (${formatSignedPct(result.totalDeltaPct)})`"
          >
            {{ formatSignedMs(result.totalDelta) }}
            <span class="text-sm font-semibold opacity-80">
              ({{ formatSignedPct(result.totalDeltaPct) }})
            </span>
          </div>
          <div class="flex flex-wrap justify-end gap-1">
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium
                     cursor-pointer select-none transition-colors
                     text-surface-600 dark:text-surface-300
                     hover:bg-surface-100 dark:hover:bg-surface-700"
              title="Select request A and open Params"
              @click="openSide('A', 'params')"
            >
              Open A
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium
                     cursor-pointer select-none transition-colors
                     text-surface-600 dark:text-surface-300
                     hover:bg-surface-100 dark:hover:bg-surface-700"
              title="Select request B and open Params"
              @click="openSide('B', 'params')"
            >
              Open B
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium
                     cursor-pointer select-none transition-colors
                     text-surface-600 dark:text-surface-300
                     hover:bg-surface-100 dark:hover:bg-surface-700"
              title="Copy compare summary as text"
              @click="onCopyText"
            >
              <i class="pi pi-copy text-[10px]"></i>
              Copy
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium
                     cursor-pointer select-none transition-colors
                     text-surface-600 dark:text-surface-300
                     hover:bg-surface-100 dark:hover:bg-surface-700"
              title="Download compare JSON"
              @click="onExportJson"
            >
              <i class="pi pi-download text-[10px]"></i>
              Export
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium
                     cursor-pointer select-none transition-colors
                     text-surface-600 dark:text-surface-300
                     hover:bg-surface-100 dark:hover:bg-surface-700"
              title="Swap A and B"
              @click="store.swapCompare()"
            >
              <i class="pi pi-arrow-right-arrow-left text-[10px]"></i>
              Swap
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium
                     cursor-pointer select-none transition-colors
                     text-surface-600 dark:text-surface-300
                     hover:bg-surface-100 dark:hover:bg-surface-700"
              title="Clear compare slots"
              @click="store.clearCompare()"
            >
              Clear
            </button>
          </div>
          <div
            v-if="ioMessage"
            class="text-[10px]"
            :class="ioError ? 'text-red-600 dark:text-red-400' : 'text-surface-500 dark:text-surface-400'"
          >
            {{ ioMessage }}
          </div>
        </div>
      </div>

      <!-- Quick open tabs -->
      <div class="flex flex-wrap gap-1 text-[10px]">
        <span class="text-surface-500 dark:text-surface-400 self-center mr-1">Jump:</span>
        <button
          v-for="jump in jumpTabs"
          :key="jump.tab"
          type="button"
          class="rounded px-1.5 py-0.5 font-medium cursor-pointer
                 text-surface-600 dark:text-surface-300
                 hover:bg-surface-100 dark:hover:bg-surface-700"
          :title="`Open A → ${jump.label}`"
          @click="openSide('A', jump.tab)"
        >A {{ jump.label }}</button>
        <button
          v-for="jump in jumpTabs"
          :key="'b-' + jump.tab"
          type="button"
          class="rounded px-1.5 py-0.5 font-medium cursor-pointer
                 text-primary-700 dark:text-primary-300
                 hover:bg-primary-500/10"
          :title="`Open B → ${jump.label}`"
          @click="openSide('B', jump.tab)"
        >B {{ jump.label }}</button>
      </div>

      <!-- Stacked bars -->
      <div class="space-y-2">
        <div
          v-for="row in barRows"
          :key="row.slot"
          class="flex items-center gap-2"
        >
          <span
            class="w-4 shrink-0 text-[10px] font-bold text-center"
            :class="row.slot === 'A'
              ? 'text-surface-600 dark:text-surface-300'
              : 'text-primary-700 dark:text-primary-300'"
          >{{ row.slot }}</span>
          <div
            class="flex-1 min-w-0 h-4 rounded-sm overflow-hidden flex
                   bg-surface-200/80 dark:bg-surface-700/80"
            :title="row.title"
          >
            <div
              v-for="seg in row.segments"
              :key="seg.key"
              class="h-full"
              :class="seg.barClass"
              :style="{ width: seg.pct + '%' }"
              :title="`${seg.label}: ${formatMs(seg.ms)}`"
            />
          </div>
          <span class="w-16 shrink-0 text-right tabular-nums text-[11px] text-surface-600 dark:text-surface-300">
            {{ formatMs(row.total) }}
          </span>
        </div>
        <div class="flex flex-wrap gap-3 text-[10px] text-surface-500 dark:text-surface-400 pl-6">
          <span class="inline-flex items-center gap-1">
            <span class="w-2 h-2 rounded-sm bg-amber-500" /> View
          </span>
          <span class="inline-flex items-center gap-1">
            <span class="w-2 h-2 rounded-sm bg-sky-500" /> DB
          </span>
          <span class="inline-flex items-center gap-1">
            <span class="w-2 h-2 rounded-sm bg-emerald-500" /> Cache
          </span>
          <span class="inline-flex items-center gap-1">
            <span class="w-2 h-2 rounded-sm bg-surface-400" /> Other
          </span>
        </div>
      </div>

      <!-- Waterfall sync -->
      <div class="space-y-2">
        <h3 class="text-xs font-bold uppercase tracking-wide text-surface-600 dark:text-surface-300">
          Waterfall sync
          <span class="font-normal normal-case tracking-normal text-surface-400">
            (same scale · top-level spans)
          </span>
        </h3>
        <div class="space-y-1.5">
          <div
            v-for="lane in waterfallLanes"
            :key="lane.slot"
            class="flex items-center gap-2"
          >
            <span
              class="w-4 shrink-0 text-[10px] font-bold text-center"
              :class="lane.slot === 'A'
                ? 'text-surface-600 dark:text-surface-300'
                : 'text-primary-700 dark:text-primary-300'"
            >{{ lane.slot }}</span>
            <div
              class="relative flex-1 min-w-0 h-7 rounded-sm overflow-hidden
                     bg-surface-200/80 dark:bg-surface-700/80
                     ring-1 ring-surface-200 dark:ring-surface-600"
            >
              <div
                v-for="span in lane.spans"
                :key="lane.slot + span.id"
                class="absolute top-1 bottom-1 rounded-[2px] opacity-90"
                :class="span.barClass"
                :style="{ left: span.leftPct + '%', width: span.widthPct + '%' }"
                :title="`${span.label} · ${formatMs(span.durationMs)} @ ${formatMs(span.startMs)}`"
              />
              <div
                v-if="!lane.spans.length"
                class="absolute inset-0 flex items-center justify-center text-[10px]
                       text-surface-400 dark:text-surface-500"
              >
                no spans
              </div>
            </div>
          </div>
          <div class="flex justify-between pl-6 pr-0 text-[10px] tabular-nums text-surface-400">
            <span>0</span>
            <span>{{ formatMs(result.scaleMs / 2) }}</span>
            <span>{{ formatMs(result.scaleMs) }}</span>
          </div>
        </div>
      </div>

      <!-- Metrics table -->
      <div class="overflow-x-auto rounded border border-surface-200 dark:border-surface-700">
        <table class="w-full text-left text-[12px] border-collapse">
          <thead>
            <tr class="bg-surface-50 dark:bg-surface-900/60 text-surface-600 dark:text-surface-300">
              <th class="px-2 py-1.5 font-semibold">Metric</th>
              <th class="px-2 py-1.5 font-semibold text-right">A</th>
              <th class="px-2 py-1.5 font-semibold text-right">B</th>
              <th class="px-2 py-1.5 font-semibold text-right">Δ</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in result.metrics"
              :key="row.key"
              class="border-t border-surface-200 dark:border-surface-700"
            >
              <td class="px-2 py-1">{{ row.label }}</td>
              <td class="px-2 py-1 text-right tabular-nums">{{ formatMetric(row.a, row.unit) }}</td>
              <td class="px-2 py-1 text-right tabular-nums">{{ formatMetric(row.b, row.unit) }}</td>
              <td
                class="px-2 py-1 text-right tabular-nums font-medium"
                :class="deltaClass(row.delta)"
              >
                {{ formatMetricDelta(row) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Params diff -->
      <CompareSection
        v-model="sectionOpen.params"
        title="Params"
        :count-label="`${filteredParams.length}/${visibleParamsBase.length}`"
      >
        <template #actions>
          <label
            class="inline-flex items-center gap-1 text-[10px] text-surface-600 dark:text-surface-300
                   cursor-pointer select-none"
          >
            <input v-model="hideFrameworkParams" type="checkbox" class="accent-primary-500" />
            Hide framework
          </label>
          <div class="inline-flex flex-wrap gap-0.5 rounded border border-surface-200 dark:border-surface-700 p-0.5">
            <button
              v-for="opt in paramFilters"
              :key="opt.key"
              type="button"
              class="rounded px-1.5 py-0.5 text-[10px] font-medium cursor-pointer select-none transition-colors"
              :class="paramFilter === opt.key
                ? 'bg-primary-500/15 text-primary-800 dark:text-primary-200'
                : 'text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700'"
              @click="paramFilter = opt.key"
            >
              {{ opt.label }}
            </button>
          </div>
        </template>

        <div
          v-if="!visibleParamsBase.length"
          class="text-xs text-surface-500 dark:text-surface-400 py-3 text-center"
        >
          No params on either request.
        </div>
        <div
          v-else-if="!filteredParams.length"
          class="text-xs text-surface-500 dark:text-surface-400 py-3 text-center"
        >
          No params match this filter.
        </div>
        <div
          v-else
          class="overflow-x-auto rounded border border-surface-200 dark:border-surface-700"
        >
          <table class="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr class="bg-surface-50 dark:bg-surface-900/60 text-surface-600 dark:text-surface-300">
                <th class="px-2 py-1.5 font-semibold w-16">Side</th>
                <th class="px-2 py-1.5 font-semibold">Name</th>
                <th class="px-2 py-1.5 font-semibold">A</th>
                <th class="px-2 py-1.5 font-semibold">B</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in filteredParams"
                :key="'p-' + row.name"
                class="border-t border-surface-200 dark:border-surface-700 align-top
                       cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/60"
                title="Open Params on the matching request"
                @click="openDiffRow('params', row)"
              >
                <td class="px-2 py-1.5">
                  <span
                    class="inline-block rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide"
                    :class="paramSideBadgeClass(row)"
                  >{{ paramSideLabel(row) }}</span>
                </td>
                <td class="px-2 py-1.5 font-semibold break-all">
                  {{ row.name }}
                  <span
                    v-if="row.isFramework"
                    class="ml-1 text-[9px] font-normal text-surface-400 whitespace-nowrap"
                  >fw</span>
                </td>
                <td class="px-2 py-1.5 min-w-0 w-[40%]">
                  <pre
                    class="m-0 max-h-40 overflow-auto whitespace-pre-wrap break-words
                           font-mono text-[10px] leading-snug"
                    :title="paramTitle(row.rawA, row.valueA)"
                    v-html="prettyParam(row.rawA, row.valueA)"
                  ></pre>
                </td>
                <td class="px-2 py-1.5 min-w-0 w-[40%]">
                  <pre
                    class="m-0 max-h-40 overflow-auto whitespace-pre-wrap break-words
                           font-mono text-[10px] leading-snug"
                    :class="row.side === 'changed' ? 'ring-1 ring-inset ring-amber-500/25 rounded-sm px-0.5' : ''"
                    :title="paramTitle(row.rawB, row.valueB)"
                    v-html="prettyParam(row.rawB, row.valueB)"
                  ></pre>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CompareSection>

      <!-- SQL diff -->
      <CompareSection
        v-model="sectionOpen.sql"
        title="SQL patterns"
        :count-label="`${filteredSql.length}/${result.sqlDiff.length}`"
      >
        <template #actions>
          <div class="inline-flex flex-wrap gap-0.5 rounded border border-surface-200 dark:border-surface-700 p-0.5">
            <button
              v-for="opt in sqlFilters"
              :key="opt.key"
              type="button"
              class="rounded px-1.5 py-0.5 text-[10px] font-medium cursor-pointer select-none transition-colors"
              :class="sqlFilter === opt.key
                ? 'bg-primary-500/15 text-primary-800 dark:text-primary-200'
                : 'text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700'"
              @click="sqlFilter = opt.key"
            >
              {{ opt.label }}
            </button>
          </div>
        </template>

        <div
          v-if="!result.sqlDiff.length"
          class="text-xs text-surface-500 dark:text-surface-400 py-4 text-center"
        >
          No SQL patterns on either request.
        </div>
        <div
          v-else-if="!filteredSql.length"
          class="text-xs text-surface-500 dark:text-surface-400 py-4 text-center"
        >
          No SQL patterns match this filter.
        </div>
        <CompareTimedDiffTable
          v-else
          :value="sqlTableRows"
          state-key="rp-compare-sql-v1"
          item-header="Pattern"
          item-field="pattern"
          title="Click a row to open it in Database (B when both sides)"
          @row-click="(row) => openDiffRow('sql', row)"
        >
          <template #side="{ data }">
            <div class="inline-flex items-center gap-1.5 flex-nowrap">
              <span
                class="shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide"
                :class="sideBadgeClass(data)"
              >{{ sideLabel(data) }}</span>
              <span
                v-if="data.isNPlusOne"
                class="shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase
                       bg-amber-500/20 text-amber-800 dark:text-amber-300
                       ring-1 ring-amber-500/35"
              >N+1</span>
              <span
                v-if="data.likelyFilterDriven"
                class="shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase
                       bg-violet-500/15 text-violet-800 dark:text-violet-200
                       ring-1 ring-violet-500/30"
                :title="`Likely filter-driven · params: ${(data.relatedParams || []).join(', ')}`"
              >F?</span>
            </div>
          </template>
          <template #item="{ data }">
            <div class="min-w-0 space-y-0.5" :title="data.sample || data.pattern">
              <div
                v-if="data.type"
                class="text-[10px] font-medium text-surface-500 dark:text-surface-400"
              >{{ data.type }}</div>
              <pre
                class="hljs min-w-0 whitespace-pre-wrap break-words
                       font-mono text-[10px] leading-snug m-0 bg-transparent"
                v-html="highlightSql(data.sample || data.pattern)"
              ></pre>
            </div>
          </template>
        </CompareTimedDiffTable>
      </CompareSection>

      <!-- Cache diff -->
      <CompareSection
        v-model="sectionOpen.cache"
        title="Cache keys"
        :count-label="`${filteredCache.length}/${result.cacheDiff.length}`"
      >
        <template #actions>
          <div class="inline-flex flex-wrap gap-0.5 rounded border border-surface-200 dark:border-surface-700 p-0.5">
            <button
              v-for="opt in cacheFilters"
              :key="opt.key"
              type="button"
              class="rounded px-1.5 py-0.5 text-[10px] font-medium cursor-pointer select-none transition-colors"
              :class="cacheFilter === opt.key
                ? 'bg-primary-500/15 text-primary-800 dark:text-primary-200'
                : 'text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700'"
              @click="cacheFilter = opt.key"
            >
              {{ opt.label }}
            </button>
          </div>
        </template>

        <div
          v-if="!result.cacheDiff.length"
          class="text-xs text-surface-500 dark:text-surface-400 py-3 text-center"
        >
          No cache calls on either request.
        </div>
        <div
          v-else-if="!filteredCache.length"
          class="text-xs text-surface-500 dark:text-surface-400 py-3 text-center"
        >
          No rows match this filter.
        </div>
        <CompareTimedDiffTable
          v-else
          :value="cacheTableRows"
          state-key="rp-compare-cache-v1"
          item-header="Key"
          item-field="key"
          show-hits
          title="Click a row to open it in Cache"
          @row-click="(row) => openDiffRow('cache', row)"
        >
          <template #side="{ data }">
            <div class="inline-flex items-center gap-1.5 flex-nowrap">
              <span
                class="shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide"
                :class="sideBadgeClass(data)"
              >{{ sideLabel(data) }}</span>
              <span
                v-if="data.hitChanged"
                class="shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase
                       bg-emerald-500/15 text-emerald-800 dark:text-emerald-200
                       ring-1 ring-emerald-500/30"
              >hitΔ</span>
            </div>
          </template>
          <template #item="{ data }">
            <div class="min-w-0 space-y-0.5" :title="data.key">
              <div
                v-if="data.kind || data.typeSummary"
                class="text-[10px] font-medium text-surface-500 dark:text-surface-400"
              >{{ data.kind || data.typeSummary }}</div>
              <code
                class="block min-w-0 whitespace-pre-wrap break-all
                       font-mono text-[10px] leading-snug
                       text-surface-800 dark:text-surface-200"
              >{{ data.key }}</code>
            </div>
          </template>
        </CompareTimedDiffTable>
      </CompareSection>

      <!-- Views diff -->
      <CompareSection
        v-model="sectionOpen.views"
        title="Views / partials"
        :count-label="`${filteredViews.length}/${result.viewDiff.length}`"
      >
        <template #actions>
          <div class="inline-flex flex-wrap gap-0.5 rounded border border-surface-200 dark:border-surface-700 p-0.5">
            <button
              v-for="opt in timedFilters"
              :key="opt.key"
              type="button"
              class="rounded px-1.5 py-0.5 text-[10px] font-medium cursor-pointer select-none transition-colors"
              :class="viewFilter === opt.key
                ? 'bg-primary-500/15 text-primary-800 dark:text-primary-200'
                : 'text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700'"
              @click="viewFilter = opt.key"
            >
              {{ opt.label }}
            </button>
          </div>
        </template>

        <div
          v-if="!result.viewDiff.length"
          class="text-xs text-surface-500 dark:text-surface-400 py-3 text-center"
        >
          No views on either request.
        </div>
        <div
          v-else-if="!filteredViews.length"
          class="text-xs text-surface-500 dark:text-surface-400 py-3 text-center"
        >
          No rows match this filter.
        </div>
        <CompareTimedDiffTable
          v-else
          :value="viewTableRows"
          state-key="rp-compare-views-v1"
          item-header="Template"
          item-field="path"
          title="Click a row to open it in Rendering"
          @row-click="(row) => openDiffRow('view', row)"
        >
          <template #item="{ data }">
            <div class="min-w-0 space-y-0.5" :title="data.path">
              <div
                v-if="data.kind || data.typeSummary"
                class="text-[10px] font-medium text-surface-500 dark:text-surface-400"
              >{{ data.kind || data.typeSummary }}</div>
              <div class="min-w-0 break-all leading-snug">
                <FilepathLink :filepath="data.path" :truncate="false" />
              </div>
            </div>
          </template>
        </CompareTimedDiffTable>
      </CompareSection>

      <!-- Exception diff -->
      <CompareSection
        v-model="sectionOpen.exceptions"
        title="Exceptions"
        tone="danger"
        :count-label="`${filteredExceptions.length}/${result.exceptionDiff.length}`"
      >
        <template #actions>
          <div
            class="inline-flex flex-wrap gap-0.5 rounded border p-0.5
                   border-red-500/35 dark:border-red-500/40"
          >
            <button
              v-for="opt in countFilters"
              :key="opt.key"
              type="button"
              class="rounded px-1.5 py-0.5 text-[10px] font-medium cursor-pointer select-none transition-colors"
              :class="exceptionFilter === opt.key
                ? 'bg-red-500/15 text-red-800 dark:text-red-200'
                : 'text-red-700 dark:text-red-300 hover:bg-red-500/10'"
              @click="exceptionFilter = opt.key"
            >
              {{ opt.label }}
            </button>
          </div>
        </template>

        <div
          v-if="!result.exceptionDiff.length"
          class="text-xs text-red-600/70 dark:text-red-400/70 py-3 text-center"
        >
          No exceptions on either request.
        </div>
        <div
          v-else-if="!filteredExceptions.length"
          class="text-xs text-red-600/70 dark:text-red-400/70 py-3 text-center"
        >
          No rows match this filter.
        </div>
        <div
          v-else
          class="overflow-x-auto rounded border
                 border-red-500/35 dark:border-red-500/40 bg-red-600/5 dark:bg-red-500/10"
        >
          <table class="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr class="bg-red-600 dark:bg-red-500 text-white">
                <th class="px-2 py-1.5 font-semibold w-14">Side</th>
                <th class="px-2 py-1.5 font-semibold">Message</th>
                <th class="px-2 py-1.5 font-semibold text-right whitespace-nowrap">Count</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, idx) in filteredExceptions"
                :key="'ex-' + row.label + idx"
                class="align-top cursor-pointer border-t border-red-500/20 dark:border-red-400/20
                       hover:bg-red-500/10"
                title="Click to open in Error"
                @click="openDiffRow('exception', row)"
              >
                <td class="px-2 py-1.5">
                  <span
                    class="inline-block rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide"
                    :class="exceptionSideBadgeClass(row)"
                  >{{ sideLabel(row) }}</span>
                </td>
                <td class="px-2 py-1.5 min-w-0">
                  <code
                    class="block font-mono text-[10px] leading-snug whitespace-pre-wrap break-words
                           text-red-800 dark:text-red-200"
                    :title="stripAnsi(row.sample || row.label || '')"
                    v-html="ansiToHtml(row.sample || row.label || '')"
                  ></code>
                </td>
                <td class="px-2 py-1.5 text-right tabular-nums whitespace-nowrap text-red-800 dark:text-red-200">
                  <span>{{ row.countA }} → {{ row.countB }}</span>
                  <div
                    class="text-[10px] font-medium"
                    :class="row.deltaCount > 0
                      ? 'text-red-700 dark:text-red-300'
                      : row.deltaCount < 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-500/70 dark:text-red-400/60'"
                  >{{ formatSignedCount(row.deltaCount) }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CompareSection>
    </template>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import hljs from 'highlight.js/lib/core'
import sql from 'highlight.js/lib/languages/sql'
import { prettyPrintJson } from 'pretty-print-json'
import { useEventsStore } from '../stores/events'
import { useSettingsStore } from '../stores/settings'
import { copyText } from './utils/clipboard'
import { ansiToHtml, stripAnsi } from './utils/ansi'
import CompareTimedDiffTable from './CompareTimedDiffTable.vue'
import CompareSection from './CompareSection.vue'
import FilepathLink from './FilepathLink.vue'

hljs.registerLanguage('sql', sql)

const prettyOptions = {
  indent: 2,
  quoteKeys: true,
  quoteStyle: 'double',
  trailingCommas: false,
  linkUrls: false,
}

const store = useEventsStore()
const settings = useSettingsStore()
const sqlFilter = ref('diff')
const paramFilter = ref('diff')
const cacheFilter = ref('diff')
const viewFilter = ref('diff')
const exceptionFilter = ref('diff')
const hideFrameworkParams = ref(true)
const sectionOpen = reactive({
  params: true,
  sql: true,
  cache: true,
  views: true,
  exceptions: true,
})
const ioMessage = ref('')
const ioError = ref(false)
let ioTimer = null

const jumpTabs = [
  { tab: 'timeline', label: 'Timeline' },
  { tab: 'params', label: 'Params' },
  { tab: 'database', label: 'DB' },
  { tab: 'rendering', label: 'Views' },
  { tab: 'cache', label: 'Cache' },
  { tab: 'log', label: 'Log' },
  { tab: 'error', label: 'Error' },
]

const sqlFilters = [
  { key: 'diff', label: 'Diff' },
  { key: 'all', label: 'All' },
  { key: 'added', label: 'Added' },
  { key: 'removed', label: 'Removed' },
  { key: 'slower', label: 'Slower' },
  { key: 'faster', label: 'Faster' },
  { key: 'n1', label: 'N+1' },
  { key: 'filter', label: 'Filter?' },
]

const paramFilters = [
  { key: 'diff', label: 'Diff' },
  { key: 'all', label: 'All' },
  { key: 'changed', label: 'Changed' },
  { key: 'added', label: 'Added' },
  { key: 'removed', label: 'Removed' },
]

const timedFilters = [
  { key: 'diff', label: 'Diff' },
  { key: 'all', label: 'All' },
  { key: 'added', label: 'Added' },
  { key: 'removed', label: 'Removed' },
  { key: 'slower', label: 'Slower' },
  { key: 'faster', label: 'Faster' },
]

const cacheFilters = [
  ...timedFilters,
  { key: 'hits', label: 'Hits' },
]

const countFilters = [
  { key: 'diff', label: 'Diff' },
  { key: 'all', label: 'All' },
  { key: 'added', label: 'Added' },
  { key: 'removed', label: 'Removed' },
]

const result = computed(() => store.compareResult)

const barRows = computed(() => {
  const r = result.value
  if (!r) return []
  const scale = r.scaleMs || 1
  const build = (slot, segments, total) => {
    const segs = segments
      .filter((s) => s.ms > 0.0005)
      .map((s) => ({
        ...s,
        pct: Math.max(0, Math.min(100, (s.ms / scale) * 100)),
      }))
    return {
      slot,
      segments: segs,
      total,
      title: segs.map((s) => `${s.label} ${formatMs(s.ms)}`).join(' · '),
    }
  }
  return [
    build('A', r.segmentsA, r.a.duration),
    build('B', r.segmentsB, r.b.duration),
  ]
})

const waterfallLanes = computed(() => {
  const r = result.value
  if (!r) return []
  return [
    { slot: 'A', spans: r.waterfallA || [] },
    { slot: 'B', spans: r.waterfallB || [] },
  ]
})

const visibleParamsBase = computed(() => {
  const rows = result.value?.paramsDiff || []
  if (!hideFrameworkParams.value) return rows
  return rows.filter((r) => !r.isFramework)
})

const filteredParams = computed(() => {
  const rows = visibleParamsBase.value
  switch (paramFilter.value) {
    case 'diff':
      return rows.filter((r) => r.side !== 'same')
    case 'changed':
      return rows.filter((r) => r.side === 'changed')
    case 'added':
      return rows.filter((r) => r.side === 'onlyB')
    case 'removed':
      return rows.filter((r) => r.side === 'onlyA')
    default:
      return rows
  }
})

const filteredSql = computed(() => {
  const rows = result.value?.sqlDiff || []
  switch (sqlFilter.value) {
    case 'diff':
      return rows.filter(
        (r) =>
          r.side !== 'both' ||
          r.deltaCount !== 0 ||
          isSignificantTimeDelta(r) ||
          r.isNPlusOneA !== r.isNPlusOneB
      )
    case 'added':
      return rows.filter((r) => r.side === 'onlyB')
    case 'removed':
      return rows.filter((r) => r.side === 'onlyA')
    case 'slower':
      return rows.filter((r) => r.side === 'both' && isSlower(r))
    case 'faster':
      return rows.filter((r) => r.side === 'both' && isFaster(r))
    case 'n1':
      return rows.filter((r) => r.isNPlusOne)
    case 'filter':
      return rows.filter((r) => r.likelyFilterDriven)
    default:
      return rows
  }
})

/** |Δtime| must beat max(ms floor, % of the larger side time). */
function timeDeltaThreshold(row) {
  const ms = Math.max(0, Number(settings.compareDiffMs) || 0)
  const pct = Math.max(0, Number(settings.compareDiffPct) || 0) / 100
  const ref = Math.max(Number(row.timeA) || 0, Number(row.timeB) || 0)
  return Math.max(ms, pct * ref)
}

function isSignificantTimeDelta(row) {
  return Math.abs(Number(row.deltaTime) || 0) > timeDeltaThreshold(row)
}

function isSlower(row) {
  return (Number(row.deltaTime) || 0) > timeDeltaThreshold(row)
}

function isFaster(row) {
  return (Number(row.deltaTime) || 0) < -timeDeltaThreshold(row)
}

function filterTimed(rows, filter) {
  switch (filter) {
    case 'diff':
      return rows.filter(
        (r) =>
          r.side !== 'both' ||
          r.deltaCount !== 0 ||
          isSignificantTimeDelta(r) ||
          r.hitChanged
      )
    case 'added':
      return rows.filter((r) => r.side === 'onlyB')
    case 'removed':
      return rows.filter((r) => r.side === 'onlyA')
    case 'slower':
      return rows.filter((r) => r.side === 'both' && isSlower(r))
    case 'faster':
      return rows.filter((r) => r.side === 'both' && isFaster(r))
    case 'hits':
      return rows.filter((r) => r.hitChanged)
    default:
      return rows
  }
}

function filterCount(rows, filter) {
  switch (filter) {
    case 'diff':
      return rows.filter((r) => r.side !== 'both' || r.deltaCount !== 0)
    case 'added':
      return rows.filter((r) => r.side === 'onlyB')
    case 'removed':
      return rows.filter((r) => r.side === 'onlyA')
    default:
      return rows
  }
}

const filteredCache = computed(() => filterTimed(result.value?.cacheDiff || [], cacheFilter.value))
const filteredViews = computed(() => filterTimed(result.value?.viewDiff || [], viewFilter.value))
const filteredExceptions = computed(() => filterCount(result.value?.exceptionDiff || [], exceptionFilter.value))

function sideRank(side) {
  if (side === 'onlyA') return 0
  if (side === 'both') return 1
  return 2
}

function withTableKeys(rows, prefix) {
  return rows.map((r, i) => ({
    ...r,
    _key: `${prefix}-${i}`,
    _sideRank: sideRank(r.side),
  }))
}

const sqlTableRows = computed(() => withTableKeys(filteredSql.value, 'sql'))
const cacheTableRows = computed(() => withTableKeys(filteredCache.value, 'cache'))
const viewTableRows = computed(() => withTableKeys(filteredViews.value, 'view'))

function flashIo(message, isError = false) {
  clearTimeout(ioTimer)
  ioMessage.value = message
  ioError.value = isError
  ioTimer = setTimeout(() => {
    ioMessage.value = ''
    ioError.value = false
  }, 2500)
}

function openSide(side, tab) {
  store.openCompareSide(side, tab)
}

function openDiffRow(kind, row) {
  store.openCompareDiffRow(kind, row)
}

async function onCopyText() {
  try {
    const text = store.exportCompareText()
    if (!text) {
      flashIo('Nothing to copy', true)
      return
    }
    const ok = await copyText(text)
    flashIo(ok ? 'Copied compare' : 'Copy failed', !ok)
  } catch (err) {
    flashIo(err?.message || 'Copy failed', true)
  }
}

function onExportJson() {
  try {
    const payload = store.exportCompareJson()
    if (!payload) {
      flashIo('Nothing to export', true)
      return
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    a.href = url
    a.download = `rails-panel-compare-${stamp}.json`
    a.click()
    URL.revokeObjectURL(url)
    flashIo('Downloaded JSON')
  } catch (err) {
    flashIo(err?.message || 'Export failed', true)
  }
}

function formatMs(ms) {
  const n = Number(ms) || 0
  if (n <= 0) return '0 ms'
  if (n < 0.1) return '<0.1 ms'
  if (n < 10) return `${n.toFixed(1)} ms`
  return `${Math.round(n)} ms`
}

function formatSignedMs(ms) {
  const n = Number(ms) || 0
  if (Math.abs(n) < 0.05) return '0 ms'
  const sign = n > 0 ? '+' : '−'
  const abs = Math.abs(n)
  if (abs < 10) return `${sign}${abs.toFixed(1)} ms`
  return `${sign}${Math.round(abs)} ms`
}

function formatSignedPct(pct) {
  const n = Number(pct) || 0
  if (Math.abs(n) < 0.05) return '0%'
  const sign = n > 0 ? '+' : '−'
  return `${sign}${Math.abs(n).toFixed(0)}%`
}

function formatSignedCount(n) {
  const v = Number(n) || 0
  if (v === 0) return '0'
  return v > 0 ? `+${v}` : String(v)
}

function formatMetric(value, unit) {
  if (unit === 'count') return String(Math.round(Number(value) || 0))
  return formatMs(value)
}

function formatMetricDelta(row) {
  if (row.unit === 'count') return formatSignedCount(row.delta)
  const ms = formatSignedMs(row.delta)
  if (row.deltaPct == null) return ms
  return `${ms} (${formatSignedPct(row.deltaPct)})`
}

function deltaClass(delta) {
  const n = Number(delta) || 0
  if (Math.abs(n) < 0.05) return 'text-surface-500 dark:text-surface-400'
  if (n < 0) return 'text-emerald-700 dark:text-emerald-400'
  return 'text-red-600 dark:text-red-400'
}

function sideLabel(row) {
  if (row.side === 'onlyA') return 'A'
  if (row.side === 'onlyB') return 'B'
  return 'A-B'
}

function sideBadgeClass(row) {
  if (row.side === 'onlyA') {
    return 'bg-surface-200 text-surface-800 dark:bg-surface-600 dark:text-surface-100'
  }
  if (row.side === 'onlyB') {
    return 'bg-primary-500/20 text-primary-800 dark:text-primary-200 ring-1 ring-primary-500/35'
  }
  return 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-300'
}

function exceptionSideBadgeClass(row) {
  if (row.side === 'onlyA') {
    return 'bg-red-600/15 text-red-800 dark:text-red-200 ring-1 ring-red-500/35'
  }
  if (row.side === 'onlyB') {
    return 'bg-red-600 text-white dark:bg-red-500'
  }
  return 'bg-red-500/10 text-red-700 dark:text-red-300 ring-1 ring-red-500/25'
}

function paramSideLabel(row) {
  if (row.side === 'onlyA') return 'A'
  if (row.side === 'onlyB') return 'B'
  if (row.side === 'changed') return 'changed'
  return 'same'
}

function paramSideBadgeClass(row) {
  if (row.side === 'changed') {
    return 'bg-amber-500/20 text-amber-800 dark:text-amber-300 ring-1 ring-amber-500/35'
  }
  return sideBadgeClass(row)
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function prettyParam(raw, fallback) {
  if (raw === undefined) {
    return `<span class="text-surface-400 dark:text-surface-500">${escapeHtml(fallback || '—')}</span>`
  }
  try {
    if (typeof raw === 'string') {
      try {
        return prettyPrintJson.toHtml(JSON.parse(raw), prettyOptions)
      } catch {
        return escapeHtml(raw)
      }
    }
    return prettyPrintJson.toHtml(raw, prettyOptions)
  } catch {
    return escapeHtml(fallback ?? raw)
  }
}

function paramTitle(raw, fallback) {
  if (raw === undefined) return String(fallback || '')
  try {
    if (typeof raw !== 'string') return JSON.stringify(raw, null, 2)
  } catch { /* ignore */ }
  return String(fallback ?? raw ?? '')
}

function highlightSql(query) {
  const q = String(query || '')
  if (!q) return ''
  try {
    return hljs.highlight(q, { language: 'sql' }).value
  } catch {
    return escapeHtml(q)
  }
}

</script>
