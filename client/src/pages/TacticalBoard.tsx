import { useEffect, useRef, useState } from 'react';
import {
  Stage,
  Layer,
  Circle,
  Line,
  Arrow,
  Text,
  Group,
  Rect,
  Image as KonvaImage,
} from 'react-konva';
import {
  Pencil,
  MousePointer2,
  Hand,
  ArrowUpRight,
  Eye,
  EyeOff,
  Trash2,
  RotateCcw,
  Plus,
  Play,
  Pause,
  Upload,
  Search,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  BookOpen,
  Save,
  Download,
  Shield,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { socket } from '../lib/socket';
import { api } from '../services/api';
import {
  WR_CHAMPIONS,
  getChampionIconUrl,
  type Champion,
  type LaneType,
} from '../data/champions';

interface Token {
  id: string;
  role: LaneType;
  championId?: string;
  championName?: string;
  championShort?: string;
  team: 'blue' | 'red';
  x: number;
  y: number;
}

interface Ward {
  id: string;
  type: 'yellow' | 'control';
  x: number;
  y: number;
}

interface Minion {
  id: string;
  team: 'blue' | 'red';
  type: 'melee' | 'caster' | 'cannon';
  x: number;
  y: number;
}

interface DrawLine {
  points: number[];
  color: string;
}

interface TacticalArrow {
  id: string;
  points: [number, number, number, number];
  color: string;
}

interface Keyframe {
  id: string;
  label: string;
  tokens: Token[];
  wards: Ward[];
  minions: Minion[];
  lines: DrawLine[];
  arrows: TacticalArrow[];
}

type PlayCategory = 'Early' | 'Dragón' | 'Barón' | 'Siege' | 'Teamfight';

interface SavedPlay {
  id: string;
  name: string;
  category: PlayCategory;
  updatedAt: string;
  keyframes: Keyframe[];
}

const ROOM_ID = 'room:board:main';
const LOGICAL_SIZE = 560;
const LANE_TABS: Array<'ALL' | LaneType> = ['ALL', 'TOP', 'JG', 'MID', 'ADC', 'SUP'];
const PLAY_CATEGORIES: PlayCategory[] = ['Early', 'Dragón', 'Barón', 'Siege', 'Teamfight'];

const CATEGORY_STYLES: Record<PlayCategory, string> = {
  Early: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
  Dragón: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
  Barón: 'border-violet-500/30 bg-violet-500/15 text-violet-300',
  Siege: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
  Teamfight: 'border-red-500/30 bg-red-500/15 text-red-300',
};

// Posiciones de torretas T1 y T2 en la Grieta de Wild Rift
const TURRET_ZONES: Array<{ id: string; team: 'blue' | 'red'; x: number; y: number }> = [
  // Lado Azul
  { id: 'bt-top-1', team: 'blue', x: 72, y: 195 },
  { id: 'bt-top-2', team: 'blue', x: 76, y: 315 },
  { id: 'bt-mid-1', team: 'blue', x: 222, y: 338 },
  { id: 'bt-mid-2', team: 'blue', x: 175, y: 385 },
  { id: 'bt-bot-1', team: 'blue', x: 365, y: 488 },
  { id: 'bt-bot-2', team: 'blue', x: 245, y: 484 },
  // Lado Rojo
  { id: 'rt-top-1', team: 'red', x: 195, y: 72 },
  { id: 'rt-top-2', team: 'red', x: 315, y: 76 },
  { id: 'rt-mid-1', team: 'red', x: 338, y: 222 },
  { id: 'rt-mid-2', team: 'red', x: 385, y: 175 },
  { id: 'rt-bot-1', team: 'red', x: 488, y: 365 },
  { id: 'rt-bot-2', team: 'red', x: 484, y: 245 },
];

const INITIAL_TOKENS: Token[] = [
  // Lado Azul
  { id: 'b-top', role: 'TOP', team: 'blue', x: 85, y: 110 },
  { id: 'b-jg', role: 'JG', team: 'blue', x: 170, y: 350 },
  { id: 'b-mid', role: 'MID', team: 'blue', x: 250, y: 310 },
  { id: 'b-adc', role: 'ADC', team: 'blue', x: 430, y: 480 },
  { id: 'b-sup', role: 'SUP', team: 'blue', x: 385, y: 485 },
  // Lado Rojo
  { id: 'r-top', role: 'TOP', team: 'red', x: 130, y: 75 },
  { id: 'r-jg', role: 'JG', team: 'red', x: 390, y: 200 },
  { id: 'r-mid', role: 'MID', team: 'red', x: 310, y: 250 },
  { id: 'r-adc', role: 'ADC', team: 'red', x: 480, y: 440 },
  { id: 'r-sup', role: 'SUP', team: 'red', x: 485, y: 395 },
];

const createInitialKeyframes = (): Keyframe[] => [
  {
    id: 'kf-1',
    label: '00:00 Inicio',
    tokens: INITIAL_TOKENS,
    wards: [],
    minions: [],
    lines: [],
    arrows: [],
  },
];

const normalizePlay = (raw: any): SavedPlay => ({
  id: String(raw.id),
  name: raw.name || 'Jugada sin nombre',
  category: (PLAY_CATEGORIES.includes(raw.category) ? raw.category : 'Dragón') as PlayCategory,
  updatedAt: raw.updatedAt
    ? String(raw.updatedAt).slice(0, 10)
    : new Date().toISOString().slice(0, 10),
  keyframes:
    Array.isArray(raw.keyframes) && raw.keyframes.length > 0
      ? raw.keyframes
      : createInitialKeyframes(),
});

const normalizeText = (str: string) =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

const getWaveSpawnCoords = (team: 'blue' | 'red', lane: 'TOP' | 'MID' | 'BOT') => {
  if (lane === 'TOP') {
    const cx = team === 'blue' ? 92 : 138;
    const cy = team === 'blue' ? 132 : 82;
    return [
      { type: 'melee' as const, x: cx + 6, y: cy - 8 },
      { type: 'melee' as const, x: cx - 6, y: cy - 12 },
      { type: 'cannon' as const, x: cx, y: cy },
      { type: 'caster' as const, x: cx - 8, y: cy + 12 },
      { type: 'caster' as const, x: cx + 6, y: cy + 12 },
    ];
  }
  if (lane === 'BOT') {
    const cx = team === 'blue' ? 425 : 478;
    const cy = team === 'blue' ? 488 : 445;
    return [
      { type: 'melee' as const, x: cx + 10, y: cy - 6 },
      { type: 'melee' as const, x: cx + 10, y: cy + 6 },
      { type: 'cannon' as const, x: cx, y: cy },
      { type: 'caster' as const, x: cx - 12, y: cy - 6 },
      { type: 'caster' as const, x: cx - 12, y: cy + 6 },
    ];
  }
  const cx = team === 'blue' ? 250 : 310;
  const cy = team === 'blue' ? 310 : 250;
  return [
    { type: 'melee' as const, x: cx - 10, y: cy - 10 },
    { type: 'melee' as const, x: cx + 10, y: cy + 10 },
    { type: 'cannon' as const, x: cx, y: cy },
    { type: 'caster' as const, x: cx - 18, y: cy + 6 },
    { type: 'caster' as const, x: cx - 6, y: cy + 18 },
  ];
};

function ChampionTokenNode({
  token,
  isSelected,
  draggable,
  onSelect,
  onDragEnd,
}: {
  token: Token;
  isSelected: boolean;
  draggable: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
}) {
  const [avatar, setAvatar] = useState<HTMLImageElement | null>(null);
  const wasDragged = useRef(false);

  useEffect(() => {
    if (!token.championId) {
      setAvatar(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = getChampionIconUrl(token.championId);
    img.onload = () => setAvatar(img);
    img.onerror = () => setAvatar(null);
  }, [token.championId]);

  const teamColor = token.team === 'blue' ? '#2563eb' : '#dc2626';

  return (
    <Group
      x={token.x}
      y={token.y}
      draggable={draggable}
      onDragStart={() => {
        wasDragged.current = true;
      }}
      onDragEnd={(e) => {
        onDragEnd(e.target.x(), e.target.y());
        setTimeout(() => {
          wasDragged.current = false;
        }, 50);
      }}
      onClick={() => {
        if (!wasDragged.current) onSelect();
      }}
      onTap={() => {
        if (!wasDragged.current) onSelect();
      }}
    >
      {avatar ? (
        <>
          <Group
            clipFunc={(ctx) => {
              ctx.arc(0, 0, 17, 0, Math.PI * 2, false);
            }}
          >
            <KonvaImage image={avatar} x={-17} y={-17} width={34} height={34} />
          </Group>
          <Circle
            radius={17}
            stroke={isSelected ? '#c4b5fd' : teamColor}
            strokeWidth={isSelected ? 3.5 : 2.8}
            shadowBlur={10}
            shadowColor="rgba(0,0,0,0.85)"
          />
          <Rect
            x={-13}
            y={13}
            width={26}
            height={11}
            fill={teamColor}
            cornerRadius={4}
          />
          <Text
            text={token.role}
            fill="#ffffff"
            fontSize={7.5}
            fontStyle="bold"
            width={26}
            offsetX={13}
            y={15}
            align="center"
          />
        </>
      ) : (
        <>
          <Circle
            radius={17}
            fill={teamColor}
            stroke={isSelected ? '#c4b5fd' : '#fafafa'}
            strokeWidth={isSelected ? 3.5 : 2}
            shadowBlur={10}
            shadowColor="rgba(0,0,0,0.75)"
          />
          <Text
            text={token.championShort || token.role}
            fill="#ffffff"
            fontSize={9.5}
            fontStyle="bold"
            width={34}
            offsetX={17}
            offsetY={4.5}
            align="center"
          />
        </>
      )}
    </Group>
  );
}

export default function TacticalBoard() {
  const [tool, setTool] = useState<'select' | 'draw' | 'arrow' | 'pan'>('select');
  const [drawColor, setDrawColor] = useState('#a78bfa');
  const [showVision, setShowVision] = useState(true);
  const [showTurrets, setShowTurrets] = useState(true);

  const [waveMenuTeam, setWaveMenuTeam] = useState<'blue' | 'red' | null>(null);

  // Pantalla completa y zoom
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<any>(null);
  const [boardSize, setBoardSize] = useState(460);

  // Keyframes
  const [keyframes, setKeyframes] = useState<Keyframe[]>(createInitialKeyframes);
  const [activeIndex, setActiveIndex] = useState(0);
  const [editingKfIdx, setEditingKfIdx] = useState<number | null>(null);
  const [editingKfLabel, setEditingKfLabel] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [animatedTokens, setAnimatedTokens] = useState<Token[] | null>(null);
  const [animatedMinions, setAnimatedMinions] = useState<Minion[] | null>(null);

  // Selector de campeones
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [laneFilter, setLaneFilter] = useState<'ALL' | LaneType>('ALL');
  const [champSearch, setChampSearch] = useState('');

  // Biblioteca de Jugadas (Playbook conectado a Supabase)
  const [showPlaybook, setShowPlaybook] = useState(false);
  const [savedPlays, setSavedPlays] = useState<SavedPlay[]>([]);
  const [loadingPlays, setLoadingPlays] = useState(true);
  const [savingPlay, setSavingPlay] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [playName, setPlayName] = useState('');
  const [playCategory, setPlayCategory] = useState<PlayCategory>('Dragón');
  const [activePlayId, setActivePlayId] = useState<string | null>(null);

  // Imagen del minimapa
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isDrawing = useRef(false);
  const animFrameRef = useRef<number | null>(null);

  const currentFrame = keyframes[activeIndex] || keyframes[0];
  const displayTokens = animatedTokens || currentFrame.tokens;
  const displayMinions = animatedMinions || currentFrame.minions;
  const baseScale = boardSize / LOGICAL_SIZE;
  const totalScale = baseScale * zoom;

  // Cargar Playbook desde Supabase
  useEffect(() => {
    let active = true;
    const loadPlays = async () => {
      setLoadingPlays(true);
      setPlayError(null);
      try {
        const res = await api.plays.getAll();
        if (!active) return;
        setSavedPlays(Array.isArray(res) ? res.map(normalizePlay) : []);
      } catch (err: any) {
        if (!active) return;
        setPlayError(err?.message || 'No se pudo cargar el Playbook desde Supabase.');
      } finally {
        if (active) setLoadingPlays(false);
      }
    };
    loadPlays();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) setIsFullscreen(false);
        setWaveMenuTeam(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const { clientWidth, clientHeight } = el;
      const available = Math.min(clientWidth - 96, clientHeight - 72);
      setBoardSize(Math.max(280, Math.min(available, 960)));
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isFullscreen, showPlaybook, selectedTokenId]);

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = '/minimap.png';
    img.onload = () => setMapImage(img);
  }, []);

  useEffect(() => {
    socket.emit('room:join', ROOM_ID);

    socket.on('board:sync', (state) => {
      if (state.keyframes) setKeyframes(state.keyframes);
      if (typeof state.activeIndex === 'number') setActiveIndex(state.activeIndex);
    });

    return () => {
      socket.off('board:sync');
    };
  }, []);

  const broadcast = (nextKeyframes: Keyframe[], nextIndex: number) => {
    socket.emit('board:update', {
      roomId: ROOM_ID,
      state: { keyframes: nextKeyframes, activeIndex: nextIndex },
    });
  };

  const updateCurrentFrame = (updater: (frame: Keyframe) => Keyframe) => {
    const next = keyframes.map((kf, idx) => (idx === activeIndex ? updater(kf) : kf));
    setKeyframes(next);
    broadcast(next, activeIndex);
  };

  const exportToPng = () => {
    if (!stageRef.current) return;
    try {
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `playbook-${currentFrame.label.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error exportando PNG:', err);
    }
  };

  const handleSavePlay = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = playName.trim();
    if (!cleanName) return;

    setSavingPlay(true);
    setPlayError(null);

    const clonedKeyframes: Keyframe[] = JSON.parse(JSON.stringify(keyframes));
    const payload = {
      name: cleanName,
      category: playCategory,
      keyframes: clonedKeyframes,
    };

    try {
      const created = await api.plays.create(payload);
      const saved = normalizePlay(created);
      setSavedPlays((prev) => [saved, ...prev]);
      setActivePlayId(saved.id);
      setPlayName('');
    } catch (err: any) {
      setPlayError(err?.message || 'No se pudo guardar la jugada en Supabase.');
    } finally {
      setSavingPlay(false);
    }
  };

  const handleLoadPlay = (play: SavedPlay) => {
    const cloned: Keyframe[] = JSON.parse(JSON.stringify(play.keyframes));
    setIsPlaying(false);
    setAnimatedTokens(null);
    setAnimatedMinions(null);
    setKeyframes(cloned);
    setActiveIndex(0);
    setActivePlayId(play.id);
    broadcast(cloned, 0);
  };

  const handleDeletePlay = async (id: string) => {
    const previous = savedPlays;
    setSavedPlays((prev) => prev.filter((p) => p.id !== id));
    if (activePlayId === id) setActivePlayId(null);

    try {
      await api.plays.delete(id);
    } catch (err: any) {
      setSavedPlays(previous);
      setPlayError(err?.message || 'No se pudo eliminar la jugada.');
    }
  };

  const applyZoom = (nextZoom: number) => {
    const clamped = Math.max(0.6, Math.min(2.5, Number(nextZoom.toFixed(2))));
    setZoom(clamped);
    if (clamped <= 1) setStagePos({ x: 0, y: 0 });
  };

  const resetView = () => {
    setZoom(1);
    setStagePos({ x: 0, y: 0 });
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;

    const oldScale = totalScale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const scaleBy = 1.1;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const nextZoom = Math.max(
      0.6,
      Math.min(2.5, Number((direction > 0 ? zoom * scaleBy : zoom / scaleBy).toFixed(2)))
    );
    const newScale = baseScale * nextZoom;

    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };

    setZoom(nextZoom);
    if (nextZoom <= 1) {
      setStagePos({ x: 0, y: 0 });
    } else {
      setStagePos({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    }
  };

  const handleMapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.src = reader.result as string;
      img.onload = () => setMapImage(img);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectToken = (token: Token) => {
    if (tool !== 'select') return;
    setShowPlaybook(false);
    setSelectedTokenId(token.id);
    setLaneFilter(token.role);
    setChampSearch('');
  };

  const handleTokenDrag = (id: string, x: number, y: number) => {
    updateCurrentFrame((frame) => ({
      ...frame,
      tokens: frame.tokens.map((t) => (t.id === id ? { ...t, x, y } : t)),
    }));
  };

  const handleWardDrag = (id: string, x: number, y: number) => {
    updateCurrentFrame((frame) => ({
      ...frame,
      wards: frame.wards.map((w) => (w.id === id ? { ...w, x, y } : w)),
    }));
  };

  const removeWard = (id: string) => {
    updateCurrentFrame((frame) => ({
      ...frame,
      wards: frame.wards.filter((w) => w.id !== id),
    }));
  };

  const handleMinionDrag = (id: string, x: number, y: number) => {
    updateCurrentFrame((frame) => ({
      ...frame,
      minions: frame.minions.map((m) => (m.id === id ? { ...m, x, y } : m)),
    }));
  };

  const removeMinion = (id: string) => {
    updateCurrentFrame((frame) => ({
      ...frame,
      minions: frame.minions.filter((m) => m.id !== id),
    }));
  };

  const addWard = (type: 'yellow' | 'control') => {
    const newWard: Ward = {
      id: `ward-${Date.now()}`,
      type,
      x: LOGICAL_SIZE / 2,
      y: LOGICAL_SIZE / 2,
    };
    updateCurrentFrame((frame) => ({
      ...frame,
      wards: [...frame.wards, newWard],
    }));
  };

  const addMinionWave = (team: 'blue' | 'red', lane: 'TOP' | 'MID' | 'BOT') => {
    const base = Date.now();
    const coords = getWaveSpawnCoords(team, lane);
    const wave: Minion[] = coords.map((c, idx) => ({
      id: `m-${base}-${idx}`,
      team,
      type: c.type,
      x: c.x,
      y: c.y,
    }));

    updateCurrentFrame((frame) => ({
      ...frame,
      minions: [...frame.minions, ...wave],
    }));
    setWaveMenuTeam(null);
  };

  const assignChampion = (champ: Champion) => {
    if (!selectedTokenId) return;
    const next = keyframes.map((kf) => ({
      ...kf,
      tokens: kf.tokens.map((t) =>
        t.id === selectedTokenId
          ? {
              ...t,
              championId: champ.id,
              championName: champ.name,
              championShort: champ.short,
            }
          : t
      ),
    }));
    setKeyframes(next);
    broadcast(next, activeIndex);
    setSelectedTokenId(null);
    setChampSearch('');
  };

  const clearChampionFromToken = () => {
    if (!selectedTokenId) return;
    const next = keyframes.map((kf) => ({
      ...kf,
      tokens: kf.tokens.map((t) =>
        t.id === selectedTokenId
          ? {
              ...t,
              championId: undefined,
              championName: undefined,
              championShort: undefined,
            }
          : t
      ),
    }));
    setKeyframes(next);
    broadcast(next, activeIndex);
  };

  const handleMouseDown = (e: any) => {
    if (tool !== 'draw' && tool !== 'arrow') return;
    const pos = e.target.getStage()?.getRelativePointerPosition();
    if (!pos) return;
    isDrawing.current = true;

    if (tool === 'draw') {
      const updatedLines = [
        ...currentFrame.lines,
        { points: [pos.x, pos.y], color: drawColor },
      ];
      setKeyframes((prev) =>
        prev.map((kf, idx) =>
          idx === activeIndex ? { ...kf, lines: updatedLines } : kf
        )
      );
    } else if (tool === 'arrow') {
      const newArrow: TacticalArrow = {
        id: `arr-${Date.now()}`,
        points: [pos.x, pos.y, pos.x, pos.y],
        color: drawColor,
      };
      setKeyframes((prev) =>
        prev.map((kf, idx) =>
          idx === activeIndex
            ? { ...kf, arrows: [...(kf.arrows || []), newArrow] }
            : kf
        )
      );
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current || (tool !== 'draw' && tool !== 'arrow')) return;
    const point = e.target.getStage()?.getRelativePointerPosition();
    if (!point) return;

    if (tool === 'draw') {
      setKeyframes((prev) =>
        prev.map((kf, idx) => {
          if (idx !== activeIndex) return kf;
          const linesCopy = [...kf.lines];
          const last = { ...linesCopy[linesCopy.length - 1] };
          last.points = last.points.concat([point.x, point.y]);
          linesCopy[linesCopy.length - 1] = last;
          return { ...kf, lines: linesCopy };
        })
      );
    } else if (tool === 'arrow') {
      setKeyframes((prev) =>
        prev.map((kf, idx) => {
          if (idx !== activeIndex) return kf;
          const arrowsCopy = [...(kf.arrows || [])];
          const last = { ...arrowsCopy[arrowsCopy.length - 1] };
          last.points = [last.points[0], last.points[1], point.x, point.y];
          arrowsCopy[arrowsCopy.length - 1] = last;
          return { ...kf, arrows: arrowsCopy };
        })
      );
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    broadcast(keyframes, activeIndex);
  };

  const addKeyframe = () => {
    const newIndex = keyframes.length;
    const cloned: Keyframe = {
      id: `kf-${Date.now()}`,
      label: `Paso ${newIndex + 1}`,
      tokens: currentFrame.tokens.map((t) => ({ ...t })),
      wards: currentFrame.wards.map((w) => ({ ...w })),
      minions: currentFrame.minions.map((m) => ({ ...m })),
      lines: [],
      arrows: [],
    };
    const next = [...keyframes, cloned];
    setKeyframes(next);
    setActiveIndex(newIndex);
    broadcast(next, newIndex);
  };

  const saveKeyframeLabel = (idx: number) => {
    const trimmed = editingKfLabel.trim();
    if (trimmed) {
      const next = keyframes.map((kf, i) =>
        i === idx ? { ...kf, label: trimmed } : kf
      );
      setKeyframes(next);
      broadcast(next, activeIndex);
    }
    setEditingKfIdx(null);
  };

  const deleteKeyframe = (indexToDelete: number) => {
    if (keyframes.length <= 1) return;
    const next = keyframes.filter((_, idx) => idx !== indexToDelete);
    const nextIdx = Math.max(0, Math.min(activeIndex, next.length - 1));
    setKeyframes(next);
    setActiveIndex(nextIdx);
    broadcast(next, nextIdx);
  };

  const selectKeyframe = (idx: number) => {
    setIsPlaying(false);
    setAnimatedTokens(null);
    setAnimatedMinions(null);
    setActiveIndex(idx);
    broadcast(keyframes, idx);
  };

  const togglePlay = () => {
    if (keyframes.length < 2) return;
    if (isPlaying) {
      setIsPlaying(false);
      setAnimatedTokens(null);
      setAnimatedMinions(null);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    setIsPlaying(true);
    let step = 0;
    const durationPerStep = 1400;
    let startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / durationPerStep, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      const fromFrame = keyframes[step];
      const toFrame = keyframes[step + 1];

      if (!fromFrame || !toFrame) {
        setIsPlaying(false);
        setAnimatedTokens(null);
        setAnimatedMinions(null);
        setActiveIndex(keyframes.length - 1);
        return;
      }

      const interpolatedTokens = fromFrame.tokens.map((fromToken) => {
        const toToken = toFrame.tokens.find((tok) => tok.id === fromToken.id);
        if (!toToken) return fromToken;
        return {
          ...fromToken,
          x: fromToken.x + (toToken.x - fromToken.x) * ease,
          y: fromToken.y + (toToken.y - fromToken.y) * ease,
        };
      });

      const interpolatedMinions = fromFrame.minions.map((fromM) => {
        const toM = toFrame.minions.find((m) => m.id === fromM.id);
        if (!toM) return fromM;
        return {
          ...fromM,
          x: fromM.x + (toM.x - fromM.x) * ease,
          y: fromM.y + (toM.y - fromM.y) * ease,
        };
      });

      setActiveIndex(step);
      setAnimatedTokens(interpolatedTokens);
      setAnimatedMinions(interpolatedMinions);

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        step += 1;
        if (step < keyframes.length - 1) {
          startTime = performance.now();
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          setIsPlaying(false);
          setAnimatedTokens(null);
          setAnimatedMinions(null);
          setActiveIndex(keyframes.length - 1);
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  const clearDrawings = () => {
    updateCurrentFrame((frame) => ({ ...frame, lines: [], arrows: [] }));
  };

  const resetBoard = () => {
    setIsPlaying(false);
    setAnimatedTokens(null);
    setAnimatedMinions(null);
    setActivePlayId(null);
    resetView();
    const fresh = createInitialKeyframes();
    setKeyframes(fresh);
    setActiveIndex(0);
    broadcast(fresh, 0);
  };

  const normalizedQuery = normalizeText(champSearch);
  const filteredChampions = WR_CHAMPIONS.filter((c) => {
    if (normalizedQuery.length > 0) {
      return (
        normalizeText(c.name).includes(normalizedQuery) ||
        normalizeText(c.id).includes(normalizedQuery) ||
        c.lanes.some((l) => l.toLowerCase().includes(normalizedQuery))
      );
    }
    if (laneFilter === 'ALL') return true;
    return c.lanes.includes(laneFilter);
  }).sort((a, b) => a.name.localeCompare(b.name));

  const selectedToken = currentFrame.tokens.find((t) => t.id === selectedTokenId);

  return (
    <div
      translate="no"
      className={`notranslate flex flex-col gap-3 overflow-hidden ${
        isFullscreen ? 'fixed inset-0 z-50 bg-zinc-950 p-4' : 'h-full'
      }`}
    >
      {/* Header Minimalista */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 ring-1 ring-violet-500/30">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
              Pizarra Táctica — Studio
            </h2>
            <p className="text-[11px] text-zinc-400">
              Playbook en Supabase · Clic en ficha para campeón · Doble clic en ward/súbdito para eliminar
            </p>
          </div>
        </div>

        {/* Acciones de Archivo y Vista */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setSelectedTokenId(null);
              setShowPlaybook(!showPlaybook);
            }}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              showPlaybook
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                : 'border border-zinc-800 bg-zinc-950/70 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Playbook ({savedPlays.length})</span>
          </button>

          <button
            onClick={exportToPng}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-emerald-500/40 hover:bg-zinc-800"
            title="Descargar captura PNG para Discord"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            <span>PNG</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleMapUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950/70 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800"
            title="Cambiar imagen del minimapa"
          >
            <Upload className="h-3.5 w-3.5 text-violet-400" />
            <span>Mapa</span>
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`rounded-xl border p-1.5 transition ${
              isFullscreen
                ? 'border-violet-500 bg-violet-600 text-white'
                : 'border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800'
            }`}
            title={isFullscreen ? 'Salir de pantalla grande (Esc)' : 'Pantalla grande'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            onClick={resetBoard}
            className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-1.5 text-zinc-400 transition hover:border-red-500/40 hover:text-red-400"
            title="Reiniciar tablero"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Zona Central: Lienzo con Docks Flotantes + Panel Derecho */}
      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        <div
          ref={containerRef}
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-zinc-800/80 bg-[radial-gradient(circle_at_center,_rgba(139,92,246,0.08)_0%,_rgba(9,9,11,0.95)_75%)] p-3"
        >
          {/* DOCK FLOTANTE IZQUIERDO: Herramientas de Dibujo */}
          <div className="absolute left-3 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-2xl border border-zinc-800/90 bg-zinc-950/90 p-1.5 shadow-2xl backdrop-blur-md">
            <button
              onClick={() => setTool('select')}
              className={`rounded-xl p-2 transition ${
                tool === 'select'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              }`}
              title="Mover fichas"
            >
              <MousePointer2 className="h-4 w-4" />
            </button>

            <button
              onClick={() => setTool('pan')}
              className={`rounded-xl p-2 transition ${
                tool === 'pan'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              }`}
              title="Mover vista del mapa (con zoom)"
            >
              <Hand className="h-4 w-4" />
            </button>

            <button
              onClick={() => setTool('arrow')}
              className={`rounded-xl p-2 transition ${
                tool === 'arrow'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              }`}
              title="Trazar flecha táctica"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => setTool('draw')}
              className={`rounded-xl p-2 transition ${
                tool === 'draw'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              }`}
              title="Dibujo libre"
            >
              <Pencil className="h-4 w-4" />
            </button>

            <div className="my-1 h-px w-5 bg-zinc-800" />

            {['#a78bfa', '#38bdf8', '#f87171', '#facc15'].map((c) => (
              <button
                key={c}
                onClick={() => {
                  setDrawColor(c);
                  if (tool !== 'arrow') setTool('draw');
                }}
                className={`h-4 w-4 rounded-full border-2 transition ${
                  drawColor === c ? 'scale-125 border-white' : 'border-transparent opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: c }}
                title="Color de trazo"
              />
            ))}

            <div className="my-1 h-px w-5 bg-zinc-800" />

            <button
              onClick={clearDrawings}
              className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-red-400"
              title="Borrar trazos y flechas del paso actual"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* STAGE DEL MINIMAPA */}
          <div
            className={`overflow-hidden rounded-2xl border border-zinc-800/90 shadow-[0_0_50px_rgba(0,0,0,0.75)] ${
              tool === 'pan' ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
          >
            <Stage
              ref={stageRef}
              width={boardSize}
              height={boardSize}
              scaleX={totalScale}
              scaleY={totalScale}
              x={stagePos.x}
              y={stagePos.y}
              draggable={tool === 'pan'}
              onDragEnd={(e) => {
                if (tool === 'pan' && e.target === e.target.getStage()) {
                  setStagePos({ x: e.target.x(), y: e.target.y() });
                }
              }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              {/* Capa 1: Mapa */}
              <Layer>
                {mapImage ? (
                  <KonvaImage
                    image={mapImage}
                    width={LOGICAL_SIZE}
                    height={LOGICAL_SIZE}
                  />
                ) : (
                  <Rect width={LOGICAL_SIZE} height={LOGICAL_SIZE} fill="#0b1215" />
                )}
              </Layer>

              {/* Capa 2: Torretas y Rangos */}
              <Layer listening={false}>
                {showTurrets &&
                  TURRET_ZONES.map((tz) => {
                    const isBlue = tz.team === 'blue';
                    return (
                      <Group key={tz.id} x={tz.x} y={tz.y}>
                        <Circle
                          radius={28}
                          fill={
                            isBlue
                              ? 'rgba(59, 130, 246, 0.22)'
                              : 'rgba(239, 68, 68, 0.22)'
                          }
                          stroke={
                            isBlue
                              ? 'rgba(96, 165, 250, 0.9)'
                              : 'rgba(248, 113, 113, 0.9)'
                          }
                          strokeWidth={1.5}
                          dash={[5, 4]}
                        />
                        <Circle
                          radius={4.5}
                          fill={isBlue ? '#60a5fa' : '#f87171'}
                          stroke="#09090b"
                          strokeWidth={1.5}
                        />
                      </Group>
                    );
                  })}
              </Layer>

              {/* Capa 3: Trazos y Flechas */}
              <Layer>
                {currentFrame.lines.map((line, i) => (
                  <Line
                    key={i}
                    points={line.points}
                    stroke={line.color}
                    strokeWidth={3.2}
                    tension={0.4}
                    lineCap="round"
                    lineJoin="round"
                  />
                ))}
                {(currentFrame.arrows || []).map((arrow) => (
                  <Arrow
                    key={arrow.id}
                    points={arrow.points}
                    stroke={arrow.color}
                    fill={arrow.color}
                    strokeWidth={3.2}
                    pointerLength={10}
                    pointerWidth={10}
                    lineCap="round"
                  />
                ))}
              </Layer>

              {/* Capa 4: Wards */}
              <Layer>
                {currentFrame.wards.map((ward) => {
                  const visionRadius = ward.type === 'yellow' ? 34 : 30;
                  return (
                    <Group
                      key={ward.id}
                      x={ward.x}
                      y={ward.y}
                      draggable={tool === 'select' && !isPlaying}
                      onDblClick={() => removeWard(ward.id)}
                      onDragEnd={(e) => handleWardDrag(ward.id, e.target.x(), e.target.y())}
                    >
                      {showVision && (
                        <Circle
                          radius={visionRadius}
                          fill={
                            ward.type === 'yellow'
                              ? 'rgba(250, 204, 21, 0.18)'
                              : 'rgba(236, 72, 153, 0.20)'
                          }
                          stroke={
                            ward.type === 'yellow'
                              ? 'rgba(250, 204, 21, 0.7)'
                              : 'rgba(236, 72, 153, 0.75)'
                          }
                          strokeWidth={1.3}
                          dash={[3, 3]}
                        />
                      )}
                      <Circle
                        radius={5.5}
                        fill={ward.type === 'yellow' ? '#facc15' : '#ec4899'}
                        stroke="#09090b"
                        strokeWidth={1.8}
                      />
                    </Group>
                  );
                })}
              </Layer>

              {/* Capa 5: Oleadas de Súbditos */}
              <Layer>
                {displayMinions.map((m) => {
                  const radius = m.type === 'cannon' ? 8 : m.type === 'melee' ? 6 : 5;
                  const fill = m.team === 'blue' ? '#38bdf8' : '#f87171';
                  const stroke = m.type === 'cannon' ? '#facc15' : '#09090b';
                  return (
                    <Group
                      key={m.id}
                      x={m.x}
                      y={m.y}
                      draggable={tool === 'select' && !isPlaying}
                      onDblClick={() => removeMinion(m.id)}
                      onDragEnd={(e) => handleMinionDrag(m.id, e.target.x(), e.target.y())}
                    >
                      <Circle
                        radius={radius}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={m.type === 'cannon' ? 2 : 1.5}
                      />
                    </Group>
                  );
                })}
              </Layer>

              {/* Capa 6: Campeones */}
              <Layer>
                {displayTokens.map((token) => (
                  <ChampionTokenNode
                    key={token.id}
                    token={token}
                    isSelected={selectedTokenId === token.id}
                    draggable={tool === 'select' && !isPlaying}
                    onSelect={() => handleSelectToken(token)}
                    onDragEnd={(x, y) => handleTokenDrag(token.id, x, y)}
                  />
                ))}
              </Layer>
            </Stage>
          </div>

          {/* DOCK FLOTANTE INFERIOR IZQUIERDO: Elementos Tácticos y Capas */}
          <div className="absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-1.5 rounded-2xl border border-zinc-800/90 bg-zinc-950/90 px-2 py-1.5 shadow-2xl backdrop-blur-md">
            <button
              onClick={() => addWard('yellow')}
              className="flex items-center gap-1 rounded-lg bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500/25"
            >
              <Plus className="h-3 w-3" /> <span>Ward</span>
            </button>

            <button
              onClick={() => addWard('control')}
              className="flex items-center gap-1 rounded-lg bg-pink-500/15 px-2.5 py-1 text-[11px] font-semibold text-pink-300 transition hover:bg-pink-500/25"
            >
              <Plus className="h-3 w-3" /> <span>Pink</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setWaveMenuTeam(waveMenuTeam === 'blue' ? null : 'blue')}
                className="flex items-center gap-1 rounded-lg bg-blue-500/15 px-2.5 py-1 text-[11px] font-semibold text-blue-300 transition hover:bg-blue-500/25"
              >
                <Plus className="h-3 w-3" /> <span>Oleada</span>
              </button>
              {waveMenuTeam === 'blue' && (
                <div className="absolute bottom-9 left-0 z-30 flex gap-1 rounded-xl border border-zinc-700 bg-zinc-950 p-1 shadow-xl">
                  {(['TOP', 'MID', 'BOT'] as const).map((lane) => (
                    <button
                      key={lane}
                      onClick={() => addMinionWave('blue', lane)}
                      className="rounded-lg px-2 py-1 text-[11px] font-semibold text-blue-300 hover:bg-blue-500/20"
                    >
                      {lane}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setWaveMenuTeam(waveMenuTeam === 'red' ? null : 'red')}
                className="flex items-center gap-1 rounded-lg bg-red-500/15 px-2.5 py-1 text-[11px] font-semibold text-red-300 transition hover:bg-red-500/25"
              >
                <Plus className="h-3 w-3" /> <span>Oleada</span>
              </button>
              {waveMenuTeam === 'red' && (
                <div className="absolute bottom-9 left-0 z-30 flex gap-1 rounded-xl border border-zinc-700 bg-zinc-950 p-1 shadow-xl">
                  {(['TOP', 'MID', 'BOT'] as const).map((lane) => (
                    <button
                      key={lane}
                      onClick={() => addMinionWave('red', lane)}
                      className="rounded-lg px-2 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-500/20"
                    >
                      {lane}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mx-0.5 h-4 w-px bg-zinc-800" />

            <button
              onClick={() => setShowTurrets(!showTurrets)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                showTurrets
                  ? 'bg-violet-600/25 text-violet-200 ring-1 ring-violet-500/50'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              <Shield className="h-3 w-3" />
              <span>Torretas</span>
            </button>

            <button
              onClick={() => setShowVision(!showVision)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                showVision
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
              }`}
            >
              {showVision ? (
                <Eye className="h-3 w-3 text-violet-400" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
              <span>Visión</span>
            </button>
          </div>

          {/* DOCK FLOTANTE INFERIOR DERECHO: Zoom */}
          <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-2xl border border-zinc-800/90 bg-zinc-950/90 p-1 shadow-2xl backdrop-blur-md">
            <button
              onClick={() => applyZoom(zoom - 0.2)}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              title="Alejar"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={resetView}
              className="min-w-[46px] rounded-lg px-1.5 py-1 text-center font-mono text-[11px] font-semibold text-zinc-200 hover:bg-zinc-800"
              title="Restablecer zoom al 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => applyZoom(zoom + 0.2)}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              title="Acercar"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* PANEL DERECHO A: BIBLIOTECA DE PLAYBOOK (SUPABASE) */}
        {showPlaybook && !selectedToken && (
          <div className="flex w-72 flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-3.5 backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-violet-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-100">
                  Playbook del Equipo
                </h3>
              </div>
              <button
                onClick={() => setShowPlaybook(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {playError && (
              <div className="mb-2.5 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300">
                <span className="truncate">{playError}</span>
                <button
                  onClick={() => setPlayError(null)}
                  className="ml-1 shrink-0 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            <form onSubmit={handleSavePlay} className="mb-3 space-y-2 border-b border-zinc-800 pb-3">
              <input
                value={playName}
                onChange={(e) => setPlayName(e.target.value)}
                placeholder="Nombre (ej: Setup 1er Dragón)..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500"
              />
              <div className="flex flex-wrap gap-1">
                {PLAY_CATEGORIES.map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setPlayCategory(cat)}
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold transition ${
                      playCategory === cat
                        ? CATEGORY_STYLES[cat]
                        : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={savingPlay || !playName.trim()}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-600 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
              >
                {savingPlay ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span>
                  {savingPlay
                    ? 'Guardando...'
                    : `Guardar Jugada (${keyframes.length} pasos)`}
                </span>
              </button>
            </form>

            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {loadingPlays ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                  <span>Cargando Playbook...</span>
                </div>
              ) : savedPlays.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500">
                  Aún no has guardado jugadas en Supabase. Arma una rotación en el mapa y guárdala arriba.
                </p>
              ) : (
                savedPlays.map((play) => (
                  <div
                    key={play.id}
                    onClick={() => handleLoadPlay(play)}
                    className={`group cursor-pointer rounded-xl border p-2.5 transition ${
                      activePlayId === play.id
                        ? 'border-violet-500 bg-violet-600/15'
                        : 'border-zinc-800 bg-zinc-950/70 hover:border-zinc-700 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-zinc-100">{play.name}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePlay(play.id);
                        }}
                        className="text-zinc-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${CATEGORY_STYLES[play.category]}`}
                      >
                        {play.category}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-500">
                        {play.keyframes.length} pasos · {play.updatedAt}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* PANEL DERECHO B: SELECTOR DE CAMPEONES */}
        {selectedToken && (
          <div className="flex w-72 flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-3.5 backdrop-blur-md">
            <div className="mb-2.5 flex items-center justify-between">
              <div>
                <span
                  className={`text-[10px] font-bold uppercase ${
                    selectedToken.team === 'blue' ? 'text-blue-400' : 'text-red-400'
                  }`}
                >
                  Lado {selectedToken.team === 'blue' ? 'Azul' : 'Rojo'} · {selectedToken.role}
                </span>
                <h3 className="text-sm font-semibold text-zinc-100">
                  {selectedToken.championName || 'Elegir Campeón'}
                </h3>
              </div>
              <div className="flex items-center gap-1">
                {selectedToken.championId && (
                  <button
                    onClick={clearChampionFromToken}
                    className="rounded-lg px-2 py-1 text-[10px] font-medium text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
                  >
                    Quitar
                  </button>
                )}
                <button
                  onClick={() => setSelectedTokenId(null)}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="relative mb-2.5">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={champSearch}
                onChange={(e) => setChampSearch(e.target.value)}
                placeholder="Buscar campeón (ej: kaisa, lee)..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-1.5 pl-8 pr-7 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500"
              />
              {champSearch && (
                <button
                  onClick={() => setChampSearch('')}
                  className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="mb-2.5 grid grid-cols-6 gap-1">
              {LANE_TABS.map((lane) => (
                <button
                  key={lane}
                  onClick={() => {
                    setLaneFilter(lane);
                    setChampSearch('');
                  }}
                  className={`rounded-lg py-1 text-[10px] font-semibold transition ${
                    laneFilter === lane && !champSearch
                      ? 'bg-violet-600 text-white'
                      : 'bg-zinc-950/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {lane === 'ALL' ? 'Todos' : lane}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto pr-1">
              {filteredChampions.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500">
                  No se encontró ningún campeón.
                </p>
              ) : (
                filteredChampions.map((champ) => (
                  <button
                    key={champ.id}
                    onClick={() => assignChampion(champ)}
                    className="flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left text-xs text-zinc-200 transition hover:bg-violet-600/20 hover:text-violet-200"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={getChampionIconUrl(champ.id)}
                        alt={champ.name}
                        loading="lazy"
                        className="h-6 w-6 rounded-full border border-zinc-700 object-cover"
                      />
                      <span className="font-medium">{champ.name}</span>
                    </div>
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-400">
                      {champ.lanes[0]}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Línea de Tiempo (Keyframes) */}
      <div className="flex items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 px-4 py-2.5 backdrop-blur-md">
        <button
          onClick={togglePlay}
          disabled={keyframes.length < 2}
          className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="flex items-center">
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </span>
          <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
        </button>

        <div className="flex flex-1 items-center gap-2 overflow-x-auto py-0.5">
          {keyframes.map((kf, idx) => (
            <div
              key={kf.id}
              onClick={() => selectKeyframe(idx)}
              onDoubleClick={() => {
                setEditingKfIdx(idx);
                setEditingKfLabel(kf.label);
              }}
              className={`group flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                idx === activeIndex
                  ? 'border-violet-500/80 bg-violet-600/20 text-violet-200'
                  : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
              title="Doble clic para renombrar este paso"
            >
              {editingKfIdx === idx ? (
                <input
                  autoFocus
                  value={editingKfLabel}
                  onChange={(e) => setEditingKfLabel(e.target.value)}
                  onBlur={() => saveKeyframeLabel(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveKeyframeLabel(idx);
                    if (e.key === 'Escape') setEditingKfIdx(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-28 rounded bg-zinc-950 px-1.5 py-0.5 text-xs text-zinc-100 outline-none ring-1 ring-violet-500"
                />
              ) : (
                <span>{kf.label}</span>
              )}

              {keyframes.length > 1 && editingKfIdx !== idx && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteKeyframe(idx);
                  }}
                  className="text-zinc-500 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}

          <button
            onClick={addKeyframe}
            className="flex items-center gap-1 rounded-xl border border-dashed border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-violet-500 hover:text-violet-300"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Agregar Paso</span>
          </button>
        </div>
      </div>
    </div>
  );
}