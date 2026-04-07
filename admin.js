window.Admin = {
    // --- State ---
    state: {
        isInitialized: false,
        cloudStatus: 'Connecting...',
        events: JSON.parse(localStorage.getItem('admin_events') || '[]'),
        stats: {
            scans: 12450,
            active: 0,
            users: 640
        }
    },

    // --- Initialization ---
    async init() {
        if (!document.getElementById('events-list')) return;
        
        // Wait for Cloud to wake up
        let attempts = 0;
        while (!window.Cloud && attempts < 10) {
            attempts++;
            await new Promise(r => setTimeout(r, 500));
        }

        // --- PHASE 1: Immediate Local Render (Instant UI) ---
        this.renderEvents();
        this.updateStats();

        // --- PHASE 2: Background Cloud Bridge (Non-Blocking) ---
        this.refreshData(); // Run in parallel
        
        // --- PHASE 3: Real-time Live Listener (Immediate Registration) ---
        if (window.FirebaseDB && window.db) {
            const { ref, onValue } = window.FirebaseDB;
            onValue(ref(window.db, 'events_v1'), snapshot => {
                const data = snapshot.val();
                if (data) {
                    this.state.events = Object.values(data).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
                    this.renderEvents();
                    this.updateStats();
                    localStorage.setItem('admin_events', JSON.stringify(this.state.events));
                }
            });
        }
        
        try { if (window.lucide) lucide.createIcons(); } catch (e) { console.warn('Lucide failed in Admin:', e); }
    },

    async refreshData() {
        const localData = JSON.parse(localStorage.getItem('admin_events') || '[]');
        try {
            if (window.Cloud) {
                const cloudEvents = await window.Cloud.getEvents();
                // --- THE SAFETY MERGE ---
                // If cloud has data, use it. If not, don't wipe the local memory.
                if (cloudEvents && cloudEvents.length > 0) {
                    this.state.events = cloudEvents;
                    localStorage.setItem('admin_events', JSON.stringify(this.state.events));
                } else {
                    this.state.events = localData;
                }
            } else {
                this.state.events = localData;
            }
        } catch (e) {
            console.error('Admin: Cloud fetch failed', e);
            this.state.events = localData;
        }
        this.renderEvents();
        this.updateStats();
    },

    updateStats() {
        const now = new Date();
        const activeCount = this.state.events.filter(e => {
            const start = new Date(e.start);
            const end = new Date(e.end);
            return now >= start && now <= end;
        }).length;

        const el1 = document.getElementById('active-events');
        const el2 = document.getElementById('total-scans');
        const el3 = document.getElementById('auth-users');
        if (el1) el1.textContent = activeCount;
        if (el2) el2.textContent = this.state.stats.scans.toLocaleString();
        if (el3) el3.textContent = this.state.stats.users.toLocaleString();
    },

    // --- Modal Management ---
    showCreateModal() {
        document.getElementById('create-modal').style.display = 'flex';
    },

    hideCreateModal() {
        document.getElementById('create-modal').style.display = 'none';
        this.clearForm();
    },

    clearForm() {
        document.getElementById('event-name').value = '';
        document.getElementById('event-start').value = '';
        document.getElementById('event-end').value = '';
        document.getElementById('event-numbers').value = '';
    },

    // --- Event CRUD ---
    async createEvent() {
        const name = document.getElementById('event-name').value;
        const start = document.getElementById('event-start').value;
        const end = document.getElementById('event-end').value;
        const rawNumbers = document.getElementById('event-numbers').value;

        if (!name || !start || !end || !rawNumbers) {
            alert('Please fill all fields.');
            return;
        }

        const numbers = rawNumbers.split(',')
            .map(n => n.trim())
            .filter(n => n.length > 5);

        const newEvent = {
            id: 'evt_' + Date.now(),
            name,
            start,
            end,
            numbers,
            createdAt: new Date().toISOString(),
            scanCount: 0
        };

        // --- PHASE 1: LOCK TO LOCAL STORAGE IMMEDIATELY ---
        this.state.events.unshift(newEvent);
        localStorage.setItem('admin_events', JSON.stringify(this.state.events));
        this.renderEvents();

        // --- PHASE 2: ATTEMPT CLOUD SYNC ---
        const btn = document.querySelector('#create-modal .btn-primary');
        if (window.Cloud) {
            try {
                if (btn) {
                    btn.textContent = 'Syncing...';
                    btn.disabled = true;
                }
                await window.Cloud.saveEvent(newEvent);
                console.log('✅ Cloud Sync Successful');
            } catch (e) {
                console.error('Cloud save failed:', e);
                alert('⚠️ CLOUD ERROR: Your Firebase Security Rules might be blocking the save. Please check "Database Rules" in Firebase Console. \n\nEvent is saved LOCALLY only.');
            } finally {
                if (btn) {
                    btn.textContent = 'Create Event';
                    btn.disabled = false;
                }
            }
        }

        this.hideCreateModal();
        await this.refreshData();
    },

    async deleteEvent(id) {
        if (confirm('Delete this event? This will revoke access for all users.')) {
            // Remove from cloud (Hard-Wired)
            if (window.FirebaseDB && window.db) {
                try {
                    const { ref, remove } = window.FirebaseDB;
                    await remove(ref(window.db, 'events_v1/' + id));
                    console.log('✅ Cloud Delete Successful');
                } catch (e) {
                    console.error('Cloud delete failed:', e);
                }
            }
            // Update local memory
            this.state.events = this.state.events.filter(e => e.id !== id);
            localStorage.setItem('admin_events', JSON.stringify(this.state.events));
            
            // Immediate Render (Don't wait for cloud refresh)
            this.renderEvents();
            this.updateStats();
        }
    },

    logout() {
        if (confirm('Log out from Admin Dashboard?')) {
            localStorage.removeItem('bizconnex_user');
            window.location.href = 'index.html';
        }
    },

    // --- UI Rendering ---
    renderEvents() {
        const list = document.getElementById('events-list');
        if (!list) return;

        if (!this.state.events || this.state.events.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: 60px; opacity: 0.3; border: 1px dashed var(--glass-border); border-radius: 20px;">
                    <i data-lucide="calendar" style="width: 48px; height: 48px; margin-bottom: 10px;"></i>
                    <p>No events created yet. Start by clicking "Create New Event".</p>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }

        const now = new Date();
        let htmlContent = '';
        
        for (const e of this.state.events) {
            try {
                const start = new Date(e.start || Date.now());
                const end = new Date(e.end || Date.now());
                
                let statusText = 'Upcoming';
                let statusColor = '#f1c40f'; // Yellow
                
                if (now >= start && now <= end) {
                    statusText = 'Live';
                    statusColor = '#2ecc71'; // Green
                } else if (now > end) {
                    statusText = 'Expired';
                    statusColor = '#e74c3c'; // Red
                }

                htmlContent += `
                    <div class="event-card" style="background: rgba(255,255,255,0.07); border-left: 4px solid ${statusColor}; margin-bottom: 20px; padding: 20px; border-radius: 12px; color: white !important;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                            <div>
                                <span class="status-badge" style="background: ${statusColor}22; color: ${statusColor}; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700;">${statusText}</span>
                                <h3 style="margin-top: 10px; font-size: 20px; color: #ffffff !important; font-family: 'Outfit';">${e.name || 'Untitled Event'}</h3>
                            </div>
                            <button class="btn-secondary" style="padding: 8px; border: none; background: transparent; cursor: pointer;" onclick="Admin.deleteEvent('${e.id}')">
                                <i data-lucide="trash-2" style="width: 18px; color: #ff4d4d;"></i>
                            </button>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; font-size: 13px; color: #e2e8f0;">
                            <div>
                                <p style="color: #94a3b8; font-size: 11px; margin-bottom: 4px; text-transform: uppercase;">Duration</p>
                                <p>${isNaN(start) ? 'TBD' : start.toLocaleDateString()} - ${isNaN(end) ? 'TBD' : end.toLocaleDateString()}</p>
                            </div>
                            <div>
                                <p style="color: #94a3b8; font-size: 11px; margin-bottom: 4px; text-transform: uppercase;">Authorized</p>
                                <p style="color: #60a5fa;"><i data-lucide="users" style="width: 12px; vertical-align: middle;"></i> ${e.numbers ? e.numbers.length : 0} Access</p>
                            </div>
                            <div>
                                <p style="color: #94a3b8; font-size: 11px; margin-bottom: 4px; text-transform: uppercase;">Scans</p>
                                <p style="color: #f87171;"><i data-lucide="zap" style="width: 12px; vertical-align: middle;"></i> ${e.scanCount || 0} Total</p>
                            </div>
                        </div>
                    </div>
                `;
            } catch (cardError) {
                console.error("Renderer: Card skip due to error", cardError, e);
            }
        }
        
        list.innerHTML = htmlContent;
        
        if (window.lucide) {
            setTimeout(() => lucide.createIcons(), 50);
        }
    }
};

// Admin.init() is called explicitly from admin.html — not auto-run here.
