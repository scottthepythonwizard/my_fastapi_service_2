// Local fallback for an index.html opened as a file. FastAPI serves its own config.js over HTTP.
// START_SOLE.cmd mounts the Fit API under /fit on the shared local server.
window.SOLE_FIT_CONFIG = Object.freeze({
  apiOrigin: "http://127.0.0.1:8000/fit",
  archiveOrigin: "http://127.0.0.1:8000",
});
