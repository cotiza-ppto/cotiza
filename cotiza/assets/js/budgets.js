window.app = window.app || {};
Object.assign(window.app, {
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
                b.items.forEach(item => { this.addBudgetItemRow(item); });
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
            } else if (_items.length <= CAP_SINGLE) {
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

    async sendEmail(budgetId, email, clientName, codigo, markBudgetSent = true) {
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
                    if (markBudgetSent) await api.put('budgets', budgetId, { status: 'Enviado' });
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
            } else if (_items.length <= CAP_SINGLE) {
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
                          <div class="grid grid-cols-1 gap-8">
                            <div style="border-top:2px dashed #cbd5e1; padding-top:12px;">
                              <p style="font-size:12px; font-weight:700; color:#1e293b; margin-bottom:4px; text-transform: uppercase;">Firma de Conformidad</p>
                              <p style="font-size:10px; color:#64748b;">Nombre y Firma de quien recibe la mercancía</p>
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
            });

            this.showModal(`<div class="bg-white flex flex-col w-full" style="height: 85vh;" id="document-container">
                <div class="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 no-print flex-shrink-0">
                    <h3 class="font-bold text-slate-700">Recibo de Mercancía: ${b.codigo}</h3>
                    <div class="flex gap-2">
                        <button onclick="window.print()" class="px-3 py-1.5 text-white rounded text-sm hover:opacity-90 transition" style="background-color:${doc.color}"><i class="fas fa-print mr-1"></i>Imprimir</button>
                        <button onclick="app.downloadPDF('printable-area', 'Recibo_${b.codigo}')" class="px-3 py-1.5 text-white rounded text-sm hover:opacity-90 transition" style="background-color:${doc.color}"><i class="fas fa-file-pdf mr-1"></i>PDF</button>
                        <button onclick="app.sendEmail(${b.id},'${String(b.clientEmail).replace(/'/g,"\\'")}','${String(b.clientName).replace(/'/g,"\\'")}','Recibo ${String(b.codigo).replace(/'/g,"\\'")}', false)" class="px-3 py-1.5 text-white rounded text-sm hover:opacity-90 transition" style="background-color:${doc.color}"><i class="fas fa-paper-plane mr-1"></i>Enviar Correo</button>
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
    }
});
app.debouncedFilterBudgets = app.debounce(app.filterBudgets, 200);
