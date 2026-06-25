window.app = window.app || {};
Object.assign(window.app, {
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
                        <h3 class="font-bold text-lg text-slate-800">Lista de Clientes <span class="text-sm font-normal text-gray-400" id="clients-count">(${cache.clients.length})</span></h3>
                        <button onclick="app.openClientModal()" class="text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-md flex-shrink-0 hover:opacity-90" style="background-color:${BRAND_COLOR}"><i class="fas fa-plus mr-2"></i>Agregar Cliente</button>
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
                    ${f('zip','Código Postal','text',c.zip||'',true,'pattern="[0-9]{5}"')}
                    ${f('province','Estado / Provincia','text',c.province||'',false)}
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
            const item = await api.get('clients', id);
            cache.clients.push(item); this.renderClients();
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

    async deleteClient(id) {
        if (!confirm('¿Eliminar este cliente?')) return;
        try {
            await api.del('clients', id); this.showToast('Cliente eliminado');
            cache.clients = cache.clients.filter(c => c.id != id); this.renderClients();
        } catch(err) { this.showToast('Error: ' + err.message, 'error'); }
    }
});
app.debouncedFilterClients = app.debounce(app.filterClients, 200);
