(() => {
function node(tag, className = "", text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

// File pages cannot rely on cross-site cookies; keep the anonymous voter ID locally.
let voterToken;
function fileVoterToken() {
  if (voterToken) return voterToken;
  try { voterToken = localStorage.getItem("solefit_voter"); } catch {}
  if (!/^[0-9a-f]{64}$/.test(voterToken || "")) {
    voterToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    try { localStorage.setItem("solefit_voter", voterToken); } catch {}
  }
  return voterToken;
}

async function fitRequest(path, options = {}, origin = window.SOLE_FIT_CONFIG.apiOrigin) {
  const url = `${origin.replace(/\/$/, "")}${path}`;
  const fromFile = location.protocol === "file:";
  let response;
  try {
    response = await fetch(url, { ...options, credentials: fromFile ? "omit" : "include", cache: "no-store",
      signal: AbortSignal.timeout(10000), headers: { ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(fromFile && options.method === "POST" ? { "X-SoleFit-Voter": fileVoterToken() } : {}), ...options.headers } });
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
    if (!response) throw new Error(`The SoleFit API could not be reached. Run START_SOLE.cmd in the main project folder, then reopen Sole Fit.`, { cause });
    throw cause;
  }
}

const LABELS = { runs_small: "Runs small", true_to_size: "True to size", runs_large: "Runs large",
  narrow: "Narrow", standard: "Standard", wide: "Wide" };

function distribution(stats) {
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

async function CommunityVoteCard(host, sneakerId, origin, onVote) { host.replaceChildren(node('h3', '', 'Community feedback'), node('p', 'fit-note', 'Community voting is disabled in preview mode.')); }

window.SoleFitCommunity = { node, fitRequest, distribution, CommunityVoteCard };
})();
