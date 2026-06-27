
// ============================================
// CONFIGURACIÓN (LocalStorage)
// ============================================
const DEFAULT_SETTINGS = {
    company: {
        name: "Comercializadora Suncatcher",
        legalName: "del Norte",
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
