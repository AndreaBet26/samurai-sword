import * as THREE from 'three';
import gsap from 'gsap';
import { CardDef } from '../../../shared/types';
import { createCardBackTexture, createCardFrontTexture } from './cardTextures';

export class CardMesh3D extends THREE.Group {
  public cardData?: CardDef;
  public isFaceUp: boolean = false;
  public mesh: THREE.Mesh;
  public frontMaterial: THREE.MeshStandardMaterial;
  public backMaterial: THREE.MeshStandardMaterial;
  public edgeMaterial: THREE.MeshStandardMaterial;

  private originalY: number = 0;
  private isHovered: boolean = false;

  constructor(cardData?: CardDef, startFaceUp: boolean = false) {
    super();
    this.cardData = cardData;
    this.isFaceUp = startFaceUp;

    // Card Dimensions (proportional to standard playing cards: ~63x88mm)
    const width = 2.0;
    const height = 3.0;
    const thickness = 0.035;

    const geometry = new THREE.BoxGeometry(width, height, thickness);

    // Materials for the 6 faces: [right, left, top, bottom, front, back]
    this.edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.5,
      metalness: 0.2
    });

    const backTex = createCardBackTexture();
    this.backMaterial = new THREE.MeshStandardMaterial({
      map: backTex,
      roughness: 0.4,
      metalness: 0.1
    });

    const frontTex = cardData ? createCardFrontTexture(cardData) : backTex;
    this.frontMaterial = new THREE.MeshStandardMaterial({
      map: frontTex,
      roughness: 0.35,
      metalness: 0.15
    });

    // Box face order in Three.js: +X, -X, +Y, -Y, +Z (front), -Z (back)
    const materials = [
      this.edgeMaterial,
      this.edgeMaterial,
      this.edgeMaterial,
      this.edgeMaterial,
      this.frontMaterial, // Front face (+Z)
      this.backMaterial   // Back face (-Z)
    ];

    this.mesh = new THREE.Mesh(geometry, materials);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // By default, if face down, rotate so back face is pointing up towards camera
    if (!this.isFaceUp) {
      this.mesh.rotation.y = Math.PI;
    }

    this.add(this.mesh);

    // Tag for Raycasting
    this.mesh.userData = { parentCard: this };
  }

  public updateCardData(newCard: CardDef) {
    this.cardData = newCard;
    const frontTex = createCardFrontTexture(newCard);
    this.frontMaterial.map = frontTex;
    this.frontMaterial.needsUpdate = true;
  }

  public flip(duration: number = 0.6): Promise<void> {
    return new Promise((resolve) => {
      this.isFaceUp = !this.isFaceUp;
      const targetRotationY = this.isFaceUp ? 0 : Math.PI;

      // Slight lift during flip
      const curY = this.position.y;
      gsap.to(this.position, {
        y: curY + 0.8,
        duration: duration / 2,
        yoyo: true,
        repeat: 1,
        ease: 'power2.out'
      });

      gsap.to(this.mesh.rotation, {
        y: targetRotationY,
        duration: duration,
        ease: 'power2.inOut',
        onComplete: () => resolve()
      });
    });
  }

  public setHover(hover: boolean) {
    if (this.isHovered === hover) return;
    this.isHovered = hover;

    if (hover) {
      this.originalY = this.position.y;
      gsap.to(this.position, {
        y: this.originalY + 0.6,
        z: this.position.z + 0.4,
        duration: 0.2,
        ease: 'power2.out'
      });
      gsap.to(this.scale, {
        x: 1.12,
        y: 1.12,
        z: 1.12,
        duration: 0.2,
        ease: 'power2.out'
      });
    } else {
      gsap.to(this.position, {
        y: this.originalY,
        z: this.position.z - 0.4,
        duration: 0.2,
        ease: 'power2.out'
      });
      gsap.to(this.scale, {
        x: 1.0,
        y: 1.0,
        z: 1.0,
        duration: 0.2,
        ease: 'power2.out'
      });
    }
  }

  public animateTo(
    targetPos: { x: number; y: number; z: number },
    targetRot: { x: number; y: number; z: number },
    duration: number = 0.8,
    ease: string = 'power2.inOut'
  ): Promise<void> {
    return new Promise((resolve) => {
      gsap.to(this.position, {
        x: targetPos.x,
        y: targetPos.y,
        z: targetPos.z,
        duration,
        ease
      });

      gsap.to(this.rotation, {
        x: targetRot.x,
        y: targetRot.y,
        z: targetRot.z,
        duration,
        ease,
        onComplete: () => resolve()
      });
    });
  }
}
