import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

interface ChannelVideo {
  videoId: string;
  title: string;
  published: string;
  channelName: string;
  thumbnail: string;
  url: string;
}

interface MetaTierEntry {
  tier: 'S+' | 'S' | 'A' | 'B';
  winRate?: number;
  pickRate?: number;
  banRate?: number;
}

const DEFAULT_CHANNEL_SEED_URL = 'https://www.youtube.com/watch?v=5esub1RTxqw';

const FALLBACK_ASIAN_VODS: ChannelVideo[] = [
  {
    videoId: '5esub1RTxqw',
    title: 'KOREA vs. CHINA • History Maker! | Highlights - Grand Finals | Wild Rounds: SMASH 2026',
    published: '2026-11-23',
    channelName: 'Wild Rift Outplay - WRE VODs & Highlights',
    thumbnail: 'https://i.ytimg.com/vi/5esub1RTxqw/hqdefault.jpg',
    url: 'https://www.youtube.com/watch?v=5esub1RTxqw',
  },
  {
    videoId: 'ri_Lu7uAtI0',
    title: 'KOREA vs. CHINA • Game 1 (Bo3) | Grand Finals | Wild Rounds: SMASH 2026',
    published: '2026-11-22',
    channelName: 'Wild Rift Outplay - WRE VODs & Highlights',
    thumbnail: 'https://i.ytimg.com/vi/ri_Lu7uAtI0/hqdefault.jpg',
    url: 'https://www.youtube.com/watch?v=ri_Lu7uAtI0',
  },
  {
    videoId: '4a_F2FlRpXs',
    title: 'KOREA vs. CHINA (Bo1) | Group A | Wild Rounds: SMASH 2026',
    published: '2026-11-21',
    channelName: 'Wild Rift Outplay - WRE VODs & Highlights',
    thumbnail: 'https://i.ytimg.com/vi/4a_F2FlRpXs/hqdefault.jpg',
    url: 'https://www.youtube.com/watch?v=4a_F2FlRpXs',
  },
  {
    videoId: 'vmtoTE-NHwo',
    title: 'FP vs. TT • Dream Finals, Unreal Comeback! | Highlights - Grand Finals | WSL Fall 2026',
    published: '2026-11-20',
    channelName: 'Wild Rift Outplay - WRE VODs & Highlights',
    thumbnail: 'https://i.ytimg.com/vi/vmtoTE-NHwo/hqdefault.jpg',
    url: 'https://www.youtube.com/watch?v=vmtoTE-NHwo',
  },
  {
    videoId: '2_bPKmMktBM',
    title: 'FP vs. TT • Game 1 (Bo5) | Grand Finals | WSL Fall 2026',
    published: '2026-11-19',
    channelName: 'Wild Rift Outplay - WRE VODs & Highlights',
    thumbnail: 'https://i.ytimg.com/vi/2_bPKmMktBM/hqdefault.jpg',
    url: 'https://www.youtube.com/watch?v=2_bPKmMktBM',
  },
  {
    videoId: 'aQnF2QkFF7o',
    title: 'TT vs. FP • The King Reclaims the Throne! | Highlights - Grand Finals | WSL Summer 2026',
    published: '2026-08-23',
    channelName: 'Wild Rift Outplay - WRE VODs & Highlights',
    thumbnail: 'https://i.ytimg.com/vi/aQnF2QkFF7o/hqdefault.jpg',
    url: 'https://www.youtube.com/watch?v=aQnF2QkFF7o',
  },
];

