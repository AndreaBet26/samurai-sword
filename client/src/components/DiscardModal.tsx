import React, { useState } from 'react';
import { CardDef } from '../../../shared/types';
import { Trash2 } from 'lucide-react';
import { CardView } from './CardView';

interface DiscardModalProps {
  myHand: CardDef[];
  currentHp: number;
  onConfirmDiscard: (cardIds: string[]) => void;
}

export const DiscardModal: React.FC<DiscardModalProps> = ({
  myHand,
  currentHp,
  onConfirmDiscard
}) => {
  const excessCount = myHand.length - currentHp;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(cardId => cardId !== id));
    } else {
      if (selectedIds.length < excessCount) {
        setSelectedIds([...selectedIds, id]);
      }
    }
  };

  const isReady = selectedIds.length === excessCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 max-w-2xl w-full shadow-2xl text-center">
        <div className="w-14 h-14 rounded-full bg-amber-950 border-2 border-amber-500 flex items-center justify-center text-amber-400 mx-auto mb-3 shadow-lg">
          <Trash2 className="w-7 h-7" />
        </div>

        <h3 className="font-title text-2xl font-bold text-amber-300">
          Limite Carte Raggiunto (Fase di Scarto)
        </h3>

        <p className="text-sm text-slate-300 mt-2 mb-6 max-w-md mx-auto">
          La tua Resistenza attuale è di <span className="font-bold text-red-400">{currentHp} PV</span>.
          Possiedi {myHand.length} carte in mano. Devi selezionare esattamente{' '}
          <span className="font-bold text-amber-400">{excessCount} carte</span> da scartare per terminare il turno.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 max-h-72 overflow-y-auto p-2 mb-6">
          {myHand.map(card => {
            const isSelected = selectedIds.includes(card.id);
            return (
              <div
                key={card.id}
                onClick={() => toggleSelect(card.id)}
                className="cursor-pointer transition-transform hover:scale-105 relative"
              >
                <CardView card={card} isSelected={isSelected} isPlayable={true} />
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 shadow-lg">
                    <Trash2 className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-4">
          <span className="text-xs font-semibold text-slate-400">
            Selezionate: {selectedIds.length} / {excessCount}
          </span>
          <button
            onClick={() => isReady && onConfirmDiscard(selectedIds)}
            disabled={!isReady}
            className={`py-2.5 px-6 rounded-xl font-bold text-sm shadow-lg transition-all ${
              isReady
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30 cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            Conferma Scarto e Passa Turno
          </button>
        </div>
      </div>
    </div>
  );
};
