#!/bin/bash

# MultiGig Bot - Maintenance and Cleanup Script
# This script helps maintain the bot and clean up development artifacts

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}==== $1 ====${NC}"
}

# Function to clean up test files
cleanup_test_files() {
    print_header "Cleaning Up Test Files"

    # Remove any test files that might have been created
    test_files=(
        "test-*.js"
        "webhook-test.js"
        "test-influxdb.js"
        "test-queries.js"
        "test-http-service.js"
    )

    for pattern in "${test_files[@]}"; do
        if ls $pattern 1> /dev/null 2>&1; then
            print_status "Removing test files matching: $pattern"
            rm -f $pattern
        fi
    done

    # Remove any temporary directories
    if [ -d "temp" ]; then
        print_status "Removing temp directory"
        rm -rf temp
    fi

    if [ -d "tmp" ]; then
        print_status "Removing tmp directory"
        rm -rf tmp
    fi

    print_status "Test file cleanup complete"
}

# Function to validate configuration
validate_config() {
    print_header "Validating Configuration"

    if [ ! -f "config/config.json" ]; then
        print_warning "No config/config.json found"
        if [ -f "config/config.example.json" ]; then
            print_status "config.example.json is available as template"
        else
            print_error "No configuration template found!"
            return 1
        fi
    else
        print_status "Configuration file exists"

        # Validate JSON syntax
        if command -v python3 &> /dev/null; then
            if python3 -m json.tool config/config.json > /dev/null 2>&1; then
                print_status "Configuration JSON syntax is valid"
            else
                print_error "Configuration JSON syntax is invalid!"
                return 1
            fi
        elif command -v jq &> /dev/null; then
            if jq . config/config.json > /dev/null 2>&1; then
                print_status "Configuration JSON syntax is valid"
            else
                print_error "Configuration JSON syntax is invalid!"
                return 1
            fi
        else
            print_warning "Cannot validate JSON syntax (python3 or jq not available)"
        fi

        # Check for placeholder values
        if grep -q "YOUR_" config/config.json; then
            print_warning "Configuration contains placeholder values (YOUR_*)"
        fi

        if grep -q "your-" config/config.json; then
            print_warning "Configuration contains template values (your-*)"
        fi
    fi

    print_status "Configuration validation complete"
}

# Function to clean up logs and runtime data
cleanup_runtime_data() {
    print_header "Cleaning Up Runtime Data"

    # Clean up log files
    if [ -d "logs" ]; then
        print_status "Removing log files"
        rm -rf logs
    fi

    # Clean up runtime state (but ask first)
    if [ -f "config/lastRuns.json" ]; then
        read -p "Remove runtime state file (config/lastRuns.json)? This will reset alert schedules. (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -f "config/lastRuns.json"
            print_status "Removed runtime state file"
        else
            print_status "Keeping runtime state file"
        fi
    fi

    # Clean up any .log files
    find . -name "*.log" -not -path "./node_modules/*" | while read -r logfile; do
        print_status "Removing log file: $logfile"
        rm -f "$logfile"
    done

    print_status "Runtime data cleanup complete"
}

# Function to update dependencies
update_dependencies() {
    print_header "Updating Dependencies"

    if [ -f "package.json" ]; then
        print_status "Updating npm dependencies"
        npm update

        # Check for security vulnerabilities
        if npm audit --audit-level moderate > /dev/null 2>&1; then
            print_status "No security vulnerabilities found"
        else
            print_warning "Security vulnerabilities detected. Run 'npm audit fix' to resolve."
        fi
    else
        print_error "No package.json found!"
        return 1
    fi

    print_status "Dependency update complete"
}

# Function to clean up Docker resources
cleanup_docker() {
    print_header "Cleaning Up Docker Resources"

    if ! command -v docker &> /dev/null; then
        print_warning "Docker not available, skipping Docker cleanup"
        return 0
    fi

    # Remove stopped containers
    if docker ps -a -q --filter "name=multigig-bot" | grep -q .; then
        print_status "Removing stopped MultiGig Bot containers"
        docker ps -a -q --filter "name=multigig-bot" | xargs docker rm -f 2>/dev/null || true
    fi

    # Remove unused images (ask first)
    if docker images -q "multigig-bot" | grep -q .; then
        read -p "Remove MultiGig Bot Docker images? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker images -q "multigig-bot" | xargs docker rmi -f 2>/dev/null || true
            print_status "Removed MultiGig Bot Docker images"
        fi
    fi

    # General Docker cleanup
    read -p "Run general Docker system cleanup? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker system prune -f
        print_status "Docker system cleanup complete"
    fi

    print_status "Docker cleanup complete"
}

# Function to check project health
health_check() {
    print_header "Project Health Check"

    # Check required files
    required_files=(
        "package.json"
        "src/index.js"
        "src/services/influxdb-http.js"
        "Dockerfile"
        "docker-compose.yml"
        "docker-build-run.sh"
    )

    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            print_status "✓ $file exists"
        else
            print_error "✗ $file missing!"
        fi
    done

    # Check alerts directory
    if [ -d "src/alerts" ]; then
        alert_count=$(find src/alerts -name "*.js" | wc -l)
        print_status "✓ Found $alert_count alert(s) in src/alerts/"
    else
        print_error "✗ src/alerts directory missing!"
    fi

    # Check for proper permissions on scripts
    if [ -x "docker-build-run.sh" ]; then
        print_status "✓ docker-build-run.sh is executable"
    else
        print_warning "⚠ docker-build-run.sh is not executable (run: chmod +x docker-build-run.sh)"
    fi

    if [ -x "maintenance.sh" ]; then
        print_status "✓ maintenance.sh is executable"
    else
        print_warning "⚠ maintenance.sh is not executable (run: chmod +x maintenance.sh)"
    fi

    print_status "Health check complete"
}

# Function to show help
show_help() {
    echo "MultiGig Bot Maintenance Script"
    echo ""
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  cleanup-test     Remove test files and temporary directories"
    echo "  cleanup-docs     Remove duplicate AGENT.md files"
    echo "  cleanup-runtime  Remove logs and runtime data"
    echo "  cleanup-docker   Clean up Docker containers and images"
    echo "  cleanup-all      Run all cleanup operations"
    echo "  validate-config  Check configuration file syntax and values"
    echo "  update-deps      Update npm dependencies"
    echo "  health-check     Check project structure and health"
    echo "  full-maintenance Run all maintenance operations"
    echo "  help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 cleanup-all       # Clean up everything"
    echo "  $0 health-check      # Check project health"
    echo "  $0 full-maintenance  # Complete maintenance run"
}

# Main script logic
main() {
    case "${1:-help}" in
        "cleanup-test")
            cleanup_test_files
            ;;
        "cleanup-docs")
            cleanup_agent_files
            ;;
        "cleanup-runtime")
            cleanup_runtime_data
            ;;
        "cleanup-docker")
            cleanup_docker
            ;;
        "cleanup-all")
            cleanup_test_files
            cleanup_runtime_data
            print_status "All cleanup operations complete"
            ;;
        "validate-config")
            validate_config
            ;;
        "update-deps")
            update_dependencies
            ;;
        "health-check")
            health_check
            ;;
        "full-maintenance")
            print_header "Full Maintenance Run"
            cleanup_test_files
            cleanup_agent_files
            health_check
            validate_config
            update_dependencies
            print_header "Full Maintenance Complete"
            print_status "Project is ready for production deployment"
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
