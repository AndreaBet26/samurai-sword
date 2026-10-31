import * as THREE from 'three';
import gsap from 'gsap';
import { CardMesh3D } from './CardMesh3D';
import { soundManager } from '../utils/soundEffects';

export class Deck3D extends THREE.Group {
  public cards: CardMesh3D[] = [];
  private basePosition = new THREE.Vector3(-2.8, 0.1, 0);

  constructor(cardCount: number = 30) {
    super();
    this.createDeckStack(cardCount);
  }

  private createDeckStack(count: number) {
    // Clear any existing
    this.cards.forEach(c => this.remove(c));
    this.cards = [];

    const thickness = 0.035;
    for (let i = 0; i < count; i++) {
      const card = new CardMesh3D(undefined, false);
      // Stack cards with slight organic jitter
      const jitterX = (Math.random() - 0.5) * 0.02;
      const jitterZ = (Math.random() - 0.5) * 0.02;
      const jitterRotY = (Math.random() - 0.5) * 0.03;

      card.position.set(
        this.basePosition.x + jitterX,
        this.basePosition.y + i * thickness,
        this.basePosition.z + jitterZ
      );
      // Lay flat on table, card back facing up
      card.rotation.x = -Math.PI / 2;
      card.rotation.z = Math.PI + jitterRotY;

      this.cards.push(card);
      this.add(card);
    }
  }

  /**
   * Riffle Shuffle Animation (Style: Master Duel / Casino Table)
   */
  public async riffleShuffle(): Promise<void> {
    if (this.cards.length < 10) return;

    soundManager.playTaiko();

    const half = Math.floor(this.cards.length / 2);
    const leftHalf = this.cards.slice(0, half);
    const rightHalf = this.cards.slice(half);

    // 1. Lift the deck
    const liftPromises = this.cards.map((card, i) => {
      return gsap.to(card.position, {
        y: card.position.y + 1.8,
        duration: 0.5,
        ease: 'power2.out'
      });
    });
    await Promise.all(liftPromises);

    // 2. Separate into Left and Right stacks with an angle
    const splitPromises = [
      ...leftHalf.map(card => {
        return gsap.to(card.position, {
          x: card.position.x - 1.6,
          duration: 0.45,
          ease: 'power2.inOut'
        });
      }),
      ...rightHalf.map(card => {
        return gsap.to(card.position, {
          x: card.position.x + 1.6,
          duration: 0.45,
          ease: 'power2.inOut'
        });
      })
    ];
    await Promise.all(splitPromises);

    // 3. Riffle Cascade Interleaving!
    soundManager.playCardSlide();

    const thickness = 0.035;
    const cascadePromises: Promise<any>[] = [];

    for (let i = 0; i < half; i++) {
      const delay = i * 0.025;

      // Drop left card
      const leftCard = leftHalf[i];
      cascadePromises.push(
        new Promise(resolve => {
          gsap.to(leftCard.position, {
            x: this.basePosition.x,
            y: this.basePosition.y + (i * 2) * thickness,
            duration: 0.35,
            delay,
            ease: 'bounce.out',
            onComplete: resolve
          });
        })
      );

      // Drop right card
      if (rightHalf[i]) {
        const rightCard = rightHalf[i];
        cascadePromises.push(
          new Promise(resolve => {
            gsap.to(rightCard.position, {
              x: this.basePosition.x,
              y: this.basePosition.y + (i * 2 + 1) * thickness,
              duration: 0.35,
              delay: delay + 0.012,
              ease: 'bounce.out',
              onComplete: resolve
            });
          })
        );
      }
    }

    await Promise.all(cascadePromises);

    // 4. Square up the deck with a satisfying final tap
    soundManager.playCardSlide();
    const squarePromises = this.cards.map((card, idx) => {
      return gsap.to(card.position, {
        x: this.basePosition.x,
        y: this.basePosition.y + idx * thickness,
        z: this.basePosition.z,
        duration: 0.25,
        ease: 'power1.out'
      });
    });
    await Promise.all(squarePromises);
  }

  /**
   * Deals cards from deck to player positions around the table
   */
  public async dealCardTo(
    targetPos: THREE.Vector3,
    targetRot: THREE.Vector3
  ): Promise<CardMesh3D | null> {
    if (this.cards.length === 0) return null;
    const card = this.cards.pop()!;

    soundManager.playCardSlide();

    // Flight curve with apex lift
    const midPoint = new THREE.Vector3(
      (card.position.x + targetPos.x) / 2,
      Math.max(card.position.y, targetPos.y) + 2.5, // arc peak
      (card.position.z + targetPos.z) / 2
    );

    // Timeline for parabolic flight
    const tl = gsap.timeline();
    tl.to(card.position, {
      x: midPoint.x,
      y: midPoint.y,
      z: midPoint.z,
      duration: 0.3,
      ease: 'power1.out'
    });
    tl.to(card.position, {
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z,
      duration: 0.35,
      ease: 'power2.in'
    });

    gsap.to(card.rotation, {
      x: targetRot.x,
      y: targetRot.y,
      z: targetRot.z,
      duration: 0.65,
      ease: 'power2.inOut'
    });

    return new Promise(resolve => {
      tl.eventCallback('onComplete', () => resolve(card));
    });
  }
}
