import * as THREE from 'three';
import { CardDef } from '../../../shared/types';

const textureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Creates an ornate, authentic Japanese lacquered card back texture in 3D.
 */
export function createCardBackTexture(): THREE.CanvasTexture {
  const cacheKey = 'card_back';
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext('2d')!;

  // Dark lacquered background with radial gradient
  const bg = ctx.createRadialGradient(256, 384, 50, 256, 384, 450);
  bg.addColorStop(0, '#3b0707'); // deep crimson center
  bg.addColorStop(0.6, '#180303');
  bg.addColorStop(1, '#080101'); // obsidian edge
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 768);

  // Outer golden ornate border
  ctx.strokeStyle = '#d4af37'; // gold
  ctx.lineWidth = 14;
  ctx.strokeRect(18, 18, 476, 732);

  // Inner thin border
  ctx.strokeStyle = '#854d0e';
  ctx.lineWidth = 4;
  ctx.strokeRect(34, 34, 444, 700);

  // Corner floral accents
  const drawCorner = (x: number, y: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  drawCorner(44, 44);
  drawCorner(468, 44);
  drawCorner(44, 724);
  drawCorner(468, 724);

  // Central Emblem: Japanese Crest (Kamon) with crossed Katana
  ctx.save();
  ctx.translate(256, 384);

  // Outer crest circle
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, 0, 140, 0, Math.PI * 2);
  ctx.stroke();

  // Subtle patterned ring
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 4;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, 120, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Crossed Katana blades
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  // Blade 1
  ctx.beginPath();
  ctx.moveTo(-90, -90);
  ctx.lineTo(90, 90);
  ctx.stroke();
  // Blade 2
  ctx.beginPath();
  ctx.moveTo(90, -90);
  ctx.lineTo(-90, 90);
  ctx.stroke();

  // Golden Tsuba (handguard) & hilt accents
  ctx.fillStyle = '#d4af37';
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();

  // Center Kanji for "Samurai" (侍)
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 36px "Yuji Boku", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('侍', 0, 2);

  ctx.restore();

  // Top and Bottom Title
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 26px "Cinzel", serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '6px';
  ctx.fillText('SAMURAI SWORD', 256, 110);
  ctx.fillText('SAMURAI SWORD', 256, 680);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Creates high-res 3D front card texture with authentic borders, icons, and descriptions.
 */
export function createCardFrontTexture(card: CardDef): THREE.CanvasTexture {
  const cacheKey = `card_front_${card.id}_${card.templateId}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext('2d')!;

  const isWeapon = card.type === 'weapon';
  const isProperty = card.type === 'property';
  const isAction = card.type === 'action';

  // Card Base
  const baseBg = ctx.createLinearGradient(0, 0, 0, 768);
  baseBg.addColorStop(0, '#0f172a');
  baseBg.addColorStop(0.5, '#090d16');
  baseBg.addColorStop(1, '#04060a');
  ctx.fillStyle = baseBg;
  ctx.fillRect(0, 0, 512, 768);

  // Border Color
  const themeColor = isWeapon ? '#dc2626' : isProperty ? '#2563eb' : '#d97706';
  const borderGrad = ctx.createLinearGradient(0, 0, 512, 768);
  borderGrad.addColorStop(0, themeColor);
  borderGrad.addColorStop(0.5, '#fef08a'); // gold sheen
  borderGrad.addColorStop(1, themeColor);

  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 14;
  ctx.strokeRect(16, 16, 480, 736);

  // Header Banner
  const headerGrad = ctx.createLinearGradient(0, 30, 0, 160);
  headerGrad.addColorStop(0, themeColor);
  headerGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(24, 24, 464, 130);

  // Card Type Tag
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px "Noto Sans", sans-serif';
  ctx.textAlign = 'left';
  const typeText = isWeapon ? '⚔️ ARMA' : isProperty ? '🛡️ PROPRIETÀ' : '⚡ AZIONE';
  ctx.fillText(typeText, 45, 60);

  // Weapon Stats on top-right of header
  if (isWeapon) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 22px "Noto Sans", sans-serif';
    ctx.fillText(`🎯 Gittata: ${card.difficulty}`, 470, 60);
    ctx.fillStyle = '#f87171';
    ctx.fillText(`❤️ Danno: ${card.damage}`, 470, 95);
  }

  // Card Name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px "Cinzel", serif';
  ctx.textAlign = 'left';
  ctx.fillText(card.name, 45, 115);

  // Center Art Box
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 175, 432, 340);
  ctx.fillStyle = '#050811';
  ctx.fillRect(42, 177, 428, 336);

  // Center Artwork (Icon or Image)
  ctx.save();
  ctx.translate(256, 330);
  ctx.fillStyle = themeColor;
  ctx.beginPath();
  ctx.arc(0, 0, 80, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '72px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const iconEmoji = isWeapon ? '⚔️' : isProperty ? '🛡️' : '⚡';
  ctx.fillText(iconEmoji, 0, 4);
  ctx.restore();

  // Kanji Background Watermark
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.font = 'bold 220px "Yuji Boku", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('刀', 256, 400);

  // Description Box at bottom
  ctx.fillStyle = '#0b1120';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.fillRect(40, 535, 432, 160);
  ctx.strokeRect(40, 535, 432, 160);

  // Description Text (Word Wrap)
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '20px "Noto Sans", sans-serif';
  ctx.textAlign = 'center';
  wrapText(ctx, card.description, 256, 580, 390, 28);

  // Bottom Footer
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 14px "Noto Sans", sans-serif';
  ctx.fillText('SAMURAI SWORD • dV GIOCHI SYSTEM', 256, 725);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(cacheKey, texture);
  return texture;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(' ');
  let line = '';
  let curY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, curY);
      line = words[n] + ' ';
      curY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, curY);
}
