<template>
  <div class="flex flex-col h-full min-h-0 w-full">
    <Tabbed v-model:active-index="activeIndex">
      <TabPanel header="Timeline" :pt="panelPt">
        <Timeline v-if="store.selectedRequest" @navigate="onTimelineNavigate" />
      </TabPanel>
      <TabPanel header="Params" :pt="panelPt">
        <ActionParams v-if="store.selectedRequest" />
      </TabPanel>
      <TabPanel header="Rendering" :pt="panelPt">
        <ActionViewRenders v-if="store.selectedRequest" />
      </TabPanel>
      <TabPanel header="Database" :pt="panelPt">
        <ActiveRecordQueries v-if="store.selectedRequest" />
      </TabPanel>
      <TabPanel header="Cache" :pt="panelPt">
        <Cache v-if="store.selectedRequest" />
      </TabPanel>
      <TabPanel header="Log" :pt="panelPt">
        <LogView v-if="store.selectedRequest" />
      </TabPanel>
      <TabPanel header="Error" :pt="errorPanelPt">
        <Exception v-if="store.selectedRequest" />
      </TabPanel>
    </Tabbed>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import TabPanel from 'primevue/tabpanel';
import Tabbed from './wrappers/Tabbed.vue'
import Timeline from './Timeline.vue';
import ActiveRecordQueries from './ActiveRecordQueries.vue';
import ActionViewRenders from './ActionViewRenders.vue';
import ActionParams from './ActionParams.vue';
import Cache from './Cache.vue';
import LogView from './LogView.vue';
import { useEventsStore } from '../stores/events';
import Exception from './Exception.vue';

const TAB = {
  timeline: 0,
  params: 1,
  rendering: 2,
  database: 3,
  cache: 4,
  log: 5,
  error: 6,
}

const CATEGORY_TAB = {
  view: TAB.rendering,
  db: TAB.database,
  cache: TAB.cache,
  error: TAB.error,
}

const store = useEventsStore()
const activeIndex = ref(TAB.timeline)

function onTimelineNavigate(payload) {
  const category = typeof payload === 'string' ? payload : payload?.category
  const keys = typeof payload === 'string' ? [] : (payload?.highlightKeys || [])
  const index = CATEGORY_TAB[category]
  if (index == null) return
  store.setDetailHighlight(keys)
  activeIndex.value = index
}

const panelPt = {
  content: 'h-full min-h-0 overflow-hidden flex flex-col'
}

const errorPanelPt = {
  content: 'h-full min-h-0 overflow-hidden flex flex-col',
  headerAction: ({ context }) => ({
    class: context?.active
      ? [
          '!border-red-600 dark:!border-red-500',
          '!text-red-600 dark:!text-red-400',
          'focus-visible:!ring-red-500 dark:focus-visible:!ring-red-400',
        ]
      : undefined
  })
}
</script>
