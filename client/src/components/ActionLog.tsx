import React, { useEffect, useRef } from 'react';
import { GameLogEntry } from '../../../shared/types';
import { ScrollText, Sword, Heart, Shield, Trophy, Skull, Info } from 'lucide-react';

interface ActionLogProps {
  logs: GameLogEntry[];
}

export const ActionLog: React.FC<ActionLogProps> = ({ logs }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogIcon = (type: GameLogEntry['type']) => {
    switch (type) {
      case 'attack':
        return <Sword className="w-3.5 h-3.5 text-red-400 shrink-0" />;
      case 'damage':
        return <Skull className="w-3.5 h-3.5 text-orange-400 shrink-0" />;
      case 'heal':
        return <Heart className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'defeat':
        return <Skull className="w-3.5 h-3.5 text-red-500 shrink-0" />;
      case 'action':
        return <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
      case 'end':
        return <Trophy className="w-3.5 h-3.5 text-yellow-400 shrink-0" />;
      default:
        return <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex flex-col h-44 sm:h-52 shadow-xl backdrop-blur-md">
      <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-800 text-xs font-bold text-slate-300 uppercase tracking-wider">
        <ScrollText className="w-4 h-4 text-amber-400" />
        Cronaca della Battaglia
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
        {logs.length === 0 ? (
          <div className="text-slate-500 italic text-center py-4">
            In attesa che la battaglia abbia inizio...
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-2 text-slate-300 leading-snug py-0.5 border-b border-slate-800/40 last:border-0"
            >
              <div className="mt-0.5">{getLogIcon(log.type)}</div>
              <div className="flex-1">
                <span className="text-slate-400 text-[10px] mr-1.5 opacity-60">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span>{log.text}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