const FALLBACK_ASIAN_META: Record<string, MetaTierEntry> = {
  Ambessa: { tier: 'S+', winRate: 53.4, banRate: 41.2 },
  Aatrox: { tier: 'S+', winRate: 52.8, banRate: 28.5 },
  Camille: { tier: 'S+', winRate: 52.5, banRate: 24.1 },
  LeeSin: { tier: 'S+', winRate: 51.9, banRate: 35.4 },
  Viego: { tier: 'S+', winRate: 52.6, banRate: 31.8 },
  Kindred: { tier: 'S+', winRate: 53.1, banRate: 29.0 },
  Orianna: { tier: 'S+', winRate: 52.4, banRate: 22.3 },
  Syndra: { tier: 'S+', winRate: 52.7, banRate: 26.7 },
  Kaisa: { tier: 'S+', winRate: 53.0, banRate: 34.2 },
  Ezreal: { tier: 'S+', winRate: 51.8, banRate: 19.5 },
  Lulu: { tier: 'S+', winRate: 53.6, banRate: 42.0 },
  Yuumi: { tier: 'S+', winRate: 52.9, banRate: 48.5 },
  Poppy: { tier: 'S+', winRate: 53.2, banRate: 21.4 },
  Gwen: { tier: 'S', winRate: 51.6, banRate: 14.2 },
  Ornn: { tier: 'S', winRate: 51.9, banRate: 12.1 },
  Renekton: { tier: 'S', winRate: 51.2, banRate: 10.5 },
  Jax: { tier: 'S', winRate: 51.5, banRate: 13.0 },
  Volibear: { tier: 'S', winRate: 51.8, banRate: 15.2 },
  KSante: { tier: 'S', winRate: 50.9, banRate: 16.4 },
  JarvanIV: { tier: 'S', winRate: 51.7, banRate: 11.8 },
  Vi: { tier: 'S', winRate: 51.4, banRate: 14.6 },
  Lillia: { tier: 'S', winRate: 52.1, banRate: 17.5 },
  Wukong: { tier: 'S', winRate: 51.3, banRate: 9.8 },
  XinZhao: { tier: 'S', winRate: 51.5, banRate: 8.4 },
  Maokai: { tier: 'S', winRate: 52.0, banRate: 18.2 },
  Ahri: { tier: 'S', winRate: 51.6, banRate: 12.7 },
  Akali: { tier: 'S', winRate: 51.1, banRate: 19.3 },
  Akshan: { tier: 'S', winRate: 52.2, banRate: 15.0 },
  Corki: { tier: 'S', winRate: 51.4, banRate: 10.2 },
  Viktor: { tier: 'S', winRate: 51.7, banRate: 11.4 },
  Ziggs: { tier: 'S', winRate: 51.5, banRate: 9.2 },
  Xayah: { tier: 'S', winRate: 51.6, banRate: 11.5 },
  Varus: { tier: 'S', winRate: 51.3, banRate: 13.4 },
  Vayne: { tier: 'S', winRate: 51.8, banRate: 14.8 },
  Lucian: { tier: 'S', winRate: 51.2, banRate: 12.0 },
  Jinx: { tier: 'S', winRate: 51.9, banRate: 10.6 },
  Thresh: { tier: 'S', winRate: 51.5, banRate: 16.2 },
  Nautilus: { tier: 'S', winRate: 51.7, banRate: 14.1 },
  Rakan: { tier: 'S', winRate: 51.4, banRate: 11.9 },
  Karma: { tier: 'S', winRate: 51.6, banRate: 13.5 },
  Zyra: { tier: 'S', winRate: 51.9, banRate: 15.1 },
  Darius: { tier: 'A', winRate: 50.6, banRate: 7.5 },
  Mordekaiser: { tier: 'A', winRate: 50.8, banRate: 9.1 },
  Olaf: { tier: 'A', winRate: 50.7, banRate: 6.4 },
  Gragas: { tier: 'A', winRate: 50.5, banRate: 5.8 },
  Sett: { tier: 'A', winRate: 50.4, banRate: 5.2 },
  Galio: { tier: 'A', winRate: 50.9, banRate: 6.0 },
  Alistar: { tier: 'A', winRate: 50.6, banRate: 4.9 },
  Braum: { tier: 'A', winRate: 50.7, banRate: 4.5 },
  Sivir: { tier: 'A', winRate: 50.8, banRate: 5.1 },
  Caitlyn: { tier: 'A', winRate: 50.5, banRate: 8.2 },
};

let cachedChannelId: string | null = null;
let cachedVideos: ChannelVideo[] = [];
let lastFetchTime = 0;

let cachedMeta: Record<string, MetaTierEntry> | null = null;
let cachedMetaSource = 'WSL / SMASH Pro Meta';
let lastMetaFetch = 0;

const decodeXml = (text: string) =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

async function resolveChannelId(sourceUrl: string): Promise<string | null> {
  if (cachedChannelId && sourceUrl === DEFAULT_CHANNEL_SEED_URL) {
    return cachedChannelId;
  }
  const directMatch = sourceUrl.match(/(UC[a-zA-Z0-9_-]{22})/);
  if (directMatch) return directMatch[1];

  const res = await fetch(sourceUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    },
  });
  const html = await res.text();
  const match = html.match(/"(?:channelId|externalId)":"(UC[a-zA-Z0-9_-]{22})"/);
  if (match?.[1]) {
    if (sourceUrl === DEFAULT_CHANNEL_SEED_URL) {
      cachedChannelId = match[1];
    }
    return match[1];
  }
  return null;
}

