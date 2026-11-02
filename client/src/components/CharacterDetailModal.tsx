import React from 'react';
import { CharacterDef } from '../../../shared/types';
import { TabletopCard } from './TabletopCard';
import { X, Shield, Sparkles, Heart } from 'lucide-react';

interface CharacterDetailModalProps {
  character: CharacterDef;
  onClose: () => void;
}

export const CharacterDetailModal: React.FC<CharacterDetailModalProps> = ({ character, onClose }) => {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col md:flex-row items-center gap-6 max-w-xl w-full bg-slate-900/95 border border-amber-600/50 rounded-3xl p-6 shadow-2xl backdrop-blur-xl"
      >
        {/* Top-Right Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-full border border-slate-700 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Character Card Portrait */}
        <div className="shrink-0 transform hover:scale-105 transition-transform duration-200">
          <TabletopCard
            imageSrc={`/assets/characters/${character.id}.webp`}
            fallbackText={character.name}
            size="zoom"
            isHoverable={false}
          />
        </div>

        {/* Character Info & Ability Description */}
        <div className="flex flex-col text-left space-y-3 flex-1">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{character.avatar || '⚔️'}</span>
              <h2 className="text-2xl font-title font-black text-amber-400 tracking-wider">
                {character.name}
              </h2>
            </div>
            <p className="text-xs font-semibold text-amber-500/80 italic mt-0.5">
              {character.title}
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/80 w-fit">
            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
            <span className="text-xs text-slate-300 font-bold">
              Resistenza Massima: <strong className="text-red-400">{character.maxHp} PV</strong>
            </span>
          </div>

          <div className="bg-slate-950/80 border border-amber-600/30 rounded-2xl p-4 shadow-inner">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              ABILITÀ SPECIALE
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              {character.abilityDescription}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
