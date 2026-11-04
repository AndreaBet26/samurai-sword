import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { GameState } from '../../../shared/types';
import { RefreshCw } from 'lucide-react';

interface GameOverModalProps {
  gameState: GameState;
  onPlayAgain: () => void;
  /** Solo l'host può avviare la rivincita */
  isHost?: boolean;
  onRematch?: () => void;
}

// 7 righe centrate perfettamente con le guide della tabella dello sfondo 4K
const ROW_Y = [1153, 1248, 1343, 1438, 1532, 1627, 1728];

export const GameOverModal: React.FC<GameOverModalProps> = ({
  gameState,
  onPlayAgain,
  isHost = false,
  onRematch
}) => {
  const scores = gameState.finalScores;

  // Calcolo del fattore di scala per adattare la risoluzione 4K (3840 x 2160) a qualsiasi monitor
  const [scale, setScale] = useState(() =>
    Math.min(window.innerWidth / 3840, window.innerHeight / 2160)
  );

  useEffect(() => {
    const updateScale = () => {
      setScale(Math.min(window.innerWidth / 3840, window.innerHeight / 2160));
    };
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  useEffect(() => {
    // Coriandoli festivi di fine partita
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 }
      });
    } catch {
      // ignore
    }
  }, []);

  const teamTitles: Record<string, { title: string; color: string }> = {
    shogun: {
      title: 'VITTORIA DEGLI SHŌGUN & SAMURAI!',
      color: '#FFD700'
    },
    ninja: {
      title: 'VITTORIA DELLA SQUADRA NINJA!',
      color: '#4EA5FF'
    },
    ronin: {
      title: 'VITTORIA DEL RONIN!',
      color: '#E23A3A'
    },
    draw: {
      title: 'PAREGGIO STRAORDINARIO!',
      color: '#E2E8F0'
    }
  };

  const winningInfo = teamTitles[gameState.winnerTeam || 'draw'] || teamTitles.draw;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black flex items-center justify-center select-none animate-fadeIn">
      {/* Tabellone 4K a coordinate assolute scalato per adattarsi perfettamente a qualunque schermo */}
      <div
        className="relative shadow-2xl overflow-hidden shrink-0"
        style={{
          width: 3840,
          height: 2160,
          backgroundImage:
            'url(/assets/ui/Gemini_Generated_Image_ckld2ackld2ackld.webp), url(/assets/ui/Gemini_Generated_Image_ckld2ackld2ackld.png)',
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          fontFamily: "'Montserrat', 'Noto Sans', sans-serif"
        }}
      >
        {/* ===================== 1. SEZIONE IN ALTO (TITOLI) ===================== */}
        {/* TITOLO DELLA PARTITA (Centro-alto) */}
        <div
          className="absolute text-center whitespace-nowrap uppercase tracking-widest font-black"
          style={{
            left: 1920,
            top: 410,
            transform: 'translate(-50%, -50%)',
            fontFamily: "'Cinzel', serif",
            fontSize: 80,
            color: '#FFD700',
            textShadow: '0 4px 24px rgba(0,0,0,0.9), 0 0 35px rgba(255,215,0,0.35)'
          }}
        >
          PARTITA CONCLUSA!
        </div>

        {/* Testo Sottotitolo (Vittoria fazione) */}
        <div
          className="absolute text-center whitespace-nowrap uppercase font-bold flex items-center justify-center gap-4"
          style={{
            left: 1920,
            top: 510,
            transform: 'translate(-50%, -50%)',
            fontFamily: "'Cinzel', serif",
            fontSize: 48,
            color: winningInfo.color,
            textShadow: '0 3px 18px rgba(0,0,0,0.95)'
          }}
        >
          <img
            src="/assets/icons/sword_white.webp"
            alt=""
            style={{ width: 44, height: 44, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.8))' }}
          />
          <span>{winningInfo.title}</span>
          <img
            src="/assets/icons/sword_white.webp"
            alt=""
            style={{
              width: 44,
              height: 44,
              objectFit: 'contain',
              transform: 'scaleX(-1)',
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.8))'
            }}
          />
        </div>

        {/* Testo descrittivo (Causa fine partita) */}
        <div
          className="absolute text-center whitespace-nowrap font-medium"
          style={{
            left: 1920,
            top: 580,
            transform: 'translate(-50%, -50%)',
            fontSize: 26,
            color: 'rgba(225, 235, 248, 0.9)',
            textShadow: '0 2px 10px rgba(0,0,0,0.9)'
          }}
        >
          {scores?.summary || (gameState.winnerReason ? `Causa: ${gameState.winnerReason}` : 'La partita è giunta al termine.')}
        </div>

        {/* ===================== 2. BOX FAZIONI (SEZIONE CENTRALE SUPERIORE) ===================== */}
        {scores && (
          <>
            {/* BOX SINISTRO (Shōgun & Samurai) */}
            <div
              className="absolute text-center"
              style={{
                left: 1152,
                top: 740,
                transform: 'translate(-50%, -50%)',
                fontFamily: "'Cinzel', serif",
                fontSize: 22,
                fontWeight: 700,
                color: '#FFB800',
                letterSpacing: '0.08em',
                textShadow: '0 2px 8px rgba(0,0,0,0.8)'
              }}
            >
              SHŌGUN & SAMURAI
            </div>
            <div
              className="absolute text-center font-black"
              style={{
                left: 1152,
                top: 825,
                transform: 'translate(-50%, -50%)',
                fontSize: 64,
                color: '#FFB800',
                textShadow: '0 4px 16px rgba(0,0,0,0.9), 0 0 25px rgba(255,184,0,0.3)'
              }}
            >
              {scores.shogunSamurai}
            </div>
            <div
              className="absolute text-center font-medium"
              style={{
                left: 1152,
                top: 875,
                transform: 'translate(-50%, -50%)',
                fontSize: 16,
                color: scores.deadlyStrikeTeam === 'shogun' ? '#F87171' : 'rgba(255, 184, 0, 0.85)',
                textShadow: '0 1px 6px rgba(0,0,0,0.8)'
              }}
            >
              {scores.deadlyStrikeTeam === 'shogun' ? 'Colpo Mortale −3' : 'Punti Totali'}
            </div>

            {/* BOX CENTRALE (Squadra Ninja) */}
            <div
              className="absolute text-center"
              style={{
                left: 1920,
                top: 740,
                transform: 'translate(-50%, -50%)',
                fontFamily: "'Cinzel', serif",
                fontSize: 22,
                fontWeight: 700,
                color: '#4EA5FF',
                letterSpacing: '0.08em',
                textShadow: '0 2px 8px rgba(0,0,0,0.8)'
              }}
            >
              SQUADRA NINJA
            </div>
            <div
              className="absolute text-center font-black"
              style={{
                left: 1920,
                top: 825,
                transform: 'translate(-50%, -50%)',
                fontSize: 64,
                color: '#4EA5FF',
                textShadow: '0 4px 16px rgba(0,0,0,0.9), 0 0 25px rgba(78,165,255,0.3)'
              }}
            >
              {scores.ninja}
            </div>
            <div
              className="absolute text-center font-medium"
              style={{
                left: 1920,
                top: 875,
                transform: 'translate(-50%, -50%)',
                fontSize: 16,
                color: scores.deadlyStrikeTeam === 'ninja' ? '#F87171' : 'rgba(78, 165, 255, 0.85)',
                textShadow: '0 1px 6px rgba(0,0,0,0.8)'
              }}
            >
              {scores.deadlyStrikeTeam === 'ninja' ? 'Colpo Mortale −3' : 'Punti Totali'}
            </div>

            {/* BOX DESTRO (Ronin) */}
            <div
              className="absolute text-center"
              style={{
                left: 2688,
                top: 740,
                transform: 'translate(-50%, -50%)',
                fontFamily: "'Cinzel', serif",
                fontSize: 22,
                fontWeight: 700,
                color: '#FF4E4E',
                letterSpacing: '0.08em',
                textShadow: '0 2px 8px rgba(0,0,0,0.8)'
              }}
            >
              RONIN
            </div>
            <div
              className="absolute text-center font-black"
              style={{
                left: 2688,
                top: 825,
                transform: 'translate(-50%, -50%)',
                fontSize: 64,
                color: '#FF4E4E',
                textShadow: '0 4px 16px rgba(0,0,0,0.9), 0 0 25px rgba(255,78,78,0.3)'
              }}
            >
              {scores.ronin}
            </div>
            <div
              className="absolute text-center font-medium"
              style={{
                left: 2688,
                top: 875,
                transform: 'translate(-50%, -50%)',
                fontSize: 16,
                color: 'rgba(255, 78, 78, 0.85)',
                textShadow: '0 1px 6px rgba(0,0,0,0.8)'
              }}
            >
              Punti Totali
            </div>
          </>
        )}

        {/* ===================== 3. TABELLA DEI GIOCATORI (CENTRO-BASSO) ===================== */}
        {scores &&
          scores.playerScores.map((p, idx) => {
            const rowY = ROW_Y[idx] ?? (1153 + idx * 95);

            // Stile distintivo badge ruolo con sfumature
            let badgeBg = 'linear-gradient(135deg, #374151, #1F2937)';
            let badgeBorder = 'rgba(156, 163, 175, 0.5)';
            let badgeTextColor = '#FFFFFF';

            if (p.role.id === 'shogun') {
              badgeBg = 'linear-gradient(135deg, #D97706, #F59E0B)';
              badgeBorder = '#FCD34D';
              badgeTextColor = '#1A120B';
            } else if (p.role.id === 'samurai') {
              badgeBg = 'linear-gradient(135deg, #92400E, #B45309)';
              badgeBorder = '#FBBF24';
              badgeTextColor = '#FEF3C7';
            } else if (p.role.id === 'ninja') {
              badgeBg = 'linear-gradient(135deg, #1E40AF, #2563EB)';
              badgeBorder = '#60A5FA';
              badgeTextColor = '#FFFFFF';
            } else if (p.role.id === 'ronin') {
              badgeBg = 'linear-gradient(135deg, #991B1B, #DC2626)';
              badgeBorder = '#F87171';
              badgeTextColor = '#FFFFFF';
            }

            return (
              <React.Fragment key={p.playerId}>
                {/* GIOCATORE (allineato a sinistra) */}
                <div
                  className="absolute font-bold text-slate-100 whitespace-nowrap truncate max-w-[500px]"
                  style={{
                    left: 850,
                    top: rowY,
                    transform: 'translateY(-50%)',
                    fontSize: 26,
                    textShadow: '0 2px 6px rgba(0,0,0,0.8)'
                  }}
                  title={p.name}
                >
                  {p.name}
                </div>

                {/* RUOLO SEGRETO (allineato centrato con badge) */}
                <div
                  className="absolute flex items-center justify-center"
                  style={{
                    left: 1430,
                    top: rowY,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <span
                    className="px-5 py-1.5 rounded-full font-bold whitespace-nowrap shadow-md"
                    style={{
                      background: badgeBg,
                      border: `1.5px solid ${badgeBorder}`,
                      color: badgeTextColor,
                      fontSize: 20,
                      letterSpacing: '0.04em'
                    }}
                  >
                    {p.role.name}
                    {p.role.stars ? ` ${'★'.repeat(p.role.stars)}` : ''}
                  </span>
                </div>

                {/* ONORE (allineato centrato) */}
                <div
                  className="absolute font-bold flex items-center justify-center gap-2"
                  style={{
                    left: 1845,
                    top: rowY,
                    transform: 'translate(-50%, -50%)',
                    fontSize: 26,
                    color: '#E9D5FF',
                    textShadow: '0 2px 8px rgba(0,0,0,0.8)'
                  }}
                >
                  <span>{p.honorPoints}</span>
                  <img
                    src="/assets/ui/honor_token.webp"
                    alt="Onore"
                    style={{ width: 28, height: 28, objectFit: 'contain', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.7))' }}
                  />
                </div>

                {/* DAIMYO (allineato centrato) */}
                <div
                  className="absolute font-semibold text-center"
                  style={{
                    left: 2170,
                    top: rowY,
                    transform: 'translate(-50%, -50%)',
                    fontSize: 26,
                    color: '#FCD34D',
                    textShadow: '0 2px 8px rgba(0,0,0,0.8)'
                  }}
                >
                  +{p.daimyoBonus}
                </div>

                {/* MOLTIPLICATORE (allineato centrato) */}
                <div
                  className="absolute font-medium text-center"
                  style={{
                    left: 2620,
                    top: rowY,
                    transform: 'translate(-50%, -50%)',
                    fontSize: 26,
                    color: '#CBD5E1',
                    textShadow: '0 2px 8px rgba(0,0,0,0.8)'
                  }}
                >
                  x{p.multiplier}
                </div>

                {/* PUNTI (allineato a destra/centrato sull'ultima colonna) */}
                <div
                  className="absolute font-black text-center"
                  style={{
                    left: 2930,
                    top: rowY,
                    transform: 'translate(-50%, -50%)',
                    fontSize: 32,
                    color: '#FFD700',
                    textShadow: '0 2px 12px rgba(0,0,0,0.9), 0 0 15px rgba(255,215,0,0.35)'
                  }}
                >
                  {p.totalScore}
                </div>
              </React.Fragment>
            );
          })}

        {/* ===================== 4. INTERAZIONI E PULSANTI (SEZIONE BASSO) ===================== */}
        {/* PULSANTE RIVINCITA (Arancione) */}
        {isHost ? (
          <button
            onClick={onRematch}
            className="absolute rounded-3xl flex items-center justify-center gap-3 font-bold transition-all duration-200 cursor-pointer hover:brightness-110 hover:scale-102 active:scale-98"
            style={{
              left: 1920,
              top: 1900,
              transform: 'translate(-50%, -50%)',
              width: 550,
              height: 130,
              fontSize: 32,
              color: '#2C1E0A',
              backgroundColor: 'transparent', // Lascia risplendere la grafica arancione dello sfondo
              letterSpacing: '0.06em'
            }}
            title="Avvia una nuova partita con gli stessi giocatori"
          >
            <RefreshCw style={{ width: 34, height: 34, strokeWidth: 3 }} />
            <span>RIVINCITA</span>
          </button>
        ) : (
          <div
            className="absolute flex items-center justify-center gap-3 font-bold opacity-80"
            style={{
              left: 1920,
              top: 1900,
              transform: 'translate(-50%, -50%)',
              width: 550,
              height: 130,
              fontSize: 28,
              color: '#2C1E0A',
              letterSpacing: '0.05em'
            }}
            title="Solo l'host può avviare la rivincita"
          >
            <RefreshCw style={{ width: 30, height: 30, strokeWidth: 2.5 }} className="animate-spin" />
            <span>IN ATTESA DELL'HOST...</span>
          </div>
        )}

        {/* TESTO "Esci dalla stanza" */}
        <button
          onClick={onPlayAgain}
          className="absolute font-semibold underline underline-offset-8 transition-colors cursor-pointer hover:text-white"
          style={{
            left: 1920,
            top: 2005,
            transform: 'translate(-50%, -50%)',
            fontSize: 24,
            color: '#A0B0C0',
            letterSpacing: '0.02em',
            textShadow: '0 2px 8px rgba(0,0,0,0.85)'
          }}
        >
          Esci dalla stanza
        </button>
      </div>
    </div>
  );
};