function parseYouTubeRss(xml: string): ChannelVideo[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  const channelTitleMatch = xml.match(/<author>\s*<name>([\s\S]*?)<\/name>/);
  const defaultChannel = channelTitleMatch
    ? decodeXml(channelTitleMatch[1].trim())
    : 'Wild Rift Outplay - WRE VODs & Highlights';

  return entries
    .map((entry) => {
      const idMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
      const pubMatch = entry.match(/<published>([^<]+)<\/published>/);
      const videoId = idMatch?.[1]?.trim();
      if (!videoId) return null;

      return {
        videoId,
        title: titleMatch ? decodeXml(titleMatch[1].trim()) : 'VOD Competitivo',
        published: pubMatch ? pubMatch[1].slice(0, 10) : '',
        channelName: defaultChannel,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      };
    })
    .filter((v): v is ChannelVideo => v !== null);
}

const normalizeChampKey = (raw: string) =>
  raw.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

// ==========================================
// HEALTH & FEED COMPETITIVO
// ==========================================
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected', service: 'wr-esports-hub-api' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'disconnected', message: (err as Error).message });
  }
});

app.get('/api/vod/asian-feed', async (req, res) => {
  const refresh = req.query.refresh === 'true';
  const now = Date.now();

  if (!refresh && cachedVideos.length > 0 && now - lastFetchTime < 10 * 60 * 1000) {
    return res.json({
      channelName: cachedVideos[0].channelName,
      source: 'live-cache',
      videos: cachedVideos,
    });
  }

  try {
    const channelId = await resolveChannelId(DEFAULT_CHANNEL_SEED_URL);
    if (!channelId) throw new Error('No se pudo resolver el channelId');

    const rssRes = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    );
    if (!rssRes.ok) throw new Error(`RSS status ${rssRes.status}`);

    const xml = await rssRes.text();
    const parsed = parseYouTubeRss(xml);

    if (parsed.length > 0) {
      cachedVideos = parsed;
      lastFetchTime = now;
      return res.json({
        channelName: parsed[0].channelName,
        source: 'youtube-rss',
        videos: parsed,
      });
    }
  } catch (err) {
    console.warn('[VOD Feed] Usando respaldo local:', (err as Error).message);
  }

  return res.json({
    channelName: 'Wild Rift Outplay - WRE VODs & Highlights',
    source: 'fallback',
    videos: FALLBACK_ASIAN_VODS,
  });
});

