"use strict";

// Same-origin API by default. Set window.SOLE_API_URL before this script if hosted separately.
const API_URL = (window.SOLE_API_URL || "").replace(/\/$/, "");
const ATTRIBUTE_LABELS = Object.freeze({
  brand: "Brand", name: "Name", year: "Year", descriptive_overview: "Descriptive overview",
  gender_target: "Gender target", retail_price: "Retail Price", colorway: "Colorway", country_of_origin: "Country of Origin",
  category: "Category", details_specifications: "Details / specifications",
  shoe_reference_number: "Shoe reference number", review_stars: "Review stars", materials: "Materials",
  description: "Description",
});
const state = { items: [], loading: false, loaded: false, opener: null };
const $ = (id) => document.getElementById(id);
const list = $("sneakerList");
const dialog = $("sneakerDialog");

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

async function fetchJSON(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}

function validateItems(items) {
  if (!Array.isArray(items) || !items.length) throw new Error("The archive is empty or invalid.");
  const ids = new Set();
  for (const item of items) {
    const attributes = item.attributes;
    if (!Number.isInteger(item.id) || ids.has(item.id) || typeof item.image_url !== "string" ||
        !attributes || Object.keys(attributes).length !== 14 ||
        Object.keys(ATTRIBUTE_LABELS).some((key) => attributes[key] === undefined || attributes[key] === null || attributes[key] === "")) {
      throw new Error("Invalid archive record.");
    }
    ids.add(item.id);
    if (!["Men", "Women", "Both"].includes(attributes.gender_target) ||
        !["Basketball", "Running", "Lifestyle", "Football"].includes(attributes.category) ||
        typeof attributes.review_stars !== "number" || !Number.isFinite(attributes.review_stars) ||
        attributes.review_stars < 0 || attributes.review_stars > 5) throw new Error("Invalid product specification.");
    // Images must resolve to local inventory assets, even for a separately hosted API.
    if (!/^\/?images\/[\w.-]+\.(jpg|jpeg|png|webp|avif)$/i.test(item.image_url)) throw new Error("Invalid image path.");
  }
  return items;
}

async function bundledCatalog() {
  const [records, inventory, provenance] = await Promise.all([
    fetchJSON("data/sneakers.json"), fetchJSON("data/images.json"), fetchJSON("data/provenance.json"),
  ]);
  const keys = Object.keys(inventory.items);
  if (keys.length !== Object.keys(records).length || Object.keys(records).some((key) => !inventory.items[key])) {
    throw new Error("Image manifest and catalog do not match.");
  }
  return keys.map((key) => ({ id: Number(key), image_url: inventory.items[key].image,
    image_note: inventory.items[key].note, attributes: records[key], provenance: provenance[key] || {} }));
}

async function loadSneakers() {
  if (state.loading) return;
  state.loading = true;
  list.setAttribute("aria-busy", "true");
  $("resultCount").textContent = "LOADING";
  list.replaceChildren(element("p", "loading-message", "Opening the archive…"));
  let bundled = false;
  try {
    let items;
    try { items = validateItems((await fetchJSON(`${API_URL}/catalog`)).items); }
    catch { items = validateItems(await bundledCatalog()); bundled = true; }
    state.items = items.sort((a, b) => a.id - b.id);
    state.loaded = true;
    const previousBrand = $("brandFilter").value;
    $("brandFilter").replaceChildren(new Option("All brands", ""),
      ...[...new Set(items.map((item) => item.attributes.brand))].sort().map((brand) => new Option(brand, brand)));
    $("brandFilter").value = previousBrand;
    $("archiveCount").textContent = String(items.length).padStart(2, "0");
    const featured = state.items[0];
    $("featuredName").textContent = featured.attributes.name;
    $("featuredBrand").textContent = `${featured.attributes.brand} / ${featured.attributes.year}`;
    $("featuredSneaker").disabled = false;
    $("featuredSneaker").setAttribute("aria-label", `View ${featured.attributes.name}`);
    $("catalogNote").textContent = `${bundled ? "Showing the bundled archive. " : ""}Archive prices are catalog references. Check each store for current pricing.`;
    displaySneakers();
  } catch (error) {
    state.loaded = false;
    state.items = [];
    $("archiveCount").textContent = "—";
    $("featuredSneaker").disabled = true;
    $("featuredName").textContent = "The collection";
    $("featuredBrand").textContent = "From the SOLE archive";
    $("resultCount").textContent = "UNAVAILABLE";
    showState("The archive couldn’t load.", "Check your connection and try again.", "Try again ↗", loadSneakers);
    console.error("Unable to load the sneaker archive:", error);
  } finally {
    state.loading = false;
    list.setAttribute("aria-busy", "false");
  }
}

