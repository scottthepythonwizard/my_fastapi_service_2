(() => {
const { CommunityVoteCard, fitRequest, node } = window.SoleFitCommunity;
const { FitMatrix, InventoryCard, Recommendation, ShoePreview } = window.SoleFitComponents;

const $ = (id) => document.getElementById(id);
const state = { items: [], sizes: {}, recommendation: null };
let recommendationRequest = 0;
let opener;
const dialog = $("fitDialog");
const WIDTHS = ["narrow", "standard", "wide"];

function updateSizes() {
  const values = state.sizes[$("sizeSystem").value] || [];
  $("referenceSize").replaceChildren(...values.map((size) => new Option(String(size), String(size))));
  $("referenceSize").value = String($("sizeSystem").value === "eu" ? 42.5 : $("sizeSystem").value === "us_women" ? 10.5 : 9);
}

function invalidate() {
  recommendationRequest++;
  $("recommendButton").disabled = false;
  $("recommendButton").textContent = "Find my fit ↗";
  state.recommendation = null;
  $("result").hidden = true;
  $("matrixSection").hidden = true;
  $("calculatorStatus").textContent = "";
}

function updatePreviews() {
  for (const [select, host] of [["referenceShoe", "referencePreview"], ["targetShoe", "targetPreview"]]) {
    const item = state.items.find((candidate) => candidate.id === Number($(select).value));
    $(host).replaceChildren(...(item ? [ShoePreview(item)] : []));
  }
  invalidate();
}

async function calculate(event) {
  event?.preventDefault();
  const serial = ++recommendationRequest;
  $("recommendButton").disabled = true;
  $("recommendButton").textContent = "Reading the fit…";
  $("calculatorStatus").textContent = "";
  const params = new URLSearchParams({ reference_shoe_id: $("referenceShoe").value, target_shoe_id: $("targetShoe").value,
    reference_size: $("referenceSize").value, size_system: $("sizeSystem").value, foot_width: WIDTHS[Number($("footWidth").value)] });
  try {
    const result = await fitRequest(`/api/fit/recommend?${params}`);
    if (serial !== recommendationRequest) return;
    state.recommendation = result;
    $("result").replaceChildren(Recommendation(result));
    $("result").hidden = false;
    $("fitMatrix").replaceChildren(FitMatrix(result.reference_profile, result.target_profile));
    $("matrixSection").hidden = false;
    $("calculatorStatus").textContent = `Recommended size ${result.recommended_size}.`;
  } catch (error) {
    if (serial !== recommendationRequest) return;
    $("result").hidden = true; $("matrixSection").hidden = true;
    $("calculatorStatus").textContent = error.message;
  } finally {
    if (serial === recommendationRequest) {
      $("recommendButton").disabled = false;
      $("recommendButton").textContent = "Find my fit ↗";
    }
  }
}

function openDetail(item) {
  opener = document.activeElement;
  $("detailTitle").textContent = item.attributes.name;
  $("detailPreview").replaceChildren(ShoePreview(item));
  const tags = node("dl", "detail-tags");
  for (const [key, label] of [["cut", "Cut"], ["closure_type", "Closure"], ["materials", "Materials"], ["cushioning", "Cushioning"]]) {
    tags.append(node("dt", "micro", label), node("dd", "", item.attributes[key]));
  }
  $("detailTags").replaceChildren(tags);
  const host = node("div");
  $("communityCard").replaceChildren(host);
  CommunityVoteCard(host, item.id, window.SOLE_FIT_CONFIG.apiOrigin, () => {
    if (state.recommendation && [state.recommendation.reference_shoe_id, state.recommendation.target_shoe_id].includes(item.id)) calculate();
  });
  $("useAsTarget").onclick = () => {
    $("targetShoe").value = String(item.id); updatePreviews(); dialog.close(); $("targetShoe").focus();
  };
  dialog.showModal();
  $("closeDetail").focus();
}

function renderInventory() {
  const query = $("catalogSearch").value.trim().toLowerCase();
  const items = state.items.filter((item) => `${item.attributes.brand} ${item.attributes.name}`.toLowerCase().includes(query));
  $("inventory").replaceChildren(...items.map((item) => InventoryCard(item, openDetail)));
  if (!items.length) $("inventory").append(node("p", "fit-note", "No pairs match. Try another brand or model."));
  $("catalogCount").textContent = `${items.length} PAIRS`;
}

async function load() {
  $("loadStatus").textContent = "Opening the shared archive…";
  $("retryLoad").hidden = true;
  try {
    const [catalog, sizes] = await Promise.all([fitRequest("/api/catalog"), fitRequest("/api/fit/sizes")]);
    state.items = catalog.items; state.sizes = sizes;
    for (const id of ["referenceShoe", "targetShoe"]) {
      $(id).replaceChildren(...state.items.map((item) => new Option(`${item.attributes.brand} ${item.attributes.name}`, String(item.id))));
    }
    if (!state.items.length) {
      $("calculatorFields").disabled = true;
      renderInventory();
      $("loadStatus").textContent = "The archive has no sneakers yet.";
      return;
    }
    const params = new URLSearchParams(location.search);
    const reference = state.items.find((item) => item.id === Number(params.get("reference"))) || state.items[0];
    const target = state.items.find((item) => item.id === Number(params.get("target"))) || state.items[5] || reference;
    $("referenceShoe").value = String(reference.id); $("targetShoe").value = String(target.id);
    updateSizes(); updatePreviews(); renderInventory();
    $("calculatorFields").disabled = false;
    $("loadStatus").textContent = `${catalog.count} pairs in the shared archive.`;
  } catch (error) {
    $("loadStatus").textContent = error.message; $("retryLoad").hidden = false;
  }
}

$("calculator").addEventListener("submit", calculate);
for (const id of ["referenceShoe", "targetShoe"]) $(id).addEventListener("change", updatePreviews);
$("sizeSystem").addEventListener("change", () => { updateSizes(); invalidate(); });
$("referenceSize").addEventListener("change", invalidate);
$("footWidth").addEventListener("input", () => {
  $("widthLabel").textContent = WIDTHS[Number($("footWidth").value)];
  $("footWidth").setAttribute("aria-valuetext", $("widthLabel").textContent);
  invalidate();
});
$("catalogSearch").addEventListener("input", renderInventory);
$("retryLoad").addEventListener("click", load);
$("closeDetail").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => opener?.focus());
const archiveOrigin = window.SOLE_FIT_CONFIG?.archiveOrigin;
if (archiveOrigin) $("archiveLink").href = new URL("/archive", archiveOrigin).href;
load();
})();
