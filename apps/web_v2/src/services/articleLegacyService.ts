const LEGACY_ARTICLE_MAP_KEY = 'legacy_article_map_v1'

type LegacyArticleMap = Record<string, string>

const parseLegacyMap = (): LegacyArticleMap => {
  const raw = localStorage.getItem(LEGACY_ARTICLE_MAP_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.entries(parsed as Record<string, unknown>).reduce<LegacyArticleMap>((acc, [oldId, newId]) => {
      if (typeof oldId !== 'string' || typeof newId !== 'string') return acc
      const source = oldId.trim()
      const target = newId.trim()
      if (!source || !target || source === target) return acc
      acc[source] = target
      return acc
    }, {})
  } catch {
    return {}
  }
}

const saveLegacyMap = (value: LegacyArticleMap) => {
  localStorage.setItem(LEGACY_ARTICLE_MAP_KEY, JSON.stringify(value))
}

export const markLegacyArticle = (oldArticleId: string, newArticleId: string) => {
  const oldId = oldArticleId.trim()
  const newId = newArticleId.trim()
  if (!oldId || !newId || oldId === newId) return
  const next = parseLegacyMap()
  next[oldId] = newId
  saveLegacyMap(next)
}

export const resolveLegacyArticleIds = (articleIds: string[]): Set<string> => {
  const availableIds = new Set(articleIds.map((id) => id.trim()).filter(Boolean))
  if (!availableIds.size) {
    saveLegacyMap({})
    return new Set<string>()
  }

  const current = parseLegacyMap()
  const compacted: LegacyArticleMap = {}
  const legacyIds = new Set<string>()

  for (const [oldId, newId] of Object.entries(current)) {
    if (!availableIds.has(oldId) || !availableIds.has(newId) || oldId === newId) continue
    compacted[oldId] = newId
    legacyIds.add(oldId)
  }

  if (Object.keys(compacted).length !== Object.keys(current).length) {
    saveLegacyMap(compacted)
  }

  return legacyIds
}

