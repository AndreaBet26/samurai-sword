import React, { useState } from 'react';
import { GameLogEntry, PlayerPublicState, CardDef } from '../../../shared/types';
import { CARD_TEMPLATES } from '../../../shared/cardsData';
import { History, Sword, Shield, Sparkles, Heart, Crown, Filter } from 'lucide-react';

interface GameHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  logs: GameLogEntry[];
  players: PlayerPublicState[];
  myId: string;
  onInspectCard?: (card: CardDef) => void;
}

export const GameHistoryDrawer: React.FC<GameHistoryDrawerProps> = ({
  isOpen,
  onClose,
  logs,
  players,
  myId,
  onInspectCard
}) => {
  const [filter, setFilter] = useState<'all' | 'attacks' | 'cards'>('all');

  if (!isOpen) return null;

  // Helper to find a card template from templateId or text name
  const findCardTemplate = (log: GameLogEntry) => {
    if (log.cardTemplateId) {
      const match = CARD_TEMPLATES.find(t => t.templateId === log.cardTemplateId);
      if (match) return match;
    }
    if (log.cardName) {
      const match = CARD_TEMPLATES.find(t => t.name.toLowerCase() === log.cardName?.toLowerCase());
      if (match) return match;
    }
    // Search by text match
    for (const t of CARD_TEMPLATES) {
      if (log.text.toLowerCase().includes(t.name.toLowerCase())) {
        return t;
      }
    }
    return null;
  };

  const getPlayer = (id?: string) => {
    if (!id) return undefined;
    return players.find(p => p.id === id);
  };

  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (filter === 'attacks') return log.type === 'attack' || log.text.includes('attacca');
    if (filter === 'cards') return Boolean(findCardTemplate(log));
    return true;
  });

  // Reverse so newest actions appear at top
  const reversedLogs = [...filteredLogs].reverse();

  return (
    <>
      {/* Backdrop overlay to close drawer */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity animate-fadeIn"
      />

      {/* Slide-over Drawer on the right */}
      <div className="fixed top-0 right-0 h-full w-84 sm:w-96 bg-slate-950/95 border-l-2 border-amber-600/60 shadow-2xl backdrop-blur-xl z-50 flex flex-col justify-between text-slate-100 select-none animate-slideLeft">
        {/* Drawer Header */}
        <div className="p-4 border-b border-amber-900/40 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-title font-bold text-sm text-amber-300 tracking-wide">
                Cronologia Partita
              </h3>
              <p className="text-[10px] text-slate-400">
                {logs.length} azioni registrate
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            title="Chiudi"
          >
            Chiudi
          </button>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center gap-1.5 text-[11px]">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer ${
              filter === 'all'
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Tutte
          </button>
          <button
            onClick={() => setFilter('attacks')}
            className={`px-3 py-1 rounded-full font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
              filter === 'attacks'
                ? 'bg-red-600 text-white font-black'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sword className="w-3 h-3" />
            Attacchi
          </button>
          <button
            onClick={() => setFilter('cards')}
            className={`px-3 py-1 rounded-full font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
              filter === 'cards'
                ? 'bg-blue-600 text-white font-black'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            Carte
          </button>
        </div>

        {/* Action Timeline List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-800/60">
          {reversedLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs italic">
              Nessuna azione trovata in questo filtro.
            </div>
          ) : (
            reversedLogs.map((log) => {
              const cardTpl = findCardTemplate(log);
              const source = getPlayer(log.sourcePlayerId);
              const target = getPlayer(log.targetPlayerId);

              const isSourceMe = log.sourcePlayerId === myId;
              const isTargetMe = log.targetPlayerId === myId;

              // Action Badge styling
              let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
              let badgeLabel = 'Info';
              if (log.type === 'attack') {
                badgeColor = 'bg-red-950/80 text-red-300 border-red-700';
                badgeLabel = 'Attacco';
              } else if (log.type === 'defeat') {
                badgeColor = 'bg-rose-950 text-rose-300 border-rose-600';
                badgeLabel = 'Sconfitto';
              } else if (log.type === 'damage') {
                badgeColor = 'bg-amber-950/90 text-amber-300 border-amber-600';
                badgeLabel = 'Ferita';
              } else if (log.type === 'heal') {
                badgeColor = 'bg-emerald-950/80 text-emerald-300 border-emerald-700';
                badgeLabel = '✨ Cura';
              } else if (log.type === 'action' || (log.type as string) === 'play') {
                badgeColor = 'bg-blue-950/80 text-blue-300 border-blue-700';
                badgeLabel = 'Giocata';
              }

              return (
                <div key={log.id} className="pt-3 first:pt-0 flex items-start gap-3">
                  {/* Miniature Card Thumbnail if card was involved */}
                  {cardTpl ? (
                    <div
                      onClick={() => {
                        if (onInspectCard) {
                          onInspectCard({
                            id: `inspect_${cardTpl.templateId}`,
                            templateId: cardTpl.templateId,
                            name: cardTpl.name,
                            type: cardTpl.type,
                            description: cardTpl.description,
                            difficulty: cardTpl.difficulty,
                            damage: cardTpl.damage,
                            actionType: cardTpl.actionType,
                            propertyType: cardTpl.propertyType
                          });
                        }
                      }}
                      className="w-12 h-17 shrink-0 rounded-md overflow-hidden border border-amber-600/60 bg-slate-900 shadow-md cursor-pointer hover:scale-110 hover:border-amber-400 transition-transform relative group"
                      title={`${cardTpl.name}: Clicca per visualizzare`}
                    >
                      <img
                        src={`/assets/cards/${cardTpl.templateId}.webp`}
                        alt={cardTpl.name}
                        className="w-full h-full object-cover object-center block"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-17 shrink-0 rounded-md border border-slate-800 bg-slate-900/60 flex items-center justify-center text-slate-600 text-lg">
                      <History className="w-5 h-5 text-slate-500" />
                    </div>
                  )}

                  {/* Action Description & Who did what */}
                  <div className="flex-1 min-w-0">
                    {/* Top row: Badge + Time */}
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${badgeColor}`}>
                        {badgeLabel}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>

                    {/* Actor -> Target Row if attack / target exists */}
                    {(log.sourcePlayerName || log.targetPlayerName) && (
                      <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
                        <span className={isSourceMe ? 'text-amber-400' : 'text-slate-200'}>
                          {isSourceMe ? 'Tu' : (log.sourcePlayerName || source?.name || 'Giocatore')}
                        </span>

                        {log.targetPlayerName && (
                          <>
                            <span className="text-red-400 text-xs">➔</span>
                            <span className={isTargetMe ? 'text-amber-400' : 'text-rose-300'}>
                              {isTargetMe ? 'Te' : (log.targetPlayerName || target?.name || 'Bersaglio')}
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Full log message text */}
                    <p className="text-[11px] leading-relaxed text-slate-300">
                      {log.text}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 text-center text-[10px] text-slate-500">
          Samurai Sword • Cronologia Mosse
        </div>
      </div>
    </>
  );
};
