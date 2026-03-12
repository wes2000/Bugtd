import * as THREE from 'three';

class Particle {
  constructor(x, y, z, vx, vy, vz, color, size, life) {
    this.x = x; this.y = y; this.z = z;
    this.vx = vx; this.vy = vy; this.vz = vz;
    this.color = color;
    this.size = size;
    this.life = life;
    this.maxLife = life;
    this.alive = true;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;
    this.vy -= 5 * dt; // gravity
    this.life -= dt;
    if (this.life <= 0 || this.y < -1) this.alive = false;
  }
}

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.meshes = [];
    this.maxParticles = 200;

    // Pre-create mesh pool
    const geo = new THREE.SphereGeometry(0.06, 4, 4);
    for (let i = 0; i < this.maxParticles; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }

    // Projectile meshes
    this.projectileMeshes = new Map();
    this.projectileGeo = new THREE.SphereGeometry(0.08, 6, 6);
  }

  emitBurst(x, y, z, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      const p = new Particle(
        x, y, z,
        Math.cos(angle) * speed * (0.5 + Math.random()),
        3 + Math.random() * 4,
        Math.sin(angle) * speed * (0.5 + Math.random()),
        color,
        0.04 + Math.random() * 0.04,
        0.5 + Math.random() * 0.5
      );
      this.particles.push(p);
    }
  }

  emitKill(x, z, color) {
    this.emitBurst(x, 0.3, z, color, 12);
  }

  emitDamage(x, z) {
    this.emitBurst(x, 0.3, z, 0xffffff, 3);
  }

  emitGold(x, z) {
    this.emitBurst(x, 0.5, z, 0xffd700, 5);
  }

  emitConfetti(x, z) {
    const colors = [0xff6b6b, 0xffd93d, 0x6bcb77, 0x4d96ff, 0x9b59b6, 0xff9ff3];
    for (let i = 0; i < 30; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const p = new Particle(
        x + (Math.random() - 0.5) * 4,
        0.5,
        z + (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 5,
        8 + Math.random() * 5,
        (Math.random() - 0.5) * 5,
        color,
        0.05 + Math.random() * 0.05,
        1.5 + Math.random() * 1.0
      );
      this.particles.push(p);
    }
  }

  updateProjectiles(projectiles) {
    const activeIds = new Set();

    for (let i = 0; i < projectiles.length; i++) {
      const proj = projectiles[i];
      const id = `proj_${i}`;
      activeIds.add(id);

      let mesh = this.projectileMeshes.get(id);
      if (!mesh) {
        const mat = new THREE.MeshBasicMaterial({ color: proj.color });
        mesh = new THREE.Mesh(this.projectileGeo, mat);
        this.scene.add(mesh);
        this.projectileMeshes.set(id, mesh);
      }

      mesh.position.set(proj.x, proj.y || 0.5, proj.z);
      mesh.material.color.setHex(proj.color);
    }

    // Remove old projectile meshes
    for (const [id, mesh] of this.projectileMeshes) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        mesh.material.dispose();
        this.projectileMeshes.delete(id);
      }
    }
  }

  update(dt) {
    // Update particles
    this.particles = this.particles.filter(p => {
      p.update(dt);
      return p.alive;
    });

    // Trim to max
    while (this.particles.length > this.maxParticles) {
      this.particles.shift();
    }

    // Update meshes
    for (let i = 0; i < this.meshes.length; i++) {
      const mesh = this.meshes[i];
      if (i < this.particles.length) {
        const p = this.particles[i];
        mesh.visible = true;
        mesh.position.set(p.x, p.y, p.z);
        mesh.material.color.setHex(p.color);
        const scale = p.size * (p.life / p.maxLife);
        mesh.scale.setScalar(Math.max(0.1, scale * 20));
        mesh.material.opacity = p.life / p.maxLife;
        mesh.material.transparent = true;
      } else {
        mesh.visible = false;
      }
    }
  }

  clear() {
    this.particles = [];
    for (const mesh of this.meshes) {
      mesh.visible = false;
    }
    for (const [id, mesh] of this.projectileMeshes) {
      this.scene.remove(mesh);
      mesh.material.dispose();
    }
    this.projectileMeshes.clear();
  }
}
