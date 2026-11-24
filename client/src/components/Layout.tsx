import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Map,
  Swords,
  Video,
  BarChart3,
  Users,
  Shield,
  Palette,
  Radio,
  Sparkles,
} from 'lucide-react';

type ThemeId = 'hextech' | 'worlds' | 'titanium';

const THEMES: Array<{ id: ThemeId; name: string; dot: string; ring: string }> = [
  { id: 'hextech', name: 'Hextech', dot: '#f59e0b', ring: 'rgba(245,158,11,0.55)' },
  { id: 'worlds', name: 'Worlds', dot: '#0ea5e9', ring: 'rgba(14,165,233,0.55)' },
  { id: 'titanium', name: 'Titanium', dot: '#f8fafc', ring: 'rgba(248,250,252,0.5)' },
];

const NAV_ITEMS = [
  { to: '/', label: 'Pizarra Táctica', sub: 'Playbook & Rotaciones', icon: Map, end: true },
  { to: '/draft', label: 'Draft Fearless', sub: 'Meta Asia · Bo3 / Bo5', icon: Swords },
  { to: '/vods', label: 'Sala VOD', sub: 'Análisis Competitivo', icon: Video },
  { to: '/scrims', label: 'Scrims & Scouting', sub: 'Macro & Rivales', icon: BarChart3 },
  { to: '/roster', label: 'Plantilla & Pool', sub: 'Titulares & Tiers', icon: Users },
];

const format24h = () =>
  new Date().toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

export default function Layout() {
  const [theme, setTheme] = useState<ThemeId>(() => {
    const saved = localStorage.getItem('wr_hub_theme') as ThemeId | null;
    return saved && ['hextech', 'worlds', 'titanium'].includes(saved) ? saved : 'hextech';
  });

  const [clock, setClock] = useState(format24h);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wr_hub_theme', theme);
  }, [theme]);

  useEffect(() => {
    const interval = setInterval(() => setClock(format24h()), 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      translate="no"
      className="notranslate flex h-screen w-screen overflow-hidden text-slate-100"
    >
      {/* Sidebar Glass Pro */}
      <aside
        className="relative flex w-64 shrink-0 flex-col justify-between border-r p-4 backdrop-blur-2xl"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-surface) 84%, transparent)',
          borderColor: 'var(--border-subtle)',
          boxShadow: 'inset -1px 0 0 0 var(--border-highlight)',
        }}
      >
        <div>
          {/* Branding */}
          <div className="mb-6 flex items-center justify-between gap-2 px-0.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-lg"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  borderColor: 'var(--border-accent)',
                  color: 'var(--accent-text)',
                  boxShadow: '0 0 24px -6px var(--border-accent)',
                }}
              >
                <Shield className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-[13px] font-extrabold tracking-tight text-white">
                  WR ESPORTS
                </h1>
                <p
                  className="flex items-center gap-1 whitespace-nowrap text-[9px] font-bold uppercase tracking-widest"
                  style={{ color: 'var(--accent-text)' }}
                >
                  <Sparkles className="h-2.5 w-2.5 shrink-0" />
                  <span>COACHING OS</span>
                </p>
              </div>
            </div>

            <span className="shrink-0 whitespace-nowrap rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[10px] font-bold text-slate-300">
              {clock}
            </span>
          </div>

          {/* Navegación */}
          <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Módulos
          </div>
          <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all ${
                      isActive
                        ? 'shadow-lg'
                        : 'border-transparent text-slate-400 hover:border-white/[0.06] hover:bg-white/[0.03] hover:text-slate-100'
                    }`
                  }
                  style={({ isActive }) =>
                    isActive
                      ? {
                          backgroundColor: 'var(--accent-soft)',
                          borderColor: 'var(--border-accent)',
                          color: '#ffffff',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
                        }
                      : undefined
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span
                          className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full"
                          style={{
                            backgroundColor: 'var(--accent-primary)',
                            boxShadow: '0 0 12px var(--accent-primary)',
                          }}
                        />
                      )}
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                          isActive
                            ? 'bg-white/[0.09]'
                            : 'bg-white/[0.03] group-hover:bg-white/[0.06]'
                        }`}
                      >
                        <Icon
                          className="h-4 w-4 transition"
                          style={{
                            color: isActive ? 'var(--accent-text)' : undefined,
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold leading-tight">
                          {item.label}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-500">
                          {item.sub}
                        </p>
                      </div>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer: Selector de Temas + Estado en Vivo */}
        <div className="space-y-2.5">
          <div
            className="rounded-xl border p-2.5"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--bg-base) 74%, transparent)',
              borderColor: 'var(--border-subtle)',
              boxShadow: 'inset 0 1px 0 var(--border-highlight)',
            }}
          >
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <Palette className="h-3 w-3" style={{ color: 'var(--accent-text)' }} />
              <span>Estilo Visual</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {THEMES.map((t) => {
                const active = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex items-center justify-center gap-1 rounded-lg border py-1.5 text-[10px] font-semibold transition ${
                      active
                        ? 'text-white'
                        : 'border-transparent bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-slate-200'
                    }`}
                    style={
                      active
                        ? {
                            borderColor: t.ring,
                            backgroundColor: 'rgba(255,255,255,0.08)',
                          }
                        : undefined
                    }
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: t.dot }}
                    />
                    <span>{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--bg-base) 74%, transparent)',
              borderColor: 'var(--border-subtle)',
              boxShadow: 'inset 0 1px 0 var(--border-highlight)',
            }}
          >
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-100">Modo Coach Activo</p>
              <p className="flex items-center gap-1 truncate text-[10px] text-slate-400">
                <Radio className="h-2.5 w-2.5 shrink-0 text-emerald-400" />
                <span>Sala sincronizada en vivo</span>
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Área Principal */}
      <main className="min-w-0 flex-1 overflow-hidden p-4">
        <Outlet />
      </main>
    </div>
  );
}