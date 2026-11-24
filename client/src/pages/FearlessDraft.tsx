import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  RotateCcw,
  Undo2,
  Play,
  Pause,
  ChevronRight,
  Lock,
  Shield,
  Swords,
  X,
  ArrowLeftRight,
  Star,
  Copy,
  Check,
  BarChart2,
  Flame,
  RefreshCw,
} from 'lucide-react';
import { socket } from '../lib/socket';
import {
  WR_CHAMPIONS,
  getChampionIconUrl,
  type Champion,
  type LaneType,
} from '../data/champions';

type TeamSide = 'blue' | 'red';
type ActionType = 'ban' | 'pick';

interface DraftStep {
  team: TeamSide;
  type: ActionType;
  slotIndex: number;
  label: string;
}

interface CompletedGame {
  gameNumber: number;
  bluePicks: string[];
  redPicks: string[];
}

interface DraftState {
  seriesFormat: 'Bo3' | 'Bo5';
  currentGame: number;
  blueTeamName: string;
  redTeamName: string;
  blueBans: Array<string | null>;
  redBans: Array<string | null>;
  bluePicks: Array<string | null>;
  redPicks: Array<string | null>;
  stepIndex: number;
  history: CompletedGame[];
}

interface RosterPoolEntry {
  championId: string;
  tier: 'S-Tier' | 'Comfort' | 'Situacional' | 'Práctica';
}

interface RosterPlayer {
  id: string;
  ign: string;
  role: LaneType;
  pool: RosterPoolEntry[];
}

interface MetaTierEntry {
  tier: 'S+' | 'S' | 'A' | 'B';
  winRate?: number;
  pickRate?: number;
  banRate?: number;
}

const ROOM_ID = 'room:draft:main';
const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
const STORAGE_ROSTER_KEY = 'wr_hub_roster_v1';
const TURN_SECONDS = 30;
const LANE_TABS: Array<'ALL' | LaneType> = ['ALL', 'TOP', 'JG', 'MID', 'ADC', 'SUP'];
const ROLE_LABELS = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

const DEFAULT_STARTER_POOL: Array<{ id: string; tier: string; owner: string }> = [
  { id: 'Aatrox', tier: 'S-Tier', owner: 'TOP' },
  { id: 'Camille', tier: 'S-Tier', owner: 'TOP' },
  { id: 'Ornn', tier: 'Comfort', owner: 'TOP' },
  { id: 'Gwen', tier: 'Comfort', owner: 'TOP' },
  { id: 'LeeSin', tier: 'S-Tier', owner: 'JG' },
  { id: 'Vi', tier: 'S-Tier', owner: 'JG' },
  { id: 'JarvanIV', tier: 'Comfort', owner: 'JG' },
  { id: 'Viego', tier: 'Comfort', owner: 'JG' },
  { id: 'Orianna', tier: 'S-Tier', owner: 'MID' },
  { id: 'Ahri', tier: 'S-Tier', owner: 'MID' },
  { id: 'Syndra', tier: 'Comfort', owner: 'MID' },
  { id: 'Kaisa', tier: 'S-Tier', owner: 'ADC' },
  { id: 'Ezreal', tier: 'S-Tier', owner: 'ADC' },
  { id: 'Xayah', tier: 'Comfort', owner: 'ADC' },
  { id: 'Thresh', tier: 'S-Tier', owner: 'SUP' },
  { id: 'Nautilus', tier: 'S-Tier', owner: 'SUP' },
  { id: 'Lulu', tier: 'Comfort', owner: 'SUP' },
  { id: 'Rakan', tier: 'Comfort', owner: 'SUP' },
];

const TIER_BADGE_STYLE: Record<'S+' | 'S' | 'A' | 'B', string> = {
  'S+': 'bg-amber-400 text-zinc-950',
  S: 'bg-sky-400 text-zinc-950',
  A: 'bg-emerald-500/90 text-zinc-950',
  B: 'bg-zinc-700 text-zinc-200',
};

const TIER_WEIGHT: Record<'S+' | 'S' | 'A' | 'B', number> = {
  'S+': 4,
  S: 3,
  A: 2,
  B: 1,
};

