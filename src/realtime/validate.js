/* Shared presence schema. Loaded as a classic script in the browser and imported for its side effect by server/state.js. */
(function (root) {
  const MAX_BYTES = 2048;
  const ROOMS = Object.freeze(['laundry', 'spa']);
  const MAX_UNTIL_MS = 600000;
  const fields = ['in','x','z','fy','a','n','l','t','c','m','ms','mu','f'];
  const integer = (x, min, max) => Number.isInteger(x) && x >= min && x <= max;
  const finite = (x, min, max) => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
  function validatePresence(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p) || Object.keys(p).length !== fields.length || fields.some(k => !Object.hasOwn(p,k))) return false;
    return integer(p.in,0,1) && finite(p.x,-100,100) && finite(p.z,-100,100) && (p.fy === null || finite(p.fy,-100,100)) && integer(p.a,0,7)
      && Array.isArray(p.n) && p.n.length === 2 && p.n.every(v => integer(v,0,7))
      && Array.isArray(p.l) && p.l.length === 3 && p.l.every((v,i) => integer(v,0,[5,4,3][i]))
      && integer(p.t,0,1) && integer(p.c,0,1) && integer(p.m,-1,3) && integer(p.ms,0,2) && finite(p.mu,0,Number.MAX_SAFE_INTEGER) && integer(p.f,0,20);
  }
  /* UTF-8 size of the JSON encoding; Infinity when the value cannot be encoded. */
  function jsonBytes(value) {
    try { return new TextEncoder().encode(JSON.stringify(value)).length; } catch { return Infinity; }
  }
  function withinSize(value) { return jsonBytes(value) <= MAX_BYTES; }
  /* Room rules shared by every transport: no machines in the spa, leaving frees the machine, wash end capped at 10 minutes. */
  function normalize(room, p, now = Date.now()) {
    const next = {...p, n:[...p.n], l:[...p.l]};
    if (room === 'spa' || !next.in || next.m < 0) Object.assign(next,{m:-1,ms:0,mu:0});
    else next.mu = Math.min(next.mu, now + MAX_UNTIL_MS);
    return next;
  }
  root.SaebyeokValidate = Object.freeze({MAX_BYTES, ROOMS, MAX_UNTIL_MS, validatePresence, jsonBytes, withinSize, normalize});
})(globalThis);
