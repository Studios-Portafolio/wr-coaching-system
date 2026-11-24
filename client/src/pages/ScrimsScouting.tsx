import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Plus,
  Trash2,
  ShieldAlert,
  Trophy,
  X,
  Search,
  Users,
  Clock,
  Flame,
  Swords,
  ChevronDown,
  ChevronUp,
  Download,
  Target,
  Award,
} from 'lucide-react';
import {
  WR_CHAMPIONS,
  getChampionIconUrl,
  type LaneType,
} from '../data/champions';

type SideType = 'blue' | 'red';
type ResultType = 'win' | 'loss';
type PlaystyleType =
  | 'Early Aggro'
  | 'Objective / Macro'
  | 'Teamfight / Scaling'
  | 'Splitpush / Pick';
type MapTendency = 'Play for Bot' | 'Play for Top' | 'Mid-JG Skirmish' | 'Invade Lv1-2';

interface ScrimMatch {
  id: string;
  date: string;
  opponent: string;
  side: SideType;
  result: ResultType;
  durationMins: number;
  patch: string;
  kills: number;
  deaths: number;
  goldDiff8m: number; // ej: +1800 o -900
  firstBlood: boolean;
  firstDragon: boolean;
  firstHerald: boolean;
  barons: number;
  ourComp: [string, string, string, string, string]; // TOP, JG, MID, ADC, SUP
  enemyComp: [string, string, string, string, string];
  mvp: string;
  focusGoal: string;
  notes: string;
}

interface ScoutingProfile {
  id: string;
  teamName: string;
  regionOrTier: string;
  threatLevel: 'S' | 'A' | 'B';
  playstyle: PlaystyleType;
  tendency: MapTendency;
  priorityPicks: string[]; // IDs de campeones
  priorityBans: string[]; // IDs de campeones
  weakness: string;
  notes: string;
}

