import * as THREE from 'three';
import { TROOP_TYPES } from '../data/troops.js';

export class TroopRenderer {
  constructor(scene) {
    this.scene = scene;
    this.troopMeshes = new Map();
    this.time = 0;
  }

  update(dt, troops) {
    this.time += dt;
    const activeTroopIds = new Set();

    for (const troop of troops) {
      activeTroopIds.add(troop.id);

      let mesh = this.troopMeshes.get(troop.id);
      if (!mesh) {
        mesh = this._createTroopMesh(troop);
        this.troopMeshes.set(troop.id, mesh);
      }

      // Update position
      mesh.position.x = troop.x;
      mesh.position.y = troop.isFlying ? 1.2 : 0.15 + Math.sin(this.time * 8 + troop.id) * 0.05;
      mesh.position.z = troop.z;

      // Movement direction
      if (troop.pathIndex < troop.path.length - 1) {
        const next = troop.path[Math.min(troop.pathIndex + 1, troop.path.length - 1)];
        const dx = next.x - troop.x;
        const dz = next.y - troop.z;
        if (dx !== 0 || dz !== 0) {
          mesh.rotation.y = Math.atan2(dx, dz);
        }
      }

      // Scale animation
      const walkBob = 1 + Math.sin(this.time * 10 + troop.id * 2) * 0.08;
      const baseScale = troop.scale * 2;
      mesh.scale.set(baseScale, baseScale * walkBob, baseScale);

      // Invulnerability flash
      if (troop.invulnTimer > 0) {
        mesh.visible = Math.sin(this.time * 30) > 0;
      } else {
        mesh.visible = true;
      }

      // Stun indicator
      if (troop.stunTimer > 0) {
        mesh.rotation.z = Math.sin(this.time * 20) * 0.2;
      } else {
        mesh.rotation.z = 0;
      }

      // Shield visual
      const shieldMesh = mesh.userData.shield;
      if (shieldMesh) {
        shieldMesh.visible = troop.shieldHp > 0;
        if (troop.shieldHp > 0) {
          shieldMesh.material.opacity = 0.15 + Math.sin(this.time * 3) * 0.05;
        }
      }

      // Golden glow
      if (troop.isGolden && mesh.userData.glowMesh) {
        mesh.userData.glowMesh.material.opacity = 0.2 + Math.sin(this.time * 4) * 0.1;
      }

      // HP bar
      const hpBar = mesh.userData.hpBar;
      if (hpBar) {
        const hpPercent = troop.hp / troop.maxHp;
        hpBar.scale.x = Math.max(0.01, hpPercent);
        hpBar.material.color.setHex(hpPercent > 0.5 ? 0x4caf50 : hpPercent > 0.25 ? 0xffc107 : 0xe74c3c);
        hpBar.visible = hpPercent < 1;
      }
    }

    // Remove meshes for dead/gone troops
    for (const [id, mesh] of this.troopMeshes) {
      if (!activeTroopIds.has(id)) {
        this.scene.remove(mesh);
        this.troopMeshes.delete(id);
      }
    }
  }

