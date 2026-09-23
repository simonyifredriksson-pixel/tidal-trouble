/* NPCs.js - the people of Driftwood Bay standing where Settlement put them,
   plus villagers strolling between the lamps. NPCs look at you when you
   come near and gesture while they talk. */

import * as THREE from '../../lib/three.module.js?v=1790183165';
import { Character, randomLook } from '../art/Character.js?v=1790183165';
import { NPCS, VILLAGERS } from '../data/NPCData.js?v=1790183165';
import { damp, wrapAngle } from '../core/Util.js?v=1790183165';

export class NPCs {
  constructor(game) {
    this.game = game;
    this.list = [];
    const S = game.world.settlement;
    for (const def of NPCS) {
      const a = S.anchors[def.at];
      if (!a) continue;
      const pos = (a.pos || a).clone();
      const c = new Character(def.look, def.id.length * 17);
      c.setName(def.name);
      c.root.position.copy(pos);
      c.root.rotation.y = a.face || 0;
      game.scene.add(c.root);
      this.list.push({ def, c, pos, face: a.face || 0, talking: 0, line: 0 });
    }
    this.walkers = [];
    const pts = S.anchors.wander || [];
    VILLAGERS.forEach((v, i) => {
      const c = new Character(randomLook(v.seed), v.seed);
      c.setName(v.name, '#e8e0c8');
      const p = pts[i % pts.length].clone();
      c.root.position.copy(p);
      game.scene.add(c.root);
      this.walkers.push({ c, pos: p, target: pts[(i + 3) % pts.length].clone(), wait: Math.random() * 4, h: 0, pts });
    });
  }

  nearest(pos, r = 3) {
    let best = null, bd = r;
    for (const n of this.list) { const d = n.pos.distanceTo(pos); if (d < bd) { bd = d; best = n; } }
    return best;
  }
  byId(id) { return this.list.find(n => n.def.id === id); }

  update(dt) {
    const G = this.game;
    const me = G.player.pos;
    for (const n of this.list) {
      const d = n.pos.distanceTo(me);
      n.c.root.visible = d < 160;
      if (!n.c.root.visible) continue;
      n.talking = Math.max(0, n.talking - dt);
      const pose = n.def.pose === 'sit' ? 'sit' : n.talking > 0 ? 'talk' : 'idle';
      // turn to face you when you are close (not the sitter, he is comfy)
      if (d < 9 && n.def.pose !== 'sit') {
        const want = Math.atan2(me.x - n.pos.x, me.z - n.pos.z);
        n.c.root.rotation.y += wrapAngle(want - n.c.root.rotation.y) * Math.min(1, dt * 3);
      } else if (n.def.pose !== 'sit') n.c.root.rotation.y += wrapAngle(n.face - n.c.root.rotation.y) * Math.min(1, dt);
      const hy = Math.atan2(me.x - n.pos.x, me.z - n.pos.z) - n.c.root.rotation.y;
      n.c.lookYaw = d < 9 ? wrapAngle(hy) : 0;
      n.c.lookPitch = d < 9 ? -Math.atan2(G.player.eye.y - (n.pos.y + 1.6), d) * 0.6 : 0;
      n.c.update(dt, pose, 0);
    }
    for (const w of this.walkers) {
      const d0 = w.pos.distanceTo(me);
      w.c.root.visible = d0 < 150;
      if (w.wait > 0) { w.wait -= dt; w.c.update(dt, 'idle', 0); continue; }
      const dx = w.target.x - w.pos.x, dz = w.target.z - w.pos.z, d = Math.hypot(dx, dz);
      if (d < 1) { w.wait = 3 + Math.random() * 8; w.target = w.pts[Math.floor(Math.random() * w.pts.length)].clone(); w.target.x += (Math.random() - 0.5) * 6; w.target.z += (Math.random() - 0.5) * 6; continue; }
      const want = Math.atan2(dx, dz);
      w.h += wrapAngle(want - w.h) * Math.min(1, dt * 3);
      const sp = 1.3;
      const nx = w.pos.x + Math.sin(w.h) * sp * dt, nz = w.pos.z + Math.cos(w.h) * sp * dt;
      const r = G.world.colliders.resolve(nx, nz, 0.3, w.pos.y + 0.3, 1.4);
      w.pos.x = r.x; w.pos.z = r.z;
      if (r.hit) w.h += dt * 2;
      let g = G.world.ground(w.pos.x, w.pos.z);
      const fl = G.world.colliders.floorAt(w.pos.x, w.pos.z, w.pos.y, 0.6);
      if (fl > g) g = fl;
      w.pos.y = damp(w.pos.y, g, 10, dt);
      if (G.world.waterAt(w.pos.x, w.pos.z) > w.pos.y + 0.3) { w.h += Math.PI; w.target = w.pts[0].clone(); }
      w.c.root.position.copy(w.pos);
      w.c.root.rotation.y = w.h;
      w.c.update(dt, 'walk', sp);
    }
  }

  talk(n) {
    n.talking = 4;
    const line = n.def.lines[n.line % n.def.lines.length];
    n.line++;
    return line;
  }
}
