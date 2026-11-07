import { FIELDS, apiOrigin, chooseSlot, fetchCatalog, filterInventory, isDifferent, isPairReady, toggleSelection } from "./core.js";
import { ComparisonTable, InventoryCard, SelectionSlot, element } from "./components.js";

const $ = (id) => document.getElementById(id);
const state = { items: [], selected: [null, null], comparing: false, loading: false };
const config = window.SOLE_COMPARE_CONFIG || {};
let origin;

function announce(message) { $("announcement").textContent = message; }

function selectedItems() {
  return state.selected.map((id) => state.items.find((item) => item.id === id));
}

function updateSelection(next) {
  state.selected = next;
  if (!isPairReady(next)) state.comparing = false;
  renderSelection();
  renderInventory();
  renderComparison();
  announce(`${next.filter(Number.isInteger).length} of 2 pairs selected.`);
}

function onToggle(id) {
  if (isPairReady(state.selected) && !state.selected.includes(id)) {
    announce("Two pairs are already selected. Remove one before choosing another.");
    return;
  }
  updateSelection(toggleSelection(state.selected, id));
}

function renderSelection() {
  const chosen = selectedItems();
  const count = state.selected.filter(Number.isInteger).length;
  $("selectionCount").textContent = `${count} / 2 SELECTED`;
  $("selectionHint").textContent = count === 2 ? "Both pairs are in. Ready for a closer look?" :
    count === 1 ? "One down. Choose a different sneaker for your second pair." : "Choose two distinct sneakers to begin.";
  $("compareButton").disabled = !isPairReady(state.selected);
  for (const [slot, id] of ["pairOne", "pairTwo"].entries()) {
    const select = $(id);
    const placeholder = new Option(`Choose ${slot === 0 ? "first" : "second"} sneaker`, "");
    const options = state.items.map((item) => {
      const option = new Option(`${item.attributes.brand} ${item.attributes.name} — ${item.attributes.year}`, String(item.id));
      option.disabled = state.selected[1 - slot] === item.id;
      return option;
    });
    select.replaceChildren(placeholder, ...options);
    select.value = state.selected[slot] === null ? "" : String(state.selected[slot]);
    select.disabled = state.loading || !state.items.length;
    $(slot === 0 ? "slotOne" : "slotTwo").replaceChildren(SelectionSlot(chosen[slot], {
      slot, origin, onRemove: () => {
        updateSelection(chooseSlot(state.selected, slot, null));
        select.focus();
      },
    }));
  }
}

function renderInventory() {
  const list = $("sneakerList");
  const focusedCard = document.activeElement?.closest(".sneaker-card")?.dataset.id;
  const items = filterInventory(state.items, $("searchInput").value, $("brandFilter").value);
  $("resultCount").textContent = `${String(items.length).padStart(2, "0")} PAIRS`;
  if (!items.length) {
    const empty = element("div", "state-panel");
    empty.append(element("span", "state-symbol", "↗"), element("h3", "", "No pairs found."),
      element("p", "", "Try another name, colorway, or brand. Your selected pairs are still saved above."));
    const reset = element("button", "pill", "Show all pairs ↗");
    reset.type = "button";
    reset.addEventListener("click", () => { resetFilters(); $("searchInput").focus(); });
    empty.append(reset);
    list.replaceChildren(empty);
  } else {
    list.replaceChildren(...items.map((item) => InventoryCard(item, {
      origin, selected: state.selected.includes(item.id), full: isPairReady(state.selected), onToggle,
    })));
  }
  if (focusedCard) list.querySelector(`[data-id="${focusedCard}"]`)?.focus({ preventScroll: true });
  $("catalogNote").textContent = isPairReady(state.selected) ?
    "Two pairs selected. Remove a selected card or change a selector to try a different pairing." :
    "Select a card or use the two selectors above. Your selection stays with you while you browse.";
}

