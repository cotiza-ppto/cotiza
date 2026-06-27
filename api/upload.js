import pool from './db.js';
import cookie from 'cookie';
import Busboy from 'busboy';

const TOKEN_COOKIE = 'SUNCATCHER_TOKEN';

const respond = (res, data, code = 200) => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
};

const err = (res, msg, code = 400) => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: msg }));
};

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  // CORS & Security Headers
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const origin = req.headers.origin || '';
  const appUrl = process.env.APP_URL || '';
  const localOrigins = ['http://localhost', 'http://localhost:8000', 'http://127.0.0.1', 'http://localhost:3000'];
  if (origin && (origin === appUrl || localOrigins.some(o => origin.startsWith(o)))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', appUrl || origin);
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return err(res, 'Método no permitido', 405);
  }

  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies[TOKEN_COOKIE] || '';

  if (!token || token.length < 32) {
    return err(res, 'No autorizado. Por favor inicia sesión.', 401);
  }

  try {
    const sessionResult = await pool.query(
      'SELECT username FROM sessions WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    if (sessionResult.rows.length === 0) {
      return err(res, 'No autorizado. Por favor inicia sesión.', 401);
    }

    const parseForm = () => {
      return new Promise((resolve, reject) => {
        const busboy = Busboy({ headers: req.headers, limits: { fileSize: 2 * 1024 * 1024 } });
        let base64Url = null;
        let limitExceeded = false;
        let invalidMime = false;

        busboy.on('file', (name, file, info) => {
          const { mimeType } = info;
          const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

          if (name !== 'logo') {
            file.resume();
            return;
          }

          if (!allowedTypes.includes(mimeType)) {
            invalidMime = true;
            file.resume();
            return;
          }

          const chunks = [];
          file.on('data', (data) => {
            chunks.push(data);
          });

          file.on('limit', () => {
            limitExceeded = true;
            file.resume();
          });

          file.on('end', () => {
            const buffer = Buffer.concat(chunks);
            base64Url = `data:${mimeType};base64,${buffer.toString('base64')}`;
          });
        });

        busboy.on('error', (err) => {
          reject(err);
        });

        busboy.on('finish', () => {
          if (limitExceeded) {
            reject(new Error('LIMIT_EXCEEDED'));
          } else if (invalidMime) {
            reject(new Error('INVALID_MIME'));
          } else if (!base64Url) {
            reject(new Error('NO_FILE'));
          } else {
            resolve(base64Url);
          }
        });

        req.pipe(busboy);
      });
    };

    try {
      const base64 = await parseForm();
      return respond(res, { url: base64 });
    } catch (e) {
      if (e.message === 'LIMIT_EXCEEDED') {
        return err(res, 'La imagen excede el tamaño máximo de 2MB');
      }
      if (e.message === 'INVALID_MIME') {
        return err(res, 'Formato de imagen no válido');
      }
      if (e.message === 'NO_FILE') {
        return err(res, 'No se recibió ningún archivo válido');
      }
      return err(res, 'Error al subir: ' + e.message, 500);
    }
  } catch (e) {
    return err(res, 'Error al procesar subida: ' + e.message, 500);
  }
}
