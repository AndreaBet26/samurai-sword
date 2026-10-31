import React, { useState, useEffect } from 'react';
import { CharacterDef, RoleDef } from '../../../shared/types';
import { soundManager } from '../utils/soundEffects';
import { Crown, Heart, Shield, Sparkles, Sword, Play } from 'lucide-react';

interface OpeningCutsceneProps {
  character: CharacterDef;
  role: RoleDef;
  onComplete: () => void;
}

export const OpeningCutscene: React.FC<OpeningCutsceneProps> = ({
  character,
  role,
  onComplete
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [cardFlipped, setCardFlipped] = useState(false);

  useEffect(() => {
    // Play initial Taiko
    soundManager.playTaiko();

    // Sequence timing
    const t1 = setTimeout(() => {
      setCardFlipped(true);
      soundManager.playCardSlide();
    }, 1200);

    const t2 = setTimeout(() => {
      setStep(2);
      setCardFlipped(false);
      soundManager.playGong();
    }, 3800);

    const t3 = setTimeout(() => {
      setCardFlipped(true);
      soundManager.playCardSlide();
    }, 4800);

    const t4 = setTimeout(() => {
      setStep(3);
      soundManager.playTaiko();
    }, 7800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  const isShogun = role.id === 'shogun';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/95 backdrop-blur-xl select-none overflow-hidden animate-fadeIn">
      {/* Background Japanese Calligraphy Ambience */}
      <div className="absolute inset-0 pointer-events-none opacity-5 flex items-center justify-center font-jp text-[35vw] text-amber-500 leading-none">
        武士道
      </div>

      {/* Skip Button */}
      <button
        onClick={onComplete}
        className="absolute top-6 right-6 z-50 text-xs font-semibold text-slate-400 hover:text-amber-400 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
      >
        Salta Intro
        <Play className="w-3.5 h-3.5 fill-current" />
      </button>

      {/* STEP 1: Character Assignment */}
      {step === 1 && (
        <div className="flex flex-col items-center text-center max-w-md w-full animate-fadeIn">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Il Tuo Spirito Guerriero
          </span>
          <h2 className="font-title text-2xl sm:text-3xl font-black text-slate-100 mb-6">
            La Via del Samurai ti ha Scelto
          </h2>

          {/* 3D Flip Card Container */}
          <div className="perspective-1000 w-56 h-80 relative cursor-pointer my-2">
            <div
              className={`w-full h-full transition-transform duration-700 preserve-3d ${
                cardFlipped ? 'rotate-y-180' : ''
              }`}
            >
              {/* Card Back */}
              <div className="absolute inset-0 backface-hidden rounded-2xl bg-gradient-to-br from-red-950 via-slate-900 to-black border-2 border-amber-600/60 shadow-2xl flex flex-col items-center justify-center p-4 text-center">
                <div className="w-16 h-16 rounded-full border-2 border-amber-500/80 flex items-center justify-center text-2xl text-amber-400 mb-3 shadow-inner">
                  ⚔️
                </div>
                <span className="font-title text-sm font-bold text-amber-300 tracking-wider">
                  SAMURAI SWORD
                </span>
                <span className="font-jp text-xs text-amber-500/60 mt-1">侍の魂</span>
              </div>

              {/* Card Front (Character) */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500 shadow-2xl flex flex-col justify-between p-4 text-left overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <h3 className="font-title font-black text-lg text-amber-400">
                      {character.name}
                    </h3>
                    <span className="text-[11px] text-slate-400 font-semibold">
                      {character.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-red-950/80 border border-red-600 text-red-300 px-2 py-0.5 rounded-lg text-xs font-black">
                    <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
                    {character.maxHp} PV
                  </div>
                </div>

                <div className="my-auto flex flex-col items-center py-2 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-4xl shadow-inner mb-2">
                    {character.avatar}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed italic bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    "{character.abilityDescription}"
                  </p>
                </div>

                <div className="text-[10px] text-amber-500/80 font-bold uppercase tracking-wider text-center pt-1 border-t border-slate-800">
                  Personaggio di Gioco
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-6 animate-pulse">
            Preparati a ricevere il tuo Ruolo Segreto...
          </p>
        </div>
      )}

      {/* STEP 2: Secret Role Reveal */}
      {step === 2 && (
        <div className="flex flex-col items-center text-center max-w-md w-full animate-fadeIn">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-2 flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5" />
            Il Tuo Destino nel Feudo
          </span>
          <h2 className="font-title text-2xl sm:text-3xl font-black text-slate-100 mb-6">
            La Fazione e la Missione Segreta
          </h2>

          {/* 3D Flip Card Container for Role */}
          <div className="perspective-1000 w-56 h-80 relative cursor-pointer my-2">
            <div
              className={`w-full h-full transition-transform duration-700 preserve-3d ${
                cardFlipped ? 'rotate-y-180' : ''
              }`}
            >
              {/* Role Card Back */}
              <div className="absolute inset-0 backface-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-black border-2 border-slate-700 shadow-2xl flex flex-col items-center justify-center p-4 text-center">
                <div className="w-16 h-16 rounded-full border-2 border-slate-600 flex items-center justify-center text-2xl text-slate-400 mb-3 shadow-inner">
                  🎭
                </div>
                <span className="font-title text-sm font-bold text-slate-300 tracking-wider">
                  RUOLO SEGRETO
                </span>
                <span className="text-[10px] text-slate-500 mt-1">Non rivelare a nessuno</span>
              </div>

              {/* Role Card Front */}
              <div
                className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl border-2 shadow-2xl flex flex-col justify-between p-5 text-center overflow-hidden bg-slate-900"
                style={{ borderColor: role.color }}
              >
                <div className="border-b border-slate-800 pb-3">
                  <div
                    className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2"
                    style={{ backgroundColor: `${role.color}30`, color: role.color }}
                  >
                    {isShogun ? 'Ruolo Palese a Tutti' : 'Ruolo Segreto'}
                  </div>
                  <h3 className="font-title font-black text-2xl" style={{ color: role.color }}>
                    {role.name}
                  </h3>
                </div>

                <div className="my-auto py-2">
                  <div
                    className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-3xl mb-3 border shadow-lg"
                    style={{ borderColor: role.color, backgroundColor: `${role.color}20` }}
                  >
                    {isShogun ? '👑' : role.id === 'ninja' ? '🥷' : role.id === 'samurai' ? '🗡️' : '🦅'}
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    {role.description}
                  </p>
                </div>

                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pt-2 border-t border-slate-800">
                  {isShogun
                    ? 'Inizi per primo la partita'
                    : 'Mantieni il segreto fino alla fine'}
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-6 animate-pulse">
            Le carte vengono distribuite dal mazzo...
          </p>
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
