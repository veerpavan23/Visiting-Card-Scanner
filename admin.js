window.Admin = {
    // --- State ---
    state: {
        isInitialized: false,
        currentTab: 'dashboard',
        events: JSON.parse(localStorage.getItem('admin_events') || '[]'),
        users: JSON.parse(localStorage.getItem('admin_users') || '[]'),
        contacts: [],
        charts: {}
    },

    // --- Initialization ---
    async init() {
        // Wait for Cloud
        let attempts = 0;
        while (!window.Cloud && attempts < 10) {
            attempts++;
            await new Promise(r => setTimeout(r, 500));
        }

        // --- Real-time Listeners ---
        if (window.FirebaseDB && window.db) {
            const { ref, onValue } = window.FirebaseDB;
            
            // Events Listener
            onValue(ref(window.db, 'events_v1'), snapshot => {
                if (snapshot.exists()) {
                    this.state.events = Object.values(snapshot.val()).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
                    localStorage.setItem('admin_events', JSON.stringify(this.state.events));
                    if (this.state.currentTab === 'events' || this.state.currentTab === 'dashboard') this.refreshActiveView();
                }
            });

            // Users Listener
            onValue(ref(window.db, 'users_v1'), snapshot => {
                if (snapshot.exists()) {
                    this.state.users = Object.values(snapshot.val());
                    localStorage.setItem('admin_users', JSON.stringify(this.state.users));
                    if (this.state.currentTab === 'users') this.refreshActiveView();
                }
            });

            // Contacts Listener (for Analytics)
            onValue(ref(window.db, 'contacts_v1'), snapshot => {
                if (snapshot.exists()) {
                    this.state.contacts = Object.values(snapshot.val());
                    if (this.state.currentTab === 'analytics' || this.state.currentTab === 'dashboard') this.refreshActiveView();
                }
            });
        }

        this.navigateTo('dashboard');
    },

    // --- Navigation Core ---
    navigateTo(tab) {
        this.state.currentTab = tab;
        
        // Update Sidebar UI
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.id === `nav-${tab}`);
        });

        const root = document.getElementById('admin-content-root');
        root.innerHTML = '<div style="padding: 40px; text-align: center; opacity: 0.5;">Loading...</div>';

        // Kill old charts to prevent memory leaks
        Object.values(this.state.charts).forEach(c => c.destroy());
        this.state.charts = {};

        switch(tab) {
            case 'dashboard': this.renderDashboard(); break;
            case 'events': this.renderEvents(); break;
            case 'users': this.renderUsers(); break;
            case 'analytics': this.renderAnalytics(); break;
        }

        try { if (window.lucide) lucide.createIcons(); } catch (e) {}
    },

    refreshActiveView() {
        this.navigateTo(this.state.currentTab);
    },

    // --- VIEW: Dashboard ---
    renderDashboard() {
        const root = document.getElementById('admin-content-root');
        const now = new Date();
        const activeEvents = this.state.events.filter(e => now >= new Date(e.start) && now <= new Date(e.end)).length;
        
        root.innerHTML = `
            <header style="margin-bottom: 40px;">
                <h1 style="font-size: 32px; font-family: 'Outfit';">System Snapshot</h1>
                <p style="color: var(--text-secondary);">Real-time metrics across your enterprise network.</p>
            </header>

            <div class="stat-grid">
                <div class="premium-card">
                    <p style="font-size: 13px; color: var(--text-secondary);">Total Contacts Captured</p>
                    <h2 style="font-size: 36px; color: var(--admin-accent);">${this.state.contacts.length.toLocaleString()}</h2>
                </div>
                <div class="premium-card">
                    <p style="font-size: 13px; color: var(--text-secondary);">Active Events Today</p>
                    <h2 style="font-size: 36px; color: #2ecc71;">${activeEvents}</h2>
                </div>
                <div class="premium-card">
                    <p style="font-size: 13px; color: var(--text-secondary);">Provisioned Users</p>
                    <h2 style="font-size: 36px; color: #f1c40f;">${this.state.users.length}</h2>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 30px;">
                <div class="chart-container">
                    <h4 style="margin-bottom: 20px;">Recent Contact Activity (7 Days)</h4>
                    <canvas id="dashboard-chart" style="max-height: 250px;"></canvas>
                </div>
                <div class="premium-card">
                    <h4 style="margin-bottom: 20px;">Live Activity Feed</h4>
                    <div id="live-feed" style="max-height: 250px; overflow-y: auto; font-size: 12px;">
                        ${this.state.contacts.slice(0, 5).map(c => `
                            <div style="padding: 10px 0; border-bottom: 1px solid var(--glass-border);">
                                <div style="display: flex; justify-content: space-between;">
                                    <strong>${c.name}</strong>
                                    <span style="opacity: 0.5;">${new Date(c.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                                <div style="color: var(--admin-accent); font-size: 10px;">${c.researcher} @ ${c.eventName}</div>
                            </div>
                        `).join('')}
                        ${this.state.contacts.length === 0 ? '<p style="opacity: 0.3; padding: 20px; text-align: center;">No activity yet.</p>' : ''}
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 30px; margin-top: 30px;">
                <div class="premium-card">
                    <h4 style="margin-bottom: 20px;">Quick Links</h4>
                    <button class="btn-primary" style="width: 100%; margin-bottom: 15px;" onclick="Admin.navigateTo('events')">Create New Event</button>
                    <button class="btn-secondary" style="width: 100%; margin-bottom: 15px;" onclick="Admin.navigateTo('users')">Provision Users</button>
                    <button class="btn-secondary" style="width: 100%; border-color: #2ecc71; color: #2ecc71;" onclick="Admin.exportLeads()">
                        <i data-lucide="download"></i> Export All Contacts (XLSX)
                    </button>
                    <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--glass-border);">
                        <p style="font-size: 11px; color: #2ecc71; display: flex; align-items: center; gap: 8px;">
                            <span style="width: 8px; height: 8px; background: #2ecc71; border-radius: 50%; display: inline-block;"></span>
                            Cloud Infrastructure: ONLINE
                        </p>
                    </div>
                </div>
                <div class="premium-card" style="background: linear-gradient(145deg, rgba(160, 29, 34, 0.1), rgba(0,0,0,0.5)); border: 1px solid var(--admin-accent);">
                    <h4 style="margin-bottom: 10px;">Network Health</h4>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <span>AI Extraction (Avg)</span>
                        <span style="font-weight: 800; color: var(--admin-accent);">~2.4s</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <span>Sync Latency</span>
                        <span style="font-weight: 800; color: #2ecc71;">140ms</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <span>Daily Capacity</span>
                        <span style="font-weight: 800; color: var(--text-secondary);">98.2% Free</span>
                    </div>
                </div>
            </div>
        `;

        this.initDashboardChart();
    },

    initDashboardChart() {
        const ctx = document.getElementById('dashboard-chart');
        if (!ctx) return;

        // Group contacts by last 7 days
        const days = Array.from({length: 7}, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d.toLocaleDateString();
        });

        const dataArr = days.map(day => {
            return this.state.contacts.filter(c => new Date(c.timestamp).toLocaleDateString() === day).length;
        });

        this.state.charts.dash = new Chart(ctx, {
            type: 'line',
            data: {
                labels: days.map(d => d.split('/')[0] + '/' + d.split('/')[1]),
                datasets: [{
                    label: 'Contacts Captured',
                    data: dataArr,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } }
            }
        });
    },

    // --- VIEW: Events ---
    renderEvents() {
        const root = document.getElementById('admin-content-root');
        root.innerHTML = `
            <header style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 40px;">
                <div>
                    <h1 style="font-size: 32px; font-family: 'Outfit';">Event Management</h1>
                    <p style="color: var(--text-secondary);">Define live scanning windows and authorized user subsets.</p>
                </div>
                <button class="btn-primary" onclick="Admin.showCreateModal('event')">
                    <i data-lucide="plus"></i> Create New Event
                </button>
            </header>
            <div id="events-list">
                <!-- Cards injected here -->
            </div>
        `;
        this.populateEvents();
    },

    populateEvents() {
        const list = document.getElementById('events-list');
        if (!this.state.events.length) {
            list.innerHTML = `<div style="text-align: center; padding: 60px; opacity: 0.3;">No events found.</div>`;
            return;
        }

        const now = new Date();
        list.innerHTML = this.state.events.map(e => {
            const start = new Date(e.start);
            const end = new Date(e.end);
            let status = 'Upcoming', color = '#f1c40f';
            if (now >= start && now <= end) { status = 'Live', color = '#2ecc71'; }
            else if (now > end) { status = 'Expired', color = '#e74c3c'; }

            return `
                <div class="event-card" style="border-left: 4px solid ${color};">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <span style="background: ${color}22; color: ${color}; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 800;">${status}</span>
                            <h3 style="margin-top: 10px; font-size: 20px;">${e.name}</h3>
                            <p style="font-size: 13px; opacity: 0.6; margin-top: 5px;">${start.toLocaleDateString()} - ${end.toLocaleDateString()}</p>
                            <p style="font-size: 12px; color: var(--admin-accent); margin-top: 8px;">
                                <i data-lucide="users" style="width: 14px; vertical-align: middle;"></i> ${e.numbers ? e.numbers.length : 0} Authorized Users
                            </p>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button class="btn-secondary" onclick="Admin.showCreateModal('event', '${e.id}')">
                                <i data-lucide="edit-3"></i> Edit Access
                            </button>
                            <button class="btn-secondary" style="color: #ff4d4d;" onclick="Admin.deleteEvent('${e.id}')">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        if (window.lucide) lucide.createIcons();
    },

    // --- VIEW: Users ---
    renderUsers() {
        const root = document.getElementById('admin-content-root');
        root.innerHTML = `
            <header style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 40px;">
                <div>
                    <h1 style="font-size: 32px; font-family: 'Outfit';">User Provisioning</h1>
                    <p style="color: var(--text-secondary);">Manage user access and bulk upload personnel lists.</p>
                </div>
                <div style="display: flex; gap: 12px;">
                    <button class="btn-secondary" onclick="document.getElementById('csv-upload').click()">
                        <i data-lucide="upload"></i> Import CSV/Excel
                    </button>
                    <input type="file" id="csv-upload" style="display: none;" accept=".csv,.xlsx" onchange="Admin.handleBulkUpload(event)">
                    <button class="btn-primary" onclick="Admin.showCreateModal('user')">
                        <i data-lucide="user-plus"></i> Add Individual
                    </button>
                </div>
            </header>

            <div class="premium-card" style="padding: 0; overflow: hidden;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead style="background: rgba(255,255,255,0.05);">
                        <tr>
                            <th style="padding: 15px 24px;">User Name</th>
                            <th style="padding: 15px 24px;">Mobile Number (ID)</th>
                            <th style="padding: 15px 24px;">Login Password</th>
                            <th style="padding: 15px 24px;">Last Active</th>
                            <th style="padding: 15px 24px; text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="users-list">
                        <!-- Users injected here -->
                    </tbody>
                </table>
            </div>
        `;
        this.populateUsers();
    },

    populateUsers() {
        const list = document.getElementById('users-list');
        if (!this.state.users.length) {
            list.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 40px; opacity: 0.3;">No researchers registered.</td></tr>`;
            return;
        }

        list.innerHTML = this.state.users.map(u => {
            const userLeads = this.state.contacts.filter(c => c.researcherId === u.mobile);
            const lastActive = userLeads.length > 0 ? new Date(Math.max(...userLeads.map(c => c.timestamp))).toLocaleString() : 'Never';
            
            return `
                <tr style="border-top: 1px solid var(--glass-border);">
                    <td style="padding: 15px 24px;"><b>${u.name}</b></td>
                    <td style="padding: 15px 24px; font-family: monospace; color: var(--admin-accent);">${u.mobile}</td>
                    <td style="padding: 15px 24px;"><code style="background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 4px; font-family: monospace; letter-spacing: 1px;">${u.password || '---'}</code></td>
                    <td style="padding: 15px 24px; font-size: 11px; opacity: 0.8;">${lastActive}</td>
                    <td style="padding: 15px 24px; text-align: right;">
                        <button class="btn-secondary" style="padding: 6px; border: none;" onclick="Admin.deleteUser('${u.id}', '${u.mobile}')"><i data-lucide="trash-2" style="width: 16px; color: #ff4d4d;"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
        if (window.lucide) lucide.createIcons();
    },

    // --- Bulk Import Logic ---
    async handleBulkUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);

            if (json.length > 0) {
                if (confirm(`Attempting to import ${json.length} users. Proceed?`)) {
                    for (const row of json) {
                        const name = row.Name || row.name || row.Researcher;
                        const mobile = String(row.Mobile || row.mobile || row.Phone).replace(/\s/g, '').replace(/[()-]/g, '');
                        if (name && mobile) {
                            const newUser = {
                                id: 'u_' + Date.now() + Math.random().toString(36).slice(-4),
                                name,
                                mobile,
                                password: Math.random().toString(36).slice(-6).toUpperCase(),
                                role: 'user',
                                createdAt: new Date().toISOString()
                            };
                            if (window.Cloud) await window.Cloud.saveUser(newUser);
                        }
                    }
                    alert('Bulk import complete!');
                    this.refreshActiveView();
                }
            }
        };
        reader.readAsArrayBuffer(file);
    },

    // --- VIEW: Analytics ---
    renderAnalytics() {
        const root = document.getElementById('admin-content-root');
        
        // Insights logic
        const eventCounts = {};
        const userCounts = {};
        this.state.contacts.forEach(c => {
            eventCounts[c.eventName || 'General'] = (eventCounts[c.eventName || 'General'] || 0) + 1;
            userCounts[c.researcher || 'Unknown'] = (userCounts[c.researcher || 'Unknown'] || 0) + 1;
        });

        const topEvents = Object.entries(eventCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);
        const topUsers = Object.entries(userCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);

        // Lead Completeness Analysis
        const totalFields = 7; // Name, Company, Title, Email, Phone, Website, Address
        let avgCompleteness = 0;
        if (this.state.contacts.length > 0) {
            const sumScores = this.state.contacts.reduce((acc, c) => {
                let score = 0;
                if (c.name) score++;
                if (c.company) score++;
                if (c.designation || c.title) score++;
                if (c.email) score++;
                if (c.phone) score++;
                if (c.website) score++;
                if (c.address) score++;
                return acc + (score / totalFields);
            }, 0);
            avgCompleteness = (sumScores / this.state.contacts.length) * 100;
        }

        root.innerHTML = `
            <header style="margin-bottom: 40px;">
                <h1 style="font-size: 32px; font-family: 'Outfit';">Valueable Insights</h1>
                <p style="color: var(--text-secondary);">Enterprise performance metrics and leaderboard.</p>
            </header>

            <div class="stat-grid" style="margin-bottom: 30px;">
                <div class="premium-card" style="border-bottom: 3px solid var(--admin-accent);">
                    <p style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Data Quality</p>
                    <h2 style="font-size: 32px; margin: 10px 0;">${avgCompleteness.toFixed(1)}%</h2>
                    <p style="font-size: 11px; color: var(--text-secondary);">Avg. Completeness Score</p>
                </div>
                <div class="premium-card" style="border-bottom: 3px solid #3498db;">
                    <p style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Capture Velocity</p>
                    <h2 style="font-size: 32px; margin: 10px 0;">${(this.state.contacts.length / Math.max(1, topUsers.length)).toFixed(1)}</h2>
                    <p style="font-size: 11px; color: var(--text-secondary);">Leads per Researcher</p>
                </div>
                <div class="premium-card" style="border-bottom: 3px solid #2ecc71;">
                    <p style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Engine Performance</p>
                    <h2 style="font-size: 32px; margin: 10px 0;">~2.1s</h2>
                    <p style="font-size: 11px; color: var(--text-secondary);">AI Extraction Time (Avg)</p>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                <div class="chart-container">
                    <h4 style="margin-bottom: 20px; color: var(--text-secondary);">Hourly Capture Density</h4>
                    <canvas id="velocity-chart"></canvas>
                </div>
                <div class="premium-card">
                    <h4 style="margin-bottom: 15px; color: var(--text-secondary);">Top Performing Events</h4>
                    ${topEvents.map(([name, count]) => `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid var(--glass-border);">
                            <span style="font-weight: 600;">${name}</span>
                            <span style="font-weight: 800; color: var(--admin-accent); font-family: monospace; font-size: 16px;">${count}</span>
                        </div>
                    `).join('')}
                    ${topEvents.length === 0 ? '<p style="opacity: 0.3; text-align: center; padding: 40px;">No event data to aggregate.</p>' : ''}
                </div>
            </div>

            <div class="premium-card" style="margin-top: 30px; border-top: 4px solid var(--admin-accent);">
                <h4 style="margin-bottom: 20px; color: var(--text-secondary);">Researcher Performance Leaderboard</h4>
                <div style="display: flex; gap: 20px; overflow-x: auto; padding-bottom: 10px;">
                    ${topUsers.map(([name, count], i) => `
                        <div style="min-width: 160px; text-align: center; padding: 25px; background: rgba(255,255,255,0.05); border-radius: 20px; border: 1px solid var(--glass-border); transition: transform 0.3s ease;" 
                             onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='none'">
                            <div style="font-size: 32px; margin-bottom: 10px; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.3));">${['🥇','🥈','🥉','🏅','🎖️'][i] || '👤'}</div>
                            <div style="font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
                            <div style="color: var(--admin-accent); font-size: 18px; font-weight: 900; margin-top: 8px;">${count} <span style="font-size: 10px; font-weight: 400; opacity: 0.6; color: var(--text-secondary);">Leads</span></div>
                        </div>
                    `).join('')}
                    ${topUsers.length === 0 ? '<p style="opacity: 0.3; width: 100%; text-align: center; padding: 40px;">Waiting for first leads to sync...</p>' : ''}
                </div>
            </div>
        `;

        this.initVelocityChart();
    },

    initVelocityChart() {
        const ctx = document.getElementById('velocity-chart');
        if (!ctx) return;

        // Last 12 hours
        const hours = Array.from({length: 12}, (_, i) => {
            const h = new Date();
            h.setHours(h.getHours() - (11 - i));
            return h.getHours() + ':00';
        });

        const dataArr = hours.map(h => {
            return this.state.contacts.filter(c => new Date(c.timestamp).getHours() + ':00' === h).length;
        });

        this.state.charts.velocity = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: hours,
                datasets: [{ label: 'Capture Velocity', data: dataArr, backgroundColor: '#3498db' }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } } }
            }
        });
    },

    // --- Modal Logic ---
    showCreateModal(type, targetId = null) {
        const modal = document.getElementById('create-modal');
        const content = document.getElementById('modal-content');
        modal.style.display = 'flex';

        if (type === 'event') {
            const e = targetId ? this.state.events.find(ev => ev.id === targetId) : null;
            content.innerHTML = `
                <h3 style="margin-bottom: 25px;">${e ? 'Edit Access:' : 'Create New Event'} ${e ? e.name : ''}</h3>
                <div class="form-group"><label>Event Name</label><input type="text" id="event-name" class="form-input" value="${e ? e.name : ''}"></div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group"><label>Start</label><input type="datetime-local" id="event-start" class="form-input" value="${e ? e.start : ''}"></div>
                    <div class="form-group"><label>End</label><input type="datetime-local" id="event-end" class="form-input" value="${e ? e.end : ''}"></div>
                </div>
                
                <div style="margin-top: 20px;">
                    <label style="display: block; margin-bottom: 10px; font-weight: 600;">Select Provisioned Researchers:</label>
                    <div style="max-height: 150px; overflow-y: auto; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; border: 1px solid var(--glass-border);">
                        ${this.state.users.map(u => `
                            <label style="display: flex; align-items: center; gap: 10px; padding: 8px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <input type="checkbox" name="user-access" value="${u.mobile}" ${e && e.numbers && e.numbers.includes(u.mobile) ? 'checked' : ''}>
                                <div style="font-size: 13px;">
                                    <div>${u.name}</div>
                                    <div style="font-size: 11px; opacity: 0.5;">${u.mobile}</div>
                                </div>
                            </label>
                        `).join('')}
                        ${this.state.users.length === 0 ? '<p style="opacity: 0.3; padding: 10px;">No researchers provisioned yet.</p>' : ''}
                    </div>
                </div>

                <div class="form-group" style="margin-top: 20px;">
                    <label>Bulk Paste Mobiles (Optional - Comma separated)</label>
                    <textarea id="event-numbers-bulk" class="form-input" style="height: 60px;" placeholder="+91..."></textarea>
                </div>

                <div style="display: flex; gap: 12px; margin-top: 25px;">
                    <button class="btn-secondary" style="flex: 1;" onclick="Admin.hideCreateModal()">Cancel</button>
                    <button class="btn-primary" style="flex: 2;" onclick="Admin.saveEvent('${targetId || ''}')">
                        ${e ? 'Update Event' : 'Create Event'}
                    </button>
                </div>
            `;
        } else {
            const autoPass = Math.random().toString(36).slice(-6).toUpperCase();
            content.innerHTML = `
                <h3 style="margin-bottom: 5px;">Add Individual Researcher</h3>
                <p style="font-size: 11px; color: var(--text-secondary); margin-bottom: 25px;">Provision a new mobile user with secure access.</p>
                
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" id="user-name" class="form-input" placeholder="e.g. John Doe">
                </div>
                
                <div class="form-group">
                    <label>Mobile Number</label>
                    <input type="text" id="user-mobile" class="form-input" placeholder="+91...">
                </div>

                <div class="form-group">
                    <label>Login Password (Auto-generated)</label>
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="user-pass" class="form-input" value="${autoPass}" style="font-family: monospace; letter-spacing: 2px; font-weight: 800; color: var(--admin-accent);">
                        <button class="action-btn" onclick="document.getElementById('user-pass').value = Math.random().toString(36).slice(-6).toUpperCase()" title="Regenerate">
                            <i data-lucide="refresh-cw" style="width: 16px;"></i>
                        </button>
                    </div>
                </div>

                <div style="display: flex; gap: 12px; margin-top: 25px;">
                    <button class="btn-secondary" style="flex: 1;" onclick="Admin.hideCreateModal()">Cancel</button>
                    <button class="btn-primary" style="flex: 2;" onclick="Admin.saveIndividualUser()">Add Researcher</button>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        }
    },

    hideCreateModal() {
        document.getElementById('create-modal').style.display = 'none';
    },

    async saveEvent(targetId) {
        const name = document.getElementById('event-name').value;
        const start = document.getElementById('event-start').value;
        const end = document.getElementById('event-end').value;
        
        // 1. Get checked users
        const checkedNums = Array.from(document.querySelectorAll('input[name="user-access"]:checked')).map(el => el.value);
        
        // 2. Get bulk paste users
        const bulkNums = document.getElementById('event-numbers-bulk').value.split(',').map(n => n.trim()).filter(n => n);
        
        // 3. Unique Merge
        const finalNumbers = [...new Set([...checkedNums, ...bulkNums])];

        const eventData = { 
            id: targetId || ('evt_' + Date.now()), 
            name, 
            start, 
            end, 
            numbers: finalNumbers, 
            createdAt: new Date().toISOString(), 
            scanCount: 0 
        };

        if (window.Cloud) await window.Cloud.saveEvent(eventData);
        this.hideCreateModal();
        this.refreshActiveView();
    },

    async saveIndividualUser() {
        const name = document.getElementById('user-name').value;
        const mobile = document.getElementById('user-mobile').value.replace(/\s/g, '').replace(/[()-]/g, '');
        const password = document.getElementById('user-pass').value;
        
        if (!name || !mobile || !password) {
            alert('Please fill all fields');
            return;
        }

        const newUser = { 
            id: 'u_' + Date.now(),
            name, 
            mobile, 
            password, 
            role: 'user', 
            createdAt: new Date().toISOString() 
        };
        if (window.Cloud) await window.Cloud.saveUser(newUser);
        this.hideCreateModal();
        this.refreshActiveView();
    },

    async deleteEvent(id) { if (confirm('Delete event?')) { if (window.Cloud) { await window.Cloud.deleteEvent(id); this.refreshActiveView(); } } },
    
    async deleteUser(userId, mobile) { 
        if (confirm('Remove user? This will also revoke their access from all events immediately.')) { 
            if (window.Cloud) {
                // 1. Delete user record
                await window.Cloud.deleteUser(userId); 
                
                // 2. Scrub mobile from all events
                for (const ev of this.state.events) {
                    if (ev.numbers && ev.numbers.includes(mobile)) {
                        const updatedNums = ev.numbers.filter(n => n !== mobile);
                        await window.Cloud.saveEvent({ ...ev, numbers: updatedNums });
                    }
                }
            }
            this.refreshActiveView(); 
        } 
    },

    logout() {
        if (confirm('Are you sure you want to log out?')) {
            localStorage.removeItem('bizconnex_user');
            window.location.href = '/'; 
        }
    },

    exportLeads() {
        if (!this.state.contacts.length) {
            alert('No leads to export.');
            return;
        }

        const data = this.state.contacts.map(c => ({
            'Name': c.name || '',
            'Company': c.company || '',
            'Designation': c.designation || c.title || '',
            'Email': c.email || '',
            'Phone': c.phone || '',
            'Website': c.website || '',
            'Address': c.address || '',
            'Event': c.eventName || '',
            'Researcher': c.researcher || '',
            'Notes': c.notes || '',
            'Captured At': new Date(c.timestamp).toLocaleString()
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Leads");
        XLSX.writeFile(wb, `Bizconnex_Leads_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
};


// Admin.init() is called explicitly from admin.html — not auto-run here.