function renderComparison() {
  const section = $("comparison");
  section.hidden = !state.comparing || !isPairReady(state.selected);
  if (section.hidden) { $("comparisonTable").replaceChildren(); return; }
  const [left, right] = selectedItems();
  const fitUrl = new URL(config.fitPath || "/", apiOrigin(config.fitOrigin || "http://127.0.0.1:8002"));
  fitUrl.search = new URLSearchParams({ reference: left.id, target: right.id });
  $("fitLink").href = fitUrl.href;
  const differencesOnly = $("differencesOnly").checked;
  const count = FIELDS.filter(([key]) => isDifferent(left, right, key)).length;
  $("differenceCount").textContent = `${count} / 14 DIFFERENCES`;
  $("comparisonTable").replaceChildren(ComparisonTable(left, right, { origin, differencesOnly }));
  if (differencesOnly && count === 0) {
    $("comparisonTable").append(element("p", "catalog-note", "These pairs match on all 14 details. Turn off the filter to see them all."));
  }
}

function resetFilters() {
  $("searchInput").value = "";
  $("brandFilter").value = "";
  renderInventory();
}

async function loadInventory() {
  if (state.loading) return;
  state.loading = true;
  $("sneakerList").setAttribute("aria-busy", "true");
  $("sneakerList").replaceChildren(element("p", "loading-message", "Opening the archive…"));
  $("resultCount").textContent = "LOADING";
  try {
    origin = apiOrigin(config.apiOrigin);
    $("archiveHome").href = $("archiveLink").href = `${origin}/archive`;
    state.items = (await fetchCatalog(config)).sort((a, b) => a.id - b.id);
    state.selected = state.selected.map((id) => state.items.some((item) => item.id === id) ? id : null);
    const brands = [...new Set(state.items.map(({ attributes }) => attributes.brand))].sort();
    $("brandFilter").replaceChildren(new Option("All brands", ""), ...brands.map((brand) => new Option(brand, brand)));
    renderInventory();
    renderComparison();
    announce(`${state.items.length} sneakers loaded from the archive. Choose two pairs.`);
  } catch (error) {
    state.items = [];
    state.selected = [null, null];
    state.comparing = false;
    renderComparison();
    $("resultCount").textContent = "UNAVAILABLE";
    const panel = element("div", "state-panel");
    const message = error.message;
    panel.append(element("span", "state-symbol", "↗"), element("h3", "", "The archive couldn’t load."), element("p", "", message));
    const retry = element("button", "pill", "Try again ↗");
    retry.type = "button";
    retry.addEventListener("click", async () => {
      await loadInventory();
      if ($("pairOne").disabled) $("sneakerList").querySelector("button")?.focus();
      else $("pairOne").focus();
    });
    panel.append(retry);
    $("sneakerList").replaceChildren(panel);
    announce(message);
  } finally {
    state.loading = false;
    $("sneakerList").setAttribute("aria-busy", "false");
    renderSelection();
  }
}

for (const [slot, id] of ["pairOne", "pairTwo"].entries()) {
  $(id).addEventListener("change", (event) => {
    const value = event.target.value ? Number(event.target.value) : null;
    updateSelection(chooseSlot(state.selected, slot, value));
  });
}
$("compareButton").addEventListener("click", () => {
  if (!isPairReady(state.selected)) return;
  state.comparing = true;
  renderComparison();
  $("comparison").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  $("comparisonHeading").focus({ preventScroll: true });
  announce("Comparison ready. All 14 attributes are aligned side by side.");
});
$("differencesOnly").addEventListener("change", renderComparison);
$("swapPairs").addEventListener("click", () => updateSelection([...state.selected].reverse()));
$("searchForm").addEventListener("submit", (event) => { event.preventDefault(); if (state.items.length) renderInventory(); });
$("searchInput").addEventListener("input", () => { if (state.items.length) renderInventory(); });
$("brandFilter").addEventListener("change", () => { if (state.items.length) renderInventory(); });
$("resetFilters").addEventListener("click", () => { if (state.items.length) resetFilters(); });
renderSelection();
loadInventory();
