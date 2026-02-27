import React, { useMemo } from 'react';
import './Podium.css';

export interface PodiumPlayer {
  id: string | number;
  name: string;
  points: number;
}

interface RankedPlayer extends PodiumPlayer {
  rank: 1 | 2 | 3;
  medal: string;
}

interface PodiumProps {
  players: PodiumPlayer[];
  title?: string;
  ariaLabel?: string;
  className?: string;
}

const MEDALS: Record<1 | 2 | 3, string> = {
  1: '\u{1F947}',
  2: '\u{1F948}',
  3: '\u{1F949}',
};

const VISUAL_ORDER: Array<1 | 2 | 3> = [2, 1, 3];
const CONFETTI_PIECES = Array.from({ length: 12 }, (_, index) => index);

const formatPoints = (points: number): string => `${points} ${points === 1 ? 'pt' : 'pts'}`;

const Podium: React.FC<PodiumProps> = ({ players, title = 'Podio', ariaLabel = 'Clasificacion de podio', className = '' }) => {
  const rankedPlayers = useMemo<RankedPlayer[]>(() => {
    return [...players]
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 3)
      .map((player, index) => {
        const rank = (index + 1) as 1 | 2 | 3;
        return {
          ...player,
          rank,
          medal: MEDALS[rank],
        };
      });
  }, [players]);

  const visualPlayers = useMemo(() => {
    const byRank = new Map(rankedPlayers.map((player) => [player.rank, player]));
    return VISUAL_ORDER.map((rank) => byRank.get(rank)).filter((player): player is RankedPlayer => Boolean(player));
  }, [rankedPlayers]);

  if (visualPlayers.length === 0) {
    return (
      <section className={`podium ${className}`.trim()} aria-label={ariaLabel}>
        <h2 className="podium__title">{title}</h2>
        <p className="podium__empty">Sin jugadores para mostrar.</p>
      </section>
    );
  }

  return (
    <section className={`podium ${className}`.trim()} aria-label={ariaLabel}>
      <h2 className="podium__title">{title}</h2>

      <ol className="podium__list">
        {visualPlayers.map((player, index) => (
          <li
            key={`${player.id}-${player.rank}`}
            className={`podium__item podium__item--rank-${player.rank}`}
            style={{ '--podium-delay': `${index * 110}ms` } as React.CSSProperties}
          >
            <article
              className="podium__card"
              aria-label={`Puesto ${player.rank}. ${player.name}. ${formatPoints(player.points)}.`}
            >
              {player.rank === 1 && (
                <div className="podium__confetti" aria-hidden="true">
                  {CONFETTI_PIECES.map((pieceIndex) => (
                    <span
                      key={pieceIndex}
                      className={`podium__confetti-piece podium__confetti-piece--${(pieceIndex % 4) + 1}`}
                    />
                  ))}
                </div>
              )}
              <p className="podium__medal" aria-hidden="true">
                {player.medal}
              </p>
              <p className="podium__name">{player.name}</p>
              <p className="podium__points">
                <span className="podium__points-value">{player.points}</span> {player.points === 1 ? 'pt' : 'pts'}
              </p>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
};

export const PodiumExample: React.FC = () => {
  const mockPlayers: PodiumPlayer[] = [
    { id: 'mertxe-fitsik', name: 'MERTXE FITSIK', points: 5 },
    { id: 'javier-bolu', name: 'JAVIER BOLU', points: 2 },
    { id: 'justina-ohoin', name: 'JUSTINA OHOIN', points: 1 },
  ];

  return <Podium players={mockPlayers} title="Clasificacion" ariaLabel={`Podio de ejemplo: ${mockPlayers.map((player) => `${player.name} ${formatPoints(player.points)}`).join(', ')}`} />;
};

export default Podium;
