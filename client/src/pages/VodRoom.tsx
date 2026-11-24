import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line, Arrow } from 'react-konva';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Pencil,
  ArrowUpRight,
  Trash2,
  Plus,
  Clock,
  X,
  Search,
  RefreshCw,
  LayoutGrid,
  Tv,
  Calendar,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Upload,
  Link as LinkIcon,
  Keyboard,
  Loader2,
} from 'lucide-react';
import { socket } from '../lib/socket';
import { api, API_URL } from '../services/api';

type NoteTag = 'Macro' | 'Teamfight' | 'Error' | 'Buena';

interface VodNote {
  id: string;
  videoId?: string;
  time: number;
  tag: NoteTag;
  text: string;
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

interface ChannelVideo {
  videoId: string;
  title: string;
  published: string;
  channelName: string;
  thumbnail: string;
  url: string;
  isLocal?: boolean;
  localUrl?: string;
}

const ROOM_ID = 'room:vod:main';

const TAG_STYLES: Record<NoteTag, string> = {
  Macro: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  Teamfight: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  Error: 'bg-red-500/15 text-red-300 border-red-500/30',
  Buena: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

const VALID_TAGS: NoteTag[] = ['Macro', 'Teamfight', 'Error', 'Buena'];

const FILTER_CHIPS = [
  { label: 'Todos', query: '' },
  { label: 'Grand Finals', query: 'Grand Finals' },
  { label: 'Semifinals', query: 'Semifinals' },
  { label: 'Grupos', query: 'Group' },
  { label: 'Highlights', query: 'Highlights' },
  { label: 'Korea', query: 'KOREA' },
  { label: 'China', query: 'CHINA' },
];

const formatTime = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const normalizeNote = (raw: any): VodNote => ({
  id: String(raw.id),
  videoId: raw.videoId ? String(raw.videoId) : undefined,
  time: Number(raw.time) || 0,
  tag: (VALID_TAGS.includes(raw.tag) ? raw.tag : 'Macro') as NoteTag,
  text: raw.text || '',
});

const extractYouTubeId = (url: string): string | null => {
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const regex of patterns) {
    const match = trimmed.match(regex);
    if (match?.[1]) return match[1];
  }
  return null;
};

const getVideoBadge = (title: string): { text: string; style: string } | null => {
  const upper = title.toUpperCase();
  if (upper.includes('GRAND FINALS')) {
    return { text: 'GRAND FINALS', style: 'bg-violet-600/90 text-white' };
  }
  if (upper.includes('SEMIFINALS')) {
    return { text: 'SEMIFINALS', style: 'bg-blue-600/90 text-white' };
  }
  if (upper.includes('HIGHLIGHTS')) {
    return { text: 'HIGHLIGHTS', style: 'bg-amber-500/90 text-zinc-950' };
  }
  if (upper.includes('GROUP')) {
    return { text: 'FASE DE GRUPOS', style: 'bg-zinc-800/90 text-zinc-200' };
  }
  return null;
};

export default function VodRoom() {
  // Catálogo del canal competitivo asiático
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [channelName, setChannelName] = useState('Wild Rift Outplay - WRE VODs & Highlights');
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [feedSearch, setFeedSearch] = useState('');
  const [showCatalog, setShowCatalog] = useState(true);

  // Carga rápida de scrim propia (YouTube URL o MP4 local)
  const [customUrl, setCustomUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Video activo + Modo Cine
  const [activeVideo, setActiveVideo] = useState<ChannelVideo | null>(null);
  const [cinemaMode, setCinemaMode] = useState(false);

  // Estado del reproductor
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Telestrator (dibujo encima del video)
  const [drawMode, setDrawMode] = useState<'off' | 'draw' | 'arrow'>('off');
  const [drawColor, setDrawColor] = useState('#facc15');
  const [lines, setLines] = useState<DrawLine[]>([]);
  const [arrows, setArrows] = useState<TacticalArrow[]>([]);
  const isDrawing = useRef(false);

  // Marcadores por timestamp (persistidos en Supabase)
  const [notes, setNotes] = useState<VodNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteTag, setNoteTag] = useState<NoteTag>('Macro');
  const [copiedNotes, setCopiedNotes] = useState(false);

  const ytMountRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const stageWrapperRef = useRef<HTMLDivElement | null>(null);
  const [overlaySize, setOverlaySize] = useState({ width: 800, height: 450 });

  // Cargar catálogo asiático desde backend
  const fetchAsianFeed = async (forceRefresh = false) => {
    setLoadingFeed(true);
    try {
      const res = await fetch(
        `${API_URL}/api/vod/asian-feed${forceRefresh ? '?refresh=true' : ''}`
      );
      const data = await res.json();
      if (Array.isArray(data.videos)) setVideos(data.videos);
      if (data.channelName) setChannelName(data.channelName);
    } catch (err) {
      console.error('Error cargando catálogo asiático:', err);
    } finally {
      setLoadingFeed(false);
    }
  };

  useEffect(() => {
    fetchAsianFeed();
  }, []);

  // Cargar notas desde Supabase cuando cambia el video activo
  useEffect(() => {
    if (!activeVideo) {
      setNotes([]);
      return;
    }

    let active = true;
    const loadNotes = async () => {
      setLoadingNotes(true);
      setNotesError(null);
      try {
        const allNotes = await api.vods.getAll();
        if (!active) return;
        const filtered = (Array.isArray(allNotes) ? allNotes : [])
          .map(normalizeNote)
          .filter((n) => n.videoId === activeVideo.videoId)
          .sort((a, b) => a.time - b.time);
        setNotes(filtered);
      } catch (err: any) {
        if (!active) return;
        setNotesError(err?.message || 'No se pudieron cargar los marcadores.');
      } finally {
        if (active) setLoadingNotes(false);
      }
    };

    loadNotes();
    return () => {
      active = false;
    };
  }, [activeVideo?.videoId]);

  // Ajustar tamaño del canvas Telestrator
  useEffect(() => {
    const el = stageWrapperRef.current;
    if (!el) return;
    const update = () => {
      setOverlaySize({ width: el.clientWidth, height: el.clientHeight });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeVideo, showCatalog, cinemaMode]);

  // Inicializar YouTube aislado del DOM de React
  useEffect(() => {
    if (!activeVideo || activeVideo.isLocal || showCatalog || !ytMountRef.current) return;

    const mountNode = ytMountRef.current;

    const initPlayer = () => {
      if (ytPlayerRef.current?.destroy) {
        try {
          ytPlayerRef.current.destroy();
        } catch {}
        ytPlayerRef.current = null;
      }

      mountNode.innerHTML = '';
      const playerDiv = document.createElement('div');
      playerDiv.style.width = '100%';
      playerDiv.style.height = '100%';
      mountNode.appendChild(playerDiv);

      ytPlayerRef.current = new (window as any).YT.Player(playerDiv, {
        videoId: activeVideo.videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          rel: 0,
          modestbranding: 1,
          controls: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (e: any) => {
            setDuration(e.target.getDuration() || 0);
          },
          onStateChange: (e: any) => {
            const YTState = (window as any).YT?.PlayerState;
            if (!YTState) return;
            if (e.data === YTState.PLAYING) setIsPlaying(true);
            if (e.data === YTState.PAUSED || e.data === YTState.ENDED) {
              setIsPlaying(false);
            }
          },
        },
      });
    };

    if ((window as any).YT && (window as any).YT.Player) {
      initPlayer();
    } else {
      const existing = document.getElementById('yt-iframe-api');
      if (!existing) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }
      (window as any).onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (ytPlayerRef.current?.destroy) {
        try {
          ytPlayerRef.current.destroy();
        } catch {}
        ytPlayerRef.current = null;
      }
      if (mountNode) mountNode.innerHTML = '';
    };
  }, [activeVideo?.videoId, activeVideo?.isLocal, showCatalog]);

