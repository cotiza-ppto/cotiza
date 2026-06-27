import pool from './db.js';
import bcrypt from 'bcryptjs';
import cookie from 'cookie';

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

const TOKEN_COOKIE = 'SUNCATCHER_TOKEN';

async function tokenGet(token) {
  if (!token || token.length < 32) return null;
  const result = await pool.query(
    'SELECT username FROM sessions WHERE token = $1 AND expires_at > NOW()',
    [token]
  );
  return result.rows[0] || null;
}

async function tokenCreate(res, username) {
  const crypto = await import('crypto');
  const token = crypto.randomBytes(16).toString('hex');
  const expires = new Date(Date.now() + 86400 * 1000 * 7); // 7 días
  
  await pool.query('DELETE FROM sessions WHERE username = $1 AND expires_at < NOW()', [username]);
  await pool.query('INSERT INTO sessions (token, username, expires_at) VALUES ($1, $2, $3)', [
    token,
    username,
    expires
  ]);

  res.setHeader('Set-Cookie', cookie.serialize(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    sameSite: 'lax'
  }));
}

async function tokenDestroy(res, token) {
  if (token) {
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
  }
  res.setHeader('Set-Cookie', cookie.serialize(TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: true,
    expires: new Date(0),
    path: '/',
    sameSite: 'lax'
  }));
}

async function getDbSettings() {
  try {
    const result = await pool.query("SELECT valor FROM configuracion WHERE clave = 'app_settings'");
    return result.rows[0] ? (JSON.parse(result.rows[0].valor) || {}) : {};
  } catch (e) {
    return {};
  }
}

