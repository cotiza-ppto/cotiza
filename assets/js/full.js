
// ============================================
// CONFIGURACIÓN (LocalStorage)
// ============================================
const DEFAULT_SETTINGS = {
    company: {
        name: "Comercializadora Suncatcher del Norte",
        legalName: "Comercializadora Suncatcher del Norte",
        rfc: "CSN200210B44",
        address: "ALFARAZ 3595, RESIDENCIAL SEVILLA 2DA SECCIÓN",
        phone: "6865926825",
        email: "ventas@suncatcher.com.mx",
        logoUrl: "uploads/logo_1780351317.png"
    },
    smtp: { host: "smtp.gmail.com", port: 587, user: "", password: "", fromName: "Suncatcher del Norte", fromEmail: "" },
    system: { currency: "MXN", locale: "es-MX", defaultTaxRate: 16, budgetValidityDays: 15, invoicePrefix: "PRE", autoSaveBudgets: true },
    docConfig: {
        presupuesto: { logoUrl: "uploads/logo_1780351317.png", color: '#0f6dc1', rowHeight: 'py-2' },
        recibo:      { logoUrl: "uploads/logo_1780351317.png", color: '#0f6dc1', rowHeight: 'py-3' }
    }
};

function getSettings() {
    try {
        const s = localStorage.getItem('suncatcher_settings');
        if (s) {
            const p = JSON.parse(s);
            const merged = { company: { ...DEFAULT_SETTINGS.company, ...p.company }, smtp: { ...DEFAULT_SETTINGS.smtp, ...p.smtp }, system: { ...DEFAULT_SETTINGS.system, ...p.system }, docConfig: { ...DEFAULT_SETTINGS.docConfig, ...p.docConfig } };
            if (!merged.docConfig) merged.docConfig = DEFAULT_SETTINGS.docConfig;
            return merged;
        }
    } catch(e) {}
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}
function saveSettings(s) {
    try { localStorage.setItem('suncatcher_settings', JSON.stringify(s)); return true; } catch(e) { return false; }
}
let APP_SETTINGS = getSettings();

