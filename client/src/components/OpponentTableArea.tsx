import React from 'react';
import { PlayerPublicState, CardDef, CharacterDef } from '../../../shared/types';
import { TabletopCard } from './TabletopCard';
import { HeartToken, HonorToken } from './WoodToken';
import { Crosshair, Bot, Crown, Info } from 'lucide-react';
import { soundManager } from '../utils/soundEffects';

interface OpponentTableAreaProps {
  player: PlayerPublicState;
  isCurrentTurn: boolean;
  orientation?: 'horizontal' | 'vertical';
  distanceFromMe?: number;
  difficultyFromMe?: number;
  isTargetable?: boolean;
  onTargetSelect?: () => void;
  onInspectCard?: (card: CardDef) => void;
  onInspectCharacter?: (char: CharacterDef) => void;
}

export const OpponentTableArea: React.FC<OpponentTableAreaProps> = ({
  player,
  isCurrentTurn,
  orientation = 'horizontal',
  distanceFromMe,
  difficultyFromMe,
  isTargetable = false,
  onTargetSelect,
  onInspectCard,
  onInspectCharacter
}) => {
  const isShogun = player.role?.id === 'shogun';

  const characterImage = player.character
    ? `/assets/characters/${player.character.id}.png`
    : '/assets/ui/character_back.png';

  const roleImage = player.role
    ? `/assets/roles/${player.role.id}.png`
    : '/assets/ui/role_back.png';

  const handleClickTarget = () => {
    if (isTargetable) {
      soundManager.playSwordSlash();
      onTargetSelect?.();
    }
  };

  // Hearts array
  const hearts = [];
  for (let i = 0; i < player.maxHp; i++) {
    hearts.push(i < player.currentHp);
  }

  // Honor array
  const honorTokens = Array.from({ length: player.honorPoints });

  // Group properties by templateId/name so identical properties stack cleanly with count badge
  const propertyGroups: Record<string, CardDef[]> = {};
  player.propertiesInPlay.forEach(prop => {
    const key = prop.templateId || prop.name;
    if (!propertyGroups[key]) propertyGroups[key] = [];
    propertyGroups[key].push(prop);
  });

  const propertyEntries = Object.entries(propertyGroups);

  return (
    <div
      id={`table-opponent-${player.id}`}
      onClick={handleClickTarget}
      className={`relative flex flex-col items-center select-none transition-all duration-200 shrink-0 ${
        isTargetable ? 'cursor-pointer scale-105' : ''
      }`}
    >
      {/* Target Reticle Banner if targetable */}
      {isTargetable && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-30 bg-red-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-lg flex items-center gap-1 animate-bounce whitespace-nowrap">
          <Crosshair className="w-3.5 h-3.5" />
          Colpisci
        </div>
      )}

      {/* Turn indicator glow */}
      {isCurrentTurn && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-lg border border-amber-300 z-20 whitespace-nowrap animate-pulse">
          Turno in corso
        </div>
      )}

      {/* Player Name & Distance Label */}
      <div className="flex items-center gap-1.5 mb-1 text-xs">
        <span
          className={`font-title font-bold drop-shadow-md ${
            isCurrentTurn ? 'text-amber-300' : 'text-slate-100'
          }`}
        >
          {player.name}
        </span>
        {player.isBot && <Bot className="w-3 h-3 text-blue-400 opacity-80" />}
        {distanceFromMe !== undefined && (
          <span className="text-[10px] text-amber-400 font-semibold drop-shadow">
            (D:{distanceFromMe} Diff:{difficultyFromMe})
          </span>
        )}
      </div>

      {/* Physical Cards on Table: VERTICAL layout for left/right opponents vs HORIZONTAL for top opponents */}
      <div
        className={`flex ${
          orientation === 'vertical' ? 'flex-col items-center gap-2' : 'flex-row items-center gap-2'
        } relative`}
      >
        {/* Main Identity Cards: Character + Role */}
        <div className="flex items-center gap-1.5 relative">
          {/* Character Card */}
          <div
            onClick={(e) => {
              if (isTargetable) return;
              if (player.character && onInspectCharacter) {
                e.stopPropagation();
                onInspectCharacter(player.character);
              }
            }}
            className="relative group cursor-pointer"
            title={player.character ? `${player.character.name}: Clicca per vedere l'abilità` : ''}
          >
            <TabletopCard
              imageSrc={characterImage}
              fallbackText={player.character?.name || 'Personaggio'}
              size="md"
              isTargetable={isTargetable}
            />
            {player.isDefeatedThisRound && (
              <div className="absolute inset-0 bg-red-950/80 rounded-md flex items-center justify-center text-red-300 text-[10px] font-black">
                Abbattutto
              </div>
            )}
            {player.character && !isTargetable && (
              <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 rounded-full p-0.5 text-amber-400">
                <Info className="w-2.5 h-2.5" />
              </div>
            )}
          </div>

          {/* Role Card */}
          <div className="relative">
            <TabletopCard
              imageSrc={roleImage}
              fallbackText={player.role?.name || 'Ruolo'}
              size="md"
            />
            {isShogun && (
              <div className="absolute -top-2 -right-1 bg-amber-500 text-slate-950 p-0.5 rounded-full shadow">
                <Crown className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        </div>

        {/* In-play Properties on table: Grouped and stacked with count badge! */}
        {propertyEntries.length > 0 && (
          <div className="flex items-center gap-2">
            {propertyEntries.map(([groupKey, cards]) => {
              const topCard = cards[0];
              const count = cards.length;

              return (
                <div
                  key={groupKey}
                  onClick={(e) => {
                    e.stopPropagation();
                    onInspectCard?.(topCard);
                  }}
                  className="relative cursor-pointer hover:scale-105 transition-transform"
                  title={`${topCard.name} (${count}): Clicca per ingrandire`}
                >
                  {/* Physical 3D card stack depth underlayers when count > 1 */}
                  {count > 1 && (
                    <>
                      <div className="absolute inset-0 bg-slate-900 border border-slate-700/80 rounded-md shadow-md pointer-events-none translate-x-1 translate-y-1 z-0" />
                      {count > 2 && (
                        <div className="absolute inset-0 bg-slate-900 border border-slate-700/80 rounded-md shadow pointer-events-none translate-x-2 translate-y-2 -z-10" />
                      )}
                      {/* Count badge */}
                      <span className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs px-2 py-0.5 rounded-full border-2 border-amber-200 shadow-xl z-20">
                        x{count}
                      </span>
                    </>
                  )}

                  <div className="relative z-10">
                    <TabletopCard
                      imageSrc={`/assets/cards/${topCard.templateId}.png`}
                      fallbackText={topCard.name}
                      size="sm"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Physical Tokens row: Hearts (Vite) and Lotus (Onore) resting right below the cards */}
      <div className="flex items-center gap-2 mt-1.5">
        {/* Hearts */}
        <div className="flex items-center gap-0.5">
          {hearts.map((isFilled, idx) => (
            <HeartToken key={idx} isFilled={isFilled} size="sm" />
          ))}
        </div>

        {/* Separator */}
        <span className="text-slate-600 text-[10px]">•</span>

        {/* Honor */}
        <div className="flex items-center gap-0.5">
          {honorTokens.map((_, idx) => (
            <HonorToken key={idx} size="sm" />
          ))}
        </div>
      </div>

      {/* Opponent's Cards in Hand (mini facedown cards) & Harmless state */}
      <div className="flex items-center gap-1 mt-1">
        {player.isHarmless ? (
          <span className="text-[9px] font-bold text-amber-400 bg-black/70 px-1.5 py-0.5 rounded border border-amber-600/60 shadow">
            Inoffensivo (0 carte)
          </span>
        ) : (
          <div className="flex items-center -space-x-3.5">
            {Array.from({ length: Math.min(5, player.handCount) }).map((_, idx) => (
              <TabletopCard
                key={idx}
                imageSrc="/assets/ui/card_back.png"
                fallbackText="Dorso"
                size="xs"
              />
            ))}
            {player.handCount > 5 && (
              <span className="text-[9px] font-bold text-slate-300 ml-4 drop-shadow">
                +{player.handCount - 5}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
