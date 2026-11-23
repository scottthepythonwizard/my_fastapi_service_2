const fields = [
  { name: "brand", label: "Brand" },
  { name: "name", label: "Sneaker name" },
  { name: "shoe_reference_number", label: "Shoe reference number" },
  { name: "category", label: "Category", choices: ["Basketball", "Running", "Lifestyle", "Football"] },
  { name: "year", label: "Release year", min: 1800, max: 2200, optional: true },
  { name: "release_month", label: "Release month (1–12)", min: 1, max: 12, optional: true },
  { name: "gender_target", label: "Gender target", choices: ["Men", "Women", "Both"] },
  { name: "retail_price", label: "Retail price" },
  { name: "colorway", label: "Colorway" },
  { name: "review_stars", label: "Review stars (0–5)", min: 0, max: 5, step: "any" },
  { name: "descriptive_overview", label: "Overview", multiline: true },
  { name: "description", label: "Description", multiline: true },
  { name: "details_specifications", label: "Specifications", multiline: true },
  { name: "materials", label: "Materials" },
  { name: "country_of_origin", label: "Country of origin" },
  { name: "closure_type", label: "Closure type", choices: ["Lace-up", "Laceless", "Slip-on", "Hook-and-loop", "Not documented"] },
  { name: "cut", label: "Cut", choices: ["Low", "Mid", "High", "Not documented"] },
  { name: "sole_material", label: "Sole material" },
  { name: "cushioning", label: "Cushioning" },
  { name: "weight_g", label: "Weight (g)", min: 0, optional: true, step: "any" },
  { name: "image_url", label: "Catalog image" },
  { name: "image_note", label: "Image note", optional: true },
  { name: "provenance", label: "Provenance (JSON object)", multiline: true },
];

function create(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, action) {
  const node = create("button", text);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}

function formControl(field, record) {
  const choices = field.choices;
  const control = create(choices ? "select" : field.multiline ? "textarea" : "input");
  control.name = field.name;
  control.autocomplete = "off";
  control.required = !field.optional;
  if (choices) {
    control.append(new Option("Choose…", ""), ...choices.map((choice) => new Option(choice)));
  } else if (field.min !== undefined) {
    control.type = "number";
    control.min = field.min;
    if (field.max !== undefined) control.max = field.max;
    control.step = field.step ?? "1";
  }
  control.value = record?.[field.name] ?? (field.name === "provenance" ? "{}" : "");
  if (field.name === "provenance" && record) control.value = JSON.stringify(record.provenance, null, 2);
  return control;
}

function readFields(form, schema) {
  const values = {};
  for (const field of schema) {
    const control = form.elements[field.name];
    const text = control.value.trim();
    let value = text;
    let error = "";
    if (field.name === "provenance") {
      try { value = JSON.parse(text); } catch { value = null; }
      if (!value || Array.isArray(value) || typeof value !== "object") error = "Enter a valid JSON object.";
    } else if (field.min !== undefined) {
      value = text === "" ? null : Number(text);
      if (field.name === "weight_g" && value !== null && value <= 0) error = "Weight must be greater than zero.";
    } else if (!field.optional && !text) error = "Enter a value for this field.";
    if (error) {
      control.setCustomValidity(error);
      control.reportValidity();
      control.focus();
      return;
    }
    values[field.name] = value;
  }
  return values;
}

function errorMessage(error) {
  if (error?.code === "23505") return "This shoe reference number is already in use.";
  if (error?.code === "42501" || error?.code === "PGRST116") return "The record changed or you no longer have permission.";
  if (error?.code === "23514" || error?.code === "23502") return "Check the form. A value does not meet the catalog rules.";
  return "Couldn’t finish this change. Try again.";
}

