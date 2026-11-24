import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Search,
  X,
  Crown,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  Edit3,
  LayoutGrid,
  Table2,
  Copy,
  Check,
  Trophy,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  WR_CHAMPIONS,
  getChampionIconUrl,
  type LaneType,
} from '../data/champions';
import { api } from '../services/api';

type PoolTier = 'S-Tier' | 'Comfort' | 'Situacional' | 'Práctica';
type PlayerStatus = 'Titular' | 'Suplente';

interface PoolEntry {
  championId: string;
  tier: PoolTier;
}

interface Player {
  id: string;
  ign: string;
  role: LaneType;
  status: PlayerStatus;
  rank: string;
  notes: string;
  pool: PoolEntry[];
}

interface ScrimMinimal {
  result: 'win' | 'loss';
  ourComp: string[];
}

const ROLES: LaneType[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
const TIERS: PoolTier[] = ['S-Tier', 'Comfort', 'Situacional', 'Práctica'];

const TIER_STYLES: Record<PoolTier, string> = {
  'S-Tier': 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  Comfort: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  Situacional: 'border-sky-500/40 bg-sky-500/15 text-sky-300',
  Práctica: 'border-zinc-700 bg-zinc-800/80 text-zinc-300',
};

const ROLE_BADGE: Record<LaneType, string> = {
  TOP: 'bg-red-500/15 text-red-300 border-red-500/30',
  JG: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  MID: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  ADC: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  SUP: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
};

const INITIAL_ROSTER_TEMPLATE: Omit<Player, 'id'>[] = [
  {
    ign: 'TopLaner',
    role: 'TOP',
    status: 'Titular',
    rank: 'Sovereign',
    notes: 'Fuerte en weakside y peleas de flanco.',
    pool: [
      { championId: 'Aatrox', tier: 'S-Tier' },
      { championId: 'Camille', tier: 'S-Tier' },
      { championId: 'Ornn', tier: 'Comfort' },
      { championId: 'Gwen', tier: 'Comfort' },
      { championId: 'Renekton', tier: 'Situacional' },
    ],
  },
  {
    ign: 'Jungler',
    role: 'JG',
    status: 'Titular',
    rank: 'Sovereign',
    notes: 'Shotcaller de early game y objetivos.',
    pool: [
      { championId: 'LeeSin', tier: 'S-Tier' },
      { championId: 'Vi', tier: 'S-Tier' },
      { championId: 'JarvanIV', tier: 'Comfort' },
      { championId: 'Viego', tier: 'Comfort' },
      { championId: 'XinZhao', tier: 'Situacional' },
    ],
  },
  {
    ign: 'MidLaner',
    role: 'MID',
    status: 'Titular',
    rank: 'Challenger',
    notes: 'Prioridad de oleada y roaming con jungla.',
    pool: [
      { championId: 'Orianna', tier: 'S-Tier' },
      { championId: 'Ahri', tier: 'S-Tier' },
      { championId: 'Syndra', tier: 'Comfort' },
      { championId: 'Akali', tier: 'Situacional' },
      { championId: 'Galio', tier: 'Práctica' },
    ],
  },
  {
    ign: 'ADCarry',
    role: 'ADC',
    status: 'Titular',
    rank: 'Sovereign',
    notes: 'Buen posicionamiento en teamfights tardías.',
    pool: [
      { championId: 'Kaisa', tier: 'S-Tier' },
      { championId: 'Ezreal', tier: 'S-Tier' },
      { championId: 'Xayah', tier: 'Comfort' },
      { championId: 'Jinx', tier: 'Comfort' },
      { championId: 'Varus', tier: 'Situacional' },
    ],
  },
  {
    ign: 'Support',
    role: 'SUP',
    status: 'Titular',
    rank: 'Challenger',
    notes: 'Control de visión y engage principal.',
    pool: [
      { championId: 'Thresh', tier: 'S-Tier' },
      { championId: 'Nautilus', tier: 'S-Tier' },
      { championId: 'Rakan', tier: 'Comfort' },
      { championId: 'Lulu', tier: 'Comfort' },
      { championId: 'Karma', tier: 'Situacional' },
    ],
  },
];

const normalizeText = (str: string) =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

const getChampName = (id: string) =>
  WR_CHAMPIONS.find((c) => c.id === id)?.name || id;

const normalizePlayer = (raw: any): Player => ({
  id: String(raw.id),
  ign: raw.ign || '',
  role: (ROLES.includes(raw.role) ? raw.role : 'TOP') as LaneType,
  status: raw.status === 'Suplente' ? 'Suplente' : 'Titular',
  rank: raw.rank || 'Sovereign',
  notes: raw.notes || '',
  pool: Array.isArray(raw.pool) ? raw.pool : [],
});

export default function RosterPool() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [scrims, setScrims] = useState<ScrimMinimal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'cards' | 'matrix'>('cards');
  const [roleFilter, setRoleFilter] = useState<'ALL' | LaneType>('ALL');
  const [copied, setCopied] = useState(false);

  // Modal unificado Crear / Editar Jugador
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [formIgn, setFormIgn] = useState('');
  const [formRole, setFormRole] = useState<LaneType>('TOP');
  const [formStatus, setFormStatus] = useState<PlayerStatus>('Titular');
  const [formRank, setFormRank] = useState('Sovereign');
  const [formNotes, setFormNotes] = useState('');

  // Modal agregar/editar campeones del pool
  const [editingPoolPlayerId, setEditingPoolPlayerId] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<PoolTier>('S-Tier');
  const [champSearch, setChampSearch] = useState('');
  const [champLaneFilter, setChampLaneFilter] = useState<'ALL' | LaneType>('ALL');

  // Carga inicial desde Supabase vía API
  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [rosterRes, scrimsRes] = await Promise.all([
          api.roster.getAll(),
          api.scrims.getAll().catch(() => []),
        ]);
        if (!active) return;
        setPlayers(Array.isArray(rosterRes) ? rosterRes.map(normalizePlayer) : []);
        setScrims(Array.isArray(scrimsRes) ? scrimsRes : []);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || 'No se pudo conectar con el servidor.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, []);

  // Cruce automático con el historial real de Scrims en Supabase
  const scrimChampStats = useMemo(() => {
    const map = new Map<string, { games: number; wins: number; wr: number }>();
    scrims.forEach((m) => {
      (m.ourComp || []).forEach((cId) => {
        if (!cId) return;
        const prev = map.get(cId) || { games: 0, wins: 0, wr: 0 };
        prev.games += 1;
        if (m.result === 'win') prev.wins += 1;
        prev.wr = Math.round((prev.wins / prev.games) * 100);
        map.set(cId, prev);
      });
    });
    return map;
  }, [scrims]);

  // Métricas globales del Roster
  const rosterMetrics = useMemo(() => {
    const starters = players.filter((p) => p.status === 'Titular');
    const subs = players.filter((p) => p.status === 'Suplente');
    const totalPool = players.reduce((acc, p) => acc + p.pool.length, 0);
    const readyStarters = starters.filter(
      (p) =>
        p.pool.filter((c) => c.tier === 'S-Tier' || c.tier === 'Comfort').length >= 4
    ).length;
    const fearlessPct = starters.length
      ? Math.round((readyStarters / starters.length) * 100)
      : 0;
    return {
      startersCount: starters.length,
      subsCount: subs.length,
      totalPool,
      fearlessPct,
    };
  }, [players]);

  const editingPoolPlayer =
    players.find((p) => p.id === editingPoolPlayerId) || null;

  const seedInitialRoster = async () => {
    setSaving(true);
    setError(null);
    try {
      const created = await Promise.all(
        INITIAL_ROSTER_TEMPLATE.map((item) => api.roster.create(item))
      );
      setPlayers(created.map(normalizePlayer));
    } catch (err: any) {
      setError(err?.message || 'Error al cargar la plantilla base.');
    } finally {
      setSaving(false);
    }
  };

  const openCreatePlayerModal = () => {
    setEditingProfileId(null);
    setFormIgn('');
    setFormRole('TOP');
    setFormStatus('Titular');
    setFormRank('Sovereign');
    setFormNotes('');
    setPlayerModalOpen(true);
  };

  const openEditPlayerModal = (player: Player) => {
    setEditingProfileId(player.id);
    setFormIgn(player.ign);
    setFormRole(player.role);
    setFormStatus(player.status);
    setFormRank(player.rank);
    setFormNotes(player.notes);
    setPlayerModalOpen(true);
  };

  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    const ign = formIgn.trim();
    if (!ign) return;

    setSaving(true);
    setError(null);

    try {
      if (editingProfileId) {
        const current = players.find((p) => p.id === editingProfileId);
        const payload = {
          ign,
          role: formRole,
          status: formStatus,
          rank: formRank.trim() || 'Sovereign',
          notes: formNotes.trim() || 'Sin notas tácticas.',
          pool: current?.pool || [],
        };
        const updated = await api.roster.update(editingProfileId, payload);
        const normalized = normalizePlayer(updated);
        setPlayers((prev) =>
          prev.map((p) => (p.id === editingProfileId ? normalized : p))
        );
      } else {
        const payload = {
          ign,
          role: formRole,
          status: formStatus,
          rank: formRank.trim() || 'Sovereign',
          notes: formNotes.trim() || 'Sin notas tácticas.',
          pool: [],
        };
        const created = await api.roster.create(payload);
        setPlayers((prev) => [...prev, normalizePlayer(created)]);
      }
      setPlayerModalOpen(false);
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar el jugador.');
    } finally {
      setSaving(false);
    }
  };

  const openAddChampModal = (player: Player) => {
    setEditingPoolPlayerId(player.id);
    setChampLaneFilter(player.role);
    setSelectedTier('S-Tier');
    setChampSearch('');
  };

  const deletePlayer = async (id: string) => {
    const previous = players;
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    try {
      await api.roster.delete(id);
    } catch (err: any) {
      setPlayers(previous);
      setError(err?.message || 'No se pudo eliminar el jugador.');
    }
  };

  const addChampToPlayer = async (championId: string) => {
    if (!editingPoolPlayerId) return;
    const target = players.find((p) => p.id === editingPoolPlayerId);
    if (!target) return;

    const exists = target.pool.some((entry) => entry.championId === championId);
    const updatedPool: PoolEntry[] = exists
      ? target.pool.map((entry) =>
          entry.championId === championId
            ? { ...entry, tier: selectedTier }
            : entry
        )
      : [...target.pool, { championId, tier: selectedTier }];

    const previous = players;
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === target.id ? { ...p, pool: updatedPool } : p
      )
    );

    try {
      await api.roster.update(target.id, {
        ign: target.ign,
        role: target.role,
        status: target.status,
        rank: target.rank,
        notes: target.notes,
        pool: updatedPool,
      });
    } catch (err: any) {
      setPlayers(previous);
      setError(err?.message || 'No se pudo actualizar el Champion Pool.');
    }
  };

  const removeChampFromPlayer = async (playerId: string, championId: string) => {
    const target = players.find((p) => p.id === playerId);
    if (!target) return;

    const updatedPool = target.pool.filter(
      (entry) => entry.championId !== championId
    );
    const previous = players;

    setPlayers((prev) =>
      prev.map((p) =>
        p.id === playerId ? { ...p, pool: updatedPool } : p
      )
    );

    try {
      await api.roster.update(playerId, {
        ign: target.ign,
        role: target.role,
        status: target.status,
        rank: target.rank,
        notes: target.notes,
        pool: updatedPool,
      });
    } catch (err: any) {
      setPlayers(previous);
      setError(err?.message || 'No se pudo quitar el campeón.');
    }
  };

  const copyRosterToDiscord = async () => {
    const lines = ['🛡️ **PLANTILLA & CHAMPION POOL (FEARLESS READY)**', ''];
    const sorted = [...players].sort(
      (a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role)
    );
    sorted.forEach((p) => {
      const sTier = p.pool
        .filter((c) => c.tier === 'S-Tier')
        .map((c) => getChampName(c.championId))
        .join(', ');
      const comfort = p.pool
        .filter((c) => c.tier === 'Comfort')
        .map((c) => getChampName(c.championId))
        .join(', ');
      lines.push(
        `**[${p.role}] ${p.ign}** (${p.status} · ${p.rank})`,
        `• S-Tier: ${sTier || '—'}`,
        `• Comfort: ${comfort || '—'}`,
        ''
      );
    });
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const visiblePlayers = players
    .filter((p) => (roleFilter === 'ALL' ? true : p.role === roleFilter))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'Titular' ? -1 : 1;
      return ROLES.indexOf(a.role) - ROLES.indexOf(b.role);
    });

  const normalizedQuery = normalizeText(champSearch);
  const filteredChampions = WR_CHAMPIONS.filter((c) => {
    if (normalizedQuery.length > 0) {
      return (
        normalizeText(c.name).includes(normalizedQuery) ||
        normalizeText(c.id).includes(normalizedQuery)
      );
    }
    if (champLaneFilter === 'ALL') return true;
    return c.lanes.includes(champLaneFilter);
  }).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div translate="no" className="notranslate flex h-full flex-col gap-3 overflow-hidden">
      {/* Barra Superior */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 ring-1 ring-violet-500/30">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-100">
              Plantilla & Champion Pool Pro
            </h2>
            <p className="text-[11px] text-zinc-400">
              Conectado a Supabase · Sincronizado con Scrims
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Vista: Tarjetas vs Matriz Bo5 */}
          <div className="flex rounded-xl border border-zinc-800 bg-zinc-950 p-0.5">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                viewMode === 'cards'
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Tarjetas</span>
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                viewMode === 'matrix'
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Table2 className="h-3.5 w-3.5" />
              <span>Matriz Bo5</span>
            </button>
          </div>

          <button
            onClick={copyRosterToDiscord}
            className="flex items-center gap-1.5 rounded-xl bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
            title="Copiar plantilla y pools para Discord"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-violet-400" />
            )}
            <span>{copied ? 'Copiado' : 'Discord'}</span>
          </button>

          <button
            onClick={openCreatePlayerModal}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Agregar Jugador</span>
          </button>
        </div>
      </div>

      {/* Banner de Error si falla la API */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="rounded p-1 hover:bg-red-500/20"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* KPIs del Equipo */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Titulares / Suplentes
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-bold text-zinc-100">
              {rosterMetrics.startersCount} / {rosterMetrics.subsCount}
            </span>
            <span className="text-[11px] text-zinc-500">{players.length} en total</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Profundidad Total
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-bold text-zinc-100">
              {rosterMetrics.totalPool} picks
            </span>
            <span className="text-[11px] text-zinc-500">Asignados al pool</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            Preparación Fearless Bo5
          </p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="text-lg font-bold text-zinc-100">
              {rosterMetrics.fearlessPct}%
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all"
                style={{ width: `${rosterMetrics.fearlessPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
            Cruce con Scrims
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="flex items-center gap-1.5 text-lg font-bold text-zinc-100">
              <Trophy className="h-4 w-4 text-amber-400" />
              {scrimChampStats.size}
            </span>
            <span className="text-[11px] text-zinc-500">Campeones con WR</span>
          </div>
        </div>
      </div>

      {/* ESTADO DE CARGA O TABLA VACÍA */}
      {loading ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 text-zinc-400">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
          <p className="text-xs">Cargando plantilla desde Supabase...</p>
        </div>
      ) : players.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center">
          <Users className="h-8 w-8 text-zinc-600" />
          <div>
            <h3 className="text-sm font-bold text-zinc-200">
              Tu plantilla en Supabase está vacía
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              Agrega jugadores manualmente o carga los 5 titulares de ejemplo para empezar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={saving}
              onClick={seedInitialRoster}
              className="flex items-center gap-1.5 rounded-xl bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>{saving ? 'Cargando...' : 'Cargar plantilla base'}</span>
            </button>
            <button
              onClick={openCreatePlayerModal}
              className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-500"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Agregar Jugador</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        /* VISTA 1: TARJETAS DETALLADAS */
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          <div className="flex items-center gap-1.5">
            {(['ALL', ...ROLES] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`rounded-lg px-3 py-1 text-[11px] font-semibold transition ${
                  roleFilter === r
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {r === 'ALL' ? 'Todos los Roles' : r}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid content-start grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {visiblePlayers.map((player) => {
                const fearlessCount = player.pool.filter(
                  (c) => c.tier === 'S-Tier' || c.tier === 'Comfort'
                ).length;
                const isBo5Ready = fearlessCount >= 4;
                const progressPct = Math.min(100, Math.round((fearlessCount / 5) * 100));

                return (
                  <div
                    key={player.id}
                    className="group flex flex-col justify-between rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4 transition hover:border-violet-500/40"
                  >
                    <div>
                      {/* Encabezado */}
                      <div className="flex items-start justify-between gap-2 border-b border-zinc-800/80 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded border px-2 py-0.5 text-[10px] font-bold ${ROLE_BADGE[player.role]}`}
                            >
                              {player.role}
                            </span>
                            <h3 className="text-sm font-bold text-zinc-100">
                              {player.ign}
                            </h3>
                            {player.status === 'Titular' && (
                              <span title="Titular">
                                <Crown className="h-3.5 w-3.5 text-amber-400" />
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-zinc-400">
                            {player.status} ·{' '}
                            <span className="font-medium text-zinc-200">{player.rank}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openAddChampModal(player)}
                            className="flex items-center gap-1 rounded-lg bg-violet-600/20 px-2.5 py-1 text-[11px] font-semibold text-violet-300 hover:bg-violet-600/30"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Campeón</span>
                          </button>
                          <button
                            onClick={() => openEditPlayerModal(player)}
                            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
                            title="Editar jugador"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deletePlayer(player.id)}
                            className="rounded-lg p-1.5 text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100"
                            title="Eliminar jugador"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Pool por Tiers + WR de Scrims */}
                      <div className="mt-3 space-y-2.5">
                        {TIERS.map((tier) => {
                          const items = player.pool.filter((c) => c.tier === tier);
                          if (items.length === 0) return null;
                          return (
                            <div key={tier}>
                              <span
                                className={`inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${TIER_STYLES[tier]}`}
                              >
                                {tier} ({items.length})
                              </span>
                              <div className="mt-1.5 flex flex-wrap gap-2">
                                {items.map((entry) => {
                                  const scrimStat = scrimChampStats.get(entry.championId);
                                  return (
                                    <button
                                      key={entry.championId}
                                      onClick={() =>
                                        removeChampFromPlayer(player.id, entry.championId)
                                      }
                                      title={`${getChampName(entry.championId)}${
                                        scrimStat
                                          ? ` — Scrims: ${scrimStat.wr}% WR (${scrimStat.wins}W-${
                                              scrimStat.games - scrimStat.wins
                                            }L)`
                                          : ''
                                      } · Clic para quitar`}
                                      className="group/champ relative h-10 w-10 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 transition hover:border-red-500"
                                    >
                                      <img
                                        src={getChampionIconUrl(entry.championId)}
                                        alt={entry.championId}
                                        className="h-full w-full object-cover"
                                      />
                                      {scrimStat && (
                                        <span
                                          className={`absolute inset-x-0 bottom-0 py-[1px] text-center font-mono text-[8px] font-extrabold leading-none ${
                                            scrimStat.wr >= 50
                                              ? 'bg-emerald-500/90 text-zinc-950'
                                              : 'bg-red-500/90 text-white'
                                          }`}
                                        >
                                          {scrimStat.wr}%
                                        </span>
                                      )}
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/75 opacity-0 transition group-hover/champ:opacity-100">
                                        <X className="h-4 w-4 text-red-400" />
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}

                        {player.pool.length === 0 && (
                          <p className="py-4 text-center text-xs text-zinc-500">
                            Sin campeones asignados. Haz clic en "+ Campeón".
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Pie con Barra de Progreso Fearless */}
                    <div className="mt-4 space-y-2 border-t border-zinc-800/80 pt-2.5">
                      <p className="text-[11px] text-zinc-400">{player.notes}</p>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-500">
                          Sólidos Bo5:{' '}
                          <strong className="font-mono text-zinc-200">
                            {fearlessCount}/5
                          </strong>
                        </span>
                        <span
                          className={`flex items-center gap-1 font-semibold ${
                            isBo5Ready ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {isBo5Ready ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5" />
                          )}
                          {isBo5Ready ? 'Listo para Fearless' : 'Ampliar Pool'}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isBo5Ready ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* VISTA 2: MATRIZ FEARLESS Bo5 (5 TITULARES LADO A LADO) */
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-5">
          {ROLES.map((role) => {
            const starter =
              players.find((p) => p.role === role && p.status === 'Titular') ||
              players.find((p) => p.role === role);

            return (
              <div
                key={role}
                className="flex flex-col rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-3"
              >
                <div className="mb-3 flex items-center justify-between border-b border-zinc-800 pb-2">
                  <div>
                    <span
                      className={`rounded border px-2 py-0.5 text-[10px] font-bold ${ROLE_BADGE[role]}`}
                    >
                      {role}
                    </span>
                    <p className="mt-1 text-xs font-bold text-zinc-100">
                      {starter ? starter.ign : 'Sin titular'}
                    </p>
                  </div>
                  {starter && (
                    <button
                      onClick={() => openAddChampModal(starter)}
                      className="rounded-lg bg-zinc-800 p-1.5 text-zinc-300 hover:bg-zinc-700"
                      title="Agregar campeón"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {!starter ? (
                  <p className="py-8 text-center text-xs text-zinc-500">
                    Agrega un jugador para {role}.
                  </p>
                ) : (
                  <div className="flex-1 space-y-2 overflow-y-auto pr-0.5">
                    {starter.pool.length === 0 ? (
                      <p className="py-6 text-center text-xs text-zinc-500">
                        Pool vacío.
                      </p>
                    ) : (
                      starter.pool.map((entry, idx) => {
                        const scrimStat = scrimChampStats.get(entry.championId);
                        return (
                          <div
                            key={entry.championId}
                            className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-2"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="font-mono text-[10px] text-zinc-500">
                                M{idx + 1}
                              </span>
                              <img
                                src={getChampionIconUrl(entry.championId)}
                                alt={entry.championId}
                                className="h-7 w-7 shrink-0 rounded-lg border border-zinc-700 object-cover"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-bold text-zinc-100">
                                  {getChampName(entry.championId)}
                                </p>
                                <span
                                  className={`inline-block rounded border px-1 text-[8px] font-bold uppercase ${TIER_STYLES[entry.tier]}`}
                                >
                                  {entry.tier}
                                </span>
                              </div>
                            </div>
                            {scrimStat && (
                              <span
                                className={`font-mono text-[10px] font-bold ${
                                  scrimStat.wr >= 50
                                    ? 'text-emerald-400'
                                    : 'text-red-400'
                                }`}
                              >
                                {scrimStat.wr}%
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CREAR / EDITAR JUGADOR */}
      {playerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSavePlayer}
            className="w-full max-w-md space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-100">
                {editingProfileId ? 'Editar Jugador' : 'Agregar Jugador al Roster'}
              </h3>
              <button
                type="button"
                onClick={() => setPlayerModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-zinc-400">Nickname (IGN)</label>
              <input
                required
                value={formIgn}
                onChange={(e) => setFormIgn(e.target.value)}
                placeholder="Ej: Rulerkito"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-violet-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">Rol</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as LaneType)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-100 outline-none"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">Estado</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as PlayerStatus)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-100 outline-none"
                >
                  <option value="Titular">Titular</option>
                  <option value="Suplente">Suplente</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">Elo / Rango</label>
                <input
                  value={formRank}
                  onChange={(e) => setFormRank(e.target.value)}
                  placeholder="Sovereign"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-zinc-100 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-zinc-400">Notas de Estilo</label>
              <textarea
                rows={2}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Fortalezas, rol en equipo, comunicación..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPlayerModalOpen(false)}
                className="rounded-xl bg-zinc-800 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {saving
                  ? 'Guardando...'
                  : editingProfileId
                  ? 'Guardar Cambios'
                  : 'Guardar Jugador'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL ASIGNAR CAMPEONES AL POOL */}
      {editingPoolPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-zinc-100">
                  Champion Pool — {editingPoolPlayer.ign} ({editingPoolPlayer.role})
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Elige el tier y haz clic en los campeones para añadirlos o actualizar su nivel.
                </p>
              </div>
              <button
                onClick={() => setEditingPoolPlayerId(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-2.5 grid grid-cols-4 gap-1.5">
              {TIERS.map((tier) => (
                <button
                  key={tier}
                  onClick={() => setSelectedTier(tier)}
                  className={`rounded-lg border py-1.5 text-[11px] font-semibold transition ${
                    selectedTier === tier
                      ? TIER_STYLES[tier]
                      : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>

            <div className="mb-2.5 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                <input
                  value={champSearch}
                  onChange={(e) => setChampSearch(e.target.value)}
                  placeholder="Buscar campeón..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-1.5 pl-8 pr-3 text-xs text-zinc-100 outline-none focus:border-violet-500"
                />
              </div>
              <div className="flex gap-1">
                {(['ALL', ...ROLES] as const).map((lane) => (
                  <button
                    key={lane}
                    onClick={() => {
                      setChampLaneFilter(lane);
                      setChampSearch('');
                    }}
                    className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${
                      champLaneFilter === lane && !champSearch
                        ? 'bg-violet-600 text-white'
                        : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {lane === 'ALL' ? 'Todos' : lane}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid flex-1 grid-cols-5 gap-2 overflow-y-auto pr-1">
              {filteredChampions.map((champ) => {
                const existing = editingPoolPlayer.pool.find(
                  (e) => e.championId === champ.id
                );
                return (
                  <button
                    key={champ.id}
                    onClick={() => addChampToPlayer(champ.id)}
                    className={`flex flex-col items-center rounded-xl border p-1.5 transition ${
                      existing
                        ? 'border-violet-500/60 bg-violet-600/15'
                        : 'border-zinc-800 bg-zinc-950/70 hover:border-zinc-600'
                    }`}
                  >
                    <img
                      src={getChampionIconUrl(champ.id)}
                      alt={champ.name}
                      loading="lazy"
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                    <span className="mt-1 w-full truncate text-center text-[10px] font-medium text-zinc-200">
                      {champ.name}
                    </span>
                    {existing && (
                      <span className="text-[9px] font-bold text-violet-300">
                        {existing.tier}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}