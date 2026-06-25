<?php
// ============================================================
// api.php — REST API para Sistema de Presupuestos Suncatcher
// ============================================================
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// --- Supabase REST API ---
define('SB_URL',     'https://ewrhzalwcnzclhjortfp.supabase.co');
define('SB_KEY',     'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3cmh6YWx3Y256Y2xoam9ydGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MDQwMTcsImV4cCI6MjA5Nzk4MDAxN30.OO7iVtklBkZwgII2nw8UTpVqv4UQuWQ9kg5IntpppCk');
define('DB_DIVISA',  'MXN');
define('DB_SERIE',   'A');

// --- Sesión ---
session_start();

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

// ── Supabase REST helper ──────────────────────────────────────
function sb_req($method, $path, $body = null, $extraHeaders = []) {
    $url = SB_URL . $path;
    $headers = array_merge([
        'apikey: '               . SB_KEY,
        'Authorization: Bearer ' . SB_KEY,
        'Content-Type: application/json',
        'Prefer: return=representation',
    ], $extraHeaders);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    $resp   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $cerr   = curl_error($ch);
    curl_close($ch);
    if ($cerr) { http_response_code(500); die(json_encode(['error' => 'cURL: ' . $cerr])); }
    // 204 No Content es éxito sin cuerpo
    if ($status === 204) return [];
    $decoded = json_decode($resp, true);
    if ($status >= 400) { http_response_code($status); die(json_encode(['error' => $decoded['message'] ?? $resp])); }
    return $decoded ?? [];
}

function sb_query($table, $select = '*', $filters = []) {
    $qs = 'select=' . urlencode($select);
    foreach ($filters as $k => $v) {
        // 'order' y 'limit' no llevan el prefijo 'eq.'
        $qs .= '&' . urlencode($k) . '=' . urlencode($v);
    }
    return sb_req('GET', '/rest/v1/' . $table . '?' . $qs) ?? [];
}
function sb_insert($table, $data) {
    return sb_req('POST', '/rest/v1/' . $table, $data);
}
function sb_update($table, $filters, $data) {
    $qs = '';
    foreach ($filters as $k => $v) $qs .= ($qs ? '&' : '') . urlencode($k) . '=eq.' . urlencode($v);
    return sb_req('PATCH', '/rest/v1/' . $table . '?' . $qs, $data);
}
function sb_delete($table, $filters) {
    $qs = '';
    foreach ($filters as $k => $v) $qs .= ($qs ? '&' : '') . urlencode($k) . '=eq.' . urlencode($v);
    return sb_req('DELETE', '/rest/v1/' . $table . '?' . $qs);
}
function sb_rpc($fn, $params = []) {
    return sb_req('POST', '/rest/v1/rpc/' . $fn, $params);
}

// ---- Endpoint de Login (sin autenticación previa) ----
if ($resource === 'login') {
    if ($method === 'POST') {
        $user = trim($body['username'] ?? '');
        $pass = $body['password'] ?? '';
        $rows = sb_query('usuarios', '*', ['usuario' => 'eq.' . $user]);
        $userData = $rows[0] ?? null;

        $passOk = false;
        if ($userData) {
            $passOk = str_starts_with($userData['contrasena'] ?? '', '$2y$')
                ? password_verify($pass, $userData['contrasena'])
                : (($userData['contrasena'] ?? '') === $pass);
        }

        if ($userData && $passOk) {
            $_SESSION['logged_in'] = true;
            $_SESSION['username']  = $userData['usuario'];
            respond(['success' => true, 'username' => $userData['usuario']]);
        } else {
            err('Usuario o contraseña incorrectos', 401);
        }
    }
    err('Método no permitido', 405);
}

// ---- Endpoint de Logout ----
if ($resource === 'logout') {
    session_destroy();
    respond(['success' => true]);
}

// ---- Verificar sesión para el resto de recursos ----
if (empty($_SESSION['logged_in'])) {
    if ($resource !== 'check_session') {
        err('No autorizado. Por favor inicia sesión.', 401);
    }
}

// ---- check_session: responde OK solo si hay sesión activa ----
if ($resource === 'check_session') {
    if (!empty($_SESSION['logged_in'])) {
        respond(['logged_in' => true, 'username' => $_SESSION['username'] ?? 'admin']);
    }
    err('No autorizado', 401);
}

