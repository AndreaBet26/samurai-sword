import React, { useState } from 'react';
import { CardDef, PendingReaction } from '../../../shared/types';
import { ShieldAlert, Shield, HeartCrack } from 'lucide-react';
import { CardView } from './CardView';

interface ReactionModalProps {
  reaction: PendingReaction;
  myHand: CardDef[];
  myCharacterId?: string;
  onReact: (cardId: string | null) => void;
}

export const ReactionModal: React.FC<ReactionModalProps> = ({
  reaction,
  myHand,
  myCharacterId,
  onReact
}) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Determine eligible defensive cards
  let eligibleCards: CardDef[] = [];
  let title = '';
  let description = '';

  if (reaction.type === 'parry_weapon') {
    title = 'Sei Sotto Attacco!';
    description = `Vieni attaccato con ${reaction.weaponCard?.name || 'un\'Arma'} per un potenziale danno di ${reaction.damage} PV! Gioca una Parata per annullare l'attacco, oppure subisci il colpo.`;
    eligibleCards = myHand.filter(c => c.actionType === 'parry');

    // Hanzo ability
    if (myCharacterId === 'hanzo' && myHand.length > 1) {
      const weapons = myHand.filter(c => c.type === 'weapon');
      eligibleCards = [...eligibleCards, ...weapons];
    }
  } else if (reaction.type === 'battle_cry') {
    title = 'Grido di Battaglia!';
    description = 'Un avversario ha lanciato un Grido di Battaglia. Scarta una carta Parata per difenderti, altrimenti subisci 1 danno!';
    eligibleCards = myHand.filter(c => c.actionType === 'parry');
  } else if (reaction.type === 'jujutsu') {
    title = 'Attacco di Jiujitsu!';
    description = 'Un avversario usa una tecnica di Jiujitsu! Scarta una carta Arma per neutralizzarla, oppure subisci 1 danno.';
    eligibleCards = myHand.filter(c => c.type === 'weapon');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border-2 border-red-500 rounded-3xl p-6 max-w-lg w-full shadow-2xl shadow-red-500/20 text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-red-950 border-2 border-red-500 flex items-center justify-center text-red-400 mb-4 shadow-lg animate-pulse">
          <ShieldAlert className="w-9 h-9" />
        </div>

        <h3 className="font-title text-2xl font-bold text-red-300">{title}</h3>
        <p className="text-sm text-slate-300 mt-2 mb-6 leading-relaxed max-w-md">
          {description}
        </p>

        {/* Eligible cards */}
        {eligibleCards.length > 0 ? (
          <div className="w-full mb-6">
            <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">
              Scegli una carta di difesa dalla tua mano:
            </h4>
            <div className="flex flex-wrap items-center justify-center gap-3 max-h-56 overflow-y-auto p-2">
              {eligibleCards.map(card => (
                <div
                  key={card.id}
                  onClick={() => setSelectedCardId(card.id)}
                  className="cursor-pointer transition-transform hover:scale-105"
                >
                  <CardView
                    card={card}
                    isSelected={selectedCardId === card.id}
                    isPlayable={true}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300 mb-6 font-semibold">
            Non possiedi carte valide in mano per difenderti da questo attacco.
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full">
          {eligibleCards.length > 0 && (
            <button
              onClick={() => selectedCardId && onReact(selectedCardId)}
              disabled={!selectedCardId}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                selectedCardId
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Shield className="w-4 h-4" />
              Difenditi con la carta selezionata
            </button>
          )}

          <button
            onClick={() => onReact(null)}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-700/60 flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <HeartCrack className="w-4 h-4" />
            Subisci il Danno
          </button>
        </div>
      </div>
    </div>
  );
};
