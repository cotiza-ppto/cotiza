import pool from './db.js';
import cookie from 'cookie';
import nodemailer from 'nodemailer';

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
    return err(res, 'No autorizado', 401);
  }

  try {
    const sessionResult = await pool.query(
      'SELECT username FROM sessions WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    if (sessionResult.rows.length === 0) {
      return err(res, 'No autorizado', 401);
    }

    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }

    if (!body.to || !body.html) {
      return err(res, 'Datos insuficientes para enviar el correo');
    }

    const smtpDefaults = {
      host: '',
      port: 587,
      secure: 'tls',
      user: '',
      pass: '',
      from: '',
      fromName: 'Comercializadora Suncatcher del Norte'
    };

    const cResult = await pool.query("SELECT valor FROM configuracion WHERE clave = 'app_settings'");
    const settings = cResult.rows[0] ? (JSON.parse(cResult.rows[0].valor) || {}) : {};

    if (settings.smtp) {
      const s = settings.smtp;
      smtpDefaults.host = s.host || smtpDefaults.host;
      smtpDefaults.port = parseInt(s.port || smtpDefaults.port);
      smtpDefaults.user = s.username || s.user || smtpDefaults.user;
      smtpDefaults.pass = s.password || s.pass || smtpDefaults.pass;
      smtpDefaults.secure = s.secure || smtpDefaults.secure;
      smtpDefaults.from = s.from || s.fromEmail || smtpDefaults.user;
      smtpDefaults.fromName = s.fromName || smtpDefaults.fromName;
    }

    const isSecure = smtpDefaults.secure === 'ssl' || smtpDefaults.port === 465;

    const transporter = nodemailer.createTransport({
      host: smtpDefaults.host,
      port: smtpDefaults.port,
      secure: isSecure,
      auth: {
        user: smtpDefaults.user,
        pass: smtpDefaults.pass
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const fromEmail = smtpDefaults.from || smtpDefaults.user || 'ventas@suncatcher.com.mx';
    const fromName = smtpDefaults.fromName || 'Comercializadora Suncatcher del Norte';

    const logoImg = body.logo || '';
    const logoTag = logoImg ? `<p style='text-align:center;'><img src='${logoImg}' alt='Logo' style='max-height:80px;'></p>` : '';

    const htmlBody = `
      <!DOCTYPE html>
      <html lang='es'>
      <head>
          <meta charset='UTF-8'>
          <style>
              body { font-family: Arial, sans-serif; background-color: #f3f4f6; padding: 20px; }
              .container { background-color: white; border-radius: 8px; padding: 20px; max-width: 800px; margin: 0 auto; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              th, td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; }
              .footer { font-size: 12px; color: #666; margin-top: 20px; text-align: center; }
          </style>
      </head>
      <body>
          <div class='container'>
              ${logoTag}
              ${body.html}
              <div class='footer'>
                  <p>Comercializadora Suncatcher del Norte</p>
              </div>
          </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: body.to,
      subject: body.subject || 'Presupuesto Comercializadora Suncatcher',
      html: htmlBody,
      text: body.html.replace(/<[^>]*>/g, ''),
      attachments: []
    };

    if (body.bcc && Array.isArray(body.bcc)) {
      mailOptions.bcc = body.bcc.filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    }

    if (body.pdfBase64 && body.pdfName) {
      const b64Data = body.pdfBase64.replace(/^data:application\/pdf(;[^,]+)?;base64,/i, '');
      const buffer = Buffer.from(b64Data, 'base64');
      mailOptions.attachments.push({
        filename: body.pdfName,
        content: buffer
      });
    }

    await transporter.sendMail(mailOptions);
    return respond(res, { success: true });
  } catch (e) {
    return err(res, 'Error al enviar correo: ' + e.message, 500);
  }
}