  // Reloj del reproductor
  useEffect(() => {
    const timer = setInterval(() => {
      if (activeVideo && !activeVideo.isLocal && ytPlayerRef.current?.getCurrentTime) {
        const t = ytPlayerRef.current.getCurrentTime();
        if (typeof t === 'number' && !Number.isNaN(t)) setCurrentTime(t);
        const d = ytPlayerRef.current.getDuration?.();
        if (typeof d === 'number' && d > 0) setDuration(d);
      } else if (activeVideo?.isLocal && localVideoRef.current) {
        setCurrentTime(localVideoRef.current.currentTime || 0);
        setDuration(localVideoRef.current.duration || 0);
      }
    }, 350);
    return () => clearInterval(timer);
  }, [activeVideo]);

  // Sincronización Socket.io
  useEffect(() => {
    socket.emit('room:join', ROOM_ID);

    socket.on('vod:sync', (payload: any) => {
      if (payload.type === 'select_video' && payload.video) {
        setActiveVideo(payload.video);
        setShowCatalog(false);
        setLines([]);
        setArrows([]);
        setCurrentTime(0);
      } else if (payload.type === 'play') {
        seekLocal(payload.time);
        playLocal();
      } else if (payload.type === 'pause') {
        seekLocal(payload.time);
        pauseLocal();
      } else if (payload.type === 'seek') {
        seekLocal(payload.time);
      } else if (payload.type === 'rate') {
        applyRateLocal(payload.rate);
      } else if (payload.type === 'notes') {
        setNotes(Array.isArray(payload.notes) ? payload.notes.map(normalizeNote) : []);
      } else if (payload.type === 'draw') {
        setLines(payload.lines);
        setArrows(payload.arrows);
      }
    });

    return () => {
      socket.off('vod:sync');
    };
  }, []);

