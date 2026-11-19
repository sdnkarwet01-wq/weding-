import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DIST_INDEX = path.resolve(__dirname, 'dist', 'index.html');
const IS_PROD =
  process.env.NODE_ENV === 'production' ||
  (process.env.NODE_ENV !== 'development' && fs.existsSync(DIST_INDEX));
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

async function verifyFirebaseBearerToken(authHeader: string | undefined): Promise<{ uid: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    // Verify JWT format & payload safely; also check Firebase config project
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    let apiKey = '';
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      apiKey = cfg.apiKey || '';
    }
    if (apiKey) {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: token }),
        }
      );
      if (!res.ok) return null;
      const json = (await res.json()) as { users?: Array<{ localId?: string; emailVerified?: boolean }> };
      const u = json.users?.[0];
      if (!u?.localId) return null;
      return { uid: u.localId };
    }
    return null;
  } catch {
    return null;
  }
}

async function startServer() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '15mb' }));

  // Serve uploaded media safely with strict headers
  app.use(
    '/uploads',
    express.static(UPLOADS_DIR, {
      maxAge: '7d',
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    })
  );

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'wedlink-studio', timestamp: new Date().toISOString() });
  });

  // Authenticated media upload endpoint (resilient storage companion to Firebase Storage)
  app.post('/api/upload', async (req, res) => {
    try {
      const verified = await verifyFirebaseBearerToken(req.headers.authorization);
      if (!verified) {
        res.status(401).json({ error: 'Authentication required to upload media.' });
        return;
      }

      const { fileName, mimeType, dataBase64, folder } = req.body as {
        fileName?: string;
        mimeType?: string;
        dataBase64?: string;
        folder?: string;
      };

      if (!mimeType || !ALLOWED_MIME_EXT[mimeType]) {
        res.status(400).json({ error: 'Unsupported file format. Allowed: JPG, PNG, WEBP, MP3, WAV, OGG, M4A.' });
        return;
      }

      if (!dataBase64 || typeof dataBase64 !== 'string') {
        res.status(400).json({ error: 'Missing file payload.' });
        return;
      }

      const cleanBase64 = dataBase64.includes(',') ? dataBase64.split(',')[1] : dataBase64;
      const buffer = Buffer.from(cleanBase64, 'base64');

      if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
        res.status(400).json({ error: 'File exceeds maximum 10MB size limit.' });
        return;
      }

      const safeFolder = (folder || 'media').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'media';
      const safeUid = verified.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
      const userDir = path.join(UPLOADS_DIR, safeUid, safeFolder);
      fs.mkdirSync(userDir, { recursive: true });

      const ext = ALLOWED_MIME_EXT[mimeType];
      const baseSlug = (fileName || 'asset')
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .slice(0, 36)
        .toLowerCase();
      const uniqueName = `${baseSlug || 'asset'}-${crypto.randomBytes(6).toString('hex')}${ext}`;
      const targetPath = path.join(userDir, uniqueName);

      fs.writeFileSync(targetPath, buffer);
      const publicUrl = `/uploads/${safeUid}/${safeFolder}/${uniqueName}`;
      res.json({ url: publicUrl, size: buffer.length, mimeType });
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ error: 'Failed to store uploaded file.' });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir, { maxAge: '1d' }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WEDLINK server running on http://0.0.0.0:${PORT} (${IS_PROD ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
