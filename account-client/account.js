import { createClient } from '@supabase/supabase-js';
const cfg = window.SOLE_ACCOUNT_CONFIG;
const client = createClient(cfg.url, cfg.publishableKey);
const $ = id => document.getElementById(id);
let user = null, catalog = [], favorites = new Set(), generation = 0;
let busy = false;
function message(text) { $('status').textContent = text; }
function node(tag, text, cls) { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; }
function button(text, action) { const b = node('button', text); b.type = 'button'; b.addEventListener('click', () => perform(action)); return b; }
async function checked(promise) { const {data, error} = await promise; if (error) throw error; return data; }
async function perform(action) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  try { await action(); } catch (err) { message(err.message || 'Please try again.'); }
  finally { busy = false; document.querySelectorAll('button').forEach(b => b.disabled = false); }
}
async function load() {
  const current = ++generation;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  user = data.session?.user || null;
  $('auth').hidden = !!user;
  $('member').hidden = !user;
  $('admin').hidden = true;
  $('signout').hidden = !user;
  $('identity').textContent = user ? `Signed in as ${user.email}` : 'Sign in to save your favorite sneakers.';
  $('catalog').replaceChildren(); $('favorites').replaceChildren(); $('admin-list').replaceChildren();
  favorites = new Set();
  if (!user) return;
  const snapshot = user.id;
  const [saved, membership, response] = await Promise.all([
    checked(client.from('favorites').select('sneaker_id').eq('user_id', snapshot)),
    checked(client.from('sole_admins').select('user_id').eq('user_id', snapshot)),
    fetch('/api/v1/catalog', {headers: {'x-api-key': cfg.catalogKey}}),
  ]);
  if (!response.ok) throw new Error('The catalog is unavailable. Please try again.');
  const payload = await response.json();
  if (current !== generation) return;
  catalog = payload.items;
  favorites = new Set(saved.map(row => row.sneaker_id));
  render();
  if (membership.length) {
    $('admin').hidden = false;
    const items = await checked(client.rpc('sole_admin_catalog'));
    if (current === generation) renderAdmin(items);
  }
}
function card(item) {
  const a = item.attributes;
  const c = node('article', null, 'shoe');
  const img = node('img');
  // Catalog paths are constrained to local product images; never render arbitrary HTML.
  img.src = /^images\/[\w.-]+\.(jpg|jpeg|png|webp|avif)$/i.test(item.image_url) ? '/' + item.image_url : '/images/hero.jpg';
  img.alt = a.name; img.loading = 'lazy'; c.append(img, node('h3', a.name), node('p', `${a.brand} · ${a.retail_price}`));
  const saved = favorites.has(item.id);
  const toggle = button(saved ? 'Remove favorite' : 'Add favorite', async () => {
    const {data} = await client.auth.getUser();
    if (!data.user || data.user.id !== user?.id) { await load(); throw new Error('Please sign in again.'); }
    if (favorites.has(item.id)) {
      await checked(client.from('favorites').delete().eq('user_id', user.id).eq('sneaker_id', item.id));
      favorites.delete(item.id); message('Removed from your favorites.');
    } else {
      const {error} = await client.from('favorites').insert({user_id:user.id, sneaker_id:item.id});
      if (error && error.code !== '23505') throw error;
      favorites.add(item.id); message('Saved to your favorites.');
    }
    render();
  });
  toggle.setAttribute('aria-pressed', String(saved)); c.append(toggle); return c;
}
function render() {
  const term = $('search').value.trim().toLowerCase();
  $('catalog').replaceChildren(...catalog.filter(x => `${x.attributes.brand} ${x.attributes.name}`.toLowerCase().includes(term)).map(card));
  const saved = catalog.filter(x => favorites.has(x.id));
  $('favorites').replaceChildren(...saved.map(card));
  if (!saved.length) $('favorites').append(node('p', 'No favorites yet. Choose a sneaker below to save it.'));
  $('favorite-count').textContent = String(saved.length);
}
function renderAdmin(items) {
  $('admin-list').replaceChildren();
  for (const item of items) {
    const form = node('form', null, 'admin-row');
    const name = node('input'); name.value = item.name; name.required = true; name.maxLength = 300; name.setAttribute('aria-label', `Name for sneaker ${item.id}`);
    const price = node('input'); price.value = item.retail_price; price.required = true; price.maxLength = 100; price.setAttribute('aria-label', `Price for sneaker ${item.id}`);
    const save = node('button','Save changes'); save.type='submit';
    form.addEventListener('submit', e => { e.preventDefault(); perform(async () => {
      await checked(client.rpc('sole_admin_update_sneaker', {p_id:item.id,p_name:name.value,p_retail_price:price.value}));
      await load(); message('Sneaker updated.');
    }); });
    const remove = button('Delete sneaker', async () => {
      if (!confirm(`Delete ${name.value}? This also removes it from everyone’s favorites. This cannot be undone.`)) return;
      await checked(client.rpc('sole_admin_delete_sneaker',{p_id:item.id}));
      await load(); message('Sneaker deleted.');
    });
    form.append(node('span',`#${item.id} · ${item.category}`),name,price,save,remove); $('admin-list').append(form);
  }
}
$('signin').addEventListener('submit', e => { e.preventDefault(); perform(async () => {
  await checked(client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value}));
  $('password').value=''; await load(); message('Signed in.');
}); });
$('signup').addEventListener('click', () => perform(async () => {
  if (!$('signin').reportValidity()) return;
  const data = await checked(client.auth.signUp({email:$('email').value.trim(),password:$('password').value}));
  $('password').value='';
  await load(); message(data.session ? 'Account created.' : 'Check your email to confirm your account, then sign in.');
}));
$('signout').addEventListener('click', () => perform(async () => {
  await checked(client.auth.signOut()); await load(); message('Signed out.');
}));
$('refresh').addEventListener('click', () => perform(async()=> {await load(); message('Favorites refreshed.');}));
$('search').addEventListener('input', render);
client.auth.onAuthStateChange((event) => {
  // Run outside the auth callback to avoid holding the SDK's session lock.
  if (['SIGNED_OUT','SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)) setTimeout(()=>load().catch(e=>message(e.message)),0);
});
load().catch(err=>message(err.message));