const STORAGE_SCRIMS_KEY = 'wr_hub_scrims_pro_v2';
const STORAGE_SCOUTING_KEY = 'wr_hub_scouting_pro_v2';
const ROLES: LaneType[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

const INITIAL_SCRIMS: ScrimMatch[] = [
  {
    id: 'scr-1',
    date: '2026-11-22',
    opponent: 'Apex Academy',
    side: 'blue',
    result: 'win',
    durationMins: 16,
    patch: '6.0',
    kills: 19,
    deaths: 8,
    goldDiff8m: 2100,
    firstBlood: true,
    firstDragon: true,
    firstHerald: true,
    barons: 1,
    ourComp: ['Aatrox', 'LeeSin', 'Orianna', 'Kaisa', 'Nautilus'],
    enemyComp: ['Renekton', 'Vi', 'Ahri', 'Lucian', 'Lulu'],
    mvp: 'JG (Lee Sin)',
    focusGoal: 'Setup de 1er Dragón y rotación de Mid',
    notes: 'Excelente control de visión 45s antes del primer dragón. Castigamos bien su falta de frontlane.',
  },
  {
    id: 'scr-2',
    date: '2026-11-22',
    opponent: 'Apex Academy',
    side: 'red',
    result: 'loss',
    durationMins: 21,
    patch: '6.0',
    kills: 11,
    deaths: 17,
    goldDiff8m: -1400,
    firstBlood: false,
    firstDragon: false,
    firstHerald: true,
    barons: 0,
    ourComp: ['Camille', 'JarvanIV', 'Syndra', 'Ezreal', 'Karma'],
    enemyComp: ['Ornn', 'Viego', 'Galio', 'Jinx', 'Thresh'],
    mvp: 'TOP (Camille)',
    focusGoal: 'Ejecución de 1-3-1 en mid game',
    notes: 'Forzamos pelea en río sin prioridad de mid. Faltó respetar el reset de Viego.',
  },
  {
    id: 'scr-3',
    date: '2026-11-21',
    opponent: 'Valkyrie Esports',
    side: 'red',
    result: 'win',
    durationMins: 18,
    patch: '6.0',
    kills: 22,
    deaths: 10,
    goldDiff8m: 1650,
    firstBlood: true,
    firstDragon: true,
    firstHerald: false,
    barons: 2,
    ourComp: ['Gwen', 'XinZhao', 'Ahri', 'Xayah', 'Rakan'],
    enemyComp: ['Sett', 'Maokai', 'Viktor', 'Varus', 'Braum'],
    mvp: 'BOT (Xayah / Rakan)',
    focusGoal: 'Peel y contra-engage en objetivos',
    notes: 'Rakan neutralizó todos los engages de Maokai. Cierre limpio con doble Barón.',
  },
];

const INITIAL_SCOUTING: ScoutingProfile[] = [
  {
    id: 'sct-1',
    teamName: 'Apex Academy',
    regionOrTier: 'Sovereign / Tier 2',
    threatLevel: 'A',
    playstyle: 'Early Aggro',
    tendency: 'Invade Lv1-2',
    priorityPicks: ['LeeSin', 'Renekton', 'Lucian', 'Vi'],
    priorityBans: ['Lulu', 'Orianna', 'Nautilus'],
    weakness: 'Si no sacan +1.5k de oro antes del min 8, pierden orden en teamfights.',
    notes: 'Su jungla suele hacer pathing de Red hacia Botlane para dive al nivel 3.',
  },
  {
    id: 'sct-2',
    teamName: 'Valkyrie Esports',
    regionOrTier: 'Sovereign / Tier 1',
    threatLevel: 'S',
    playstyle: 'Objective / Macro',
    tendency: 'Play for Bot',
    priorityPicks: ['Jinx', 'Thresh', 'JarvanIV', 'Viktor'],
    priorityBans: ['Camille', 'Ahri', 'Xayah'],
    weakness: 'Rotaciones lentas hacia Barón cuando su ADC está limpiando oleada en bot.',
    notes: 'Juegan muy disciplinados alrededor del alma de dragón. Priorizar quitarles Thresh.',
  },
];

const PLAYSTYLE_BADGE: Record<PlaystyleType, string> = {
  'Early Aggro': 'bg-red-500/15 text-red-300 border-red-500/30',
  'Objective / Macro': 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  'Teamfight / Scaling': 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  'Splitpush / Pick': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

const THREAT_BADGE: Record<'S' | 'A' | 'B', string> = {
  S: 'bg-red-500/20 text-red-300 border-red-500/40',
  A: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  B: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
};

const getChampName = (id: string) =>
  WR_CHAMPIONS.find((c) => c.id === id)?.name || id;

export default function ScrimsScouting() {
  const [activeTab, setActiveTab] = useState<'scrims' | 'analytics' | 'scouting'>('scrims');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Scrims
  const [scrims, setScrims] = useState<ScrimMatch[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SCRIMS_KEY);
      return saved ? JSON.parse(saved) : INITIAL_SCRIMS;
    } catch {
      return INITIAL_SCRIMS;
    }
  });

  const [opponentFilter, setOpponentFilter] = useState('');
  const [sideFilter, setSideFilter] = useState<'all' | SideType>('all');
  const [resultFilter, setResultFilter] = useState<'all' | ResultType>('all');
  const [showScrimModal, setShowScrimModal] = useState(false);

  // Formulario de Scrim avanzado
  const [fOpponent, setFOpponent] = useState('');
  const [fSide, setFSide] = useState<SideType>('blue');
  const [fResult, setFResult] = useState<ResultType>('win');
  const [fDuration, setFDuration] = useState('17');
  const [fPatch, setFPatch] = useState('6.0');
  const [fKills, setFKills] = useState('15');
  const [fDeaths, setFDeaths] = useState('10');
  const [fGoldDiff, setFGoldDiff] = useState('1200');
  const [fFirstBlood, setFFirstBlood] = useState(true);
  const [fFirstDragon, setFFirstDragon] = useState(true);
  const [fFirstHerald, setFFirstHerald] = useState(false);
  const [fBarons, setFBarons] = useState('1');
  const [fOurComp, setFOurComp] = useState<[string, string, string, string, string]>([
    'Aatrox',
    'LeeSin',
    'Ahri',
    'Kaisa',
    'Thresh',
  ]);
  const [fEnemyComp, setFEnemyComp] = useState<[string, string, string, string, string]>([
    'Renekton',
    'Vi',
    'Orianna',
    'Ezreal',
    'Nautilus',
  ]);
  const [fMvp, setFMvp] = useState('');
  const [fFocusGoal, setFFocusGoal] = useState('');
  const [fNotes, setFNotes] = useState('');

  // Scouting
  const [profiles, setProfiles] = useState<ScoutingProfile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SCOUTING_KEY);
      return saved ? JSON.parse(saved) : INITIAL_SCOUTING;
    } catch {
      return INITIAL_SCOUTING;
    }
  });

  const [scoutSearch, setScoutSearch] = useState('');
  const [showScoutModal, setShowScoutModal] = useState(false);

  // Formulario de Scouting
  const [sTeam, setSTeam] = useState('');
  const [sTier, setSTier] = useState('Sovereign / Tier 2');
  const [sThreat, setSThreat] = useState<'S' | 'A' | 'B'>('A');
  const [sStyle, setSStyle] = useState<PlaystyleType>('Early Aggro');
  const [sTendency, setSTendency] = useState<MapTendency>('Play for Bot');
  const [sPicks, setSPicks] = useState<string[]>(['LeeSin', 'Kaisa']);
  const [sBans, setSBans] = useState<string[]>(['Lulu', 'Thresh']);
  const [sWeakness, setSWeakness] = useState('');
  const [sNotes, setSNotes] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SCRIMS_KEY, JSON.stringify(scrims));
    } catch {}
  }, [scrims]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SCOUTING_KEY, JSON.stringify(profiles));
    } catch {}
  }, [profiles]);

  // Analítica calculada en tiempo real
  const stats = useMemo(() => {
    const total = scrims.length;
    const wins = scrims.filter((s) => s.result === 'win').length;
    const winrate = total ? Math.round((wins / total) * 100) : 0;

    const blue = scrims.filter((s) => s.side === 'blue');
    const blueWr = blue.length
      ? Math.round((blue.filter((s) => s.result === 'win').length / blue.length) * 100)
      : 0;

    const red = scrims.filter((s) => s.side === 'red');
    const redWr = red.length
      ? Math.round((red.filter((s) => s.result === 'win').length / red.length) * 100)
      : 0;

    const fbRate = total
      ? Math.round((scrims.filter((s) => s.firstBlood).length / total) * 100)
      : 0;
    const fdRate = total
      ? Math.round((scrims.filter((s) => s.firstDragon).length / total) * 100)
      : 0;
    const fhRate = total
      ? Math.round((scrims.filter((s) => s.firstHerald).length / total) * 100)
      : 0;

    const avgDur = total
      ? (scrims.reduce((a, s) => a + s.durationMins, 0) / total).toFixed(1)
      : '0.0';
    const avgGold8 = total
      ? Math.round(scrims.reduce((a, s) => a + s.goldDiff8m, 0) / total)
      : 0;

    // Estadísticas por campeón de nuestro equipo
    const champMap = new Map<string, { games: number; wins: number }>();
    scrims.forEach((m) => {
      m.ourComp.forEach((cId) => {
        if (!cId) return;
        const curr = champMap.get(cId) || { games: 0, wins: 0 };
        curr.games += 1;
        if (m.result === 'win') curr.wins += 1;
        champMap.set(cId, curr);
      });
    });

    const topChamps = Array.from(champMap.entries())
      .map(([id, data]) => ({
        id,
        name: getChampName(id),
        games: data.games,
        wins: data.wins,
        wr: Math.round((data.wins / data.games) * 100),
      }))
      .sort((a, b) => b.games - a.games || b.wr - a.wr)
      .slice(0, 8);

    // Historial H2H por rival
    const oppMap = new Map<string, { games: number; wins: number }>();
    scrims.forEach((m) => {
      const key = m.opponent.trim();
      const curr = oppMap.get(key) || { games: 0, wins: 0 };
      curr.games += 1;
      if (m.result === 'win') curr.wins += 1;
      oppMap.set(key, curr);
    });

    const h2h = Array.from(oppMap.entries())
      .map(([opponent, data]) => ({
        opponent,
        games: data.games,
        wins: data.wins,
        losses: data.games - data.wins,
        wr: Math.round((data.wins / data.games) * 100),
      }))
      .sort((a, b) => b.games - a.games);

    return {
      total,
      wins,
      winrate,
      blueCount: blue.length,
      blueWr,
      redCount: red.length,
      redWr,
      fbRate,
      fdRate,
      fhRate,
      avgDur,
      avgGold8,
      topChamps,
      h2h,
    };
  }, [scrims]);

  const handleAddScrim = (e: React.FormEvent) => {
    e.preventDefault();
    const opp = fOpponent.trim();
    if (!opp) return;

    const item: ScrimMatch = {
      id: `scr-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      opponent: opp,
      side: fSide,
      result: fResult,
      durationMins: Math.max(1, Number(fDuration) || 17),
      patch: fPatch.trim() || '6.0',
      kills: Math.max(0, Number(fKills) || 0),
      deaths: Math.max(0, Number(fDeaths) || 0),
      goldDiff8m: Number(fGoldDiff) || 0,
      firstBlood: fFirstBlood,
      firstDragon: fFirstDragon,
      firstHerald: fFirstHerald,
      barons: Math.max(0, Number(fBarons) || 0),
      ourComp: [...fOurComp] as [string, string, string, string, string],
      enemyComp: [...fEnemyComp] as [string, string, string, string, string],
      mvp: fMvp.trim() || 'Equipo',
      focusGoal: fFocusGoal.trim() || 'Ejecución general',
      notes: fNotes.trim() || 'Sin observaciones adicionales.',
    };

    setScrims((prev) => [item, ...prev]);
    setFOpponent('');
    setFMvp('');
    setFFocusGoal('');
    setFNotes('');
    setShowScrimModal(false);
  };

  const handleAddScout = (e: React.FormEvent) => {
    e.preventDefault();
    const team = sTeam.trim();
    if (!team) return;

    const item: ScoutingProfile = {
      id: `sct-${Date.now()}`,
      teamName: team,
      regionOrTier: sTier.trim() || 'Competitivo',
      threatLevel: sThreat,
      playstyle: sStyle,
      tendency: sTendency,
      priorityPicks: sPicks,
      priorityBans: sBans,
      weakness: sWeakness.trim() || 'Por analizar.',
      notes: sNotes.trim(),
    };

    setProfiles((prev) => [item, ...prev]);
    setSTeam('');
    setSWeakness('');
    setSNotes('');
    setShowScoutModal(false);
  };

  const exportJson = () => {
    const blob = new Blob(
      [JSON.stringify({ scrims, scouting: profiles }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wr-scrims-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredScrims = scrims.filter((s) => {
    if (opponentFilter && !s.opponent.toLowerCase().includes(opponentFilter.toLowerCase())) {
      return false;
    }
    if (sideFilter !== 'all' && s.side !== sideFilter) return false;
    if (resultFilter !== 'all' && s.result !== resultFilter) return false;
    return true;
  });

  const filteredProfiles = profiles.filter(
    (p) =>
      p.teamName.toLowerCase().includes(scoutSearch.toLowerCase()) ||
      p.playstyle.toLowerCase().includes(scoutSearch.toLowerCase()) ||
      p.priorityPicks.some((id) =>
        getChampName(id).toLowerCase().includes(scoutSearch.toLowerCase())
      )
  );

  return (
    <div translate="no" className="notranslate flex h-full flex-col gap-3 overflow-hidden">
      {/* Header + Pestañas */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/20 text-violet-400 ring-1 ring-violet-500/30">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Scrims, Macro Analytics & Scouting
            </h2>
            <p className="text-[11px] text-zinc-400">
              Drafts por mapa, control de objetivos, oro al min 8 y perfiles rivales
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
            <button
              onClick={() => setActiveTab('scrims')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'scrims'
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Swords className="h-3.5 w-3.5" />
              <span>Scrims ({scrims.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'analytics'
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Analítica</span>
            </button>

            <button
              onClick={() => setActiveTab('scouting')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'scouting'
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Scouting ({profiles.length})</span>
            </button>
          </div>

          <button
            onClick={exportJson}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
            title="Descargar respaldo JSON de scrims y scouting"
          >
            <Download className="h-3.5 w-3.5 text-violet-400" />
          </button>

          {activeTab === 'scouting' ? (
            <button
              onClick={() => setShowScoutModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Nuevo Rival</span>
            </button>
          ) : (
            <button
              onClick={() => setShowScrimModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Registrar Scrim</span>
            </button>
          )}
        </div>
      </div>

      {/* KPIs Compactos */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-3.5 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Winrate Total
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-bold text-zinc-100">{stats.winrate}%</span>
            <span className="text-[11px] text-zinc-500">
              {stats.wins}W - {stats.total - stats.wins}L
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-blue-500/20 bg-zinc-900/50 px-3.5 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
            Lado Azul / Rojo
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-bold text-blue-300">{stats.blueWr}%</span>
            <span className="text-sm font-bold text-red-300">{stats.redWr}%</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-3.5 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
            1er Dragón / Heraldo
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-bold text-zinc-100">{stats.fdRate}%</span>
            <span className="text-xs text-zinc-400">Heraldo: {stats.fhRate}%</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-3.5 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Oro Prom. @8m
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span
              className={`text-lg font-bold ${
                stats.avgGold8 >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {stats.avgGold8 >= 0 ? `+${stats.avgGold8}` : stats.avgGold8}
            </span>
            <span className="text-[11px] text-zinc-500">FB: {stats.fbRate}%</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-3.5 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Duración Media
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-bold text-zinc-100">{stats.avgDur}m</span>
            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
              <Clock className="h-3 w-3" /> {stats.total} mapas
            </span>
          </div>
        </div>
      </div>

      {/* PESTAÑA 1: HISTORIAL DE SCRIMS CON DRAFTS Y OBJETIVOS */}
      {activeTab === 'scrims' && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={opponentFilter}
                onChange={(e) => setOpponentFilter(e.target.value)}
                placeholder="Buscar rival..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-1.5 pl-8 pr-7 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500"
              />
              {opponentFilter && (
                <button
                  onClick={() => setOpponentFilter('')}
                  className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex gap-1">
              {(['all', 'blue', 'red'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSideFilter(s)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    sideFilter === s
                      ? 'bg-violet-600 text-white'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {s === 'all' ? 'Ambos Lados' : s === 'blue' ? 'Azul' : 'Rojo'}
                </button>
              ))}
            </div>

            <div className="flex gap-1">
              {(['all', 'win', 'loss'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setResultFilter(r)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    resultFilter === r
                      ? 'bg-zinc-100 text-zinc-950'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {r === 'all' ? 'Todos' : r === 'win' ? 'Victorias' : 'Derrotas'}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Mapas */}
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
            {filteredScrims.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-xs text-zinc-500">
                No hay scrims que coincidan con los filtros.
              </div>
            ) : (
              filteredScrims.map((m) => {
                const isOpen = expandedId === m.id;
                return (
                  <div
                    key={m.id}
                    className="overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-900/60 transition hover:border-zinc-700"
                  >
                    {/* Fila Resumen */}
                    <div
                      onClick={() => setExpandedId(isOpen ? null : m.id)}
                      className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-16 rounded-lg border py-1 text-center text-[11px] font-bold uppercase ${
                            m.result === 'win'
                              ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                              : 'border-red-500/30 bg-red-500/15 text-red-300'
                          }`}
                        >
                          {m.result === 'win' ? 'WIN' : 'LOSS'}
                        </span>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-zinc-100">
                              vs {m.opponent}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                m.side === 'blue'
                                  ? 'bg-blue-500/15 text-blue-300'
                                  : 'bg-red-500/15 text-red-300'
                              }`}
                            >
                              {m.side === 'blue' ? 'Azul' : 'Rojo'}
                            </span>
                            <span className="font-mono text-xs text-zinc-300">
                              {m.kills} - {m.deaths}
                            </span>
                            <span className="font-mono text-[11px] text-zinc-500">
                              {m.durationMins}m
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-zinc-400">
                            Objetivo: <span className="text-zinc-200">{m.focusGoal}</span>
                          </p>
                        </div>
                      </div>

                      {/* Retratos de nuestra comp vs rival */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          {m.ourComp.map((cId, i) => (
                            <img
                              key={`o-${i}`}
                              src={getChampionIconUrl(cId)}
                              alt={cId}
                              title={`${ROLES[i]}: ${getChampName(cId)}`}
                              className="h-7 w-7 rounded-md border border-blue-500/40 object-cover"
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-bold text-zinc-600">VS</span>
                        <div className="flex items-center gap-1">
                          {m.enemyComp.map((cId, i) => (
                            <img
                              key={`e-${i}`}
                              src={getChampionIconUrl(cId)}
                              alt={cId}
                              title={`${ROLES[i]}: ${getChampName(cId)}`}
                              className="h-7 w-7 rounded-md border border-red-500/40 object-cover opacity-85"
                            />
                          ))}
                        </div>
                      </div>

                      {/* Badges de macro + expandir */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 font-mono text-[11px] font-semibold ${
                            m.goldDiff8m >= 0
                              ? 'bg-emerald-500/10 text-emerald-300'
                              : 'bg-red-500/10 text-red-300'
                          }`}
                        >
                          @8m: {m.goldDiff8m >= 0 ? `+${m.goldDiff8m}` : m.goldDiff8m}
                        </span>
                        <span className="font-mono text-[11px] text-zinc-500">{m.date}</span>
                        {isOpen ? (
                          <ChevronUp className="h-4 w-4 text-zinc-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-zinc-400" />
                        )}
                      </div>
                    </div>

                    {/* Detalle Expandido */}
                    {isOpen && (
                      <div className="border-t border-zinc-800/80 bg-zinc-950/60 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span
                              className={`rounded-md border px-2 py-0.5 font-semibold ${
                                m.firstBlood
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                  : 'border-zinc-800 bg-zinc-900 text-zinc-500'
                              }`}
                            >
                              1ra Sangre: {m.firstBlood ? 'Sí' : 'No'}
                            </span>
                            <span
                              className={`rounded-md border px-2 py-0.5 font-semibold ${
                                m.firstDragon
                                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                  : 'border-zinc-800 bg-zinc-900 text-zinc-500'
                              }`}
                            >
                              1er Dragón: {m.firstDragon ? 'Sí' : 'No'}
                            </span>
                            <span
                              className={`rounded-md border px-2 py-0.5 font-semibold ${
                                m.firstHerald
                                  ? 'border-violet-500/30 bg-violet-500/10 text-violet-300'
                                  : 'border-zinc-800 bg-zinc-900 text-zinc-500'
                              }`}
                            >
                              1er Heraldo: {m.firstHerald ? 'Sí' : 'No'}
                            </span>
                            <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-semibold text-zinc-300">
                              Barones: {m.barons}
                            </span>
                            <span className="flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 font-semibold text-violet-300">
                              <Award className="h-3 w-3" /> MVP: {m.mvp}
                            </span>
                          </div>

                          <button
                            onClick={() =>
                              setScrims((prev) => prev.filter((item) => item.id !== m.id))
                            }
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-900 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Eliminar</span>
                          </button>
                        </div>

                        <p className="mt-2.5 text-xs leading-relaxed text-zinc-300">
                          <span className="font-semibold text-zinc-400">Notas del Coach: </span>
                          {m.notes}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 2: ANALÍTICA AUTOMÁTICA */}
      {activeTab === 'analytics' && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto pr-1 lg:grid-cols-2">
          {/* Campeones más jugados */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Flame className="h-4 w-4 text-violet-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Campeones Más Jugados (Nuestro Equipo)
              </h3>
            </div>
            <div className="space-y-2">
              {stats.topChamps.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500">
                  Registra scrims para ver estadísticas de campeones.
                </p>
              ) : (
                stats.topChamps.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/70 px-3 py-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={getChampionIconUrl(c.id)}
                        alt={c.name}
                        className="h-8 w-8 rounded-lg border border-zinc-700 object-cover"
                      />
                      <div>
                        <p className="text-xs font-semibold text-zinc-100">{c.name}</p>
                        <p className="text-[10px] text-zinc-500">
                          {c.games} {c.games === 1 ? 'mapa' : 'mapas'} ({c.wins}W -{' '}
                          {c.games - c.wins}L)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-violet-500"
                          style={{ width: `${c.wr}%` }}
                        />
                      </div>
                      <span className="w-10 text-right font-mono text-xs font-bold text-zinc-200">
                        {c.wr}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Historial Directo (H2H) contra Rivales */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Rendimiento por Rival (H2H)
              </h3>
            </div>
            <div className="space-y-2">
              {stats.h2h.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500">
                  Aún no hay rivales registrados.
                </p>
              ) : (
                stats.h2h.map((row) => (
                  <div
                    key={row.opponent}
                    className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/70 px-3.5 py-2.5"
                  >
                    <div>
                      <p className="text-xs font-bold text-zinc-100">{row.opponent}</p>
                      <p className="text-[10px] text-zinc-500">
                        {row.games} {row.games === 1 ? 'mapa jugado' : 'mapas jugados'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-semibold text-emerald-400">
                        {row.wins}W
                      </span>
                      <span className="font-mono text-xs font-semibold text-red-400">
                        {row.losses}L
                      </span>
                      <span className="rounded-md bg-zinc-900 px-2 py-0.5 font-mono text-xs font-bold text-zinc-200">
                        {row.wr}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 3: SCOUTING DE RIVALES VISUAL */}
      {activeTab === 'scouting' && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              value={scoutSearch}
              onChange={(e) => setScoutSearch(e.target.value)}
              placeholder="Buscar equipo rival, estilo o campeón..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-1.5 pl-8 pr-7 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500"
            />
            {scoutSearch && (
              <button
                onClick={() => setScoutSearch('')}
                className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="grid min-h-0 flex-1 content-start grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredProfiles.map((prof) => {
              const h2hRecord = stats.h2h.find(
                (h) => h.opponent.toLowerCase() === prof.teamName.toLowerCase()
              );
              return (
                <div
                  key={prof.id}
                  className="group flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-violet-500/40"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-violet-400" />
                          <h3 className="text-sm font-bold text-zinc-100">
                            {prof.teamName}
                          </h3>
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${THREAT_BADGE[prof.threatLevel]}`}
                          >
                            Tier {prof.threatLevel}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-zinc-500">
                          {prof.regionOrTier}
                          {h2hRecord && (
                            <span className="ml-2 font-mono text-violet-300">
                              · H2H: {h2hRecord.wins}W-{h2hRecord.losses}L
                            </span>
                          )}
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          setProfiles((prev) => prev.filter((p) => p.id !== prof.id))
                        }
                        className="rounded p-1 text-zinc-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${PLAYSTYLE_BADGE[prof.playstyle]}`}
                      >
                        {prof.playstyle}
                      </span>
                      <span className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                        <Target className="h-3 w-3 text-violet-400" />
                        {prof.tendency}
                      </span>
                    </div>

                    {/* Picks y Bans con Retratos */}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-emerald-400">
                          Picks Prioritarios
                        </span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {prof.priorityPicks.map((id) => (
                            <img
                              key={id}
                              src={getChampionIconUrl(id)}
                              alt={id}
                              title={getChampName(id)}
                              className="h-7 w-7 rounded-md border border-emerald-500/40 object-cover"
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase text-red-400">
                          Bans Clave
                        </span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {prof.priorityBans.map((id) => (
                            <img
                              key={id}
                              src={getChampionIconUrl(id)}
                              alt={id}
                              title={getChampName(id)}
                              className="h-7 w-7 rounded-md border border-red-500/40 object-cover grayscale"
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-xs">
                      <span className="text-[10px] font-bold uppercase text-amber-400">
                        Cómo castigarlos
                      </span>
                      <p className="mt-0.5 text-zinc-300">{prof.weakness}</p>
                    </div>
                  </div>

                  {prof.notes && (
                    <p className="mt-3 border-t border-zinc-800/80 pt-2 text-[11px] italic text-zinc-400">
                      "{prof.notes}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR SCRIM AVANZADO */}
      {showScrimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleAddScrim}
            className="max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <h3 className="text-sm font-bold text-zinc-100">
                Registrar Mapa de Scrim (Completo)
              </h3>
              <button
                type="button"
                onClick={() => setShowScrimModal(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="col-span-2">
                <label className="mb-1 block text-[11px] text-zinc-400">Rival</label>
                <input
                  required
                  value={fOpponent}
                  onChange={(e) => setFOpponent(e.target.value)}
                  placeholder="Ej: Apex Academy"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">Lado</label>
                <select
                  value={fSide}
                  onChange={(e) => setFSide(e.target.value as SideType)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-violet-500"
                >
                  <option value="blue">Azul</option>
                  <option value="red">Rojo</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">Resultado</label>
                <select
                  value={fResult}
                  onChange={(e) => setFResult(e.target.value as ResultType)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-violet-500"
                >
                  <option value="win">Victoria</option>
                  <option value="loss">Derrota</option>
                </select>
              </div>
            </div>

            {/* Métricas de partida */}
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">Kills</label>
                <input
                  type="number"
                  min={0}
                  value={fKills}
                  onChange={(e) => setFKills(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">Muertes</label>
                <input
                  type="number"
                  min={0}
                  value={fDeaths}
                  onChange={(e) => setFDeaths(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">Oro @8m</label>
                <input
                  type="number"
                  step={100}
                  value={fGoldDiff}
                  onChange={(e) => setFGoldDiff(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">Duración (m)</label>
                <input
                  type="number"
                  min={1}
                  value={fDuration}
                  onChange={(e) => setFDuration(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">Barones</label>
                <input
                  type="number"
                  min={0}
                  value={fBarons}
                  onChange={(e) => setFBarons(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 outline-none"
                />
              </div>
            </div>

            {/* Checkboxes de Objetivos */}
            <div className="flex flex-wrap gap-3 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-300">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={fFirstBlood}
                  onChange={(e) => setFFirstBlood(e.target.checked)}
                  className="accent-violet-500"
                />
                Primera Sangre
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={fFirstDragon}
                  onChange={(e) => setFFirstDragon(e.target.checked)}
                  className="accent-violet-500"
                />
                Primer Dragón
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={fFirstHerald}
                  onChange={(e) => setFFirstHerald(e.target.checked)}
                  className="accent-violet-500"
                />
                Primer Heraldo
              </label>
            </div>

            {/* Selectores de Composición (Nuestro Equipo vs Rival) */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 rounded-xl border border-blue-500/20 bg-zinc-950/60 p-3">
                <p className="text-[10px] font-bold uppercase text-blue-400">
                  Nuestra Composición
                </p>
                {ROLES.map((role, idx) => (
                  <div key={`our-${role}`} className="flex items-center gap-2">
                    <span className="w-8 text-[10px] font-bold text-zinc-500">{role}</span>
                    <select
                      value={fOurComp[idx]}
                      onChange={(e) => {
                        const copy = [...fOurComp] as [string, string, string, string, string];
                        copy[idx] = e.target.value;
                        setFOurComp(copy);
                      }}
                      className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 outline-none"
                    >
                      {WR_CHAMPIONS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 rounded-xl border border-red-500/20 bg-zinc-950/60 p-3">
                <p className="text-[10px] font-bold uppercase text-red-400">
                  Composición Rival
                </p>
                {ROLES.map((role, idx) => (
                  <div key={`en-${role}`} className="flex items-center gap-2">
                    <span className="w-8 text-[10px] font-bold text-zinc-500">{role}</span>
                    <select
                      value={fEnemyComp[idx]}
                      onChange={(e) => {
                        const copy = [...fEnemyComp] as [string, string, string, string, string];
                        copy[idx] = e.target.value;
                        setFEnemyComp(copy);
                      }}
                      className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 outline-none"
                    >
                      {WR_CHAMPIONS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">
                  Objetivo del Bloque
                </label>
                <input
                  value={fFocusGoal}
                  onChange={(e) => setFFocusGoal(e.target.value)}
                  placeholder="Ej: Presión de 1er Heraldo"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">MVP del Mapa</label>
                <input
                  value={fMvp}
                  onChange={(e) => setFMvp(e.target.value)}
                  placeholder="Ej: JG (Lee Sin)"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-zinc-400">Notas del Coach</label>
              <textarea
                rows={2}
                value={fNotes}
                onChange={(e) => setFNotes(e.target.value)}
                placeholder="Errores de macro, decisiones en Barón, etc."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowScrimModal(false)}
                className="rounded-lg bg-zinc-800 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500"
              >
                Guardar Scrim
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL NUEVO PERFIL DE SCOUTING */}
      {showScoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleAddScout}
            className="w-full max-w-md space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-100">Nueva Ficha de Scouting</h3>
              <button
                type="button"
                onClick={() => setShowScoutModal(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="mb-1 block text-[11px] text-zinc-400">Equipo Rival</label>
                <input
                  required
                  value={sTeam}
                  onChange={(e) => setSTeam(e.target.value)}
                  placeholder="Ej: Infinity WR"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">Amenaza</label>
                <select
                  value={sThreat}
                  onChange={(e) => setSThreat(e.target.value as 'S' | 'A' | 'B')}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none"
                >
                  <option value="S">Tier S</option>
                  <option value="A">Tier A</option>
                  <option value="B">Tier B</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">Estilo</label>
                <select
                  value={sStyle}
                  onChange={(e) => setSStyle(e.target.value as PlaystyleType)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none"
                >
                  <option value="Early Aggro">Early Aggro</option>
                  <option value="Objective / Macro">Objective / Macro</option>
                  <option value="Teamfight / Scaling">Teamfight / Scaling</option>
                  <option value="Splitpush / Pick">Splitpush / Pick</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">Tendencia</label>
                <select
                  value={sTendency}
                  onChange={(e) => setSTendency(e.target.value as MapTendency)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none"
                >
                  <option value="Play for Bot">Play for Bot</option>
                  <option value="Play for Top">Play for Top</option>
                  <option value="Mid-JG Skirmish">Mid-JG Skirmish</option>
                  <option value="Invade Lv1-2">Invade Lv1-2</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-zinc-400">
                Debilidad / Cómo castigarlos
              </label>
              <input
                value={sWeakness}
                onChange={(e) => setSWeakness(e.target.value)}
                placeholder="Ej: Sobre-extienden sin visión antes de objetivos"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-zinc-400">Notas tácticas</label>
              <textarea
                rows={2}
                value={sNotes}
                onChange={(e) => setSNotes(e.target.value)}
                placeholder="Pathing habitual, wards favoritos..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowScoutModal(false)}
                className="rounded-lg bg-zinc-800 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500"
              >
                Guardar Rival
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}