#!/bin/bash
echo "🔄 Restarting Expo with cleared cache..."
echo ""
echo "Stopping any running Expo processes..."
pkill -f "expo start" || true
pkill -f "node.*expo" || true
sleep 2
echo ""
echo "Clearing Expo cache..."
rm -rf .expo
rm -rf node_modules/.cache
echo ""
echo "Starting Expo with cleared cache..."
npm start -- --clear
