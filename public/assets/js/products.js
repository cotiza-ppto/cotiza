window.app = window.app || {};
Object.assign(window.app, {
renderProducts() {
        const rows = cache.products.map(p => {
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
                        <h3 class="font-bold text-lg text-slate-800">Catálogo de Productos <span class="text-sm font-normal text-gray-400" id="products-count">(${cache.products.length})</span></h3>
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
        const uniOpts = '<option value="">SELECCIONAR</option>' + cache.unidades.map(u => `<option value="${u.id}" ${p.idunidad == u.id ? 'selected' : ''}>${u.name}</option>`).join('');
        return `
            <div class="bg-gray-50 p-4 rounded-lg border border-gray-200"><h4 class="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Identificación</h4>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Código / Referencia *</label>
                         <input type="text" name="code" value="${p.code||''}" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none uppercase"></div>
                    <div class="md:col-span-2"><label class="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
                         <input type="text" name="name" value="${p.name||''}" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"></div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Unidad *</label>
                         <select name="idunidad" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none">${uniOpts}</select></div>
                    <div class="md:col-span-2"><label class="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
                         <select name="codfamilia" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none">${famOptions}</select></div>
                    <div class="md:col-span-2"><label class="block text-sm font-medium text-gray-700 mb-1">IVA *</label>
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
        const p = cache.products.find(x => x.id == id); if (!p) return;
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
        const cost   = parseFloat(f.get('cost'))   || 0;
        const margin = parseFloat(f.get('margin'))  || 0;
        // Siempre recalcular el precio desde costo+margen para evitar
        // que el data-value del div quede desactualizado
        const price  = cost * (1 + margin / 100);
        return {
            code:          f.get('code'),
            name:          f.get('name'),
            idunidad:      parseInt(f.get('idunidad')) || 1,
            codfamilia:    f.get('codfamilia'),
            tax:           parseFloat(f.get('tax')),
            cost:          cost,
            margin:        margin,
            price:         price,
            observaciones: f.get('observaciones')
        };
    },

    async saveProduct(e) {
        e.preventDefault(); const btn = e.target.querySelector('[type="submit"]');
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Guardando...';
        try {
            const { id } = await api.post('products', this.getProductPayload(e));
            this.closeModal(); this.showToast('Producto agregado');
            const item = await api.get('products', id);
            cache.products.push(item); this.renderProducts();
        } catch(err) { this.showToast('Error: ' + err.message, 'error'); btn.disabled = false; btn.innerHTML = 'Guardar Producto'; }
    },

    async updateProduct(e, id) {
        e.preventDefault(); const btn = e.target.querySelector('[type="submit"]');
        const oldCode = (cache.products.find(p => p.id == id) || {}).code;
        const payload = this.getProductPayload(e);
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Guardando...';
        try {
            await api.put('products', id, payload);
            this.closeModal(); this.showToast('Producto actualizado en catálogo y presupuestos');
            const updated = await api.get('products', id);
            const idx = cache.products.findIndex(p => p.id == id);
            if (idx !== -1) cache.products[idx] = updated; else cache.products.push(updated);
            if (oldCode && oldCode !== payload.code) cache.budgets = await api.get('budgets');
            this.renderProducts();
        } catch(err) { this.showToast('Error: ' + err.message, 'error'); btn.disabled = false; btn.innerHTML = 'Actualizar Producto'; }
    },

    async deleteProduct(id) {
        if (!confirm('¿Eliminar este producto del catálogo?')) return;
        try {
            await api.del('products', id); this.showToast('Producto eliminado');
            cache.products = cache.products.filter(p => p.id != id); this.renderProducts();
        } catch(err) { this.showToast('Error: ' + err.message, 'error'); }
    }
});
app.debouncedFilterProducts = app.debounce(app.filterProducts, 200);
