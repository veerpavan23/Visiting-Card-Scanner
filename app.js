/**
 * Bizconnex Card Scanner - Enterprise Edition
 * Version: 14.00 (Maroon & Gold Theme)
 * Author: Antigravity AI
 */

const App = {
    // --- State ---
    state: {
        isInitialized: false,
        cloudStatus: 'Connecting...',
        currentScreen: 'splash',
        contacts: JSON.parse(localStorage.getItem('bizconnex_contacts') || '[]'),
        uploadQueue: JSON.parse(localStorage.getItem('bizconnex_queue') || '[]'),
        events: JSON.parse(localStorage.getItem('bizconnex_events') || '[]'),
        users: JSON.parse(localStorage.getItem('bizconnex_users') || '[]'),
        currentUser: JSON.parse(localStorage.getItem('bizconnex_user') || 'null'),
        activeEvent: JSON.parse(localStorage.getItem('bizconnex_active_event') || 'null'),
        isAdmin: false,
        isProcessing: false,
        tempImage: null,
        currentContact: null,
        // Premium default contact
        placeholders: [
            { id: 'p1', name: 'Alaric Chen', company: 'Nexus Ventures', designation: 'Managing Director', phone: '+1 555-0102', email: 'alaric@nexus.vc', website: 'nexus.vc', address: 'Sand Hill Rd, Menlo Park', status: 'Updated', eventName: 'Global Tech Expo', timestamp: Date.now() },
            { id: 'p2', name: 'Elena Rodriguez', company: 'Stellar Dynamics', designation: 'Chief Architect', phone: '+1 555-0199', email: 'elena@stellar.io', website: 'stellar.io', address: 'Innovation Way, Austin', status: 'Updated', eventName: 'Bizconnex Summit', timestamp: Date.now() }
        ]
    },

    config: {
        theme: 'bizconnex-maroon',
        GEMINI_API_KEY: null,
        DEV_MODE_KEY: 'AIzaSyBFcd2uIDs4lsEAQy0DGMt56K3rAmLmC6A', 
        WORKER_URL: null,
        FORCE_DIRECT_MODE: true 
    },

    // --- Initialization ---
    init() {
        console.log('✅ Bizconnex AI Engine Active (v14.07)');
        this.syncCloud(); // Load initial events
        this.checkConnectivity();
        this.injectDebugUI(); 
        this.state.isInitialized = true;
        
        // Auto-set admin status if logged in
        if (this.state.currentUser?.id === 'admin') this.state.isAdmin = true;

        this.bindEvents();
        this.processQueue(); // Start background engine
        try { if (window.lucide) lucide.createIcons(); } catch (e) {}

        if (this.state.currentUser) {
            this.navigateTo('home');
        } else {
            this.navigateTo('login');
        }

        this.syncCloud();
    },

    bindEvents() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const screen = btn.getAttribute('data-screen');
                this.navigateTo(screen);
            });
        });

        // Global key listeners
        window.addEventListener('keydown', (e) => {
            if (e.shiftKey && e.key === 'D') document.getElementById('ai-debug-panel')?.classList.toggle('active');
        });
    },

    // --- Navigation ---
    navigateTo(screenName) {
        if (this.state.currentScreen === screenName && screenName !== 'home') return;
        
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-screen') === screenName);
        });

        this.renderScreen(screenName);
    },

    renderScreen(name) {
        this.state.currentScreen = name;
        const container = document.getElementById('screen-container');
        const nav = document.getElementById('global-nav');

        container.innerHTML = '';

        const showNavScreens = ['home', 'contacts', 'export', 'adminDashboard'];
        nav.classList.toggle('hidden', !showNavScreens.includes(name));

        let html = '';
        try {
            if (this.screens[name]) {
                html = this.screens[name].call(this);
            } else {
                throw new Error("Unknown Screen: " + name);
            }
        } catch (error) {
            console.error("Rendering Crash:", error);
            html = `<div class="screen" style="padding: 40px; text-align: center;"><h2>Error</h2><p>${error.message}</p></div>`;
        }

        container.innerHTML = html;
        if (name === 'crop') {
            console.log('App: Initializing Cropper for screen:', name);
            setTimeout(() => this.initCropper(), 50); // Slight delay for DOM sync
        }
        try { if (window.lucide) lucide.createIcons(); } catch (e) { console.warn('Lucide failed to load icons:', e); }
    },

    // --- Screens ---
    screens: {
        splash() {
            return `
                <div class="screen splash-screen" style="justify-content: center; align-items: center; text-align: center; height: 100%;">
                    <div class="animate__animated animate__zoomIn">
                        <div style="background: var(--primary); width: 80px; height: 80px; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; box-shadow: 0 10px 30px rgba(160, 29, 34, 0.4);">
                            <i data-lucide="globe" style="width: 40px; height: 40px; color: #fff;"></i>
                        </div>
                        <h1 style="font-size: 28px; letter-spacing: -0.5px; font-family: 'Outfit';">Biz<span class="text-accent">connex</span></h1>
                        <p style="color: var(--text-secondary); margin-top: 8px; font-weight: 300;">Global Business Networking</p>
                    </div>
                </div>
            `;
        },

        login() {
            return `
                <div class="screen login-screen" style="padding: 40px 30px; height: 100%; display: flex; flex-direction: column;">
                    <div style="text-align: center; margin-top: 60px; margin-bottom: 40px;">
                        <div style="background: var(--primary); width: 64px; height: 64px; border-radius: 18px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; box-shadow: 0 10px 25px rgba(160, 29, 34, 0.3);">
                            <i data-lucide="user-check" style="width: 32px; height: 32px; color: #fff;"></i>
                        </div>
                        <h2 style="font-size: 26px; font-family: 'Outfit';">Bizconnex Login</h2>
                        <p style="color: var(--text-secondary); margin-bottom: 30px; font-size: 14px;">Enter your credentials to manage your events.</p>
                    </div>

                    <form id="login-form" onsubmit="App.handleLogin(event)" class="premium-card" style="background: transparent; border: none; padding: 0; box-shadow: none;">
                        <div class="premium-card">
                            <div class="form-group">
                                <label>Mobile Number</label>
                                <input type="tel" id="login-mobile" class="form-input" placeholder="e.g. 9876543210" required>
                            </div>
                            <div class="form-group">
                                <label>Password</label>
                                <input type="password" id="login-pass" class="form-input" placeholder="••••••••" required>
                            </div>
                        </div>

                        <button type="submit" class="btn-primary" style="width: 100%; margin-top: 20px;">
                            Sign In <i data-lucide="arrow-right"></i>
                        </button>
                    </form>

                    <div style="text-align: center; margin-top: auto; padding-top: 20px;">
                        <p style="font-size: 11px; color: var(--text-muted); line-height: 1.4;">
                            Contact your Admin for trade show access.
                        </p>
                        <div style="margin-top: 20px; font-size: 9px; opacity: 0.4; letter-spacing: 1px; color: var(--primary);">BIZCONNEX v14.0</div>
                    </div>
                </div>
            `;
        },

        home() {
            const processingCount = this.state.uploadQueue.filter(q => q.status === 'Processing').length;
            const event = this.state.activeEvent;
            const contacts = this.state.contacts.filter(c => !event || c.eventId === event.id);

            return `
                <div class="screen home-screen">
                    <header style="padding: 16px 24px; display: flex; justify-content: space-between; align-items: start; border-bottom: 1px solid var(--glass-border); background: rgba(0,0,0,0.2);">
                        <div>
                            <h1 style="font-size: 24px; font-family: 'Outfit';">Biz<span class="text-accent">connex</span></h1>
                            <p style="color: var(--text-secondary); font-size: 12px; margin-top: 2px;">${this.state.currentUser?.mobile || 'Dashboard'}</p>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            ${this.state.isAdmin ? `<button class="btn-secondary" style="padding: 8px 12px; font-size: 11px;" onclick="App.navigateTo('adminDashboard')"><i data-lucide="settings" style="width: 14px;"></i> Admin</button>` : ''}
                            <button class="logout-btn" style="background: var(--bg-tertiary); padding: 10px; border-radius: 12px; border: 1px solid var(--glass-border); cursor: pointer;" onclick="App.logout(event)">
                                <i data-lucide="log-out" style="width: 18px;"></i>
                            </button>
                        </div>
                    </header>

                    <div class="screen-content" style="padding: 24px;">
                        ${processingCount > 0 ? `
                            <div class="pulse-processing" style="background: var(--warning); color: #000; padding: 10px 18px; border-radius: 12px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div class="loader-spinner" style="width: 14px; height: 14px; border-width: 2px; border-top-color: #000; margin: 0;"></div>
                                    <span style="font-size: 13px; font-weight: 600;">Processing ${processingCount} Cards...</span>
                                </div>
                            </div>
                        ` : ''}

                        <div class="premium-card" style="padding: 15px; margin-bottom: 25px; border-left: 4px solid ${event ? '#2ecc71' : '#f1c40f'};" onclick="App.navigateTo('eventSelect')">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="flex: 1;">
                                    <p style="font-size: 10px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Active Trade Show <i data-lucide="chevron-down" style="width: 10px;"></i></p>
                                    <h3 style="font-size: 16px; margin-top: 2px;">${event ? event.name : 'Quick Scan Mode'}</h3>
                                    <p style="font-size: 10px; opacity: 0.6; margin-top: 2px;">${event ? 'Dubai World Trade Centre' : 'Tap to Switch to a Specific Event'}</p>
                                </div>
                                <div style="text-align: right;">
                                    <p style="font-size: 10px; color: var(--text-muted);">Points</p>
                                    <p style="color: var(--accent); font-weight: 700;">${this.state.contacts.length * 10}</p>
                                </div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 12px; margin-bottom: 25px;">
                            <button class="scanner-btn" style="flex: 1; border-color: ${event ? 'rgba(46, 204, 113, 0.3)' : 'rgba(241, 196, 15, 0.3)'};" onclick="App.startCameraFlow()">
                                <div class="scanner-icon" style="background: rgba(160, 29, 34, 0.1); color: var(--primary);"><i data-lucide="camera"></i></div>
                                <span>Camera</span>
                            </button>
                            <button class="scanner-btn" style="flex: 1;" onclick="document.getElementById('gallery-input').click()">
                                <div class="scanner-icon" style="background: rgba(46, 204, 113, 0.1); color: #2ecc71;"><i data-lucide="image"></i></div>
                                <span>Gallery</span>
                            </button>
                            <input type="file" id="gallery-input" style="display: none;" accept="image/*" onchange="App.handleGalleryUpload(event)">
                        </div>

                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h3 style="font-size: 16px; font-family: 'Outfit';">Recent Leads</h3>
                        </div>

                        <div id="contacts-list">
                            ${this.state.uploadQueue.filter(q => q.status !== 'Updated').map(q => this.renderQueueItem(q)).join('')}
                            ${contacts.slice(0, 10).map(c => this.renderContactItem(c)).join('')}
                        </div>

                        <div style="text-align: center; margin-top: 40px; border-top: 1px solid var(--glass-border); padding-top: 20px; opacity: 0.3;">
                            <button style="background: transparent; border: none; color: #ff4d4d; font-size: 10px; text-decoration: underline;" onclick="App.hardReset()">Wipe Local Data & Reset</button>
                        </div>
                    </div>
                </div>
            `;
        },

        adminDashboard() {
            return `
                <div class="screen admin-screen">
                    <header style="padding: 16px 24px; border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center;">
                        <h2 style="font-size: 22px; font-family: 'Outfit';">Control Panel</h2>
                        <button onclick="App.navigateTo('home')" style="background: none; border: none; color: #fff;"><i data-lucide="x"></i></button>
                    </header>
                    <div class="screen-content">
                        <div class="admin-card" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 20px; text-align: center;">
                            <div><p style="font-size: 20px; font-weight: 800; color: var(--accent);">${this.state.users.length}</p><p style="font-size: 10px;">Users</p></div>
                            <div><p style="font-size: 20px; font-weight: 800; color: var(--success);">${this.state.events.length}</p><p style="font-size: 10px;">Events</p></div>
                            <div><p style="font-size: 20px; font-weight: 800; color: var(--info);">${this.state.contacts.length}</p><p style="font-size: 10px;">Leads</p></div>
                        </div>
                        <div class="premium-card" style="margin-top: 20px;" onclick="App.navigateTo('userManager')">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <div style="background: var(--primary); color: #fff; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center;"><i data-lucide="users"></i></div>
                                <div style="flex: 1;"><h4>User Management</h4><p style="font-size: 11px; opacity: 0.6;">Create and assign mobile users</p></div>
                                <i data-lucide="chevron-right"></i>
                            </div>
                        </div>
                        <div class="premium-card" style="margin-top: 15px;" onclick="App.navigateTo('eventManager')">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <div style="background: var(--accent); color: #fff; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center;"><i data-lucide="calendar"></i></div>
                                <div style="flex: 1;"><h4>Event Management</h4><p style="font-size: 11px; opacity: 0.6;">Define trade shows and meeting windows</p></div>
                                <i data-lucide="chevron-right"></i>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        userManager() {
            return `
                <div class="screen-manager">
                    <header style="padding: 16px 24px; border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <button onclick="App.navigateTo('adminDashboard')" style="background: none; border: none; color: #fff;"><i data-lucide="arrow-left"></i></button>
                            <h2 style="font-size: 18px;">Users</h2>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn-secondary" style="padding: 6px 12px; font-size: 11px;" onclick="App.showImportModal()">Import</button>
                            <button class="btn-primary" style="padding: 6px 12px; font-size: 11px;" onclick="App.showUserModal()">+ New</button>
                        </div>
                    </header>
                    <div class="screen-content">
                        ${this.state.users.length === 0 ? '<p style="text-align: center; padding: 40px; opacity: 0.5;">No users created.</p>' : this.state.users.map(u => `
                            <div class="premium-card" style="padding: 12px 15px; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <h4 style="font-size: 14px;">${u.mobile}</h4>
                                    <p style="font-size: 10px; opacity: 0.5; font-family: monospace;">PW: ${u.password}</p>
                                </div>
                                <div class="action-btn-group">
                                    <button class="action-btn" onclick="App.showUserModal(${JSON.stringify(u).replace(/"/g, '&quot;')})"><i data-lucide="edit-2" style="width:14px;"></i></button>
                                    <button class="action-btn danger" onclick="App.deleteUser('${u.id}')"><i data-lucide="trash-2" style="width:14px;"></i></button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        },

        eventManager() {
            return `
                <div class="screen-manager">
                    <header style="padding: 16px 24px; border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <button onclick="App.navigateTo('adminDashboard')" style="background: none; border: none; color: #fff;"><i data-lucide="arrow-left"></i></button>
                            <h2 style="font-size: 18px;">Events</h2>
                        </div>
                        <button class="btn-primary" style="padding: 6px 12px; font-size: 11px;" onclick="App.showEventModal()">+ New Trade Show</button>
                    </header>
                    <div class="screen-content">
                        ${this.state.events.length === 0 ? '<p style="text-align: center; padding: 40px; opacity: 0.5;">No events created.</p>' : this.state.events.map(e => `
                            <div class="premium-card" style="padding: 12px 15px; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <h4 style="font-size: 14px;">${e.name}</h4>
                                    <p style="font-size: 10px; opacity: 0.5;">${new Date(e.start).toLocaleDateString()} - ${new Date(e.end).toLocaleDateString()}</p>
                                    <p style="font-size: 9px; color: var(--accent); margin-top: 4px;">${e.userIds?.length || 0} Authorized Users</p>
                                </div>
                                <div class="action-btn-group">
                                    <button class="action-btn" onclick="App.showImportModal('${e.id}')"><i data-lucide="user-plus" style="width:14px;"></i></button>
                                    <button class="action-btn" onclick="App.showEventModal(${JSON.stringify(e).replace(/"/g, '&quot;')})"><i data-lucide="edit-2" style="width:14px;"></i></button>
                                    <button class="action-btn danger" onclick="App.deleteEvent('${e.id}')"><i data-lucide="trash-2" style="width:14px;"></i></button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        },

        eventSelect() {
            const authorizedEvents = this.state.isAdmin ? this.state.events : this.state.events.filter(e => e.userIds?.includes(this.state.currentUser.id));
            
            return `
                <div class="screen event-select-screen">
                    <header style="padding: 16px 24px; border-bottom: 1px solid var(--glass-border); display: flex; align-items: center; gap: 15px;">
                        <button onclick="App.navigateTo('home')" style="background: none; border: none; color: #fff;"><i data-lucide="arrow-left"></i></button>
                        <h2 style="font-size: 20px; font-family: 'Outfit';">Switch Event</h2>
                    </header>
                    <div class="screen-content">
                        ${authorizedEvents.length === 0 ? '<p style="text-align: center; padding: 20px; opacity: 0.5;">No authorized events found.</p>' : authorizedEvents.map(e => `
                            <div class="premium-card" style="border-left: 4px solid ${this.state.activeEvent?.id === e.id ? 'var(--accent)' : 'transparent'};" onclick="App.selectEvent('${e.id}')">
                                <h4>${e.name}</h4>
                                <p style="font-size: 11px; opacity: 0.6;">Range: ${new Date(e.start).toLocaleDateString()} - ${new Date(e.end).toLocaleDateString()}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        },

        contacts() {
            return `
                <div class="screen contacts-screen">
                    <header style="padding: 16px 24px;">
                        <h2 style="font-size: 24px; font-family: 'Outfit';">Lead Repository</h2>
                        <input type="text" class="form-input" placeholder="Search by name, company..." style="margin-top: 15px;" onkeyup="App.filterContacts(this.value)">
                    </header>
                    <div class="screen-content" id="all-contacts-list">
                        ${this.state.contacts.map(c => this.renderContactItem(c)).join('')}
                    </div>
                </div>
            `;
        },

        eventSelect() {
            const userEvents = this.state.events.filter(e => e.userIds?.includes(this.state.currentUser?.id) || this.state.isAdmin);
            return `
                <div class="screen event-select-screen" style="padding: 30px;">
                    <button class="btn-secondary" style="margin-bottom: 20px;" onclick="App.navigateTo('home')"><i data-lucide="arrow-left"></i> Back</button>
                    <h2 style="font-family: 'Outfit'; margin-bottom: 25px;">Available Events</h2>
                    ${userEvents.length === 0 ? '<p style="opacity: 0.5;">No trade shows assigned to your profile.</p>' : ''}
                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        ${userEvents.map(e => `
                            <div class="premium-card" onclick="App.selectEvent('${e.id}')" style="${this.state.activeEvent?.id === e.id ? 'border-color: var(--accent);' : ''}">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <h4>${e.name}</h4>
                                        <p style="font-size: 11px; opacity: 0.5;">Dubai World Trade Centre</p>
                                    </div>
                                    ${this.state.activeEvent?.id === e.id ? '<i data-lucide="check-circle" style="color: var(--accent);"></i>' : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        },

        review() {
            return `
                <div class="screen review-screen">
                    <header style="padding: 16px 24px; border-bottom: 1px solid var(--glass-border); display: flex; align-items: center; gap: 15px;">
                        <button onclick="App.navigateTo('home')" style="background: none; border: none; color: #fff;"><i data-lucide="arrow-left"></i></button>
                        <h2 style="font-size: 18px; font-family: 'Outfit';">Edit Lead</h2>
                    </header>
                    <div class="screen-content" style="padding-bottom: 100px;">
                        <div class="premium-card" style="background: #000; text-align: center;"><img id="review-image-preview" style="max-height: 200px; max-width: 100%; object-fit: contain;"></div>
                        <div class="form-group"><label>Full Name</label><input type="text" id="field-name" class="form-input"></div>
                        <div class="form-group"><label>Company</label><input type="text" id="field-company" class="form-input"></div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div class="form-group"><label>Designation</label><input type="text" id="field-designation" class="form-input"></div>
                            <div class="form-group"><label>Phone</label><input type="text" id="field-phone" class="form-input"></div>
                        </div>
                        <div class="form-group"><label>Email</label><input type="text" id="field-email" class="form-input"></div>
                        <div class="form-group"><label>Notes (Lead Context)</label><textarea id="field-notes" class="form-input" style="height: 120px;"></textarea></div>
                    </div>
                    <div class="sticky-footer"><button class="btn-primary" style="width: 100%;" onclick="App.saveContact()">Save Lead</button></div>
                </div>
            `;
        },

        crop() {
            return `
                <div class="screen crop-screen" style="display: flex; flex-direction: column; height: 100%;">
                    <div style="flex: 1; min-height: 0; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                        <img id="crop-image" src="${this.state.tempImage}" style="max-width: 100%; max-height: 100%;">
                    </div>
                    <div style="padding: 20px; display: flex; gap: 10px;">
                        <button class="btn-secondary" style="flex: 1;" onclick="App.stopCamera(); App.navigateTo('home')">Cancel</button>
                        <button class="btn-primary" style="flex: 2;" onclick="App.finalizeCrop()">Extract Details</button>
                    </div>
                </div>
            `;
        },
        
        export() {
            return `
                <div class="screen export-screen" style="padding: 30px;">
                    <h2 style="font-family: 'Outfit'; margin-bottom: 20px;">Data Export</h2>
                    <div class="premium-card" onclick="App.exportToExcel()">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="background: var(--success); color: #fff; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center;"><i data-lucide="file-spreadsheet"></i></div>
                            <div><h4>Microsoft Excel</h4><p style="font-size: 11px; opacity: 0.6;">Event-grouped spreadsheet</p></div>
                        </div>
                    </div>
                    <div class="premium-card" style="margin-top: 15px;" onclick="App.exportToVCF()">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="background: var(--info); color: #fff; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center;"><i data-lucide="users"></i></div>
                            <div><h4>vCard (Phone Book)</h4><p style="font-size: 11px; opacity: 0.6;">Direct contact import</p></div>
                        </div>
                    </div>
                </div>
            `;
        }
    },

    // --- Authentication ---
    handleLogin(event) {
        if (event) event.preventDefault();
        console.log('App: Attempting Login...');
        
        const mobileEl = document.getElementById('login-mobile');
        const passEl = document.getElementById('login-pass');
        
        if (!mobileEl || !passEl) {
            console.error('App: Login fields missing from DOM');
            return;
        }
        
        const mobile = mobileEl.value.trim();
        const pass = passEl.value.trim();
        
        if (mobile === 'admin' && pass === 'admin123') {
            console.log('App: Admin Login Successful');
            const admin = { mobile: 'System Admin', id: 'admin', isAdmin: true };
            this.state.currentUser = admin;
            this.state.isAdmin = true;
            localStorage.setItem('bizconnex_user', JSON.stringify(admin));
            this.navigateTo('adminDashboard');
            return;
        }

        const user = this.state.users.find(u => u.mobile === mobile && u.password === pass);
        if (user) {
            console.log('App: User Login Successful');
            this.state.currentUser = user;
            this.state.isAdmin = false;
            localStorage.setItem('bizconnex_user', JSON.stringify(user));
            
            // Auto-select event if only one is active
            const authorizedEvents = this.state.events.filter(e => e.userIds?.includes(user.id));
            if (authorizedEvents.length === 1) {
                this.state.activeEvent = authorizedEvents[0];
                localStorage.setItem('bizconnex_active_event', JSON.stringify(this.state.activeEvent));
            }
            
            this.navigateTo('home');
        } else {
            console.warn('App: Login Denied');
            alert('Invalid Credentials. Access is restricted to authorized users.');
        }
    },

    logout(event) {
        if (event) event.stopPropagation();
        if (confirm('Are you sure you want to log out?')) {
            localStorage.removeItem('bizconnex_user');
            localStorage.removeItem('bizconnex_active_event');
            this.state.currentUser = null;
            this.state.activeEvent = null;
            this.state.isAdmin = false;
            this.navigateTo('login');
        }
    },

    // --- Background Engine ---
    processImage(imageData) {
        // Safe check for active event - use a fallback 'General Scan' to avoid locking
        const event = this.state.activeEvent || { name: 'General Scan', id: 'gen_' + Date.now().toString(36) };
        
        console.log('App: Processing image into Queue with event:', event.name);
        
        const queueItem = {
            id: 'q_' + Date.now(),
            image: imageData,
            status: 'Uploaded',
            timestamp: Date.now(),
            eventId: event.id,
            eventName: event.name,
            notes: '',
            data: null
        };
        this.state.uploadQueue.unshift(queueItem);
        this.saveQueue();
        this.navigateTo('home');
    },

    async processQueue() {
        if (this.state.isProcessing) return;
        const next = this.state.uploadQueue.find(qi => qi.status === 'Uploaded');
        
        if (!next) {
            setTimeout(() => this.processQueue(), 2000);
            return;
        }

        console.log('App: Engine Picking up item:', next.id);
        this.state.isProcessing = true;
        next.status = 'Processing';
        this.saveQueue();
        if (this.state.currentScreen === 'home') this.renderScreen('home');

        try {
            console.log('App: Sending to Gemini AI...');
            const data = await this.extractWithAI(next.image);
            if (data && data.name) {
                console.log('App: AI Extraction Successful:', data.name);
                const contact = { 
                    ...data, 
                    id: 'c_' + Date.now(), 
                    image: next.image, 
                    eventName: next.eventName, 
                    eventId: next.eventId,
                    timestamp: next.timestamp,
                    notes: ''
                };
                this.state.contacts.unshift(contact);
                localStorage.setItem('bizconnex_contacts', JSON.stringify(this.state.contacts));
                next.status = 'Updated';
                this.showToast(`Lead Extracted: ${data.name}`);
            } else {
                throw new Error('Invalid AI Data');
            }
        } catch (e) { 
            console.error('App: Queue Critical Error:', e);
            next.status = 'Failed: ' + (e.message || 'AI Error');
        } finally {
            this.state.isProcessing = false;
            this.saveQueue();
            if (this.state.currentScreen === 'home') this.renderScreen('home');
            setTimeout(() => this.processQueue(), 1000);
        }
    },

    saveQueue() { localStorage.setItem('bizconnex_queue', JSON.stringify(this.state.uploadQueue)); },

    // --- Rendering Helpers ---
    renderQueueItem(q) {
        const isFailed = q.status.startsWith('Failed');
        const isQuota = q.status.includes('quota') || q.status.includes('429');
        return `
            <div class="contact-item animate__animated animate__fadeIn" style="opacity: 0.8; border-left: 3px solid ${isFailed ? '#e74c3c' : 'var(--warning)'}; margin-bottom: 12px; height: auto; padding: 12px;">
                <div class="contact-avatar" style="background: #333; width: 50px; height: 50px;">
                    <img src="${q.image}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">
                </div>
                <div class="contact-info" style="flex: 1; padding-left: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <h4 style="color: var(--text-secondary); font-size: 13px;">${isQuota ? 'Waiting for Server Quota...' : q.status}</h4>
                            <p style="font-size: 10px; color: var(--text-muted);">${new Date(q.timestamp).toLocaleTimeString()}</p>
                            ${isFailed ? `<p style="color: #ff4d4d; font-size: 9px; margin-top: 4px; line-height: 1.2;">${q.status.replace('Failed: ', '')}</p>` : ''}
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 5px;">
                            ${isFailed ? `<button class="btn-primary" style="padding: 4px 10px; font-size: 10px; background: #2ecc71;" onclick="App.retryQueueItem('${q.id}')">Retry</button>` : ''}
                            <button class="btn-secondary" style="padding: 4px 10px; font-size: 10px;" onclick="App.deleteQueueItem('${q.id}')">Dismiss</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    retryQueueItem(id) {
        const item = this.state.uploadQueue.find(q => q.id === id);
        if (item) {
            item.status = 'Uploaded';
            this.saveQueue();
            this.renderScreen('home');
            this.processQueue();
        }
    },

    deleteQueueItem(id) {
        this.state.uploadQueue = this.state.uploadQueue.filter(q => q.id !== id);
        this.saveQueue();
        this.renderScreen('home');
    },

    renderContactItem(c) {
        const initials = c.name ? c.name[0] : '?';
        const displayImage = c.image || 'https://via.placeholder.com/300x150/111/fff?text=Card+Image+Missing';
        
        return `
            <div class="contact-item" id="cont-${c.id}" onclick="App.toggleTile('${c.id}')">
                <div style="display: flex; gap: 15px; align-items: center; width: 100%;">
                    <div class="contact-avatar">${initials}</div>
                    <div style="flex: 1;"><h4>${c.name || 'Processing...'}</h4><p style="font-size: 11px; opacity: 0.6;">${c.company || ''}</p></div>
                    <div style="text-align: right;"><span class="status-indicator"></span><p style="font-size: 9px; opacity: 0.4;">${c.eventName || ''}</p></div>
                </div>
                <div class="expandable-content" id="expand-${c.id}">
                    <div style="border-top: 1px solid var(--glass-border); padding-top: 15px; margin-top: 10px;">
                        <img src="${displayImage}" style="width: 100%; height: 120px; border-radius: 8px; object-fit: contain; background: #111; margin-bottom: 15px;">
                        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                            <button class="btn-secondary" style="flex: 1; padding: 8px;" onclick="event.stopPropagation(); App.handleAction('call', '${c.phone}')"><i data-lucide="phone" style="width: 16px;"></i></button>
                            <button class="btn-secondary" style="flex: 1; padding: 8px;" onclick="event.stopPropagation(); App.handleAction('whatsapp', '${c.phone}')"><i data-lucide="message-circle" style="width: 16px;"></i></button>
                            <button class="btn-primary" style="flex: 1; padding: 8px;" onclick="event.stopPropagation(); App.editContact('${c.id}')"><i data-lucide="edit" style="width: 16px;"></i></button>
                            <button class="btn-danger" style="flex: 1; padding: 8px; background: rgba(231, 76, 60, 0.1); border-color: #e74c3c33; color: #e74c3c;" onclick="event.stopPropagation(); App.deleteContact('${c.id}')"><i data-lucide="trash-2" style="width: 16px;"></i></button>
                        </div>
                        <p style="font-size: 11px; opacity: 0.5; margin-bottom: 5px;">Lead Notes</p>
                        <div class="notes-container" style="font-size: 13px; min-height: 40px; overflow-wrap: break-word;">${c.notes || 'Tap Edit to add meeting notes.'}</div>
                    </div>
                </div>
            </div>
        `;
    },

    toggleTile(id) {
        const div = document.getElementById(`expand-${id}`);
        if (div) { div.classList.toggle('active'); lucide.createIcons(); }
    },

    // --- Feature Logic ---
    startCameraFlow() {
        const overlay = document.createElement('div');
        overlay.id = 'camera-overlay';
        overlay.innerHTML = `<div class="camera-header"><button onclick="App.stopCamera()"><i data-lucide="x"></i></button><p>Position Contact Card</p><div></div></div><video id="camera-video" autoplay playsinline></video><div class="scanning-laser"></div><div class="camera-mask"></div><div class="camera-controls"><button onclick="document.getElementById('gallery-input').click()"><i data-lucide="image"></i></button><button class="shutter-btn" onclick="App.takePhoto()"><div class="shutter-inner"></div></button><button><i data-lucide="zap-off"></i></button></div><input type="file" id="gallery-input" style="display: none;" accept="image/*" onchange="App.handleGalleryUpload(event)"><canvas id="camera-canvas" style="display: none;"></canvas>`;
        document.body.appendChild(overlay);
        lucide.createIcons();
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(s => { document.getElementById('camera-video').srcObject = s; this.activeStream = s; });
    },

    stopCamera() { if (this.activeStream) this.activeStream.getTracks().forEach(t => t.stop()); document.getElementById('camera-overlay')?.remove(); },

    takePhoto() {
        const video = document.getElementById('camera-video');
        const canvas = document.getElementById('camera-canvas');
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        this.state.tempImage = canvas.toDataURL('image/jpeg', 0.8);
        this.stopCamera(); this.renderScreen('crop');
    },

    handleGalleryUpload(e) {
        const reader = new FileReader();
        reader.onload = (ev) => { this.state.tempImage = ev.target.result; this.stopCamera(); this.renderScreen('crop'); };
        reader.readAsDataURL(e.target.files[0]);
    },

    handleBatchUpload(e) {
        Array.from(e.target.files).forEach(f => {
            const reader = new FileReader();
            reader.onload = (ev) => this.processImage(ev.target.result);
            reader.readAsDataURL(f);
        });
        this.showToast('Uploading sequence started...');
    },

    initCropper() { this.cropper = new Cropper(document.getElementById('crop-image'), { viewMode: 1, autoCropArea: 0.9 }); },

    finalizeCrop() {
        const img = this.cropper.getCroppedCanvas({ maxWidth: 1000 }).toDataURL('image/jpeg', 0.8);
        this.cropper.destroy(); this.processImage(img);
    },

    async extractWithAI(imageData) {
        console.log('App: Redirecting to Vertex AI Proxy...');
        try {
            const mimeMatch = imageData.match(/data:([^;]+);/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

            // --- CALL LOCAL PROXY (VERTEX AI BRIDGE) ---
            const resp = await fetch('/api/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageData, mimeType })
            });
            
            if (!resp.ok) {
                const errData = await resp.json();
                console.error('App: Vertex Proxy Error:', errData);
                throw new Error('Vertex Engine: ' + (errData.error?.message || 'Server Error'));
            }

            const res = await resp.json();
            console.log('App: Vertex Response Received');
            
            // Handle Vertex AI / Gemini 2.0 Response Structure
            const text = res.candidates[0].content.parts[0].text;
            const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const extracted = JSON.parse(cleaned);

            // If it's an array (Atomic Prompt style), pick the first one
            const result = Array.isArray(extracted) ? extracted[0] : extracted;

            // Forgiving Key Mapping
            result.name = result.name || result.fullName || result.full_name || 'Unknown';
            result.company = result.company || result.organization || '';
            
            return result;
        } catch (e) { 
            console.error('App: Extraction Critical Error:', e); 
            throw new Error(e.message || 'Data Parse Error'); 
        }
    },

    saveContact() {
        const c = this.state.currentContact;
        const data = {
            name: document.getElementById('field-name').value,
            company: document.getElementById('field-company').value,
            designation: document.getElementById('field-designation').value,
            phone: document.getElementById('field-phone').value,
            email: document.getElementById('field-email').value,
            notes: document.getElementById('field-notes').value
        };
        if (c) {
            const idx = this.state.contacts.findIndex(x => x.id === c.id);
            if (idx !== -1) this.state.contacts[idx] = { ...this.state.contacts[idx], ...data };
        } else {
            this.state.contacts.unshift({ ...data, id: 'c_'+Date.now(), timestamp: Date.now(), status: 'Updated' });
        }
        localStorage.setItem('bizconnex_contacts', JSON.stringify(this.state.contacts));
        this.state.currentContact = null;
        this.showToast('Lead Updated');
        this.navigateTo('home');
    },

    editContact(id) {
        const c = this.state.contacts.find(x => x.id === id);
        if (!c) return;
        this.state.currentContact = c;
        this.renderScreen('review');
        setTimeout(() => {
            document.getElementById('field-name').value = c.name || '';
            document.getElementById('field-company').value = c.company || '';
            document.getElementById('field-designation').value = c.designation || '';
            document.getElementById('field-phone').value = c.phone || '';
            document.getElementById('field-email').value = c.email || '';
            document.getElementById('field-notes').value = c.notes || '';
            document.getElementById('review-image-preview').src = c.image || '';
        }, 100);
    },

    handleAction(t, v) { if (!v) return; if (t==='call') window.location.href=`tel:${v}`; if (t==='whatsapp') window.open(`https://wa.me/${v.replace(/\D/g,'')}`); },

    deleteUser(id) {
        if (confirm('Delete user? This cannot be undone.')) {
            this.state.users = this.state.users.filter(u => u.id !== id);
            localStorage.setItem('bizconnex_users', JSON.stringify(this.state.users));
            this.renderScreen('userManager');
        }
    },
    deleteEvent(id) {
        if (confirm('Delete trade show? All authorized user links will be removed.')) {
            this.state.events = this.state.events.filter(e => e.id !== id);
            localStorage.setItem('bizconnex_events', JSON.stringify(this.state.events));
            this.renderScreen('eventManager');
        }
    },

    // --- Rendering Helpers ---
    showToast(msg, status = 'success') {
        const container = document.getElementById('notif-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${status} animate__animated animate__fadeInUp`;
        toast.style.cssText = `
            background: rgba(0,0,0,0.9);
            color: #fff;
            padding: 12px 20px;
            border-radius: 12px;
            margin-top: 10px;
            border: 1px solid var(--glass-border);
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            font-size: 13px;
            z-index: 9999;
        `;
        toast.innerHTML = `<i data-lucide="${status === 'success' ? 'check-circle' : 'alert-circle'}"></i> <span>${msg}</span>`;
        container.appendChild(toast);
        if (window.lucide) lucide.createIcons();

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.5s ease';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },

    // --- Premium Modal System (Replaces Native Prompts) ---
    showModal(title, fields, callback, submitLabel = 'Confirm') {
        const overlay = document.createElement('div');
        overlay.className = 'biz-modal-overlay';
        overlay.innerHTML = `
            <div class="biz-modal">
                <h2>${title}</h2>
                ${fields.map(f => {
                    if (f.type === 'textarea') {
                        return `
                            <div style="margin-bottom: 15px;">
                                <label style="display: block; font-size: 11px; opacity: 0.5; margin-bottom: 5px;">${f.label}</label>
                                <textarea id="modal-field-${f.id}" class="glass-textarea" placeholder="${f.placeholder || ''}">${f.value || ''}</textarea>
                            </div>
                        `;
                    }
                    if (f.type === 'multiselect') {
                        return `
                            <div style="margin-bottom: 15px;">
                                <label style="display: block; font-size: 11px; opacity: 0.5; margin-bottom: 5px;">${f.label}</label>
                                <div class="multiselect-container">
                                    ${f.options.map(opt => `
                                        <label class="multiselect-item">
                                            <input type="checkbox" name="modal-multi-${f.id}" value="${opt.value}" ${f.selected?.includes(opt.value) ? 'checked' : ''}>
                                            <span style="font-size: 13px;">${opt.label}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    }
                    return `
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; font-size: 11px; opacity: 0.5; margin-bottom: 5px;">${f.label}</label>
                            <input type="${f.type || 'text'}" id="modal-field-${f.id}" class="glass-input" style="width: 100%;" placeholder="${f.placeholder || ''}" value="${f.value || ''}">
                        </div>
                    `;
                }).join('')}
                <div class="biz-modal-actions">
                    <button class="btn-secondary" style="flex: 1;" onclick="this.closest('.biz-modal-overlay').remove()">Cancel</button>
                    <button class="btn-primary" style="flex: 1;" id="modal-submit">${submitLabel}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const submit = overlay.querySelector('#modal-submit');
        submit.onclick = () => {
            const results = {};
            fields.forEach(f => {
                if (f.type === 'multiselect') {
                    results[f.id] = Array.from(overlay.querySelectorAll(`input[name="modal-multi-${f.id}"]:checked`)).map(cb => cb.value);
                } else {
                    results[f.id] = document.getElementById(`modal-field-${f.id}`).value;
                }
            });
            overlay.remove();
            callback(results);
        };
    },

    // --- Core Admin Logic (Authoritative) ---
    generatePassword() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    },

    provisionUsers(rawList, targetEventId = null) {
        const numbers = rawList.split(/[\n,]+/).map(n => n.trim().replace(/\s/g, '')).filter(n => n.length >= 8);
        let created = 0, updated = 0;

        numbers.forEach(num => {
            let user = this.state.users.find(u => u.mobile === num);
            if (user) {
                if (targetEventId && !user.eventIds.includes(targetEventId)) user.eventIds.push(targetEventId);
                updated++;
            } else {
                user = {
                    id: 'u_' + Date.now() + Math.random(),
                    mobile: num,
                    password: this.generatePassword(),
                    isAdmin: false,
                    eventIds: targetEventId ? [targetEventId] : []
                };
                this.state.users.push(user);
                created++;
            }
        });

        localStorage.setItem('bizconnex_users', JSON.stringify(this.state.users));
        this.showToast(`Sync Complete: ${created} New, ${updated} Assigned`);
        return { created, updated };
    },

    showUserModal(userObj = null) {
        const isEdit = !!userObj;
        this.showModal(
            isEdit ? 'Edit User' : 'New User',
            [
                { id: 'mobile', label: 'Mobile Number', value: userObj?.mobile || '', placeholder: 'e.g. 9876543210' },
                { id: 'password', label: 'Password', value: userObj?.password || this.generatePassword(), placeholder: 'Auto-generated or Manual' }
            ],
            (data) => {
                if (!data.mobile) return;
                if (isEdit) {
                    const idx = this.state.users.findIndex(u => u.id === userObj.id);
                    if (idx !== -1) this.state.users[idx] = { ...this.state.users[idx], mobile: data.mobile, password: data.password };
                } else {
                    this.provisionUsers(data.mobile); // Re-uses upsert logic
                }
                localStorage.setItem('bizconnex_users', JSON.stringify(this.state.users));
                this.renderScreen('userManager');
            },
            isEdit ? 'Update User' : 'Create User'
        );
    },

    showImportModal(eventId = null) {
        this.showModal(
            eventId ? 'Assign Users to Event' : 'Bulk Import Users',
            [
                { id: 'list', type: 'textarea', label: 'Mobile Numbers (Newline or Comma separated)', placeholder: '9876543210\n9988776655...' }
            ],
            (data) => {
                if (data.list) this.provisionUsers(data.list, eventId);
                this.renderScreen(eventId ? 'eventManager' : 'userManager');
            },
            'Import & Sync'
        );
    },

    showEventModal(eventObj = null) {
        const isEdit = !!eventObj;
        const userOptions = this.state.users.map(u => ({ label: u.mobile, value: u.id }));
        
        this.showModal(
            isEdit ? 'Edit Event' : 'New Trade Show',
            [
                { id: 'name', label: 'Event Name', value: eventObj?.name || '', placeholder: 'e.g. Dubai Expo 2024' },
                { id: 'start', label: 'Start Date', type: 'date', value: eventObj?.start ? eventObj.start.split('T')[0] : '' },
                { id: 'end', label: 'End Date', type: 'date', value: eventObj?.end ? eventObj.end.split('T')[0] : '' },
                { id: 'userIds', type: 'multiselect', label: 'Authorized Users', options: userOptions, selected: eventObj?.userIds || [] }
            ],
            (data) => {
                if (!data.name) return;
                const finalEvent = {
                    id: eventObj?.id || 'ev_' + Date.now(),
                    name: data.name,
                    start: data.start ? new Date(data.start).toISOString() : new Date().toISOString(),
                    end: data.end ? new Date(data.end).toISOString() : '2030-12-31T00:00:00Z',
                    userIds: data.userIds || []
                };

                if (isEdit) {
                    const idx = this.state.events.findIndex(e => e.id === eventObj.id);
                    if (idx !== -1) this.state.events[idx] = finalEvent;
                } else {
                    this.state.events.push(finalEvent);
                }

                // Reverse map users to the eventId for speed
                finalEvent.userIds.forEach(uid => {
                    const u = this.state.users.find(x => x.id === uid);
                    if (u && !u.eventIds.includes(finalEvent.id)) u.eventIds.push(finalEvent.id);
                });

                localStorage.setItem('bizconnex_events', JSON.stringify(this.state.events));
                localStorage.setItem('bizconnex_users', JSON.stringify(this.state.users));
                this.renderScreen('eventManager');
            },
            isEdit ? 'Save Changes' : 'Launch Event'
        );
    },
    deleteContact(id) {
        if (confirm('Delete Lead?')) {
            this.state.contacts = this.state.contacts.filter(c => c.id !== id);
            localStorage.setItem('bizconnex_contacts', JSON.stringify(this.state.contacts));
            this.navigateTo('home');
        }
    },

    exportToExcel() {
        const data = this.state.contacts.map(c => ({ 'Name': c.name, 'Company': c.company, 'Phone': c.phone, 'Email': c.email, 'Event': c.eventName, 'Notes': c.notes }));
        const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Leads"); XLSX.writeFile(wb, `Bizconnex_Leads_${Date.now()}.xlsx`);
    },

    injectDebugUI() {
        const p = document.createElement('div'); p.id = 'ai-debug-panel';
        p.style.cssText = 'position: fixed; bottom: 10px; right: 10px; background: rgba(0,0,0,0.8); color: #fff; padding: 5px 12px; font-size: 10px; z-index: 10001; border-radius: 20px; border: 1px solid #444; pointer-events: none; opacity: 0.8; font-family: monospace; transition: all 0.3s ease;';
        p.innerHTML = `VERTEX: <span id="ai-net-status">LOADING...</span>`; 
        document.body.appendChild(p);
    },

    async checkConnectivity() {
        const statusEl = document.getElementById('ai-net-status');
        try {
            // Simplified check to ensure proxy is responsive
            const resp = await fetch('/api/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ping: true })
            });
            if (statusEl) { 
                statusEl.innerText = 'VERTEX ACTIVE'; 
                statusEl.style.color = '#2ecc71'; 
            }
        } catch (e) {
            if (statusEl) { 
                statusEl.innerText = 'PROXY OFFLINE'; 
                statusEl.style.color = '#e74c3c';
            }
            console.warn('App: Proxy Check Failed:', e);
        }
    },

    hardReset() {
        if (confirm('DANGER: This will wipe all local data and log you out. Are you sure?')) {
            localStorage.clear();
            window.location.reload();
        }
    },

    selectEvent(id) {
        const event = this.state.events.find(e => e.id === id);
        if (event) {
            this.state.activeEvent = event;
            localStorage.setItem('bizconnex_active_event', JSON.stringify(event));
            this.showToast(`Active Event: ${event.name}`);
            this.navigateTo('home');
        }
    },

    syncCloud() {
        // Mocking event sync for testing
        if (this.state.events.length === 0) {
            this.state.events = [
                { id: 'ev1', name: 'Global Tech Expo 2024', start: '2024-01-01', end: '2025-12-31' },
                { id: 'ev2', name: 'Bizconnex Summit Riyadh', start: '2024-05-01', end: '2025-12-31' }
            ];
            localStorage.setItem('bizconnex_events', JSON.stringify(this.state.events));
        }
    }
};

// --- GLOBAL EXPOSURE (Crucial for HTML onclick handlers) ---
window.App = App;

// Boot
App.init();
