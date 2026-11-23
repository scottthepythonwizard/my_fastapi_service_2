(() => {
  "use strict";

  const config = window.SOLE_ACCOUNT_CONFIG;
  const sdkURL = "/sole-shared/supabase-2.119.2.js";
  const sizeLabels = { us_men: "US men", us_women: "US women", us: "US", uk: "UK", eu: "EU" };
  const favorites = new Map();
  const pending = new Set();
  let client, user, admin = false, ready = false, refreshId = 0, panel = "", panelVersion = 0;
  const account = document.createElement("dialog");
  account.className = "sole-account";
  account.setAttribute("aria-labelledby", "sole-account-title");
  account.innerHTML = `<header><h2 id="sole-account-title"></h2><button type="button" data-close>Close</button></header>
    <div data-body></div><p role="status" class="sole-status"></p>`;
  document.body.append(account);
  const body = account.querySelector("[data-body]");
  const status = account.querySelector("[role=status]");
  const title = account.querySelector("h2");

  function element(tag, text) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(text, action) {
    const node = element("button", text);
    node.type = "button";
    node.addEventListener("click", action);
    return node;
  }

  function sizeText(size, system) {
    return size == null ? "" : [sizeLabels[system], new Intl.NumberFormat().format(size)].filter(Boolean).join(" ");
  }

  function syncButtons() {
    for (const node of document.querySelectorAll("[data-sole-favorite]")) {
      const id = Number(node.dataset.soleFavorite);
      const saved = favorites.get(id);
      const sized = node.dataset.size !== undefined;
      node.disabled = pending.has(id) || (!ready && Boolean(client));
      node.textContent = pending.has(id) ? "Saving…" : saved
        ? sized ? "Update saved size" : "Remove favorite"
        : sized ? "Save with size" : "Save favorite";
      node.setAttribute("aria-label", `${node.textContent} for ${node.dataset.name}`);
      node.dataset.saved = String(Boolean(saved));
      if (!sized) node.setAttribute("aria-pressed", String(Boolean(saved)));
    }
    for (const link of document.querySelectorAll('[data-sole-panel="admin"]')) link.hidden = !admin;
    for (const link of document.querySelectorAll("[data-sole-signin]")) link.textContent = user ? "Account" : "Sign in";
  }

  async function refresh(sessionUser) {
    const token = ++refreshId;
    if (user?.id !== sessionUser?.id) {
      favorites.clear();
      admin = false;
      ready = false;
    }
    user = sessionUser;
    syncButtons();
    if (!user) { ready = true; syncButtons(); return; }
    const [saved, membership] = await Promise.all([
      client.from("favorites").select("sneaker_id,size,size_system").order("created_at", { ascending: false }),
      client.from("sole_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
    ]);
    if (token !== refreshId) return;
    ready = true;
    if (!saved.error) {
      favorites.clear();
      for (const row of saved.data) favorites.set(row.sneaker_id, row);
    }
    admin = !membership.error && Boolean(membership.data);
    syncButtons();
    if (saved.error) throw saved.error;
  }

  async function mutate(id, size, system, remove) {
    if (pending.has(id)) return false;
    const owner = user?.id;
    if (!owner) throw new Error("Sign in to change your favorites.");
    pending.add(id);
    syncButtons();
    try {
      const result = remove
        ? await client.from("favorites").delete().eq("sneaker_id", id)
        : await client.rpc("sole_save_favorite", { p_sneaker_id: id, p_size: size, p_size_system: system });
      if (result.error) throw result.error;
      if (user?.id === owner) {
        // Invalidate any older refresh that started before the write.
        ++refreshId;
        if (remove) favorites.delete(id);
        else if (size != null || !favorites.has(id)) favorites.set(id, { sneaker_id: id, size, size_system: system });
      }
      return true;
    } finally {
      pending.delete(id);
      syncButtons();
    }
  }

  function favoriteButton(item, size = null, system = null) {
    const host = element("div");
    host.className = "sole-favorite";
    const name = `${item.attributes.brand} ${item.attributes.name}`;
    const message = element("span");
    message.className = "sole-favorite-message";
    message.setAttribute("role", "status");
    const control = button("Save favorite", async () => {
      if (!user) { openPanel("signin", "Sign in to save this sneaker."); return; }
      const remove = size === null && favorites.has(item.id);
      message.textContent = "";
      try {
        if (await mutate(item.id, size, system, remove)) {
          message.textContent = remove ? "Removed." : size === null ? "Saved." : `Saved size ${sizeText(size, system)}.`;
        }
      } catch {
        message.textContent = "Couldn’t change this favorite. Try again.";
      }
    });
    control.dataset.soleFavorite = item.id;
    control.dataset.name = name;
    if (size !== null) control.dataset.size = size;
    host.append(control, message);
    queueMicrotask(syncButtons);
    return host;
  }

  function withFavorite(card, item) {
    const host = element("div");
    host.className = "sole-favorite-card";
    host.append(card, favoriteButton(item));
    return host;
  }

  function renderSignIn(message = "") {
    title.textContent = "Sign in";
    status.textContent = message;
    body.innerHTML = `<form class="sole-account-form">
      <label>Email<input type="email" name="email" autocomplete="email" spellcheck="false" required></label>
      <label>Password<input type="password" name="password" autocomplete="current-password" required></label>
      <button type="submit">Sign in</button>
    </form>`;
    const form = body.querySelector("form");
    const submit = form.querySelector("button");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!client) { status.textContent = "Sign-in is unavailable. Reload the page and try again."; return; }
      try {
        submit.disabled = true;
        status.textContent = "Signing in…";
        const fields = new FormData(form);
        const { data, error } = await client.auth.signInWithPassword({
          email: fields.get("email").trim(),
          password: fields.get("password"),
        });
        if (error || !data.user) { status.textContent = "Couldn’t sign in. Check your email and password."; return; }
        await refresh(data.user);
        if (panel === "favorites" || panel === "admin") await renderPanel();
        else if (account.open && panel === "signin") account.close();
      } catch {
        status.textContent = "Couldn’t load your account. Try again.";
      } finally { submit.disabled = false; }
    });
    form.elements.email.focus();
  }

  async function renderFavorites(version) {
    title.textContent = "Favorites";
    status.textContent = "Loading favorites…";
    await refresh(user);
    if (version !== panelVersion) return;
    const { data, error } = await client.rpc("sole_favorites");
    if (version !== panelVersion) return;
    if (error) throw error;
    status.textContent = "";
    if (!data.length) { body.replaceChildren(element("p", "You haven’t saved any sneakers yet.")); return; }
    const list = element("ul");
    list.className = "sole-favorites-list";
    for (const { sneaker, sneaker_id: id } of data) {
      const row = element("li");
      const label = `${sneaker.brand} ${sneaker.name}`;
      const info = element("div");
      const size = favorites.get(id);
      info.append(element("strong", label), element("p", [sneaker.category, sizeText(size?.size, size?.size_system)].filter(Boolean).join(" · ")));
      const remove = button("Remove", async () => {
        remove.disabled = true;
        try {
          await mutate(id, null, null, true);
          const next = row.nextElementSibling || row.previousElementSibling;
          row.remove();
          if (!list.children.length) body.replaceChildren(element("p", "You haven’t saved any sneakers yet."));
          (next?.querySelector("button") || account.querySelector("[data-close]")).focus();
          status.textContent = `Removed ${label}.`;
        } catch {
          status.textContent = "Couldn’t remove this favorite. Try again.";
          remove.disabled = false;
        }
      });
      remove.setAttribute("aria-label", `Remove ${label} from favorites`);
      row.append(info, remove);
      list.append(row);
    }
    body.replaceChildren(list);
  }

  async function renderPanel(message) {
    const version = ++panelVersion;
    body.replaceChildren();
    status.textContent = "";
    if (!user) { renderSignIn(message || (panel === "favorites" ? "Sign in to view your favorites." : "")); return; }
    try {
      if (panel === "favorites") await renderFavorites(version);
      else if (panel === "admin") {
        title.textContent = "Manage sneakers";
        if (!admin) { status.textContent = "Administrator access is required."; return; }
        const { renderAdmin } = await import("./admin.js");
        if (version === panelVersion) await renderAdmin(client, body, status);
      } else {
        title.textContent = "Account";
        body.append(element("p", user.email), button("Sign out", async (event) => {
          event.currentTarget.disabled = true;
          const { error } = await client.auth.signOut({ scope: "local" });
          if (error) { status.textContent = "Couldn’t sign out. Try again."; event.target.disabled = false; return; }
          await refresh(null);
          account.close();
        }));
      }
    } catch {
      if (version === panelVersion) status.textContent = "Couldn’t load this panel. Close it and try again.";
    }
  }

  function openPanel(next, message) {
    panel = next;
    if (!account.open) account.showModal();
    if (next !== "signin") {
      const url = new URL(location.href);
      url.searchParams.set("panel", next);
      history.replaceState(null, "", url);
    }
    void renderPanel(message);
  }

  function canClose() {
    return !account.querySelector("[data-unsaved]") || window.confirm("Discard your unsaved sneaker changes?");
  }

  account.querySelector("[data-close]").addEventListener("click", () => {
    if (canClose()) account.close();
  });
  account.addEventListener("cancel", (event) => {
    if (!canClose()) event.preventDefault();
  });
  window.addEventListener("beforeunload", (event) => {
    if (account.open && account.querySelector("[data-unsaved]")) event.preventDefault();
  });
  account.addEventListener("close", () => {
    ++panelVersion;
    panel = "";
    const url = new URL(location.href);
    url.searchParams.delete("panel");
    history.replaceState(null, "", url);
  });
  for (const link of document.querySelectorAll("[data-sole-panel]")) {
    const url = new URL(location.href);
    url.searchParams.set("panel", link.dataset.solePanel);
    link.href = url;
    link.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openPanel(link.dataset.solePanel);
    });
  }
  for (const link of document.querySelectorAll("[data-sole-signin]")) link.addEventListener("click", () => openPanel("signin"));
  window.SoleAccount = { favoriteButton, withFavorite };

  async function start() {
    if (!config) return;
    const script = element("script");
    script.src = sdkURL;
    script.integrity = "sha384-A97u3Qnt9GZHURO9YJZRe7VQgGUeFzcv6I1oIGnUTxQrCxnpQMwR0/G8F2zt9abZ";
    script.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => {
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", reject, { once: true });
      document.head.append(script);
    });
    client = window.supabase.createClient(config.url, config.key);
    const { data } = await client.auth.getSession();
    try { await refresh(data.session?.user); } catch { /* The Favorites panel reports load errors. */ }
    client.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED" || session?.user?.id === user?.id) return;
      // Auth callbacks run under the SDK's lock. Start database requests in a later task.
      setTimeout(async () => {
        try { await refresh(session?.user); } catch { /* Displayed when the panel is opened. */ }
        if (account.open && panel !== "signin") void renderPanel();
      }, 0);
    });
    window.addEventListener("pageshow", () => { if (user) refresh(user).catch(() => {}); });
    window.addEventListener("focus", () => { if (user) refresh(user).catch(() => {}); });
    const initial = new URLSearchParams(location.search).get("panel");
    if (["favorites", "admin"].includes(initial) && !account.open) openPanel(initial);
  }
  start().catch(() => { status.textContent = "Account services are unavailable. Reload the page to try again."; });
})();