export async function renderAdmin(client, body, status) {
  const catalog = () => client.schema("sole").from("sneakers");
  const workspace = create("section");
  workspace.className = "sole-admin";
  body.replaceChildren(workspace);
  const toolbar = create("div");
  toolbar.className = "sole-admin-toolbar";
  const picker = create("select");
  picker.name = "sneaker";
  picker.autocomplete = "off";
  const pickerLabel = create("label", "View or edit an existing sneaker");
  pickerLabel.append(picker);
  const editor = create("div");
  let records = [];
  let busy = false;
  let selected = "";

  function canChangeEditor() {
    return !editor.querySelector("[data-unsaved]") || window.confirm("Discard your unsaved sneaker changes?");
  }

  async function load(preferred) {
    const { data, error } = await catalog().select("*").order("id");
    if (error) throw error;
    records = data;
    picker.replaceChildren(new Option("Choose a sneaker…", ""), ...records.map((row) =>
      new Option(`${row.brand} ${row.name} · #${row.id}`, row.id)));
    if (preferred) {
      picker.value = String(preferred);
      selected = picker.value;
      showEditor(records.find((record) => record.id === preferred));
    }
  }

  status.textContent = "Loading catalog…";
  const response = await fetch("/sole-account-images", { cache: "no-store" });
  if (!response.ok) throw new Error("Image inventory unavailable");
  const images = await response.json();

  function showEditor(record = null) {
    const schema = fields.map((field) => field.name === "image_url"
      ? { ...field, choices: [...new Set([...images, ...(record ? [record.image_url] : [])])] }
      : field);
    const form = create("form");
    form.className = "sole-account-form sole-admin-form";
    form.addEventListener("input", () => { form.dataset.unsaved = ""; });
    const heading = create("h3", record ? `Sneaker #${record.id}` : "Add sneaker");
    const grid = create("div");
    grid.className = "sole-admin-fields";
    for (const field of schema) {
      const label = create("label", field.label);
      if (field.multiline) label.className = "sole-wide";
      const control = formControl(field, record);
      control.addEventListener("input", () => control.setCustomValidity(""));
      label.append(control);
      grid.append(label);
    }
    const actions = create("div");
    actions.className = "sole-admin-actions";
    const submit = create("button", record ? "Save changes" : "Add sneaker");
    submit.type = "submit";
    actions.append(submit);
    function setBusy(value) {
      busy = value;
      for (const control of form.elements) control.disabled = value;
      picker.disabled = value;
      add.disabled = value;
    }
    if (record) actions.append(button("Delete sneaker", async () => {
      if (!window.confirm(`Delete ${record.brand} ${record.name}? Its saved favorites will also be removed.`)) return;
      setBusy(true);
      status.textContent = "Deleting sneaker…";
      try {
        const { error } = await catalog().delete().eq("id", record.id).select("id").single();
        if (error) throw error;
        editor.replaceChildren();
        selected = "";
        await load();
        picker.focus();
        status.textContent = "Sneaker deleted. Refresh a catalog page to see the change.";
      } catch (error) { status.textContent = errorMessage(error); }
      finally { setBusy(false); }
    }));
    form.append(heading, grid, actions);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy) return;
      const values = readFields(form, schema);
      if (!values) return;
      setBusy(true);
      status.textContent = "Saving sneaker…";
      try {
        const query = record ? catalog().update(values).eq("id", record.id) : catalog().insert(values);
        const { data, error } = await query.select("id").single();
        if (error) throw error;
        delete form.dataset.unsaved;
        await load(data.id);
        picker.focus();
        status.textContent = "Sneaker saved. Refresh a catalog page to see the change.";
      } catch (error) { status.textContent = errorMessage(error); }
      finally { setBusy(false); }
    });
    editor.replaceChildren(form);
  }

  const add = button("New sneaker", () => {
    if (!canChangeEditor()) return;
    picker.value = "";
    selected = "";
    showEditor();
    editor.querySelector("input").focus();
    status.textContent = "";
  });
  picker.addEventListener("change", () => {
    if (!canChangeEditor()) { picker.value = selected; return; }
    selected = picker.value;
    const record = records.find((row) => row.id === Number(picker.value));
    if (record) showEditor(record);
    else editor.replaceChildren();
    status.textContent = "";
  });
  toolbar.append(pickerLabel, add);
  workspace.append(toolbar, editor);
  await load();
  status.textContent = "";
}
