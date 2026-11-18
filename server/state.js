import '../src/realtime/validate.js';
const shared = globalThis.SaebyeokValidate;
export const MAX_BYTES = shared.MAX_BYTES;
export const ROOMS = new Set(shared.ROOMS);
export const validatePresence = shared.validatePresence;
export function parseMessage(raw) {
  if (Buffer.byteLength(raw) > MAX_BYTES) throw new Error('size');
  const m = JSON.parse(raw.toString());
  if (!m || Object.keys(m).length !== 3 || m.type !== 'presence' || !Number.isSafeInteger(m.id) || m.id < 0 || !validatePresence(m.presence)) throw new Error('format');
  return m;
}
export class RoomState {
  constructor() { this.identities=new Map(); this.rooms = new Map([...ROOMS].map(r => [r,new Map()])); }
  join(room, id,identity=null) { this.identities.set(id,identity); if (!ROOMS.has(room)) throw new Error('room'); this.rooms.get(room).set(id,null); }
  update(room,id,p) {
    if (!validatePresence(p)) throw new Error('presence');
    const peers = this.rooms.get(room);
    if (!peers?.has(id)) throw new Error('peer');
    const next = {...structuredClone(p),identity:this.identities.get(id)||null};
    if (room === 'spa' || !p.in || p.m < 0) Object.assign(next,{m:-1,ms:0,mu:0});
    else {
      if ([...peers].some(([other,q]) => other !== id && q?.in === 1 && q.m === p.m)) {
        const prev = peers.get(id);
        Object.assign(next,{m:prev?.m ?? -1,ms:prev?.ms ?? 0,mu:prev?.mu ?? 0});
        return {accepted:false,presence:next,reason:'occupied',requested:p.m};
      }
      next.mu = Math.min(next.mu,Date.now()+600000);
    }
    const joined = peers.get(id) === null;
    peers.set(id,next);
    return {accepted:true,presence:next,joined};
  }
  leave(room,id) { this.identities.delete(id); return this.rooms.get(room)?.delete(id) ?? false; }
  snapshot(room,exclude) { return [...this.rooms.get(room)].filter(([id,p]) => id !== exclude && p).map(([peer,presence]) => ({peer,kind:'viewer',sameTab:false,presence})); }
}