app.get('/api/meta/asian-tiers', async (req, res) => {
  const refresh = req.query.refresh === 'true';
  const now = Date.now();

  if (!refresh && cachedMeta && now - lastMetaFetch < 30 * 60 * 1000) {
    return res.json({
      source: cachedMetaSource,
      updatedAt: new Date(lastMetaFetch).toISOString().slice(0, 10),
      tiers: cachedMeta,
    });
  }

  try {
    const [heroListRes, rankRes] = await Promise.all([
      fetch('https://game.gtimg.cn/images/lgamem/act/lrlib/js/heroList/hero_list.js'),
      fetch('https://mlol.qt.qq.com/go/lgame_battle_info/hero_rank_list_v2'),
    ]);

    if (!heroListRes.ok || !rankRes.ok) {
      throw new Error('API oficial CN no disponible');
    }

    const heroListJson: any = await heroListRes.json();
    const rankJson: any = await rankRes.json();

    const idToEng = new Map<string, string>();
    const heroMap = heroListJson?.heroList || {};
    Object.keys(heroMap).forEach((hid) => {
      const h = heroMap[hid];
      if (h?.alias) {
        idToEng.set(String(hid), normalizeChampKey(String(h.alias)));
      }
    });

    const tierBucket = rankJson?.data?.['4'] || rankJson?.data?.['3'] || rankJson?.data?.['2'];
    const liveTiers: Record<string, MetaTierEntry> = {};

    if (tierBucket && typeof tierBucket === 'object') {
      Object.values(tierBucket).forEach((laneList: any) => {
        if (!Array.isArray(laneList)) return;
        laneList.forEach((row: any) => {
          const engKey = idToEng.get(String(row.hero_id));
          if (!engKey) return;

          const wr = Number((Number(row.win_rate_percent || 0) * 100).toFixed(1));
          const pr = Number((Number(row.appear_rate_percent || 0) * 100).toFixed(1));
          const br = Number((Number(row.forbid_rate_percent || 0) * 100).toFixed(1));

          const score = wr + pr * 0.25 + br * 0.35;
          let tier: 'S+' | 'S' | 'A' | 'B' = 'B';
          if (score >= 62 || br >= 25) tier = 'S+';
          else if (score >= 56.5) tier = 'S';
          else if (score >= 52.5) tier = 'A';

          const prev = liveTiers[engKey];
          const rankOrder = { 'S+': 4, S: 3, A: 2, B: 1 };
          if (!prev || rankOrder[tier] > rankOrder[prev.tier]) {
            liveTiers[engKey] = { tier, winRate: wr, pickRate: pr, banRate: br };
          }
        });
      });
    }

    if (Object.keys(liveTiers).length > 30) {
      cachedMeta = liveTiers;
      cachedMetaSource = 'Wild Rift CN Oficial (Sovereign+)';
      lastMetaFetch = now;
      return res.json({
        source: cachedMetaSource,
        updatedAt: new Date(now).toISOString().slice(0, 10),
        tiers: liveTiers,
      });
    }
  } catch (err) {
    console.warn('[Asian Meta] Usando respaldo Pro Meta:', (err as Error).message);
  }

  const normalizedFallback: Record<string, MetaTierEntry> = {};
  Object.entries(FALLBACK_ASIAN_META).forEach(([k, v]) => {
    normalizedFallback[normalizeChampKey(k)] = v;
  });

  cachedMeta = normalizedFallback;
  cachedMetaSource = 'Meta Competitivo Asia (WSL / SMASH)';
  lastMetaFetch = now;

  return res.json({
    source: cachedMetaSource,
    updatedAt: new Date(now).toISOString().slice(0, 10),
    tiers: normalizedFallback,
  });
});

