<?php
// ============================================================
// api.php — REST API para Sistema de Presupuestos Suncatcher
// ============================================================
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');

// CORS: permitir mismo origen y APP_URL configurado en Vercel
$origin      = $_SERVER['HTTP_ORIGIN'] ?? '';
$appUrl      = getenv('APP_URL') ?: '';
$localOrigins = ['http://localhost', 'http://localhost:8000', 'http://127.0.0.1'];
if ($origin && ($origin === $appUrl || in_array($origin, $localOrigins))) {
    header("Access-Control-Allow-Origin: $origin");
} elseif (!$origin) {
    header('Access-Control-Allow-Origin: *');
} else {
    header('Access-Control-Allow-Origin: ' . ($appUrl ?: $origin));
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// --- Conexión ---
if (file_exists(__DIR__ . '/db_config.php')) {
    // Local: credenciales desde archivo (excluido de Git)
    include_once __DIR__ . '/db_config.php';
} else {
    // Vercel/Producción: credenciales desde variables de entorno
    $host = getenv('DB_HOST') ?: 'db.ewrhzalwcnzclhjortfp.supabase.co';
    if ($host === 'db.ewrhzalwcnzclhjortfp.sup') {
        $host = 'db.ewrhzalwcnzclhjortfp.supabase.co';
    }
    define('DB_HOST',    $host);
    define('DB_PORT',    getenv('DB_PORT')    ?: '5432');
    define('DB_NAME',    getenv('DB_NAME')    ?: 'postgres');
    define('DB_USER',    getenv('DB_USER')    ?: 'postgres');
    define('DB_PASS',    getenv('DB_PASS')    ?: '');
    define('DB_EMPRESA', 1);
    define('DB_ALMACEN', 'ALG');
    define('DB_DIVISA',  'MXN');
    define('DB_SERIE',   'A');
}

$resource = $_GET['resource'] ?? '';
$id       = $_GET['id'] ?? null;
$method   = $_SERVER['REQUEST_METHOD'];
$body     = json_decode(file_get_contents('php://input'), true) ?? [];

function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
    exit;
}
function err($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

try {
    $pdo = new PDO(
        "pgsql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME,
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (PDOException $e) {
    http_response_code(500);
    die(json_encode(['error' => 'Error de conexión: ' . $e->getMessage()]));
}

// ============================================================
// SESIÓN POR TOKEN — compatible con Vercel serverless
// Reemplaza $_SESSION (que no persiste entre instancias serverless)
// ============================================================
define('TOKEN_COOKIE', 'SUNCATCHER_TOKEN');
define('TOKEN_EXPIRY', 86400 * 7); // 7 días

function tokenGet($pdo) {
    $token = $_COOKIE[TOKEN_COOKIE] ?? '';
    if (!$token || strlen($token) < 32) return null;
    $stmt = $pdo->prepare("SELECT username FROM sessions WHERE token = ? AND expires_at > NOW()");
    $stmt->execute([$token]);
    return $stmt->fetch() ?: null;
}

function tokenCreate($pdo, $username) {
    $token   = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', time() + TOKEN_EXPIRY);
    // Limpiar sesiones expiradas del usuario
    $pdo->prepare("DELETE FROM sessions WHERE username = ? AND expires_at < NOW()")->execute([$username]);
    $pdo->prepare("INSERT INTO sessions (token, username, expires_at) VALUES (?, ?, ?)")
        ->execute([$token, $username, $expires]);
    // secure=true en HTTPS (Vercel siempre es HTTPS), false en local
    $secure = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
           || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    setcookie(TOKEN_COOKIE, $token, [
        'expires'  => time() + TOKEN_EXPIRY,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure'   => $secure,
    ]);
}

function tokenDestroy($pdo) {
    $token = $_COOKIE[TOKEN_COOKIE] ?? '';
    if ($token) $pdo->prepare("DELETE FROM sessions WHERE token = ?")->execute([$token]);
    setcookie(TOKEN_COOKIE, '', ['expires' => time() - 3600, 'path' => '/']);
}

// Lee la configuración de la tabla `configuracion` en BD
function getDbSettings($pdo) {
    try {
        $row = $pdo->query("SELECT valor FROM configuracion WHERE clave = 'app_settings'")->fetch();
        return $row ? (json_decode($row['valor'], true) ?: []) : [];
    } catch (\Exception $e) { return []; }
}

// ---- Endpoint de Login (sin autenticación previa) ----
if ($resource === 'login') {
    if ($method === 'POST') {
        $user = trim($body['username'] ?? '');
        $pass = $body['password'] ?? '';

        $stmt = $pdo->prepare("SELECT usuario AS nick, contrasena AS password FROM usuarios WHERE usuario = ?");
        $stmt->execute([$user]);
        $userData = $stmt->fetch();

        if ($userData && password_verify($pass, $userData['password'])) {
            tokenCreate($pdo, $userData['nick']);
            respond(['success' => true, 'username' => $userData['nick']]);
        } else {
            err('Usuario o contraseña incorrectos', 401);
        }
    }
    err('Método no permitido', 405);
}

// ---- Endpoint de Logout ----
if ($resource === 'logout') {
    tokenDestroy($pdo);
    respond(['success' => true]);
}

// ---- Settings GET público (lectura sin auth, nunca expone contraseñas) ----
// Necesario para cargar logo/empresa en la pantalla de login antes de autenticarse
if ($resource === 'settings' && $method === 'GET') {
    $settings = getDbSettings($pdo);
    // Nunca exponer contraseña SMTP al cliente
    if (isset($settings['smtp']['pass']))     $settings['smtp']['pass']     = '';
    if (isset($settings['smtp']['password'])) $settings['smtp']['password'] = '';
    respond($settings);
}

// ---- Verificar sesión para el resto de recursos ----
$currentSession = tokenGet($pdo);

if (!$currentSession) {
    if ($resource !== 'check_session') {
        err('No autorizado. Por favor inicia sesión.', 401);
    }
}

// ---- check_session: responde OK solo si hay sesión activa ----
if ($resource === 'check_session') {
    if ($currentSession) {
        respond(['logged_in' => true, 'username' => $currentSession['username']]);
    }
    err('No autorizado', 401);
}

$currentUsername = $currentSession['username'] ?? 'admin';

switch ($resource) {
    case 'settings':
        if ($method === 'POST' || $method === 'PUT') {
            // Preservar contraseña SMTP si no se envía nueva desde el frontend
            if (empty($body['smtp']['pass']) && empty($body['smtp']['password'])) {
                $existing = getDbSettings($pdo);
                $body['smtp']['pass'] = $existing['smtp']['pass'] ?? '';
            }
            $json = json_encode($body, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            $pdo->prepare("
                INSERT INTO configuracion (clave, valor) VALUES ('app_settings', ?)
                ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW()
            ")->execute([$json]);
            respond(['success' => true]);
        }
        break;

    case 'clients':         handleClients($pdo, $method, $id, $body);                    break;
    case 'products':        handleProducts($pdo, $method, $id, $body);                   break;
    case 'budgets':         handleBudgets($pdo, $method, $id, $body, $currentUsername);  break;
    case 'families':        handleFamilies($pdo);                                         break;
    case 'unidades':        handleUnidades($pdo, $method, $id, $body);                   break;
    case 'dashboard-stats': handleDashboardStats($pdo);                                   break;
    default: err('Recurso no encontrado', 404);
}

// =============================================
// UNIDADES
// =============================================
function handleUnidades($pdo, $method, $id = null, $body = null) {
    if ($method === 'GET') {
        if ($id !== null && $id !== '') {
            $stmt = $pdo->prepare("SELECT idunidad as id, unidad as name FROM unidades WHERE idunidad = ?");
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) err('Unidad no encontrada', 404);
            respond($row);
        }
        $rows = $pdo->query("SELECT idunidad as id, unidad as name FROM unidades ORDER BY idunidad")->fetchAll();
        respond($rows);
    }
    if ($method === 'POST') {
        if (empty($body['name'])) err('Nombre de unidad requerido');
        $stmt = $pdo->prepare("INSERT INTO unidades (unidad) VALUES (?)");
        $stmt->execute([$body['name']]);
        $newId = $pdo->lastInsertId();
        respond(['id' => $newId, 'name' => $body['name']], 201);
    }
    if ($method === 'PUT' && $id !== null && $id !== '') {
        if (empty($body['name'])) err('Nombre de unidad requerido');
        $stmt = $pdo->prepare("UPDATE unidades SET unidad = ? WHERE idunidad = ?");
        $stmt->execute([$body['name'], $id]);
        respond(['ok' => true]);
    }
    if ($method === 'DELETE' && $id !== null && $id !== '') {
        $stmt = $pdo->prepare("DELETE FROM unidades WHERE idunidad = ?");
        $stmt->execute([$id]);
        respond(['ok' => true]);
    }
    err('Método no soportado para unidades', 405);
}

// =============================================
// FAMILIAS (categorías de productos)
// =============================================
function handleFamilies($pdo) {
    $rows = $pdo->query("SELECT codfamilia as id, descripcion as name FROM familias ORDER BY descripcion")->fetchAll();
    respond($rows);
}

// =============================================
// CLIENTES
// =============================================
function handleClients($pdo, $method, $id, $body) {
    $baseSql = "
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
    ";

    if ($method === 'GET') {
        if ($id !== null && $id !== '') {
            $s = $pdo->prepare($baseSql . " AND codcliente = ?");
            $s->execute([$id]);
            $row = $s->fetch();
            if (!$row) err('Cliente no encontrado', 404);
            respond($row);
        }
        respond($pdo->query($baseSql . " ORDER BY nombre")->fetchAll());
    }

    if ($method === 'POST') {
        $row = $pdo->query("SELECT MAX(CAST(codcliente AS INTEGER)) as m FROM clientes")->fetch();
        $codCliente = (intval($row['m']) + 1);

        $pdo->prepare("
            INSERT INTO clientes
              (codcliente, nombre, razonsocial, rfc, email, telefono, direccion, ciudad, codpostal, provincia,
               pais, fechaalta, debaja, regimen_iva, tipo_id_fiscal, personafisica, riesgo_max, riesgo_alcanzado)
            VALUES (?,?,?,?,?,?,?,?,?,?,'MEX',CURRENT_DATE,0,'General','RFC',0,0,0)
        ")->execute([
            $codCliente, $body['name']??'', $body['name']??'', $body['rfc']??'',
            $body['email']??'', $body['phone']??'', $body['street']??'', $body['city']??'',
            $body['zip']??'', $body['province']??''
        ]);

        respond(['id' => $codCliente], 201);
    }

    if ($method === 'PUT' && $id !== null && $id !== '') {
        $pdo->prepare("UPDATE clientes SET nombre=?, razonsocial=?, rfc=?, email=?, telefono=?, direccion=?, ciudad=?, codpostal=?, provincia=? WHERE codcliente=?")
            ->execute([$body['name']??'', $body['name']??'', $body['rfc']??'', $body['email']??'', $body['phone']??'', $body['street']??'', $body['city']??'', $body['zip']??'', $body['province']??'', $id]);
        respond(['ok' => true]);
    }

    if ($method === 'DELETE' && $id !== null && $id !== '') {
        $pdo->prepare("UPDATE clientes SET debaja=1, fechabaja=CURRENT_DATE WHERE codcliente=?")->execute([$id]);
        respond(['ok' => true]);
    }
}

// =============================================
// PRODUCTOS
// =============================================
function handleProducts($pdo, $method, $id, $body) {
    $baseSql = "
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
    ";

    if ($method === 'GET') {
        if (isset($_GET['search']) && strlen($_GET['search']) > 0) {
            $q = '%' . $_GET['search'] . '%';
            $s = $pdo->prepare($baseSql . " WHERE p.referencia LIKE ? OR p.descripcion LIKE ? ORDER BY p.descripcion LIMIT 30");
            $s->execute([$q, $q]);
            respond($s->fetchAll());
        }
        if ($id !== null && $id !== '') {
            $s = $pdo->prepare($baseSql . " WHERE p.idproducto = ?");
            $s->execute([$id]);
            $row = $s->fetch();
            if (!$row) err('Producto no encontrado', 404);
            respond($row);
        }
        respond($pdo->query($baseSql . " ORDER BY p.descripcion")->fetchAll());
    }

    if ($method === 'POST') {
        $taxCode = getTaxCode($pdo, $body['tax'] ?? 16);
        $price   = floatval($body['price'] ?? 0);
        $cost    = floatval($body['cost'] ?? 0);
        $margin  = floatval($body['margin'] ?? 30);
        $nextId = intval($pdo->query("SELECT COALESCE(MAX(idproducto), 0) + 1 FROM productos")->fetchColumn());
        $pdo->prepare("
            INSERT INTO productos (idproducto, referencia, descripcion, precio, codfamilia, codimpuesto, costo, margen, iva, idunidad, fechaalta, observaciones)
            VALUES (?,?,?,?,?,?,?,?,?,?,CURRENT_DATE,?)
        ")->execute([$nextId, $body['code']??'', $body['name']??'', $price, $body['codfamilia']??'1', $taxCode, $cost, $margin, floatval($body['tax'] ?? 16), intval($body['idunidad'] ?? 1), $body['observaciones']??'']);
        respond(['id' => $nextId], 201);
    }

    if ($method === 'PUT' && $id !== null && $id !== '') {
        $taxCode  = getTaxCode($pdo, $body['tax'] ?? 16);
        $price    = floatval($body['price'] ?? 0);
        $cost     = floatval($body['cost'] ?? 0);
        $margin   = floatval($body['margin'] ?? 30);
        $tax      = floatval($body['tax'] ?? 16);
        $idunidad = intval($body['idunidad'] ?? 1);
        $code     = $body['code'] ?? '';
        $name     = $body['name'] ?? '';

        $stmtOld = $pdo->prepare("SELECT referencia FROM productos WHERE idproducto = ?");
        $stmtOld->execute([$id]);
        $oldProduct = $stmtOld->fetch();
        $oldCode = $oldProduct ? $oldProduct['referencia'] : '';

        $pdo->prepare("UPDATE productos SET referencia=?, descripcion=?, precio=?, codfamilia=?, codimpuesto=?, costo=?, margen=?, iva=?, idunidad=?, observaciones=? WHERE idproducto=?")
            ->execute([$code, $name, $price, $body['codfamilia']??'1', $taxCode, $cost, $margin, $tax, $idunidad, $body['observaciones']??'', $id]);

        if ($oldCode !== '') {
            // Actualizar líneas de presupuesto que usen este producto
            $pdo->prepare("
                UPDATE presupuestos_lineas
                SET codigo_producto = ?, producto = ?, precio_unitario = ?, iva_pct = ?, idunidad = ?,
                    total_linea = (cantidad * ?) * (1 + ? / 100)
                WHERE codigo_producto = ?
            ")->execute([$code, $name, $price, $tax, $idunidad, $price, $tax, $oldCode]);

            // Recalcular totales de presupuestos afectados
            $stmtAff = $pdo->prepare("SELECT DISTINCT idpresupuesto FROM presupuestos_lineas WHERE codigo_producto = ?");
            $stmtAff->execute([$code]);
            $affectedBudgets = $stmtAff->fetchAll(PDO::FETCH_COLUMN);

            foreach ($affectedBudgets as $bid) {
                $stmtTot = $pdo->prepare("
                    SELECT COALESCE(SUM(cantidad * precio_unitario), 0) as neto,
                           COALESCE(SUM(cantidad * precio_unitario * (iva_pct / 100)), 0) as iva,
                           COALESCE(SUM((cantidad * precio_unitario) * (1 + iva_pct / 100)), 0) as total
                    FROM presupuestos_lineas WHERE idpresupuesto = ?
                ");
                $stmtTot->execute([$bid]);
                $tots = $stmtTot->fetch();
                if ($tots) {
                    $pdo->prepare("UPDATE presupuestos SET neto = ?, iva = ?, total = ? WHERE idpresupuesto = ?")
                        ->execute([$tots['neto'], $tots['iva'], $tots['total'], $bid]);
                }
            }
        }

        respond(['ok' => true]);
    }

    if ($method === 'DELETE' && $id !== null && $id !== '') {
        $pdo->prepare("DELETE FROM productos WHERE idproducto=?")->execute([$id]);
        respond(['ok' => true]);
    }
}

function getTaxCode($pdo, $rate) {
    $s = $pdo->prepare("SELECT codimpuesto FROM impuestos WHERE iva = ? LIMIT 1");
    $s->execute([intval($rate)]);
    $row = $s->fetch();
    if ($row) return $row['codimpuesto'];
    $map = [0 => '001', 8 => '002', 16 => '003'];
    return $map[intval($rate)] ?? '003';
}

// =============================================
// DASHBOARD STATS
// =============================================
function handleDashboardStats($pdo) {
    $stmt = $pdo->query("SELECT COALESCE(SUM(total),0) as totalSales FROM presupuestos");
    $totalSales = $stmt->fetchColumn();

    $monthLabels = [];
    $monthTotals = [];
    for ($i = 5; $i >= 0; $i--) {
        $date = new DateTime();
        $date->modify("-{$i} month");
        $label = $date->format('M y');
        $year  = $date->format('Y');
        $month = $date->format('m');
        $stmt  = $pdo->prepare("SELECT COALESCE(SUM(total),0) as sum FROM presupuestos WHERE fecha >= ? AND fecha < ?");
        $stmt->execute(["$year-$month-01", date('Y-m-d', strtotime("$year-$month-01 +1 month"))]);
        $sum = $stmt->fetchColumn();
        $monthLabels[] = $label;
        $monthTotals[] = floatval($sum);
    }

    $stmt = $pdo->query("SELECT COALESCE(estado,'Pendiente') as status, COUNT(*) as cnt FROM presupuestos GROUP BY status");
    $statusRows   = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $statusCounts = [];
    foreach ($statusRows as $row) {
        $statusCounts[$row['status']] = (int)$row['cnt'];
    }

    respond([
        'totalSales'   => floatval($totalSales),
        'monthLabels'  => $monthLabels,
        'monthTotals'  => $monthTotals,
        'statusCounts' => $statusCounts
    ]);
}

// =============================================
// PRESUPUESTOS
// =============================================
function handleBudgets($pdo, $method, $id, $body, $currentUsername = 'admin') {
    if ($method === 'GET') {
        if ($id !== null && $id !== '') {
            $s = $pdo->prepare("
                SELECT p.idpresupuesto as id, p.codigo, p.codcliente as clientId,
                       COALESCE(p.fecha,'') as date, COALESCE(p.neto,0) as neto, COALESCE(p.iva,0) as totaliva, COALESCE(p.total,0) as total,
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
                WHERE p.idpresupuesto = ?
            ");
            $s->execute([$id]);
            $budget = $s->fetch();
            if (!$budget) err('Presupuesto no encontrado', 404);

            $sl = $pdo->prepare("
                SELECT l.idlinea as id, l.codigo_producto as productCode, l.producto as productName,
                       l.cantidad as qty, l.precio_unitario as price, l.iva_pct as tax, l.idunidad as idunidad,
                       l.total_linea as lineTotal,
                       (SELECT p2.idproducto FROM productos p2 WHERE p2.referencia = l.codigo_producto LIMIT 1) as productId
                FROM presupuestos_lineas l
                WHERE l.idpresupuesto = ? ORDER BY l.idlinea
            ");
            $sl->execute([$id]);
            $budget['items'] = $sl->fetchAll();
            respond($budget);
        }

        respond($pdo->query("
            SELECT p.idpresupuesto as id, p.codigo, p.codcliente as clientId,
                   COALESCE(p.fecha,'') as date, COALESCE(p.neto,0) as neto, COALESCE(p.iva,0) as totaliva, COALESCE(p.total,0) as total,
                   COALESCE(p.estado,'Abierto') as status,
                   COALESCE(p.cliente,'') as clientName
            FROM presupuestos p
            ORDER BY p.fecha DESC, p.idpresupuesto DESC LIMIT 1000
        ")->fetchAll());
    }

    if ($method === 'POST') {
        if (empty($body['clientId'])) err('Cliente requerido');
        if (empty($body['items']))    err('Se requiere al menos un producto');

        $date  = $body['date'] ?? date('Y-m-d');
        $year  = substr($date, 0, 4);
        $serie = DB_SERIE;

        // Datos del cliente
        $cs = $pdo->prepare("SELECT nombre, rfc, email, telefono, COALESCE(forma_pago,'CONT') as forma_pago FROM clientes WHERE codcliente=?");
        $cs->execute([$body['clientId']]);
        $client = $cs->fetch();
        if (!$client) err('Cliente no encontrado');

        // Siguiente número
        $ns = $pdo->prepare("SELECT MAX(numero) as m FROM presupuestos WHERE codejercicio=? AND codserie=?");
        $ns->execute([$year, $serie]);
        $nextNum = intval($ns->fetch()['m']) + 1;
        $codigo  = "PRE{$year}{$serie}{$nextNum}";

        // Totales
        $neto = 0; $totalIva = 0;
        foreach ($body['items'] as $item) {
            $sub = floatval($item['price']) * floatval($item['qty']);
            $neto     += $sub;
            $totalIva += $sub * (floatval($item['tax']) / 100);
        }
        $total = $neto + $totalIva;

        // Insertar cabecera
        $budgetId = intval($pdo->query("SELECT COALESCE(MAX(idpresupuesto), 0) + 1 FROM presupuestos")->fetchColumn());
        $pdo->prepare("
            INSERT INTO presupuestos
              (idpresupuesto, codigo, codcliente, cliente, rfc_cliente, email_cliente, telefono_cliente,
               fecha, codserie, codejercicio, numero, estado, neto, iva, total,
               forma_pago, divisa, usuario, observaciones, editable)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)
        ")->execute([
            $budgetId, $codigo, $body['clientId'], $client['nombre'], $client['rfc'], $client['email'], $client['telefono'],
            $date, $serie, $year, $nextNum, 'Abierto',
            $neto, $totalIva, $total,
            $client['forma_pago'], DB_DIVISA,
            $currentUsername, $body['observaciones'] ?? ''
        ]);

        // Insertar líneas
        $lineNum = 1;
        foreach ($body['items'] as $item) {
            $sub     = floatval($item['price']) * floatval($item['qty']);
            $lineIva = $sub * (floatval($item['tax']) / 100);
            $pdo->prepare("
                INSERT INTO presupuestos_lineas
                  (idlinea, idpresupuesto, folio, codcliente, cliente, fecha, codigo_producto, producto, cantidad, idunidad, precio_unitario, iva_pct, descuento, total_linea, coste)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,0)
            ")->execute([
                $lineNum++,
                $budgetId,
                $codigo,
                $body['clientId'],
                $client['nombre'],
                $date,
                $item['productCode'] ?? '',
                $item['productName'] ?? '',
                floatval($item['qty']),
                intval($item['idunidad'] ?? 1),
                floatval($item['price']),
                intval($item['tax']),
                $sub + $lineIva
            ]);
        }

        respond(['id' => $budgetId, 'codigo' => $codigo], 201);
    }

    if ($method === 'DELETE' && $id !== null && $id !== '') {
        $pdo->prepare("DELETE FROM presupuestos_lineas WHERE idpresupuesto=?")->execute([$id]);
        $pdo->prepare("DELETE FROM presupuestos WHERE idpresupuesto=?")->execute([$id]);
        respond(['ok' => true]);
    }

    if ($method === 'PUT' && $id !== null && $id !== '') {
        // Solo actualizar estado
        if (!empty($body['status']) && empty($body['items'])) {
            $pdo->prepare("UPDATE presupuestos SET estado=? WHERE idpresupuesto=?")->execute([$body['status'], $id]);
            respond(['ok' => true]);
        }

        // Actualización completa del presupuesto (edición)
        if (!empty($body['items'])) {
            $date = $body['date'] ?? date('Y-m-d');

            // Recalcular totales
            $neto = 0; $totalIva = 0;
            foreach ($body['items'] as $item) {
                $sub = floatval($item['price']) * floatval($item['qty']);
                $neto     += $sub;
                $totalIva += $sub * (floatval($item['tax']) / 100);
            }
            $total = $neto + $totalIva;

            // Actualizar cabecera
            $pdo->prepare("
                UPDATE presupuestos
                SET codcliente=?, fecha=?, neto=?, iva=?, total=?, observaciones=?
                WHERE idpresupuesto=?
            ")->execute([
                $body['clientId'], $date, $neto, $totalIva, $total,
                $body['observaciones'] ?? '', $id
            ]);

            // Reemplazar líneas
            $cs = $pdo->prepare("SELECT codigo, codcliente, cliente, fecha FROM presupuestos WHERE idpresupuesto=?");
            $cs->execute([$id]);
            $bHeader = $cs->fetch();

            $pdo->prepare("DELETE FROM presupuestos_lineas WHERE idpresupuesto=?")->execute([$id]);
            $lineNum = 1;
            foreach ($body['items'] as $item) {
                $sub     = floatval($item['price']) * floatval($item['qty']);
                $lineIva = $sub * (floatval($item['tax']) / 100);
                $pdo->prepare("
                    INSERT INTO presupuestos_lineas
                      (idlinea, idpresupuesto, folio, codcliente, cliente, fecha, codigo_producto, producto, cantidad, idunidad, precio_unitario, iva_pct, descuento, total_linea, coste)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,0)
                ")->execute([
                    $lineNum++,
                    $id,
                    $bHeader['codigo'],
                    $bHeader['codcliente'],
                    $bHeader['cliente'],
                    $bHeader['fecha'],
                    $item['productCode'] ?? '',
                    $item['productName'] ?? '',
                    floatval($item['qty']),
                    intval($item['idunidad'] ?? 1),
                    floatval($item['price']),
                    intval($item['tax']),
                    $sub + $lineIva
                ]);
            }
            respond(['ok' => true]);
        }

        err('Datos insuficientes para actualizar', 400);
    }
}
?>
