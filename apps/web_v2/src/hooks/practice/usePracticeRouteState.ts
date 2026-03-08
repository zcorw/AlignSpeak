import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { PracticeLevel } from '../../services/practiceService'

export const parseLevelFromQuery = (value: string | null): PracticeLevel | null => {
  if (value === 'L1' || value === '1') return 'L1'
  if (value === 'L2' || value === '2') return 'L2'
  if (value === 'L3' || value === '3') return 'L3'
  if (value === 'L4' || value === '4') return 'L4'
  return null
}

export const usePracticeRouteState = () => {
  const [searchParams] = useSearchParams()
  const [level, setLevel] = useState<PracticeLevel>(parseLevelFromQuery(searchParams.get('lv')) ?? 'L1')

  const searchKey = searchParams.toString()
  const queryArticleId = searchParams.get('a') ?? searchParams.get('articleId')
  const querySegment = Number.parseInt(searchParams.get('seg') ?? '', 10)
  const queryLevel = parseLevelFromQuery(searchParams.get('lv'))

  useEffect(() => {
    if (queryLevel) {
      setLevel(queryLevel)
    }
  }, [queryLevel])

  return {
    level,
    setLevel,
    searchKey,
    queryArticleId,
    querySegment,
    queryLevel,
  }
}

