import { supabase } from '@/supabase/supabaseClient'

export type ExerciseLibraryItem = {
  id: string
  name: string
  video_url: string | null
  gif_url: string | null
  img_url: string | null
  variations: string[] | null
  created_at: string
}

export async function fetchExercises(): Promise<ExerciseLibraryItem[]> {
  try {
    // Fetch base exercises (where trainer_id is null) from unified exercises table
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .is('trainer_id', null)
      .order('name', { ascending: true })

    if (error) {
      console.error('Supabase error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      
      // If table doesn't exist (404), provide helpful message
      if (error.code === 'PGRST116' || error.message.includes('404') || error.message.includes('relation') || error.message.includes('does not exist')) {
        console.error('❌ Table "public.exercises" does not exist or is not accessible.')
        console.error('   Please check:')
        console.error('   1. Table exists in Supabase database (public.exercises)')
        console.error('   2. Table name is correct (exercises)')
        console.error('   3. Supabase URL and API key are correct')
      }
      
      throw error
    }
    
    // Map data to ensure all fields are present (handle missing columns gracefully)
    return (data || []).map(item => ({
      id: item.id,
      name: item.name || '',
      video_url: item.video_url || null,
      gif_url: item.gif_url || null,
      img_url: item.img_url || null,
      variations: item.variations || null,
      created_at: item.created_at || new Date().toISOString(),
    })) as ExerciseLibraryItem[]
  } catch (err) {
    console.error('Error fetching exercises:', err)
    return []
  }
}

/**
 * Fetch exercises with pagination support
 * @param page - 1-based page number (default: 1)
 * @param pageSize - Number of exercises per page (default: 10)
 * @param searchQuery - Optional search query to filter by name
 */
export async function fetchExercisesPaginated(
  page: number = 1,
  pageSize: number = 10,
  searchQuery?: string
): Promise<{
  exercises: ExerciseLibraryItem[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}> {
  try {
    let query = supabase
      .from('exercises')
      .select('*', { count: 'exact' })
      .is('trainer_id', null) // Only base exercises

    // Apply search filter if provided
    if (searchQuery && searchQuery.trim()) {
      query = query.ilike('name', `%${searchQuery.trim()}%`)
    }

    // Apply pagination and ordering
    const offset = (page - 1) * pageSize
    query = query
      .order('name', { ascending: true })
      .range(offset, offset + pageSize - 1)

    // Execute query - count and data are returned together
    const { data, error, count } = await query

    if (error) throw error

    const total = count || 0
    const hasMore = offset + (data?.length || 0) < total

    return {
      exercises: (data || []) as ExerciseLibraryItem[],
      total,
      page,
      pageSize,
      hasMore,
    }
  } catch (err) {
    console.error('Error fetching exercises with pagination:', err)
    return {
      exercises: [],
      total: 0,
      page,
      pageSize,
      hasMore: false,
    }
  }
}
