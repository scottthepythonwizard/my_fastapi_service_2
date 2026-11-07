// FastAPI backend only; index.html opens directly without a frontend server.
// Replace this origin with your hosted SoleFit API URL when available (no trailing slash).
window.SOLE_FIT_CONFIG = Object.freeze({
  apiOrigin: "http://127.0.0.1:8002",
  archiveOrigin: "http://127.0.0.1:8000",
});
