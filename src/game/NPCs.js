/* NPCs.js - the people of Driftwood Bay and beyond, standing where
   Settlement put them, plus villagers strolling between the lamps. NPCs
   look at you when you come near and gesture while they talk.

   The fishermen of Vigil's End sit or stand on their cliffs with a rod in
   their hands and a line running down into the fog; they turn their heads
   to you, never their bodies - they have not taken their eyes off the
   water in years. */

import * as THREE from '../../lib/three.module.js?v=1790192871';
import { Character, randomLook } from '../art/Character.js?v=1790192871';
import { buildRod } from '../art/RodArt.js?v=1790192871';
import { ROD_BY_ID } from '../data/GearData.js?v=1790192871';
import { NPCS, VILLAGERS } from '../data/NPCData.js?v=1790192871';
import { damp, wrapAngle } from '../core/Util.js?v=1790192871';

const _v = new THREE.Vector3();

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
      c.setName(def.full.replace(/ (of the|the) .*$/, ''));
      c.root.position.copy(pos);
      c.root.rotation.y = a.face || 0;
      game.scene.add(c.root);
      const n = { def, c, pos, face: a.face || 0, talking: 0, line: 0 };
      if (def.pose === 'fish' || def.pose === 'sitfish') {
        // an old rod, and a line all the way down to the water
        const rod = buildRod(ROD_BY_ID[['basic', 'reinforced', 'deepwater'][def.id.length % 3]]);
        rod.group.scale.setScalar(0.85);
        rod.group.rotation.x = Math.PI / 2 - 0.35;
        c.hold(rod.group);
        rod.bend(0.12, 0);
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xd8d8d0, transparent: true, opacity: 0.6 }));
        line.frustumCulled = false;
        game.scene.add(line);
        n.rod = rod; n.fline = line; n.lineTo = a.line ? a.line.clone() : pos.clone().add(new THREE.Vector3(Math.sin(n.face) * 20, -10, Math.cos(n.face) * 20));
      }
      this.list.push(n);
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
      n.c.root.visible = d < 170;
      if (n.fline) n.fline.visible = n.c.root.visible;
      if (!n.c.root.visible) continue;
      n.talking = Math.max(0, n.talking - dt);
      const P = n.def.pose;
      const still = P === 'sit' || P === 'sitfish' || P === 'fish';
      const pose = P === 'sit' ? 'sit' : P === 'sitfish' ? 'sitfish' : P === 'fish' ? 'fish' : n.talking > 0 ? 'talk' : 'idle';
      // turn to face you when you are close (the sitters and the fishermen only turn their heads)
      if (d < 9 && !still) {
        const want = Math.atan2(me.x - n.pos.x, me.z - n.pos.z);
        n.c.root.rotation.y += wrapAngle(want - n.c.root.rotation.y) * Math.min(1, dt * 3);
      } else if (!still) n.c.root.rotation.y += wrapAngle(n.face - n.c.root.rotation.y) * Math.min(1, dt);
      const hy = Math.atan2(me.x - n.pos.x, me.z - n.pos.z) - n.c.root.rotation.y;
      n.c.lookYaw = d < 9 ? wrapAngle(hy) * (still ? 0.8 : 1) : 0;
      n.c.lookPitch = d < 9 ? -Math.atan2(G.player.eye.y - (n.pos.y + 1.6), d) * 0.6 : (still ? 0.25 : 0);
      n.c.update(dt, pose, 0);
      if (n.fline) {
        n.rod.tip.getWorldPosition(_v);
        const to = n.lineTo;
        to.y = G.world.sea(to.x, to.z);
        n.fline.geometry.setFromPoints([_v.clone(), to.clone()]);
        n.rod.bend(0.12 + Math.sin(G.world.time * 0.7 + n.pos.x) * 0.03, 0);
      }
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

  /** The next line in this person's conversation (they tell their story in order). */
  talk(n) {
    n.talking = 4;
    const line = n.def.lines[n.line % n.def.lines.length];
    n.line++;
    return line;
  }
}
