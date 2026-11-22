// Use your application's installed @supabase/supabase-js v2 client.
// The publishable key is frontend-safe; never use a service_role key here.
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  'https://xwqdcqpxjjctwugbssqr.supabase.co',
  'sb_publishable_dn4hmTlJBFuQviEoTJ45BA_SWZQkIV5'
);

// Sign in first using the app's normal Supabase Auth flow.
// Ownership comes from auth.uid() in PostgreSQL; callers supply no user_id.
export async function addFavorite(sneakerId) {
  return supabase.from('favorites').upsert({ sneaker_id: sneakerId }, {
    onConflict: 'user_id,sneaker_id', ignoreDuplicates: true
  });
}
export async function listFavorites() {
  return supabase.rpc('sole_favorites'); // Each row includes the complete sneaker.
}
export async function isFavorite(sneakerId) {
  const { data, error } = await supabase.from('favorites')
    .select('sneaker_id').eq('sneaker_id', sneakerId).maybeSingle();
  return { data: Boolean(data), error };
}
export async function removeFavorite(sneakerId) {
  return supabase.from('favorites').delete().eq('sneaker_id', sneakerId);
}

// RLS checks sole_admins for the signed-in account on every write.
export async function createSneaker(completeRecord) {
  return supabase.schema('sole').from('sneakers').insert(completeRecord).select().single();
}
export async function updateSneaker(id, changedFields) {
  return supabase.schema('sole').from('sneakers').update(changedFields).eq('id', id).select().single();
}
export async function deleteSneaker(id) {
  return supabase.schema('sole').from('sneakers').delete().eq('id', id).select('id').single();
}
export async function categorySneakers(category) {
  return supabase.schema('sole').from('sneakers').select('*').eq('category', category).order('id');
}
