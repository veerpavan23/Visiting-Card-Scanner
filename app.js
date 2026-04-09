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
        notifications: JSON.parse(localStorage.getItem('bizconnex_notifs') || '[]'),
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

    async logout() {
        this.showModal(
            'Confirm Logout',
            'Are you sure you want to sign out of Bizconnex? Your local card queue will still be preserved.',
            [],
            async () => {
                this.state.currentUser = null;
                this.state.activeEvent = null;
                localStorage.removeItem('bizconnex_user');
                localStorage.removeItem('bizconnex_active_event');
                this.navigateTo('login');
                this.showToast('Logged out successfully');
            },
            'Sign Out'
        );
    },

    addNotification(title, message) {
        const notif = {
            id: 'nt_' + Date.now(),
            title,
            message,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            read: false
        };
        this.state.notifications.unshift(notif);
        if (this.state.notifications.length > 15) this.state.notifications.pop();
        localStorage.setItem('bizconnex_notifs', JSON.stringify(this.state.notifications));
        this.updateNotificationBadge();
    },

    updateNotificationBadge() {
        const badge = document.getElementById('notif-badge');
        if (!badge) return;
        const unread = this.state.notifications.filter(n => !n.read).length;
        badge.classList.toggle('hidden', unread === 0);
    },

    showNotifications() {
        const notifHtml = this.state.notifications.length === 0 
            ? '<p style="text-align:center; padding: 20px; opacity: 0.5;">No recent updates</p>'
            : this.state.notifications.map(n => `
                <div class="notif-item">
                    <div class="notif-dot" style="${n.read ? 'opacity:0' : ''}"></div>
                    <div class="notif-body">
                        <h5>${n.title}</h5>
                        <p>${n.message}</p>
                        <div class="notif-time">${n.time}</div>
                    </div>
                </div>
            `).join('');

        this.showModal(
            'Activity Log',
            '',
            [],
            () => {
                this.state.notifications.forEach(n => n.read = true);
                localStorage.setItem('bizconnex_notifs', JSON.stringify(this.state.notifications));
                this.updateNotificationBadge();
            },
            'Mark as Read'
        );
        
        // Inject custom HTML into the modal we just opened
        const body = document.getElementById('modal-fields-container');
        if (body) body.innerHTML = `<div style="max-height: 400px; overflow-y: auto;">${notifHtml}</div>`;
    },

    normalizeMobile(mobile) {
        if (!mobile) return '';
        return mobile.replace(/\D/g, '');
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
        
        // --- Enterprise Scanner Guard ---
        if (screenName === 'capture') {
            const isLive = this.isLiveEventActive();
            if (!isLive) {
                this.showToast('Scanner locked. Select a Live event.', 'error');
                this.navigateTo('home');
                return;
            }
            this.startCameraFlow();
            return;
        }

        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-screen') === screenName);
        });

        this.renderScreen(screenName);
    },

    // --- Premium Modal System (Replaces Native Prompts) ---
    showModal(title, message, fields, callback, submitLabel = 'Confirm') {
        const overlay = document.createElement('div');
        overlay.className = 'biz-modal-overlay animate__animated animate__fadeIn';
        overlay.innerHTML = `
            <div class="biz-modal animate__animated animate__zoomIn">
                <h2 style="margin-bottom: 5px;">${title}</h2>
                ${message ? `<p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.5;">${message}</p>` : ''}
                <div id="modal-fields-container">
                    ${fields.map(f => `
                        <div class="form-group">
                            <label style="margin-bottom: 8px; display: block; font-size: 13px;">${f.label}</label>
                            ${f.type === 'textarea' ? 
                                `<textarea id="modal-${f.id}" class="form-input" style="height: 100px;" placeholder="${f.placeholder || ''}"></textarea>` :
                                `<input type="${f.type}" id="modal-${f.id}" class="form-input" placeholder="${f.placeholder || ''}">`
                            }
                        </div>
                    `).join('')}
                </div>
                <div class="biz-modal-actions">
                    <button class="btn-secondary" id="modal-cancel-btn" style="flex: 1;">Cancel</button>
                    <button class="btn-primary" id="modal-save-btn" style="flex: 1;">${submitLabel}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        if (window.lucide) lucide.createIcons();

        document.getElementById('modal-cancel-btn').onclick = () => overlay.remove();
        document.getElementById('modal-save-btn').onclick = async () => {
            const data = {};
            fields.forEach(f => {
                const el = document.getElementById(`modal-${f.id}`);
                if (el) data[f.id] = el.value;
            });
            overlay.remove();
            if (callback) await callback(data);
        };
    },

    isLiveEventActive() {
        if (this.state.isAdmin) return true;
        if (!this.state.activeEvent) return false;
        const now = new Date();
        const start = new Date(this.state.activeEvent.start);
        const end = new Date(this.state.activeEvent.end);
        return now >= start && now <= end;
    },

    renderScreen(name) {
        this.state.currentScreen = name;
        const container = document.getElementById('screen-container');
        const nav = document.getElementById('global-nav');
        const header = document.getElementById('global-header');
        if (!container || !nav || !header) return;

        const showNavScreens = ['home', 'contacts', 'export', 'eventSelect'];
        nav.classList.toggle('hidden', !showNavScreens.includes(name));
        header.classList.toggle('hidden', name === 'splash' || name === 'login');

        if (name === 'home') this.updateNotificationBadge();

        let html = '';
        try {
            if (this.screens[name]) {
                html = this.screens[name].call(this);
            } else {
                console.error("Unknown Screen:", name);
                return this.navigateTo('home');
            }
        } catch (error) {
            console.error("Rendering Crash:", error);
            return this.navigateTo('home');
        }

        container.innerHTML = html;

        // --- GLOBAL PROCESSING BAR ---
        const processingCount = this.state.uploadQueue.filter(q => q.status === 'Processing' || q.status === 'Uploaded').length;
        if (processingCount > 0 && name !== 'splash') {
            const bar = document.createElement('div');
            bar.className = 'global-processing-bar';
            bar.innerHTML = `<div class="loader-spinner-mini"></div> Extracting ${processingCount} Card${processingCount > 1 ? 's' : ''}...`;
            container.prepend(bar);
        }

        if (name === 'crop') {
            setTimeout(() => this.initCropper(), 50);
        }
        try { if (window.lucide) lucide.createIcons(); } catch (e) {}
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
                <div class="screen login-screen" style="padding: 24px 20px; height: 100%; display: flex; flex-direction: column;">
                    <!-- Centered Content Wrapper -->
                    <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; width: 100%; max-width: 400px; margin: 0 auto;">
                        <div style="text-align: center; margin-bottom: 50px;">
                            <div style="background: linear-gradient(135deg, var(--primary), var(--primary-light)); width: 80px; height: 80px; border-radius: 24px; display: flex; align-items: center; justify-content: center; margin: 0 auto 28px; box-shadow: 0 12px 35px rgba(160, 29, 34, 0.5); border: 1px solid rgba(255,255,255,0.1);">
                                <i data-lucide="user-check" style="width: 38px; height: 38px; color: #fff;"></i>
                            </div>
                            <h2 style="font-size: 32px; font-family: 'Outfit'; font-weight: 800; letter-spacing: -1px; line-height: 1.1;">Bizconnex Login</h2>
                            <p style="color: var(--text-secondary); margin-top: 12px; font-size: 16px; opacity: 0.8;">Enter your credentials to begin</p>
                        </div>

                        <form id="login-form" onsubmit="App.handleLogin(event)" style="width: 100%;">
                            <div class="premium-card" style="margin-bottom: 30px; padding: 24px; width: 100%;">
                                <div class="form-group">
                                    <label style="font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--accent); font-weight: 700; margin-bottom: 10px; display: block;">Mobile Number (ID)</label>
                                    <input type="tel" id="login-mobile" class="form-input" placeholder="e.g. 9876543210" required 
                                           style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); padding: 16px; font-size: 16px; border-radius: 12px;">
                                </div>
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label style="font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--accent); font-weight: 700; margin-bottom: 10px; display: block;">Login Password</label>
                                    <input type="password" id="login-pass" class="form-input" placeholder="••••••••" required
                                           style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); padding: 16px; font-size: 16px; border-radius: 12px;">
                                </div>
                            </div>

                            <button type="submit" class="btn-primary" style="width: 100%; padding: 20px; font-size: 18px; box-shadow: 0 10px 30px rgba(160, 29, 34, 0.4);">
                                Sign In <i data-lucide="arrow-right" style="width: 20px;"></i>
                            </button>
                        </form>
                    </div>

                    <!-- Footer at Bottom -->
                    <div style="text-align: center; padding-top: 40px; border-top: 1px solid rgba(255,255,255,0.05);">
                        <p style="font-size: 13px; color: var(--text-muted); opacity: 0.8;">
                            Need help? Contact system administrator
                        </p>
                        <div style="margin-top: 18px; font-size: 11px; font-weight: 900; letter-spacing: 3px; color: var(--primary); opacity: 0.6; text-transform: uppercase;">Bizconnex Secure Portal</div>
                    </div>
                </div>
            `;
        },

        home() {
            const processingCount = this.state.uploadQueue.filter(q => q.status === 'Processing').length;
            const event = this.state.activeEvent;
            const contacts = this.state.contacts.filter(c => !event || c.eventId === event.id);

            const now = new Date();
            let eventStatus = 'Upcoming';
            let isLive = false;
            if (event) {
                const eStart = new Date(event.start);
                const eEnd = new Date(event.end);
                if (now >= eStart && now <= eEnd) { eventStatus = 'Live'; isLive = true; }
                else if (now > eEnd) { eventStatus = 'Expired'; }
            }

            return `
                <div class="screen home-screen">
                    <header style="padding: 16px 24px; display: flex; justify-content: space-between; align-items: start; border-bottom: 1px solid var(--glass-border); background: rgba(0,0,0,0.2);">
                        <div>
                            <h1 style="font-size: 24px; font-family: 'Outfit';">Biz<span class="text-accent">connex</span></h1>
                            <p style="color: var(--text-secondary); font-size: 11px;">Networking Intelligence</p>
                        </div>
                        <button onclick="App.logout()" style="background: none; border: none; color: #ff4d4d; font-size: 20px;"><i data-lucide="power"></i></button>
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

                        <div class="premium-card" style="padding: 15px; margin-bottom: 25px; border-left: 4px solid ${isLive ? '#2ecc71' : '#f1c40f'};" onclick="App.navigateTo('eventSelect')">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="flex: 1;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <p style="font-size: 10px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Active Trade Show <i data-lucide="chevron-down" style="width: 10px;"></i></p>
                                        ${event ? `<span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; background: ${isLive ? 'rgba(46,204,113,0.2)' : 'rgba(231,76,60,0.2)'}; color: ${isLive ? '#2ecc71' : '#e74c3c'}; font-weight: bold;">${eventStatus}</span>` : ''}
                                    </div>
                                    <h3 style="font-size: 16px; margin-top: 5px;">${event ? event.name : 'Select Event to Scan'}</h3>
                                    <p style="font-size: 10px; opacity: 0.6; margin-top: 4px;">${event ? (isNaN(new Date(event.start)) ? 'TBD' : new Date(event.start).toLocaleDateString() + ' - ' + new Date(event.end).toLocaleDateString()) : 'Tap to Select'}</p>
                                </div>
                                <div style="text-align: right;">
                                    <p style="font-size: 10px; color: var(--text-muted);">Scans</p>
                                    <p style="color: var(--accent); font-weight: 700; font-size: 18px;">${contacts.length}</p>
                                </div>
                            </div>
                        </div>

                        ${isLive ? `
                            <div style="display: flex; gap: 12px; margin-bottom: 25px;">
                                <button class="scanner-btn" style="flex: 1; border-color: rgba(46, 204, 113, 0.3);" onclick="App.startCameraFlow()">
                                    <div class="scanner-icon" style="background: rgba(160, 29, 34, 0.1); color: var(--primary);"><i data-lucide="camera"></i></div>
                                    <span>Camera</span>
                                </button>
                                <button class="scanner-btn" style="flex: 1;" onclick="document.getElementById('gallery-input').click()">
                                    <div class="scanner-icon" style="background: rgba(46, 204, 113, 0.1); color: #2ecc71;"><i data-lucide="image"></i></div>
                                    <span>Gallery</span>
                                </button>
                                <input type="file" id="gallery-input" style="display: none;" accept="image/*" onchange="App.handleGalleryUpload(event)">
                            </div>
                        ` : `
                            <div style="text-align: center; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 12px; margin-bottom: 25px;">
                                <i data-lucide="lock" style="width: 24px; color: var(--text-muted); margin-bottom: 10px;"></i>
                                <p style="font-size: 12px; color: var(--text-muted);">Scanner is locked.<br>Select a <b>Live</b> event to begin scanning.</p>
                            </div>
                        `}

                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h3 style="font-size: 16px; font-family: 'Outfit';">Recent Contacts</h3>
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

        eventSelect() {
            // Find events assigned to user
            let userEvents = [];
            if (this.state.isAdmin) {
                userEvents = this.state.events;
            } else if (this.state.currentUser && this.state.currentUser.mobile) {
                const normUser = this.normalizeMobile(this.state.currentUser.mobile);
                userEvents = this.state.events.filter(e => {
                    return e.numbers && e.numbers.some(n => this.normalizeMobile(n) === normUser);
                });
            }
            
            const now = new Date();
            const isSyncing = !this.state.events.length && window.Cloud;

            return `
                <div class="screen event-select-screen" style="padding: 24px;">
                    <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <button class="btn-secondary" style="padding: 10px 16px;" onclick="App.navigateTo('home')">
                            <i data-lucide="arrow-left" style="width: 16px;"></i> Back
                        </button>
                        <button class="btn-secondary" style="padding: 10px; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;" onclick="App.syncCloud(); App.showToast('Refreshing events...')">
                            <i data-lucide="rotate-cw" style="width: 18px;"></i>
                        </button>
                    </div>
                    
                    <div style="margin-bottom: 30px;">
                        <h2 style="font-family: 'Outfit'; font-size: 26px;">Select Event</h2>
                        <p style="color: var(--text-secondary); font-size: 13px;">Choose an authorized trade show to begin scanning.</p>
                    </div>

                    ${isSyncing ? `
                        <div style="text-align: center; padding: 40px; opacity: 0.6;">
                            <div class="loader-spinner" style="margin: 0 auto 15px;"></div>
                            <p style="font-size: 12px;">Connecting to Cloud...</p>
                        </div>
                    ` : userEvents.length === 0 ? `
                        <div style="text-align: center; padding: 60px 20px; background: rgba(255,255,255,0.03); border-radius: 20px; border: 1px dashed var(--glass-border);">
                            <i data-lucide="shield-alert" style="width: 48px; height: 48px; color: var(--text-muted); margin-bottom: 15px;"></i>
                            <p style="opacity: 0.5; font-size: 14px;">No trade shows assigned to your profile.<br>Tap the <i data-lucide="rotate-cw" style="width: 12px; display:inline;"></i> icon to refresh.</p>
                        </div>
                    ` : ''}
                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        ${userEvents.map(e => {
                            let statusText = 'Upcoming';
                            let statusColor = '#f1c40f'; // Yellow
                            let statusIcon = 'calendar';
                            const start = new Date(e.start);
                            const end = new Date(e.end);
                            
                            if (now >= start && now <= end) { 
                                statusText = 'Live'; 
                                statusColor = '#2ecc71'; 
                                statusIcon = 'radio';
                            }
                            else if (now > end) { 
                                statusText = 'Completed'; 
                                statusColor = '#3498db'; 
                                statusIcon = 'check-circle-2';
                            }
                            
                            const isActive = this.state.activeEvent?.id === e.id;
                            
                            return `
                            <div class="premium-card" onclick="App.selectEvent('${e.id}')" style="margin-bottom: 0; ${isActive ? 'border-color: var(--accent); background: rgba(239, 152, 19, 0.05);' : ''}">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="display: flex; align-items: center; gap: 15px;">
                                        <div style="width: 44px; height: 44px; background: ${statusColor}15; color: ${statusColor}; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                                            <i data-lucide="${statusIcon}"></i>
                                        </div>
                                        <div>
                                            <h4 style="font-size: 15px; margin-bottom: 2px;">${e.name}</h4>
                                            <p style="font-size: 11px; opacity: 0.5;">${isNaN(start) ? 'Date TBD' : start.toLocaleDateString() + ' - ' + end.toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        <span style="font-size: 9px; padding: 3px 8px; border-radius: 6px; background: ${statusColor}22; color: ${statusColor}; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">${statusText}</span>
                                        ${isActive ? '<div style="margin-top: 8px; color: var(--accent); font-size: 10px; font-weight: bold;">SELECTED</div>' : ''}
                                    </div>
                                </div>
                            </div>
                        `}).join('')}
                    </div>
                </div>
            `;
        },

        review() {
            return `
                <div class="screen review-screen">
                    <header style="padding: 16px 24px; border-bottom: 1px solid var(--glass-border); display: flex; align-items: center; gap: 15px;">
                        <button onclick="App.navigateTo('home')" style="background: none; border: none; color: #fff;"><i data-lucide="arrow-left"></i></button>
                        <h2 style="font-size: 18px; font-family: 'Outfit';">Edit Contact</h2>
                    </header>
                    <div class="screen-content" style="padding-bottom: 100px;">
                        <div class="premium-card" style="background: #000; text-align: center;"><img id="review-image-preview" style="max-height: 200px; max-width: 100%; object-fit: contain;"></div>
                        <div class="form-group"><label>Full Name</label><input type="text" id="field-name" class="form-input"></div>
                        <div class="form-group"><label>Company</label><input type="text" id="field-company" class="form-input"></div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div class="form-group"><label>Designation</label><input type="text" id="field-designation" class="form-input"></div>
                            <div class="form-group"><label>Primary Phone</label><input type="text" id="field-phone" class="form-input"></div>
                        </div>
                        <div class="form-group"><label>Secondary Phone</label><input type="text" id="field-secondaryPhone" class="form-input"></div>
                        <div class="form-group"><label>Email</label><input type="text" id="field-email" class="form-input"></div>
                        <div class="form-group"><label>Notes (Context)</label><textarea id="field-notes" class="form-input" style="height: 120px;"></textarea></div>
                    </div>
                    <div class="sticky-footer"><button class="btn-primary" style="width: 100%;" onclick="App.saveContact()">Save Contact</button></div>
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
        },

        contacts() {
            const event = this.state.activeEvent;
            const contacts = this.state.contacts.filter(c => !event || c.eventId === event.id);

            return `
                <div class="screen contacts-screen">
                    <header style="padding: 16px 24px; border-bottom: 1px solid var(--glass-border); background: rgba(0,0,0,0.2);">
                        <h2 style="font-size: 20px; font-family: 'Outfit';">Captured Contacts</h2>
                        <p style="color: var(--text-secondary); font-size: 11px;">Viewing contacts for: ${event ? event.name : 'All Events'}</p>
                    </header>
                    <div class="screen-content" style="padding: 20px;">
                        <div class="form-group" style="margin-bottom: 20px;">
                            <div style="position: relative;">
                                <i data-lucide="search" style="position: absolute; left: 12px; top: 12px; width: 16px; opacity: 0.5;"></i>
                                <input type="text" class="form-input" placeholder="Search by name, company..." style="padding-left: 40px;" oninput="App.filterContacts(this.value)">
                            </div>
                        </div>
                        <div id="contacts-full-list">
                            ${contacts.length === 0 ? '<div style="text-align: center; padding: 60px; opacity: 0.3;">No contacts captured yet.</div>' : contacts.map(c => this.renderContactItem(c)).join('')}
                        </div>
                    </div>
                </div>
            `;
        }
    },

    filterContacts(query) {
        const q = query.toLowerCase();
        const event = this.state.activeEvent;
        const filtered = this.state.contacts.filter(c => 
            (!event || c.eventId === event.id) && 
            ((c.name || '').toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q))
        );
        const list = document.getElementById('contacts-full-list');
        if (list) {
            list.innerHTML = filtered.length === 0 ? '<div style="text-align: center; padding: 60px; opacity: 0.3;">No matching leads.</div>' : filtered.map(c => this.renderContactItem(c)).join('');
            if (window.lucide) lucide.createIcons();
        }
    },

    // --- Authentication ---
    async handleLogin(event) {
        if (event) event.preventDefault();
        console.log('App: Attempting Login...');
        
        const mobileEl = document.getElementById('login-mobile');
        const passEl = document.getElementById('login-pass');
        
        if (!mobileEl || !passEl) {
            console.error('App: Login elements not found');
            return;
        }
        
        const mobile = mobileEl.value.trim();
        const pass = passEl.value.trim();
        
        // Admin Restricted Access
        if (mobile === 'admin' || mobile === '9999999999') {
            this.showToast('Restricted: Admin must use Desktop Portal', 'error');
            return;
        }

        // --- Proactive Cloud Fetch ---
        // If users list is empty or stale, force a fresh fetch from Cloud Bridge
        if (this.state.users.length === 0 && window.Cloud) {
            console.warn('App: Users list empty, forcing Cloud fetch...');
            try {
                const cloudUsers = await window.Cloud.getUsers();
                if (cloudUsers && cloudUsers.length > 0) {
                    this.state.users = cloudUsers;
                    localStorage.setItem('bizconnex_users', JSON.stringify(this.state.users));
                }
            } catch (e) {
                console.error('App: Proactive fetch failed', e);
            }
        }

        const normalizedInput = this.normalizeMobile(mobile);
        const user = this.state.users.find(u => {
            const normalizedUserMobile = this.normalizeMobile(u.mobile);
            return normalizedUserMobile === normalizedInput && (u.password === pass || u.mobile === pass || normalizedUserMobile === pass);
        });
        if (user) {
            console.log('App: Login Success for', user.name);
            this.state.currentUser = user;
            this.state.isAdmin = false;
            localStorage.setItem('bizconnex_user', JSON.stringify(user));

            // Proactive Data Refresh after login
            if (window.Cloud) {
                this.showToast('Synchronizing access...');
                try {
                    const [events, contacts] = await Promise.all([
                        window.Cloud.getEvents(),
                        window.Cloud.getContacts()
                    ]);
                    this.state.events = events;
                    this.state.contacts = contacts;
                    localStorage.setItem('bizconnex_events', JSON.stringify(events));
                    localStorage.setItem('bizconnex_contacts', JSON.stringify(contacts));
                } catch (e) {
                    console.warn('App: Post-login sync failed', e);
                }
            }

            this.navigateTo('home');
        } else {
            console.error('App: Login Failed for', mobile);
            alert('Invalid Credentials. Access is restricted to authorized users.');
        }
    },

    logout() {
        this.showModal(
            'Confirm Logout',
            [],
            () => {
                localStorage.clear();
                window.location.href = window.location.origin;
            },
            'Log Out',
            'Cancel'
        );
    },

    // --- Background Engine ---
    processImage(imageData, userNotes = '') {
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
            notes: userNotes,
            data: null
        };
        this.state.uploadQueue.unshift(queueItem);
        this.saveQueue();
        this.navigateTo('home');
        
        // Start processing immediately
        setTimeout(() => this.processQueue(), 100);
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
        next.startTime = Date.now(); // Start Telemetry
        this.saveQueue();
        this.renderScreen(this.state.currentScreen); 

        try {
            console.log('App: Sending to Vertex AI... [Target: <3s]');
            const data = await this.extractWithAI(next.image);
            
            const duration = (Date.now() - next.startTime) / 1000;
            console.log(`App: AI Extraction Complete in ${duration.toFixed(2)}s`);
            if (data && data.name) {
                console.log('App: AI Extraction Successful:', data.name);
                const contact = { 
                    ...data, 
                    id: 'c_' + Date.now(), 
                    image: next.image, 
                    eventName: next.eventName, 
                    eventId: next.eventId,
                    researcher: this.state.currentUser ? this.state.currentUser.name : 'Unknown',
                    researcherId: this.state.currentUser ? this.state.currentUser.mobile : 'Unknown',
                    timestamp: next.timestamp,
                    secondaryPhone: data.secondaryPhone || '',
                    notes: next.notes || data.notes || ''
                };
                this.state.contacts.unshift(contact);
                localStorage.setItem('bizconnex_contacts', JSON.stringify(this.state.contacts));
                
                // Sync to Cloud
                if (window.Cloud) {
                    window.Cloud.saveContact(contact).catch(e => console.error('Cloud Sync Failed:', e));
                }

                next.status = 'Updated';
                this.showToast(`Lead Extracted: ${data.name}`);
            } else {
                throw new Error('Invalid AI Data');
            }
        } catch (e) { 
            console.error('App: Queue Critical Error:', e);
            if (e.message && e.message.includes('429')) {
                next.status = 'Waiting for Server Quota...';
                // Backoff retry logic: wait 3 seconds before marking it uploaded again
                setTimeout(() => {
                    const qi = this.state.uploadQueue.find(q => q.id === next.id);
                    if (qi) { qi.status = 'Uploaded'; this.saveQueue(); }
                }, 3000);
            } else {
                next.status = 'Failed: ' + (e.message || 'AI Error');
            }
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
                        
                        <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px; font-size: 12px;">
                            ${c.email ? `<div style="display: flex; gap: 10px; align-items: center;"><i data-lucide="mail" style="width: 14px; opacity: 0.5;"></i> <span style="user-select: all;">${c.email}</span></div>` : ''}
                            ${c.phone ? `<div style="display: flex; gap: 10px; align-items: center;"><i data-lucide="phone" style="width: 14px; opacity: 0.5;"></i> <span style="user-select: all;">${c.phone}</span> <small style="opacity: 0.5;">(Primary)</small></div>` : ''}
                            ${c.secondaryPhone ? `<div style="display: flex; gap: 10px; align-items: center;"><i data-lucide="phone-forwarded" style="width: 14px; opacity: 0.5;"></i> <span style="user-select: all;">${c.secondaryPhone}</span> <small style="opacity: 0.5;">(Secondary)</small></div>` : ''}
                            ${c.designation ? `<div style="display: flex; gap: 10px; align-items: center;"><i data-lucide="briefcase" style="width: 14px; opacity: 0.5;"></i> <span>${c.designation}</span></div>` : ''}
                        </div>

                        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                            <button class="btn-secondary" style="flex: 1; padding: 8px;" onclick="event.stopPropagation(); App.handleContactAction('call', '${c.id}')"><i data-lucide="phone" style="width: 16px;"></i></button>
                            <button class="btn-secondary" style="flex: 1; padding: 8px;" onclick="event.stopPropagation(); App.handleContactAction('whatsapp', '${c.id}')"><i data-lucide="message-circle" style="width: 16px;"></i></button>
                            <button class="btn-secondary" style="flex: 1; padding: 8px;" onclick="event.stopPropagation(); App.handleContactAction('email', '${c.id}')"><i data-lucide="mail" style="width: 16px;"></i></button>
                        </div>
                        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                            <button class="btn-primary" style="flex: 2; padding: 8px; background: #3498db; border-color: #3498db;" onclick="event.stopPropagation(); App.downloadVCF('${c.id}')"><i data-lucide="user-plus" style="width: 16px; margin-right: 5px;"></i> Save to Phone</button>
                            <button class="btn-primary" style="flex: 1; padding: 8px;" onclick="event.stopPropagation(); App.editContact('${c.id}')"><i data-lucide="edit" style="width: 16px;"></i></button>
                            <button class="btn-danger" style="flex: 1; padding: 8px; background: rgba(231, 76, 60, 0.1); border-color: #e74c3c33; color: #e74c3c;" onclick="event.stopPropagation(); App.deleteContact('${c.id}')"><i data-lucide="trash-2" style="width: 16px;"></i></button>
                        </div>
                        <p style="font-size: 11px; opacity: 0.5; margin-bottom: 5px;">Contact Notes</p>
                        <div class="notes-container" style="font-size: 13px; min-height: 40px; overflow-wrap: break-word; color: var(--accent); font-style: italic;">${c.notes || 'No added context.'}</div>
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
        overlay.innerHTML = `
            <div class="camera-header">
                <button onclick="App.stopCamera()"><i data-lucide="x"></i></button>
                <p>Position Contact Card</p>
                <div></div>
            </div>
            
            <video id="camera-video" autoplay playsinline></video>
            <img id="capture-preview" src="">
            
            <div class="camera-mask" id="camera-mask"></div>
            
            <div class="camera-controls" id="capture-controls">
                <button class="btn-icon" onclick="document.getElementById('gallery-input').click()">
                    <i data-lucide="image"></i>
                </button>
                <button class="shutter-btn" onclick="App.takePhoto()">
                    <div class="shutter-inner"></div>
                </button>
                <button class="btn-icon" onclick="App.toggleFlash()">
                    <i data-lucide="zap"></i>
                </button>
            </div>

            <div class="review-actions" id="review-controls" style="display: none;">
                <button class="review-btn-retry" onclick="App.retryCapture()">
                    <i data-lucide="rotate-ccw" style="width: 18px; vertical-align: middle; margin-right: 8px;"></i> Retry
                </button>
                <button class="review-btn-ok" onclick="App.confirmCapture()">
                    OK <i data-lucide="check" style="width: 18px; vertical-align: middle; margin-left: 8px;"></i>
                </button>
            </div>

            <input type="file" id="gallery-input" style="display: none;" accept="image/*" onchange="App.handleGalleryUpload(event)">
            <canvas id="camera-canvas" style="display: none;"></canvas>
        `;
        document.body.appendChild(overlay);
        lucide.createIcons();

        const constraints = { 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 } 
            } 
        };

        navigator.mediaDevices.getUserMedia(constraints)
            .then(s => { 
                const video = document.getElementById('camera-video');
                if (video) video.srcObject = s; 
                this.activeStream = s; 
            })
            .catch(err => {
                console.error("Camera Error:", err);
                this.showToast("Cannot access camera. Check permissions.", "error");
                overlay.remove();
            });
    },

    toggleFlash() {
        const track = this.activeStream?.getVideoTracks()[0];
        if (track && track.getCapabilities()?.torch) {
            const current = track.getSettings().torch;
            track.applyConstraints({ advanced: [{ torch: !current }] });
        } else {
            this.showToast("Flash not supported on this device", "info");
        }
    },

    stopCamera() { 
        if (this.activeStream) {
            this.activeStream.getTracks().forEach(t => t.stop()); 
            this.activeStream = null;
        }
        document.getElementById('camera-overlay')?.remove(); 
    },

    takePhoto() {
        const video = document.getElementById('camera-video');
        const canvas = document.getElementById('camera-canvas');
        const preview = document.getElementById('capture-preview');
        const captureControls = document.getElementById('capture-controls');
        const reviewControls = document.getElementById('review-controls');
        const mask = document.getElementById('camera-mask');

        if (!video || !canvas) return;

        // Freeze frame
        canvas.width = video.videoWidth; 
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        this.state.tempImage = imageData;
        
        // Show review UI
        preview.src = imageData;
        preview.style.display = 'block';
        captureControls.style.display = 'none';
        reviewControls.style.display = 'flex';
        mask.style.display = 'none';

        // Provide haptic-like feedback
        if (navigator.vibrate) navigator.vibrate(50);
    },

    retryCapture() {
        const preview = document.getElementById('capture-preview');
        const captureControls = document.getElementById('capture-controls');
        const reviewControls = document.getElementById('review-controls');
        const mask = document.getElementById('camera-mask');

        preview.style.display = 'none';
        captureControls.style.display = 'flex';
        reviewControls.style.display = 'none';
        mask.style.display = 'block';
    },

    confirmCapture() {
        this.stopCamera(); 
        this.renderScreen('crop');
    },

    handleGalleryUpload(e) {
        if (!e.target.files || !e.target.files[0]) return;
        const reader = new FileReader();
        reader.onload = (ev) => { 
            this.state.tempImage = ev.target.result; 
            this.stopCamera(); 
            this.renderScreen('crop'); 
        };
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
        const img = this.cropper.getCroppedCanvas({ maxWidth: 600 }).toDataURL('image/jpeg', 0.6);
        this.cropper.destroy(); 
        
        this.showModal(
            'Attach Context',
            'Would you like to add any notes to this lead before saving?',
            [
                { id: 'notes', type: 'textarea', label: 'Context / Comments (Optional)', placeholder: 'E.g., Wants to schedule a callback next week...' }
            ],
            (data) => {
                this.processImage(img, data.notes);
            },
            'Capture Lead'
        );
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
            result.phone = result.phone || result.primary_phone || result.primary || '';
            result.secondaryPhone = result.secondaryPhone || result.secondary_phone || result.secondary || '';
            
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
            secondaryPhone: document.getElementById('field-secondaryPhone').value,
            email: document.getElementById('field-email').value,
            notes: document.getElementById('field-notes').value
        };
        if (c) {
            const idx = this.state.contacts.findIndex(x => x.id === c.id);
            if (idx !== -1) {
                this.state.contacts[idx] = { ...this.state.contacts[idx], ...data };
                if (window.Cloud) window.Cloud.saveContact(this.state.contacts[idx]);
            }
        } else {
            const newContact = { ...data, id: 'c_'+Date.now(), timestamp: Date.now(), status: 'Updated' };
            this.state.contacts.unshift(newContact);
            if (window.Cloud) window.Cloud.saveContact(newContact);
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
            document.getElementById('field-secondaryPhone').value = c.secondaryPhone || '';
            document.getElementById('field-email').value = c.email || '';
            document.getElementById('field-notes').value = c.notes || '';
            document.getElementById('review-image-preview').src = c.image || '';
        }, 100);
    },

    handleAction(t, v) { 
        if (!v) return; 
        if (t==='call') window.location.href=`tel:${v.replace(/\s/g,'')}`; 
        if (t==='whatsapp') window.open(`https://wa.me/${v.replace(/\D/g,'')}`); 
        if (t==='email') window.location.href=`mailto:${v}`;
    },

    handleContactAction(type, id) {
        const c = this.state.contacts.find(x => x.id === id);
        if (!c) return;
        
        if (type === 'email') return this.handleAction('email', c.email);

        // If both numbers exist, show choice modal (Specialized Layout)
        if (c.phone && c.secondaryPhone) {
            const overlay = document.createElement('div');
            overlay.className = 'biz-modal-overlay animate__animated animate__fadeIn';
            overlay.innerHTML = `
                <div class="biz-modal animate__animated animate__zoomIn" style="max-width: 320px; text-align: center;">
                    <div style="background: var(--accent)11; color: var(--accent); width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                        <i data-lucide="${type === 'call' ? 'phone' : 'message-circle'}"></i>
                    </div>
                    <h3 style="margin-bottom: 10px; font-family: 'Outfit';">Choose Number</h3>
                    <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 25px;">Which number would you like to ${type === 'call' ? 'call' : 'message'}?</p>
                    
                    <button class="btn-primary" style="width: 100%; margin-bottom: 12px; background: var(--bg-tertiary); color: #fff; border: 1px solid var(--glass-border);" 
                            onclick="this.closest('.biz-modal-overlay').remove(); App.handleAction('${type}', '${c.phone}')">
                        Primary: ${c.phone}
                    </button>
                    <button class="btn-primary" style="width: 100%; margin-bottom: 20px; background: var(--bg-tertiary); color: #fff; border: 1px solid var(--glass-border);" 
                            onclick="this.closest('.biz-modal-overlay').remove(); App.handleAction('${type}', '${c.secondaryPhone}')">
                        Secondary: ${c.secondaryPhone}
                    </button>
                    
                    <button class="btn-secondary" style="width: 100%; background: none; border: none; font-size: 13px; opacity: 0.6;" onclick="this.closest('.biz-modal-overlay').remove()">Cancel</button>
                </div>
            `;
            document.body.appendChild(overlay);
            if (window.lucide) lucide.createIcons();
        } else {
            this.handleAction(type, c.phone || c.secondaryPhone);
        }
    },

    downloadVCF(id) {
        const c = this.state.contacts.find(x => x.id === id);
        if (!c) return;
        
        const safeString = (s) => (s || '').replace(/\n/g, '\\n').replace(/,/g, '\\,');
        
        const vcfText = `BEGIN:VCARD
VERSION:3.0
N:;${safeString(c.name || 'Unknown')};;;
FN:${safeString(c.name || 'Unknown')}
ORG:${safeString(c.company)}
TITLE:${safeString(c.designation)}
TEL;TYPE=CELL:${safeString(c.phone)}
${c.secondaryPhone ? `TEL;TYPE=WORK:${safeString(c.secondaryPhone)}` : ''}
EMAIL;TYPE=WORK:${safeString(c.email)}
NOTE:Captured via Bizconnex Scanner at ${safeString(c.eventName || 'Event')}. Notes: ${safeString(c.notes)}
END:VCARD`;
        
        // Final Bug 4 Fix: Use Data URI and direct assignment to trigger OS Contact app integration
        const uri = 'data:text/vcard;charset=utf-8,' + encodeURIComponent(vcfText);
        window.location.assign(uri);
        this.showToast('Opening Contact Card...');
    },

    async deleteUser(id) {
        this.showModal(
            'Delete User',
            'Are you sure you want to delete this user? This cannot be undone.',
            [], 
            async () => {
                try {
                    this.showToast('Deleting user...', 'info');
                    if (window.Cloud) {
                        await window.Cloud.deleteUser(id);
                    } else {
                        throw new Error('Cloud Bridge offline');
                    }
                    this.state.users = this.state.users.filter(u => u.id !== id);
                    localStorage.setItem('bizconnex_users', JSON.stringify(this.state.users));
                    this.showToast('User deleted successfully');
                    this.renderScreen('userManager');
                } catch (err) {
                    console.error('App: Delete User Error:', err);
                    this.showToast(`Error: ${err.message}`, 'error');
                }
            },
            'Delete User'
        );
    },
    async deleteEvent(id) {
        this.showModal(
            'Delete Trade Show',
            'Are you sure? All authorized user links for this event will be removed.',
            [],
            async () => {
                try {
                    this.showToast('Deleting event...', 'info');
                    if (window.Cloud) {
                        await window.Cloud.deleteEvent(id);
                    } else {
                        throw new Error('Cloud Bridge offline');
                    }
                    this.state.events = this.state.events.filter(e => e.id !== id);
                    localStorage.setItem('bizconnex_events', JSON.stringify(this.state.events));
                    this.showToast('Event deleted successfully');
                    this.renderScreen('eventManager');
                } catch (err) {
                    console.error('App: Delete Event Error:', err);
                    this.showToast(`Error: ${err.message}`, 'error');
                }
            },
            'Delete Event'
        );
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
        toast.innerHTML = `<i data-lucide="${status === 'info' ? 'info' : (status === 'success' ? 'check-circle' : 'alert-circle')}"></i> <span>${msg}</span>`;
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
    showModal(title, message, fields, callback, submitLabel = 'Confirm') {
        const overlay = document.createElement('div');
        overlay.className = 'biz-modal-overlay animate__animated animate__fadeIn';
        overlay.innerHTML = `
            <div class="biz-modal animate__animated animate__zoomIn">
                <h2 style="margin-bottom: 5px;">${title}</h2>
                ${message ? `<p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.5;">${message}</p>` : ''}
                <div id="modal-fields-container" style="margin-top: 10px;">
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
                </div>
                <div class="biz-modal-actions">
                    <button class="btn-secondary" style="flex: 1;" onclick="this.closest('.biz-modal-overlay').remove()">Cancel</button>
                    <button class="btn-primary" style="flex: 1;" id="modal-submit">${submitLabel}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        if (window.lucide) lucide.createIcons();
        const submit = overlay.querySelector('#modal-submit');
        submit.onclick = async () => {
            const results = {};
            fields.forEach(f => {
                if (f.type === 'multiselect') {
                    results[f.id] = Array.from(overlay.querySelectorAll(`input[name="modal-multi-${f.id}"]:checked`)).map(cb => cb.value);
                } else {
                    const el = document.getElementById(`modal-field-${f.id}`);
                    if (el) results[f.id] = el.value;
                }
            });
            overlay.remove();
            await callback(results);
        };
    },

    // --- Business Logic ---
    async deleteContact(id) {
        console.log('App: Initiating Delete for ID:', id);
        this.showModal(
            'Delete Contact',
            'Are you sure you want to delete this contact? It will be removed from your phone and the cloud sync immediately.',
            [],
            async () => {
                try {
                    this.showToast('Deleting from cloud...', 'info');

                    // 1. Cloud Wipe
                    if (window.Cloud && typeof window.Cloud.deleteContact === 'function') {
                        console.log('App: Cloud Bridge Active. Executing Remote Delete...');
                        await window.Cloud.deleteContact(id);
                    } else {
                        console.error('App: Cloud Bridge Missing!', window.Cloud);
                        throw new Error('Cloud Server Unreachable. Check initialization.');
                    }

                    // 2. Local Wipe
                    this.state.contacts = this.state.contacts.filter(c => c.id !== id);
                    localStorage.setItem('bizconnex_contacts', JSON.stringify(this.state.contacts));
                    
                    this.showToast('Contact deleted successfully');
                    this.renderScreen(this.state.currentScreen); 
                    
                } catch (err) {
                    console.error('App: Delete Contact Critical Failure:', err);
                    this.showToast(`Error: ${err.message}`, 'error');
                }
            },
            'Delete Now'
        );
    },

    exportToExcel() {
        const data = this.state.contacts.map(c => ({ 
            'Name': c.name, 
            'Company': c.company, 
            'Designation': c.designation || '',
            'Primary Phone': c.phone, 
            'Secondary Phone': c.secondaryPhone || '',
            'Email': c.email, 
            'Event': c.eventName, 
            'Notes': c.notes 
        }));
        const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Contacts"); XLSX.writeFile(wb, `Bizconnex_Contacts_${Date.now()}.xlsx`);
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
        this.showModal(
            'Emergency Reset',
            'DANGER: This will wipe all local data, clear your card queue, and sign you out immediately. This cannot be undone.',
            [],
            async () => {
                localStorage.clear();
                window.location.reload();
            },
            'Reset Everything'
        );
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

    async syncCloud() {
        if (window.FirebaseDB && window.db) {
            const { ref, onValue } = window.FirebaseDB;
            onValue(ref(window.db, 'events_v1'), snapshot => {
                if (snapshot.exists()) {
                    this.state.events = Object.values(snapshot.val()).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
                    localStorage.setItem('bizconnex_events', JSON.stringify(this.state.events));
                    // Reactive Refresh
                    if (this.state.currentScreen === 'eventSelect') this.renderScreen('eventSelect');
                    if (this.state.currentScreen === 'home') this.renderScreen('home');
                }
            });
            onValue(ref(window.db, 'users_v1'), snapshot => {
                if (snapshot.exists()) {
                    const allUsers = Object.values(snapshot.val());
                    this.state.users = allUsers;
                    localStorage.setItem('bizconnex_users', JSON.stringify(this.state.users));
                    
                    // REAKTIVE SYNC: Refresh currentUser profile if it changed
                    if (this.state.currentUser) {
                        const updated = allUsers.find(u => this.normalizeMobile(u.mobile) === this.normalizeMobile(this.state.currentUser.mobile));
                        if (updated) {
                            // Check if new events assigned
                            const oldEvents = (this.state.currentUser.assignedEvents || []).length;
                            const newEvents = (updated.assignedEvents || []).length;
                            
                            if (newEvents > oldEvents) {
                                this.addNotification('New Event Assigned', 'A new trade show has been assigned to your profile.');
                                this.showToast('Permissions Updated', 'info');
                            }
                            
                            this.state.currentUser = updated;
                            localStorage.setItem('bizconnex_user', JSON.stringify(updated));
                        }
                    }

                    // Reactive Refresh
                    if (this.state.currentScreen === 'eventSelect') this.renderScreen('eventSelect');
                }
            });
            onValue(ref(window.db, 'contacts_v1'), snapshot => {
                if (snapshot.exists()) {
                    const cloudContacts = Object.values(snapshot.val());
                    cloudContacts.forEach(cc => {
                        const idx = this.state.contacts.findIndex(c => c.id === cc.id);
                        if (idx !== -1) this.state.contacts[idx] = cc;
                        else this.state.contacts.unshift(cc);
                    });
                    this.state.contacts.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
                    localStorage.setItem('bizconnex_contacts', JSON.stringify(this.state.contacts));
                    if (this.state.currentScreen === 'home') this.renderScreen('home');
                }
            });
        }
    },

    normalizeMobile(mobile) {
        if (!mobile) return '';
        const digits = mobile.toString().replace(/\D/g, '');
        // For robust matching, prioritize matching the last 10 digits to ignore country codes
        return digits.length >= 10 ? digits.slice(-10) : digits;
    }
};

// --- GLOBAL EXPOSURE (Crucial for HTML onclick handlers) ---
window.App = App;

// Boot
App.init();
