/** Opt-in hiscore client. Contract only — no server is built here. */
const ENDPOINT = "https://teabonetv.github.io/veilforge/hiscores.json";

export function scoresPayload(state, logPct, deepest) {
  return {
    name: state.settings?.hiscoreName || state.name || "Anonymous",
    totalLevel: Object.values(state.skills || {}).reduce((n, s) => n + (s.level || 1), 0),
    logPct: logPct || 0,
    deepestGate: deepest || 0,
    echoBest: state.combat?.echoBest || 0,
    t: Date.now()
  };
}

let lastPost = 0;
export async function submitScores(state, extra = {}) {
  if (!state.settings?.hiscores) return { ok: false, reason: "opt-out" };
  const now = Date.now();
  if (now - lastPost < 60000) return { ok: false, reason: "debounce" };
  lastPost = now;
  const body = scoresPayload(state, extra.logPct, extra.deepest);
  try {
    const res = await fetch(state.settings.hiscoreUrl || ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export async function fetchScores(url) {
  try {
    const res = await fetch(url || ENDPOINT);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.slice(0, 100) : (data.rows || []).slice(0, 100);
  } catch {
    return [];
  }
}