function priceNumber(price) {
  const match = String(price).match(/[\d,]+(?:\.\d+)?/);
  return match ? Number(match[0].replaceAll(",", "")) : null;
}

function filteredItems() {
  const query = $("searchInput").value.trim().toLocaleLowerCase();
  const brand = $("brandFilter").value;
  const order = $("sortOrder").value;
  const items = state.items.filter(({ attributes: shoe }) => (!brand || shoe.brand === brand) &&
    [shoe.brand, shoe.name, shoe.year, shoe.colorway].join(" ").toLocaleLowerCase().includes(query));
  return items.sort((a, b) => {
    const left = a.attributes, right = b.attributes;
    if (order.startsWith("price-")) {
      const x = priceNumber(left.retail_price), y = priceNumber(right.retail_price);
      if (x === null || y === null) return x === y ? a.id - b.id : x === null ? 1 : -1;
      return (order === "price-low" ? x - y : y - x) || a.id - b.id;
    }
    if (order === "year") return (Number(right.year) || 0) - (Number(left.year) || 0) || a.id - b.id;
    if (order === "name") return left.name.localeCompare(right.name) || a.id - b.id;
    return a.id - b.id;
  });
}

function showState(title, message, buttonText, action) {
  const panel = element("div", "state-panel");
  const button = element("button", "pill", buttonText);
  button.type = "button";
  button.addEventListener("click", action);
  panel.append(element("span", "state-symbol", "↻"), element("h3", "", title), element("p", "", message), button);
  list.replaceChildren(panel);
}

