import { FIELDS, formatValue, imageUrl, isDifferent } from "./core.js";

export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

export function sneakerImage(item, origin, className = "") {
  const image = element("img", className);
  image.src = imageUrl(item, origin);
  image.alt = `${item.attributes.brand} ${item.attributes.name}${item.image_note ? " (alternate colorway pictured)" : ""}`;
  image.loading = "lazy";
  image.addEventListener("error", () => {
    image.hidden = true;
    image.parentElement.append(element("span", "image-unavailable", "Image unavailable"));
  }, { once: true });
  return image;
}

export function InventoryCard(item, { origin, selected, full, onToggle }) {
  const shoe = item.attributes;
  const card = element("button", `sneaker-card${selected ? " is-selected" : ""}`);
  card.type = "button";
  card.dataset.id = item.id;
  card.setAttribute("aria-label", `${selected ? "Remove" : "Select"} ${shoe.brand} ${shoe.name}`);
  card.setAttribute("aria-pressed", String(selected));
  card.setAttribute("aria-disabled", String(full && !selected));
  const visual = element("div", "card-image");
  visual.append(element("span", "card-year", shoe.year), sneakerImage(item, origin),
    element("span", "selection-mark", selected ? "✓" : "+"));
  const copy = element("div", "card-copy");
  const bottom = element("div", "card-bottom");
  bottom.append(element("span", "card-colorway", shoe.colorway), element("span", "card-price", shoe.retail_price));
  copy.append(element("p", "card-brand", shoe.brand), element("h3", "", shoe.name), bottom);
  card.append(visual, copy);
  card.addEventListener("click", () => onToggle(item.id));
  return card;
}

export function SelectionSlot(item, { slot, origin, onRemove }) {
  const content = element("div", `slot-content${item ? " filled" : ""}`);
  if (!item) {
    const mark = element("span", "slot-placeholder", "+");
    mark.setAttribute("aria-hidden", "true");
    content.append(mark, element("p", "slot-empty", `Your ${slot === 0 ? "first" : "second"} pair goes here.`));
  } else {
    content.append(sneakerImage(item, origin), element("p", "card-brand", item.attributes.brand),
      element("h3", "", item.attributes.name));
    const remove = element("button", "slot-remove", "×");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove pair ${slot + 1}`);
    remove.addEventListener("click", onRemove);
    content.append(remove);
  }
  return content;
}

function AttributeCell(item, key) {
  const cell = element("td", "", formatValue(item, key));
  const evidence = item.provenance?.[key];
  if (evidence?.status === "estimated") cell.append(element("span", "data-badge", "Estimated"));
  if (evidence?.note && ["weight_g", "release_month"].includes(key)) {
    cell.append(element("span", "data-note", evidence.note));
  }
  if (key === "country_of_origin") {
    cell.append(element("span", "data-note", "Archive origin; manufacturing location is unverified."));
  }
  return cell;
}

export function ComparisonTable(left, right, { origin, differencesOnly }) {
  const table = element("table", "comparison-table");
  table.append(element("caption", "sr-only", `Fourteen-attribute comparison: ${left.attributes.name} and ${right.attributes.name}`));
  const head = element("thead");
  const row = element("tr");
  const intro = element("th", "table-intro");
  intro.scope = "col";
  intro.append(element("span", "micro", "THE DETAILS"), element("p", "", "Every detail.\nBoth pairs."));
  row.append(intro);
  for (const [index, item] of [left, right].entries()) {
    const heading = element("th", "shoe-heading");
    heading.scope = "col";
    const visual = element("div", "comparison-image");
    visual.append(element("span", "micro", `PAIR / 0${index + 1}`), sneakerImage(item, origin));
    heading.append(visual, element("span", "card-brand", item.attributes.brand), element("h3", "", item.attributes.name));
    if (item.image_note) heading.append(element("p", "data-note", item.image_note));
    row.append(heading);
  }
  head.append(row);
  const body = element("tbody");
  for (const [key, label] of FIELDS) {
    const different = isDifferent(left, right, key);
    if (differencesOnly && !different) continue;
    const attribute = element("tr", different ? "different" : "");
    attribute.dataset.attribute = key;
    const name = element("th", "attribute-label", label);
    name.scope = "row";
    attribute.append(name, AttributeCell(left, key), AttributeCell(right, key));
    body.append(attribute);
  }
  table.append(head, body);
  return table;
}
