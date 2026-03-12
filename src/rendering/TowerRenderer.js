import * as THREE from 'three';
import { TOWER_TYPES } from '../data/towers.js';

export class TowerRenderer {
  constructor(scene) {
    this.scene = scene;
    this.towerMeshes = new Map(); // towerId -> mesh group
    this.rangeIndicators = new Map();
    this.time = 0;
  }

  createTowerMesh(tower, worldX, worldZ) {
    const def = TOWER_TYPES[tower.type];
    const group = new THREE.Group();
    group.position.set(worldX, 0, worldZ);

    switch (tower.type) {
      case 'chomper': this._buildChomper(group, def.color, tower); break;
      case 'splorch': this._buildSplorch(group, def.color, tower); break;
      case 'freezlick': this._buildFreezlick(group, def.color, tower); break;
      case 'goldbug': this._buildGoldbug(group, def.color, tower); break;
      case 'hexling': this._buildHexling(group, def.color, tower); break;
    }

    // Drop-in animation
    group.scale.set(0.01, 0.01, 0.01);
    group.userData.animateIn = true;
    group.userData.animateTime = 0;
    group.userData.towerId = tower.id;
    group.userData.towerType = tower.type;

    this.scene.add(group);
    this.towerMeshes.set(tower.id, group);
    return group;
  }

