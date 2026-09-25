/* Remote.js - a friend, as seen from your screen.

   A Character driven by the snapshots their client sends: position (in a
   boat's local frame when they are aboard, so they ride it smoothly), view,
   animation, tool, and their fishing line so you can watch them fight a
   fish from across the boat. */

import * as THREE from '../../lib/three.module.js?v=1790358905';
import { Character, PLAYER_LOOKS } from '../art/Character.js?v=1790358905';
import { buildRod, buildBobber } from '../art/RodArt.js?v=1790358905';
import { ROD_BY_ID } from '../data/GearData.js?v=1790358905';
import { damp, dampAngle } from '../core/Util.js?v=1790358905';

const COLORS = ['#ffd27a', '#8af0ff', '#b8f08a', '#f0a8ff'];
const _v = new THREE.Vector3();

export class Remote {
  constructor(game, id, profile, index) {
    this.game = game;
    this.id = id;
    this.name = profile.name || 'Fisher';
    this.color = COLORS[index % 4];
    this.c = new Character(PLAYER_LOOKS[(profile.look | 0) % 4], index * 13 + 5);
    this.c.setName(this.name, this.color);
    game.scene.add(this.c.root);
    this.pos = new THREE.Vector3();
    this.local = new THREE.Vector3();
    this.eye = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.boat = null;
    this.mode = 'walk'; this.anim = 'idle'; this.tool = 'rod';
    this.hp = 100;
    this.snap = null;
    this.rod = buildRod(ROD_BY_ID.basic);
    this.rod.group.scale.setScalar(0.85);
    this.rod.group.rotation.x = Math.PI / 2 - 0.5;
    this.c.hold(this.rod.group);
    this.bob = buildBobber();
    this.bob.visible = false;
    this.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xe8e8e0 }));
    this.line.frustumCulled = false; this.line.visible = false;
    game.scene.add(this.bob, this.line);
    this.walkie = false;
    this.rodId = 'basic';
  }

  apply(s) {
    this.snap = s;
    if (s.name) this.name = s.name;
  }

  update(dt) {
    const s = this.snap;
    if (!s) return;
    const G = this.game;
    this.boat = s.b ? G.boatById(s.b) : null;
    const k = 1 - Math.exp(-14 * dt);
    if (this.boat) {
      this.local.lerp(_v.set(s.lx, s.ly, s.lz), k);
      this.boat.toWorld(this.local, this.pos);
    } else {
      if (this.pos.distanceTo(_v.set(s.x, s.y, s.z)) > 8) this.pos.copy(_v); else this.pos.lerp(_v, k);
    }
    this.yaw = dampAngle(this.yaw, s.yaw, 14, dt);
    this.pitch = damp(this.pitch, s.pitch, 14, dt);
    this.mode = s.m; this.anim = s.a; this.tool = s.t; this.hp = s.hp;
    this.walkie = !!s.wk;
    // show the rod they are actually holding - every rod is its own model
    if (s.r && s.r !== this.rodId && ROD_BY_ID[s.r]) {
      this.rodId = s.r;
      this.c.hold(null);
      this.rod = buildRod(ROD_BY_ID[s.r]);
      this.rod.group.scale.setScalar(0.85);
      this.rod.group.rotation.x = Math.PI / 2 - 0.5;
      this.c.hold(this.rod.group);
    }
    this.eye.set(this.pos.x, this.pos.y + 1.6, this.pos.z);
    const root = this.c.root;
    root.position.copy(this.pos);
    if (this.mode === 'swim') root.position.y += 0.9;
    root.rotation.y = this.yaw + Math.PI;
    this.c.lookPitch = -this.pitch * 0.6;
    const f = s.f || null;
    let anim = this.anim;
    if (f && (f.s === 'fight')) anim = 'reel';
    else if (f && f.s !== 'idle' && this.anim === 'idle') anim = 'fish';
    if (this.anim === 'fall') { if (!this.c.fallT) this.c.knock(); anim = 'idle'; }
    if (this.anim === 'cheer') anim = 'cheer';
    this.c.update(dt, anim, this.anim === 'walk' ? 2 : this.anim === 'run' ? 5 : 0);
    this.rod.group.visible = this.tool === 'rod' && this.mode !== 'swim';
    // their line
    const on = f && f.s !== 'idle' && f.s !== 'charge' && f.b;
    this.bob.visible = !!on && f.s !== 'fight';
    this.line.visible = !!on;
    if (on) {
      this.bob.position.set(f.b[0], f.b[1], f.b[2]);
      this.rod.bend(f.s === 'fight' ? 0.4 + (f.t || 0) : 0.1, 0);
      this.rod.tip.getWorldPosition(_v);
      this.line.geometry.setFromPoints([_v.clone(), this.bob.position.clone()]);
    }
  }

  holdPoint(it) {
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const heavy = it.kg > 40;
    const p = heavy ? this.pos.clone().addScaledVector(f, 1.1).setY(this.pos.y + 0.2) : this.pos.clone().addScaledVector(f, 0.45).setY(this.pos.y + 1.1);
    return { pos: p, yaw: this.yaw + Math.PI / 2, roll: heavy ? Math.PI / 2 : 0.3 };
  }

  dispose() {
    this.game.scene.remove(this.c.root, this.bob, this.line);
  }
}
