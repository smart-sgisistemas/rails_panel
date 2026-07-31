/**
 * Normalize SQL so queries that differ only by binds/literals share a pattern.
 * Used for repeated-query / N+1 detection.
 */
export function normalizeSql(sql) {
  let s = String(sql || '')
  if (!s) return ''

  // Strip SQL comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, ' ')
  s = s.replace(/--[^\n]*/g, ' ')

  // Normalize whitespace
  s = s.replace(/\s+/g, ' ').trim()

  // Single-quoted string literals (values)
  s = s.replace(/'(?:[^'\\]|\\.)*'/g, '?')

  // Positional / anonymous binds
  s = s.replace(/\$\d+/g, '?')
  s = s.replace(/\?/g, '?')

  // Numeric literals (keep away from identifiers by word boundary)
  s = s.replace(/\b\d+(?:\.\d+)?\b/g, '?')

  // Collapse IN (?, ?, ?) → IN (?)
  s = s.replace(/\bIN\s*\(\s*\?(?:\s*,\s*\?)*\s*\)/gi, 'IN (?)')

  // Collapse VALUES (?, ?), (?, ?) style lists somewhat
  s = s.replace(/\(\s*\?(?:\s*,\s*\?)*\s*\)(?:\s*,\s*\(\s*\?(?:\s*,\s*\?)*\s*\))+/g, '(?)')

  return s
}

export function isMetaSqlType(type) {
  const t = String(type || '')
  return (
    t === 'SCHEMA' ||
    t === 'EXPLAIN' ||
    t === 'TRANSACTION' ||
    /^TRANSACTION\b/i.test(t)
  )
}

/**
 * Annotate AR query rows with repeat / N+1 metadata.
 * - isRepeated: same pattern appears ≥ 2 times
 * - isNPlusOne: same pattern appears ≥ 3 times (classic N+1 smell)
 */
export function annotateQueryRepeats(queries, { nPlusOneMin = 3, repeatMin = 2 } = {}) {
  const list = Array.isArray(queries) ? queries : []
  const groups = new Map()

  list.forEach((q, index) => {
    if (isMetaSqlType(q.type)) return
    const pattern = normalizeSql(q.query)
    if (!pattern) return
    if (!groups.has(pattern)) {
      groups.set(pattern, {
        pattern,
        indexes: [],
        totalMs: 0,
        sample: q.query,
        type: q.type,
      })
    }
    const g = groups.get(pattern)
    g.indexes.push(index)
    g.totalMs += Number(q.duration) || 0
  })

  return list.map((q, index) => {
    if (isMetaSqlType(q.type)) {
      return {
        ...q,
        sqlPattern: null,
        repeatCount: 1,
        isRepeated: false,
        isNPlusOne: false,
      }
    }
    const pattern = normalizeSql(q.query)
    const g = groups.get(pattern)
    const count = g?.indexes.length || 1
    return {
      ...q,
      sqlPattern: pattern || null,
      repeatCount: count,
      isRepeated: count >= repeatMin,
      isNPlusOne: count >= nPlusOneMin,
    }
  })
}

/** Unique N+1 pattern groups (count ≥ nPlusOneMin), sorted by total time desc. */
export function nPlusOneGroups(annotated, { nPlusOneMin = 3 } = {}) {
  const seen = new Map()
  for (const q of annotated || []) {
    if (!q.isNPlusOne || !q.sqlPattern) continue
    if (seen.has(q.sqlPattern)) continue
    seen.set(q.sqlPattern, {
      pattern: q.sqlPattern,
      sample: q.query,
      type: q.type,
      count: q.repeatCount,
      totalMs: 0,
    })
  }
  for (const q of annotated || []) {
    if (!q.sqlPattern || !seen.has(q.sqlPattern)) continue
    seen.get(q.sqlPattern).totalMs += Number(q.duration) || 0
  }
  return Array.from(seen.values())
    .filter((g) => g.count >= nPlusOneMin)
    .sort((a, b) => b.totalMs - a.totalMs || b.count - a.count)
}
