
window.app = window.app || {};
Object.assign(window.app, {
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
    }
});

