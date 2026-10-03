// Couche données des échanges / ventes (Supabase). Aucune UI ici : voir index.html.
// SUPABASE_URL et SUPABASE_ANON_KEY sont publiques par conception (la sécurité repose sur les règles RLS de supabase/schema.sql).
// Ne JAMAIS mettre la clé `service_role` dans ce fichier.
window.Exchange = (() => {
  const SUPABASE_URL = 'https://dqchixckhidrgjsyotjn.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_WLinF80d979FNq-NxCmmnA_7YhVttpU';

  const configured = !!(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
  const sb = configured
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;
  const PAGE = 60;
  let me = null;

  const unavailable = () => new Error(
    SUPABASE_URL && SUPABASE_ANON_KEY ? 'Service indisponible (hors ligne ?).' : "Les échanges ne sont pas encore configurés (Supabase)."
  );
  const need = () => { if (!configured) throw unavailable(); };
  const check = ({ data, error }) => {
    if (error) throw Object.assign(new Error(error.code === '23505' ? 'Ce pseudo est déjà pris.' : error.message), { code: error.code });
    return data;
  };

  async function sessionUser() {
    need();
    const { data } = await sb.auth.getSession();
    return data.session?.user ?? null;
  }

  // Le compte anonyme n'est créé qu'à la première écriture ; la lecture des annonces marche sans compte.
  async function ensureUser() {
    const u = await sessionUser();
    if (u) return u;
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) throw new Error("Impossible de créer le compte anonyme (activé dans Supabase ?).");
    return data.user;
  }

  async function loadMe() {
    const u = await sessionUser();
    if (!u) return (me = null);
    const p = check(await sb.from('profiles').select('id,pseudo').eq('id', u.id).maybeSingle());
    if (!p) return (me = { id: u.id, pseudo: null, contact: '' });
    const c = check(await sb.from('contacts').select('value').eq('user_id', u.id).maybeSingle());
    return (me = { id: u.id, pseudo: p.pseudo, contact: c?.value ?? '' });
  }

  async function saveProfile(pseudo, contact) {
    const u = await ensureUser();
    pseudo = String(pseudo).trim();
    contact = String(contact ?? '').trim();
    if (!/^[A-Za-z0-9_.-]{3,20}$/.test(pseudo)) throw new Error('Pseudo : 3 à 20 caractères (lettres, chiffres, _ . -).');
    if (contact.length > 120) throw new Error('Contact : 120 caractères maximum.');
    const existing = check(await sb.from('profiles').select('id').eq('id', u.id).maybeSingle());
    if (existing) check(await sb.from('profiles').update({ pseudo }).eq('id', u.id));
    else check(await sb.from('profiles').insert({ id: u.id, pseudo }));
    if (contact) {
      const has = check(await sb.from('contacts').select('user_id').eq('user_id', u.id).maybeSingle());
      if (has) check(await sb.from('contacts').update({ value: contact }).eq('user_id', u.id));
      else check(await sb.from('contacts').insert({ user_id: u.id, value: contact }));
    } else {
      check(await sb.from('contacts').delete().eq('user_id', u.id));
    }
    return loadMe();
  }

  const LISTING_COLS = 'id,owner_id,product_id,image_index,kind,price,qty,note,created_at,owner:profiles!owner_id(pseudo)';

  // filters : { kind?: 'exchange'|'sale', scope?: 'all'|'mine'|'interested', page?: number }
  async function listListings({ kind, scope = 'all', page = 0 } = {}) {
    need();
    let q = sb.from('listings').select(LISTING_COLS).order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (kind) q = q.eq('kind', kind);
    if (scope === 'mine') {
      const u = await sessionUser();
      if (!u) return { items: [], more: false };
      q = q.eq('owner_id', u.id);
    } else if (scope === 'interested') {
      const ids = [...await myInterestIds()];
      if (!ids.length) return { items: [], more: false };
      q = q.in('id', ids);
    }
    const items = check(await q);
    return { items, more: items.length === PAGE };
  }

  async function myInterestIds() {
    const u = await sessionUser();
    if (!u) return new Set();
    return new Set(check(await sb.from('interests').select('listing_id').eq('user_id', u.id)).map((r) => r.listing_id));
  }

  // listing : { product_id, image_index, kind, price, qty, note }
  async function publish(l) {
    const u = await ensureUser();
    if (!me?.pseudo) await loadMe();
    if (!me?.pseudo) throw new Error('Choisissez d\'abord un pseudo.');
    const fields = { kind: l.kind, price: l.kind === 'sale' ? l.price : null, qty: l.qty, note: l.note || null };
    const ex = check(await sb.from('listings').select('id').eq('owner_id', u.id).eq('product_id', l.product_id).eq('image_index', l.image_index).maybeSingle());
    const row = ex
      ? await sb.from('listings').update(fields).eq('id', ex.id).select(LISTING_COLS).single()
      : await sb.from('listings').insert({ owner_id: u.id, product_id: l.product_id, image_index: l.image_index, ...fields }).select(LISTING_COLS).single();
    return check(row);
  }

  // ---- Partage chiffré (voir supabase/shares.sql) : le serveur ne reçoit que du texte chiffré ----
  async function createShare(data) {
    need();
    await ensureUser();
    const { data: id, error } = await sb.rpc('create_share', { p_data: data });
    if (error) throw new Error(error.message);
    return id;
  }

  async function getShare(id) {
    need();
    const { data, error } = await sb.rpc('get_share', { p_id: id });
    if (error) throw new Error(error.message);
    return data;
  }

  async function deleteShare(id) {
    need();
    const { error } = await sb.rpc('delete_share', { p_id: id });
    if (error) throw new Error(error.message);
  }

  async function myListingsAll() {
    const u = await sessionUser();
    if (!u) return [];
    const all = [];
    for (let page = 0; page < 4; page++) {
      const { items, more } = await listListings({ scope: 'mine', page });
      all.push(...items);
      if (!more) break;
    }
    return all;
  }

  async function removeListing(id) {
    need();
    check(await sb.from('listings').delete().eq('id', id));
  }

  async function setInterest(listingId, on) {
    const u = await ensureUser();
    if (!me?.pseudo) await loadMe();
    if (!me?.pseudo) throw new Error('Choisissez d\'abord un pseudo.');
    if (on) check(await sb.from('interests').insert({ listing_id: listingId, user_id: u.id }));
    else check(await sb.from('interests').delete().eq('listing_id', listingId).eq('user_id', u.id));
  }

  // Contact de l'autre partie d'un intérêt (autorisé par la RLS seulement dans ce cas)
  async function contactsOf(userIds) {
    const ids = [...new Set(userIds)];
    if (!ids.length) return new Map();
    return new Map(check(await sb.from('contacts').select('user_id,value').in('user_id', ids)).map((r) => [r.user_id, r.value]));
  }

  async function listNotifications() {
    const u = await sessionUser();
    if (!u) return [];
    const rows = check(await sb.from('notifications')
      .select('id,read,created_at,from_user_id,listing:listings(id,product_id,image_index,kind),from:profiles!from_user_id(pseudo)')
      .eq('recipient_id', u.id).order('created_at', { ascending: false }).limit(100));
    const contacts = await contactsOf(rows.map((r) => r.from_user_id));
    return rows.map((r) => ({ ...r, contact: contacts.get(r.from_user_id) ?? '' }));
  }

  async function unreadCount() {
    const u = await sessionUser();
    if (!u) return 0;
    const { count, error } = await sb.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', u.id).eq('read', false);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  async function markRead(ids) {
    need();
    const q = sb.from('notifications').update({ read: true });
    check(await (ids ? q.in('id', ids) : q.eq('read', false)));
  }

  async function removeNotifications(ids) {
    need();
    const q = sb.from('notifications').delete();
    check(await (ids ? q.in('id', ids) : q.not('id', 'is', null)));
  }

  // Temps réel : appelle onChange() à chaque changement de MES notifications. Retourne une fonction d'arrêt.
  async function subscribe(onChange) {
    const u = await sessionUser();
    if (!u) return () => {};
    const ch = sb.channel('notifications-' + u.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${u.id}` }, () => onChange())
      .subscribe();
    return () => sb.removeChannel(ch);
  }

  return {
    configured, PAGE,
    get me() { return me; },
    createShare, getShare, deleteShare,
    loadMe, saveProfile, listListings, myListingsAll, myInterestIds, publish, removeListing, setInterest, contactsOf,
    listNotifications, unreadCount, markRead, removeNotifications, subscribe,
    onAuthChange: (cb) => configured && sb.auth.onAuthStateChange(() => cb()),
  };
})();
