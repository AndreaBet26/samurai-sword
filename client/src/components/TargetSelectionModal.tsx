import React, { useState } from 'react';
import { CardDef, PlayerPublicState } from '../../../shared/types';
import { canAttackWithWeapon, calculateTargetDifficulty, calculateDistance } from '../../../shared/rules';
import { Crosshair, X, Shield, User } from 'lucide-react';

interface TargetSelectionModalProps {
  cardToPlay: CardDef;
  myPlayer: PlayerPublicState;
  allPlayers: PlayerPublicState[];
  onConfirm: (targetPlayerId: string, targetPropertyId?: string) => void;
  onCancel: () => void;
}

export const TargetSelectionModal: React.FC<TargetSelectionModalProps> = ({
  cardToPlay,
  myPlayer,
  allPlayers,
  onConfirm,
  onCancel
}) => {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | undefined>(undefined);

  const isWeapon = cardToPlay.type === 'weapon';
  const isGeisha = cardToPlay.actionType === 'geisha';
  const isDiversion = cardToPlay.actionType === 'diversion';
  const isBreathing = cardToPlay.actionType === 'breathing';
  const isBushido = cardToPlay.propertyType === 'bushido';

  // Filter valid candidate targets
  const candidates = allPlayers.filter(p => {
    if (p.id === myPlayer.id) return false;

    if (isWeapon) {
      const check = canAttackWithWeapon(allPlayers, myPlayer, p, cardToPlay);
      return check.canAttack;
    }

    if (isDiversion) {
      return p.handCount > 0;
    }

    if (isGeisha) {
      return p.handCount > 0 || p.propertiesInPlay.length > 0;
    }

    if (isBushido) {
      return !p.isHarmless && p.currentHp > 0;
    }

    if (isBreathing) {
      return true; // Any other player
    }

    return true;
  });

  const selectedPlayer = allPlayers.find(p => p.id === selectedPlayerId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <Crosshair className="w-5 h-5 text-red-400" />
          <h3 className="font-title text-xl font-bold text-slate-100">
            Scegli il Bersaglio per {cardToPlay.name}
          </h3>
        </div>

        <p className="text-xs text-slate-300 mb-5">
          {isWeapon && `Gittata dell'arma: ${cardToPlay.difficulty}. Seleziona un avversario a portata:`}
          {isGeisha && 'Scegli un giocatore a cui far scartare una Proprietà o una carta dalla mano:'}
          {isDiversion && 'Scegli da quale giocatore rubare una carta a caso dalla mano:'}
          {isBreathing && 'Scegli quale altro giocatore pescherà 1 carta:'}
          {isBushido && 'Scegli davanti a quale giocatore piazzare la maledizione del Bushido:'}
        </p>

        {candidates.length === 0 ? (
          <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-center text-sm text-red-300 my-4 font-semibold">
            Nessun bersaglio valido a portata per questa carta!
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1 mb-5">
            {candidates.map(target => {
              const distance = calculateDistance(allPlayers, myPlayer.id, target.id);
              const difficulty = calculateTargetDifficulty(allPlayers, myPlayer, target);
              const isSelected = selectedPlayerId === target.id;

              return (
                <div
                  key={target.id}
                  onClick={() => {
                    setSelectedPlayerId(target.id);
                    setSelectedPropertyId(undefined);
                  }}
                  className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'border-amber-400 bg-amber-950/30 ring-2 ring-amber-400/50'
                      : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{target.character?.avatar || '👤'}</span>
                    <div>
                      <div className="font-bold text-sm text-slate-100">{target.name}</div>
                      <div className="text-xs text-slate-400">
                        {target.character?.name} • PV: {target.currentHp}/{target.maxHp} • Onore: {target.honorPoints}
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-xs">
                    {isWeapon && (
                      <span className="font-bold text-amber-300 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                        Diff: {difficulty} (Dist: {distance})
                      </span>
                    )}
                    {isDiversion && (
                      <span className="text-slate-400">Mano: {target.handCount} carte</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* If Geisha is selected and target has properties, ask whether to discard property or hand */}
        {isGeisha && selectedPlayer && selectedPlayer.propertiesInPlay.length > 0 && (
          <div className="mb-5 p-3 bg-blue-950/30 border border-blue-800/60 rounded-xl">
            <h4 className="text-xs font-bold uppercase text-blue-300 tracking-wider mb-2 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" />
              Scegli cosa far scartare a {selectedPlayer.name}:
            </h4>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedPropertyId(undefined)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-semibold cursor-pointer ${
                  selectedPropertyId === undefined
                    ? 'bg-amber-600 border-amber-400 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                Carta a caso dalla mano ({selectedPlayer.handCount})
              </button>
              {selectedPlayer.propertiesInPlay.map(prop => (
                <button
                  type="button"
                  key={prop.id}
                  onClick={() => setSelectedPropertyId(prop.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-semibold cursor-pointer ${
                    selectedPropertyId === prop.id
                      ? 'bg-blue-600 border-blue-400 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  Proprietà: {prop.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold transition-colors cursor-pointer"
          >
            Annulla
          </button>
          <button
            onClick={() => selectedPlayerId && onConfirm(selectedPlayerId, selectedPropertyId)}
            disabled={!selectedPlayerId}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all ${
              selectedPlayerId
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            Conferma Attacco / Azione
          </button>
        </div>
      </div>
    </div>
  );
};
