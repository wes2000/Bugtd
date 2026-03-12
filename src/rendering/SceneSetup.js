import * as THREE from 'three';

export class SceneSetup {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.Fog(0x1a1a2e, 30, 50);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Camera - top-down with slight angle
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(8, 18, 14);
    this.camera.lookAt(8, 0, 4);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x6688cc, 0.5);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(10, 15, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    this.scene.add(dirLight);

    const hemisphereLight = new THREE.HemisphereLight(0x88aaff, 0x445522, 0.3);
    this.scene.add(hemisphereLight);

    // Resize handler
    window.addEventListener('resize', () => this.onResize());

    // Raycaster for mouse picking
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  setCameraForMap(map) {
    const totalWidth = map.gridWidth * 2 + 2;
    const cx = totalWidth / 2;
    const cy = map.gridHeight / 2;
    this.camera.position.set(cx, 16 + map.gridHeight * 0.5, cy + 10);
    this.camera.lookAt(cx, 0, cy);
  }

  getWorldPosition(screenX, screenY) {
    // Use canvas bounding rect, not window size - handles non-fullscreen windows
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((screenX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((screenY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersection = new THREE.Vector3();
    const result = this.raycaster.ray.intersectPlane(this.groundPlane, intersection);
    return result ? intersection : null;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  getScene() { return this.scene; }
  getCamera() { return this.camera; }
}