export default async function handler(req, res) {
  // CORS & Security Headers
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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

  const resource = req.query.resource || '';
  const id = req.query.id || null;
  const method = req.method;
  
  // Parse body if it is a JSON string (Vercel parses it automatically, but let's be safe)
  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) {}
  }

  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies[TOKEN_COOKIE] || '';

  try {
    // ---- Endpoint de Login (público) ----
    if (resource === 'login') {
      if (method === 'POST') {
        const user = (body.username || '').trim();
        const pass = body.password || '';

        const result = await pool.query(
          'SELECT usuario AS nick, contrasena AS password FROM usuarios WHERE usuario = $1',
          [user]
        );
        const userData = result.rows[0];

        if (userData && bcrypt.compareSync(pass, userData.password)) {
          await tokenCreate(res, userData.nick);
          return respond(res, { success: true, username: userData.nick });
        } else {
          return err(res, 'Usuario o contraseña incorrectos', 401);
        }
      }
      return err(res, 'Método no permitido', 405);
    }

    // ---- Endpoint de Logout ----
    if (resource === 'logout') {
      await tokenDestroy(res, token);
      return respond(res, { success: true });
    }

    // ---- Settings GET público ----
    if (resource === 'settings' && method === 'GET') {
      const settings = await getDbSettings();
      if (settings.smtp) {
        settings.smtp.pass = '';
        settings.smtp.password = '';
      }
      return respond(res, settings);
    }

    // ---- Verificar sesión para el resto de recursos ----
    const currentSession = await tokenGet(token);
    if (!currentSession) {
      if (resource !== 'check_session') {
        return err(res, 'No autorizado. Por favor inicia sesión.', 401);
      }
    }

    // ---- check_session: responde OK solo si hay sesión activa ----
    if (resource === 'check_session') {
      if (currentSession) {
        return respond(res, { logged_in: true, username: currentSession.username });
      }
      return err(res, 'No autorizado', 401);
    }

    const currentUsername = currentSession ? currentSession.username : 'admin';

    // ---- Manejo de Recursos ----
    switch (resource) {
      case 'settings':
        if (method === 'POST' || method === 'PUT') {
          if (!body.smtp?.pass && !body.smtp?.password) {
            const existing = await getDbSettings();
            if (!body.smtp) body.smtp = {};
            body.smtp.pass = existing.smtp?.pass || '';
          }
          const json = JSON.stringify(body, null, 2);
          await pool.query(
            `INSERT INTO configuracion (clave, valor) VALUES ('app_settings', $1)
             ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW()`,
            [json]
          );
          return respond(res, { success: true });
        }
        break;

      case 'unidades':
        if (method === 'GET') {
          if (id) {
            const r = await pool.query('SELECT idunidad as id, unidad as name FROM unidades WHERE idunidad = $1', [id]);
            if (r.rows.length === 0) return err(res, 'Unidad no encontrada', 404);
            return respond(res, r.rows[0]);
          }
          const r = await pool.query('SELECT idunidad as id, unidad as name FROM unidades ORDER BY idunidad');
          return respond(res, r.rows);
        }
        if (method === 'POST') {
          if (!body.name) return err(res, 'Nombre de unidad requerido');
          const r = await pool.query('INSERT INTO unidades (unidad) VALUES ($1) RETURNING idunidad', [body.name]);
          return respond(res, { id: r.rows[0].idunidad, name: body.name }, 201);
        }
        if (method === 'PUT' && id) {
          if (!body.name) return err(res, 'Nombre de unidad requerido');
          await pool.query('UPDATE unidades SET unidad = $1 WHERE idunidad = $2', [body.name, id]);
          return respond(res, { ok: true });
        }
        if (method === 'DELETE' && id) {
          await pool.query('DELETE FROM unidades WHERE idunidad = $1', [id]);
          return respond(res, { ok: true });
        }
        return err(res, 'Método no soportado para unidades', 405);

      case 'families':
        if (method === 'GET') {
          const r = await pool.query('SELECT codfamilia as id, descripcion as name FROM familias ORDER BY descripcion');
          return respond(res, r.rows);
        }
        break;

      case 'clients': {
        const baseSql = `
          SELECT codcliente as id,
                 nombre     as name,
                 COALESCE(rfc,'')   as rfc,
                 COALESCE(email,'')    as email,
                 COALESCE(telefono,'') as phone,
                 COALESCE(direccion,'') as street,
                 COALESCE(ciudad,'')    as city,
                 COALESCE(codpostal,'') as zip,
                 COALESCE(provincia,'') as province
          FROM clientes
          WHERE debaja = 0
        `;

        if (method === 'GET') {
          if (id) {
            const r = await pool.query(baseSql + ' AND codcliente = $1', [id]);
            if (r.rows.length === 0) return err(res, 'Cliente no encontrado', 404);
            return respond(res, r.rows[0]);
          }
          const r = await pool.query(baseSql + ' ORDER BY nombre');
          return respond(res, r.rows);
        }

        if (method === 'POST') {
          const maxRow = await pool.query('SELECT MAX(CAST(codcliente AS INTEGER)) as m FROM clientes');
          const codCliente = (parseInt(maxRow.rows[0].m || '0') + 1).toString();

          await pool.query(`
            INSERT INTO clientes
              (codcliente, nombre, razonsocial, rfc, email, telefono, direccion, ciudad, codpostal, provincia,
               pais, fechaalta, debaja, regimen_iva, tipo_id_fiscal, personafisica, riesgo_max, riesgo_alcanzado)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'MEX',CURRENT_DATE,0,'General','RFC',0,0,0)
          `, [
            codCliente, body.name||'', body.name||'', body.rfc||'',
            body.email||'', body.phone||'', body.street||'', body.city||'',
            body.zip||'', body.province||''
          ]);

          return respond(res, { id: codCliente }, 201);
        }

        if (method === 'PUT' && id) {
          await pool.query(`
            UPDATE clientes 
            SET nombre=$1, razonsocial=$2, rfc=$3, email=$4, telefono=$5, direccion=$6, ciudad=$7, codpostal=$8, provincia=$9 
            WHERE codcliente=$10
          `, [
            body.name||'', body.name||'', body.rfc||'', body.email||'', body.phone||'', body.street||'', body.city||'', body.zip||'', body.province||'', id
          ]);
          return respond(res, { ok: true });
        }

        if (method === 'DELETE' && id) {
          await pool.query('UPDATE clientes SET debaja=1, fechabaja=CURRENT_DATE WHERE codcliente=$1', [id]);
          return respond(res, { ok: true });
        }
        break;
      }

      case 'products': {
        const baseSql = `
          SELECT p.idproducto as id,
                 p.referencia  as code,
                 p.descripcion as name,
                 COALESCE(p.familia, 'General') as category,
                 p.codfamilia,
                 COALESCE(p.idunidad, 1) as idunidad,
                 COALESCE(p.iva, 16)   as tax,
                 COALESCE(p.costo, 0) as cost,
                 COALESCE(p.precio, 0)        as price,
                 COALESCE(p.margen, 30) as margin,
                 COALESCE(p.observaciones, '') as observaciones
           FROM productos p
        `;

        if (method === 'GET') {
          if (req.query.search && req.query.search.length > 0) {
            const q = `%${req.query.search}%`;
            const r = await pool.query(baseSql + ' WHERE p.referencia LIKE $1 OR p.descripcion LIKE $2 ORDER BY p.descripcion LIMIT 30', [q, q]);
            return respond(res, r.rows);
          }
          if (id) {
            const r = await pool.query(baseSql + ' WHERE p.idproducto = $1', [id]);
            if (r.rows.length === 0) return err(res, 'Producto no encontrado', 404);
            return respond(res, r.rows[0]);
          }
          const r = await pool.query(baseSql + ' ORDER BY p.descripcion');
          return respond(res, r.rows);
        }

        const getTaxCode = async (rate) => {
          const r = await pool.query('SELECT codimpuesto FROM impuestos WHERE iva = $1 LIMIT 1', [parseInt(rate)]);
          if (r.rows[0]) return r.rows[0].codimpuesto;
          const map = { 0: '001', 8: '002', 16: '003' };
          return map[parseInt(rate)] || '003';
        };

        if (method === 'POST') {
          const taxCode = await getTaxCode(body.tax || 16);
          const price = parseFloat(body.price || 0);
          const cost = parseFloat(body.cost || 0);
          const margin = parseFloat(body.margin || 30);
          const nextIdRow = await pool.query('SELECT COALESCE(MAX(idproducto), 0) + 1 AS next FROM productos');
          const nextId = parseInt(nextIdRow.rows[0].next);

          await pool.query(`
            INSERT INTO productos (idproducto, referencia, descripcion, precio, codfamilia, codimpuesto, costo, margen, iva, idunidad, fechaalta, observaciones)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_DATE,$11)
          `, [
            nextId, body.code||'', body.name||'', price, body.codfamilia||'1', taxCode, cost, margin, parseFloat(body.tax || 16), parseInt(body.idunidad || 1), body.observaciones||''
          ]);
          return respond(res, { id: nextId }, 201);
        }

        if (method === 'PUT' && id) {
          const taxCode = await getTaxCode(body.tax || 16);
          const price = parseFloat(body.price || 0);
          const cost = parseFloat(body.cost || 0);
          const margin = parseFloat(body.margin || 30);
          const tax = parseFloat(body.tax || 16);
          const idunidad = parseInt(body.idunidad || 1);
          const code = body.code || '';
          const name = body.name || '';

          const oldProductRow = await pool.query('SELECT referencia FROM productos WHERE idproducto = $1', [id]);
          const oldCode = oldProductRow.rows[0] ? oldProductRow.rows[0].referencia : '';

          await pool.query(`
            UPDATE productos 
            SET referencia=$1, descripcion=$2, precio=$3, codfamilia=$4, codimpuesto=$5, costo=$6, margen=$7, iva=$8, idunidad=$9, observaciones=$10 
            WHERE idproducto=$11
          `, [
            code, name, price, body.codfamilia||'1', taxCode, cost, margin, tax, idunidad, body.observaciones||'', id
          ]);

          if (oldCode !== '') {
            await pool.query(`
              UPDATE presupuestos_lineas
              SET codigo_producto = $1, producto = $2, precio_unitario = $3, iva_pct = $4, idunidad = $5,
                  total_linea = (cantidad * $6) * (1 + $7 / 100)
              WHERE codigo_producto = $8
            `, [code, name, price, tax, idunidad, price, tax, oldCode]);

            const affectedRows = await pool.query('SELECT DISTINCT idpresupuesto FROM presupuestos_lineas WHERE codigo_producto = $1', [code]);
            for (const row of affectedRows.rows) {
              const bid = row.idpresupuesto;
              const totsRow = await pool.query(`
                SELECT COALESCE(SUM(cantidad * precio_unitario), 0) as neto,
                       COALESCE(SUM(cantidad * precio_unitario * (iva_pct / 100)), 0) as iva,
                       COALESCE(SUM((cantidad * precio_unitario) * (1 + iva_pct / 100)), 0) as total
                FROM presupuestos_lineas WHERE idpresupuesto = $1
              `, [bid]);
              const tots = totsRow.rows[0];
              if (tots) {
                await pool.query('UPDATE presupuestos SET neto = $1, iva = $2, total = $3 WHERE idpresupuesto = $4', [
                  tots.neto, tots.iva, tots.total, bid
                ]);
              }
            }
          }
          return respond(res, { ok: true });
        }

        if (method === 'DELETE' && id) {
          await pool.query('DELETE FROM productos WHERE idproducto=$1', [id]);
          return respond(res, { ok: true });
        }
        break;
      }

      case 'budgets': {
        if (method === 'GET') {
          if (id) {
            const budgetResult = await pool.query(`
              SELECT p.idpresupuesto as id, p.codigo, p.codcliente as clientId,
                     COALESCE(p.fecha::text,'') as date, COALESCE(p.neto,0) as neto, COALESCE(p.iva,0) as totaliva, COALESCE(p.total,0) as total,
                     COALESCE(p.observaciones,'') as observaciones,
                     COALESCE(p.estado,'Abierto') as status,
                     COALESCE(p.cliente,'') as clientName,
                     COALESCE(p.rfc_cliente,'')        as clientRfc,
                     COALESCE(p.email_cliente,'')          as clientEmail,
                     COALESCE(p.telefono_cliente,'')      as clientPhone,
                     COALESCE(c.direccion,'')     as clientStreet,
                     COALESCE(c.ciudad,'')        as clientCity,
                     COALESCE(c.codpostal,'')     as clientZip
              FROM presupuestos p
              LEFT JOIN clientes c ON c.codcliente  = p.codcliente
              WHERE p.idpresupuesto = $1
            `, [id]);
            const budget = budgetResult.rows[0];
            if (!budget) return err(res, 'Presupuesto no encontrado', 404);

            const itemsResult = await pool.query(`
              SELECT l.idlinea as id, l.codigo_producto as productCode, l.producto as productName,
                     l.cantidad as qty, l.precio_unitario as price, l.iva_pct as tax, l.idunidad as idunidad,
                     l.total_linea as lineTotal,
                     (SELECT p2.idproducto FROM productos p2 WHERE p2.referencia = l.codigo_producto LIMIT 1) as productId
              FROM presupuestos_lineas l
              WHERE l.idpresupuesto = $1 ORDER BY l.idlinea
            `, [id]);
            budget.items = itemsResult.rows;
            return respond(res, budget);
          }

          const listResult = await pool.query(`
            SELECT p.idpresupuesto as id, p.codigo, p.codcliente as clientId,
                   COALESCE(p.fecha::text,'') as date, COALESCE(p.neto,0) as neto, COALESCE(p.iva,0) as totaliva, COALESCE(p.total,0) as total,
                   COALESCE(p.estado,'Abierto') as status,
                   COALESCE(p.cliente,'') as clientName
            FROM presupuestos p
            ORDER BY p.fecha DESC, p.idpresupuesto DESC LIMIT 1000
          `);
          return respond(res, listResult.rows);
        }

        if (method === 'POST') {
          if (!body.clientId) return err(res, 'Cliente requerido');
          if (!body.items || body.items.length === 0) return err(res, 'Se requiere al menos un producto');

          const date = body.date || new Date().toISOString().split('T')[0];
          const year = date.substring(0, 4);
          const serie = 'A';

          const clientResult = await pool.query(
            "SELECT nombre, rfc, email, telefono, COALESCE(forma_pago,'CONT') as forma_pago FROM clientes WHERE codcliente=$1",
            [body.clientId]
          );
          const client = clientResult.rows[0];
          if (!client) return err(res, 'Cliente no encontrado');

          const numResult = await pool.query(
            'SELECT MAX(numero) as m FROM presupuestos WHERE codejercicio=$1 AND codserie=$2',
            [year, serie]
          );
          const nextNum = parseInt(numResult.rows[0].m || '0') + 1;
          const codigo = `PRE${year}${serie}${nextNum}`;

          let neto = 0;
          let totalIva = 0;
          for (const item of body.items) {
            const sub = parseFloat(item.price || 0) * parseFloat(item.qty || 0);
            neto += sub;
            totalIva += sub * (parseFloat(item.tax || 16) / 100);
          }
          const total = neto + totalIva;

          const nextIdResult = await pool.query('SELECT COALESCE(MAX(idpresupuesto), 0) + 1 as next FROM presupuestos');
          const budgetId = parseInt(nextIdResult.rows[0].next);

          await pool.query(`
            INSERT INTO presupuestos
              (idpresupuesto, codigo, codcliente, cliente, rfc_cliente, email_cliente, telefono_cliente,
               fecha, codserie, codejercicio, numero, estado, neto, iva, total,
               forma_pago, divisa, usuario, observaciones, editable)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'MXN',$17,$18,1)
          `, [
            budgetId, codigo, body.clientId, client.nombre, client.rfc, client.email, client.telefono,
            date, serie, year, nextNum, 'Abierto',
            neto, totalIva, total,
            client.forma_pago, currentUsername, body.observaciones || ''
          ]);

          let lineNum = 1;
          for (const item of body.items) {
            const sub = parseFloat(item.price || 0) * parseFloat(item.qty || 0);
            const lineIva = sub * (parseFloat(item.tax || 16) / 100);
            await pool.query(`
              INSERT INTO presupuestos_lineas
                (idlinea, idpresupuesto, folio, codcliente, cliente, fecha, codigo_producto, producto, cantidad, idunidad, precio_unitario, iva_pct, descuento, total_linea, coste)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,0,$13,0)
            `, [
              lineNum++, budgetId, codigo, body.clientId, client.nombre, date,
              item.productCode || '', item.productName || '', parseFloat(item.qty || 0),
              parseInt(item.idunidad || 1), parseFloat(item.price || 0), parseInt(item.tax || 16),
              sub + lineIva
            ]);
          }

          return respond(res, { id: budgetId, codigo }, 201);
        }

        if (method === 'DELETE' && id) {
          await pool.query('DELETE FROM presupuestos_lineas WHERE idpresupuesto=$1', [id]);
          await pool.query('DELETE FROM presupuestos WHERE idpresupuesto=$1', [id]);
          return respond(res, { ok: true });
        }

        if (method === 'PUT' && id) {
          if (body.status && (!body.items || body.items.length === 0)) {
            await pool.query('UPDATE presupuestos SET estado=$1 WHERE idpresupuesto=$2', [body.status, id]);
            return respond(res, { ok: true });
          }

          if (body.items && body.items.length > 0) {
            const date = body.date || new Date().toISOString().split('T')[0];

            let neto = 0;
            let totalIva = 0;
            for (const item of body.items) {
              const sub = parseFloat(item.price || 0) * parseFloat(item.qty || 0);
              neto += sub;
              totalIva += sub * (parseFloat(item.tax || 16) / 100);
            }
            const total = neto + totalIva;

            await pool.query(`
              UPDATE presupuestos
              SET codcliente=$1, fecha=$2, neto=$3, iva=$4, total=$5, observaciones=$6
              WHERE idpresupuesto=$7
            `, [
              body.clientId, date, neto, totalIva, total, body.observaciones || '', id
            ]);

            const headerResult = await pool.query('SELECT codigo, codcliente, cliente, fecha FROM presupuestos WHERE idpresupuesto=$1', [id]);
            const bHeader = headerResult.rows[0];

            await pool.query('DELETE FROM presupuestos_lineas WHERE idpresupuesto=$1', [id]);
            let lineNum = 1;
            for (const item of body.items) {
              const sub = parseFloat(item.price || 0) * parseFloat(item.qty || 0);
              const lineIva = sub * (parseFloat(item.tax || 16) / 100);
              await pool.query(`
                INSERT INTO presupuestos_lineas
                  (idlinea, idpresupuesto, folio, codcliente, cliente, fecha, codigo_producto, producto, cantidad, idunidad, precio_unitario, iva_pct, descuento, total_linea, coste)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,0,$13,0)
              `, [
                lineNum++, id, bHeader.codigo, bHeader.codcliente, bHeader.cliente, bHeader.fecha,
                item.productCode || '', item.productName || '', parseFloat(item.qty || 0),
                parseInt(item.idunidad || 1), parseFloat(item.price || 0), parseInt(item.tax || 16),
                sub + lineIva
              ]);
            }
            return respond(res, { ok: true });
          }
          return err(res, 'Datos insuficientes para actualizar', 400);
        }
        break;
      }

      case 'dashboard-stats': {
        if (method === 'GET') {
          const salesResult = await pool.query("SELECT COALESCE(SUM(total),0) as total_sales FROM presupuestos");
          const totalSales = parseFloat(salesResult.rows[0].total_sales);

          const monthLabels = [];
          const monthTotals = [];
          for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const label = date.toLocaleString('es-MX', { month: 'short', year: '2-digit' });
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            
            const startStr = `${year}-${month}-01`;
            const nextMonthDate = new Date(year, date.getMonth() + 1, 1);
            const endStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

            const monthlyResult = await pool.query(
              'SELECT COALESCE(SUM(total),0) as sum FROM presupuestos WHERE fecha >= $1 AND fecha < $2',
              [startStr, endStr]
            );
            monthLabels.push(label);
            monthTotals.push(parseFloat(monthlyResult.rows[0].sum));
          }

          const statusResult = await pool.query(
            "SELECT COALESCE(estado,'Pendiente') as status, COUNT(*) as cnt FROM presupuestos GROUP BY status"
          );
          const statusCounts = {};
          for (const row of statusResult.rows) {
            statusCounts[row.status] = parseInt(row.cnt);
          }

          return respond(res, {
            totalSales,
            monthLabels,
            monthTotals,
            statusCounts
          });
        }
        break;
      }

      default:
        return err(res, 'Recurso no encontrado', 404);
    }
  } catch (e) {
    return err(res, 'Internal Server Error: ' + e.message, 500);
  }
}
