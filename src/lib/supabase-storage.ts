import { createClient } from '@supabase/supabase-js'

/**
 * Cliente admin de Supabase para operaciones de storage (server-side only).
 * Usa la service role key para bypass de RLS.
 * Las keys se configuran en variables de entorno.
 */
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL
  // Para storage necesitamos la service role key, no la anon key.
  // Si no está configurada, usamos la anon key como fallback (requerirá buckets públicos).
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Sube un archivo a Supabase Storage y devuelve la URL pública.
 * Bucket: 'clinics' (debe existir en Supabase, ver instrucciones abajo).
 * Path: {clinicId}/{filename}
 *
 * Para que funcione, crear el bucket 'clinics' en Supabase:
 * 1. Supabase Dashboard → Storage → New bucket
 * 2. Name: clinics, Public: true (o false si prefieres URLs firmadas)
 */
export async function uploadToSupabase(
  clinicId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  const path = `${clinicId}/${filename}`
  const { error } = await supabase.storage
    .from('clinics')
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: true, // sobrescribe si existe
    })

  if (error) {
    console.error('[SUPABASE STORAGE] upload error:', error.message)
    return null
  }

  // Obtener URL pública
  const { data } = supabase.storage.from('clinics').getPublicUrl(path)
  return data.publicUrl
}