switch ($resource) {
    case 'settings':
        if ($method === 'GET') {
            $settingsFile = 'settings.json';
            if (file_exists($settingsFile)) respond(json_decode(file_get_contents($settingsFile), true));
            else respond([]);
        }
        if ($method === 'POST' || $method === 'PUT') {
            $written = file_put_contents('settings.json', json_encode($body, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            if ($written === false) {
                err('No se pudo guardar la configuración. Verifica permisos.', 500);
            }
            respond(['success' => true]);
        }
        break;
    case 'clients':   handleClients($method, $id, $body);   break;
    case 'products':  handleProducts($method, $id, $body);  break;
    case 'budgets':   handleBudgets($method, $id, $body);   break;
    case 'families':  handleFamilies();                     break;
    case 'unidades':  handleUnidades($method, $id, $body);  break;
    case 'dashboard-stats': handleDashboardStats(); break;
    default: err('Recurso no encontrado', 404);
}

// =============================================
// UNIDADES
// =============================================
function handleUnidades($method, $id = null, $body = null) {
    if ($method === 'GET') {
        if ($id !== null && $id !== '') {
            $rows = sb_query('unidades', 'idunidad,unidad', ['idunidad' => 'eq.' . $id]);
            if (empty($rows)) err('Unidad no encontrada', 404);
            respond(['id' => $rows[0]['idunidad'], 'name' => $rows[0]['unidad']]);
        }
        $rows = sb_req('GET', '/rest/v1/unidades?select=idunidad,unidad&order=idunidad.asc');
        respond(array_map(fn($r) => ['id' => $r['idunidad'], 'name' => $r['unidad']], $rows));
    }
    if ($method === 'POST') {
        if (empty($body['name'])) err('Nombre de unidad requerido');
        $all  = sb_query('unidades', 'idunidad');
        $ids  = array_column($all, 'idunidad');
        $newId = $ids ? (max($ids) + 1) : 1;
        sb_insert('unidades', ['idunidad' => $newId, 'unidad' => $body['name']]);
        respond(['id' => $newId, 'name' => $body['name']], 201);
    }
    if ($method === 'PUT' && $id !== null && $id !== '') {
        if (empty($body['name'])) err('Nombre de unidad requerido');
        sb_update('unidades', ['idunidad' => $id], ['unidad' => $body['name']]);
        respond(['ok' => true]);
    }
    if ($method === 'DELETE' && $id !== null && $id !== '') {
        sb_delete('unidades', ['idunidad' => $id]);
        respond(['ok' => true]);
    }
    err('Método no soportado para unidades', 405);
}

// =============================================
// FAMILIAS
// =============================================
function handleFamilies() {
    $rows = sb_req('GET', '/rest/v1/familias?select=codfamilia,descripcion&order=descripcion.asc') ?? [];
    respond(array_map(fn($r) => ['id' => $r['codfamilia'], 'name' => $r['descripcion']], $rows));
}

// =============================================
// CLIENTES
// =============================================
function handleClients($method, $id, $body) {
    if ($method === 'GET') {
        if ($id !== null && $id !== '') {
            // Búsqueda por ID no filtra debaja (para edición/detalle)
            $rows = sb_query('clientes', 'codcliente,nombre,rfc,email,telefono,direccion,ciudad,codpostal,provincia', ['codcliente' => 'eq.' . $id]);
            if (empty($rows)) err('Cliente no encontrado', 404);
            $r = $rows[0];
            respond(['id'=>$r['codcliente'],'name'=>$r['nombre'],'rfc'=>$r['rfc']??'','email'=>$r['email']??'','phone'=>$r['telefono']??'','street'=>$r['direccion']??'','city'=>$r['ciudad']??'','zip'=>$r['codpostal']??'','province'=>$r['provincia']??'']);
        }
        $rows = sb_req('GET', '/rest/v1/clientes?select=codcliente,nombre,rfc,email,telefono,direccion,ciudad,codpostal,provincia&debaja=eq.0&order=nombre.asc');
        respond(array_map(fn($r) => ['id'=>$r['codcliente'],'name'=>$r['nombre'],'rfc'=>$r['rfc']??'','email'=>$r['email']??'','phone'=>$r['telefono']??'','street'=>$r['direccion']??'','city'=>$r['ciudad']??'','zip'=>$r['codpostal']??'','province'=>$r['provincia']??''], $rows));
    }
    if ($method === 'POST') {
        $all = sb_query('clientes', 'codcliente');
        $ids = array_column($all, 'codcliente');
        $codCliente = $ids ? (max($ids) + 1) : 1;
        sb_insert('clientes', [
            'codcliente'=>$codCliente,'nombre'=>$body['name']??'','razonsocial'=>$body['name']??'',
            'rfc'=>$body['rfc']??'','email'=>$body['email']??'','telefono'=>$body['phone']??'',
            'direccion'=>$body['street']??'','ciudad'=>$body['city']??'','codpostal'=>$body['zip']??'',
            'provincia'=>$body['province']??'','pais'=>'MEX','fechaalta'=>date('Y-m-d'),
            'debaja'=>0,'regimen_iva'=>'General','tipo_id_fiscal'=>'RFC','personafisica'=>0,'riesgo_max'=>0,'riesgo_alcanzado'=>0
        ]);
        respond(['id' => $codCliente], 201);
    }
    if ($method === 'PUT' && $id !== null && $id !== '') {
        sb_update('clientes', ['codcliente' => $id], [
            'nombre'=>$body['name']??'','razonsocial'=>$body['name']??'','rfc'=>$body['rfc']??'',
            'email'=>$body['email']??'','telefono'=>$body['phone']??'','direccion'=>$body['street']??'',
            'ciudad'=>$body['city']??'','codpostal'=>$body['zip']??'','provincia'=>$body['province']??''
        ]);
        respond(['ok' => true]);
    }
    if ($method === 'DELETE' && $id !== null && $id !== '') {
        sb_update('clientes', ['codcliente' => $id], ['debaja' => 1, 'fechabaja' => date('Y-m-d')]);
        respond(['ok' => true]);
    }
}

// =============================================
// PRODUCTOS
// =============================================
function handleProducts($method, $id, $body) {
    $select = 'idproducto,referencia,descripcion,familia,codfamilia,idunidad,iva,costo,precio,margen,observaciones';

    if ($method === 'GET') {
        if (isset($_GET['search']) && strlen($_GET['search']) > 0) {
            $q = '%' . $_GET['search'] . '%';
            $rows = sb_req('GET', '/rest/v1/productos?select=' . $select . '&descripcion=ilike.' . urlencode($q) . '&order=descripcion.asc&limit=30');
            respond(array_map('mapProduct', $rows ?? []));
        }
        if ($id !== null && $id !== '') {
            $rows = sb_query('productos', $select, ['idproducto' => 'eq.' . $id]);
            if (empty($rows)) err('Producto no encontrado', 404);
            respond(mapProduct($rows[0]));
        }
        $rows = sb_req('GET', '/rest/v1/productos?select=' . $select . '&order=descripcion.asc');
        respond(array_map('mapProduct', $rows));
    }
    if ($method === 'POST') {
        $taxCode = getTaxCode($body['tax'] ?? 16);
        $all = sb_query('productos', 'idproducto');
        $ids = array_column($all, 'idproducto');
        $nextId = $ids ? (max($ids) + 1) : 1;
        sb_insert('productos', [
            'idproducto'=>$nextId,'referencia'=>$body['code']??'','descripcion'=>$body['name']??'',
            'precio'=>floatval($body['price']??0),'codfamilia'=>intval($body['codfamilia']??1),
            'codimpuesto'=>$taxCode,'costo'=>floatval($body['cost']??0),'margen'=>floatval($body['margin']??30),
            'iva'=>floatval($body['tax']??16),'idunidad'=>intval($body['idunidad']??1),
            'fechaalta'=>date('Y-m-d'),'observaciones'=>$body['observaciones']??''
        ]);
        respond(['id' => $nextId], 201);
    }
    if ($method === 'PUT' && $id !== null && $id !== '') {
        $taxCode = getTaxCode($body['tax'] ?? 16);
        $price   = floatval($body['price'] ?? 0);
        $tax     = floatval($body['tax'] ?? 16);
        $idunidad= intval($body['idunidad'] ?? 1);
        $code    = $body['code'] ?? '';
        // Obtener código anterior
        $old = sb_query('productos', 'referencia', ['idproducto' => 'eq.' . $id]);
        $oldCode = $old[0]['referencia'] ?? '';
        sb_update('productos', ['idproducto' => $id], [
            'referencia'=>$code,'descripcion'=>$body['name']??'','precio'=>$price,
            'codfamilia'=>intval($body['codfamilia']??1),'codimpuesto'=>$taxCode,
            'costo'=>floatval($body['cost']??0),'margen'=>floatval($body['margin']??30),
            'iva'=>$tax,'idunidad'=>$idunidad,'observaciones'=>$body['observaciones']??''
        ]);
        // Actualizar líneas de presupuestos que usen este producto
        if ($oldCode !== '') {
            $lineas = sb_query('presupuestos_lineas', 'idlinea,idpresupuesto,cantidad', ['codigo_producto' => 'eq.' . $oldCode]);
            foreach ($lineas as $l) {
                $sub = floatval($l['cantidad']) * $price;
                sb_update('presupuestos_lineas', ['idlinea' => $l['idlinea']], [
                    'codigo_producto'=>$code,'producto'=>$body['name']??'',
                    'precio_unitario'=>$price,'iva_pct'=>$tax,'idunidad'=>$idunidad,
                    'total_linea'=>$sub * (1 + $tax / 100)
                ]);
            }
            // Recalcular totales de presupuestos afectados
            $bids = array_unique(array_column($lineas, 'idpresupuesto'));
            foreach ($bids as $bid) {
                $ls = sb_query('presupuestos_lineas', 'cantidad,precio_unitario,iva_pct', ['idpresupuesto' => 'eq.' . $bid]);
                $neto = 0; $iva = 0;
                foreach ($ls as $l) { $s = floatval($l['cantidad']) * floatval($l['precio_unitario']); $neto += $s; $iva += $s * (floatval($l['iva_pct']) / 100); }
                sb_update('presupuestos', ['idpresupuesto' => $bid], ['neto'=>$neto,'iva'=>$iva,'total'=>$neto+$iva]);
            }
        }
        respond(['ok' => true]);
    }
    if ($method === 'DELETE' && $id !== null && $id !== '') {
        sb_delete('productos', ['idproducto' => $id]);
        respond(['ok' => true]);
    }
}

function mapProduct($r) {
    return [
        'id'=>$r['idproducto'],'code'=>$r['referencia'],'name'=>$r['descripcion'],
        'category'=>$r['familia']??'General','codfamilia'=>$r['codfamilia'],
        'idunidad'=>$r['idunidad']??1,'tax'=>$r['iva']??16,
        'cost'=>$r['costo']??0,'price'=>$r['precio']??0,
        'margin'=>$r['margen']??30,'observaciones'=>$r['observaciones']??''
    ];
}

function getTaxCode($rate) {
    $rows = sb_req('GET', '/rest/v1/impuestos?select=codimpuesto&iva=eq.' . intval($rate) . '&limit=1');
    if (!empty($rows)) return $rows[0]['codimpuesto'];
    $map = [0 => '001', 8 => '002', 16 => '003'];
    return $map[intval($rate)] ?? '003';
}

// =============================================
// DASHBOARD STATS
// =============================================
function handleDashboardStats() {
    $all = sb_query('presupuestos', 'total,fecha,estado');
    $totalSales = array_sum(array_column($all, 'total'));

    $monthLabels = []; $monthTotals = [];
    for ($i = 5; $i >= 0; $i--) {
        $d     = new DateTime(); $d->modify("-{$i} month");
        $from  = $d->format('Y-m') . '-01';
        $to    = date('Y-m-d', strtotime($from . ' +1 month'));
        $label = $d->format('M y');
        $sum   = 0;
        foreach ($all as $p) { if ($p['fecha'] >= $from && $p['fecha'] < $to) $sum += floatval($p['total']); }
        $monthLabels[] = $label; $monthTotals[] = $sum;
    }

    $statusCounts = [];
    foreach ($all as $p) { $s = $p['estado'] ?? 'Pendiente'; $statusCounts[$s] = ($statusCounts[$s] ?? 0) + 1; }

    respond(['totalSales'=>floatval($totalSales),'monthLabels'=>$monthLabels,'monthTotals'=>$monthTotals,'statusCounts'=>$statusCounts]);
}

// =============================================
// PRESUPUESTOS
// =============================================
function handleBudgets($method, $id, $body) {
    if ($method === 'GET') {
        if ($id !== null && $id !== '') {
            $rows = sb_query('presupuestos', '*', ['idpresupuesto' => 'eq.' . $id]);
            if (empty($rows)) err('Presupuesto no encontrado', 404);
            $p = $rows[0];
            // Obtener datos del cliente
            $cli = sb_query('clientes', 'direccion,ciudad,codpostal', ['codcliente' => 'eq.' . $p['codcliente']]);
            $c   = $cli[0] ?? [];
            // Obtener líneas
            $lineas = sb_req('GET', '/rest/v1/presupuestos_lineas?select=*&idpresupuesto=eq.' . $id . '&order=idlinea.asc');
            $items = array_map(function($l) {
                $prod = sb_query('productos', 'idproducto', ['referencia' => 'eq.' . ($l['codigo_producto'] ?? '')]);
                return [
                    'id'=>$l['idlinea'],'productCode'=>$l['codigo_producto'],'productName'=>$l['producto'],
                    'qty'=>$l['cantidad'],'price'=>$l['precio_unitario'],'tax'=>$l['iva_pct'],
                    'idunidad'=>$l['idunidad'],'lineTotal'=>$l['total_linea'],
                    'productId'=>$prod[0]['idproducto'] ?? null
                ];
            }, $lineas);
            respond([
                'id'=>$p['idpresupuesto'],'codigo'=>$p['codigo'],'clientId'=>$p['codcliente'],
                'date'=>$p['fecha']??'','neto'=>$p['neto']??0,'totaliva'=>$p['iva']??0,'total'=>$p['total']??0,
                'observaciones'=>$p['observaciones']??'','status'=>$p['estado']??'Abierto',
                'clientName'=>$p['cliente']??'','clientRfc'=>$p['rfc_cliente']??'',
                'clientEmail'=>$p['email_cliente']??'','clientPhone'=>$p['telefono_cliente']??'',
                'clientStreet'=>$c['direccion']??'','clientCity'=>$c['ciudad']??'','clientZip'=>$c['codpostal']??'',
                'items'=>$items
            ]);
        }
        $rows = sb_req('GET', '/rest/v1/presupuestos?select=idpresupuesto,codigo,codcliente,fecha,neto,iva,total,estado,cliente&order=fecha.desc,idpresupuesto.desc&limit=1000');
        respond(array_map(fn($p) => [
            'id'=>$p['idpresupuesto'],'codigo'=>$p['codigo'],'clientId'=>$p['codcliente'],
            'date'=>$p['fecha']??'','neto'=>$p['neto']??0,'totaliva'=>$p['iva']??0,'total'=>$p['total']??0,
            'status'=>$p['estado']??'Abierto','clientName'=>$p['cliente']??''
        ], $rows));
    }

    if ($method === 'POST') {
        if (empty($body['clientId'])) err('Cliente requerido');
        if (empty($body['items']))    err('Se requiere al menos un producto');

        $date  = $body['date'] ?? date('Y-m-d');
        $year  = substr($date, 0, 4);
        $serie = DB_SERIE;

        $cli = sb_query('clientes', 'nombre,rfc,email,telefono,forma_pago', ['codcliente' => 'eq.' . $body['clientId']]);
        if (empty($cli)) err('Cliente no encontrado');
        $client = $cli[0];

        $existing = sb_req('GET', '/rest/v1/presupuestos?select=numero&codejercicio=eq.' . intval($year) . '&codserie=eq.' . urlencode($serie) . '&order=numero.desc&limit=1');
        $nextNum  = ($existing ? intval($existing[0]['numero']) : 0) + 1;
        $codigo   = "PRE{$year}{$serie}{$nextNum}";

        $neto = 0; $totalIva = 0;
        foreach ($body['items'] as $item) { $sub = floatval($item['price']) * floatval($item['qty']); $neto += $sub; $totalIva += $sub * (floatval($item['tax']) / 100); }
        $total = $neto + $totalIva;

        $allP     = sb_query('presupuestos', 'idpresupuesto');
        $budgetId = $allP ? (max(array_column($allP, 'idpresupuesto')) + 1) : 1;

        sb_insert('presupuestos', [
            'idpresupuesto'=>$budgetId,'codigo'=>$codigo,'codcliente'=>intval($body['clientId']),
            'cliente'=>$client['nombre'],'rfc_cliente'=>$client['rfc']??'',
            'email_cliente'=>$client['email']??'','telefono_cliente'=>$client['telefono']??'',
            'fecha'=>$date,'codserie'=>$serie,'codejercicio'=>intval($year),'numero'=>$nextNum,
            'estado'=>'Abierto','neto'=>$neto,'iva'=>$totalIva,'total'=>$total,
            'forma_pago'=>$client['forma_pago']??'CONT','divisa'=>DB_DIVISA,
            'usuario'=>$_SESSION['username']??'admin','observaciones'=>$body['observaciones']??'','editable'=>1
        ]);

        $lineNum = 1;
        foreach ($body['items'] as $item) {
            $sub = floatval($item['price']) * floatval($item['qty']);
            $lineIva = $sub * (floatval($item['tax']) / 100);
            sb_insert('presupuestos_lineas', [
                'idlinea'=>$lineNum++,'idpresupuesto'=>$budgetId,'folio'=>$codigo,
                'codcliente'=>intval($body['clientId']),'cliente'=>$client['nombre'],'fecha'=>$date,
                'codigo_producto'=>$item['productCode']??'','producto'=>$item['productName']??'',
                'cantidad'=>floatval($item['qty']),'idunidad'=>intval($item['idunidad']??1),
                'precio_unitario'=>floatval($item['price']),'iva_pct'=>intval($item['tax']),
                'descuento'=>0,'total_linea'=>$sub+$lineIva,'coste'=>0
            ]);
        }
        respond(['id' => $budgetId, 'codigo' => $codigo], 201);
    }

    if ($method === 'DELETE' && $id !== null && $id !== '') {
        sb_delete('presupuestos_lineas', ['idpresupuesto' => $id]);
        sb_delete('presupuestos', ['idpresupuesto' => $id]);
        respond(['ok' => true]);
    }

    if ($method === 'PUT' && $id !== null && $id !== '') {
        // Solo estado
        if (!empty($body['status']) && empty($body['items'])) {
            sb_update('presupuestos', ['idpresupuesto' => $id], ['estado' => $body['status']]);
            respond(['ok' => true]);
        }
        // Edición completa
        if (!empty($body['items'])) {
            $date = $body['date'] ?? date('Y-m-d');
            $neto = 0; $totalIva = 0;
            foreach ($body['items'] as $item) { $sub = floatval($item['price']) * floatval($item['qty']); $neto += $sub; $totalIva += $sub * (floatval($item['tax']) / 100); }
            $total = $neto + $totalIva;
            sb_update('presupuestos', ['idpresupuesto' => $id], [
                'codcliente'=>intval($body['clientId']),'fecha'=>$date,
                'neto'=>$neto,'iva'=>$totalIva,'total'=>$total,'observaciones'=>$body['observaciones']??''
            ]);
            $header = sb_query('presupuestos', 'codigo,codcliente,cliente,fecha', ['idpresupuesto' => 'eq.' . $id]);
            $h = $header[0] ?? [];
            sb_delete('presupuestos_lineas', ['idpresupuesto' => $id]);
            $lineNum = 1;
            foreach ($body['items'] as $item) {
                $sub = floatval($item['price']) * floatval($item['qty']);
                $lineIva = $sub * (floatval($item['tax']) / 100);
                sb_insert('presupuestos_lineas', [
                    'idlinea'=>$lineNum++,'idpresupuesto'=>intval($id),'folio'=>$h['codigo']??'',
                    'codcliente'=>intval($h['codcliente']??0),'cliente'=>$h['cliente']??'','fecha'=>$h['fecha']??$date,
                    'codigo_producto'=>$item['productCode']??'','producto'=>$item['productName']??'',
                    'cantidad'=>floatval($item['qty']),'idunidad'=>intval($item['idunidad']??1),
                    'precio_unitario'=>floatval($item['price']),'iva_pct'=>intval($item['tax']),
                    'descuento'=>0,'total_linea'=>$sub+$lineIva,'coste'=>0
                ]);
            }
            respond(['ok' => true]);
        }
        err('Datos insuficientes para actualizar', 400);
    }
}
