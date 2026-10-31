import * as THREE from 'three';
import gsap from 'gsap';
import { CardDef, PlayerPublicState } from '../../../shared/types';
import { CardMesh3D } from './CardMesh3D';
import { Deck3D } from './Deck3D';
import { soundManager } from '../utils/soundEffects';

export interface Table3DCallbacks {
  onCardClick?: (card: CardDef) => void;
  onPlayerClick?: (playerId: string) => void;
}

export class Table3DScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public deck3D: Deck3D;
  public handCards: CardMesh3D[] = [];
  public discardCards: CardMesh3D[] = [];

  private container: HTMLElement;
  private animationFrameId: number = 0;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private hoveredCard: CardMesh3D | null = null;
  private callbacks: Table3DCallbacks = {};

  constructor(container: HTMLElement, callbacks?: Table3DCallbacks) {
    this.container = container;
    this.callbacks = callbacks || {};

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070b14);
    this.scene.fog = new THREE.FogExp2(0x070b14, 0.025);

    // 2. Camera: Angled 3D view overlooking the arena (like Master Duel / Hearthstone)
    const width = container.clientWidth || window.innerWidth || 1280;
    const height = container.clientHeight || window.innerHeight || 720;
    const aspect = width / height;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    this.camera.position.set(0, 11, 12.5);
    this.camera.lookAt(0, -0.5, 0);

    // 3. Renderer with soft shadows & ACES Filmic Tone Mapping
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    // 4. Lighting
    this.setupLighting();

    // 5. 3D Environment (Tatami Dojo Floor & Grand Wooden Table)
    this.setupTableAndEnvironment();

    // 6. Central 3D Deck
    this.deck3D = new Deck3D(36);
    this.scene.add(this.deck3D);

    // 7. Event Listeners
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.addEventListener('click', this.onClick);

    // 8. Start Render Loop
    this.animate();
  }

  private setupLighting() {
    // Warm ambient lantern light
    const ambient = new THREE.AmbientLight(0xffecd1, 0.7);
    this.scene.add(ambient);

    // Main directional sunlight/moonlight beam
    const mainLight = new THREE.DirectionalLight(0xfff3e0, 2.0);
    mainLight.position.set(6, 18, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 1;
    mainLight.shadow.camera.far = 40;
    mainLight.shadow.camera.left = -15;
    mainLight.shadow.camera.right = 15;
    mainLight.shadow.camera.top = 15;
    mainLight.shadow.camera.bottom = -15;
    mainLight.shadow.bias = -0.0005;
    this.scene.add(mainLight);

    // Atmospheric colored rim lights
    const blueRim = new THREE.DirectionalLight(0x38bdf8, 0.6);
    blueRim.position.set(-10, 5, -10);
    this.scene.add(blueRim);

    // Warm hearth spotlight on central arena
    const centerSpot = new THREE.SpotLight(0xffeedd, 3.5);
    centerSpot.position.set(0, 14, 0);
    centerSpot.angle = Math.PI / 4;
    centerSpot.penumbra = 0.5;
    centerSpot.decay = 2;
    centerSpot.distance = 25;
    this.scene.add(centerSpot);
  }

  private setupTableAndEnvironment() {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(60, 60);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x05070c,
      roughness: 0.9,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Main Table Top (Large Octagonal / Stadium Table)
    const tableRadius = 9.0;
    const tableGeo = new THREE.CylinderGeometry(tableRadius, tableRadius + 0.5, 0.8, 32);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x1c120c, // dark lacquered cherry wood
      roughness: 0.35,
      metalness: 0.2
    });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.y = -0.4;
    table.receiveShadow = true;
    table.castShadow = true;
    this.scene.add(table);

    // Mat inlay surface (Deep Indigo / Crimson Felt)
    const matGeo = new THREE.CylinderGeometry(tableRadius - 0.7, tableRadius - 0.7, 0.82, 32);
    const matMaterial = new THREE.MeshStandardMaterial({
      color: 0x0c1527, // midnight blue battlefield felt
      roughness: 0.85,
      metalness: 0.05
    });
    const mat = new THREE.Mesh(matGeo, matMaterial);
    mat.position.y = -0.38;
    mat.receiveShadow = true;
    this.scene.add(mat);

    // Golden boundary ring inlay
    const ringGeo = new THREE.RingGeometry(tableRadius - 0.85, tableRadius - 0.75, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.8,
      roughness: 0.3
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    this.scene.add(ring);

    // Center Kamon Crest on table surface
    const crestRingGeo = new THREE.RingGeometry(1.6, 1.68, 48);
    const crestRing = new THREE.Mesh(crestRingGeo, ringMat);
    crestRing.rotation.x = -Math.PI / 2;
    crestRing.position.y = 0.04;
    this.scene.add(crestRing);

    // Deck and Discard placement outlines
    const outlineMat = new THREE.LineBasicMaterial({ color: 0x475569, linewidth: 2 });
    const createSlotOutline = (x: number) => {
      const pts = [
        new THREE.Vector3(-1.1, 0.05, -1.6),
        new THREE.Vector3(1.1, 0.05, -1.6),
        new THREE.Vector3(1.1, 0.05, 1.6),
        new THREE.Vector3(-1.1, 0.05, 1.6),
        new THREE.Vector3(-1.1, 0.05, -1.6)
      ];
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const l = new THREE.Line(g, outlineMat);
      l.position.set(x, 0, 0);
      this.scene.add(l);
    };
    createSlotOutline(-2.8); // Deck slot
    createSlotOutline(2.8);  // Discard slot
  }

  // --- 3D ANIMATION SEQUENCES ---

  /**
   * The Full Cinematic Shuffle and Deal Opening Sequence
   */
  public async playOpeningSequence(
    players: PlayerPublicState[],
    myCards: CardDef[]
  ): Promise<void> {
    // 1. Riffle Shuffle the deck in 3D with realistic physics and sound
    await this.deck3D.riffleShuffle();

    // 2. Deal starting cards to other players around table
    const opponentCount = players.length - 1;
    for (let round = 0; round < 4; round++) {
      for (let pIdx = 0; pIdx < opponentCount; pIdx++) {
        // Compute circular angle around table for seat
        const angle = -Math.PI / 2 + ((pIdx + 1) * (Math.PI * 2)) / players.length;
        const targetX = Math.cos(angle) * 6.5;
        const targetZ = Math.sin(angle) * 5.0;

        await this.deck3D.dealCardTo(
          new THREE.Vector3(targetX, 0.1, targetZ),
          new THREE.Vector3(-Math.PI / 2, 0, angle + Math.PI / 2)
        );
      }
    }

    // 3. Deal the player's personal hand with 3D arc trajectory & flip!
    await this.dealPlayerHand(myCards);
  }

  /**
   * Deals cards into player's hand forming an interactive 3D fan in front of the camera
   */
  public async dealPlayerHand(cards: CardDef[]) {
    // Clear old hand meshes
    this.handCards.forEach(c => this.scene.remove(c));
    this.handCards = [];

    const total = cards.length;
    for (let i = 0; i < total; i++) {
      const cardData = cards[i];
      const card = new CardMesh3D(cardData, false);
      this.scene.add(card);
      this.handCards.push(card);

      // Start position: on top of the deck
      card.position.set(-2.8, 1.2, 0);
      card.rotation.set(-Math.PI / 2, 0, 0);

      // Calculate 3D fan position in front of camera
      const spread = Math.min(1.8, 8.0 / Math.max(1, total));
      const startX = -((total - 1) * spread) / 2;
      const targetX = startX + i * spread;
      const targetY = 3.6 - Math.abs(targetX) * 0.08;
      const targetZ = 8.2 - Math.abs(targetX) * 0.04;

      // Slight fanning angle
      const rotZ = -(targetX / 14);

      // Arc fly towards camera
      await card.animateTo(
        { x: targetX, y: targetY, z: targetZ },
        { x: -0.22, y: 0, z: rotZ },
        0.55,
        'power2.out'
      );

      // Reveal card with 3D flip
      soundManager.playCardSlide();
      await card.flip(0.45);
    }
  }

  /**
   * Adds top card to the 3D Discard Pile
   */
  public addCardToDiscard(cardData: CardDef) {
    const card = new CardMesh3D(cardData, true);
    const discardHeight = this.discardCards.length * 0.035;
    const jitter = (Math.random() - 0.5) * 0.15;

    card.position.set(2.8, 0.1 + discardHeight, 0);
    card.rotation.set(-Math.PI / 2, 0, jitter);

    this.discardCards.push(card);
    this.scene.add(card);
  }

  // --- INTERACTION & RAYCASTING ---

  private onMouseMove = (event: MouseEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = this.handCards.map(c => c.mesh);
    const intersects = this.raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const topHit = intersects[0].object;
      const parentCard = topHit.userData.parentCard as CardMesh3D;

      if (this.hoveredCard !== parentCard) {
        if (this.hoveredCard) this.hoveredCard.setHover(false);
        this.hoveredCard = parentCard;
        soundManager.playCardSlide();
        this.hoveredCard.setHover(true);
        this.renderer.domElement.style.cursor = 'pointer';
      }
    } else {
      if (this.hoveredCard) {
        this.hoveredCard.setHover(false);
        this.hoveredCard = null;
        this.renderer.domElement.style.cursor = 'default';
      }
    }
  };

  private onClick = () => {
    if (this.hoveredCard && this.hoveredCard.cardData) {
      soundManager.playCardSlide();
      this.callbacks.onCardClick?.(this.hoveredCard.cardData);
    }
  };

  private onResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    this.renderer.render(this.scene, this.camera);
  };

  public destroy() {
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.removeEventListener('click', this.onClick);
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
