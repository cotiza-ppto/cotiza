// ==================== DASHBOARD ====================
window.app = window.app || {};
Object.assign(window.app, {

    _salesChart: null,
    _statusChart: null,

    async renderDashboard() {
        // Destroy old charts if they exist
        if (this._salesChart)  { this._salesChart.destroy();  this._salesChart  = null; }
        if (this._statusChart) { this._statusChart.destroy(); this._statusChart = null; }

        // Compute stats from cache
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear  = now.getFullYear();

        const totalSales = cache.budgets.reduce((a, b) => a + parseFloat(b.total || 0), 0);
        const thisMonthBudgets = cache.budgets.filter(b => {
            if (!b.date) return false;
            const d = new Date(b.date);
            if (isNaN(d.getTime())) return false;
            return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        });
        const thisMonthTotal = thisMonthBudgets.reduce((a, b) => a + parseFloat(b.total || 0), 0);

        // Build monthly data for chart (last 6 months)
        const monthLabels = [];
        const monthTotals = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(thisYear, thisMonth - i, 1);
            const mo = d.getMonth();
            const yr = d.getFullYear();
            const label = d.toLocaleString('es-MX', { month: 'short', year: '2-digit' });
            monthLabels.push(label);
            const sum = cache.budgets
                .filter(b => {
                    if (!b.date) return false;
                    const bd = new Date(b.date);
                    if (isNaN(bd.getTime())) return false;
                    return bd.getMonth() === mo && bd.getFullYear() === yr;
                })
                .reduce((a, b) => a + parseFloat(b.total || 0), 0);
            monthTotals.push(sum);
        }

        // Status counts
        const statusCounts = cache.budgets.reduce((acc, b) => {
            const s = b.status || 'Pendiente';
            acc[s] = (acc[s] || 0) + 1;
            return acc;
        }, {});

        document.getElementById('content-area').innerHTML = `
            <!-- KPI Cards -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6 fade-in">
                <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div class="p-3 rounded-xl text-white flex-shrink-0" style="background-color:${BRAND_COLOR}">
                        <i class="fas fa-chart-line text-xl"></i>
                    </div>
                    <div>
                        <p class="text-xs text-gray-400 font-medium uppercase tracking-wide">Total Histórico</p>
                        <p class="text-xl font-bold text-slate-800 mt-0.5">${this.formatCurrency(totalSales)}</p>
                    </div>
                </div>
                <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div class="p-3 rounded-xl bg-emerald-50 text-emerald-600 flex-shrink-0">
                        <i class="fas fa-calendar-check text-xl"></i>
                    </div>
                    <div>
                        <p class="text-xs text-gray-400 font-medium uppercase tracking-wide">Este Mes</p>
                        <p class="text-xl font-bold text-slate-800 mt-0.5">${this.formatCurrency(thisMonthTotal)}</p>
                    </div>
                </div>
                <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div class="p-3 rounded-xl bg-amber-50 text-amber-500 flex-shrink-0">
                        <i class="fas fa-users text-xl"></i>
                    </div>
                    <div>
                        <p class="text-xs text-gray-400 font-medium uppercase tracking-wide">Clientes</p>
                        <p class="text-xl font-bold text-slate-800 mt-0.5">${cache.clients.length}</p>
                    </div>
                </div>
                <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div class="p-3 rounded-xl bg-purple-50 text-purple-600 flex-shrink-0">
                        <i class="fas fa-file-invoice text-xl"></i>
                    </div>
                    <div>
                        <p class="text-xs text-gray-400 font-medium uppercase tracking-wide">Presupuestos</p>
                        <p class="text-xl font-bold text-slate-800 mt-0.5">${cache.budgets.length}</p>
                    </div>
                </div>
            </div>

            <!-- Charts Row -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6 fade-in">
                <!-- Sales Chart -->
                <div class="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 class="font-bold text-slate-800 mb-4">Ventas Últimos 6 Meses</h3>
                    <canvas id="salesChart" height="110"></canvas>
                </div>
                <!-- Status Donut -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
                    <h3 class="font-bold text-slate-800 mb-4">Estado de Presupuestos</h3>
                    <div class="flex-1 flex items-center justify-center">
                        <canvas id="statusChart" style="max-height:180px"></canvas>
                    </div>
                    <div id="status-legend" class="mt-3 space-y-1 text-xs text-gray-600"></div>
                </div>
            </div>

            <!-- Quick Actions + Recent Budgets -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-5 fade-in">
                <!-- Quick Actions -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 class="font-bold text-lg mb-4 text-slate-800">Acciones Rápidas</h3>
                    <div class="space-y-3">
                        <button onclick="app.openClientModal()" class="w-full py-3 px-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-[#0f6dc1] hover:bg-blue-50 transition group flex items-center gap-3">
                            <i class="fas fa-plus-circle text-gray-400 group-hover:text-[#0f6dc1]"></i>
                            <span class="font-medium text-gray-600 group-hover:text-[#0f6dc1]">Nuevo Cliente</span>
                        </button>
                        <button onclick="app.openProductModal()" class="w-full py-3 px-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition group flex items-center gap-3">
                            <i class="fas fa-box text-gray-400 group-hover:text-green-500"></i>
                            <span class="font-medium text-gray-600 group-hover:text-green-600">Nuevo Producto</span>
                        </button>
                        <button onclick="app.openBudgetModal()" class="w-full py-3 px-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-yellow-500 hover:bg-yellow-50 transition group flex items-center gap-3">
                            <i class="fas fa-calculator text-gray-400 group-hover:text-yellow-500"></i>
                            <span class="font-medium text-gray-600 group-hover:text-yellow-600">Crear Presupuesto</span>
                        </button>
                    </div>
                </div>

                <!-- Recent Budgets -->
                <div class="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-bold text-lg text-slate-800">Últimos Presupuestos</h3>
                        <button onclick="app.navigate('budgets')" class="text-xs font-semibold hover:underline" style="color:${BRAND_COLOR}">Ver todos →</button>
                    </div>
                    <table class="w-full text-left text-sm">
                        <thead>
                            <tr class="text-gray-400 text-xs uppercase">
                                <th class="pb-3 font-semibold">Folio</th>
                                <th class="pb-3 font-semibold">Cliente</th>
                                <th class="pb-3 font-semibold">Fecha</th>
                                <th class="pb-3 font-semibold text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cache.budgets.slice(0,6).map(b => `
                            <tr class="border-t border-gray-50 hover:bg-gray-50 cursor-pointer transition" onclick="app.viewBudget(${b.id})">
                                <td class="py-2.5 font-mono font-semibold text-xs" style="color:${BRAND_COLOR}">${b.codigo}</td>
                                <td class="py-2.5 text-slate-700 truncate max-w-[150px]">${b.clientName}</td>
                                <td class="py-2.5 text-slate-400">${b.date}</td>
                                <td class="py-2.5 font-bold text-right">${this.formatCurrency(b.total)}</td>
                            </tr>`).join('') || '<tr><td colspan="4" class="py-6 text-center text-gray-400">No hay presupuestos</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>`;

        // Render Chart.js charts after DOM is ready
        setTimeout(() => {
            // Sales bar chart
            const salesCtx = document.getElementById('salesChart');
            if (salesCtx && typeof Chart !== 'undefined') {
                this._salesChart = new Chart(salesCtx, {
                    type: 'bar',
                    data: {
                        labels: monthLabels,
                        datasets: [{
                            label: 'Ventas ($)',
                            data: monthTotals,
                            backgroundColor: BRAND_COLOR + 'CC',
                            borderColor: BRAND_COLOR,
                            borderWidth: 2,
                            borderRadius: 8,
                            borderSkipped: false
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v) },
                                grid: { color: '#f1f5f9' }
                            },
                            x: { grid: { display: false } }
                        }
                    }
                });
            }

            // Status donut chart
            const statusCtx = document.getElementById('statusChart');
            const statusColors = { 'Pendiente': '#f59e0b', 'Aprobado': '#10b981', 'Rechazado': '#ef4444', 'Enviado': BRAND_COLOR, 'Borrador': '#94a3b8' };
            const statusLabels = Object.keys(statusCounts);
            const statusData   = statusLabels.map(s => statusCounts[s]);
            const statusBgColors = statusLabels.map(s => statusColors[s] || '#94a3b8');

            if (statusCtx && typeof Chart !== 'undefined' && statusLabels.length > 0) {
                this._statusChart = new Chart(statusCtx, {
                    type: 'doughnut',
                    data: {
                        labels: statusLabels,
                        datasets: [{ data: statusData, backgroundColor: statusBgColors, borderWidth: 2, borderColor: '#fff' }]
                    },
                    options: {
                        responsive: true,
                        cutout: '65%',
                        plugins: { legend: { display: false } }
                    }
                });

                // Custom legend
                const legend = document.getElementById('status-legend');
                if (legend) {
                    legend.innerHTML = statusLabels.map((s, i) =>
                        `<div class="flex items-center justify-between">
                            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full inline-block" style="background:${statusBgColors[i]}"></span>${s}</span>
                            <span class="font-semibold">${statusData[i]}</span>
                         </div>`
                    ).join('');
                }
            } else if (statusCtx) {
                statusCtx.parentElement.innerHTML = '<p class="text-center text-gray-400 text-sm mt-8">Sin datos aún</p>';
            }
        }, 50);
    },

});