const AP_CHAMPS = new Set([
  'Ahri', 'Akali', 'AurelionSol', 'Brand', 'Diana', 'Ekko', 'Evelynn', 'Fiddlesticks',
  'Fizz', 'Galio', 'Gragas', 'Gwen', 'Karma', 'Katarina', 'Kennen', 'Lillia', 'Lissandra',
  'Lulu', 'Lux', 'Malphite', 'Maokai', 'Mordekaiser', 'Morgana', 'Nami', 'Orianna',
  'Rumble', 'Seraphine', 'Singed', 'Sona', 'Soraka', 'Swain', 'Syndra', 'Teemo',
  'TwistedFate', 'Veigar', 'Vex', 'Viktor', 'Vladimir', 'Yuumi', 'Ziggs', 'Zoe', 'Zyra',
]);

const FRONTLINE_CHAMPS = new Set([
  'Aatrox', 'Alistar', 'Amumu', 'Blitzcrank', 'Braum', 'Camille', 'Darius', 'DrMundo',
  'Galio', 'Garen', 'Gragas', 'Hecarim', 'JarvanIV', 'Jax', 'KSante', 'Leona', 'Malphite',
  'Maokai', 'Mordekaiser', 'Nautilus', 'Nunu', 'Olaf', 'Ornn', 'Pantheon', 'Poppy',
  'Rakan', 'Rammus', 'Renekton', 'Riven', 'Sett', 'Shen', 'Shyvana', 'Singed', 'Sion',
  'Swain', 'Thresh', 'Urgot', 'Vi', 'Volibear', 'Warwick', 'Wukong', 'XinZhao',
]);

const ENGAGE_CHAMPS = new Set([
  'Alistar', 'Amumu', 'Annie', 'Blitzcrank', 'Camille', 'Diana', 'Fiddlesticks', 'Galio',
  'Gragas', 'Hecarim', 'JarvanIV', 'Kennen', 'LeeSin', 'Leona', 'Lissandra', 'Malphite',
  'Maokai', 'Nautilus', 'Ornn', 'Pantheon', 'Pyke', 'Rakan', 'Rammus', 'Sett', 'Sion',
  'Thresh', 'Vi', 'Volibear', 'Wukong', 'XinZhao', 'Yone',
]);

const DRAFT_SEQUENCE: DraftStep[] = [
  { team: 'blue', type: 'ban', slotIndex: 0, label: 'Ban Azul 1' },
  { team: 'red', type: 'ban', slotIndex: 0, label: 'Ban Rojo 1' },
  { team: 'blue', type: 'ban', slotIndex: 1, label: 'Ban Azul 2' },
  { team: 'red', type: 'ban', slotIndex: 1, label: 'Ban Rojo 2' },
  { team: 'blue', type: 'ban', slotIndex: 2, label: 'Ban Azul 3' },
  { team: 'red', type: 'ban', slotIndex: 2, label: 'Ban Rojo 3' },
  { team: 'blue', type: 'pick', slotIndex: 0, label: 'Pick Azul 1' },
  { team: 'red', type: 'pick', slotIndex: 0, label: 'Pick Rojo 1' },
  { team: 'red', type: 'pick', slotIndex: 1, label: 'Pick Rojo 2' },
  { team: 'blue', type: 'pick', slotIndex: 1, label: 'Pick Azul 2' },
  { team: 'blue', type: 'pick', slotIndex: 2, label: 'Pick Azul 3' },
  { team: 'red', type: 'pick', slotIndex: 2, label: 'Pick Rojo 3' },
  { team: 'red', type: 'ban', slotIndex: 3, label: 'Ban Rojo 4' },
  { team: 'blue', type: 'ban', slotIndex: 3, label: 'Ban Azul 4' },
  { team: 'red', type: 'ban', slotIndex: 4, label: 'Ban Rojo 5' },
  { team: 'blue', type: 'ban', slotIndex: 4, label: 'Ban Azul 5' },
  { team: 'red', type: 'pick', slotIndex: 3, label: 'Pick Rojo 4' },
  { team: 'blue', type: 'pick', slotIndex: 3, label: 'Pick Azul 4' },
  { team: 'blue', type: 'pick', slotIndex: 4, label: 'Pick Azul 5' },
  { team: 'red', type: 'pick', slotIndex: 4, label: 'Pick Rojo 5' },
];

const createInitialDraftState = (): DraftState => ({
  seriesFormat: 'Bo5',
  currentGame: 1,
  blueTeamName: 'NUESTRO EQUIPO',
  redTeamName: 'RIVAL',
  blueBans: [null, null, null, null, null],
  redBans: [null, null, null, null, null],
  bluePicks: [null, null, null, null, null],
  redPicks: [null, null, null, null, null],
  stepIndex: 0,
  history: [],
});