// ============================================
// API CLIENT
// ============================================
const api = {
    async request(method, resource, id = null, body = null) {
        let url = `api.php?resource=${resource}`;
        if (id !== null && id !== undefined) url += `&id=${encodeURIComponent(id)}`;
        const opts = { method };
        if (body) { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body); }
        const res = await fetch(url, opts);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Error HTTP ${res.status}`);
        return data;
    },
    get:  (r, id)       => api.request('GET',    r, id),
    post: (r, body)     => api.request('POST',   r, null, body),
    put:  (r, id, body) => api.request('PUT',    r, id,   body),
    del:  (r, id)       => api.request('DELETE', r, id),
};

// ============================================
// CACHE (espejo local de la BD)
// ============================================
const cache = { clients: [], products: [], budgets: [], families: [], unidades: [] };

const BRAND_COLOR = "#0f6dc1";

// ============================================
// APP
// ============================================
const app = {
    currentView: 'dashboard',

    // --- Helpers ---
    setLoading(msg = 'Cargando...') {
        document.getElementById('content-area').innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                <i class="fas fa-circle-notch fa-spin text-3xl" style="color:${BRAND_COLOR}"></i>
                <span>${msg}</span>
            </div>`;
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat(APP_SETTINGS.system.locale, { style: 'currency', currency: APP_SETTINGS.system.currency }).format(amount);
    },

    numeroALetras(num) {
        if (!num || num === 0) return 'CERO PESOS 00/100';
        const centavos = Math.round((num - Math.floor(num)) * 100);
        const centavosStr = centavos.toString().padStart(2, '0') + '/100';
        
        function Unidades(num) {
            switch(num) {
                case 1: return 'UN'; case 2: return 'DOS'; case 3: return 'TRES'; case 4: return 'CUATRO'; case 5: return 'CINCO';
                case 6: return 'SEIS'; case 7: return 'SIETE'; case 8: return 'OCHO'; case 9: return 'NUEVE'; default: return '';
            }
        }
        function Decenas(num) {
            const decena = Math.floor(num/10), unidad = num-(decena*10);
            switch(decena) {
                case 1:
                    switch(unidad) {
                        case 0: return 'DIEZ'; case 1: return 'ONCE'; case 2: return 'DOCE'; case 3: return 'TRECE';
                        case 4: return 'CATORCE'; case 5: return 'QUINCE'; default: return 'DIECI' + Unidades(unidad);
                    }
                case 2: return unidad === 0 ? 'VEINTE' : 'VEINTI' + Unidades(unidad);
                case 3: return DecenasY('TREINTA', unidad);
                case 4: return DecenasY('CUARENTA', unidad);
                case 5: return DecenasY('CINCUENTA', unidad);
                case 6: return DecenasY('SESENTA', unidad);
                case 7: return DecenasY('SETENTA', unidad);
                case 8: return DecenasY('OCHENTA', unidad);
                case 9: return DecenasY('NOVENTA', unidad);
                case 0: return Unidades(unidad);
            }
        }
        function DecenasY(strSin, numUnidades) {
            return numUnidades > 0 ? strSin + ' Y ' + Unidades(numUnidades) : strSin;
        }
        function Centenas(num) {
            const centenas = Math.floor(num / 100), decenas = num - (centenas * 100);
            switch(centenas) {
                case 1: return decenas > 0 ? 'CIENTO ' + Decenas(decenas) : 'CIEN';
                case 2: return 'DOSCIENTOS ' + Decenas(decenas);
                case 3: return 'TRESCIENTOS ' + Decenas(decenas);
                case 4: return 'CUATROCIENTOS ' + Decenas(decenas);
                case 5: return 'QUINIENTOS ' + Decenas(decenas);
                case 6: return 'SEISCIENTOS ' + Decenas(decenas);
                case 7: return 'SETECIENTOS ' + Decenas(decenas);
                case 8: return 'OCHOCIENTOS ' + Decenas(decenas);
                case 9: return 'NOVECIENTOS ' + Decenas(decenas);
                default: return Decenas(decenas);
            }
        }
        function Seccion(num, divisor, strSingular, strPlural) {
            const cientos = Math.floor(num / divisor), resto = num - (cientos * divisor);
            let letras = '';
            if (cientos > 0) {
                if (cientos > 1) letras = Centenas(cientos) + ' ' + strPlural;
                else letras = strSingular;
            }
            if (resto > 0) letras += '';
            return letras;
        }
        function Miles(num) {
            const divisor = 1000, cientos = Math.floor(num / divisor), resto = num - (cientos * divisor);
            const strMiles = Seccion(num, divisor, 'UN MIL', 'MIL');
            const strCentenas = Centenas(resto);
            return strMiles === '' ? strCentenas : strMiles + ' ' + strCentenas;
        }
        function Millones(num) {
            const divisor = 1000000, cientos = Math.floor(num / divisor), resto = num - (cientos * divisor);
            const strMillones = Seccion(num, divisor, 'UN MILLON', 'MILLONES');
            const strMiles = Miles(resto);
            return strMillones === '' ? strMiles : strMillones + ' ' + strMiles;
        }
        
        return (Millones(Math.floor(num)).trim() + ' PESOS ' + centavosStr).trim();
    },

    showToast(msg, type = 'success') {
        const toast = document.getElementById('toast');
        const icon  = document.getElementById('toast-icon');
        document.getElementById('toast-message').innerText = msg;
        toast.style.backgroundColor = type === 'error' ? '#dc2626' : BRAND_COLOR;
        icon.className = type === 'error' ? 'fas fa-exclamation-circle text-white text-2xl' : 'fas fa-check-circle text-yellow-300 text-2xl';
        toast.classList.remove('scale-90', 'opacity-0');
        toast.classList.add('scale-100', 'opacity-100');
        setTimeout(() => {
            toast.classList.remove('scale-100', 'opacity-100');
            toast.classList.add('scale-90', 'opacity-0');
        }, 3500);
    },

    showModal(html, isLarge = false) {
        const overlay = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        content.innerHTML = html;
        if (isLarge) {
            content.classList.replace('max-w-3xl', 'max-w-7xl');
            content.classList.add('h-[95vh]');
        } else {
            content.classList.replace('max-w-7xl', 'max-w-3xl');
            content.classList.remove('h-[95vh]');
        }
        overlay.classList.remove('hidden');
        setTimeout(() => { overlay.classList.remove('opacity-0'); content.classList.remove('scale-95'); content.classList.add('scale-100'); }, 10);
    },

    closeModal() {
        const overlay = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        overlay.classList.add('opacity-0'); content.classList.remove('scale-100'); content.classList.add('scale-95');
        setTimeout(() => overlay.classList.add('hidden'), 200);
    },

    updateActiveLink(view) {
        document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
        const lnk = document.getElementById(`link-${view}`);
        if (lnk) lnk.classList.add('active');
        const titles = { dashboard: 'Panel de Control', clients: 'Gestión de Clientes', products: 'Catálogo de Productos', budgets: 'Historial de Presupuestos', settings: 'Configuración del Sistema' };
        document.getElementById('page-title').innerText = titles[view] || view;
    },

    // --- Init ---
    async checkSession() {
        try {
            const res = await fetch('api.php?resource=check_session');
            if (res.ok) {
                const data = await res.json();
                this.onLoginSuccess(data.username);
                await this.init();
            } else {
                // Not logged in – show login screen
                document.getElementById('login-screen').style.display = 'flex';
                document.getElementById('login-user').focus();
            }
        } catch(e) {
            document.getElementById('login-screen').style.display = 'flex';
        }
    },

    onLoginSuccess(username) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('sidebar-username').textContent = 'Francisco Rascón';
        document.getElementById('header-username').textContent = 'Francisco Rascón';
    },

    async doLogin(e) {
        e.preventDefault();
        const btn = document.getElementById('login-btn');
        const errEl = document.getElementById('login-error');
        const user = document.getElementById('login-user').value.trim();
        const pass = document.getElementById('login-pass').value;
        if (!user || !pass) { errEl.textContent = 'Ingresa usuario y contraseña'; return; }
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Verificando...';
        errEl.textContent = '';
        try {
            const res = await fetch('api.php?resource=login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, password: pass })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                this.onLoginSuccess(data.username);
                await this.init();
            } else {
                errEl.textContent = data.error || 'Credenciales incorrectas';
                document.getElementById('login-pass').focus();
                document.getElementById('login-pass').select();
            }
        } catch(err) {
            errEl.textContent = 'Error de conexión. Intente de nuevo.';
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>Iniciar Sesión';
        }
    },

    async doLogout() {
        try { await fetch('api.php?resource=logout'); } catch(_) {}
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('login-user').value = '';
        document.getElementById('login-pass').value = '';
        document.getElementById('login-error').textContent = '';
        document.getElementById('login-user').focus();
    },

    async init() {
        this.setLoading('Conectando a la base de datos...');
        try {
            const [clients, products, budgets, families, unidades] = await Promise.all([
                api.get('clients'), api.get('products'), api.get('budgets'), api.get('families'), api.get('unidades')
            ]);
            cache.clients  = clients;
            cache.products = products;
            cache.budgets  = budgets;
            cache.families = families;
            cache.unidades = unidades;
            document.getElementById('db-status').textContent = 'administrador';
            this.renderDashboard();
            this.updateActiveLink('dashboard');
        } catch(e) {
            document.getElementById('db-status').textContent = 'Sin conexión';
            document.getElementById('content-area').innerHTML = `
                <div class="flex flex-col items-center justify-center h-full gap-4">
                    <i class="fas fa-exclamation-triangle text-5xl text-red-400"></i>
                    <p class="text-red-500 font-semibold text-lg">Error de conexión con la base de datos</p>
                    <p class="text-gray-400 text-sm">${e.message}</p>
                    <button onclick="app.init()" class="mt-2 px-5 py-2 text-white rounded-lg font-medium" style="background-color:${BRAND_COLOR}">
                        <i class="fas fa-sync mr-2"></i>Reintentar
                    </button>
                </div>`;
        }
    },

    async navigate(view) {
        this.currentView = view;
        this.updateActiveLink(view);
        this.setLoading();
        try {
            switch(view) {
                case 'dashboard':
                    [cache.clients, cache.budgets] = await Promise.all([api.get('clients'), api.get('budgets')]);
                    this.renderDashboard(); break;
                case 'clients':
                    cache.clients = await api.get('clients');
                    this.renderClients(); break;
                case 'products':
                    [cache.products, cache.families, cache.unidades] = await Promise.all([api.get('products'), api.get('families'), api.get('unidades')]);
                    this.renderProducts(); break;
                case 'budgets':
                    cache.budgets = await api.get('budgets');
                    this.renderBudgets(); break;
                case 'settings':
                    try {
                        const srv = await api.get('settings');
                        if (srv.company) APP_SETTINGS.company = { ...APP_SETTINGS.company, ...srv.company };
                        if (srv.smtp)    APP_SETTINGS.smtp    = { ...APP_SETTINGS.smtp, ...srv.smtp };
                        if (srv.system)  APP_SETTINGS.system  = { ...APP_SETTINGS.system, ...srv.system };
                        if (srv.docConfig) APP_SETTINGS.docConfig = { ...APP_SETTINGS.docConfig, ...srv.docConfig };
                        saveSettings(APP_SETTINGS);
                    } catch(_) {}
                    this.renderSettings(); break;
                case 'unidades':
                    cache.unidades = await api.get('unidades');
                    this.renderUnidades(); break;
            }
        } catch(e) {
            document.getElementById('content-area').innerHTML = `<div class="p-8 text-red-500"><i class="fas fa-exclamation-circle mr-2"></i>${e.message}</div>`;
        }
    },

    // ==================== DASHBOARD ====================
    renderDashboard() {
        const totalSales = cache.budgets.reduce((a, b) => a + parseFloat(b.total || 0), 0);
        document.getElementById('content-area').innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 fade-in">
                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div class="flex justify-between items-start">
                        <div><p class="text-sm text-gray-500 font-medium">Total Presupuestado</p><h3 class="text-2xl font-bold text-slate-800 mt-1">${this.formatCurrency(totalSales)}</h3></div>
                        <div class="p-3 rounded-lg text-white" style="background-color:${BRAND_COLOR}"><i class="fas fa-chart-line text-xl"></i></div>
                    </div>
                </div>
                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div class="flex justify-between items-start">
                        <div><p class="text-sm text-gray-500 font-medium">Clientes Activos</p><h3 class="text-2xl font-bold text-slate-800 mt-1">${cache.clients.length}</h3></div>
                        <div class="p-3 bg-green-50 rounded-lg text-green-600"><i class="fas fa-users text-xl"></i></div>
                    </div>
                </div>
                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div class="flex justify-between items-start">
                        <div><p class="text-sm text-gray-500 font-medium">Presupuestos</p><h3 class="text-2xl font-bold text-slate-800 mt-1">${cache.budgets.length}</h3></div>
                        <div class="p-3 bg-yellow-50 rounded-lg text-yellow-600"><i class="fas fa-file-invoice text-xl"></i></div>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 fade-in">
                <h3 class="font-bold text-lg mb-4 text-slate-800">Acciones Rápidas</h3>
                <div class="flex gap-4">
                    <button onclick="app.openClientModal()" class="flex-1 py-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-[#0f6dc1] hover:bg-blue-50 transition group flex flex-col items-center justify-center gap-2">
                        <i class="fas fa-plus-circle text-2xl text-gray-400 group-hover:text-[#0f6dc1]"></i>
                        <span class="font-medium text-gray-600 group-hover:text-[#0f6dc1]">Nuevo Cliente</span>
                    </button>
                    <button onclick="app.navigate('products')" class="flex-1 py-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-green-500 hover:bg-green-50 transition group flex flex-col items-center justify-center gap-2">
                        <i class="fas fa-box text-2xl text-gray-400 group-hover:text-green-500"></i>
                        <span class="font-medium text-gray-600 group-hover:text-green-600">Ver Productos</span>
                    </button>
                    <button onclick="app.openBudgetModal()" class="flex-1 py-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-yellow-500 hover:bg-yellow-50 transition group flex flex-col items-center justify-center gap-2">
                        <i class="fas fa-calculator text-2xl text-gray-400 group-hover:text-yellow-500"></i>
                        <span class="font-medium text-gray-600 group-hover:text-yellow-600">Crear Presupuesto</span>
                    </button>
                </div>
            </div>
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6 fade-in">
                <h3 class="font-bold text-lg mb-4 text-slate-800">Últimos Presupuestos</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead class="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                            <tr><th class="py-3 px-4">Folio</th><th class="py-3 px-4">Cliente</th><th class="py-3 px-4">Fecha</th><th class="py-3 px-4">Estado</th><th class="py-3 px-4 text-right">Total</th></tr>
                        </thead>
                        <tbody>
                            ${cache.budgets.slice(0,5).map(b => `<tr class="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onclick="app.viewBudget(${b.id})">
                                <td class="py-3 px-4 font-mono text-sm font-semibold" style="color:${BRAND_COLOR}">${b.codigo}</td>
                                <td class="py-3 px-4 text-slate-700">${b.clientName}</td>
                                <td class="py-3 px-4 text-slate-500">${b.date}</td>
                                <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">${b.status}</span></td>
                                <td class="py-3 px-4 text-right font-bold">${this.formatCurrency(b.total)}</td>
                            </tr>`).join('') || '<tr><td colspan="5" class="py-6 text-center text-gray-400">No hay presupuestos</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>`;
    },

    // ==================== CLIENTES ====================
    renderClients() {
        const rows = cache.clients.map(c => `<tr class="border-b border-gray-100 hover:bg-gray-50 transition" data-search="${(c.name+' '+c.rfc+' '+c.email+' '+c.phone+' '+c.city).toLowerCase()}">
            <td class="py-4 px-4 whitespace-nowrap w-24">
                <button onclick="app.openEditClientModal('${c.id}')" class="text-[#0f6dc1] hover:text-blue-800 mx-1 p-2 hover:bg-blue-50 rounded-full transition" title="Editar"><i class="fas fa-edit"></i></button>
                <button onclick="app.deleteClient('${c.id}')" class="text-red-400 hover:text-red-600 mx-1 p-2 hover:bg-red-50 rounded-full transition" title="Eliminar"><i class="fas fa-trash"></i></button>
            </td>
            <td class="py-4 px-4"><div class="font-medium text-slate-700">${c.name}</div><div class="text-xs text-gray-400">RFC: ${c.rfc}</div></td>
            <td class="py-4 px-4 text-slate-500 text-sm">${c.street}<br><span class="text-xs text-gray-400">${c.city} ${c.zip}</span></td>
            <td class="py-4 px-4 text-slate-500">${c.phone}</td>
            <td class="py-4 px-4 text-slate-500">${c.email}</td></tr>`).join('');

        document.getElementById('content-area').innerHTML = `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden fade-in">
                <div class="p-6 border-b border-gray-100 flex items-center gap-4 flex-wrap">
                    <div class="relative w-full max-w-sm">
                        <i class="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                        <input type="text" id="client-search" placeholder="Buscar cliente, RFC, correo..." oninput="app.debouncedFilterClients(this.value)" class="w-full pl-10 pr-4 py-2 bg-white text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f6dc1] outline-none text-sm">
                        </div>
                        <div class="flex items-center gap-4">
                            <h3 class="font-bold text-lg text-slate-800">Gestión de Clientes <span class="text-sm font-normal text-gray-400" id="clients-count">(${Array.isArray(cache.clients) ? cache.clients.length : 0})</span></h3>
                            <button onclick="app.openClientModal()" class="text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-md flex-shrink-0 hover:opacity-90" style="background-color:${BRAND_COLOR}"><i class="fas fa-plus mr-2"></i>Nuevo Cliente</button>
                        </div>
                </div>
                <div class="overflow-x-auto"><table class="w-full text-left border-collapse">
                    <thead class="bg-gray-50 text-gray-500 text-xs uppercase font-semibold"><tr>
                        <th class="py-4 px-4 w-24">Acciones</th><th class="py-4 px-4">Razón Social / Nombre</th><th class="py-4 px-4">Dirección</th>
                        <th class="py-4 px-4">Teléfono</th><th class="py-4 px-4">Correo</th>
                    </tr></thead>
                    <tbody id="clients-table-body">${rows || '<tr><td colspan="5" class="py-8 text-center text-gray-400">No hay clientes registrados</td></tr>'}</tbody>
                </table></div>
            </div>`;
    },

    clientFormFields(c = {}) {
        const f = (name, label, type='text', val='', required=true, extra='') =>
            `<div><label class="block text-sm font-medium text-gray-700 mb-1">${label}${required?' *':''}</label>
             <input type="${type}" name="${name}" value="${val}" ${required?'required':''} ${extra}
             class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f6dc1] outline-none"></div>`;
        return `
            <div class="bg-gray-50 p-4 rounded-lg border border-gray-200"><h4 class="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Datos Fiscales</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="md:col-span-2">${f('name','Razón Social o Nombre','text',c.name||'')}</div>
                    ${f('rfc','RFC','text',c.rfc||'')}
                </div>
            </div>
            <div class="bg-gray-50 p-4 rounded-lg border border-gray-200"><h4 class="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Dirección</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="md:col-span-2">${f('street','Dirección completa (Calle, Núm, Colonia)','text',c.street||'')}</div>
                    ${f('city','Ciudad','text',c.city||'')}
                    ${f('province','Estado / Provincia','text',c.province||'',false)}
                    ${f('zip','Código Postal','text',c.zip||'',true,'pattern="[0-9]{5}"')}
                </div>
            </div>
            <div class="bg-gray-50 p-4 rounded-lg border border-gray-200"><h4 class="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Contacto</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${f('phone','Teléfono','tel',c.phone||'')}
                    ${f('email','Correo Electrónico','email',c.email||'')}
                </div>
            </div>`;
    },

    openClientModal() {
        this.showModal(`<div class="p-6 overflow-y-auto">
            <div class="flex justify-between items-center mb-6"><h3 class="text-xl font-bold text-slate-800">Nuevo Cliente</h3><button onclick="app.closeModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button></div>
            <form onsubmit="app.saveClient(event)" class="space-y-5">
                ${this.clientFormFields()}
                <div class="pt-4 flex justify-end gap-3 border-t border-gray-100">
                    <button type="button" onclick="app.closeModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancelar</button>
                    <button type="submit" id="btn-save-client" class="px-6 py-2 text-white rounded-lg font-medium transition shadow-lg" style="background-color:${BRAND_COLOR}">Guardar Cliente</button>
                </div>
            </form></div>`);
    },

    openEditClientModal(id) {
        const c = cache.clients.find(x => x.id == id); if (!c) return;
        this.showModal(`<div class="p-6 overflow-y-auto">
            <div class="flex justify-between items-center mb-6"><h3 class="text-xl font-bold text-slate-800">Editar Cliente</h3><button onclick="app.closeModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button></div>
            <form onsubmit="app.updateClient(event,'${c.id}')" class="space-y-5">
                ${this.clientFormFields(c)}
                <div class="pt-4 flex justify-end gap-3 border-t border-gray-100">
                    <button type="button" onclick="app.closeModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancelar</button>
                    <button type="submit" class="px-6 py-2 text-white rounded-lg font-medium transition shadow-lg" style="background-color:${BRAND_COLOR}">Actualizar Cliente</button>
                </div>
            </form></div>`);
    },

    async saveClient(e) {
        e.preventDefault(); const btn = e.target.querySelector('[type="submit"]');
        const f = new FormData(e.target);
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Guardando...';
        try {
            const payload = { name: f.get('name'), rfc: f.get('rfc'), street: f.get('street'), city: f.get('city'), zip: f.get('zip'), province: f.get('province'), phone: f.get('phone'), email: f.get('email') };
            const { id } = await api.post('clients', payload);
            this.closeModal(); this.showToast('Cliente agregado correctamente');
            const item = await api.get('clients', id); cache.clients.push(item); this.renderClients();
        } catch(err) { this.showToast('Error: ' + err.message, 'error'); btn.disabled = false; btn.innerHTML = 'Guardar Cliente'; }
    },

    async updateClient(e, id) {
        e.preventDefault(); const btn = e.target.querySelector('[type="submit"]');
        const f = new FormData(e.target);
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Guardando...';
        try {
            await api.put('clients', id, { name: f.get('name'), rfc: f.get('rfc'), street: f.get('street'), city: f.get('city'), zip: f.get('zip'), province: f.get('province'), phone: f.get('phone'), email: f.get('email') });
            this.closeModal(); this.showToast('Cliente actualizado');
            const updated = await api.get('clients', id);
            const idx = cache.clients.findIndex(c => c.id == id);
            if (idx !== -1) cache.clients[idx] = updated; else cache.clients.push(updated);
            this.renderClients();
        } catch(err) { this.showToast('Error: ' + err.message, 'error'); btn.disabled = false; btn.innerHTML = 'Actualizar Cliente'; }
    },

    async deleteClient(id) {
        if (!confirm('¿Eliminar este cliente?')) return;
        try {
            await api.del('clients', id); this.showToast('Cliente eliminado');
            cache.clients = cache.clients.filter(c => c.id != id); this.renderClients();
        } catch(err) { this.showToast('Error: ' + err.message, 'error'); }
    },

    // ==================== PRODUCTOS ====================
    renderProducts() {
        const rows = (Array.isArray(cache.products) ? cache.products : []).map(p => {
            const searchStr = (p.code+' '+p.name+' '+p.category).toLowerCase();
            return `<tr class="border-b border-gray-100 hover:bg-gray-50 transition" data-search="${searchStr}">
            <td class="py-4 px-4 whitespace-nowrap">
                <button onclick="app.openEditProductModal(${p.id})" class="text-[#0f6dc1] hover:text-blue-800 mr-1 p-2 hover:bg-blue-50 rounded-full transition" title="Editar"><i class="fas fa-edit"></i></button>
                <button onclick="app.deleteProduct(${p.id})" class="text-red-400 hover:text-red-600 ml-1 p-2 hover:bg-red-50 rounded-full transition" title="Eliminar"><i class="fas fa-trash"></i></button>
            </td>
            <td class="py-4 px-4"><div class="font-mono text-xs text-gray-500">${p.code}</div><div class="font-medium text-slate-700">${p.name}</div></td>
            <td class="py-4 px-4"><span class="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">${p.category}</span></td>
            <td class="py-4 px-4 text-center"><span class="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-bold">${p.tax}%</span></td>
            <td class="py-4 px-4 font-mono text-slate-600 text-sm">
                <div>Costo: ${this.formatCurrency(p.cost)}</div>
                <div class="text-green-600 font-bold">Venta: ${this.formatCurrency(p.price)}</div>
            </td></tr>`;
        }).join('');

        document.getElementById('content-area').innerHTML = `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden fade-in">
                <div class="p-6 border-b border-gray-100 flex items-center gap-4 flex-wrap">
                    <div class="relative w-full max-w-sm">
                        <i class="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                        <input type="text" id="product-search" placeholder="Buscar producto, código..." oninput="app.debouncedFilterProducts(this.value)" class="w-full pl-10 pr-4 py-2 bg-white text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f6dc1] outline-none text-sm">
                    </div>
                    <div class="flex items-center gap-4">
                        <h3 class="font-bold text-lg text-slate-800">Catálogo de Productos <span class="text-sm font-normal text-gray-400" id="products-count">(${Array.isArray(cache.products) ? cache.products.length : 0})</span></h3>
                        <button onclick="app.openProductModal()" class="text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-md flex-shrink-0 hover:opacity-90" style="background-color:#16a34a"><i class="fas fa-plus mr-2"></i>Agregar Producto</button>
                    </div>
                </div>
                <div class="overflow-x-auto"><table class="w-full text-left border-collapse">
                    <thead class="bg-gray-50 text-gray-500 text-xs uppercase font-semibold"><tr>
                        <th class="py-4 px-4">Acciones</th><th class="py-4 px-4">Código / Descripción</th><th class="py-4 px-4">Categoría</th>
                        <th class="py-4 px-4 text-center">IVA</th><th class="py-4 px-4">Precios</th>
                    </tr></thead>
                    <tbody id="products-table-body">${rows || '<tr><td colspan="5" class="py-8 text-center text-gray-400">No hay productos en el catálogo</td></tr>'}</tbody>
                </table></div>
            </div>`;
    },

    filterClients(q) {
        const query = q.toLowerCase().trim();
        const rows  = document.querySelectorAll('#clients-table-body tr');
        let visible = 0;
        rows.forEach(row => {
            const match = row.dataset.search && row.dataset.search.includes(query);
            row.style.display = (!query || match) ? '' : 'none';
            if (!query || match) visible++;
        });
        const cnt = document.getElementById('clients-count');
        if (cnt) cnt.textContent = `(${visible})`;
    },

    filterBudgets(q) {
        const query = q.toLowerCase().trim();
        const rows  = document.querySelectorAll('#budgets-table-body tr');
        let visible = 0;
        rows.forEach(row => {
            const match = row.dataset.search && row.dataset.search.includes(query);
            row.style.display = (!query || match) ? '' : 'none';
            if (!query || match) visible++;
        });
        const cnt = document.getElementById('budgets-count');
        if (cnt) cnt.textContent = `(${visible})`;
    },

    filterProducts(query) {
        const q = query.toLowerCase().trim();
        const rows = document.querySelectorAll('#products-table-body tr');
        let visible = 0;
        rows.forEach(row => {
            const match = row.dataset.search && row.dataset.search.includes(q);
            row.style.display = (!q || match) ? '' : 'none';
            if (!q || match) visible++;
        });
        const cnt = document.getElementById('products-count');
        if (cnt) cnt.textContent = `(${visible})`;
    },

    productFormFields(p = {}) {
        const famOptions = '<option value="">SELECCIONAR</option>' + cache.families.map(f => `<option value="${f.id}" ${p.codfamilia == f.id ? 'selected' : ''}>${f.name}</option>`).join('');
        const taxOpts = '<option value="">SELECCIONAR</option>' + [0,8,16].map(t => `<option value="${t}" ${parseFloat(p.tax)==t?'selected':''}>${t}% ${t===0?'(Exento)':''}</option>`).join('');
        return `
            <div class="bg-gray-50 p-4 rounded-lg border border-gray-200"><h4 class="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Identificación</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Código / Referencia *</label>
                         <input type="text" name="code" value="${p.code||''}" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none uppercase"></div>
                    <div class="md:col-span-2"><label class="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
                         <input type="text" name="name" value="${p.name||''}" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"></div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
                         <select name="codfamilia" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none">${famOptions}</select></div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">IVA *</label>
                         <select name="tax" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none">${taxOpts}</select></div>
                </div>
            </div>
            <div class="bg-gray-50 p-4 rounded-lg border border-gray-200"><h4 class="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Precios</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Precio Costo *</label>
                         <input type="number" id="prod-cost" name="cost" value="${p.cost||0}" required min="0" step="0.01" oninput="app.calculatePriceFromMargin()" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"></div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Margen (%)</label>
                         <input type="number" id="prod-margin" name="margin" value="${p.margin??30}" min="0" step="0.01" oninput="app.calculatePriceFromMargin()" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"></div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Precio Venta (sin IVA)</label>
                         <div id="prod-price-display" data-value="${p.price||0}" class="w-full px-4 py-2 bg-green-50 border border-green-200 text-green-800 font-bold rounded-lg text-lg">${this.formatCurrency(p.price||0)}</div></div>
                </div>
            </div>
            <div class="bg-gray-50 p-4 rounded-lg border border-gray-200"><h4 class="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Observaciones</h4>
                <div><textarea name="observaciones" rows="2" maxlength="49" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none resize-none" placeholder="Notas internas...">${p.observaciones||''}</textarea></div>
            </div>`;
    },

    calculatePriceFromMargin() {
        const cost   = parseFloat(document.getElementById('prod-cost')?.value) || 0;
        const margin = parseFloat(document.getElementById('prod-margin')?.value) || 0;
        const price  = cost * (1 + margin / 100);
        const disp   = document.getElementById('prod-price-display');
        if (disp) { disp.innerText = this.formatCurrency(price); disp.dataset.value = price; }
    },

    openProductModal() {
        this.showModal(`<div class="p-6 overflow-y-auto">
            <div class="flex justify-between items-center mb-6"><h3 class="text-xl font-bold text-slate-800">Nuevo Producto</h3><button onclick="app.closeModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button></div>
            <form onsubmit="app.saveProduct(event)" class="space-y-5">
                ${this.productFormFields()}
                <div class="pt-4 flex justify-end gap-3 border-t border-gray-100">
                    <button type="button" onclick="app.closeModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancelar</button>
                    <button type="submit" class="px-6 py-2 text-white rounded-lg font-medium transition shadow-lg" style="background-color:#16a34a">Guardar Producto</button>
                </div>
            </form></div>`);
        setTimeout(() => this.calculatePriceFromMargin(), 100);
    },

    openEditProductModal(id) {
        const p = (Array.isArray(cache.products) ? cache.products : []).find(x => x.id == id); if (!p) return;
        this.showModal(`<div class="p-6 overflow-y-auto">
            <div class="flex justify-between items-center mb-6"><h3 class="text-xl font-bold text-slate-800">Editar Producto</h3><button onclick="app.closeModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button></div>
            <form onsubmit="app.updateProduct(event,${p.id})" class="space-y-5">
                ${this.productFormFields(p)}
                <div class="pt-4 flex justify-end gap-3 border-t border-gray-100">
                    <button type="button" onclick="app.closeModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancelar</button>
                    <button type="submit" class="px-6 py-2 text-white rounded-lg font-medium transition shadow-lg" style="background-color:#16a34a">Actualizar Producto</button>
                </div>
            </form></div>`);
        setTimeout(() => this.calculatePriceFromMargin(), 100);
    },

    getProductPayload(e) {
        const f = new FormData(e.target);
        const pd = document.getElementById('prod-price-display');
        return { code: f.get('code'), name: f.get('name'), codfamilia: f.get('codfamilia'), tax: parseFloat(f.get('tax')), cost: parseFloat(f.get('cost')), margin: parseFloat(f.get('margin')), price: parseFloat(pd.dataset.value), observaciones: f.get('observaciones') };
    },

    async saveProduct(e) {
        e.preventDefault(); const btn = e.target.querySelector('[type="submit"]');
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Guardando...';
        try {
            const { id } = await api.post('products', this.getProductPayload(e));
            this.closeModal(); this.showToast('Producto agregado');
            const item = await api.get('products', id); cache.products.push(item); this.renderProducts();
        } catch(err) { this.showToast('Error: ' + err.message, 'error'); btn.disabled = false; btn.innerHTML = 'Guardar Producto'; }
    },

    async updateProduct(e, id) {
        e.preventDefault(); const btn = e.target.querySelector('[type="submit"]');
        const oldCode = (cache.products.find(p => p.id == id) || {}).code;
        const payload = this.getProductPayload(e);
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Guardando...';
        try {
            await api.put('products', id, payload);
            this.closeModal(); this.showToast('Producto actualizado');
            const updated = await api.get('products', id);
            const idx = cache.products.findIndex(p => p.id == id);
            if (idx !== -1) cache.products[idx] = updated; else cache.products.push(updated);
            if (oldCode && oldCode !== payload.code) cache.budgets = await api.get('budgets');
            this.renderProducts();
        } catch(err) { this.showToast('Error: ' + err.message, 'error'); btn.disabled = false; btn.innerHTML = 'Actualizar Producto'; }
    },

    async deleteProduct(id) {
        if (!confirm('¿Desactivar este producto del catálogo?')) return;
        try {
            await api.del('products', id); this.showToast('Producto desactivado');
            cache.products = cache.products.filter(p => p.id != id); this.renderProducts();
        } catch(err) { this.showToast('Error: ' + err.message, 'error'); }
    },

    // ==================== PRESUPUESTOS ====================
    renderBudgets() {
        const statusColor = { 'Abierto':'bg-blue-100 text-blue-700', 'Pedido':'bg-green-100 text-green-700', 'Rechazado':'bg-red-100 text-red-600', 'Enviado':'bg-yellow-100 text-yellow-700' };
        const rows = cache.budgets.filter(b => b.id != null).map(b => `<tr class="border-b border-gray-100 hover:bg-gray-50 transition" data-search="${(b.codigo+' '+b.clientName+' '+b.date+' '+b.status).toLowerCase()}">
            <td class="py-4 px-4 whitespace-nowrap">
                <button onclick="app.viewBudget(${b.id})" class="text-[#0f6dc1] hover:bg-blue-50 p-2 rounded-full transition" title="Ver Presupuesto"><i class="fas fa-eye text-lg"></i></button>
                <button onclick="app.viewReceipt(${b.id})" class="text-[#0f6dc1] hover:bg-blue-50 p-2 rounded-full transition" title="Recibo de Mercancía"><i class="fas fa-file-signature text-lg"></i></button>
                <button onclick="app.editBudget(${b.id})" class="text-[#0f6dc1] hover:bg-blue-50 p-2 rounded-full transition" title="Editar Presupuesto"><i class="fas fa-edit text-lg"></i></button>
                <button onclick="app.deleteBudget(${b.id})" class="text-red-500 hover:bg-red-50 p-2 rounded-full transition" title="Eliminar Presupuesto"><i class="fas fa-trash-alt text-lg"></i></button>
            </td>
            <td class="py-4 px-4 font-mono text-sm font-semibold" style="color:${BRAND_COLOR}">${b.codigo}</td>
            <td class="py-4 px-4 font-medium text-slate-700">${b.clientName}</td>
            <td class="py-4 px-4 text-slate-500">${b.date}</td>
            <td class="py-4 px-4"><span class="px-2 py-1 rounded-full text-xs font-bold ${statusColor[b.status]||'bg-gray-100 text-gray-600'}">${b.status}</span></td>
            <td class="py-4 px-4 text-slate-600">${this.formatCurrency(b.neto)}</td>
            <td class="py-4 px-4 font-bold text-slate-800">${this.formatCurrency(b.total)}</td>
        </tr>`).join('');

        document.getElementById('content-area').innerHTML = `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden fade-in">
                <div class="p-6 border-b border-gray-100 flex items-center gap-4 flex-wrap">
                    <div class="relative w-full max-w-sm">
                        <i class="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                        <input type="text" id="budget-search" placeholder="Buscar folio, cliente, estado..." oninput="app.debouncedFilterBudgets(this.value)" class="w-full pl-10 pr-4 py-2 bg-white text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f6dc1] outline-none text-sm">
                    </div>
                    <div class="flex items-center gap-4">
                        <h3 class="font-bold text-lg text-slate-800">Historial de Presupuestos <span class="text-sm font-normal text-gray-400" id="budgets-count">(${cache.budgets.length})</span></h3>
                        <button onclick="app.openBudgetModal()" class="text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-md flex-shrink-0 hover:opacity-90" style="background-color:#eab308; color:#000"><i class="fas fa-plus mr-2"></i>Nuevo Presupuesto</button>
                    </div>
                </div>
                <div class="overflow-x-auto"><table class="w-full text-left border-collapse">
                    <thead class="bg-gray-50 text-gray-500 text-xs uppercase font-semibold"><tr>
                        <th class="py-4 px-4 w-24">Acciones</th><th class="py-4 px-4">Folio</th><th class="py-4 px-4">Cliente</th><th class="py-4 px-4">Fecha</th>
                        <th class="py-4 px-4">Estado</th><th class="py-4 px-4">Neto</th><th class="py-4 px-4">Total c/IVA</th>
                    </tr></thead>
                    <tbody id="budgets-table-body">${rows || '<tr><td colspan="7" class="py-8 text-center text-gray-400">No hay presupuestos</td></tr>'}</tbody>
                </table></div>
            </div>`;
    },

    openBudgetModal() {
        if (cache.clients.length === 0) { this.showToast('No hay clientes disponibles', 'error'); return; }
        if (cache.products.length === 0) { this.showToast('No hay productos disponibles', 'error'); return; }
        const coOpts = cache.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        this.showModal(`<div class="p-6 overflow-y-auto">
            <div class="flex justify-between items-center mb-6"><h3 class="text-xl font-bold text-slate-800">Nuevo Presupuesto</h3><button onclick="app.closeModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button></div>
            <form id="budgetForm" onsubmit="app.saveBudget(event)" class="space-y-6">
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                         <select id="budget-client-select" name="clientId" required class="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none" placeholder="Buscar cliente..."><option value="">Buscar cliente...</option>${coOpts}</select></div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                         <input type="date" name="date" value="${new Date().toISOString().split('T')[0]}" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none"></div>
                    <div class="col-span-2"><label class="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                         <textarea name="observaciones" rows="2" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none resize-none" placeholder="Notas adicionales..."></textarea></div>
                </div>
                <div class="border rounded-lg p-4 bg-gray-50">
                    <h4 class="font-bold text-sm text-gray-600 mb-3 uppercase tracking-wide">Productos</h4>
                    <div id="budget-items-container" class="space-y-2"></div>
                    <button type="button" onclick="app.addBudgetItemRow()" class="mt-3 text-sm font-medium flex items-center gap-1" style="color:${BRAND_COLOR}"><i class="fas fa-plus-circle"></i>Agregar Producto</button>
                </div>
                <div class="flex justify-end pt-2">
                    <div class="w-72 space-y-1 text-sm">
                        <div class="flex justify-between text-gray-500"><span>Subtotal (sin IVA)</span><span id="budget-neto-display" class="font-medium">$0.00</span></div>
                        <div class="flex justify-between text-gray-500"><span>IVA</span><span id="budget-iva-display" class="font-medium">$0.00</span></div>
                        <div class="flex justify-between text-xl font-bold text-slate-800 border-t border-gray-200 pt-2 mt-2"><span>Total</span><span id="budget-total-display">$0.00</span></div>
                    </div>
                </div>
                <div class="flex justify-end gap-3 border-t border-gray-200 pt-4">
                    <button type="button" onclick="app.closeModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancelar</button>
                    <button type="submit" id="btn-save-budget" class="px-6 py-2 rounded-lg font-medium transition shadow-lg" style="background-color:#eab308; color:#000"><i class="fas fa-save mr-2"></i>Generar Presupuesto</button>
                </div>
            </form></div>`, true);
        setTimeout(() => {
            new TomSelect('#budget-client-select', { create: false, sortField: { field: "text", direction: "asc" } });
            this.addBudgetItemRow();
        }, 100);
    },

    addBudgetItemRow(existingItem = null) {
        const container = document.getElementById('budget-items-container'); if (!container) return;
        const rid = Date.now();
        const qtyVal = existingItem ? parseFloat(existingItem.qty) : 1;
        const e = existingItem;
        const displayPrice = e ? this.formatCurrency(e.qty * e.price) : '$0.00';
        const searchVal = e ? (cache.products.find(p => p.id == e.productId)?.name || '') : '';
        container.insertAdjacentHTML('beforeend', `
            <div class="flex gap-2 items-center budget-row" id="row-${rid}"
                data-productid="${e ? e.productId : ''}"
                data-price="${e ? e.price : 0}"
                data-tax="${e ? e.tax : 16}"
                data-code="${e ? e.productCode : ''}"
                data-name="${e ? e.productName : ''}"
                data-idunidad="${e ? e.idunidad : 1}">
                <div class="flex-1 w-0 relative">
                    <input type="text" name="productSearch" placeholder="Buscar producto (mín. 2 caracteres)..." autocomplete="off" value="${searchVal}"
                        class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-yellow-500 outline-none"
                        oninput="app.showProductDropdown(this, ${rid})"
                        onfocus="if(this.value.length>=2)app.showProductDropdown(this,${rid})"
                        onblur="setTimeout(()=>app.hideProductDropdown(${rid}),200)">
                    <div id="prod-drop-${rid}" class="hidden absolute z-10 w-full bg-white border border-gray-300 rounded mt-0.5 max-h-48 overflow-y-auto shadow-lg"></div>
                </div>
                <div class="w-20"><input type="number" name="qty" value="${qtyVal}" min="1" onchange="app.calculateBudgetTotal()"
                    class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-yellow-500 outline-none text-center" required></div>
                <div class="w-32 text-right font-mono text-sm text-gray-600 row-total">${displayPrice}</div>
                <button type="button" onclick="document.getElementById('row-${rid}').remove(); app.calculateBudgetTotal();"
                    class="text-red-400 hover:text-red-600 p-1"><i class="fas fa-trash text-sm"></i></button>
            </div>`);
    },

    showProductDropdown(input, rid) {
        const q = input.value.trim();
        const drop = document.getElementById(`prod-drop-${rid}`);
        if (!drop) return;
        if (!q || q.length < 2) { drop.classList.add('hidden'); return; }
        if (this._prodSearchAbort) this._prodSearchAbort.abort();
        this._prodSearchAbort = new AbortController();
        fetch(`api.php?resource=products&search=${encodeURIComponent(q)}`, { signal: this._prodSearchAbort.signal })
            .then(r => r.json())
            .then(data => {
                if (!Array.isArray(data) || !data.length) { drop.classList.add('hidden'); return; }
                drop.innerHTML = data.map(p => {
                    const unitObj = cache.unidades.find(u => u.id == (p.idunidad || 1));
                    const unitName = unitObj ? unitObj.name : 'PZA';
                    const safeName = (p.name || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
                    return `<div class="px-3 py-2 cursor-pointer text-sm hover:bg-yellow-50 border-b border-gray-100"
                        data-pid="${p.id}" data-price="${p.price}" data-tax="${p.tax}" data-code="${p.code || ''}" data-name="${p.name || ''}" data-idunidad="${p.idunidad || 1}"
                        onmousedown="app.selectProductFromDropdown(${rid}, this)">
                        <span class="font-medium text-slate-800">${safeName}</span>
                        <span class="text-gray-400 ml-1">(${unitName})</span>
                        <span class="text-gray-500 ml-2">${this.formatCurrency(p.price)}</span>
                    </div>`;
                }).join('');
                drop.classList.remove('hidden');
            })
            .catch(() => {});
    },

    hideProductDropdown(rid) {
        const drop = document.getElementById(`prod-drop-${rid}`);
        if (drop) drop.classList.add('hidden');
    },

    selectProductFromDropdown(rid, el) {
        const row = document.getElementById(`row-${rid}`);
        if (!row) return;
        row.dataset.productid = el.dataset.pid;
        row.dataset.price = el.dataset.price;
        row.dataset.tax = el.dataset.tax;
        row.dataset.code = el.dataset.code;
        row.dataset.name = el.dataset.name;
        row.dataset.idunidad = el.dataset.idunidad || 1;
        const input = row.querySelector('input[name="productSearch"]');
        if (input) input.value = el.dataset.name;
        this.hideProductDropdown(rid);
        this.calculateBudgetTotal();
    },

    calculateBudgetTotal() {
        let neto = 0, totalIva = 0;
        document.querySelectorAll('.budget-row').forEach(row => {
            const qty  = parseFloat(row.querySelector('input[name="qty"]').value) || 0;
            const disp = row.querySelector('.row-total');
            const pid = row.dataset.productid;
            if (pid && qty > 0) {
                const price = parseFloat(row.dataset.price) || 0;
                const tax   = parseFloat(row.dataset.tax)   || 16;
                const sub   = price * qty;
                const iva   = sub * (tax / 100);
                neto     += sub;
                totalIva += iva;
                disp.innerText = this.formatCurrency(sub + iva);
            } else if (disp) disp.innerText = '$0.00';
        });
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = this.formatCurrency(v); };
        set('budget-neto-display', neto);
        set('budget-iva-display',  totalIva);
        set('budget-total-display', neto + totalIva);
        return { neto, totalIva, total: neto + totalIva };
    },

    async saveBudget(e) {
        e.preventDefault();
        const f    = new FormData(e.target);
        const btn  = document.getElementById('btn-save-budget');
        const items = [];
        document.querySelectorAll('.budget-row').forEach(row => {
            const qty = parseFloat(row.querySelector('input[name="qty"]').value) || 0;
            const pid = row.dataset.productid;
            if (pid && qty > 0) {
                items.push({ productId: parseInt(pid), productCode: row.dataset.code, productName: row.dataset.name, qty, price: parseFloat(row.dataset.price), tax: parseFloat(row.dataset.tax), idunidad: parseInt(row.dataset.idunidad) || 1 });
            }
        });
        if (items.length === 0) { this.showToast('Agrega al menos un producto', 'error'); return; }
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Guardando...';
        try {
            const res = await api.post('budgets', { clientId: f.get('clientId'), date: f.get('date'), observaciones: f.get('observaciones'), items });
            this.closeModal(); this.showToast(`Presupuesto ${res.codigo} creado`);
            const b = await api.get('budgets', res.id);
            cache.budgets.unshift({ id: b.id, codigo: b.codigo, clientId: b.clientId, date: b.date, neto: b.neto, totaliva: b.totaliva, total: b.total, status: b.status, clientName: b.clientName });
            this.renderBudgets();
        } catch(err) {
            this.showToast('Error: ' + err.message, 'error');
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-save mr-2"></i>Generar Presupuesto';
        }
    },
    async deleteBudget(id) {
        if (!confirm('¿Estás seguro de que deseas eliminar este presupuesto? Esta acción no se puede deshacer.')) return;
        try {
            await api.del('budgets', id);
            this.showToast('Presupuesto eliminado con éxito', 'success');
            cache.budgets = cache.budgets.filter(b => b.id != id);
            if (app.currentView === 'budgets') app.renderBudgets();
        } catch(err) {
            this.showToast('Error al eliminar presupuesto', 'error');
            console.error(err);
        }
    },

    async editBudget(id) {
        if (cache.clients.length === 0) { this.showToast('No hay clientes disponibles', 'error'); return; }
        if (cache.products.length === 0) { this.showToast('No hay productos disponibles', 'error'); return; }

        // Mostrar loader mientras se carga el presupuesto
        this.showModal(`<div class="p-8 flex items-center justify-center h-40 text-gray-400"><i class="fas fa-circle-notch fa-spin mr-2"></i>Cargando presupuesto...</div>`, true);

        try {
            const b = await api.get('budgets', id);
            if (!Array.isArray(b.items)) b.items = [];
            const coOpts = cache.clients.map(c => `<option value="${c.id}" ${c.id == b.clientId ? 'selected' : ''}>${c.name}</option>`).join('');

            this.showModal(`<div class="p-6 overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h3 class="text-xl font-bold text-slate-800">Editar Presupuesto</h3>
                        <p class="text-sm text-amber-600 font-medium mt-0.5"><i class="fas fa-tag mr-1"></i>${b.codigo}</p>
                    </div>
                    <button onclick="app.closeModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button>
                </div>
                <form id="budgetEditForm" onsubmit="app.updateBudget(event,${b.id})" class="space-y-6">
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                             <select id="budget-edit-client-select" name="clientId" required class="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"><option value="">Buscar cliente...</option>${coOpts}</select></div>
                        <div><label class="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                             <input type="date" name="date" value="${b.date}" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"></div>
                        <div class="col-span-2"><label class="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                             <textarea name="observaciones" rows="2" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none resize-none" placeholder="Notas adicionales...">${b.observaciones || ''}</textarea></div>
                    </div>
                    <div class="border rounded-lg p-4 bg-gray-50">
                        <h4 class="font-bold text-sm text-gray-600 mb-3 uppercase tracking-wide">Productos</h4>
                        <div id="budget-items-container" class="space-y-2"></div>
                        <button type="button" onclick="app.addBudgetItemRow()" class="mt-3 text-sm font-medium flex items-center gap-1" style="color:${BRAND_COLOR}"><i class="fas fa-plus-circle"></i>Agregar Producto</button>
                    </div>
                    <div class="flex justify-end pt-2">
                        <div class="w-72 space-y-1 text-sm">
                            <div class="flex justify-between text-gray-500"><span>Subtotal (sin IVA)</span><span id="budget-neto-display" class="font-medium">$0.00</span></div>
                            <div class="flex justify-between text-gray-500"><span>IVA</span><span id="budget-iva-display" class="font-medium">$0.00</span></div>
                            <div class="flex justify-between text-xl font-bold text-slate-800 border-t border-gray-200 pt-2 mt-2"><span>Total</span><span id="budget-total-display">$0.00</span></div>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 border-t border-gray-200 pt-4">
                        <button type="button" onclick="app.closeModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancelar</button>
                        <button type="submit" id="btn-update-budget" class="px-6 py-2 rounded-lg font-medium transition shadow-lg" style="background-color:#eab308; color:#000"><i class="fas fa-save mr-2"></i>Guardar Cambios</button>
                    </div>
                </form></div>`, true);

            setTimeout(() => {
                new TomSelect('#budget-edit-client-select', { create: false, sortField: { field: "text", direction: "asc" } });
                // Pre-cargar los productos existentes del presupuesto
                b.items.forEach(item => {
                    this.addBudgetItemRow(item);
                });
                this.calculateBudgetTotal();
            }, 100);

        } catch(err) {
            this.showToast('Error al cargar presupuesto: ' + err.message, 'error');
            this.closeModal();
        }
    },

    async updateBudget(e, id) {
        e.preventDefault();
        const f   = new FormData(e.target);
        const btn = document.getElementById('btn-update-budget');
        const items = [];
        document.querySelectorAll('.budget-row').forEach(row => {
            const qty = parseFloat(row.querySelector('input[name="qty"]').value) || 0;
            const pid = row.dataset.productid;
            if (pid && qty > 0) {
                items.push({ productId: parseInt(pid), productCode: row.dataset.code, productName: row.dataset.name, qty, price: parseFloat(row.dataset.price), tax: parseFloat(row.dataset.tax), idunidad: parseInt(row.dataset.idunidad) || 1 });
            }
        });
        if (items.length === 0) { this.showToast('Agrega al menos un producto', 'error'); return; }
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Guardando...';
        try {
            await api.put('budgets', id, { clientId: f.get('clientId'), date: f.get('date'), observaciones: f.get('observaciones'), items });
            this.closeModal(); this.showToast('Presupuesto actualizado correctamente');
            const b = await api.get('budgets', id);
            const idx = cache.budgets.findIndex(x => x.id == id);
            if (idx !== -1) cache.budgets[idx] = { id: b.id, codigo: b.codigo, clientId: b.clientId, date: b.date, neto: b.neto, totaliva: b.totaliva, total: b.total, status: b.status, clientName: b.clientName };
            this.renderBudgets();
        } catch(err) {
            this.showToast('Error: ' + err.message, 'error');
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-save mr-2"></i>Guardar Cambios';
        }
    },

    async viewBudget(id) {
        this.showModal(`<div class="p-8 flex items-center justify-center h-40 text-gray-400"><i class="fas fa-circle-notch fa-spin mr-2"></i>Cargando vista previa...</div>`, true);
        try {
            const b   = await api.get('budgets', id);
            if (!Array.isArray(b.items)) b.items = [];
            const cfg = APP_SETTINGS.company;
            const doc = APP_SETTINGS.docConfig.presupuesto || { color: '#0f6dc1', logoUrl: cfg.logoUrl, rowHeight: 'py-2' };

            // Pagination: 25 líneas fijas por página (salto de página si excede)
            // Se fuerza rowPx a 24 (py-1) para que quepan exactamente 25 líneas en carta
            // Page: 1056px total, 40px padding top+bottom = 976px available
            // Overhead breakdown (px):
            //   First page:  logo(85) + bar(48) + client(85) + thead(38) + footer(44) = 300
            //   Last extra:  totals-block(100) + Total Artículos(20) + observations(45) = 165
            //   Other pages: simple-header(38) + thead(38) + footer(44) = 120
            const rowPx = 24;
            const AVAIL         = 880;
            const OH_FIRST      = 300;
            const OH_LAST_EXTRA = 165;
            const OH_OTHER      = 120;
            const MAX_LINES     = 25;
            const CAP_SINGLE = Math.min(MAX_LINES, Math.max(3, Math.floor((AVAIL - OH_FIRST - OH_LAST_EXTRA) / rowPx)));
            const CAP_FIRST  = Math.min(MAX_LINES, Math.max(3, Math.floor((AVAIL - OH_FIRST)                 / rowPx)));
            const CAP_LAST   = Math.min(MAX_LINES, Math.max(3, Math.floor((AVAIL - OH_OTHER - OH_LAST_EXTRA) / rowPx)));
            const CAP_MID    = Math.min(MAX_LINES, Math.max(3, Math.floor((AVAIL - OH_OTHER)                 / rowPx)));

            const pages = [];
            const _items = [...b.items];
            if (_items.length === 0) {
                pages.push([]);
            } else if (_items.length <= MAX_LINES) {
                pages.push(_items.splice(0, _items.length));
            } else {
                pages.push(_items.splice(0, CAP_FIRST));
                while (_items.length > 0) {
                    const cap = _items.length <= CAP_LAST ? CAP_LAST : CAP_MID;
                    pages.push(_items.splice(0, cap));
                }
            }

            // Calculate Base and Tax breakdown dynamically
            const taxGroups = {};
            b.items.forEach(item => {
                const rate = parseFloat(item.tax) || 0;
                const lineNeto = item.qty * item.price;
                const lineIva = lineNeto * (rate / 100);
                if (!taxGroups[rate]) {
                    taxGroups[rate] = { base: 0, iva: 0 };
                }
                taxGroups[rate].base += lineNeto;
                taxGroups[rate].iva += lineIva;
            });

            const taxSummaryHtml = Object.keys(taxGroups).map(rate => {
                const info = taxGroups[rate];
                return `
                <div class="grid grid-cols-4 gap-2 text-[11px] text-slate-700 uppercase pt-1 border-t border-slate-100 font-mono">
                    <span class="font-bold text-slate-800">IVA ${rate}%</span>
                    <span>${this.formatCurrency(info.base)}</span>
                    <span>${parseFloat(rate)}%</span>
                    <span class="font-medium text-slate-900">${this.formatCurrency(info.iva)}</span>
                </div>`;
            }).join('');

            const totalPages = pages.length;
            let pagesHtml = '';

            pages.forEach((pageItems, idx) => {
                const pageNum = idx + 1;
                const isFirst = pageNum === 1;
                const isLast = pageNum === totalPages;

                const itemsHtml = pageItems.map((item, itemIdx) => {
                    const bg = itemIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                    const unitObj = cache.unidades.find(u => u.id == (item.idunidad || 1));
                    const unitName = unitObj ? unitObj.name : 'PZA';
                    return `
                    <tr class="${bg}">
                        <td class="py-1 px-2 text-center text-xs font-bold text-slate-700">${parseFloat(item.qty).toFixed(2)}</td>
                        <td class="py-1 px-2 text-center text-[10px] text-slate-500 uppercase">${unitName}</td>
                        <td class="py-1 px-2 text-xs font-mono text-slate-600">${String(item.productCode || '').split('-')[0]}</td>
                        <td class="py-1 px-2 text-xs text-slate-800">${item.productName}</td>
                        <td class="py-1 px-2 text-right text-xs text-slate-700 font-mono">${this.formatCurrency(item.price)}</td>
                        <td class="py-1 px-2 text-right text-xs text-slate-700 font-mono">${this.formatCurrency(item.qty * item.price)}</td>
                        <td class="py-1 px-2 text-right text-xs text-slate-600 font-mono">${parseFloat(item.tax)}%</td>
                    </tr>`;
                }).join('');

                pagesHtml += `
                <div class="page-sheet bg-white flex flex-col justify-between" style="font-family: Arial, sans-serif; height: 960px; overflow: hidden; box-sizing: border-box;">
                    <div class="flex-grow flex flex-col justify-start">
                        ${isFirst ? `
                        <!-- Logo and Company Header -->
                        <div class="flex justify-between items-start mb-4" style="font-family: Arial, sans-serif;">
                            <div>
                                <img src="${doc.logoUrl || cfg.logoUrl}" alt="Logo" class="h-16 w-auto object-contain">
                            </div>
                            <div class="text-right text-[10px] text-slate-700 leading-normal uppercase">
                                <strong class="text-xs text-slate-800">${cfg.name} ${cfg.legalName}</strong><br>
                                RFC: ${cfg.rfc}<br>
                                ${cfg.address}<br>
                                ${cfg.phone ? cfg.phone + ' · ' : ''}${cfg.email} · suncatcher.com.mx
                            </div>
                        </div>

                        <!-- Budget Three-Block Bar -->
                        <div class="flex items-stretch mb-4 select-none" style="font-family: Arial, sans-serif;">
                            <div class="flex-1 py-2.5 px-4 text-white font-bold text-sm uppercase tracking-wide flex items-center" style="background-color: ${doc.color};">
                                PRESUPUESTO ${b.codigo}
                            </div>
                            <div class="w-32 bg-slate-100 flex items-center justify-center border-l-4 border-white text-slate-800 font-bold text-xs">
                                ${(b.date || '').split('-').reverse().join('-')}
                            </div>
                            <div class="w-44 bg-slate-100 flex items-center justify-center border-l-4 border-white text-slate-800 font-bold text-xs">
                                ${this.formatCurrency(b.total)}
                            </div>
                        </div>

                        <!-- Client Info -->
                        <div class="mb-4 text-left" style="font-family: Arial, sans-serif;">
                            <span class="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Cliente</span>
                            <div class="text-[11px] text-slate-800 leading-normal uppercase">
                                <strong>${b.clientName}</strong><br>
                                RFC: ${b.clientRfc}<br>
                                ${b.clientStreet ? b.clientStreet + ', ' : ''}${b.clientCity ? b.clientCity : ''} ${b.clientZip ? b.clientZip : ''}
                            </div>
                        </div>
                        ` : `
                        <!-- Simple header for secondary pages -->
                        <div class="flex justify-between items-center border-b border-slate-200 pb-2 mb-4 text-xs text-slate-500 uppercase font-bold tracking-wider">
                            <span>PRESUPUESTO ${b.codigo}</span>
                            <span>Fecha: ${(b.date || '').split('-').reverse().join('-')}</span>
                        </div>
                        `}

                        <!-- Table -->
                        <table class="w-full mb-4 border-collapse">
                            <thead>
                                <tr class="text-white text-xs uppercase" style="background-color:${doc.color}">
                                    <th class="py-2.5 px-2 text-center w-14">Cant.</th>
                                    <th class="py-2.5 px-2 text-center w-14">Unidad</th>
                                    <th class="py-2.5 px-2 text-left w-20">SAT</th>
                                    <th class="py-2.5 px-2 text-left">Descripción</th>
                                    <th class="py-2.5 px-2 text-right w-20">Precio</th>
                                    <th class="py-2.5 px-2 text-right w-20">Neto</th>
                                    <th class="py-2.5 px-2 text-right w-12">Imp.</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                ${itemsHtml}
                            </tbody>
                        </table>

                        ${isLast ? `
                        <!-- Totals and Tax Breakdown -->
                        <div class="flex justify-between items-start mt-8 mb-2 select-none" style="font-family: Arial, sans-serif;">
                            <div class="w-[60%]">
                                <div class="grid grid-cols-4 gap-2 text-[10px] font-bold text-slate-500 uppercase mb-2">
                                    <span>Impuesto</span>
                                    <span>Base Imponible</span>
                                    <span>Porcentaje</span>
                                    <span>Importe</span>
                                </div>
                                <div class="space-y-1">
                                    ${taxSummaryHtml}
                                </div>
                            </div>
                            <div class="w-[35%]">
                                <div class="text-white text-center py-4 px-4 font-bold text-base uppercase tracking-wider" style="background-color:${doc.color}">
                                    TOTAL: ${this.formatCurrency(b.total)}
                                </div>
                                <div class="text-center mt-2 text-xs text-slate-500 font-medium uppercase">
                                    (${app.numeroALetras(b.total)} M.N.)
                                </div>
                            </div>
                        </div>
                        <div class="text-xs text-slate-500 mt-2">
                            <strong>Total Artículos:</strong> ${b.items.length}
                        </div>
                        ${b.observaciones ? `<div class="mt-2 p-3 bg-gray-50 rounded border border-gray-200 text-xs text-gray-600"><strong>Observaciones:</strong> ${b.observaciones}</div>` : ''}
                        ` : ''}
                    </div>

                    <!-- Footer -->
                    <div class="border-t border-slate-200 pt-3 text-xs text-slate-400 select-none flex justify-between items-center mt-auto">
                        <span>${cfg.name} ${cfg.legalName} &copy; ${new Date().getFullYear()}</span>
                        <span class="bg-slate-100 py-1 px-3 rounded text-slate-500 font-bold">${pageNum} / ${totalPages}</span>
                    </div>
                </div>`;
                if (!isLast) {
                    pagesHtml += '<div class="html2pdf__page-break"></div>';
                }
            });

            this.showModal(`<div class="bg-white flex flex-col w-full" style="height: 85vh;" id="document-container">
                <div class="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 no-print flex-shrink-0">
                    <h3 class="font-bold text-slate-700">Vista Previa: ${b.codigo}</h3>
                    <div class="flex gap-2">
                        <button onclick="window.print()" class="px-3 py-1.5 text-white rounded text-sm hover:opacity-90 transition" style="background-color:${doc.color}"><i class="fas fa-print mr-1"></i>Imprimir</button>
                        <button onclick="app.downloadPDF('printable-area', '${b.codigo}')" class="px-3 py-1.5 text-white rounded text-sm hover:opacity-90 transition" style="background-color:${doc.color}"><i class="fas fa-file-pdf mr-1"></i>PDF</button>
                        <button onclick="app.sendEmail(${b.id},'${String(b.clientEmail).replace(/'/g,"\\'")}','${String(b.clientName).replace(/'/g,"\\'")}','${String(b.codigo).replace(/'/g,"\\'")}')" class="px-3 py-1.5 text-white rounded text-sm hover:opacity-90 transition" style="background-color:${doc.color}"><i class="fas fa-paper-plane mr-1"></i>Enviar Correo</button>
                        <button onclick="app.closeModal()" class="px-3 py-1.5 text-gray-500 hover:bg-gray-200 rounded text-sm transition">Cerrar</button>
                    </div>
                </div>
                <div class="flex-1 overflow-y-scroll bg-gray-100 py-8">
                    <div id="printable-area" class="w-full max-w-[816px] bg-transparent">
                        ${pagesHtml}
                    </div>
                </div>
            </div>`, true);
        } catch(err) {
            this.showToast('Error al cargar presupuesto: ' + err.message, 'error');
            this.closeModal();
        }
    },

    downloadPDF(elementId, filename) {
        const element = document.getElementById(elementId);
        if (!element) { this.showToast('No se encontró el documento', 'error'); return; }
        
        // Fix for html2canvas blank page bug in scrolled containers
        if (element.parentElement) element.parentElement.scrollTop = 0;
        
        const opt = {
            margin:      0.5,
            filename:    `${filename}.pdf`,
            image:       { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
            jsPDF:       { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    },

    async sendEmail(budgetId, email, clientName, codigo) {
        // Get reference to printable-area (still in the DOM, visible in the view modal)
        const originalElement = document.getElementById('printable-area');
        if (!originalElement) {
            this.showToast('No se encontró el documento para enviar', 'error');
            return;
        }

        // Save modal state for "Regresar" button BEFORE replacing content
        const modalContent = document.getElementById('modal-content');
        const prevModalHtml = modalContent.innerHTML;

        // Generate PDF FIRST while element is still in the DOM with all Tailwind styles applied
        let pdfBase64 = null;
        try {
            if (originalElement.parentElement) originalElement.parentElement.scrollTop = 0;
            const opt = {
                margin:      0.5,
                filename:    `${codigo}.pdf`,
                image:       { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
                jsPDF:       { unit: 'in', format: 'letter', orientation: 'portrait' }
            };
            pdfBase64 = await html2pdf().set(opt).from(originalElement).output('datauristring');
            if (!pdfBase64 || pdfBase64.length < 100) {
                console.error('PDF generation produced empty/too short result');
            }
        } catch (err) {
            console.error("Error generating PDF:", err);
        }

        // Now safe to replace modal content — PDF is already generated
        this.showModal(`<div class="p-8 flex items-center justify-center h-40 text-gray-400"><i class="fas fa-circle-notch fa-spin mr-2"></i>Preparando envío...</div>`, true);

        // Clone original for preview (remove logos, page numbers)
        const previewClone = originalElement.cloneNode(true);
        previewClone.querySelectorAll('img[alt="Logo"]').forEach(el => el.remove());
        previewClone.querySelectorAll('.bg-slate-100.py-1.px-3.rounded.text-slate-500.font-bold').forEach(el => el.remove());
        const htmlContent = previewClone.outerHTML;

        // Show the email composer

        const defaultSubject = codigo;
        const defaultBody = `Estimado(a) ${clientName},\n\nLe enviamos adjunto el documento ${codigo} solicitado.\n\nQuedamos a su entera disposición para cualquier duda o comentario.`;
        const defaultSignature = `Atentamente,\n${APP_SETTINGS.company.name} ${APP_SETTINGS.company.legalName}\nTel: ${APP_SETTINGS.company.phone}\nEmail: ${APP_SETTINGS.company.email}`;

        const composerHtml = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-slate-800"><i class="fas fa-envelope mr-2 text-[#0f6dc1]"></i>Redactar Correo</h3>
                <button id="btn-composer-back" class="text-gray-400 hover:text-gray-600 text-sm font-medium"><i class="fas fa-arrow-left mr-1"></i>Regresar</button>
            </div>
            <form id="emailComposerForm" class="space-y-4">
                <input type="hidden" name="htmlContent" id="email-html-content">
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Destinatario (Email)</label>
                    <input type="email" name="to" value="${email}" required class="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">CCO (Copia Oculta)</label>
                    <input type="text" name="bcc" placeholder="correo@ejemplo.com, otro@ejemplo.com" class="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Asunto</label>
                    <input type="text" name="subject" value="${defaultSubject}" required class="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Mensaje</label>
                    <textarea name="message" rows="5" required class="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm">${defaultBody}</textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Firma</label>
                    <textarea name="signature" rows="3" required class="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm">${defaultSignature}</textarea>
                </div>
                <div class="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                    <div class="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
                        <span class="text-xs font-semibold text-slate-600 uppercase tracking-wide"><i class="fas fa-paperclip mr-1"></i>Adjunto: ${codigo}.pdf</span>
                        <button type="button" id="btn-toggle-preview" class="text-xs text-blue-600 hover:text-blue-800 font-medium">Vista Previa</button>
                    </div>
                    <div id="attachment-preview" class="hidden p-4 max-h-64 overflow-y-auto text-xs text-slate-700 leading-relaxed bg-white" style="font-family: monospace;"></div>
                </div>
                <div class="pt-4 flex justify-end gap-3 border-t border-gray-100">
                    <button type="button" id="btn-composer-cancel" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition text-sm">Cancelar</button>
                    <button type="submit" id="btn-send-email-submit" class="px-6 py-2 text-white rounded-lg font-medium transition shadow-lg bg-blue-600 hover:bg-blue-700 text-sm"><i class="fas fa-paper-plane mr-2"></i>Enviar Documento</button>
                </div>
            </form>
        </div>`;

        modalContent.innerHTML = composerHtml;
        document.getElementById('email-html-content').value = htmlContent;

        const restoreModal = () => {
            modalContent.innerHTML = prevModalHtml;
        };

        document.getElementById('btn-composer-back').onclick = restoreModal;
        document.getElementById('btn-composer-cancel').onclick = restoreModal;

        // Toggle attachment preview
        document.getElementById('btn-toggle-preview').onclick = () => {
            const preview = document.getElementById('attachment-preview');
            if (preview.classList.contains('hidden')) {
                preview.innerHTML = htmlContent;
                preview.classList.remove('hidden');
            } else {
                preview.classList.add('hidden');
            }
        };

        document.getElementById('emailComposerForm').onsubmit = async (e) => {
            e.preventDefault();
            const f = new FormData(e.target);
            const to = f.get('to');
            const subject = f.get('subject');
            const message = f.get('message').replace(/\n/g, '<br>');
            const signature = f.get('signature').replace(/\n/g, '<br>');

            const btn = document.getElementById('btn-send-email-submit');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Enviando...';

            const bcc = f.get('bcc') ? f.get('bcc').split(',').map(s => s.trim()).filter(s => s) : [];

            const fullHtml = `
            <div style="font-family: Arial, sans-serif; color: #334155; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
                <div style="margin-bottom: 24px; font-size: 14px; color: #1e293b;">
                    ${message}
                </div>
                <div style="margin-bottom: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #64748b;">
                    ${signature}
                </div>
            </div>`;

            if (!pdfBase64) {
                app.showToast('Error: No se pudo generar el PDF adjunto', 'error');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Enviar Documento';
                return;
            }
            try {
                const res = await fetch('email.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ to, bcc, subject, html: fullHtml, pdfBase64, pdfName: `${codigo}.pdf` })
                });
                const data = await res.json();
                if (data.success) {
                    await api.put('budgets', budgetId, { status: 'Enviado' });
                    app.showToast(`Correo enviado exitosamente a ${to}`);
                    app.closeModal();
                    cache.budgets = await api.get('budgets');
                    if (app.currentView === 'budgets') app.renderBudgets();
                } else {
                    throw new Error(data.error || 'Error al enviar correo');
                }
            } catch (err) {
                app.showToast('Error: ' + err.message, 'error');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Enviar Documento';
            }
        };
    },

    async viewReceipt(id) {
        this.showModal(`<div class="p-8 flex items-center justify-center h-40 text-gray-400"><i class="fas fa-circle-notch fa-spin mr-2"></i>Cargando recibo...</div>`, true);
        try {
            const b   = await api.get('budgets', id);
            if (!Array.isArray(b.items)) b.items = [];
            const cfg = APP_SETTINGS.company;
            const doc = APP_SETTINGS.docConfig.recibo || { color: '#0f6dc1', logoUrl: cfg.logoUrl, rowHeight: 'py-3' };

            // Pagination: 25 líneas fijas por página (salto de página si excede)
            // Se fuerza rowPx a 24 (py-1) para que quepan exactamente 25 líneas en carta
            // Last extra: Total Artículos(20) + firma(140) = 160
            const rowPx = 24;
            const AVAIL         = 880;
            const OH_FIRST      = 300;
            const OH_LAST_EXTRA = 160;
            const OH_OTHER      = 120;
            const MAX_LINES     = 25;
            const CAP_SINGLE = Math.min(MAX_LINES, Math.max(3, Math.floor((AVAIL - OH_FIRST - OH_LAST_EXTRA) / rowPx)));
            const CAP_FIRST  = Math.min(MAX_LINES, Math.max(3, Math.floor((AVAIL - OH_FIRST)                 / rowPx)));
            const CAP_LAST   = Math.min(MAX_LINES, Math.max(3, Math.floor((AVAIL - OH_OTHER - OH_LAST_EXTRA) / rowPx)));
            const CAP_MID    = Math.min(MAX_LINES, Math.max(3, Math.floor((AVAIL - OH_OTHER)                 / rowPx)));

            const pages = [];
            const _items = [...b.items];
            if (_items.length === 0) {
                pages.push([]);
            } else if (_items.length <= MAX_LINES) {
                pages.push(_items.splice(0, _items.length));
            } else {
                pages.push(_items.splice(0, CAP_FIRST));
                while (_items.length > 0) {
                    const cap = _items.length <= CAP_LAST ? CAP_LAST : CAP_MID;
                    pages.push(_items.splice(0, cap));
                }
            }

            const totalPages = pages.length;
            let pagesHtml = '';

            pages.forEach((pageItems, idx) => {
                const pageNum = idx + 1;
                const isFirst = pageNum === 1;
                const isLast = pageNum === totalPages;

                const itemsHtml = pageItems.map((item, itemIdx) => {
                    const bg = itemIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                    const unitObj = cache.unidades.find(u => u.id == (item.idunidad || 1));
                    const unitName = unitObj ? unitObj.name : 'PZA';
                    return `
                    <tr class="${bg}">
                        <td class="py-1 px-2 text-center text-xs font-bold text-slate-700 w-16">${parseFloat(item.qty).toFixed(2)}</td>
                        <td class="py-1 px-2 text-center text-xs text-slate-500 uppercase w-16">${unitName}</td>
                        <td class="py-1 px-2 text-xs font-mono text-slate-600 w-24">${String(item.productCode || '').split('-')[0]}</td>
                        <td class="py-1 px-2 text-xs text-slate-800">${item.productName}</td>
                    </tr>`;
                }).join('');

                pagesHtml += `
                <div class="page-sheet bg-white flex flex-col justify-between" style="font-family: Arial, sans-serif; height: 960px; overflow: hidden; box-sizing: border-box;">
                    <div class="flex-grow flex flex-col justify-start">
                        ${isFirst ? `
                        <!-- Logo and Company Header -->
                        <div class="flex justify-between items-start mb-4" style="font-family: Arial, sans-serif;">
                            <div>
                                <img src="${doc.logoUrl || cfg.logoUrl}" alt="Logo" class="h-16 w-auto object-contain">
                            </div>
                            <div class="text-right text-[10px] text-slate-700 leading-normal uppercase">
                                <strong class="text-xs text-slate-800">${cfg.name} ${cfg.legalName}</strong><br>
                                RFC: ${cfg.rfc}<br>
                                ${cfg.address}
                            </div>
                        </div>

                        <!-- Receipt Three-Block Bar -->
                        <div class="flex items-stretch mb-4 select-none" style="font-family: Arial, sans-serif;">
                            <div class="flex-1 py-2.5 px-4 text-white font-bold text-sm uppercase tracking-wide flex items-center" style="background-color: ${doc.color};">
                                RECIBO DE MERCANCÍA ${b.codigo}
                            </div>
                            <div class="w-32 bg-slate-100 flex items-center justify-center border-l-4 border-white text-slate-800 font-bold text-xs">
                                ${(b.date || '').split('-').reverse().join('-')}
                            </div>
                            <div class="w-44 bg-slate-100 flex items-center justify-center border-l-4 border-white text-slate-500 font-bold text-xs uppercase">
                                ENTREGA
                            </div>
                        </div>

                        <!-- Client Info -->
                        <div class="mb-4 text-left" style="font-family: Arial, sans-serif;">
                            <span class="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Datos de Entrega (Cliente)</span>
                            <div class="text-[11px] text-slate-800 leading-normal uppercase">
                                <strong>${b.clientName}</strong><br>
                                RFC: ${b.clientRfc}<br>
                                ${b.clientStreet ? b.clientStreet + ', ' : ''}${b.clientCity ? b.clientCity : ''} ${b.clientZip ? b.clientZip : ''}
                            </div>
                        </div>
                        ` : `
                        <!-- Simple header for secondary pages -->
                        <div class="flex justify-between items-center border-b border-slate-200 pb-2 mb-4 text-xs text-slate-500 uppercase font-bold tracking-wider">
                            <span>RECIBO DE MERCANCÍA ${b.codigo}</span>
                            <span>Fecha: ${(b.date || '').split('-').reverse().join('-')}</span>
                        </div>
                        `}

                        <!-- Table -->
                        <table class="w-full mb-4 border-collapse">
                            <thead>
                                <tr class="text-white text-xs uppercase" style="background-color:${doc.color}">
                                    <th class="py-2.5 px-2 text-center w-16">Cantidad</th>
                                    <th class="py-2.5 px-2 text-center w-16">Unidad</th>
                                    <th class="py-2.5 px-2 text-left w-24">SAT</th>
                                    <th class="py-2.5 px-2 text-left">Descripción del Producto</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                ${itemsHtml}
                            </tbody>
                        </table>

                        ${isLast ? `
                        <!-- Total Artículos -->
                        <div class="text-xs text-slate-600 mt-2">
                            <strong>Total Artículos:</strong> ${b.items.length}
                        </div>

                        <!-- Signature Blocks -->
                        <div class="signature-block mt-6 pt-4 text-center select-none" style="font-family: Arial, sans-serif;">
                            <div class="grid grid-cols-2 gap-8">
                                <div style="border-top:2px dashed #cbd5e1; padding-top:12px;">
                                    <p style="font-size:12px; font-weight:700; color:#1e293b; margin-bottom:4px; text-transform: uppercase;">Firma de Conformidad</p>
                                    <p style="font-size:10px; color:#64748b;">Nombre y Firma de quien recibe la mercancía</p>
                                </div>
                                <div style="border-top:2px dashed #cbd5e1; padding-top:12px;">
                                    <p style="font-size:12px; font-weight:700; color:#1e293b; margin-bottom:4px; text-transform: uppercase;">Control de Entrega</p>
                                    <p style="font-size:10px; color:#64748b;">Nombre y Número de Empleado / Cargo</p>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>

                    <!-- Footer -->
                    <div class="border-t border-slate-200 pt-3 text-xs text-slate-400 select-none flex justify-between items-center mt-auto">
                        <span>${cfg.name} ${cfg.legalName} &copy; ${new Date().getFullYear()}</span>
                        <span class="bg-slate-100 py-1 px-3 rounded text-slate-500 font-bold">${pageNum} / ${totalPages}</span>
                    </div>
                </div>`;
                if (!isLast) {
                    pagesHtml += '<div class="html2pdf__page-break"></div>';
                }
            });

            this.showModal(`<div class="bg-white flex flex-col w-full" style="height: 85vh;" id="document-container">
                <div class="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 no-print flex-shrink-0">
                    <h3 class="font-bold text-slate-700">Recibo de Mercancía: ${b.codigo}</h3>
                    <div class="flex gap-2">
                        <button onclick="window.print()" class="px-3 py-1.5 text-white rounded text-sm hover:opacity-90 transition" style="background-color:${doc.color}"><i class="fas fa-print mr-1"></i>Imprimir</button>
                        <button onclick="app.downloadPDF('printable-area', 'Recibo_${b.codigo}')" class="px-3 py-1.5 text-white rounded text-sm hover:opacity-90 transition" style="background-color:${doc.color}"><i class="fas fa-file-pdf mr-1"></i>PDF</button>
                        <button onclick="app.sendEmail(${b.id},'${String(b.clientEmail).replace(/'/g,"\\'")}','${String(b.clientName).replace(/'/g,"\\'")}','Recibo ${String(b.codigo).replace(/'/g,"\\'")}')" class="px-3 py-1.5 text-white rounded text-sm hover:opacity-90 transition" style="background-color:${doc.color}"><i class="fas fa-paper-plane mr-1"></i>Enviar Correo</button>
                        <button onclick="app.closeModal()" class="px-3 py-1.5 text-gray-500 hover:bg-gray-200 rounded text-sm transition">Cerrar</button>
                    </div>
                </div>
                <div class="flex-1 overflow-y-scroll bg-gray-100 py-8">
                    <div id="printable-area" class="w-full max-w-[816px] bg-transparent">
                        ${pagesHtml}
                    </div>
                </div>
            </div>`, true);
        } catch(err) {
            this.showToast('Error al cargar recibo: ' + err.message, 'error');
            this.closeModal();
        }
    },

    // ==================== CONFIGURACIÓN ====================
    renderSettings() {
        const s = APP_SETTINGS;
        const d = s.docConfig || {};
        const dp = d.presupuesto || { color:'#0f6dc1', rowHeight:'py-2', logoUrl:s.company.logoUrl };
        const dr = d.recibo || { color:'#0f6dc1', rowHeight:'py-3', logoUrl:s.company.logoUrl };

        document.getElementById('content-area').innerHTML = `
        <div class="max-w-6xl mx-auto fade-in">
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div class="p-6 border-b border-gray-100 flex items-center gap-3">
                    <div class="p-3 rounded-lg text-white" style="background-color:${BRAND_COLOR}"><i class="fas fa-sliders-h text-xl"></i></div>
                    <div><h3 class="font-bold text-lg text-slate-800">Configuración del Sistema</h3></div>
                </div>
                <div class="p-6 space-y-8">
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <!-- Empresa y SMTP -->
                        <div class="space-y-6">
                            <div class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h4 class="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2"><i class="fas fa-building"></i>Datos de la Empresa</h4>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Nombre Comercial</label><input type="text" id="set-company-name" value="${s.company.name}" class="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"></div>
                                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Razón Legal</label><input type="text" id="set-company-legal" value="${s.company.legalName}" class="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"></div>
                                    <div><label class="block text-sm font-medium text-gray-700 mb-1">RFC</label><input type="text" id="set-company-rfc" value="${s.company.rfc}" class="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none uppercase"></div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Logotipo Principal</label>
                                        <div class="flex items-center gap-3">
                                            <img id="logo-preview" src="${s.company.logoUrl}" class="h-10 w-10 object-contain border rounded bg-gray-50 p-1">
                                            <input type="file" accept="image/*" onchange="app.handleFileUpload(event, 'set-company-logo-url', 'logo-preview')" class="w-full text-sm">
                                            <input type="hidden" id="set-company-logo-url" value="${s.company.logoUrl}">
                                        </div>
                                    </div>
                                    <div class="md:col-span-2"><label class="block text-sm font-medium text-gray-700 mb-1">Dirección</label><input type="text" id="set-company-address" value="${s.company.address}" class="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"></div>
                                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Teléfono</label><input type="tel" id="set-company-phone" value="${s.company.phone}" class="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"></div>
                                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Email Corporativo</label><input type="email" id="set-company-email" value="${s.company.email}" class="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"></div>
                                </div>
                            </div>
                            <div class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h4 class="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2"><i class="fas fa-envelope"></i>SMTP</h4>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div class="md:col-span-2"><input type="text" id="set-smtp-host" value="${s.smtp.host}" placeholder="Host SMTP" class="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"></div>
                                    <div><input type="number" id="set-smtp-port" value="${s.smtp.port}" placeholder="Puerto" class="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"></div>
                                    <div><select id="set-smtp-secure" class="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"><option value="tls" ${s.smtp.secure==='tls'?'selected':''}>TLS</option><option value="ssl" ${s.smtp.secure==='ssl'?'selected':''}>SSL</option></select></div>
                                    <div><input type="text" id="set-smtp-user" value="${s.smtp.user}" placeholder="Usuario" class="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"></div>
                                    <div><input type="password" id="set-smtp-pass" value="${s.smtp.pass}" placeholder="Contraseña" class="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Documentos -->
                        <div class="space-y-6">
                            <div class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h4 class="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2"><i class="fas fa-file-invoice"></i>Diseño Presupuesto</h4>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Color</label><input type="color" id="doc-p-color" value="${dp.color}" class="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"></div>
                                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Fila</label><select id="doc-p-row" class="w-full px-4 py-2 border border-gray-300 rounded-lg"><option value="py-1" ${dp.rowHeight==='py-1'?'selected':''}>Pequeña</option><option value="py-2" ${dp.rowHeight==='py-2'?'selected':''}>Normal</option><option value="py-3" ${dp.rowHeight==='py-3'?'selected':''}>Grande</option></select></div>
                                    <div class="md:col-span-2">
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Logotipo (Presupuesto)</label>
                                        <div class="flex items-center gap-3">
                                            <img id="logo-p-preview" src="${dp.logoUrl || s.company.logoUrl}" class="h-10 w-10 object-contain border rounded bg-gray-50 p-1">
                                            <input type="file" accept="image/*" onchange="app.handleFileUpload(event, 'doc-p-logo', 'logo-p-preview')" class="w-full text-sm">
                                            <input type="hidden" id="doc-p-logo" value="${dp.logoUrl}">
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h4 class="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2"><i class="fas fa-truck-loading"></i>Diseño Recibo</h4>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Color</label><input type="color" id="doc-r-color" value="${dr.color}" class="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"></div>
                                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Fila</label><select id="doc-r-row" class="w-full px-4 py-2 border border-gray-300 rounded-lg"><option value="py-1" ${dr.rowHeight==='py-1'?'selected':''}>Pequeña</option><option value="py-2" ${dr.rowHeight==='py-2'?'selected':''}>Normal</option><option value="py-3" ${dr.rowHeight==='py-3'?'selected':''}>Grande</option></select></div>
                                    <div class="md:col-span-2">
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Logotipo (Recibo)</label>
                                        <div class="flex items-center gap-3">
                                            <img id="logo-r-preview" src="${dr.logoUrl || s.company.logoUrl}" class="h-10 w-10 object-contain border rounded bg-gray-50 p-1">
                                            <input type="file" accept="image/*" onchange="app.handleFileUpload(event, 'doc-r-logo', 'logo-r-preview')" class="w-full text-sm">
                                            <input type="hidden" id="doc-r-logo" value="${dr.logoUrl}">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="p-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                        <button onclick="app.navigate('dashboard')" class="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition">Cancelar</button>
                        <button onclick="app.saveAppSettings()" class="px-6 py-2 text-white rounded-lg font-medium transition shadow-lg" style="background-color:${BRAND_COLOR}"><i class="fas fa-save mr-2"></i>Guardar</button>
                    </div>
                </div>
            </div>
        </div>`;
    },

    async handleFileUpload(e, urlInputId, previewImgId) {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('logo', file);
        app.showToast('Subiendo imagen...', 'success');
        try {
            const res = await fetch('upload.php', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.url) {
                document.getElementById(urlInputId).value = data.url;
                document.getElementById(previewImgId).src = data.url;
                app.showToast('Logotipo subido correctamente');
            } else {
                app.showToast(data.error || 'Error al subir', 'error');
            }
        } catch (err) {
            app.showToast('Error de conexión al subir', 'error');
        }
    },

    async saveAppSettings() {
        const passField = document.getElementById('set-smtp-pass').value;
        const ns = {
            company: { name: document.getElementById('set-company-name').value, legalName: document.getElementById('set-company-legal').value, rfc: document.getElementById('set-company-rfc').value, logoUrl: document.getElementById('set-company-logo-url').value, address: document.getElementById('set-company-address').value, phone: document.getElementById('set-company-phone').value, email: document.getElementById('set-company-email').value },
            smtp: { host: document.getElementById('set-smtp-host').value, port: document.getElementById('set-smtp-port').value, secure: document.getElementById('set-smtp-secure').value, user: document.getElementById('set-smtp-user').value, pass: passField || APP_SETTINGS.smtp.pass },
            system: { ...APP_SETTINGS.system },
            docConfig: {
                presupuesto: { color: document.getElementById('doc-p-color').value, rowHeight: document.getElementById('doc-p-row').value, logoUrl: document.getElementById('doc-p-logo').value },
                recibo:      { color: document.getElementById('doc-r-color').value, rowHeight: document.getElementById('doc-r-row').value, logoUrl: document.getElementById('doc-r-logo').value }
            }
        };
        try {
            await api.post('settings', ns);
            saveSettings(ns);
            APP_SETTINGS = ns; 
            this.showToast('Configuración guardada en el servidor'); 
            const logo = document.querySelector('#sidebar img'); if (logo) logo.src = ns.company.logoUrl;
            const loginLogo = document.getElementById('login-logo'); if (loginLogo) loginLogo.src = ns.company.logoUrl;
        } catch(e) {
            this.showToast('Error al guardar en el servidor', 'error');
        }
    },

    resetSettings() {
        if (confirm('¿Restaurar valores por defecto?')) {
            APP_SETTINGS = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); saveSettings(APP_SETTINGS);
            this.showToast('Valores restaurados'); this.renderSettings();
        }
    },

    // ==================== UNIDADES ====================
    renderUnidades() {
        const rows = cache.unidades.map(u => `<tr class="border-b border-gray-100 hover:bg-gray-50 transition">
            <td class="py-4 px-4 whitespace-nowrap">
                <button onclick="app.openEditUnidadModal(${u.id})" class="text-[#0f6dc1] hover:text-blue-800 mx-1 p-2 hover:bg-blue-50 rounded-full transition" title="Editar"><i class="fas fa-edit"></i></button>
                <button onclick="app.deleteUnidad(${u.id})" class="text-red-400 hover:text-red-600 mx-1 p-2 hover:bg-red-50 rounded-full transition" title="Eliminar"><i class="fas fa-trash"></i></button>
            </td>
            <td class="py-4 px-4 font-medium text-slate-700">${u.name}</td>
        </tr>`).join('');

        document.getElementById('content-area').innerHTML = `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden fade-in">
                <div class="p-6 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
                    <div class="flex items-center gap-4">
                        <h3 class="font-bold text-lg text-slate-800">Unidades de Medida <span class="text-sm font-normal text-gray-400">(${cache.unidades.length})</span></h3>
                        <button onclick="app.openNewUnidadModal()" class="text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-md flex-shrink-0 hover:opacity-90" style="background-color:${BRAND_COLOR}"><i class="fas fa-plus mr-2"></i>Nueva Unidad</button>
                    </div>
                </div>
                <div class="overflow-x-auto"><table class="w-full text-left border-collapse">
                    <thead class="bg-gray-50 text-gray-500 text-xs uppercase font-semibold"><tr>
                        <th class="py-4 px-4 w-24">Acciones</th><th class="py-4 px-4">Unidad</th>
                    </tr></thead>
                    <tbody>${rows || '<tr><td colspan="2" class="py-8 text-center text-gray-400">No hay unidades registradas</td></tr>'}</tbody>
                </table></div>
            </div>`;
    },

    openNewUnidadModal() {
        this.showModal(`<div class="p-6">
            <div class="flex justify-between items-center mb-6"><h3 class="text-xl font-bold text-slate-800">Nueva Unidad</h3><button onclick="app.closeModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button></div>
            <form onsubmit="app.saveUnidad(event)" class="space-y-5">
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Nombre de la Unidad *</label>
                     <input type="text" name="name" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f6dc1] outline-none" placeholder="Ej: PZA, KG, M, LTS"></div>
                <div class="pt-4 flex justify-end gap-3 border-t border-gray-100">
                    <button type="button" onclick="app.closeModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancelar</button>
                    <button type="submit" class="px-6 py-2 text-white rounded-lg font-medium transition shadow-lg" style="background-color:${BRAND_COLOR}">Guardar</button>
                </div>
            </form></div>`);
    },

    async saveUnidad(e) {
        e.preventDefault();
        const f = new FormData(e.target);
        try {
            await api.post('unidades', { name: f.get('name') });
            this.closeModal(); this.showToast('Unidad creada');
            cache.unidades = await api.get('unidades'); this.renderUnidades();
        } catch(err) {
            this.showToast('Error: ' + err.message, 'error');
        }
    },

    openEditUnidadModal(id) {
        const u = cache.unidades.find(x => x.id == id); if (!u) return;
        this.showModal(`<div class="p-6">
            <div class="flex justify-between items-center mb-6"><h3 class="text-xl font-bold text-slate-800">Editar Unidad</h3><button onclick="app.closeModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button></div>
            <form onsubmit="app.updateUnidad(event,${u.id})" class="space-y-5">
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Nombre de la Unidad *</label>
                     <input type="text" name="name" value="${u.name}" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f6dc1] outline-none"></div>
                <div class="pt-4 flex justify-end gap-3 border-t border-gray-100">
                    <button type="button" onclick="app.closeModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancelar</button>
                    <button type="submit" class="px-6 py-2 text-white rounded-lg font-medium transition shadow-lg" style="background-color:${BRAND_COLOR}">Actualizar</button>
                </div>
            </form></div>`);
    },

    async updateUnidad(e, id) {
        e.preventDefault();
        const f = new FormData(e.target);
        try {
            await api.put('unidades', id, { name: f.get('name') });
            this.closeModal(); this.showToast('Unidad actualizada');
            cache.unidades = await api.get('unidades'); this.renderUnidades();
        } catch(err) {
            this.showToast('Error: ' + err.message, 'error');
        }
    },

    async deleteUnidad(id) {
        if (!confirm('¿Eliminar esta unidad?')) return;
        try {
            await api.del('unidades', id);
            this.showToast('Unidad eliminada');
            cache.unidades = await api.get('unidades'); this.renderUnidades();
        } catch(err) {
            this.showToast('Error: ' + err.message, 'error');
        }
    }
};
app.debouncedFilterClients = app.debounce(app.filterClients, 200);
app.debouncedFilterBudgets = app.debounce(app.filterBudgets, 200);
app.debouncedFilterProducts = app.debounce(app.filterProducts, 200);

document.addEventListener('DOMContentLoaded', async () => {
    // Hide login screen initially (shown via CSS), then check session
    document.getElementById('login-screen').style.display = 'none';
    
    try {
        const res = await fetch('api.php?resource=settings');
        if (res.ok) {
            const srv = await res.json();
            if (srv && srv.company) { APP_SETTINGS = { ...APP_SETTINGS, ...srv }; saveSettings(APP_SETTINGS); }
        }
    } catch(e) {}
    
    const loginLogo = document.getElementById('login-logo');
    if (loginLogo && APP_SETTINGS.company.logoUrl) loginLogo.src = APP_SETTINGS.company.logoUrl;
    
    const sidebarLogo = document.getElementById('sidebar-logo');
    if (sidebarLogo && APP_SETTINGS.company.logoUrl) sidebarLogo.src = APP_SETTINGS.company.logoUrl;
    
    try {
        await app.checkSession();
    } catch(e) {
        console.error('checkSession error:', e);
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('login-user').focus();
    }
});




