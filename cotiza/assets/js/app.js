window.app = window.app || {};
Object.assign(window.app, {

    currentView: 'dashboard',

    // --- Helpers ---
    debounce(fn, wait = 250) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), wait);
        };
    },
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

});