  _buildChomper(group, color, tower) {
    // Body - round blob
    const bodyGeo = new THREE.SphereGeometry(0.35, 8, 6);
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.4;
    body.castShadow = true;
    group.add(body);

    // Mouth
    const mouthGeo = new THREE.SphereGeometry(0.2, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x3d8b3d, roughness: 0.5 });
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, 0.3, 0.2);
    mouth.rotation.x = Math.PI;
    group.add(mouth);

    // Eyes
    this._addEyes(group, 0.32, 0.55, 0.15);

    // Teeth
    for (let i = -1; i <= 1; i++) {
      const toothGeo = new THREE.ConeGeometry(0.04, 0.1, 4);
      const toothMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const tooth = new THREE.Mesh(toothGeo, toothMat);
      tooth.position.set(i * 0.1, 0.3, 0.3);
      tooth.rotation.x = Math.PI;
      group.add(tooth);
    }

    // Level 2 visual enhancements
    if (tower.level === 2) {
      if (tower.branch === 'a') {
        // Sniper - squinted eye, longer shape
        body.scale.set(1, 0.8, 1.3);
      } else {
        // Rapid Nibbler - vibrating, wider
        body.scale.set(1.2, 1.2, 0.9);
      }
    }
  }

  _buildSplorch(group, color, tower) {
    // Jiggly round body
    const bodyGeo = new THREE.SphereGeometry(0.4, 8, 6);
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.4;
    body.castShadow = true;
    group.add(body);

    // Cheeks
    const cheekMat = new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.4 });
    for (let side = -1; side <= 1; side += 2) {
      const cheekGeo = new THREE.SphereGeometry(0.12, 6, 4);
      const cheek = new THREE.Mesh(cheekGeo, cheekMat);
      cheek.position.set(side * 0.25, 0.35, 0.25);
      group.add(cheek);
    }

    this._addEyes(group, 0.28, 0.55, 0.18);

    if (tower.level === 2 && tower.branch === 'a') {
      // Magma - orange glow
      bodyMat.emissive = new THREE.Color(0x442200);
    }
  }

  _buildFreezlick(group, color, tower) {
    // Body
    const bodyGeo = new THREE.SphereGeometry(0.35, 8, 6);
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.4;
    body.castShadow = true;
    group.add(body);

    // Giant tongue
    const tongueGeo = new THREE.BoxGeometry(0.15, 0.05, 0.4);
    const tongueMat = new THREE.MeshStandardMaterial({ color: 0xff6b9d });
    const tongue = new THREE.Mesh(tongueGeo, tongueMat);
    tongue.position.set(0, 0.25, 0.4);
    group.add(tongue);

    this._addEyes(group, 0.26, 0.55, 0.15);

    // Icicles on top
    if (tower.level === 2) {
      for (let i = 0; i < 3; i++) {
        const iceGeo = new THREE.ConeGeometry(0.05, 0.2, 4);
        const iceMat = new THREE.MeshStandardMaterial({ color: 0xaaddff, transparent: true, opacity: 0.7 });
        const ice = new THREE.Mesh(iceGeo, iceMat);
        ice.position.set((i - 1) * 0.15, 0.75, 0);
        group.add(ice);
      }

      if (tower.branch === 'b') {
        // Icy Aura ring
        const ringGeo = new THREE.RingGeometry(0.8, 1.0, 16);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x88ccff, transparent: true, opacity: 0.15, side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.05;
        group.add(ring);
      }
    }
  }

  _buildGoldbug(group, color, tower) {
    // Fat happy body
    const bodyGeo = new THREE.SphereGeometry(0.38, 8, 6);
    const bodyMat = new THREE.MeshStandardMaterial({
      color, roughness: 0.2, metalness: 0.5
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.4;
    body.castShadow = true;
    group.add(body);

    this._addEyes(group, 0.28, 0.55, 0.15, true);

    // Coins floating around
    for (let i = 0; i < 3; i++) {
      const coinGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 8);
      const coinMat = new THREE.MeshStandardMaterial({
        color: 0xffd700, metalness: 0.8, roughness: 0.1
      });
      const coin = new THREE.Mesh(coinGeo, coinMat);
      const angle = (i / 3) * Math.PI * 2;
      coin.position.set(Math.cos(angle) * 0.5, 0.6 + i * 0.15, Math.sin(angle) * 0.5);
      coin.userData.orbitAngle = angle;
      coin.userData.orbitSpeed = 1.5;
      group.add(coin);
    }

    if (tower.level === 2 && tower.branch === 'a') {
      bodyMat.emissive = new THREE.Color(0x332200);
    }
  }

  _buildHexling(group, color, tower) {
    // Mysterious body - slightly elongated
    const bodyGeo = new THREE.SphereGeometry(0.32, 8, 6);
    bodyGeo.scale(1, 1.3, 1);
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.45;
    body.castShadow = true;
    group.add(body);

    // Single glowing eye
    const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0, 0.55, 0.25);
    group.add(eye);

    // Hat/point
    const hatGeo = new THREE.ConeGeometry(0.2, 0.4, 6);
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x6a1b9a });
    const hat = new THREE.Mesh(hatGeo, hatMat);
    hat.position.y = 0.85;
    group.add(hat);

    if (tower.level === 2 && tower.branch === 'b') {
      // Buff Totem - energy rings
      const ringGeo = new THREE.TorusGeometry(1.0, 0.03, 8, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xbb66ff, transparent: true, opacity: 0.2
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.3;
      group.add(ring);
    }
  }

  _addEyes(group, spread, height, forwardZ, happy = false) {
    for (let side = -1; side <= 1; side += 2) {
      // Eye white
      const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(side * spread * 0.5, height, forwardZ);
      group.add(eye);

      // Pupil
      const pupilGeo = new THREE.SphereGeometry(0.05, 6, 6);
      const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(side * spread * 0.5, height, forwardZ + 0.04);
      pupil.userData.isPupil = true;
      group.add(pupil);
    }
  }

  removeTower(towerId) {
    const mesh = this.towerMeshes.get(towerId);
    if (mesh) {
      this.scene.remove(mesh);
      this.towerMeshes.delete(towerId);
    }
    this.removeRangeIndicator(towerId);
  }

  showRangeIndicator(towerId, worldX, worldZ, range, color) {
    this.removeRangeIndicator(towerId);
    const geo = new THREE.RingGeometry(range - 0.05, range, 32);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.2, side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(worldX, 0.05, worldZ);
    this.scene.add(ring);
    this.rangeIndicators.set(towerId, ring);
  }

  removeRangeIndicator(towerId) {
    const ring = this.rangeIndicators.get(towerId);
    if (ring) {
      this.scene.remove(ring);
      ring.geometry.dispose();
      ring.material.dispose();
      this.rangeIndicators.delete(towerId);
    }
  }

  update(dt, troops) {
    this.time += dt;

    for (const [id, group] of this.towerMeshes) {
      // Drop-in animation
      if (group.userData.animateIn) {
        group.userData.animateTime += dt;
        const t = Math.min(group.userData.animateTime / 0.4, 1);
        const bounce = t < 0.7 ? t / 0.7 : 1 + Math.sin((t - 0.7) / 0.3 * Math.PI) * 0.15;
        const s = bounce;
        group.scale.set(s, s, s);
        if (t >= 1) group.userData.animateIn = false;
      }

      // Idle breathing animation
      const breathe = 1 + Math.sin(this.time * 2 + id * 1.3) * 0.03;
      if (!group.userData.animateIn) {
        group.scale.y = breathe;
      }

      // Eye tracking - look at nearest troop
      if (troops && troops.length > 0) {
        let nearest = null;
        let nearestDist = Infinity;
        for (const troop of troops) {
          const dx = troop.x - group.position.x;
          const dz = troop.z - group.position.z;
          const dist = dx * dx + dz * dz;
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = troop;
          }
        }
        if (nearest && nearestDist < 100) {
          const dx = nearest.x - group.position.x;
          const dz = nearest.z - group.position.z;
          group.children.forEach(child => {
            if (child.userData.isPupil) {
              const angle = Math.atan2(dx, dz);
              child.position.x = child.position.x * 0.9 + (Math.sin(angle) * 0.03 + child.position.x) * 0.1;
            }
          });
        }
      }

      // Goldbug coin orbiting
      if (group.userData.towerType === 'goldbug') {
        group.children.forEach(child => {
          if (child.userData.orbitAngle !== undefined) {
            child.userData.orbitAngle += dt * child.userData.orbitSpeed;
            const a = child.userData.orbitAngle;
            child.position.x = Math.cos(a) * 0.5;
            child.position.z = Math.sin(a) * 0.5;
            child.rotation.y = a;
          }
        });
      }

      // Hexling swaying
      if (group.userData.towerType === 'hexling') {
        group.rotation.z = Math.sin(this.time * 1.5 + id) * 0.05;
      }
    }
  }

  // Attack animation trigger
  triggerAttackAnim(towerId) {
    const group = this.towerMeshes.get(towerId);
    if (!group) return;
    // Quick squash and stretch
    group.scale.set(1.15, 0.85, 1.15);
    setTimeout(() => {
      if (group) group.scale.set(1, 1, 1);
    }, 150);
  }
}