  _createTroopMesh(troop) {
    const group = new THREE.Group();
    const def = TROOP_TYPES[troop.type];

    switch (troop.type) {
      case 'ant': this._buildAnt(group, troop); break;
      case 'beetle': this._buildBeetle(group, troop); break;
      case 'cricket': this._buildCricket(group, troop); break;
      case 'butterfly': this._buildButterfly(group, troop); break;
      case 'caterpillar': this._buildCaterpillar(group, troop); break;
      case 'spider': this._buildSpider(group, troop); break;
    }

    // Shield bubble
    const shieldGeo = new THREE.SphereGeometry(0.5, 8, 8);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x88ccff, transparent: true, opacity: 0.15, side: THREE.DoubleSide
    });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.visible = false;
    shield.position.y = 0.3;
    group.add(shield);
    group.userData.shield = shield;

    // Golden glow
    if (troop.isGolden) {
      const glowGeo = new THREE.SphereGeometry(0.45, 8, 8);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffd700, transparent: true, opacity: 0.2
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.y = 0.3;
      group.add(glow);
      group.userData.glowMesh = glow;
    }

    // HP bar
    const hpBarGeo = new THREE.PlaneGeometry(0.5, 0.06);
    const hpBarMat = new THREE.MeshBasicMaterial({ color: 0x4caf50, side: THREE.DoubleSide });
    const hpBar = new THREE.Mesh(hpBarGeo, hpBarMat);
    hpBar.position.y = 0.8;
    hpBar.rotation.x = -Math.PI / 4;
    hpBar.visible = false;
    group.add(hpBar);
    group.userData.hpBar = hpBar;

    // HP bar background
    const hpBgGeo = new THREE.PlaneGeometry(0.52, 0.08);
    const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
    const hpBg = new THREE.Mesh(hpBgGeo, hpBgMat);
    hpBg.position.y = 0.79;
    hpBg.rotation.x = -Math.PI / 4;
    hpBg.visible = false;
    group.add(hpBg);

    this.scene.add(group);
    return group;
  }

  _buildAnt(group, troop) {
    const color = troop.isGolden ? 0xdaa520 : troop.color;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });

    // Body segments
    const seg1 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 4), mat);
    seg1.position.set(0, 0.2, -0.15);
    group.add(seg1);

    const seg2 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), mat);
    seg2.position.set(0, 0.2, 0);
    group.add(seg2);

    const seg3 = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), mat);
    seg3.position.set(0, 0.2, 0.18);
    group.add(seg3);

    // Antennae
    for (let s = -1; s <= 1; s += 2) {
      const antGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.2);
      const ant = new THREE.Mesh(antGeo, mat);
      ant.position.set(s * 0.08, 0.35, -0.15);
      ant.rotation.z = s * 0.5;
      group.add(ant);
    }
  }

  _buildBeetle(group, troop) {
    const color = troop.isGolden ? 0xdaa520 : troop.color;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 });

    // Shell
    const shellGeo = new THREE.SphereGeometry(0.35, 8, 6);
    shellGeo.scale(1.2, 0.7, 1);
    const shell = new THREE.Mesh(shellGeo, mat);
    shell.position.y = 0.25;
    shell.castShadow = true;
    group.add(shell);

    // Head
    const headGeo = new THREE.SphereGeometry(0.15, 6, 4);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.set(0, 0.25, -0.35);
    group.add(head);

    // Eyes
    for (let s = -1; s <= 1; s += 2) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      eye.position.set(s * 0.1, 0.3, -0.4);
      group.add(eye);
    }

    // Shell line
    const lineGeo = new THREE.BoxGeometry(0.02, 0.01, 0.5);
    const lineMat = new THREE.MeshStandardMaterial({ color: 0x1a3d0a });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.position.set(0, 0.42, 0);
    group.add(line);
  }

  _buildCricket(group, troop) {
    const color = troop.isGolden ? 0xdaa520 : troop.color;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });

    // Slim body
    const bodyGeo = new THREE.CapsuleGeometry(0.1, 0.3, 4, 8);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 0.25;
    body.rotation.x = Math.PI / 6;
    group.add(body);

    // Big back legs
    for (let s = -1; s <= 1; s += 2) {
      const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.3);
      const leg = new THREE.Mesh(legGeo, mat);
      leg.position.set(s * 0.15, 0.15, 0.15);
      leg.rotation.z = s * 0.8;
      group.add(leg);
    }

    // Eyes
    for (let s = -1; s <= 1; s += 2) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      eye.position.set(s * 0.07, 0.35, -0.15);
      group.add(eye);
    }
  }

  _buildButterfly(group, troop) {
    const color = troop.isGolden ? 0xdaa520 : troop.color;

    // Body
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.2, 4, 8), bodyMat);
    body.position.y = 0.3;
    group.add(body);

    // Wings
    const wingMat = new THREE.MeshStandardMaterial({
      color, transparent: true, opacity: 0.7, side: THREE.DoubleSide
    });

    for (let s = -1; s <= 1; s += 2) {
      const wingGeo = new THREE.CircleGeometry(0.25, 6);
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.set(s * 0.2, 0.35, 0);
      wing.rotation.y = s * 0.3;
      wing.userData.isWing = true;
      wing.userData.side = s;
      group.add(wing);
    }
  }

  _buildCaterpillar(group, troop) {
    const color = troop.isGolden ? 0xdaa520 : troop.color;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });

    // Body segments
    for (let i = 0; i < 5; i++) {
      const size = 0.12 - i * 0.01;
      const seg = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 4), mat);
      seg.position.set(0, 0.15, i * 0.15 - 0.3);
      group.add(seg);
    }

    // Eyes on front segment
    for (let s = -1; s <= 1; s += 2) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      eye.position.set(s * 0.06, 0.22, -0.35);
      group.add(eye);
    }

    // Regen glow (green sparkle)
    const glowGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x66ff66, transparent: true, opacity: 0.1 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.2;
    group.add(glow);
  }

  _buildSpider(group, troop) {
    const color = troop.isGolden ? 0xdaa520 : troop.color;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });

    // Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), mat);
    body.position.y = 0.2;
    group.add(body);

    // Abdomen
    const abd = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4), mat);
    abd.position.set(0, 0.2, 0.2);
    group.add(abd);

    // Legs
    for (let i = 0; i < 4; i++) {
      for (let s = -1; s <= 1; s += 2) {
        const legGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.3);
        const leg = new THREE.Mesh(legGeo, mat);
        const angle = (i - 1.5) * 0.4;
        leg.position.set(s * 0.2, 0.1, angle * 0.3);
        leg.rotation.z = s * 1.0;
        leg.rotation.x = angle;
        group.add(leg);
      }
    }

    // Eyes (multiple)
    for (let i = 0; i < 4; i++) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
      );
      const a = (i - 1.5) * 0.15;
      eye.position.set(a, 0.28, -0.15);
      group.add(eye);
    }
  }

  clear() {
    for (const [id, mesh] of this.troopMeshes) {
      this.scene.remove(mesh);
    }
    this.troopMeshes.clear();
  }
}
