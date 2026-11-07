// Shared by SoleFit and the Archive detail view. All requests go to our own backend.
export function node(tag, className = "", text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export async function fitRequest(path, options = {}, origin = "") {
  const url = `${origin}${path}`;
  let response;
  try {
    response = await fetch(url, { ...options, credentials: "include", cache: "no-store",
      signal: AbortSignal.timeout(10000), headers: { "Content-Type": "application/json", ...options.headers } });
    if (response.status === 204) return null;
    let body;
    try { body = await response.json(); }
    catch (cause) { throw new Error(`SoleFit returned non-JSON data (HTTP ${response.status}).`, { cause }); }
    if (!response.ok) {
      const detail = typeof body.detail === "string" ? body.detail : "Please check the selected sizes and vote choices.";
      throw new Error(`SoleFit HTTP ${response.status}: ${detail}`);
    }
    return body;
  } catch (cause) {
    console.error("[SoleFit] Request failed", { url, method: options.method || "GET", status: response?.status ?? null, error: cause });
    if (!response) throw new Error("SoleFit could not be reached. Start its server on port 8002, then retry.", { cause });
    throw cause;
  }
}

const LABELS = { runs_small: "Runs small", true_to_size: "True to size", runs_large: "Runs large",
  narrow: "Narrow", standard: "Standard", wide: "Wide" };

export function distribution(stats) {
  const host = node("div", "vote-distributions");
  host.append(node("p", "tts-summary", stats.total_votes ? `${stats.tts_percentage}% report True to Size` : "No community votes yet."),
    node("p", "fit-note", `${stats.total_votes} ${stats.total_votes === 1 ? "vote" : "votes"} Ã‚Â· Real feedback, never seeded.`));
  for (const [title, key] of [["Length", "length_distribution"], ["Width", "width_distribution"]]) {
    host.append(node("h4", "micro", title));
    for (const [rating, percentage] of Object.entries(stats[key].percentages)) {
      const row = node("div", "vote-bar-row");
      const track = node("div", "vote-track");
      const fill = node("span", "vote-fill");
      fill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
      track.append(fill);
      row.append(node("span", "", LABELS[rating]), track, node("span", "", `${percentage}%`));
      host.append(row);
    }
  }
  return host;
}

export async function CommunityVoteCard(host, sneakerId, origin, onVote) { host.replaceChildren(node('h3', '', 'Community feedback'), node('p', 'fit-note', 'Feedback is disabled during the database rebuild. Original votes are backed up.')); }
