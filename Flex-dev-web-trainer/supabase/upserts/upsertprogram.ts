import { supabase } from '../supabaseClient'

// Clean Program type matching your new DB structure
export type Program = {
  id?: string
  name: string
  user_id?: number | null
  weeks?: object | null
}

// Create or update a program
export async function upsertProgram(program: Program) {
  const { data, error } = await supabase
    .from('programs')
    .upsert(
      {
        id: program.id ?? undefined,   // undefined → insert new row
        name: program.name,
        user_id: program.user_id ?? null,
        weeks: program.weeks ?? null,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'id' }
    )
    .select()

  if (error) throw error
  return data
}
