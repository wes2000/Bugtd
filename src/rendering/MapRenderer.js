import * as THREE from 'three';

export class MapRenderer {
  constructor(scene) {
    this.scene = scene;
    this.mapGroup = new THREE.Group();
    this.gridHelpers = [];
    this.scene.add(this.mapGroup);
  }

  clear() {
    while (this.mapGroup.children.length > 0) {
      const child = this.mapGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
      this.mapGroup.remove(child);
    }
    this.gridHelpers = [];
  }

  buildMap(map) {
    this.clear();
    const totalWidth = map.gridWidth * 2 + 2;
    const totalHeight = map.gridHeight;

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(totalWidth + 4, totalHeight + 4);
    const groundMat = new THREE.MeshStandardMaterial({
      color: map.groundColor,
      roughness: 0.9,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(totalWidth / 2, -0.05, totalHeight / 2);
    ground.receiveShadow = true;
    this.mapGroup.add(ground);

    // Dividing line
    const dividerGeo = new THREE.BoxGeometry(0.1, 0.15, totalHeight + 2);
    const dividerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x444444 });
    const divider = new THREE.Mesh(dividerGeo, dividerMat);
    divider.position.set(totalWidth / 2, 0.075, totalHeight / 2);
    this.mapGroup.add(divider);

    // Player bases
    this._createBase(0.5, totalHeight / 2, 0x4caf50, 'P1'); // Left side
    this._createBase(totalWidth - 0.5, totalHeight / 2, 0xe74c3c, 'P2'); // Right side

    // Render paths for both sides
    this._renderPaths(map.paths, 0, map);
    this._renderPaths(map.paths, 1, map);

    // Grid overlay for player 0 (left side)
    this._renderGrid(map, 0);
    // Grid overlay for player 1 (right side)
    this._renderGrid(map, 1);
  }

  _createBase(x, z, color, label) {
    const baseGroup = new THREE.Group();

    // Base platform
    const platformGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.3, 8);
    const platformMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = 0.15;
    platform.castShadow = true;
    baseGroup.add(platform);

    // Flag pole
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 1.3;
    baseGroup.add(pole);

    // Flag
    const flagGeo = new THREE.PlaneGeometry(0.8, 0.5);
    const flagMat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.4, 2.0, 0);
    baseGroup.add(flag);

    // Glow
    const glowGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.5;
    baseGroup.add(glow);

    baseGroup.position.set(x, 0, z);
    this.mapGroup.add(baseGroup);
  }

  _renderPaths(paths, playerIdx, map) {
    const halfWidth = map.gridWidth;
    const offset = playerIdx === 0 ? 1 : halfWidth + 2;

    for (const path of paths) {
      const points = path.map(p => {
        const x = playerIdx === 0 ? p.x + 1 : (halfWidth - p.x) + halfWidth + 2;
        return new THREE.Vector3(x, 0.02, p.y);
      });

      // Path as a wide line (extruded shape)
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.sqrt(dx * dx + dz * dz);

        const pathGeo = new THREE.BoxGeometry(len + 0.4, 0.05, 0.8);
        const pathMat = new THREE.MeshStandardMaterial({
          color: map.pathColor,
          roughness: 0.8,
        });
        const pathMesh = new THREE.Mesh(pathGeo, pathMat);

        const cx = (a.x + b.x) / 2;
        const cz = (a.z + b.z) / 2;
        pathMesh.position.set(cx, 0.025, cz);
        pathMesh.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;
        pathMesh.receiveShadow = true;
        this.mapGroup.add(pathMesh);
      }
    }
  }

  _renderGrid(map, playerIdx) {
    const halfWidth = map.gridWidth;
    const offset = playerIdx === 0 ? 1 : halfWidth + 2;

    for (let x = 0; x < map.gridWidth; x++) {
      for (let y = 0; y < map.gridHeight; y++) {
        const wx = x + offset + 0.5;
        const wz = y + 0.5;

        const gridGeo = new THREE.PlaneGeometry(0.9, 0.9);
        const gridMat = new THREE.MeshStandardMaterial({
          color: playerIdx === 0 ? 0x4caf50 : 0xe74c3c,
          transparent: true,
          opacity: 0.08,
          roughness: 1,
        });
        const gridMesh = new THREE.Mesh(gridGeo, gridMat);
        gridMesh.rotation.x = -Math.PI / 2;
        gridMesh.position.set(wx, 0.01, wz);
        gridMesh.userData = { isGrid: true, player: playerIdx, gridX: x, gridY: y };
        this.mapGroup.add(gridMesh);

        this.gridHelpers.push({
          mesh: gridMesh,
          player: playerIdx,
          gridX: x,
          gridY: y,
          worldX: wx,
          worldZ: wz,
        });
      }
    }
  }

  getGridAtWorld(worldX, worldZ) {
    let closest = null;
    let closestDist = Infinity;

    for (const gh of this.gridHelpers) {
      const dx = worldX - gh.worldX;
      const dz = worldZ - gh.worldZ;
      const dist = dx * dx + dz * dz;
      if (dist < closestDist && dist < 0.5) {
        closestDist = dist;
        closest = gh;
      }
    }

    return closest;
  }

  highlightGrid(gridX, gridY, playerIdx, color = 0xffd93d) {
    for (const gh of this.gridHelpers) {
      if (gh.player === playerIdx && gh.gridX === gridX && gh.gridY === gridY) {
        gh.mesh.material.color.setHex(color);
        gh.mesh.material.opacity = 0.3;
      }
    }
  }

  resetGridHighlights() {
    for (const gh of this.gridHelpers) {
      gh.mesh.material.color.setHex(gh.player === 0 ? 0x4caf50 : 0xe74c3c);
      gh.mesh.material.opacity = 0.08;
    }
  }

  // Get world position for a grid cell (player 0)
  gridToWorld(gridX, gridY, playerIdx = 0) {
    const map = this._currentMap;
    const offset = playerIdx === 0 ? 1 : (map ? map.gridWidth + 2 : 10);
    return {
      x: gridX + offset + 0.5,
      z: gridY + 0.5,
    };
  }

  setCurrentMap(map) {
    this._currentMap = map;
  }
}
