import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { GameState } from '../../../shared/types';
import { Trophy, Crown, Skull, RefreshCw } from 'lucide-react';

interface GameOverModalProps {
  gameState: GameState;
  onPlayAgain: () => void;
  /** Solo l'host può avviare la rivincita */
  isHost?: boolean;
  onRematch?: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  gameState,
  onPlayAgain,
  isHost = false,
  onRematch
}) => {
  const scores = gameState.finalScores;

  useEffect(() => {
    // Fire festive fireworks confetti
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // ignore
    }
  }, []);

  const teamTitles = {
    shogun: { name: 'Vittoria dello Shōgun & Samurai! ', color: 'text-amber-400', border: 'border-amber-500' },
    ninja: { name: 'Vittoria della Squadra Ninja! ', color: 'text-blue-400', border: 'border-blue-500' },
    ronin: { name: 'Vittoria del Ronin! ', color: 'text-red-400', border: 'border-red-500' },
    draw: { name: 'Pareggio Straordinario! ', color: 'text-slate-300', border: 'border-slate-500' }
  };

  const winningInfo = teamTitles[gameState.winnerTeam || 'draw'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
      <div className={`bg-slate-900 border-2 ${winningInfo.border} rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl text-center flex flex-col items-center`}>
        <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-amber-400 flex items-center justify-center text-amber-400 mb-4 shadow-xl">
          <Trophy className="w-9 h-9" />
        </div>

        <h2 className="font-title text-3xl font-black text-slate-100 tracking-wide mb-1">
          Partita Conclusa!
        </h2>
        <div className={`font-title text-xl font-bold ${winningInfo.color} ${scores?.summary ? 'mb-2' : 'mb-6'}`}>
          {winningInfo.name}
        </div>
        {scores?.summary && (
          <p className="text-xs text-slate-400 mb-6 max-w-lg">{scores.summary}</p>
        )}

        {/* Team Totals Summary */}
        {scores && (
          <div className="grid grid-cols-3 gap-3 w-full mb-6">
            <div className="bg-amber-950/40 border border-amber-700/60 p-3 rounded-2xl">
              <span className="text-xs uppercase font-bold text-amber-300 block mb-1">Shōgun & Samurai</span>
              <span className="text-2xl font-black text-amber-400">{scores.shogunSamurai}</span>
              {scores.deadlyStrikeTeam === 'shogun' && <span className="text-[10px] text-red-400 block">Colpo Mortale −3</span>}
              <span className="text-[10px] text-slate-400 block">Punti Totali</span>
            </div>

            <div className="bg-blue-950/40 border border-blue-700/60 p-3 rounded-2xl">
              <span className="text-xs uppercase font-bold text-blue-300 block mb-1">Squadra Ninja</span>
              <span className="text-2xl font-black text-blue-400">{scores.ninja}</span>
              {scores.deadlyStrikeTeam === 'ninja' && <span className="text-[10px] text-red-400 block">Colpo Mortale −3</span>}
              <span className="text-[10px] text-slate-400 block">Punti Totali</span>
            </div>

            <div className="bg-red-950/40 border border-red-700/60 p-3 rounded-2xl">
              <span className="text-xs uppercase font-bold text-red-300 block mb-1">Ronin</span>
              <span className="text-2xl font-black text-red-400">{scores.ronin}</span>
              <span className="text-[10px] text-slate-400 block">Punti Totali</span>
            </div>
          </div>
        )}

        {/* Player Detail Breakdown Table */}
        {scores && (
          <div className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Giocatore</th>
                    <th className="py-2.5 px-3">Ruolo Segreto</th>
                    <th className="py-2.5 px-3 text-center">Onore</th>
                    <th className="py-2.5 px-3 text-center">Daimyo</th>
                    <th className="py-2.5 px-3 text-center">Moltiplicatore</th>
                    <th className="py-2.5 px-3 text-right">Punti</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {scores.playerScores.map(p => (
                    <tr key={p.playerId} className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-3 font-bold">{p.name}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className="px-2 py-0.5 rounded font-bold text-[11px] inline-block"
                          style={{
                            backgroundColor: `${p.role.color}25`,
                            color: p.role.color
                          }}
                        >
                          {p.role.name}
                          {p.role.stars ? ` ${'★'.repeat(p.role.stars)}` : ''}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-purple-300">
                        <span className="inline-flex items-center gap-1.5 justify-center">
                          {p.honorPoints}
                          <img src="/assets/ui/honor_token.webp" alt="Onore" className="w-4 h-4 object-contain inline-block drop-shadow" />
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium text-amber-300">
                        +{p.daimyoBonus}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400">
                        x{p.multiplier}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-sm text-yellow-400">
                        {p.totalScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center gap-3">
          {isHost ? (
            <button
              onClick={onRematch}
              className="py-3 px-8 rounded-xl font-title font-bold text-base bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-xl shadow-amber-500/25 flex items-center gap-2 cursor-pointer transition-all hover:scale-105"
            >
              <RefreshCw className="w-5 h-5" />
              Rivincita
            </button>
          ) : (
            <p className="text-sm text-slate-400 italic">In attesa che l'host avvii la rivincita…</p>
          )}
          <button onClick={onPlayAgain} className="text-xs font-semibold text-slate-400 hover:text-slate-100 underline underline-offset-4 cursor-pointer">
            Esci dalla stanza
          </button>
        </div>
      </div>
    </div>
  );
};
