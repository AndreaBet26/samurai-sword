import React from 'react';
import { CharacterDef } from '../../../shared/types';
import { TabletopCard } from './TabletopCard';

interface CharacterDetailModalProps {
  character: CharacterDef;
  onClose: () => void;
}

export const CharacterDetailModal: React.FC<CharacterDetailModalProps> = ({ character, onClose }) => {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn select-none cursor-pointer"
      title="Clicca ovunque per chiudere"
    >
      <div
        onClick={onClose}
        className="rounded-2xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.95)] border-2 border-amber-500/80 transform hover:scale-102 transition-transform cursor-pointer"
      >
        <TabletopCard
          imageSrc={`/assets/characters/${character.id}.webp`}
          fallbackText={character.name}
          size="zoom"
          isHoverable={false}
        />
      </div>
    </div>
  );
};
