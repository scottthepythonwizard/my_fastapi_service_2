(() => {
const { node } = window.SoleFitCommunity;

function sneakerImage(item) {
  const origin = window.SOLE_FIT_CONFIG?.archiveOrigin || "http://127.0.0.1:8000";
  return new URL(item.image_url, origin).href;
}

function ShoePreview(item) {
  const host = node("div", "shoe-preview");
  const image = node("img");
  image.src = sneakerImage(item);
  image.alt = `${item.attributes.brand} ${item.attributes.name}`;
  image.width = 180; image.height = 100;
  const text = node("div");
  text.append(node("p", "micro", item.attributes.brand), node("h3", "", item.attributes.name),
    node("p", "fit-note", `${item.attributes.cut} cut · ${item.attributes.closure_type}`));
  host.append(image, text);
  return host;
}

function FitScale(label, selected, choices) {
  const host = node("div", "fit-scale");
  host.append(node("p", "micro", label));
  const rail = node("div", "scale-rail");
  rail.setAttribute("role", "img");
  rail.setAttribute("aria-label", `${label}: ${selected}`);
  for (const value of choices) rail.append(node("span", value === selected ? "scale-tick active" : "scale-tick", value));
  host.append(rail);
  return host;
}

function FitMatrix(reference, target) {
  const matrix = node("div", "matrix-grid");
  for (const [role, profile] of [["YOUR REFERENCE", reference], ["YOUR NEXT PAIR", target]]) {
    const card = node("article", "matrix-card");
    card.append(node("p", "micro", role), node("h3", "", profile.name), node("p", "fit-note", profile.basis),
      FitScale("Length profile", profile.length_profile, ["Runs Small", "True to Size", "Runs Large"]),
      FitScale("Width profile", profile.width_profile, ["Narrow", "Standard", "Wide"]));
    const details = node("details", "structure-notes");
    details.open = true;
    details.append(node("summary", "micro", "WHY IT FEELS THIS WAY"));
    const list = node("ul");
    for (const note of profile.structural_notes) list.append(node("li", "", note));
    details.append(list); card.append(details);
    matrix.append(card);
  }
  return matrix;
}

function Recommendation(result) {
  const host = node("article", "recommendation");
  const label = { us_men: "US MEN", us_women: "US WOMEN", eu: "EU APPROX." }[result.size_system];
  host.append(node("p", "micro", "YOUR STARTING POINT"), node("div", "recommended-size", `${label} ${result.recommended_size}`),
    node("p", "recommend-reason", result.reason),
    node("p", "fit-note", `US men ${result.recommended_us_men} / US women ${result.recommended_us_women} / EU ≈ ${result.recommended_eu}`),
    node("p", "fit-note", result.conversion_note));
  return host;
}

function InventoryCard(item, onOpen) {
  const shoe = item.attributes;
  const card = node("button", "inventory-card");
  card.type = "button";
  card.setAttribute("aria-label", `Fit details for ${shoe.brand} ${shoe.name}`);
  const image = node("img");
  image.src = sneakerImage(item); image.alt = ""; image.loading = "lazy"; image.width = 280; image.height = 200;
  const visual = node("div", "card-image");
  visual.append(image);
  card.append(visual, node("p", "micro", shoe.brand), node("h3", "", shoe.name),
    node("p", "fit-note", `${shoe.cut} cut · ${shoe.closure_type}`), node("span", "micro", "FIT DETAILS & COMMUNITY ↗"));
  card.addEventListener("click", () => onOpen(item));
  return card;
}

window.SoleFitComponents = { ShoePreview, FitScale, FitMatrix, Recommendation, InventoryCard };
})();
