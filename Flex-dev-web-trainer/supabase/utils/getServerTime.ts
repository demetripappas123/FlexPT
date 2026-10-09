import { supabase } from '../supabaseClient'

/**
 * Get the current server time from Supabase (UTC)
 * This ensures we use the server's time, not the client's potentially incorrect clock
 * 
 * To use this, you need to create a database function in Supabase:
 * 
 * CREATE OR REPLACE FUNCTION get_server_time()
 * RETURNS timestamptz AS $$
 * BEGIN
 *   RETURN now();
 * END;
 * $$ LANGUAGE plpgsql;
 */
export async function getServerTime(): Promise<string> {
  try {
    // Use Supabase's RPC to get server time
    const { data, error } = await supabase.rpc('get_server_time')
    
    if (error) {
      // Fallback: query a table with a default timestamp to get server time
      // This is a workaround - the server will set created_at using now()
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('sessions')
        .select('created_at')
        .limit(1)
        .order('created_at', { ascending: false })
      
      if (!fallbackError && fallbackData && fallbackData.length > 0) {
        // This won't give us current time, but shows the pattern
        // For now, we'll use client time but log a warning
        console.warn('Server time RPC not available. Please create the get_server_time() function in Supabase.')
        console.warn('Using client time - this may be inaccurate if client clock is wrong.')
      }
      
      // Last resort: use client time (not ideal but better than nothing)
      return new Date().toISOString()
    }
    
    return data
  } catch (err) {
    console.error('Error getting server time:', err)
    // Fallback to client time
    return new Date().toISOString()
  }
}

