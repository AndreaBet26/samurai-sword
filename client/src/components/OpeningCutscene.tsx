import React, { useState, useEffect } from 'react';
import { CharacterDef, RoleDef, PlayerPublicState } from '../../../shared/types';
import { soundManager } from '../utils/soundEffects';
import { Crown, Heart, Shield, Sparkles, Sword, Play, ChevronRight, User } from 'lucide-react';

interface OpeningCutsceneProps {
  character: CharacterDef;
  role: RoleDef;
  players?: PlayerPublicState[];
  myPlayerId?: string;
  onComplete: () => void;
}

export const OpeningCutscene: React.FC<OpeningCutsceneProps> = ({
  character,
  role,
  players = [],
  myPlayerId = '',
  onComplete
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [cardFlipped, setCardFlipped] = useState(false);

  useEffect(() => {
    // Play initial Taiko
    soundManager.playTaiko();

    // Step 1: Flip character card after 1s
    const t1 = setTimeout(() => {
      setCardFlipped(true);
      soundManager.playCardSlide();
    }, 1000);

    // Step 2: Secret role reveal after 3.8s
    const t2 = setTimeout(() => {
      setStep(2);
      setCardFlipped(false);
      soundManager.playGong();
    }, 4000);

    // Flip role card after 1s
    const t3 = setTimeout(() => {
      setCardFlipped(true);
      soundManager.playCardSlide();
    }, 5000);

    // Step 3: Ready for battle after 8.2s
    const t4 = setTimeout(() => {
      setStep(3);
      soundManager.playTaiko();
    }, 8500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  const isShogun = role.id === 'shogun';

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
      setCardFlipped(true);
      soundManager.playGong();
    } else if (step === 2) {
      setStep(3);
      soundManager.playTaiko();
    } else {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/95 backdrop-blur-xl select-none overflow-hidden animate-fadeIn">
      {/* Background Japanese Calligraphy Ambience */}
      <div className="absolute inset-0 pointer-events-none opacity-5 flex items-center justify-center font-jp text-[35vw] text-amber-500 leading-none">
        武士道
      </div>

      {/* Skip Button */}
      <button
        onClick={onComplete}
        className="absolute top-6 right-6 z-50 text-xs font-semibold text-slate-400 hover:text-amber-400 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-lg"
      >
        Salta Intro
        <Play className="w-3.5 h-3.5 fill-current" />
      </button>

      {/* STEP 1: Character Assignment */}
      {step === 1 && (
        <div className="flex flex-col items-center text-center max-w-lg w-full animate-fadeIn">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Il Tuo Spirito Guerriero
          </span>
          <h2 className="font-title text-2xl sm:text-3xl font-black text-slate-100 mb-3">
            La Via del Samurai ti ha Scelto
          </h2>

          {/* 3D Flip Card Container */}
          <div
            onClick={() => setCardFlipped(prev => !prev)}
            className="perspective-1000 w-52 sm:w-60 h-76 sm:h-84 relative cursor-pointer my-2 drop-shadow-2xl hover:scale-105 transition-transform"
          >
            <div
              className={`w-full h-full transition-transform duration-700 preserve-3d ${
                cardFlipped ? 'rotate-y-180' : ''
              }`}
            >
              {/* Card Back */}
              <div className="absolute inset-0 backface-hidden rounded-2xl bg-gradient-to-br from-red-950 via-slate-900 to-black border-2 border-amber-600/60 shadow-2xl flex flex-col items-center justify-center p-4 text-center overflow-hidden">
                <img
                  src="/assets/ui/character_back.webp"
                  alt="Dorso Personaggio"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to stylized box if image missing
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-black/40">
                  <div className="w-16 h-16 rounded-full border-2 border-amber-500/80 flex items-center justify-center text-2xl text-amber-400 mb-3 shadow-inner">
                    ⚔️
                  </div>
                  <span className="font-title text-sm font-bold text-amber-300 tracking-wider">
                    SAMURAI SWORD
                  </span>
                  <span className="font-jp text-xs text-amber-500/60 mt-1">侍の魂</span>
                </div>
              </div>

              {/* Card Front (Character) */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl border-2 border-amber-500 shadow-2xl overflow-hidden bg-slate-950 flex flex-col">
                <img
                  src={`/assets/characters/${character.id}.webp`}
                  alt={character.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Character Details Banner */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 mt-2 max-w-sm w-full text-center shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
              <div className="text-left">
                <span className="text-base font-black text-amber-400 block">{character.name}</span>
                <span className="text-[11px] text-slate-400 font-semibold">{character.title}</span>
              </div>
              <div className="flex items-center gap-1 bg-red-950 border border-red-600 text-red-300 px-2 py-0.5 rounded-lg text-xs font-black">
                <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
                {character.maxHp} PF
              </div>
            </div>
            <p className="text-xs text-slate-300 italic">
              "{character.abilityDescription}"
            </p>
          </div>

          {/* Table Roster Pill Row */}
          {players.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 max-w-md">
              <span className="text-[10px] text-slate-500 font-bold uppercase w-full mb-0.5">
                Guerrieri al Tavolo
              </span>
              {players.map(p => (
                <span
                  key={p.id}
                  className={`text-[10px] px-2 py-0.5 rounded-lg border font-semibold flex items-center gap-1 ${
                    p.id === myPlayerId
                      ? 'bg-amber-950/80 border-amber-500 text-amber-200'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400'
                  }`}
                >
                  <span>{p.isBot ? '🤖' : '👤'}</span>
                  <span>{p.name}</span>
                  {p.character && <span className="text-amber-400/80">({p.character.name})</span>}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={handleNext}
            className="mt-3 text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
          >
            Rivela Ruolo Segreto <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* STEP 2: Secret Role Reveal */}
      {step === 2 && (
        <div className="flex flex-col items-center text-center max-w-lg w-full animate-fadeIn">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-1 flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5" />
            Il Tuo Destino nel Feudo
          </span>
          <h2 className="font-title text-2xl sm:text-3xl font-black text-slate-100 mb-3">
            La Fazione e la Missione Segreta
          </h2>

          {/* 3D Flip Card Container for Role */}
          <div
            onClick={() => setCardFlipped(prev => !prev)}
            className="perspective-1000 w-52 sm:w-60 h-76 sm:h-84 relative cursor-pointer my-2 drop-shadow-2xl hover:scale-105 transition-transform"
          >
            <div
              className={`w-full h-full transition-transform duration-700 preserve-3d ${
                cardFlipped ? 'rotate-y-180' : ''
              }`}
            >
              {/* Role Card Back */}
              <div className="absolute inset-0 backface-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-black border-2 border-slate-700 shadow-2xl flex flex-col items-center justify-center p-4 text-center overflow-hidden">
                <img
                  src="/assets/ui/role_back.webp"
                  alt="Dorso Ruolo"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-black/40">
                  <div className="w-16 h-16 rounded-full border-2 border-slate-600 flex items-center justify-center text-2xl text-slate-400 mb-3 shadow-inner">
                    🎭
                  </div>
                  <span className="font-title text-sm font-bold text-slate-300 tracking-wider">
                    RUOLO SEGRETO
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">Non rivelare a nessuno</span>
                </div>
              </div>

              {/* Role Card Front */}
              <div
                className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl border-2 shadow-2xl overflow-hidden bg-slate-950 flex flex-col"
                style={{ borderColor: role.color }}
              >
                <img
                  src={`/assets/roles/${role.id}.webp`}
                  alt={role.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Role Details Banner */}
          <div
            className="border rounded-2xl p-3.5 mt-2 max-w-sm w-full text-center shadow-lg bg-slate-900/90"
            style={{ borderColor: `${role.color}80` }}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
              <span className="text-base font-black" style={{ color: role.color }}>
                {role.name}
              </span>
              <span
                className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${role.color}25`, color: role.color }}
              >
                {isShogun ? 'Ruolo Palese a Tutti' : 'Ruolo Segreto'}
              </span>
            </div>
            <p className="text-xs text-slate-200 font-medium leading-relaxed">
              {role.description}
            </p>
          </div>

          {/* Table Roster with Shogun Highlight */}
          {players.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 max-w-md">
              {players.map(p => {
                const isShogunP = p.role?.id === 'shogun';
                return (
                  <span
                    key={p.id}
                    className={`text-[10px] px-2 py-0.5 rounded-lg border font-semibold flex items-center gap-1 ${
                      isShogunP
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400/50'
                        : p.id === myPlayerId
                        ? 'bg-slate-800 border-amber-500 text-amber-300'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span>{isShogunP ? '👑' : '🎭'}</span>
                    <span>{p.name}</span>
                    <span className="text-[9px] opacity-75">
                      {isShogunP ? '(Shōgun)' : p.id === myPlayerId ? `(${role.name})` : '(Segreto)'}
                    </span>
                  </span>
                );
              })}
            </div>
          )}

          <button
            onClick={handleNext}
            className="mt-3 text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
          >
            Procedi al Tavolo <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* STEP 3: Ready for Battle */}
      {step === 3 && (
        <div className="flex flex-col items-center text-center max-w-md w-full animate-fadeIn">
          <div className="w-16 h-16 rounded-2xl bg-amber-950 border-2 border-amber-500 flex items-center justify-center text-amber-400 mb-4 shadow-xl shadow-amber-500/20">
            <Sword className="w-8 h-8" />
          </div>

          <h2 className="font-title text-3xl font-black text-slate-100 mb-2">
            Il Tavolo è Pronto!
          </h2>
          <p className="text-sm text-slate-300 mb-6 leading-relaxed">
            Sei <strong className="text-amber-400">{character.name}</strong>, che combatte come{' '}
            <strong style={{ color: role.color }}>{role.name}</strong>.
            <br />
            Difendi il tuo Onore fino all'ultimo gettone!
          </p>

          <button
            onClick={onComplete}
            className="w-full py-4 px-6 rounded-2xl font-title font-bold text-base bg-gradient-to-r from-red-600 via-red-500 to-red-600 hover:from-red-500 hover:to-red-600 text-white shadow-2xl shadow-red-600/30 transition-all hover:scale-105 cursor-pointer flex items-center justify-center gap-2"
          >
            <Sword className="w-5 h-5" />
            Entra nel Campo di Battaglia
          </button>
        </div>
      )}
    </div>
  );
};
