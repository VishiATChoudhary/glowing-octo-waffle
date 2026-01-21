#!/bin/bash
#
# Run all tests for Pipeline Runner
#
# Usage:
#   ./run_tests.sh           # Run all tests
#   ./run_tests.sh unit      # Run unit tests only
#   ./run_tests.sh integration  # Run integration tests only
#   ./run_tests.sh e2e       # Run E2E test (starts server)
#   ./run_tests.sh coverage  # Run with coverage report
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

# Check dependencies
check_deps() {
    if ! python3 -c "import pytest" 2>/dev/null; then
        echo -e "${YELLOW}Installing test dependencies...${NC}"
        pip3 install -q pytest pytest-cov
    fi
}

case "${1:-all}" in
    unit)
        print_header "Running Unit Tests"
        check_deps
        python3 -m pytest test_unit.py -v "$@"
        ;;
    integration)
        print_header "Running Integration Tests"
        check_deps
        python3 -m pytest test_integration.py -v "$@"
        ;;
    e2e)
        print_header "Running End-to-End Test"
        shift 2>/dev/null || true
        ./run_test.sh "$@"
        ;;
    coverage)
        print_header "Running Tests with Coverage"
        check_deps
        python3 -m pytest test_unit.py test_integration.py \
            --cov=main --cov=storage \
            --cov-report=term-missing \
            --cov-report=html:coverage_report \
            -v
        echo -e "\n${GREEN}Coverage report generated in coverage_report/index.html${NC}"
        ;;
    all)
        print_header "Running All Tests"
        check_deps
        python3 -m pytest test_unit.py test_integration.py -v
        ;;
    *)
        echo "Usage: $0 [unit|integration|e2e|coverage|all]"
        echo ""
        echo "Commands:"
        echo "  unit        Run unit tests only"
        echo "  integration Run integration tests only"
        echo "  e2e         Run end-to-end test (starts server)"
        echo "  coverage    Run tests with coverage report"
        echo "  all         Run all unit and integration tests (default)"
        exit 1
        ;;
esac
