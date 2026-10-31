import React, { useState } from 'react';
import { X, BookOpen, Shield, Sword, Heart, Crown, Users } from 'lucide-react';
import { ALL_CHARACTERS } from '../../../shared/charactersData';
import { CARD_TEMPLATES } from '../../../shared/cardsData';

interface RulesModalProps {
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'rules' | 'roles' | 'characters' | 'cards'>('rules');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-6 h-6 text-amber-400" />
          <h2 className="font-title text-2xl font-bold text-slate-100">
            Regolamento Ufficiale - Samurai Sword
          </h2>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'rules' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Regole Base
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'roles' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Fazioni & Ruoli
          </button>
          <button
            onClick={() => setActiveTab('characters')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'characters' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            I 12 Personaggi
          </button>
          <button
            onClick={() => setActiveTab('cards')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'cards' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Carte di Gioco (90)
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto pr-2 text-xs text-slate-300 space-y-4">
          {activeTab === 'rules' && (
            <div className="space-y-4">
              <section className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <h3 className="font-bold text-amber-400 text-sm mb-2 flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-red-500" />
                  Nessuna Eliminazione dei Giocatori
                </h3>
                <p className="leading-relaxed">
                  In Samurai Sword non vieni mai eliminato! Quando esaurisci i tuoi punti Resistenza (PV), cedi <strong>1 Punto Onore (🪷)</strong> al giocatore che ti ha inflitto il colpo di grazia, mantieni tutte le tue carte in mano e le Proprietà davanti a te, e diventi <strong>Inoffensivo</strong> fino al tuo prossimo turno. All’inizio del tuo turno, recuperi tutta la Resistenza al massimo e peschi normalmente!
                </p>
              </section>

              <section className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <h3 className="font-bold text-amber-400 text-sm mb-2 flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-400" />
                  Le 4 Fasi del Turno
                </h3>
                <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                  <li><strong>Recupero:</strong> Se eri a 0 PV, ripristini la Resistenza al massimo. Se hai il Bushido, ne risolvi l'effetto.</li>
                  <li><strong>Pesca:</strong> Peschi 2 carte dal mazzo (Hideyoshi ne pesca 3; Ieyasu può prendere la prima dagli scarti).</li>
                  <li><strong>Gioco:</strong> Puoi giocare 1 carta Arma (o di più con Concentrazione / Goemon), attivare carte Azione ed equipaggiare Proprietà.</li>
                  <li><strong>Scarto:</strong> Alla fine del turno, puoi tenere in mano un numero massimo di carte 7 carte (indipendentemente dai PV attuali). Solo le carte oltre la settima vanno scartate.</li>
                </ol>
              </section>

              <section className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <h3 className="font-bold text-amber-400 text-sm mb-2 flex items-center gap-1.5">
                  <Sword className="w-4 h-4 text-red-400" />
                  Distanza e Difficoltà
                </h3>
                <p className="leading-relaxed">
                  La <strong>Distanza</strong> base è il numero di passi più breve attorno al tavolo (in senso orario o antiorario). I giocatori <em>Inoffensivi</em> (senza carte in mano) vengono saltati nel calcolo dei passi!
                  <br />
                  La <strong>Difficoltà</strong> per colpire un bersaglio è data da: Distanza + Armature del bersaglio (+1 se il bersaglio è Benkei). Un'arma può colpire solo se la sua Gittata è pari o superiore alla Difficoltà calcolata.
                </p>
              </section>
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-950/30 border border-amber-600/70 rounded-xl">
                <h4 className="font-bold text-sm text-amber-300">Shōgun (Palese fin da subito)</h4>
                <p className="mt-1">È il capo supremo. Parte sempre per primo e inizia con 1 Punto Onore in più. La sua fazione (Shogun + Samurai) vince se totalizza più punti Onore a fine partita.</p>
              </div>

              <div className="p-3 bg-yellow-950/30 border border-yellow-600/70 rounded-xl">
                <h4 className="font-bold text-sm text-yellow-300">Samurai (Segreto)</h4>
                <p className="mt-1">Alleato fedele dello Shogun. Gioca per proteggerlo e accumulare onore per la corte imperiale. Vince assieme allo Shogun.</p>
              </div>

              <div className="p-3 bg-blue-950/30 border border-blue-600/70 rounded-xl">
                <h4 className="font-bold text-sm text-blue-300">Ninja (Segreto)</h4>
                <p className="mt-1">Guerrieri dell'ombra. Cooperano segretamente per abbattere lo Shogun e i suoi alleati. A fine partita sommano i loro punti onore!</p>
              </div>

              <div className="p-3 bg-red-950/30 border border-red-600/70 rounded-xl">
                <h4 className="font-bold text-sm text-red-300">Ronin (Segreto)</h4>
                <p className="mt-1">Guerriero solitario senza padrone. Gioca da solo contro tutti! A fine partita i suoi punti Onore vengono moltiplicati per 2 (in 4-5 giocatori) o per 3 (in 6-7 giocatori).</p>
              </div>
            </div>
          )}

          {activeTab === 'characters' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ALL_CHARACTERS.map(c => (
                <div key={c.id} className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                      <span>{c.avatar}</span>
                      {c.name}
                    </span>
                    <span className="text-red-400 font-bold">{c.maxHp} PV</span>
                  </div>
                  <span className="text-[10px] text-amber-400 font-semibold block mb-1">{c.title}</span>
                  <p className="text-slate-300 leading-snug">{c.abilityDescription}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'cards' && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-red-400 border-b border-slate-800 pb-1">Armi (32 carte)</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CARD_TEMPLATES.filter(c => c.type === 'weapon').map(w => (
                  <div key={w.templateId} className="p-2 bg-slate-950/60 border border-red-900/60 rounded-lg">
                    <div className="font-bold text-red-300">{w.name} ({w.count}x)</div>
                    <div className="text-[10px] text-slate-400">Diff {w.difficulty} • Danno {w.damage}</div>
                  </div>
                ))}
              </div>

              <h4 className="font-bold text-sm text-blue-400 border-b border-slate-800 pb-1 pt-2">Proprietà (15 carte)</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CARD_TEMPLATES.filter(c => c.type === 'property').map(p => (
                  <div key={p.templateId} className="p-2 bg-slate-950/60 border border-blue-900/60 rounded-lg">
                    <div className="font-bold text-blue-300">{p.name} ({p.count}x)</div>
                    <div className="text-[10px] text-slate-400">{p.description}</div>
                  </div>
                ))}
              </div>

              <h4 className="font-bold text-sm text-amber-400 border-b border-slate-800 pb-1 pt-2">Azioni (43 carte)</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CARD_TEMPLATES.filter(c => c.type === 'action').map(a => (
                  <div key={a.templateId} className="p-2 bg-slate-950/60 border border-amber-900/60 rounded-lg">
                    <div className="font-bold text-amber-300">{a.name} ({a.count}x)</div>
                    <div className="text-[10px] text-slate-400">{a.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
