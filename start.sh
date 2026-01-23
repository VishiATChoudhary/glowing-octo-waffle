#!/bin/bash

# Start script for paperScraper - runs frontend and backend concurrently

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Store PIDs for cleanup
BACKEND_PID=""
FRONTEND_PID=""

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Shutting down...${NC}"

    if [ -n "$BACKEND_PID" ]; then
        echo -e "${BLUE}Stopping backend (PID: $BACKEND_PID)${NC}"
        kill $BACKEND_PID 2>/dev/null
    fi

    if [ -n "$FRONTEND_PID" ]; then
        echo -e "${BLUE}Stopping frontend (PID: $FRONTEND_PID)${NC}"
        kill $FRONTEND_PID 2>/dev/null
    fi

    # Kill any remaining child processes
    jobs -p | xargs -r kill 2>/dev/null

    echo -e "${GREEN}All services stopped.${NC}"
    exit 0
}

# Set up trap for cleanup on script termination
trap cleanup SIGINT SIGTERM EXIT

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Starting paperScraper Application   ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Start backend
echo -e "${BLUE}Starting backend on port 8082...${NC}"
cd "$SCRIPT_DIR/backend/functions/pipeline-runner"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Virtual environment not found. Creating one...${NC}"
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Start the backend in the background
functions-framework --target=main_handler --port=8082 &
BACKEND_PID=$!
echo -e "${GREEN}Backend started (PID: $BACKEND_PID)${NC}"

# Give backend a moment to start
sleep 2

# Start frontend
echo -e "${BLUE}Starting frontend on port 8080...${NC}"
cd "$SCRIPT_DIR/frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    npm install
fi

# Start the frontend in the background
npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}Frontend started (PID: $FRONTEND_PID)${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Application is running!             ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  Frontend: ${BLUE}http://localhost:8080${NC}"
echo -e "  Backend:  ${BLUE}http://localhost:8082${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for both processes
wait
