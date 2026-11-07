export const FIELDS = Object.freeze([
  ["brand", "Brand"], ["name", "Name"], ["year", "Release year"],
  ["category", "Category"], ["retail_price", "Price"], ["colorway", "Colorway"],
  ["country_of_origin", "Country of Origin"], ["materials", "Materials"],
  ["closure_type", "Closure type"], ["cut", "Cut"], ["sole_material", "Sole material"],
  ["cushioning", "Cushioning"], ["weight_g", "Weight (g)"], ["release_month", "Release month"],
].map(Object.freeze));

const MONTHS = Object.freeze(["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"]);

export function apiOrigin(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Set apiOrigin to an HTTP(S) origin without a path, query, or credentials.");
  }
  return url.origin;
}

export function validateCatalog(payload) {
  if (!payload || !Array.isArray(payload.items) || payload.count !== payload.items.length) {
    throw new Error("The archive returned an invalid inventory.");
  }
  const ids = new Set();
  for (const item of payload.items) {
    if (!Number.isInteger(item.id) || item.id < 1 || ids.has(item.id) ||
        !item.attributes || !/^\/?images\/[\w.-]+\.(jpg|jpeg|png|webp|avif)$/i.test(item.image_url)) {
      throw new Error("The archive returned an invalid sneaker record.");
    }
    ids.add(item.id);
    for (const [key] of FIELDS) {
      const value = item.attributes[key];
      const valid = key === "weight_g" ? value === null || (Number.isFinite(value) && value > 0) :
        key === "release_month" ? value === null || (Number.isInteger(value) && value >= 1 && value <= 12) :
        key === "year" ? Number.isInteger(value) || value === "Not documented" :
        typeof value === "string" && value.trim().length > 0;
      if (!valid) throw new Error(`The archive returned an invalid ${key.replaceAll("_", " ")} value.`);
    }
  }
  return payload.items;
}

export async function fetchCatalog(config, fetcher = fetch) {
  let url, response;
  try {
    url = `${apiOrigin(config.apiOrigin)}/api/v1/catalog`;
    response = await fetcher(url, {
      headers: { "x-api-key": config.apiKey }, cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (response.status === 401) throw new Error("The API key was rejected (HTTP 401). Check the key in config.js.");
    if (response.status === 403) throw new Error("Access to the archive is restricted (HTTP 403). Check deployment access.");
    if (response.status === 404) throw new Error(`Archive endpoint not found (HTTP 404): ${url}. Check the backend host and routes.`);
    if (!response.ok) throw new Error(`The archive is unavailable (HTTP ${response.status}). Please try again.`);
    let payload;
    try { payload = await response.json(); }
    catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      throw new Error(`Expected JSON from ${url} (HTTP ${response.status}). Check that this is the API, not a login or frontend page.`, { cause: error });
    }
    return validateCatalog(payload);
  } catch (error) {
    console.error("[Sole Compare] Archive request failed", {
      url: url ?? config.apiOrigin, method: "GET", status: response?.status ?? null,
      statusText: response?.statusText ?? null,
      contentType: response?.headers?.get("content-type") ?? null, error,
    });
    if (error.name === "TimeoutError") {
      throw new Error(`The archive timed out after 10 seconds: ${url}. Check that the API is running.`, { cause: error });
    }
    if (url && !response && error instanceof TypeError) {
      throw new Error(`Could not reach ${url}. Run START_SOLE.cmd in the main project folder, then reopen Sole Compare.`, { cause: error });
    }
    throw error;
  }
}

export function toggleSelection(selected, id) {
  const next = [selected[0] ?? null, selected[1] ?? null];
  const current = next.indexOf(id);
  if (current !== -1) next[current] = null;
  else if (next.includes(null)) next[next.indexOf(null)] = id;
  return next;
}

export function chooseSlot(selected, slot, id) {
  const next = [selected[0] ?? null, selected[1] ?? null];
  if (id !== null && next.some((value, index) => index !== slot && value === id)) return next;
  next[slot] = id;
  return next;
}

export function isPairReady(selected) {
  return selected.length === 2 && selected.every((id) => Number.isInteger(id) && id > 0) && selected[0] !== selected[1];
}

export function formatValue(item, key) {
  const value = item.attributes[key];
  if (value === null || value === undefined || value === "Not documented") return "—";
  if (key === "release_month") {
    const year = item.provenance?.release_month?.release_year;
    return `${MONTHS[value - 1]}${Number.isInteger(year) ? ` ${year}` : ""}`;
  }
  return String(value);
}

export function isDifferent(left, right, key) {
  const normalize = (value) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  // Provenance can distinguish identical numbers: e.g. a verified vs. estimated weight.
  return normalize(formatValue(left, key)) !== normalize(formatValue(right, key)) ||
    (left.provenance?.[key]?.status === "estimated") !== (right.provenance?.[key]?.status === "estimated");
}

export function imageUrl(item, origin) {
  return new URL(item.image_url.replace(/^\//, ""), `${apiOrigin(origin)}/`).href;
}

export function filterInventory(items, query, brand) {
  const search = query.trim().toLocaleLowerCase();
  return items.filter(({ attributes }) => (!brand || attributes.brand === brand) &&
    Object.values(attributes).filter((value) => value !== null).join(" ").toLocaleLowerCase().includes(search));
}
