import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { withExclusiveDurations, sumExclusive } from '../components/utils/timing'
import { annotateQueryRepeats, nPlusOneGroups } from '../components/utils/sqlPatterns'
import { useSettingsStore } from './settings'

export const useEventsStore = defineStore('events',  () => {

  const selectedRequest = ref(null);

  // trick to prevent deselecting request
  watch(selectedRequest, (newVal, oldVal) => {
    if (newVal === null && actions.value.size > 0) {
      selectedRequest.value = oldVal;
    }
  })

  // key: requestId, value: event
  const actions = ref(new Map());
  
  // key: requestId, value: [...events]
  const activeRecordQueries = ref(new Map());
  const actionViewRenders = ref(new Map());
  const logEntries = ref(new Map());
  const exceptionStacktraces = ref(new Map());
  const cacheCalls = ref(new Map());
  const timelineSpans = ref(new Map());
  /** Raw meta_request events per request — needed for faithful JSON export. */
  const rawEventsByRequest = ref(new Map());
  // Highlight a detail-tab row after navigating from Timeline
  const detailHighlightKeys = ref([])

  const requests = computed(() => Array.from(actions.value.values()));
  const requestCount = computed(() => actions.value.size);

  function normalizeRequestId(requestId) {
    if (requestId != null && typeof requestId === 'object' && requestId.value != null) {
      return String(requestId.value)
    }
    return String(requestId)
  }

  const selectedActiveRecordQueries = computed(() => {
    if (!selectedRequest.value) return undefined
    return activeRecordQueries.value.get(selectedRequest.value.id)
  });
  const selectedActionViewRenders = computed(() => {
    if (!selectedRequest.value) return undefined
    return actionViewRenders.value.get(selectedRequest.value.id)
  });
  const selectedLogEntries = computed(() => {
    if (!selectedRequest.value) return undefined
    return logEntries.value.get(selectedRequest.value.id)
  });
  const selectedExceptionStacktraces = computed(() => {
    if (!selectedRequest.value) return undefined
    return exceptionStacktraces.value.get(selectedRequest.value.id)
  });
  const selectedCacheCalls = computed(() => {
    if (!selectedRequest.value) return undefined
    return cacheCalls.value.get(selectedRequest.value.id)
  });
  const selectedParams = computed(() => selectedRequest.value?.params);
  const selectedTimeline = computed(() => {
    if (!selectedRequest.value) return null
    return timelineSpans.value.get(selectedRequest.value.id) || null
  });

  function setDetailHighlight(keys) {
    detailHighlightKeys.value = Array.isArray(keys) ? keys.filter(Boolean) : keys ? [keys] : []
  }

  function clearDetailHighlight() {
    detailHighlightKeys.value = []
  }

  function isDetailHighlighted(sourceKey) {
    if (!sourceKey || !detailHighlightKeys.value.length) return false
    return detailHighlightKeys.value.includes(sourceKey)
  }

  function deleteRequestData(requestId) {
    const id = normalizeRequestId(requestId)
    actions.value.delete(id)
    activeRecordQueries.value.delete(id)
    actionViewRenders.value.delete(id)
    logEntries.value.delete(id)
    exceptionStacktraces.value.delete(id)
    cacheCalls.value.delete(id)
    timelineSpans.value.delete(id)
    rawEventsByRequest.value.delete(id)
  }

  function pruneToCap(cap) {
    const max = Math.max(10, Math.round(Number(cap) || 100))
    while (actions.value.size > max) {
      const oldestId = actions.value.keys().next().value
      if (oldestId == null) break
      deleteRequestData(oldestId)
      if (selectedRequest.value?.id === oldestId) {
        const remaining = Array.from(actions.value.values())
        selectedRequest.value = remaining[remaining.length - 1] || null
      }
    }
  }

  function pushEvents(requestId, newEvents, autoReselect = true, options = {}) {
    clearDetailHighlight()
    const settings = useSettingsStore()
    const id = normalizeRequestId(requestId)
    const isExternal = !!options.isExternal
    const actionEvent = newEvents.find((event) => event.name == "process_action.action_controller")
    if (!actionEvent) {
      console.warn('rails_panel: skip request without process_action', id)
      return null
    }
    const status = actionEvent.payload.status || 200
    const hasException = newEvents.some(
      (event) => event.name === 'process_action.action_controller.exception'
    )

    const queries = newEvents.flatMap((event) => {
      if (event.name == "sql.active_record" && event.payload.name != "SCHEMA" && event.payload.name != "EXPLAIN") {
        return [{
          location: event.payload.filename,
          line: event.payload.line,
          type: event.payload.name,
          query: event.payload.sql,
          binds: event.payload.type_casted_binds,
          duration: event.duration,
          time: event.time,
          end: event.end,
          sourceKey: `db:${event.time}`,
        }]
      } else {
        return []
      }
    })

    const annotated = annotateQueryRepeats(queries, { nPlusOneMin: settings.nPlusOneMin })
    const n1Groups = nPlusOneGroups(annotated, { nPlusOneMin: settings.nPlusOneMin })

    const action = {
      id,
      name: "process_action.action_controller",
      status,
      action: actionEvent.payload.controller + "#" + actionEvent.payload.action,
      method: actionEvent.payload.method,
      format: actionEvent.payload.format,
      duration: actionEvent.duration,
      time: actionEvent.time,
      end: actionEvent.end,
      dbRuntime: actionEvent.payload.db_runtime,
      viewRuntime: actionEvent.payload.view_runtime,
      params: Object.entries(actionEvent.payload.params || {}).map(([name, value]) => ({ name, value }) ),
      hasError: status >= 400 || hasException,
      hasException,
      hasNPlusOne: n1Groups.length > 0,
      nPlusOnePatterns: n1Groups.length,
      nPlusOneQueries: n1Groups.reduce((acc, g) => acc + g.count, 0),
      isExternal,
    }
    actions.value.set(id, action);
    
    if (actions.value.size == 1 || autoReselect) {
      selectedRequest.value = action;
    }

    rawEventsByRequest.value.set(id, newEvents)
    activeRecordQueries.value.set(id, queries);

    actionViewRenders.value.set(
      id,
      withExclusiveDurations(
        newEvents.flatMap((event) => {
          if (event.name == "render_template.action_view" || event.name == "render_partial.action_view") {
            return [{
              view: event.payload.identifier,
              layout: event.payload.layout,
              duration: event.duration,
              time: event.time,
              end: event.end,
              kind: event.name === "render_partial.action_view" ? "partial" : "template",
              sourceKey: `view:${event.time}`,
            }]
          } else {
            return []
          }
        })
      )
    );

    logEntries.value.set(id, newEvents.flatMap((event) => {
      if (event.name == "meta_request.log" && event.payload.message) {
        return [{
          filename: event.payload.filename,
          line: event.payload.line,
          message: event.payload.message,
          level: event.payload.level,
        }]
      } else {
        return []
      }        
    }));

    exceptionStacktraces.value.set(id, (() => {
      let errorIndex = 0
      return newEvents.flatMap((event) => {
        if (event.name == "process_action.action_controller.exception") {
          return [{
            trace: event.payload.call,
            sourceKey: `error:${errorIndex++}`,
          }]
        }
        return []
      })
    })());    

    cacheCalls.value.set(id, newEvents.flatMap((event) => {
      if (event.name.startsWith("cache_") && event.name.endsWith(".active_support")) {
        return [{
          type: event.payload.type,
          key: event.payload.key,
          hit: event.payload.hit,
          options: event.payload.options,
          duration: event.duration,
          time: event.time,
          end: event.end,
          filename: event.payload.filename,
          line: event.payload.line,
          sourceKey: `cache:${event.time}`,
        }]
      } else {
        return []
      }        
    }));

    timelineSpans.value.set(id, buildTimeline(actionEvent, newEvents));
    pruneToCap(settings.requestCap)
    return action
  }

  function buildTimeline(actionEvent, events) {
    const origin = Number(actionEvent.time) || 0
    const totalMs = Math.max(
      Number(actionEvent.duration) || 0,
      origin && actionEvent.end ? Number(actionEvent.end) - origin : 0,
      0.001
    )

    const spans = []

    const status = Number(actionEvent.payload.status) || 200
    spans.push({
      id: 'request',
      category: 'request',
      label: `${actionEvent.payload.controller}#${actionEvent.payload.action}`,
      detail: actionEvent.payload.path || '',
      startMs: 0,
      durationMs: totalMs,
      status,
      hasError: status >= 500,
    })

    const sqlEvents = []
    const cacheEvents = []

    for (const event of events) {
      if (!hasTiming(event)) continue

      const startMs = Math.max(0, Number(event.time) - origin)
      const durationMs = Math.max(
        Number(event.duration) || 0,
        event.end ? Number(event.end) - Number(event.time) : 0
      )
      if (durationMs <= 0 && event.name !== 'process_action.action_controller') continue

      if (event.name === 'sql.active_record') {
        if (event.payload.name === 'SCHEMA' || event.payload.name === 'EXPLAIN') continue
        sqlEvents.push({
          name: event.payload.name || 'SQL',
          sql: event.payload.sql || '',
          startMs,
          durationMs,
          endMs: startMs + durationMs,
          sourceKey: `db:${event.time}`,
          ...callerFromPayload(event.payload),
        })
      } else if (
        event.name === 'render_template.action_view' ||
        event.name === 'render_partial.action_view'
      ) {
        const path = event.payload.identifier || ''
        spans.push({
          id: `view-${spans.length}`,
          category: 'view',
          label: basename(path) || path || 'View',
          detail: path,
          startMs,
          durationMs,
          sourceKey: `view:${event.time}`,
          highlightKeys: [`view:${event.time}`],
        })
      } else if (event.name.startsWith('cache_') && event.name.endsWith('.active_support')) {
        const type = event.payload.type || 'cache'
        const key = event.payload.key != null ? String(event.payload.key) : ''
        const hit = event.payload.hit
        let label = type
        if (type === 'read' && hit === true) label = 'read hit'
        else if (type === 'read' && hit === false) label = 'read miss'
        if (key) label = `${label} · ${key}`
        const sourceKey = `cache:${event.time}`
        const caller = callerFromPayload(event.payload)

        cacheEvents.push({
          id: `cache-${cacheEvents.length}`,
          sortKey: 100000 + cacheEvents.length,
          category: 'cache',
          label,
          detail: key
            ? `${type}${hit === true ? ' hit' : hit === false ? ' miss' : ''} · ${key}`
            : String(type),
          startMs,
          durationMs,
          nestDepth: 0,
          sourceKey,
          highlightKeys: [sourceKey],
          groupStartMs: startMs,
          ...caller,
        })
      }
    }

    spans.push(...mergeSqlAndCacheSpans(buildSqlSpans(sqlEvents), cacheEvents))

    const exceptionSpan = buildExceptionSpan(actionEvent, events, totalMs)
    if (exceptionSpan) {
      spans.push(exceptionSpan)
      const requestSpan = spans.find((s) => s.category === 'request')
      if (requestSpan) requestSpan.hasError = true
    }

    const spansAll = finalizeTimelineSpans(spans)
    const dbCache = spans.filter((s) => s.category === 'db' || s.category === 'cache')
    const requestViewError = spans.filter(
      (s) => s.category === 'request' || s.category === 'view' || s.category === 'error'
    )
    const spansByCaller = finalizeTimelineSpans([
      ...requestViewError,
      ...groupSqlByCaller(dbCache, { by: 'method' }),
    ])
    const spansByCallerFile = finalizeTimelineSpans([
      ...requestViewError,
      ...groupSqlByCaller(dbCache, { by: 'file' }),
    ])

    const dbRuntime = Number(actionEvent.payload.db_runtime) || sumCategory(spansAll, 'db')
    const viewRuntime = sumExclusive(spansAll.filter((s) => s.category === 'view'))
    const cacheRuntime = sumCategory(spansAll, 'cache')
    const otherRuntime = Math.max(0, totalMs - dbRuntime - viewRuntime - cacheRuntime)
    // Type buckets must match the header totals (Rails db_runtime, view self-sum, etc.).
    const spansByType = buildSpansByType(spansAll, {
      view: viewRuntime,
      db: dbRuntime,
      cache: cacheRuntime,
    })

    return {
      totalMs,
      dbRuntime,
      viewRuntime,
      cacheRuntime,
      otherRuntime,
      spans: spansAll,
      spansByCaller,
      spansByCallerFile,
      spansByType,
    }
  }

  function finalizeTimelineSpans(spans) {
    const viewSpans = withExclusiveDurations(
      spans.filter((s) => s.category === 'view'),
      {
        getStart: (s) => s.startMs,
        getDuration: (s) => s.durationMs,
      }
    )
    const viewById = new Map(viewSpans.map((s) => [s.id, s]))
    const resolved = spans.map((span) => {
      const exclusive = viewById.get(span.id)
      if (!exclusive) {
        return {
          ...span,
          durationInclusiveMs: span.durationMs,
          durationExclusiveMs: span.durationMs,
          nestDepth: span.nestDepth || 0,
        }
      }
      return {
        ...span,
        durationInclusiveMs: exclusive.durationInclusive,
        durationExclusiveMs: exclusive.durationExclusive,
        nestDepth: exclusive.nestDepth,
      }
    })

    resolved.sort((a, b) => {
      if (a.category === 'error' && b.category !== 'error') return 1
      if (b.category === 'error' && a.category !== 'error') return -1
      const groupA = a.groupStartMs ?? a.startMs
      const groupB = b.groupStartMs ?? b.startMs
      if (groupA !== groupB) return groupA - groupB
      if (a.startMs !== b.startMs) return a.startMs - b.startMs
      const depthA = a.nestDepth || 0
      const depthB = b.nestDepth || 0
      if (depthA !== depthB) return depthA - depthB
      if (depthA > 0) {
        return (a.sortKey ?? 0) - (b.sortKey ?? 0)
      }
      if (a.durationMs !== b.durationMs) return b.durationMs - a.durationMs
      return (a.sortKey ?? 0) - (b.sortKey ?? 0)
    })

    return resolved
  }

  function hasTiming(event) {
    return event && Number(event.time) > 0 && (Number(event.duration) > 0 || Number(event.end) > Number(event.time))
  }

  function callerFromPayload(payload) {
    const methodRaw = payload?.method != null ? String(payload.method) : ''
    const filename = payload?.filename != null ? String(payload.filename) : ''
    const line = payload?.line
    if (!methodRaw && !filename) {
      return {
        callerKey: null,
        callerLabel: null,
        callerDetail: null,
        callerFileKey: null,
        callerFileLabel: null,
      }
    }
    const file = basename(filename)
    const fileStem = file
      .replace(/\.rb$/i, '')
      .replace(/\.html\.erb$/i, '')
      .replace(/\.erb$/i, '')
    let method = methodRaw
    if (method.startsWith('block in ')) method = method.slice('block in '.length)
    // Always prefer file#method so generic names (map, index) stay useful.
    let callerLabel = 'caller'
    if (fileStem && method) callerLabel = `${fileStem}#${method}`
    else if (method) callerLabel = method
    else if (fileStem) callerLabel = fileStem
    const loc = file ? (line != null ? `${file}:${line}` : file) : ''
    const callerDetail = [loc, methodRaw || method].filter(Boolean).join(' · ')
    const callerKey = `${filename}#${methodRaw || method}`
    const callerFileKey = filename || null
    const callerFileLabel = fileStem || file || 'file'
    return { callerKey, callerLabel, callerDetail, callerFileKey, callerFileLabel }
  }

  function isTransactionBegin(sqlEvent) {
    return sqlEvent.name === 'TRANSACTION' && /begin/i.test(sqlEvent.sql || '')
  }

  function isTransactionEnd(sqlEvent) {
    return sqlEvent.name === 'TRANSACTION' && /(commit|rollback)/i.test(sqlEvent.sql || '')
  }

  function transactionChildLabel(sqlEvent) {
    if (isTransactionBegin(sqlEvent)) return 'begin'
    if (isTransactionEnd(sqlEvent)) {
      return /rollback/i.test(sqlEvent.sql || '') ? 'rollback' : 'commit'
    }
    return sqlEvent.name || 'SQL'
  }

  /**
   * ActiveRecord emits TRANSACTION begin/commit as tiny sibling events — the
   * UPDATE is not time-contained in either. Group begin…commit and nest the
   * statements that happen in between (plus begin/commit themselves).
   *
   * Instrumentation sometimes stamps UPDATE.time slightly before BEGIN.time;
   * we keep event order and clamp starts so begin always precedes siblings.
   */
  function buildSqlSpans(sqlEvents) {
    const out = []
    let i = 0
    let seq = 0

    while (i < sqlEvents.length) {
      const current = sqlEvents[i]
      if (!isTransactionBegin(current)) {
        out.push({
          id: `sql-${seq}`,
          sortKey: seq++,
          category: 'db',
          label: current.name || 'SQL',
          detail: current.sql || '',
          startMs: current.startMs,
          durationMs: current.durationMs,
          nestDepth: 0,
          sourceKey: current.sourceKey,
          highlightKeys: [current.sourceKey],
          callerKey: current.callerKey,
          callerLabel: current.callerLabel,
          callerDetail: current.callerDetail,
          callerFileKey: current.callerFileKey,
          callerFileLabel: current.callerFileLabel,
          groupStartMs: current.startMs,
        })
        i += 1
        continue
      }

      const group = [current]
      i += 1
      while (i < sqlEvents.length && !isTransactionEnd(sqlEvents[i])) {
        group.push(sqlEvents[i])
        i += 1
      }
      if (i < sqlEvents.length && isTransactionEnd(sqlEvents[i])) {
        group.push(sqlEvents[i])
        i += 1
      }

      const groupStart = Math.min(...group.map((g) => g.startMs))
      const groupEnd = Math.max(...group.map((g) => g.endMs))
      const workMs = group.reduce((acc, g) => acc + (Number(g.durationMs) || 0), 0)
      const wallMs = Math.max(0, groupEnd - groupStart)
      const childKeys = group.map((g) => g.sourceKey).filter(Boolean)
      const caller = group.find((g) => g.callerKey) || group[0]
      out.push({
        id: `sql-tx-${seq}`,
        sortKey: seq++,
        category: 'db',
        label: 'TRANSACTION',
        detail: group.map((g) => g.sql).filter(Boolean).join(' → '),
        startMs: groupStart,
        // Label = SQL work; bar uses durationWallMs (BEGIN→COMMIT open time).
        durationMs: Math.max(0, workMs),
        durationWallMs: wallMs,
        nestDepth: 0,
        highlightKeys: childKeys,
        isTransactionGroup: true,
        callerKey: caller.callerKey,
        callerLabel: caller.callerLabel,
        callerDetail: caller.callerDetail,
        callerFileKey: caller.callerFileKey,
        callerFileLabel: caller.callerFileLabel,
        groupStartMs: groupStart,
      })

      // Non-decreasing starts in event order: begin first, then Update, then commit.
      let lastStart = groupStart
      for (let j = 0; j < group.length; j++) {
        const child = group[j]
        const startMs = j === 0 ? groupStart : Math.max(child.startMs, lastStart)
        lastStart = startMs
        out.push({
          id: `sql-${seq}`,
          sortKey: seq++,
          category: 'db',
          label: transactionChildLabel(child),
          detail: child.sql || '',
          startMs,
          durationMs: child.durationMs,
          nestDepth: 1,
          sourceKey: child.sourceKey,
          highlightKeys: [child.sourceKey],
          groupStartMs: groupStart,
        })
      }
    }

    return out
  }

  /**
   * Wrap consecutive top-level SQL/cache blocks that share the same Ruby caller
   * under a parent row. `by: 'method'` → file#method; `by: 'file'` → file only.
   */
  function groupSqlByCaller(spans, { by = 'method' } = {}) {
    const keyOf = (span) =>
      by === 'file' ? span.callerFileKey || span.callerKey || null : span.callerKey || null
    const labelOf = (span) =>
      by === 'file'
        ? span.callerFileLabel || span.callerLabel || 'file'
        : span.callerLabel || 'caller'
    const idPrefix = by === 'file' ? 'sql-caller-file' : 'sql-caller'

    const blocks = []
    let i = 0
    while (i < spans.length) {
      const head = spans[i]
      const headDepth = head.nestDepth || 0
      const items = [head]
      i += 1
      while (i < spans.length && (spans[i].nestDepth || 0) > headDepth) {
        items.push(spans[i])
        i += 1
      }
      blocks.push({
        head,
        items,
        callerKey: keyOf(head),
        callerLabel: labelOf(head),
        callerDetail: head.callerDetail || null,
      })
    }

    const out = []
    let seq = 0
    let b = 0
    while (b < blocks.length) {
      const key = blocks[b].callerKey
      if (!key) {
        out.push(...blocks[b].items)
        b += 1
        continue
      }

      let end = b + 1
      while (end < blocks.length && blocks[end].callerKey === key) end += 1
      const run = blocks.slice(b, end)

      if (run.length === 1) {
        out.push(...run[0].items)
        b = end
        continue
      }

      const tops = run.map((block) => block.head)
      const nested = run.flatMap((block) => block.items)
      const startMs = Math.min(...tops.map((t) => t.startMs))
      const endMs = Math.max(
        ...tops.map((t) => t.startMs + (t.durationWallMs ?? t.durationMs))
      )
      const leaves = nested.filter((s) => s.sourceKey)
      const workMs = leaves.reduce((acc, s) => acc + (Number(s.durationMs) || 0), 0)
      const wallMs = Math.max(0, endMs - startMs)
      const highlightKeys = nested.flatMap((s) => s.highlightKeys || []).filter(Boolean)
      const cats = [...new Set(tops.map((t) => t.category).filter(Boolean))]
      // Prefer real child kinds: cache-only groups must not look like Database.
      let category = 'db'
      if (cats.length === 1) category = cats[0]
      else if (cats.includes('db') && cats.includes('cache')) {
        const dbMs = nested
          .filter((s) => s.category === 'db' && s.sourceKey)
          .reduce((acc, s) => acc + (Number(s.durationMs) || 0), 0)
        const cacheMs = nested
          .filter((s) => s.category === 'cache' && s.sourceKey)
          .reduce((acc, s) => acc + (Number(s.durationMs) || 0), 0)
        category = cacheMs > dbMs ? 'cache' : 'db'
      } else if (cats[0]) {
        category = cats[0]
      }

      out.push({
        id: `${idPrefix}-${seq++}`,
        sortKey: tops[0].sortKey,
        category,
        label: run[0].callerLabel || (by === 'file' ? 'file' : 'caller'),
        detail: run[0].callerDetail || '',
        startMs,
        // Label = leaf work; bar uses durationWallMs (first→last open time).
        durationMs: Math.max(0, workMs),
        durationWallMs: wallMs,
        nestDepth: 0,
        highlightKeys,
        isCallerGroup: true,
        groupStartMs: startMs,
      })

      for (const item of nested) {
        out.push({
          ...item,
          nestDepth: (item.nestDepth || 0) + 1,
          groupStartMs: startMs,
        })
      }
      b = end
    }

    return out
  }

  function splitSpanBlocks(spans) {
    const blocks = []
    let i = 0
    while (i < spans.length) {
      const head = spans[i]
      const headDepth = head.nestDepth || 0
      const items = [head]
      i += 1
      while (i < spans.length && (spans[i].nestDepth || 0) > headDepth) {
        items.push(spans[i])
        i += 1
      }
      blocks.push({ head, items })
    }
    return blocks
  }

  /** Interleave SQL blocks (keeping TX children) with cache rows by start time. */
  function mergeSqlAndCacheSpans(sqlSpans, cacheSpans) {
    const blocks = [
      ...splitSpanBlocks(sqlSpans),
      ...cacheSpans.map((span) => ({ head: span, items: [span] })),
    ]
    blocks.sort((a, b) => {
      if (a.head.startMs !== b.head.startMs) return a.head.startMs - b.head.startMs
      return (a.head.sortKey ?? 0) - (b.head.sortKey ?? 0)
    })
    return blocks.flatMap((block) => block.items)
  }

  /**
   * Macro view: Request → View/Database/Cache buckets (caller groups unwrapped),
   * preserving TRANSACTION nesting inside Database.
   * @param {{ view?: number, db?: number, cache?: number }} runtimes
   *   Header totals — type-group labels must match these; bars use wall open time.
   */
  function buildSpansByType(spans, runtimes = {}) {
    const request = spans.filter((s) => s.category === 'request')
    const error = spans.filter((s) => s.category === 'error')
    const items = spans.filter(
      (s) =>
        !s.isCallerGroup &&
        s.category !== 'request' &&
        s.category !== 'error'
    )

    const labels = { view: 'View', db: 'Database', cache: 'Cache' }
    const buckets = []

    for (const cat of ['view', 'db', 'cache']) {
      const catItems = items.filter((s) => s.category === cat)
      if (!catItems.length) continue

      const minDepth = Math.min(...catItems.map((s) => s.nestDepth || 0))
      const normalized = catItems.map((s, index) => ({
        ...s,
        id: `type-${cat}-${s.id}`,
        nestDepth: (s.nestDepth || 0) - minDepth + 1,
        sortKey: index,
        groupStartMs: undefined,
      }))

      const leaves = normalized.filter((s) => s.sourceKey)
      const leafSum = leaves.reduce((acc, s) => {
        const ms =
          cat === 'view'
            ? (s.durationExclusiveMs ?? s.durationExclusive ?? s.durationMs)
            : s.durationMs
        return acc + (Number(ms) || 0)
      }, 0)
      const totalMs =
        runtimes[cat] != null && Number.isFinite(Number(runtimes[cat]))
          ? Number(runtimes[cat])
          : leafSum
      const startMs = Math.min(...normalized.map((s) => s.startMs))
      const wallEnd = Math.max(
        ...normalized.map(
          (s) => s.startMs + (s.durationWallMs ?? s.durationInclusiveMs ?? s.durationMs ?? 0)
        )
      )
      const wallMs = Math.max(0, wallEnd - startMs)
      const highlightKeys = normalized.flatMap((s) => s.highlightKeys || []).filter(Boolean)
      const count = leaves.length || normalized.length

      buckets.push({
        startMs,
        group: {
          id: `type-group-${cat}`,
          category: cat,
          label: labels[cat],
          detail: `${count} event${count === 1 ? '' : 's'}`,
          startMs,
          // Label matches header work total; bar uses durationWallMs (first→last).
          durationMs: Math.max(0, totalMs),
          durationInclusiveMs: Math.max(0, totalMs),
          durationExclusiveMs: Math.max(0, totalMs),
          durationWallMs: wallMs,
          nestDepth: 0,
          highlightKeys,
          isTypeGroup: true,
          groupStartMs: startMs,
        },
        children: normalized.map((item) => ({
          ...item,
          groupStartMs: startMs,
        })),
      })
    }

    // Order type buckets by when they first appear on the timeline.
    buckets.sort((a, b) => {
      if (a.startMs !== b.startMs) return a.startMs - b.startMs
      return String(a.group.category).localeCompare(String(b.group.category))
    })

    const out = [...request]
    buckets.forEach((bucket, seq) => {
      out.push({
        ...bucket.group,
        sortKey: seq,
      })
      bucket.children.forEach((item, index) => {
        out.push({
          ...item,
          sortKey: seq * 1000 + index,
        })
      })
    })

    out.push(...error)
    return out
  }

  function buildExceptionSpan(actionEvent, events, totalMs) {
    const frames = events
      .filter((e) => e.name === 'process_action.action_controller.exception')
      .map((e) => String(e.payload?.call || ''))
      .filter(Boolean)
    const payloadEx = actionEvent.payload?.exception
    if (!frames.length && !payloadEx) return null

    let label = 'Exception'
    let detail = ''

    if (Array.isArray(payloadEx) && payloadEx.length) {
      label = String(payloadEx[0] || label)
      detail = String(payloadEx[1] || '')
    } else if (frames[0]) {
      const match = frames[0].match(/^([A-Za-z0-9_.:]+)\s*\((.*)\)\s*$/)
      if (match) {
        label = match[1]
        detail = match[2]
      } else {
        label = frames[0].split(':')[0] || frames[0]
        detail = frames[0]
      }
    }

    // Stack frames after the exception headline (which is usually frames[0])
    const stack = frames.filter((frame, index) => {
      if (index === 0 && frame.includes(label)) return false
      return true
    })

    const highlightKeys = frames.map((_, index) => `error:${index}`)

    return {
      id: 'exception',
      category: 'error',
      label,
      detail: detail || label,
      frames: stack,
      startMs: 0,
      durationMs: totalMs,
      isMarker: true,
      highlightKeys,
    }
  }

  function sumCategory(spans, category) {
    return spans
      .filter((s) => s.category === category && s.sourceKey)
      .reduce((acc, s) => acc + (Number(s.durationMs) || 0), 0)
  }

  function basename(path) {
    if (!path) return ''
    const parts = String(path).split(/[/\\]/)
    return parts[parts.length - 1] || path
  }

  function clear() {
    actions.value = new Map();
    activeRecordQueries.value = new Map();
    actionViewRenders.value = new Map();
    logEntries.value = new Map();
    exceptionStacktraces.value = new Map();
    cacheCalls.value = new Map();
    timelineSpans.value = new Map();
    rawEventsByRequest.value = new Map();
    selectedRequest.value = null;
    clearDetailHighlight();
  }

  /** Keep only the currently selected request; drop everything else. */
  function clearOlder() {
    const keep = selectedRequest.value
    if (!keep) {
      clear()
      return
    }
    const keepId = keep.id
    const nextActions = new Map()
    nextActions.set(keepId, keep)
    actions.value = nextActions

    const pick = (map) => {
      const next = new Map()
      if (map.has(keepId)) next.set(keepId, map.get(keepId))
      return next
    }
    activeRecordQueries.value = pick(activeRecordQueries.value)
    actionViewRenders.value = pick(actionViewRenders.value)
    logEntries.value = pick(logEntries.value)
    exceptionStacktraces.value = pick(exceptionStacktraces.value)
    cacheCalls.value = pick(cacheCalls.value)
    timelineSpans.value = pick(timelineSpans.value)
    rawEventsByRequest.value = pick(rawEventsByRequest.value)
    clearDetailHighlight()
  }

  /**
   * Export selected (or given) request as portable JSON for another machine.
   */
  function exportRequestJson(requestId = selectedRequest.value?.id) {
    if (requestId == null) return null
    const id = normalizeRequestId(requestId)
    const action = actions.value.get(id)
    if (!action) return null
    const events = rawEventsByRequest.value.get(id)
    if (!events?.length) {
      throw new Error('No raw events available to export for this request')
    }
    return {
      format: 'rails-panel-request',
      version: 1,
      exportedAt: new Date().toISOString(),
      request_id: id,
      action: {
        name: action.action,
        status: action.status,
        method: action.method,
        format: action.format,
        duration: action.duration,
      },
      events: JSON.parse(JSON.stringify(events)),
    }
  }

  /**
   * Import a rails-panel (or raw meta_request events) JSON and mark it external.
   */
  function importRequestJson(payload) {
    let data = payload
    if (typeof data === 'string') data = JSON.parse(data)

    let events = null
    let originalId = null

    if (Array.isArray(data)) {
      events = data
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.events)) {
        events = data.events
        originalId = data.request_id || data.requestId || null
      } else if (Array.isArray(data.data)) {
        events = data.data
      }
    }

    if (!events?.length) {
      throw new Error('JSON must include an events array (rails-panel export or meta_request dump)')
    }

    const stamp = Date.now().toString(36)
    const rand = Math.random().toString(36).slice(2, 8)
    const newId = `external:${stamp}:${rand}`
    const action = pushEvents(newId, events, true, { isExternal: true })
    if (!action) throw new Error('Could not import: missing process_action.action_controller event')
    if (originalId) action.importedFrom = String(originalId)
    return action
  }

  return { 
    requests,
    requestCount,
    selectedRequest,
    selectedActiveRecordQueries, 
    selectedParams,
    selectedActionViewRenders,
    selectedLogEntries,
    selectedExceptionStacktraces,
    selectedCacheCalls,
    selectedTimeline,
    detailHighlightKeys,
    setDetailHighlight,
    clearDetailHighlight,
    isDetailHighlighted,
    pushEvents,
    clear,
    clearOlder,
    pruneToCap,
    exportRequestJson,
    importRequestJson,
  }
})
