/**
 * Liquid Premium - Firebase Global Cloud Bridge (v7.1)
 * Status: LIVE - Realtime Database Active
 */

// Import Firebase SDKs from CDN (Realtime Database Version)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.18.0/firebase-app.js";
import { getDatabase, ref, set, get, child, onValue, push, remove } from "https://www.gstatic.com/firebasejs/9.18.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCiLm9GG-yX6HF8TDEwimYg2wi5VkhPFlE",
  authDomain: "liquid-scanner.firebaseapp.com",
  databaseURL: "https://liquid-scanner-default-rtdb.firebaseio.com",
  projectId: "liquid-scanner",
  storageBucket: "liquid-scanner.firebasestorage.app",
  messagingSenderId: "12237358075",
  appId: "1:12237358075:web:db9b371b5b09f6a014415e",
  measurementId: "G-PPFGSFQVGY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Global Cloud Registry
const Cloud = {
    isSimulationMode: false,

    // --- Events Sync ---
    async saveEvent(event) {
        console.log('Cloud RTDB: Syncing Event...', event.name);
        try {
            await set(ref(db, 'events_v1/' + event.id), event);
            return event;
        } catch (e) {
            console.error("Cloud: RTDB Save Error", e);
            throw e;
        }
    },

    async getEvents() {
        console.log('Cloud RTDB: Fetching Global Events...');
        try {
            const snapshot = await get(child(ref(db), 'events_v1'));
            if (snapshot.exists()) {
                const data = snapshot.val();
                return Object.values(data).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
            } else {
                return [];
            }
        } catch (e) {
            console.error("Cloud: RTDB Fetch Error", e);
            return [];
        }
    },

    // --- Contacts Sync ---
    async saveContact(contact) {
        console.log('Cloud RTDB: Syncing Contact...', contact.name);
        try {
            await set(ref(db, 'contacts_v1/' + contact.id), contact);
            return contact;
        } catch (e) {
            console.error("Cloud: RTDB Save Error", e);
            throw e;
        }
    },

    async getContacts() {
        try {
            const snapshot = await get(child(ref(db), 'contacts_v1'));
            if (snapshot.exists()) {
                const data = snapshot.val();
                return Object.values(data).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
            } else {
                return [];
            }
        } catch (e) {
            console.error("Cloud: RTDB Fetch Contact Error", e);
            return [];
        }
    },

    // --- Users Sync ---
    async saveUser(user) {
        console.log('Cloud RTDB: Syncing User...', user.mobile);
        try {
            await set(ref(db, 'users_v1/' + user.id), user);
            return user;
        } catch (e) {
            console.error("Cloud: RTDB Save User Error", e);
            throw e;
        }
    },

    async getUsers() {
        try {
            const snapshot = await get(child(ref(db), 'users_v1'));
            if (snapshot.exists()) {
                const data = snapshot.val();
                return Object.values(data);
            } else {
                return [];
            }
        } catch (e) {
            console.error("Cloud: RTDB Fetch User Error", e);
            return [];
        }
    },

    // --- Deletion Sync ---
    async deleteEvent(id) {
        console.log('Cloud RTDB: Removing Event...', id);
        try {
            await remove(ref(db, 'events_v1/' + id));
            return true;
        } catch (e) {
            console.error("Cloud: RTDB Delete Event Error", e);
            throw e;
        }
    },

    async deleteUser(id) {
        console.log('Cloud RTDB: Removing User...', id);
        try {
            await remove(ref(db, 'users_v1/' + id));
            return true;
        } catch (e) {
            console.error("Cloud: RTDB Delete User Error", e);
            throw e;
        }
    }
};

// Export for global access
window.Cloud = Cloud;
window.db = db;
window.FirebaseDB = { onValue, ref, remove, get, child, set, push };