const normalizeText = (str: string) =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

const getChampById = (id: string | null): Champion | undefined =>
  id ? WR_CHAMPIONS.find((c) => c.id === id) : undefined;

const analyzeComp = (picks: Array<string | null>) => {
  const valid = picks.filter(Boolean) as string[];
  let ap = 0;
  let ad = 0;
  let frontline = 0;
  let engage = 0;

  valid.forEach((id) => {
    if (AP_CHAMPS.has(id)) ap += 1;
    else ad += 1;
    if (FRONTLINE_CHAMPS.has(id)) frontline += 1;
    if (ENGAGE_CHAMPS.has(id)) engage += 1;
  });

  return { count: valid.length, ap, ad, frontline, engage };
};

export default function FearlessDraft() {
  const [draft, setDraft] = useState<DraftState>(createInitialDraftState);
  const [hoveredChampId, setHoveredChampId] = useState<string | null>(null);
  const [laneFilter, setLaneFilter] = useState<'ALL' | LaneType>('ALL');
  const [onlyMyPool, setOnlyMyPool] = useState(false);
  const [onlyAsianMeta, setOnlyAsianMeta] = useState(false);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [timerRunning, setTimerRunning] = useState(false);

  // Meta Asiático automático desde el backend
  const [asianTiers, setAsianTiers] = useState<Record<string, MetaTierEntry>>({});
  const [metaSource, setMetaSource] = useState('Cargando meta...');
  const [loadingMeta, setLoadingMeta] = useState(false);

  const fetchAsianMeta = async (force = false) => {
    setLoadingMeta(true);
    try {
      const res = await fetch(
        `${API_URL}/api/meta/asian-tiers${force ? '?refresh=true' : ''}`
      );
      const data = await res.json();
      if (data?.tiers) setAsianTiers(data.tiers);
      if (data?.source) setMetaSource(data.source);
    } catch {
      setMetaSource('Meta local');
    } finally {
      setLoadingMeta(false);
    }
  };

  useEffect(() => {
    fetchAsianMeta();
  }, []);

  // Pool del equipo (si aún no ha visitado Plantilla, carga el pool base)
  const teamPoolMap = useMemo(() => {
    const map = new Map<string, { tier: string; owner: string }>();
    try {
      const raw = localStorage.getItem(STORAGE_ROSTER_KEY);
      if (raw) {
        const players: RosterPlayer[] = JSON.parse(raw);
        players.forEach((p) => {
          p.pool.forEach((entry) => {
            const prev = map.get(entry.championId);
            if (!prev || entry.tier === 'S-Tier') {
              map.set(entry.championId, {
                tier: entry.tier,
                owner: `${p.ign} (${p.role})`,
              });
            }
          });
        });
      }
    } catch {}

    if (map.size === 0) {
      DEFAULT_STARTER_POOL.forEach((item) => {
        map.set(item.id, { tier: item.tier, owner: item.owner });
      });
    }
    return map;
  }, []);

  const currentStep = DRAFT_SEQUENCE[draft.stepIndex] || null;
  const isDraftComplete = draft.stepIndex >= DRAFT_SEQUENCE.length;
  const maxGames = draft.seriesFormat === 'Bo3' ? 3 : 5;

  const fearlessLockedIds = new Set<string>(
    draft.history.flatMap((g) => [...g.bluePicks, ...g.redPicks])
  );

  const usedInCurrentGame = new Set<string>(
    [
      ...draft.blueBans,
      ...draft.redBans,
      ...draft.bluePicks,
      ...draft.redPicks,
    ].filter(Boolean) as string[]
  );

  const blueStats = useMemo(() => analyzeComp(draft.bluePicks), [draft.bluePicks]);
  const redStats = useMemo(() => analyzeComp(draft.redPicks), [draft.redPicks]);

  useEffect(() => {
    socket.emit('room:join', ROOM_ID);

    socket.on('draft:sync', (incoming: DraftState) => {
      setDraft(incoming);
      setHoveredChampId(null);
      setTimeLeft(TURN_SECONDS);
    });

    return () => {
      socket.off('draft:sync');
    };
  }, []);

  useEffect(() => {
    if (!timerRunning || isDraftComplete) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, isDraftComplete]);

  const updateAndSync = (next: DraftState) => {
    setDraft(next);
    socket.emit('draft:update', { roomId: ROOM_ID, state: next });
  };

  const lockChampion = (champId?: string) => {
    const targetId = champId || hoveredChampId;
    if (!targetId || !currentStep || isDraftComplete) return;
    if (usedInCurrentGame.has(targetId) || fearlessLockedIds.has(targetId)) return;

    const next: DraftState = {
      ...draft,
      blueBans: [...draft.blueBans],
      redBans: [...draft.redBans],
      bluePicks: [...draft.bluePicks],
      redPicks: [...draft.redPicks],
      stepIndex: draft.stepIndex + 1,
    };

    if (currentStep.team === 'blue' && currentStep.type === 'ban') {
      next.blueBans[currentStep.slotIndex] = targetId;
    } else if (currentStep.team === 'red' && currentStep.type === 'ban') {
      next.redBans[currentStep.slotIndex] = targetId;
    } else if (currentStep.team === 'blue' && currentStep.type === 'pick') {
      next.bluePicks[currentStep.slotIndex] = targetId;
    } else if (currentStep.team === 'red' && currentStep.type === 'pick') {
      next.redPicks[currentStep.slotIndex] = targetId;
    }

    setHoveredChampId(null);
    setTimeLeft(TURN_SECONDS);
    updateAndSync(next);
  };

  const undoLastStep = () => {
    if (draft.stepIndex === 0) return;
    const prevIdx = draft.stepIndex - 1;
    const prevStep = DRAFT_SEQUENCE[prevIdx];

    const next: DraftState = {
      ...draft,
      blueBans: [...draft.blueBans],
      redBans: [...draft.redBans],
      bluePicks: [...draft.bluePicks],
      redPicks: [...draft.redPicks],
      stepIndex: prevIdx,
    };

    if (prevStep.team === 'blue' && prevStep.type === 'ban') {
      next.blueBans[prevStep.slotIndex] = null;
    } else if (prevStep.team === 'red' && prevStep.type === 'ban') {
      next.redBans[prevStep.slotIndex] = null;
    } else if (prevStep.team === 'blue' && prevStep.type === 'pick') {
      next.bluePicks[prevStep.slotIndex] = null;
    } else if (prevStep.team === 'red' && prevStep.type === 'pick') {
      next.redPicks[prevStep.slotIndex] = null;
    }

    setHoveredChampId(null);
    setTimeLeft(TURN_SECONDS);
    updateAndSync(next);
  };

  const advanceToNextGame = () => {
    if (draft.currentGame >= maxGames) return;
    const finishedGame: CompletedGame = {
      gameNumber: draft.currentGame,
      bluePicks: draft.bluePicks.filter(Boolean) as string[],
      redPicks: draft.redPicks.filter(Boolean) as string[],
    };

    const next: DraftState = {
      ...draft,
      currentGame: draft.currentGame + 1,
      blueBans: [null, null, null, null, null],
      redBans: [null, null, null, null, null],
      bluePicks: [null, null, null, null, null],
      redPicks: [null, null, null, null, null],
      stepIndex: 0,
      history: [...draft.history, finishedGame],
    };

    setHoveredChampId(null);
    setTimeLeft(TURN_SECONDS);
    setTimerRunning(false);
    updateAndSync(next);
  };

  const swapSides = () => {
    updateAndSync({
      ...draft,
      blueTeamName: draft.redTeamName,
      redTeamName: draft.blueTeamName,
    });
  };

  const resetCurrentGame = () => {
    setHoveredChampId(null);
    setTimeLeft(TURN_SECONDS);
    setTimerRunning(false);
    updateAndSync({
      ...draft,
      blueBans: [null, null, null, null, null],
      redBans: [null, null, null, null, null],
      bluePicks: [null, null, null, null, null],
      redPicks: [null, null, null, null, null],
      stepIndex: 0,
    });
  };

  const resetSeries = () => {
    setHoveredChampId(null);
    setTimeLeft(TURN_SECONDS);
    setTimerRunning(false);
    updateAndSync(createInitialDraftState());
  };

  const copySummaryToDiscord = async () => {
    const names = (arr: Array<string | null>) =>
      arr.map((id) => getChampById(id)?.name || '—').join(', ');

    const lines = [
      `⚔️ **DRAFT FEARLESS (${draft.seriesFormat}) — MAPA ${draft.currentGame}**`,
      `🔵 **${draft.blueTeamName}**`,
      `• Bans: ${names(draft.blueBans)}`,
      `• Picks: ${names(draft.bluePicks)}`,
      `🔴 **${draft.redTeamName}**`,
      `• Bans: ${names(draft.redBans)}`,
      `• Picks: ${names(draft.redPicks)}`,
    ];

    if (draft.history.length > 0) {
      lines.push('', '🔒 **Bloqueados por Fearless (Mapas anteriores):**');
      draft.history.forEach((g) => {
        lines.push(
          `• Mapa ${g.gameNumber}: ${[...g.bluePicks, ...g.redPicks]
            .map((id) => getChampById(id)?.name || id)
            .join(', ')}`
        );
      });
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const getMetaForChamp = (champ: Champion): MetaTierEntry | undefined =>
    asianTiers[normalizeText(champ.id)] || asianTiers[normalizeText(champ.name)];

  const normalizedQuery = normalizeText(search);
  const filteredChampions = WR_CHAMPIONS.filter((c) => {
    if (onlyMyPool && !teamPoolMap.has(c.id)) return false;
    if (onlyAsianMeta) {
      const m = getMetaForChamp(c);
      if (!m || (m.tier !== 'S+' && m.tier !== 'S')) return false;
    }
    if (normalizedQuery.length > 0) {
      return (
        normalizeText(c.name).includes(normalizedQuery) ||
        normalizeText(c.id).includes(normalizedQuery) ||
        c.lanes.some((l) => l.toLowerCase().includes(normalizedQuery))
      );
    }
    if (laneFilter === 'ALL') return true;
    return c.lanes.includes(laneFilter);
  }).sort((a, b) => {
    const aMeta = getMetaForChamp(a);
    const bMeta = getMetaForChamp(b);
    const aWeight = aMeta ? TIER_WEIGHT[aMeta.tier] : 0;
    const bWeight = bMeta ? TIER_WEIGHT[bMeta.tier] : 0;
    if (bWeight !== aWeight) return bWeight - aWeight;
    return a.name.localeCompare(b.name);
  });

  return (
    <div translate="no" className="notranslate flex h-full flex-col gap-3 overflow-hidden">
      {/* Barra Superior */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Swords className="h-4 w-4 text-violet-400" />
            <h2 className="text-sm font-bold text-zinc-100">Draft Fearless Pro</h2>
          </div>

          <div className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
            {(['Bo3', 'Bo5'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => updateAndSync({ ...draft, seriesFormat: fmt })}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  draft.seriesFormat === fmt
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>

          <span className="rounded-lg bg-zinc-800 px-2.5 py-1 font-mono text-xs font-bold text-zinc-200">
            Mapa {draft.currentGame} / {maxGames}
          </span>

          <button
            onClick={() => fetchAsianMeta(true)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:border-zinc-700"
            title="Actualizar Tiers del Meta Asiático desde API oficial"
          >
            <RefreshCw className={`h-3 w-3 text-violet-400 ${loadingMeta ? 'animate-spin' : ''}`} />
            <span>{metaSource}</span>
          </button>

          {fearlessLockedIds.size > 0 && (
            <span className="flex items-center gap-1 rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300">
              <Lock className="h-3 w-3" />
              {fearlessLockedIds.size} bloqueados
            </span>
          )}
        </div>

        {/* Estado del Turno + Acciones */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`flex items-center gap-2 rounded-xl border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
              isDraftComplete
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                : currentStep?.team === 'blue'
                ? 'border-blue-500/40 bg-blue-500/15 text-blue-300'
                : 'border-red-500/40 bg-red-500/15 text-red-300'
            }`}
          >
            <span>{isDraftComplete ? 'Draft Finalizado' : currentStep?.label}</span>
            {!isDraftComplete && (
              <span className="ml-1 rounded bg-zinc-950/80 px-1.5 py-0.5 font-mono text-zinc-100">
                {timeLeft}s
              </span>
            )}
          </div>

          <button
            onClick={() => setTimerRunning(!timerRunning)}
            disabled={isDraftComplete}
            className="rounded-lg bg-zinc-800 p-1.5 text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
            title={timerRunning ? 'Pausar temporizador' : 'Iniciar temporizador'}
          >
            {timerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={copySummaryToDiscord}
            className="flex items-center gap-1 rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
            title="Copiar resumen del draft para Discord"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-violet-400" />
            )}
            <span>{copied ? 'Copiado' : 'Discord'}</span>
          </button>

          <button
            onClick={swapSides}
            className="rounded-lg bg-zinc-800 p-1.5 text-zinc-300 hover:bg-zinc-700"
            title="Intercambiar lados (Azul / Rojo)"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={undoLastStep}
            disabled={draft.stepIndex === 0}
            className="rounded-lg bg-zinc-800 p-1.5 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40"
            title="Deshacer último pick/ban"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={resetCurrentGame}
            className="rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
          >
            Reiniciar Mapa
          </button>

          <button
            onClick={resetSeries}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
            title="Reiniciar toda la serie"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Zona Principal */}
      <div className="grid min-h-0 flex-1 grid-cols-[248px_1fr_248px] gap-3 overflow-hidden">
        {/* COLUMNA IZQUIERDA: LADO AZUL */}
        <div className="flex flex-col gap-2.5 rounded-2xl border border-blue-500/20 bg-zinc-900/60 p-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <input
              value={draft.blueTeamName}
              onChange={(e) => updateAndSync({ ...draft, blueTeamName: e.target.value })}
              className="w-full bg-transparent text-xs font-extrabold uppercase tracking-wider text-blue-400 outline-none"
            />
            <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-bold text-blue-300">
              BLUE
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {draft.blueBans.map((champId, idx) => {
              const champ = getChampById(champId);
              const isActive =
                currentStep?.team === 'blue' &&
                currentStep.type === 'ban' &&
                currentStep.slotIndex === idx;
              return (
                <div
                  key={`bb-${idx}`}
                  className={`relative aspect-square overflow-hidden rounded-lg border bg-zinc-950 ${
                    isActive
                      ? 'border-blue-400 ring-2 ring-blue-500/40'
                      : 'border-zinc-800'
                  }`}
                >
                  {champ ? (
                    <>
                      <img
                        src={getChampionIconUrl(champ.id)}
                        alt={champ.name}
                        className="h-full w-full object-cover opacity-50 grayscale"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <X className="h-4 w-4 text-red-500" />
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center text-[9px] font-bold text-zinc-600">
                      B{idx + 1}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-1 flex-col gap-2">
            {draft.bluePicks.map((champId, idx) => {
              const champ = getChampById(champId);
              const isActive =
                currentStep?.team === 'blue' &&
                currentStep.type === 'pick' &&
                currentStep.slotIndex === idx;
              return (
                <div
                  key={`bp-${idx}`}
                  className={`flex flex-1 items-center gap-2.5 rounded-xl border px-2.5 transition ${
                    isActive
                      ? 'border-blue-400 bg-blue-600/15 ring-1 ring-blue-500/40'
                      : 'border-zinc-800/80 bg-zinc-950/70'
                  }`}
                >
                  {champ ? (
                    <img
                      src={getChampionIconUrl(champ.id)}
                      alt={champ.name}
                      className="h-10 w-10 rounded-lg border border-blue-500/50 object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-[10px] font-bold text-zinc-600">
                      {ROLE_LABELS[idx]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-zinc-100">
                      {champ ? champ.name : isActive ? 'Eligiendo...' : `Pick ${idx + 1}`}
                    </p>
                    <p className="text-[10px] text-zinc-500">{ROLE_LABELS[idx]}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-2 text-[10px]">
            <div className="mb-1 flex items-center justify-between font-bold text-zinc-400">
              <span className="flex items-center gap-1">
                <BarChart2 className="h-3 w-3 text-blue-400" /> Balance
              </span>
              <span className="font-mono text-zinc-300">
                AD {blueStats.ad} · AP {blueStats.ap}
              </span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Frontline: <strong className="text-zinc-200">{blueStats.frontline}</strong></span>
              <span>Engage: <strong className="text-zinc-200">{blueStats.engage}</strong></span>
            </div>
          </div>
        </div>

        {/* COLUMNA CENTRAL: SELECTOR CON TIERS ASIÁTICAS */}
        <div className="flex min-h-0 flex-col gap-2.5 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar campeón..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-1.5 pl-8 pr-7 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => setOnlyAsianMeta(!onlyAsianMeta)}
              className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition ${
                onlyAsianMeta
                  ? 'border-amber-400/70 bg-amber-500/20 text-amber-300'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Mostrar solo prioridades S+ y S del Meta Asiático"
            >
              <Flame className="h-3 w-3" />
              <span>Meta S+/S</span>
            </button>

            <button
              onClick={() => setOnlyMyPool(!onlyMyPool)}
              className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition ${
                onlyMyPool
                  ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-300'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Filtrar solo campeones de tu Plantilla & Pool"
            >
              <Star className="h-3 w-3" />
              <span>Mi Pool</span>
            </button>

            <div className="flex gap-1">
              {LANE_TABS.map((lane) => (
                <button
                  key={lane}
                  onClick={() => {
                    setLaneFilter(lane);
                    setSearch('');
                  }}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    laneFilter === lane && !search
                      ? 'bg-violet-600 text-white'
                      : 'bg-zinc-950 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {lane === 'ALL' ? 'Todos' : lane}
                </button>
              ))}
            </div>
          </div>

          <div className="grid flex-1 content-start grid-cols-5 gap-2 overflow-y-auto pr-1 sm:grid-cols-6 lg:grid-cols-7">
            {filteredChampions.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-center text-xs text-zinc-400">
                <p>No hay campeones con estos filtros.</p>
                <button
                  onClick={() => {
                    setOnlyMyPool(false);
                    setOnlyAsianMeta(false);
                    setLaneFilter('ALL');
                    setSearch('');
                  }}
                  className="mt-2 rounded-lg bg-zinc-800 px-3 py-1 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-700"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              filteredChampions.map((champ) => {
                const isFearlessLocked = fearlessLockedIds.has(champ.id);
                const isUsed = usedInCurrentGame.has(champ.id);
                const isDisabled = isFearlessLocked || isUsed || isDraftComplete;
                const isHovered = hoveredChampId === champ.id;
                const poolInfo = teamPoolMap.get(champ.id);
                const metaInfo = getMetaForChamp(champ);

                return (
                  <button
                    key={champ.id}
                    disabled={isDisabled}
                    onClick={() => setHoveredChampId(champ.id)}
                    onDoubleClick={() => lockChampion(champ.id)}
                    className={`group relative flex flex-col items-center rounded-xl border p-1.5 transition ${
                      isDisabled
                        ? 'cursor-not-allowed border-zinc-800/50 bg-zinc-950/40 opacity-35'
                        : isHovered
                        ? 'border-violet-400 bg-violet-600/20 ring-1 ring-violet-500'
                        : 'border-zinc-800/80 bg-zinc-950/70 hover:border-zinc-600 hover:bg-zinc-900'
                    }`}
                    title={
                      isFearlessLocked
                        ? `${champ.name} — Bloqueado por Fearless`
                        : `${champ.name}${
                            metaInfo
                              ? ` | Meta Asia: ${metaInfo.tier}${
                                  metaInfo.winRate ? ` (${metaInfo.winRate}% WR)` : ''
                                }${metaInfo.banRate ? ` · ${metaInfo.banRate}% Ban` : ''}`
                              : ''
                          }${poolInfo ? ` | Mi Pool: ${poolInfo.tier}` : ''}`
                    }
                  >
                    <div className="relative h-11 w-11 overflow-hidden rounded-lg">
                      <img
                        src={getChampionIconUrl(champ.id)}
                        alt={champ.name}
                        loading="lazy"
                        className={`h-full w-full object-cover ${isDisabled ? 'grayscale' : ''}`}
                      />
                      {isFearlessLocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/65">
                          <Lock className="h-4 w-4 text-amber-400" />
                        </div>
                      )}
                      {/* Badge Tier Asiático (esquina superior izquierda) */}
                      {!isDisabled && metaInfo && (
                        <span
                          className={`absolute left-0.5 top-0.5 rounded px-1 py-[1px] font-mono text-[8px] font-extrabold leading-none shadow ${
                            TIER_BADGE_STYLE[metaInfo.tier]
                          }`}
                        >
                          {metaInfo.tier}
                        </span>
                      )}
                      {/* Estrella Mi Pool (esquina superior derecha) */}
                      {!isDisabled && poolInfo && (
                        <span
                          className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-zinc-950 shadow"
                        >
                          <Star className="h-2 w-2 fill-current" />
                        </span>
                      )}
                    </div>
                    <span className="mt-1 w-full truncate text-center text-[10px] font-medium text-zinc-300">
                      {champ.name}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-zinc-800 pt-2.5">
            {isDraftComplete ? (
              <div className="flex w-full items-center justify-between">
                <span className="text-xs text-emerald-400">
                  Mapa {draft.currentGame} completado. Los 10 picks quedarán bloqueados en Fearless.
                </span>
                {draft.currentGame < maxGames && (
                  <button
                    onClick={advanceToNextGame}
                    className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-violet-500"
                  >
                    <span>Siguiente Mapa (Mapa {draft.currentGame + 1})</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <>
                <span className="text-xs text-zinc-400">
                  {hoveredChampId
                    ? `Seleccionado: ${getChampById(hoveredChampId)?.name}`
                    : 'Ordenado automáticamente por Meta Asiático (S+ → S → A)'}
                </span>
                <button
                  onClick={() => lockChampion()}
                  disabled={!hoveredChampId}
                  className={`flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    currentStep?.type === 'ban'
                      ? 'bg-red-600 hover:bg-red-500'
                      : currentStep?.team === 'blue'
                      ? 'bg-blue-600 hover:bg-blue-500'
                      : 'bg-red-600 hover:bg-red-500'
                  }`}
                >
                  <Shield className="h-3.5 w-3.5" />
                  <span>
                    {currentStep?.type === 'ban' ? 'Confirmar Ban' : 'Fijar Campeón'}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: LADO ROJO */}
        <div className="flex flex-col gap-2.5 rounded-2xl border border-red-500/20 bg-zinc-900/60 p-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-300">
              RED
            </span>
            <input
              value={draft.redTeamName}
              onChange={(e) => updateAndSync({ ...draft, redTeamName: e.target.value })}
              className="w-full bg-transparent text-right text-xs font-extrabold uppercase tracking-wider text-red-400 outline-none"
            />
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {draft.redBans.map((champId, idx) => {
              const champ = getChampById(champId);
              const isActive =
                currentStep?.team === 'red' &&
                currentStep.type === 'ban' &&
                currentStep.slotIndex === idx;
              return (
                <div
                  key={`rb-${idx}`}
                  className={`relative aspect-square overflow-hidden rounded-lg border bg-zinc-950 ${
                    isActive
                      ? 'border-red-400 ring-2 ring-red-500/40'
                      : 'border-zinc-800'
                  }`}
                >
                  {champ ? (
                    <>
                      <img
                        src={getChampionIconUrl(champ.id)}
                        alt={champ.name}
                        className="h-full w-full object-cover opacity-50 grayscale"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <X className="h-4 w-4 text-red-500" />
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center text-[9px] font-bold text-zinc-600">
                      B{idx + 1}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-1 flex-col gap-2">
            {draft.redPicks.map((champId, idx) => {
              const champ = getChampById(champId);
              const isActive =
                currentStep?.team === 'red' &&
                currentStep.type === 'pick' &&
                currentStep.slotIndex === idx;
              return (
                <div
                  key={`rp-${idx}`}
                  className={`flex flex-1 flex-row-reverse items-center gap-2.5 rounded-xl border px-2.5 transition ${
                    isActive
                      ? 'border-red-400 bg-red-600/15 ring-1 ring-red-500/40'
                      : 'border-zinc-800/80 bg-zinc-950/70'
                  }`}
                >
                  {champ ? (
                    <img
                      src={getChampionIconUrl(champ.id)}
                      alt={champ.name}
                      className="h-10 w-10 rounded-lg border border-red-500/50 object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-[10px] font-bold text-zinc-600">
                      {ROLE_LABELS[idx]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1 text-right">
                    <p className="truncate text-xs font-bold text-zinc-100">
                      {champ ? champ.name : isActive ? 'Eligiendo...' : `Pick ${idx + 1}`}
                    </p>
                    <p className="text-[10px] text-zinc-500">{ROLE_LABELS[idx]}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-2 text-[10px]">
            <div className="mb-1 flex items-center justify-between font-bold text-zinc-400">
              <span className="flex items-center gap-1">
                <BarChart2 className="h-3 w-3 text-red-400" /> Balance
              </span>
              <span className="font-mono text-zinc-300">
                AD {redStats.ad} · AP {redStats.ap}
              </span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Frontline: <strong className="text-zinc-200">{redStats.frontline}</strong></span>
              <span>Engage: <strong className="text-zinc-200">{redStats.engage}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Historial Fearless */}
      {draft.history.length > 0 && (
        <div className="flex items-center gap-3 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2">
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-amber-300">
            <Lock className="h-3.5 w-3.5" />
            Historial Fearless:
          </span>
          {draft.history.map((g) => (
            <div
              key={g.gameNumber}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/80 px-2.5 py-1"
            >
              <span className="font-mono text-[10px] font-bold text-zinc-400">
                M{g.gameNumber}
              </span>
              <div className="flex -space-x-1">
                {[...g.bluePicks, ...g.redPicks].map((id) => (
                  <img
                    key={id}
                    src={getChampionIconUrl(id)}
                    alt={id}
                    className="h-5 w-5 rounded-full border border-zinc-800 object-cover grayscale"
                    title={getChampById(id)?.name}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}