  const emitVod = (payload: any) => {
    socket.emit('vod:update', { roomId: ROOM_ID, payload });
  };

  const playLocal = () => {
    if (ytPlayerRef.current?.playVideo) ytPlayerRef.current.playVideo();
    if (localVideoRef.current) localVideoRef.current.play();
    setIsPlaying(true);
  };

  const pauseLocal = () => {
    if (ytPlayerRef.current?.pauseVideo) ytPlayerRef.current.pauseVideo();
    if (localVideoRef.current) localVideoRef.current.pause();
    setIsPlaying(false);
  };

  const seekLocal = (time: number) => {
    const safe = Math.max(0, time);
    if (ytPlayerRef.current?.seekTo) ytPlayerRef.current.seekTo(safe, true);
    if (localVideoRef.current) localVideoRef.current.currentTime = safe;
    setCurrentTime(safe);
  };

  const applyRateLocal = (rate: number) => {
    setPlaybackRate(rate);
    if (ytPlayerRef.current?.setPlaybackRate) {
      ytPlayerRef.current.setPlaybackRate(rate);
    }
    if (localVideoRef.current) {
      localVideoRef.current.playbackRate = rate;
    }
  };

  const handleSelectVideo = (video: ChannelVideo) => {
    setActiveVideo(video);
    setShowCatalog(false);
    setLines([]);
    setArrows([]);
    setCurrentTime(0);
    setIsPlaying(false);
    if (!video.isLocal) {
      emitVod({ type: 'select_video', video });
    }
  };

