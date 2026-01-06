#!/bin/bash
# Start Firebase emulators for local development
# Usage: ./start-dev.sh

cd "$(dirname "$0")"

echo "=========================================="
echo "  Lanting Digital - Local Development"
echo "=========================================="
echo ""
echo "Starting Firebase emulators..."
echo ""

# Start emulators in background
firebase emulators:start &
EMULATOR_PID=$!

# Wait for emulators to be ready
echo "Waiting for emulators to start..."
sleep 12

# Run seed script from functions directory
echo ""
echo "Seeding test data..."
cd functions && node seed-emulator.js
cd ..

echo ""
echo "=========================================="
echo "  Local Development URLs"
echo "=========================================="
echo "  Portal:      http://127.0.0.1:9407"
echo "  Admin:       http://127.0.0.1:9404"
echo "  Emulator UI: http://127.0.0.1:9499"
echo ""
echo "  Test Credentials:"
echo "    Admin:  caleb@lantingdigital.com / admin123"
echo "    Client: testclient@example.com / client123"
echo ""
echo "  Press Ctrl+C to stop"
echo "=========================================="
echo ""

# Wait for emulator process
wait $EMULATOR_PID
