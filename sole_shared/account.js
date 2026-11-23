(() => {
  "use strict";

  const config = window.SOLE_ACCOUNT_CONFIG;
  const sdkURL = "/sole-shared/supabase-2.119.2.js";
  const sizeLabels = { us_men: "US men", us_women: "US women", us: "US", uk: "UK", eu: "EU" };
  const favorites = new Map();
  const pending = new Set();
  let client, user, ready = false, refreshId = 0, panel = "", panelVersion = 0;
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

  function favoritePhoto(path) {
    const photo = element("div");
    photo.className = "sole-favorite-photo";
    const placeholder = element("span", "No photo");
    photo.append(placeholder);
    if (typeof path !== "string" || !/^\/?images\/[\w.-]+\.(jpg|jpeg|png|webp|avif)$/i.test(path)) return photo;

    const origin = window.SOLE_COMPARE_CONFIG?.apiOrigin || window.SOLE_FIT_CONFIG?.archiveOrigin || location.origin;
    const image = element("img");
    image.alt = "";
    image.width = 64;
    image.height = 56;
    image.loading = "lazy";
    image.addEventListener("load", () => { placeholder.hidden = true; }, { once: true });
    image.addEventListener("error", () => image.remove(), { once: true });
    image.src = new URL("/" + path.replace(/^\//, ""), origin).href;
    photo.append(image);
    return photo;
  }

  function syncButtons() {
    for (const node of document.querySelectorAll("[data-sole-favorite]")) {
      const id = Number(node.dataset.soleFavorite);
      const saved = favorites.get(id);
      const locked = pending.has(id) || (!ready && Boolean(client));
      const action = saved ? "Remove from favorites" : "Add to favorites";
      node.setAttribute("aria-disabled", String(locked));
      node.setAttribute("aria-label", `${action}: ${node.dataset.name}`);
      node.title = action;
      node.dataset.saved = String(Boolean(saved));
      node.firstElementChild.textContent = saved ? "★" : "☆";
      const resize = node.parentElement.querySelector("[data-update-size]");
      if (resize) {
        resize.hidden = !saved;
        resize.setAttribute("aria-disabled", String(locked));
      }
    }
    for (const link of document.querySelectorAll("[data-sole-signin]")) link.textContent = user ? "Account" : "Sign in";
  }

  async function refresh(sessionUser) {
    const token = ++refreshId;
    if (user?.id !== sessionUser?.id) {
      favorites.clear();
      ready = false;
    }
    user = sessionUser;
    syncButtons();
    if (!user) { ready = true; syncButtons(); return; }
    const saved = await client.from("favorites").select("sneaker_id,size,size_system").order("created_at", { ascending: false });
    if (token !== refreshId) return;
    ready = true;
    if (!saved.error) {
      favorites.clear();
      for (const row of saved.data) favorites.set(row.sneaker_id, row);
    }
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
    async function changeFavorite(remove, trigger) {
      if (trigger.getAttribute("aria-disabled") === "true") return;
      if (!user) { openPanel("signin", "Sign in to save this sneaker."); return; }
      message.textContent = "";
      try {
        if (await mutate(item.id, size, system, remove)) {
          message.textContent = remove ? "Removed." : size === null ? "Saved." : `Saved size ${sizeText(size, system)}.`;
        }
      } catch {
        message.textContent = "Couldn’t change this favorite. Try again.";
      }
    }
    const control = button("", () => changeFavorite(favorites.has(item.id), control));
    control.className = "sole-star";
    control.dataset.soleFavorite = item.id;
    control.dataset.name = name;
    control.setAttribute("aria-label", `Add to favorites: ${name}`);
    const star = element("span", "☆");
    star.setAttribute("aria-hidden", "true");
    control.append(star);
    host.append(control);
    if (size !== null) {
      const resize = button("Update size", () => changeFavorite(false, resize));
      resize.dataset.updateSize = "";
      resize.hidden = true;
      resize.setAttribute("aria-label", `Update saved size for ${name} to ${sizeText(size, system)}`);
      host.append(resize);
    }
    host.append(message);
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
        if (panel === "favorites") await renderPanel();
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
      info.className = "sole-favorite-info";
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
      row.append(favoritePhoto(sneaker.image_url), info, remove);
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
      else {
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

  account.querySelector("[data-close]").addEventListener("click", () => account.close());
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
    if (initial === "favorites" && !account.open) openPanel(initial);
  }
  start().catch(() => { status.textContent = "Account services are unavailable. Reload the page to try again."; });
})();