  const handleLoadCustomYouTube = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractYouTubeId(customUrl);
    if (!id) return;
    const customVid: ChannelVideo = {
      videoId: id,
      title: `VOD Personalizado (${id})`,
      published: new Date().toISOString().slice(0, 10),
      channelName: 'Scrim / Enlace Externo',
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${id}`,
    };
    setCustomUrl('');
    handleSelectVideo(customVid);
  };

  const handleLoadLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const localVid: ChannelVideo = {
      videoId: `local-${file.name}`,
      title: file.name,
      published: new Date().toISOString().slice(0, 10),
      channelName: 'Grabación Local (.mp4)',
      thumbnail: '',
      url: '',
      isLocal: true,
      localUrl: objectUrl,
    };
    handleSelectVideo(localVid);
  };

  const togglePlaySync = () => {
    if (isPlaying) {
      pauseLocal();
      emitVod({ type: 'pause', time: currentTime });
    } else {
      playLocal();
      emitVod({ type: 'play', time: currentTime });
    }
  };

  const jumpSeconds = (delta: number) => {
    const nextTime = Math.max(0, currentTime + delta);
    seekLocal(nextTime);
    emitVod({ type: 'seek', time: nextTime });
  };

  const handleRateChange = (rate: number) => {
    applyRateLocal(rate);
    emitVod({ type: 'rate', rate });
  };

  // Atajos de teclado globales cuando se está viendo un VOD
  useEffect(() => {
    if (showCatalog || !activeVideo) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlaySync();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        jumpSeconds(-5);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        jumpSeconds(5);
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setCinemaMode((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCatalog, activeVideo, isPlaying, currentTime]);

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = noteText.trim();
    if (!trimmed || !activeVideo) return;

    setSavingNote(true);
    setNotesError(null);

    const payload = {
      videoId: activeVideo.videoId,
      time: Math.floor(currentTime),
      tag: noteTag,
      text: trimmed,
    };

    try {
      const created = await api.vods.create(payload);
      const savedNote = normalizeNote(created);
      const nextNotes = [...notes, savedNote].sort((a, b) => a.time - b.time);
      setNotes(nextNotes);
      setNoteText('');
      emitVod({ type: 'notes', notes: nextNotes });
    } catch (err: any) {
      setNotesError(err?.message || 'No se pudo guardar el marcador.');
    } finally {
      setSavingNote(false);
    }
  };

  const deleteNote = async (id: string) => {
    const previous = notes;
    const nextNotes = notes.filter((n) => n.id !== id);
    setNotes(nextNotes);
    emitVod({ type: 'notes', notes: nextNotes });

    try {
      await api.vods.delete(id);
    } catch (err: any) {
      setNotes(previous);
      emitVod({ type: 'notes', notes: previous });
      setNotesError(err?.message || 'No se pudo eliminar el marcador.');
    }
  };

  const jumpToNote = (time: number) => {
    seekLocal(time);
    emitVod({ type: 'seek', time });
  };

  const copyNotesToDiscord = async () => {
    if (!activeVideo || notes.length === 0) return;
    const header = `🎬 **VOD REVIEW — ${activeVideo.title}**`;
    const body = notes.map(
      (n) => `• \`${formatTime(n.time)}\` **[${n.tag}]** ${n.text}`
    );
    const footer = activeVideo.url ? `\n🔗 ${activeVideo.url}` : '';
    try {
      await navigator.clipboard.writeText([header, '', ...body, footer].join('\n'));
      setCopiedNotes(true);
      setTimeout(() => setCopiedNotes(false), 2000);
    } catch {}
  };

  const handleMouseDown = (e: any) => {
    if (drawMode === 'off') return;
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    isDrawing.current = true;

    if (drawMode === 'draw') {
      setLines((prev) => [...prev, { points: [pos.x, pos.y], color: drawColor }]);
    } else if (drawMode === 'arrow') {
      setArrows((prev) => [
        ...prev,
        { id: `arr-${Date.now()}`, points: [pos.x, pos.y, pos.x, pos.y], color: drawColor },
      ]);
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current || drawMode === 'off') return;
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;

    if (drawMode === 'draw') {
      setLines((prev) => {
        const copy = [...prev];
        const last = { ...copy[copy.length - 1] };
        last.points = last.points.concat([pos.x, pos.y]);
        copy[copy.length - 1] = last;
        return copy;
      });
    } else if (drawMode === 'arrow') {
      setArrows((prev) => {
        const copy = [...prev];
        const last = { ...copy[copy.length - 1] };
        last.points = [last.points[0], last.points[1], pos.x, pos.y];
        copy[copy.length - 1] = last;
        return copy;
      });
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    emitVod({ type: 'draw', lines, arrows });
  };

  const clearDrawings = () => {
    setLines([]);
    setArrows([]);
    emitVod({ type: 'draw', lines: [], arrows: [] });
  };

  const filteredVideos = videos.filter((v) =>
    v.title.toLowerCase().includes(feedSearch.toLowerCase())
  );

  return (
    <div translate="no" className="notranslate flex h-full flex-col gap-3 overflow-hidden">
      {/* Barra Superior */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 ring-1 ring-violet-500/30">
            <Tv className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-zinc-100">
              Sala VOD Pro — {channelName}
            </h2>
            <p className="truncate text-[11px] text-zinc-400">
              {activeVideo && !showCatalog
                ? activeVideo.title
                : `${videos.length} partidas asiáticas + marcadores en Supabase`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!showCatalog && activeVideo && (
            <button
              onClick={() => setCinemaMode(!cinemaMode)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                cinemaMode
                  ? 'bg-violet-600 text-white'
                  : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
              }`}
              title="Alternar Modo Cine (Tecla C)"
            >
              {cinemaMode ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
              <span>{cinemaMode ? 'Salir Cine' : 'Modo Cine'}</span>
            </button>
          )}

          {activeVideo && (
            <button
              onClick={() => setShowCatalog(!showCatalog)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                showCatalog
                  ? 'bg-violet-600 text-white hover:bg-violet-500'
                  : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>{showCatalog ? 'Volver al Video' : 'Ver Catálogo'}</span>
            </button>
          )}

          <button
            onClick={() => fetchAsianFeed(true)}
            disabled={loadingFeed}
            className="flex items-center gap-1.5 rounded-xl bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
            title="Actualizar últimos videos del canal"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-violet-400 ${loadingFeed ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* VISTA 1: CATÁLOGO ESTILO YOUTUBE + CARGA DE SCRIMS PROPIAS */}
      {showCatalog ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          {/* Fila de Carga Rápida (Enlace libre de YouTube o MP4 local) */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-2.5">
            <form onSubmit={handleLoadCustomYouTube} className="flex min-w-[240px] flex-1 items-center gap-2">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="Pega cualquier enlace de YouTube de tu scrim..."
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-1.5 pl-8 pr-3 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500"
                />
              </div>
              <button
                type="submit"
                disabled={!customUrl.trim()}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
              >
                <span>Abrir Enlace</span>
              </button>
            </form>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleLoadLocalFile}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
            >
              <Upload className="h-3.5 w-3.5 text-violet-400" />
              <span>Subir Video Local (.mp4)</span>
            </button>
          </div>

          {/* Buscador + Chips del Catálogo Asiático */}
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800/80 pb-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={feedSearch}
                onChange={(e) => setFeedSearch(e.target.value)}
                placeholder="Filtrar partidas asiáticas (ej: Korea, China, Game 1)..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 py-2 pl-9 pr-8 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500"
              />
              {feedSearch && (
                <button
                  onClick={() => setFeedSearch('')}
                  className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {FILTER_CHIPS.map((chip) => {
                const isActive =
                  feedSearch.toLowerCase() === chip.query.toLowerCase();
                return (
                  <button
                    key={chip.label}
                    onClick={() => setFeedSearch(chip.query)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      isActive
                        ? 'bg-zinc-100 font-semibold text-zinc-950'
                        : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid de Videos */}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {loadingFeed ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="animate-pulse space-y-2.5">
                    <div className="aspect-video w-full rounded-xl bg-zinc-900" />
                    <div className="h-4 w-5/6 rounded bg-zinc-900" />
                    <div className="h-3 w-1/2 rounded bg-zinc-900" />
                  </div>
                ))}
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-xs text-zinc-500">
                No se encontraron partidas para "{feedSearch}".
              </div>
            ) : (
              <div className="grid content-start grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredVideos.map((vid) => {
                  const isCurrent = activeVideo?.videoId === vid.videoId;
                  const badge = getVideoBadge(vid.title);

                  return (
                    <button
                      key={vid.videoId}
                      onClick={() => handleSelectVideo(vid)}
                      className="group flex flex-col text-left transition focus:outline-none"
                    >
                      <div
                        style={{ aspectRatio: '16 / 9' }}
                        className={`relative w-full shrink-0 overflow-hidden rounded-xl bg-zinc-900 ring-1 transition ${
                          isCurrent
                            ? 'ring-2 ring-violet-500'
                            : 'ring-zinc-800 group-hover:ring-violet-500/60'
                        }`}
                      >
                        <img
                          src={`https://i.ytimg.com/vi/${vid.videoId}/hqdefault.jpg`}
                          alt={vid.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/80 to-transparent" />

                        {badge && (
                          <span
                            className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide shadow ${badge.style}`}
                          >
                            {badge.text}
                          </span>
                        )}

                        {vid.published && (
                          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-200 backdrop-blur-sm">
                            <Calendar className="h-2.5 w-2.5 text-zinc-400" />
                            {vid.published}
                          </span>
                        )}

                        <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition duration-200 group-hover:opacity-100">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-600/95 text-white shadow-xl transition group-hover:scale-110">
                            <Play className="ml-0.5 h-5 w-5 fill-current" />
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-start gap-2.5 px-0.5">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-violet-400 ring-1 ring-zinc-800">
                          WRE
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-zinc-100 transition group-hover:text-violet-300">
                            {vid.title}
                          </h3>
                          <p className="mt-1 truncate text-[11px] text-zinc-400">
                            {vid.channelName}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VISTA 2: REPRODUCTOR SINCRONIZADO + TELESTRATOR + MARCADORES */
        <div
          className={`grid min-h-0 flex-1 gap-3 overflow-hidden ${
            cinemaMode ? 'grid-cols-1' : 'grid-cols-[1fr_310px]'
          }`}
        >
          <div className="flex min-h-0 flex-col gap-2.5">
            <div
              ref={stageWrapperRef}
              className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-zinc-800 bg-black"
            >
              {/* Contenedor YouTube aislado */}
              <div
                ref={ytMountRef}
                className={`h-full w-full ${activeVideo && !activeVideo.isLocal ? 'block' : 'hidden'}`}
              />

              {/* Reproductor local (.mp4) */}
              {activeVideo?.isLocal && activeVideo.localUrl && (
                <video
                  ref={localVideoRef}
                  src={activeVideo.localUrl}
                  controls
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="h-full w-full object-contain"
                />
              )}

              {/* Capa Telestrator */}
              {activeVideo && (
                <div
                  className={`absolute inset-0 z-20 ${
                    drawMode === 'off' ? 'pointer-events-none' : 'cursor-crosshair'
                  }`}
                >
                  <Stage
                    width={overlaySize.width}
                    height={overlaySize.height}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                  >
                    <Layer>
                      {lines.map((line, i) => (
                        <Line
                          key={i}
                          points={line.points}
                          stroke={line.color}
                          strokeWidth={3.5}
                          tension={0.4}
                          lineCap="round"
                          lineJoin="round"
                        />
                      ))}
                      {arrows.map((arrow) => (
                        <Arrow
                          key={arrow.id}
                          points={arrow.points}
                          stroke={arrow.color}
                          fill={arrow.color}
                          strokeWidth={3.5}
                          pointerLength={12}
                          pointerWidth={12}
                          lineCap="round"
                        />
                      ))}
                    </Layer>
                  </Stage>
                </div>
              )}
            </div>

            {/* Controles Sincronizados + Atajos */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => jumpSeconds(-5)}
                  className="rounded-lg bg-zinc-800 p-1.5 text-zinc-300 hover:bg-zinc-700"
                  title="Retroceder 5s (←)"
                >
                  <SkipBack className="h-3.5 w-3.5" />
                </button>

                <button
                  onClick={togglePlaySync}
                  className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-500"
                  title="Pausar / Reproducir (Espacio)"
                >
                  <span className="flex items-center">
                    {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </span>
                  <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
                </button>

                <button
                  onClick={() => jumpSeconds(5)}
                  className="rounded-lg bg-zinc-800 p-1.5 text-zinc-300 hover:bg-zinc-700"
                  title="Adelantar 5s (→)"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                </button>

                <span className="ml-2 font-mono text-xs text-zinc-300">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>

                <div className="ml-2 flex gap-1">
                  {[0.5, 1, 1.5].map((r) => (
                    <button
                      key={r}
                      onClick={() => handleRateChange(r)}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
                        playbackRate === r
                          ? 'bg-violet-600/30 text-violet-300 ring-1 ring-violet-500/40'
                          : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span>{r}x</span>
                    </button>
                  ))}
                </div>

                <span className="ml-3 hidden items-center gap-1 text-[10px] text-zinc-500 xl:flex">
                  <Keyboard className="h-3 w-3" />
                  Espacio: Play · ←/→: 5s · C: Cine
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setDrawMode(drawMode === 'arrow' ? 'off' : 'arrow')}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                    drawMode === 'arrow'
                      ? 'bg-violet-600 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>Flecha</span>
                </button>

                <button
                  onClick={() => setDrawMode(drawMode === 'draw' ? 'off' : 'draw')}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                    drawMode === 'draw'
                      ? 'bg-violet-600 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Lápiz</span>
                </button>

                {['#facc15', '#f87171', '#38bdf8', '#a78bfa'].map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setDrawColor(c);
                      if (drawMode === 'off') setDrawMode('draw');
                    }}
                    className={`h-4 w-4 rounded-full border-2 transition ${
                      drawColor === c ? 'scale-110 border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}

                <button
                  onClick={clearDrawings}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
                  title="Borrar dibujos del video"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Marcadores (oculta en Modo Cine) */}
          {!cinemaMode && (
            <div className="flex min-h-0 flex-col rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3.5">
              <div className="mb-3 flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-violet-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                    Marcadores ({notes.length})
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-violet-400">
                    {formatTime(currentTime)}
                  </span>
                  <button
                    onClick={copyNotesToDiscord}
                    disabled={notes.length === 0}
                    className="flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
                    title="Copiar marcadores formateados para Discord"
                  >
                    {copiedNotes ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3 text-violet-400" />
                    )}
                    <span>{copiedNotes ? 'Copiado' : 'Discord'}</span>
                  </button>
                </div>
              </div>

              {notesError && (
                <div className="mb-2 flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300">
                  <span className="truncate">{notesError}</span>
                  <button
                    onClick={() => setNotesError(null)}
                    className="ml-1 shrink-0 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              <form onSubmit={addNote} className="mb-3 space-y-2">
                <div className="grid grid-cols-4 gap-1">
                  {(['Macro', 'Teamfight', 'Error', 'Buena'] as NoteTag[]).map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => setNoteTag(tag)}
                      className={`rounded-md border py-1 text-[10px] font-semibold transition ${
                        noteTag === tag
                          ? TAG_STYLES[tag]
                          : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <span>{tag}</span>
                    </button>
                  ))}
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Ej: Setup de Dragón de China..."
                    className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500"
                  />
                  <button
                    type="submit"
                    disabled={savingNote || !noteText.trim()}
                    className="flex items-center justify-center rounded-lg bg-violet-600 px-2.5 text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    {savingNote ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </form>

              <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {loadingNotes ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-xs text-zinc-500">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                    <span>Cargando marcadores...</span>
                  </div>
                ) : notes.length === 0 ? (
                  <p className="py-8 text-center text-xs text-zinc-500">
                    Marca jugadas clave de la partida para saltar directo a ese segundo y exportarlas a Discord.
                  </p>
                ) : (
                  notes.map((note) => (
                    <div
                      key={note.id}
                      onClick={() => jumpToNote(note.time)}
                      className="group cursor-pointer rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-2.5 transition hover:border-violet-500/40 hover:bg-zinc-900"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-violet-600/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-violet-300">
                            {formatTime(note.time)}
                          </span>
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${TAG_STYLES[note.tag]}`}
                          >
                            {note.tag}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNote(note.id);
                          }}
                          className="text-zinc-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-zinc-200">{note.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}