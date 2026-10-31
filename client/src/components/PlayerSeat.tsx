import React, { useState } from 'react';
import { PlayerPublicState, CardDef } from '../../../shared/types';
import { soundManager } from '../utils/soundEffects';
import { Heart, Shield, Crown, EyeOff, Bot, Crosshair, Target } from 'lucide-react';

interface PlayerSeatProps {
  player: PlayerPublicState;
  isCurrentTurn: boolean;
  isMe: boolean;
  distanceFromMe?: number;
  difficultyFromMe?: number;
  canTarget?: boolean;
  isTargetSelected?: boolean;
  targetCardName?: string;
  onSelectAsTarget?: (propertyId?: string) => void;
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player,
  isCurrentTurn,
  isMe,
  distanceFromMe,
  difficultyFromMe,
  canTarget = false,
  isTargetSelected = false,
  targetCardName,
  onSelectAsTarget
}) => {
  const [avatarError, setAvatarError] = useState(false);
  const isShogun = player.role?.id === 'shogun';

  const characterImageSrc = player.character
    ? `/assets/characters/${player.character.id}.png`
    : '';

  const handleSelect = (propertyId?: string) => {
    if (canTarget) {
      soundManager.playSwordSlash();
      onSelectAsTarget?.(propertyId);
    }
  };

  return (
    <div
      onClick={() => handleSelect()}
      className={`relative rounded-3xl p-3.5 sm:p-4 border-2 transition-all duration-300 flex flex-col justify-between select-none shadow-2xl backdrop-blur-md ${
        isCurrentTurn
          ? 'border-amber-400 bg-slate-900/95 shadow-amber-500/25 ring-2 ring-amber-400/50 scale-102'
          : 'border-slate-800 bg-slate-900/75 hover:border-slate-700'
      } ${
        canTarget
          ? 'cursor-pointer border-red-500 ring-4 ring-red-500/70 shadow-[0_0_25px_rgba(239,68,68,0.5)] hover:scale-105 hover:ring-red-400 bg-red-950/20'
          : ''
      } ${
        isTargetSelected ? 'border-red-500 ring-4 ring-red-500 bg-red-950/60 scale-105' : ''
      } min-w-[210px] max-w-[270px]`}
    >
      {/* Turn indicator banner */}
      {isCurrentTurn && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-[10px] font-black uppercase px-3.5 py-0.5 rounded-full shadow-lg tracking-wider border border-amber-300 flex items-center gap-1 z-20">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
          Turno in Corso
        </div>
      )}

      {/* Target button overlay if targeting */}
      {canTarget && (
        <div className="absolute -top-3.5 right-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-[11px] font-black px-3 py-1 rounded-full shadow-xl shadow-red-600/50 flex items-center gap-1.5 animate-bounce z-30 border border-red-300">
          <Crosshair className="w-3.5 h-3.5" />
          BERSAGLIO
        </div>
      )}

      {/* Top row: Name & Avatar & Badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-2xl shadow-inner relative overflow-hidden shrink-0">
            {player.character && !avatarError ? (
              <img
                src={characterImageSrc}
                alt={player.character.name}
                onError={() => setAvatarError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              player.character?.avatar || (player.isBot ? '🤖' : '👤')
            )}
            {player.isBot && (
              <span className="absolute -bottom-1 -right-1 bg-slate-900 border border-slate-700 text-[9px] p-0.5 rounded-full">
                <Bot className="w-2.5 h-2.5 text-blue-400" />
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-slate-100 truncate max-w-[105px]">
                {player.name}
              </span>
              {isMe && (
                <span className="text-[10px] bg-indigo-600/60 text-indigo-200 border border-indigo-500/50 px-1 rounded font-bold">
                  Tu
                </span>
              )}
            </div>
            <span className="text-xs text-amber-400/90 font-semibold block truncate">
              {player.character?.name || 'In attesa...'}
            </span>
          </div>
        </div>

        {/* Role Badge (Shogun or Secret) */}
        <div>
          {isShogun ? (
            <div className="flex items-center gap-1 bg-amber-950 border border-amber-500 text-amber-300 px-2 py-0.5 rounded-lg text-xs font-black shadow-md">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              Shōgun
            </div>
          ) : player.role ? (
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-black border shadow-sm"
              style={{
                backgroundColor: `${player.role.color}25`,
                borderColor: player.role.color,
                color: player.role.color
              }}
            >
              {player.role.name}
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-slate-800/90 border border-slate-700 text-slate-400 px-2 py-0.5 rounded-lg text-xs font-medium">
              <EyeOff className="w-3 h-3" />
              Segreto
            </div>
          )}
        </div>
      </div>

      {/* Stats Row: HP & Honor */}
      <div className="mt-3 grid grid-cols-2 gap-2 bg-slate-950/70 rounded-2xl p-2.5 border border-slate-800/80 shadow-inner">
        {/* HP */}
        <div>
          <div className="text-[10px] uppercase font-black text-slate-400 flex items-center gap-1 mb-1">
            <Heart className="w-3 h-3 text-red-500 fill-red-500" />
            Resistenza
          </div>
          <div className="flex items-center gap-1">
            <span className="text-lg font-black text-red-400 leading-none">
              {player.currentHp}
            </span>
            <span className="text-xs text-slate-500 font-bold">/{player.maxHp}</span>
          </div>
        </div>

        {/* Honor */}
        <div>
          <div className="text-[10px] uppercase font-black text-purple-400 flex items-center gap-1 mb-1">
            <span>🪷</span>
            Punti Onore
          </div>
          <div className="text-lg font-black text-purple-300 leading-none">
            {player.honorPoints}
          </div>
        </div>
      </div>

      {/* Status Badges: Cards in hand, Harmless, Defeated */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="bg-slate-800/80 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-md font-semibold">
          🃏 {player.handCount} carte
        </span>

        {player.isHarmless && (
          <span className="bg-amber-950 border border-amber-600 text-amber-300 px-1.5 py-0.5 rounded-md font-bold text-[10px]">
            Inoffensivo
          </span>
        )}

        {player.isDefeatedThisRound && (
          <span className="bg-red-950 border border-red-600 text-red-300 px-1.5 py-0.5 rounded-md font-black text-[10px] animate-pulse">
            Abbattutto
          </span>
        )}

        {/* Distance from viewer */}
        {!isMe && distanceFromMe !== undefined && (
          <span className="bg-indigo-950/80 border border-indigo-700 text-indigo-300 px-2 py-0.5 rounded-md font-bold text-[10px] ml-auto">
            Dist: {distanceFromMe} {difficultyFromMe !== undefined && `(Diff: ${difficultyFromMe})`}
          </span>
        )}
      </div>

      {/* Properties in Play */}
      {player.propertiesInPlay.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-slate-800/80">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
            <Shield className="w-3 h-3 text-blue-400" />
            Proprietà Attive:
          </div>
          <div className="flex flex-wrap gap-1">
            {player.propertiesInPlay.map((prop) => (
              <button
                key={prop.id}
                type="button"
                onClick={(e) => {
                  if (canTarget) {
                    e.stopPropagation();
                    handleSelect(prop.id);
                  }
                }}
                title={prop.description}
                className={`text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1 shadow-sm transition-all ${
                  canTarget
                    ? 'bg-rose-950 border border-rose-500 text-rose-200 hover:scale-105 cursor-pointer ring-1 ring-rose-400'
                    : 'bg-blue-950 border border-blue-700/80 text-blue-300'
                }`}
              >
                {prop.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Character ability preview tooltip */}
      {player.character && (
        <div className="mt-2 text-[10px] text-slate-400 italic line-clamp-2 bg-slate-950/40 p-1.5 rounded-lg border border-slate-800/40">
          "{player.character.abilityDescription}"
        </div>
      )}
    </div>
  );
};
