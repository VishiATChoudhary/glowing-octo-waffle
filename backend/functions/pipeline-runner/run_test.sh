#!/bin/bash
#
# Run Pipeline End-to-End Test
#
# This script:
# 1. Installs dependencies
# 2. Starts the server in the background
# 3. Runs the E2E test
# 4. Cleans up the server process
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT=8081
SERVER_PID=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

cleanup() {
    if [ -n "$SERVER_PID" ]; then
        echo -e "\n${YELLOW}Stopping server (PID: $SERVER_PID)...${NC}"
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    fi
}

trap cleanup EXIT

echo -e "${GREEN}=== Pipeline Runner E2E Test ===${NC}"
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python 3 is required${NC}"
    exit 1
fi

# Install dependencies if needed
echo -e "${YELLOW}Checking dependencies...${NC}"
if ! python3 -c "import functions_framework" 2>/dev/null; then
    echo "Installing dependencies..."
    pip3 install -r requirements.txt
fi

# Clear old data for clean test
echo -e "${YELLOW}Clearing old test data...${NC}"
rm -rf data/*.json 2>/dev/null || true

# Start the server in background
echo -e "${YELLOW}Starting server on port $PORT...${NC}"
python3 -m functions_framework --target=main_handler --port=$PORT &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server to start..."
for i in {1..30}; do
    if curl -s "http://localhost:$PORT/pipeline-runner" -X OPTIONS > /dev/null 2>&1; then
        echo -e "${GREEN}Server is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}Server failed to start${NC}"
        exit 1
    fi
    sleep 1
done

echo ""

# Run the test
echo -e "${YELLOW}Running E2E test...${NC}"
echo ""

python3 test_e2e.py --url "http://localhost:$PORT" "$@"
TEST_EXIT_CODE=$?

echo ""
echo -e "${GREEN}=== Test Complete ===${NC}"

exit $TEST_EXIT_CODE