function localImagePath(item) {
  return item.image_url.replace(/^\//, "");
}

function handleImageError(event) {
  const img = event.currentTarget;
  img.hidden = true;
  // Preserve the product details if an image becomes unavailable after validation.
  const placeholder = element("span", "image-unavailable", "Product photo unavailable");
  img.after(placeholder);
}

function sneakerCard(item) {
  const shoe = item.attributes;
  const card = element("button", "sneaker-card");
  card.type = "button";
  card.setAttribute("aria-label", `View ${shoe.brand} ${shoe.name}, ${shoe.retail_price}`);
  const visual = element("div", "card-image");
  const image = element("img");
  image.src = localImagePath(item);
  image.alt = `${shoe.brand} ${shoe.name}${item.image_note ? " (alternate colorway pictured)" : ` — ${shoe.colorway}`}`;
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", handleImageError, { once: true });
  visual.append(element("span", "card-year", Number.isInteger(shoe.year) ? shoe.year : "ARCHIVE"), image,
    element("span", "card-overlay", "A CLOSER LOOK"), element("span", "card-arrow", "↗"));
  const copy = element("div", "card-copy");
  const bottom = element("div", "card-bottom");
  bottom.append(element("span", "card-colorway", shoe.colorway), element("span", "card-price", shoe.retail_price));
  copy.append(element("p", "card-brand", shoe.brand), element("h3", "", shoe.name), bottom);
  card.append(visual, copy);
  card.addEventListener("click", () => viewSneaker(item.id, card));
  return card;
}

function displaySneakers() {
  if (!state.loaded) return;
  const items = filteredItems();
  $("resultCount").textContent = `${String(items.length).padStart(2, "0")} ${items.length === 1 ? "PAIR" : "PAIRS"}`;
  if (!items.length) {
    showState("No pairs found.", "Try a different brand, model, year, or colorway.", "Show all pairs ↗", resetFilters);
    return;
  }
  list.replaceChildren(...items.map(sneakerCard));
}

function searchSneakers(event) {
  event?.preventDefault();
  displaySneakers();
}

function resetFilters() {
  $("searchForm").reset();
  if (state.loaded) displaySneakers();
  else loadSneakers();
}

function ratingText(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not yet rated";
  const rating = Math.max(0, Math.min(5, value));
  return `${"★".repeat(Math.round(rating))}${"☆".repeat(5 - Math.round(rating))} ${rating}/5`;
}

function viewSneaker(id, opener = document.activeElement) {
  const item = state.items.find((shoe) => shoe.id === Number(id));
  if (!item) return;
  const shoe = item.attributes;
  state.opener = opener;
  $("detailIndex").textContent = `ARCHIVE / ${String(item.id).padStart(2, "0")}`;
  const image = $("detailImage");
  image.hidden = false;
  image.parentElement.querySelectorAll(".image-unavailable").forEach((node) => node.remove());
  image.onerror = handleImageError;
  image.src = localImagePath(item); // Original asset, no thumbnail or downscaled source.
  image.alt = `${shoe.brand} ${shoe.name}${item.image_note ? " (alternate colorway pictured)" : ` — ${shoe.colorway}`}`;
  $("detailBrand").textContent = shoe.brand;
  $("detailName").textContent = shoe.name;
  $("detailPrice").textContent = shoe.retail_price;
  const rating = $("detailRating");
  rating.textContent = ratingText(shoe.review_stars);
  const ratingProvenance = item.provenance?.review_stars;
  if (ratingProvenance?.status !== "verified") rating.append(element("span", "data-badge", "Mock rating"));
  rating.title = ratingProvenance?.note || "Demonstration rating; not a customer-review aggregate.";
  $("detailOverview").textContent = shoe.descriptive_overview;
  const displayedAbove = new Set(["brand", "name", "retail_price", "review_stars", "description"]);
  const rows = Object.entries(ATTRIBUTE_LABELS).filter(([key]) => !displayedAbove.has(key)).map(([key, label]) => {
    const row = element("div", "spec-row");
    row.dataset.attribute = key;
    const value = element("dd", "", shoe[key]);
    if (key === "shoe_reference_number") {
      const source = item.provenance?.shoe_reference_number;
      if (source?.status !== "verified") value.append(element("span", "data-badge", "Mock SKU"));
      if (source?.note) value.append(element("span", "data-note", source.note));
      const url = source?.sources?.[0];
      if (typeof url === "string" && /^https:\/\//.test(url)) {
        const link = element("a", "data-source", "Source ↗");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        value.append(link);
      }
    }
    row.append(element("dt", "", label), value);
    return row;
  });
  $("detailSpecs").replaceChildren(...rows);
  $("detailImageNote").textContent = item.image_note || "";
  $("detailImageNote").hidden = !item.image_note;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  $("closeDialog").focus({ preventScroll: true });
  document.body.classList.add("modal-open");
}

$("searchForm").addEventListener("submit", searchSneakers);
$("searchInput").addEventListener("input", searchSneakers);
$("brandFilter").addEventListener("change", displaySneakers);
$("sortOrder").addEventListener("change", displaySneakers);
$("resetFilters").addEventListener("click", resetFilters);
$("featuredSneaker").addEventListener("click", () => viewSneaker(state.items[0]?.id, $("featuredSneaker")));
$("closeDialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  const controls = [...dialog.querySelectorAll('button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]')];
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
dialog.addEventListener("click", (event) => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});
dialog.addEventListener("close", () => {
  document.body.classList.remove("modal-open");
  if (state.opener?.isConnected) state.opener.focus({ preventScroll: true });
});
loadSneakers();
