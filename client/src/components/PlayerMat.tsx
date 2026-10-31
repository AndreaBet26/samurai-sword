import React from 'react';
import { PlayerPublicState, CardDef } from '../../../shared/types';
import { TabletopCard } from './TabletopCard';
import { HeartToken, HonorToken } from './WoodToken';
import { Crosshair, Bot, Crown, EyeOff } from 'lucide-react';
import { soundManager } from '../utils/soundEffects';

interface PlayerMatProps {
  player: PlayerPublicState;
  isMe: boolean;
  isCurrentTurn: boolean;
  distanceFromMe?: number;
  difficultyFromMe?: number;
  isTargetable?: boolean;
  onTargetSelect?: () => void;
  onInspectCard?: (card: CardDef) => void;
}

export const PlayerMat: React.FC<PlayerMatProps> = ({
  player,
  isMe,
  isCurrentTurn,
  distanceFromMe,
  difficultyFromMe,
  isTargetable = false,
  onTargetSelect,
  onInspectCard
}) => {
  const isShogun = player.role?.id === 'shogun';

  const characterImage = player.character
    ? `/assets/characters/${player.character.id}.png`
    : '/assets/ui/character_back.png';

  const roleImage = player.role
    ? `/assets/roles/${player.role.id}.png`
    : '/assets/ui/role_back.png';

  const handleClickMat = () => {
    if (isTargetable) {
      soundManager.playSwordSlash();
      onTargetSelect?.();
    }
  };

  // Build array of heart tokens (filled vs empty)
  const hearts = [];
  for (let i = 0; i < player.maxHp; i++) {
    hearts.push(i < player.currentHp);
  }

  // Build array of honor tokens
  const honorTokens = Array.from({ length: player.honorPoints });

  return (
    <div
      onClick={handleClickMat}
      className={`relative rounded-3xl p-3 sm:p-4 border-2 transition-all duration-300 flex flex-col justify-between select-none shadow-2xl ${
        isCurrentTurn
          ? 'border-amber-400 bg-slate-950/90 shadow-amber-500/25 ring-2 ring-amber-400/50 scale-102'
          : 'border-amber-950/60 bg-slate-950/70 hover:border-amber-900/80'
      } ${
        isTargetable
          ? 'cursor-pointer border-red-500 ring-4 ring-red-500/80 shadow-red-500/30 scale-105 animate-pulse'
          : ''
      } backdrop-blur-md min-w-[240px] max-w-[310px]`}
      style={{
        background: 'radial-gradient(circle at 50% 30%, #151c2c 0%, #080c14 100%)',
        boxShadow: isTargetable
          ? '0 0 25px rgba(239, 68, 68, 0.6), inset 0 0 15px rgba(239, 68, 68, 0.3)'
          : isCurrentTurn
          ? '0 0 20px rgba(245, 158, 11, 0.4), inset 0 0 10px rgba(245, 158, 11, 0.2)'
          : '0 8px 20px rgba(0,0,0,0.8), inset 0 1px 2px rgba(255,255,255,0.1)'
      }}
    >
      {/* Target Reticle Banner if targeting this player directly */}
      {isTargetable && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 bg-red-600 text-white text-[11px] font-black uppercase px-4 py-1 rounded-full shadow-xl flex items-center gap-1.5 animate-bounce">
          <Crosshair className="w-4 h-4" />
          Clicca per Colpire
        </div>
      )}

      {/* Turn Halo Banner */}
      {!isTargetable && isCurrentTurn && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-[10px] font-black uppercase px-3.5 py-0.5 rounded-full shadow-lg border border-amber-300">
          Turno in Corso
        </div>
      )}

      {/* Header: Player Name & Seating Badge */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="font-title font-bold text-sm text-slate-100 truncate max-w-[130px]">
            {player.name}
          </span>
          {player.isBot && (
            <span className="bg-slate-800 text-blue-400 p-1 rounded-md text-[9px]" title="Bot IA">
              <Bot className="w-3 h-3" />
            </span>
          )}
          {isMe && (
            <span className="bg-indigo-600/80 text-indigo-100 text-[10px] font-bold px-1.5 py-0.5 rounded">
              Tu
            </span>
          )}
        </div>

        {/* Distance and difficulty badge */}
        {!isMe && distanceFromMe !== undefined && (
          <div className="text-[10px] bg-slate-900 border border-slate-700 px-2 py-0.5 rounded-lg font-bold text-amber-300">
            Dist: {distanceFromMe} {difficultyFromMe !== undefined && `(Diff: ${difficultyFromMe})`}
          </div>
        )}
      </div>

      {/* Main Table Mat Area: Character Card + Role Card Side by Side */}
      <div className="flex items-start justify-center gap-2 mb-3">
        {/* Character Card (Face-up Full Bleed) */}
        <div className="flex flex-col items-center">
          <TabletopCard
            imageSrc={characterImage}
            fallbackText={player.character?.name || 'Personaggio'}
            size="md"
            isHoverable={true}
            onClick={() => {
              if (player.character) {
                // Inspect character
              }
            }}
          />
          <span className="text-[10px] font-bold text-slate-300 mt-1 truncate max-w-[85px]">
            {player.character?.name}
          </span>
        </div>

        {/* Role Card (Face-up if Shogun, or Face-down) */}
        <div className="flex flex-col items-center">
          <TabletopCard
            imageSrc={roleImage}
            fallbackText={player.role?.name || 'Ruolo'}
            size="md"
            isHoverable={false}
          />
          <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-slate-400">
            {isShogun ? (
              <span className="text-amber-400 flex items-center gap-0.5">
                <Crown className="w-3 h-3" /> Shōgun
              </span>
            ) : player.role ? (
              <span style={{ color: player.role.color }}>{player.role.name}</span>
            ) : (
              <span className="flex items-center gap-0.5">
                <EyeOff className="w-3 h-3" /> Segreto
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Physical Wooden Tokens: Hearts (Vite) and Lotus (Onore) */}
      <div className="bg-black/50 border border-slate-800 rounded-2xl p-2.5 mb-2.5 space-y-2 shadow-inner">
        {/* Hearts (Vite) */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-black text-red-400 tracking-wider">
            Vite ({player.currentHp}/{player.maxHp})
          </span>
          <div className="flex items-center gap-1">
            {hearts.map((isFilled, idx) => (
              <HeartToken key={idx} isFilled={isFilled} size="sm" />
            ))}
          </div>
        </div>

        {/* Lotus (Onore) */}
        <div className="flex items-center justify-between border-t border-slate-800/60 pt-1.5">
          <span className="text-[10px] uppercase font-black text-purple-300 tracking-wider">
            Onore ({player.honorPoints})
          </span>
          <div className="flex items-center gap-1">
            {honorTokens.map((_, idx) => (
              <HonorToken key={idx} size="sm" />
            ))}
          </div>
        </div>
      </div>

      {/* Cards Held in Hand (Facedown fan on mat) */}
      <div className="flex items-center justify-between text-[11px] mb-2 px-1">
        <span className="text-slate-400 font-semibold">Carte in mano:</span>
        <div className="flex items-center -space-x-4 overflow-hidden pl-1">
          {Array.from({ length: Math.min(6, player.handCount) }).map((_, idx) => (
            <div key={idx} className="transform hover:-translate-y-1 transition-transform">
              <TabletopCard
                imageSrc="/assets/ui/card_back.png"
                fallbackText="Dorso"
                size="xs"
              />
            </div>
          ))}
          {player.handCount > 6 && (
            <span className="text-[10px] font-bold text-slate-300 ml-5">
              +{player.handCount - 6}
            </span>
          )}
          {player.handCount === 0 && (
            <span className="text-[10px] font-bold text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-600">
              Inoffensivo
            </span>
          )}
        </div>
      </div>

      {/* Physical Equipped Properties in Play on the Table */}
      {player.propertiesInPlay.length > 0 && (
        <div className="border-t border-slate-800/80 pt-2">
          <span className="text-[10px] uppercase font-black text-blue-400 tracking-wider block mb-1.5">
            Carte sul Tavolo (Proprietà):
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {player.propertiesInPlay.map((prop) => (
              <div
                key={prop.id}
                onClick={() => onInspectCard?.(prop)}
                title={prop.name}
                className="transform hover:scale-105 transition-transform"
              >
                <TabletopCard
                  imageSrc={`/assets/cards/${prop.templateId}.png`}
                  fallbackText={prop.name}
                  size="sm"
                  isHoverable={true}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