// ==========================================
// RUTAS CRUD SUPABASE (PLAYBOOK / PIZARRA)
// ==========================================
app.get('/api/plays', async (_req, res) => {
  try {
    const plays = await prisma.savedPlay.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(plays);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/plays', async (req, res) => {
  try {
    const { name, category, updatedAt, keyframes } = req.body;
    const play = await prisma.savedPlay.create({
      data: {
        name,
        category,
        updatedAt: updatedAt || new Date().toISOString().slice(0, 10),
        keyframes: keyframes ?? [],
      },
    });
    res.status(201).json(play);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/plays/:id', async (req, res) => {
  try {
    await prisma.savedPlay.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ==========================================
// RUTAS CRUD SUPABASE (SCRIMS)
// ==========================================
app.get('/api/scrims', async (_req, res) => {
  try {
    const scrims = await prisma.scrimMatch.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(scrims);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/scrims', async (req, res) => {
  try {
    const data = req.body;
    const scrim = await prisma.scrimMatch.create({
      data: {
        date: data.date,
        opponent: data.opponent,
        side: data.side,
        result: data.result,
        durationMins: Number(data.durationMins) || 18,
        patch: data.patch || '6.0',
        kills: Number(data.kills) || 0,
        deaths: Number(data.deaths) || 0,
        goldDiff8m: Number(data.goldDiff8m) || 0,
        firstBlood: Boolean(data.firstBlood),
        firstDragon: Boolean(data.firstDragon),
        firstHerald: Boolean(data.firstHerald),
        barons: Number(data.barons) || 0,
        ourComp: data.ourComp ?? [],
        enemyComp: data.enemyComp ?? [],
        mvp: data.mvp || '',
        focusGoal: data.focusGoal || '',
        notes: data.notes || '',
      },
    });
    res.status(201).json(scrim);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/scrims/:id', async (req, res) => {
  try {
    const data = req.body;
    const scrim = await prisma.scrimMatch.update({
      where: { id: req.params.id },
      data: {
        date: data.date,
        opponent: data.opponent,
        side: data.side,
        result: data.result,
        durationMins: Number(data.durationMins) || 18,
        patch: data.patch || '6.0',
        kills: Number(data.kills) || 0,
        deaths: Number(data.deaths) || 0,
        goldDiff8m: Number(data.goldDiff8m) || 0,
        firstBlood: Boolean(data.firstBlood),
        firstDragon: Boolean(data.firstDragon),
        firstHerald: Boolean(data.firstHerald),
        barons: Number(data.barons) || 0,
        ourComp: data.ourComp ?? [],
        enemyComp: data.enemyComp ?? [],
        mvp: data.mvp || '',
        focusGoal: data.focusGoal || '',
        notes: data.notes || '',
      },
    });
    res.json(scrim);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/scrims/:id', async (req, res) => {
  try {
    await prisma.scrimMatch.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ==========================================
// RUTAS CRUD SUPABASE (SCOUTING RIVALES)
// ==========================================
app.get('/api/scouting', async (_req, res) => {
  try {
    const profiles = await prisma.scoutingProfile.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/scouting', async (req, res) => {
  try {
    const data = req.body;
    const profile = await prisma.scoutingProfile.create({
      data: {
        teamName: data.teamName,
        regionOrTier: data.regionOrTier || 'Competitivo',
        threatLevel: data.threatLevel || 'Media',
        playstyle: data.playstyle || 'Teamfight',
        tendency: data.tendency || '',
        priorityPicks: data.priorityPicks ?? [],
        priorityBans: data.priorityBans ?? [],
        weakness: data.weakness || '',
        notes: data.notes || '',
      },
    });
    res.status(201).json(profile);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/scouting/:id', async (req, res) => {
  try {
    const data = req.body;
    const profile = await prisma.scoutingProfile.update({
      where: { id: req.params.id },
      data: {
        teamName: data.teamName,
        regionOrTier: data.regionOrTier || 'Competitivo',
        threatLevel: data.threatLevel || 'Media',
        playstyle: data.playstyle || 'Teamfight',
        tendency: data.tendency || '',
        priorityPicks: data.priorityPicks ?? [],
        priorityBans: data.priorityBans ?? [],
        weakness: data.weakness || '',
        notes: data.notes || '',
      },
    });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/scouting/:id', async (req, res) => {
  try {
    await prisma.scoutingProfile.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ==========================================
// RUTAS CRUD SUPABASE (PLANTILLA & POOL)
// ==========================================
app.get('/api/roster', async (_req, res) => {
  try {
    const players = await prisma.rosterPlayer.findMany({ orderBy: { createdAt: 'asc' } });
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/roster', async (req, res) => {
  try {
    const data = req.body;
    const player = await prisma.rosterPlayer.create({
      data: {
        ign: data.ign,
        role: data.role,
        status: data.status || 'Titular',
        rank: data.rank || 'Sovereign',
        notes: data.notes || '',
        pool: data.pool ?? [],
      },
    });
    res.status(201).json(player);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/roster/:id', async (req, res) => {
  try {
    const data = req.body;
    const player = await prisma.rosterPlayer.update({
      where: { id: req.params.id },
      data: {
        ign: data.ign,
        role: data.role,
        status: data.status,
        rank: data.rank,
        notes: data.notes,
        pool: data.pool,
      },
    });
    res.json(player);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/roster/:id', async (req, res) => {
  try {
    await prisma.rosterPlayer.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ==========================================
// RUTAS CRUD SUPABASE (NOTAS SALA VOD)
// ==========================================
app.get('/api/vod-notes/:videoId', async (req, res) => {
  try {
    const notes = await prisma.vodNote.findMany({
      where: { videoId: req.params.videoId },
      orderBy: { time: 'asc' },
    });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/vod-notes', async (req, res) => {
  try {
    const { videoId, time, tag, text } = req.body;
    const note = await prisma.vodNote.create({
      data: {
        videoId,
        time: Number(time) || 0,
        tag: tag || 'Macro',
        text,
      },
    });
    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/vod-notes/:id', async (req, res) => {
  try {
    await prisma.vodNote.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ==========================================
// SOCKET.IO (TIEMPO REAL)
// ==========================================
io.on('connection', (socket) => {
  console.log(`[Socket] Usuario conectado: ${socket.id}`);

  socket.on('room:join', (roomId: string) => {
    socket.join(roomId);
    console.log(`[Socket] ${socket.id} entró a la sala ${roomId}`);
  });

  socket.on('board:update', ({ roomId, state }) => {
    socket.to(roomId).emit('board:sync', state);
  });

  socket.on('draft:update', ({ roomId, state }) => {
    socket.to(roomId).emit('draft:sync', state);
  });

  socket.on('vod:update', ({ roomId, payload }) => {
    socket.to(roomId).emit('vod:sync', payload);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Usuario desconectado: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});