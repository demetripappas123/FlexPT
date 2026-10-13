import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/supabase/supabaseClient'

export type CatalogSource = 'base' | 'mine' | 'community'

export type CatalogSearchParams = {
  query: string
  trainerId?: string | null
  limit?: number
  extraIds?: string[]
}

export type ExerciseSearchHit = {
  id: string
  name: string
  source: CatalogSource
  trainer_id: string | null
  is_private: boolean
  variations: string[] | null
  movement_pattern: string | null
  rank: number
}

export type FoodSearchHit = {
  id: string
  description: string
  fdc_id: number | null
  brand_name: string | null
  category: string | null
  source: CatalogSource
  trainer_id: string | null
  is_private: boolean
  rank: number
}

type RpcArgs = {
  p_query: string
  p_trainer_id: string | null
  p_limit: number
  p_extra_ids: string[]
}

function rpcArgs(params: CatalogSearchParams): RpcArgs {
  return {
    p_query: params.query?.trim() ?? '',
    p_trainer_id: params.trainerId ?? null,
    p_limit: params.limit ?? 20,
    p_extra_ids: (params.extraIds ?? []).filter(Boolean),
  }
}

export async function searchExercises(
  params: CatalogSearchParams,
  client: SupabaseClient = supabase
): Promise<ExerciseSearchHit[]> {
  const { data, error } = await client.rpc('search_exercises', rpcArgs(params))
  if (error) {
    console.error('search_exercises failed:', error)
    return []
  }
  return (data ?? []) as ExerciseSearchHit[]
}

export async function searchFoods(
  params: CatalogSearchParams,
  client: SupabaseClient = supabase
): Promise<FoodSearchHit[]> {
  const { data, error } = await client.rpc('search_foods', rpcArgs(params))
  if (error) {
    console.error('search_foods failed:', error)
    return []
  }
  return (data ?? []) as FoodSearchHit[]
}

/** Resolve leftover AI names that were not in the first retrieval slice. */
export async function expandExerciseHits(
  current: Array<{ id: string; name: string }>,
  names: string[],
  trainerId?: string | null,
  client: SupabaseClient = supabase
): Promise<Array<{ id: string; name: string }>> {
  const have = new Set(current.map((e) => e.name.toLowerCase()))
  const missing = [...new Set(names.map((n) => n.trim()).filter(Boolean))].filter(
    (n) => !have.has(n.toLowerCase())
  )
  if (missing.length === 0) return current

  const extra = await Promise.all(
    missing.map((name) => searchExercises({ query: name, trainerId, limit: 5 }, client))
  )
  const merged = [...current]
  const seen = new Set(current.map((e) => e.id))
  for (const hits of extra) {
    for (const hit of hits) {
      if (seen.has(hit.id)) continue
      seen.add(hit.id)
      merged.push({ id: hit.id, name: hit.name })
    }
  }
  return merged
}
