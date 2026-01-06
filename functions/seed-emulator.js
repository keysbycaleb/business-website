/**
 * Seed script for Firebase Emulator
 * Run this after starting emulators to populate test data
 * Usage: node seed-emulator.js
 */

const admin = require('firebase-admin');

// Connect to emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:9199';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

// Initialize without credentials (emulator mode)
admin.initializeApp({ projectId: 'lanting-digital-website' });

const db = admin.firestore();
const auth = admin.auth();

async function seedData() {
    console.log('Seeding emulator with test data...\n');

    // Create admin user
    try {
        const adminUser = await auth.createUser({
            email: 'caleb@lantingdigital.com',
            password: 'admin123',
            displayName: 'Caleb Lanting',
            emailVerified: true
        });
        console.log('✓ Created admin user:', adminUser.email);
    } catch (e) {
        if (e.code === 'auth/email-already-exists') {
            console.log('✓ Admin user already exists');
        } else {
            console.error('Error creating admin:', e.message);
        }
    }

    // Create test client user
    try {
        const clientUser = await auth.createUser({
            email: 'testclient@example.com',
            password: 'client123',
            displayName: 'Test Client',
            emailVerified: true
        });
        console.log('✓ Created test client user:', clientUser.email);
    } catch (e) {
        if (e.code === 'auth/email-already-exists') {
            console.log('✓ Test client user already exists');
        } else {
            console.error('Error creating client:', e.message);
        }
    }

    // Create client record in Firestore (this bypasses security rules)
    try {
        await db.collection('clients').doc('test-client-1').set({
            email: 'testclient@example.com',
            name: 'Test Client',
            company: 'Test Company LLC',
            phone: '555-123-4567',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            hasPortalAccess: true,
            notes: 'Test client for local development'
        });
        console.log('✓ Created client record in Firestore');
    } catch (e) {
        console.error('Error creating client record:', e.message);
    }

    // Create portal settings
    try {
        await db.collection('settings').doc('portal').set({
            enabled: true,
            maintenanceMode: false,
            features: {
                contracts: true,
                projects: true,
                messages: true,
                invoices: true
            }
        });
        console.log('✓ Created portal settings');
    } catch (e) {
        console.error('Error creating settings:', e.message);
    }

    console.log('\n✅ Seeding complete!\n');
    console.log('Test Credentials:');
    console.log('  Admin:  caleb@lantingdigital.com / admin123');
    console.log('  Client: testclient@example.com / client123');
    console.log('\nPortal URL: http://127.0.0.1:9407');
    console.log('Admin URL:  http://127.0.0.1:9404');

    process.exit(0);
}

seedData().catch(console.error);
