#!/bin/bash

# MultiGig Bot - Docker Build and Run Script
# This script builds the Docker image and runs the container with proper configuration

set -e  # Exit on any error

# Configuration
IMAGE_NAME="multigig-bot"
CONTAINER_NAME="multigig-bot-container"
CONFIG_FILE="config/config.json"
EXAMPLE_CONFIG="config/config.example.json"

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

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Function to check configuration
check_config() {
    if [ ! -f "$CONFIG_FILE" ]; then
        print_warning "Configuration file $CONFIG_FILE not found."
        if [ -f "$EXAMPLE_CONFIG" ]; then
            print_status "Copying example configuration..."
            cp "$EXAMPLE_CONFIG" "$CONFIG_FILE"
            print_warning "Please edit $CONFIG_FILE with your actual configuration before running the container."
            print_warning "Update the following fields:"
            echo "  - discord.webhookUrl"
            echo "  - discord.alertwebhookUrl"
            echo "  - influxdb.host"
            echo "  - influxdb.token"
            echo ""
            read -p "Press Enter to continue once you've updated the configuration..."
        else
            print_error "No configuration file or example found. Please create $CONFIG_FILE"
            exit 1
        fi
    fi
}

# Function to build Docker image
build_image() {
    print_header "Building Docker Image"
    print_status "Building image: $IMAGE_NAME"

    if docker build -t "$IMAGE_NAME" .; then
        print_status "Docker image built successfully!"
    else
        print_error "Failed to build Docker image"
        exit 1
    fi
}

# Function to stop and remove existing container
cleanup_container() {
    if docker ps -a --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        print_status "Stopping and removing existing container: $CONTAINER_NAME"
        docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
        docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
    fi
}

# Function to run the container
run_container() {
    print_header "Running Container"

    # Check if we should use environment variables or config file
    if [ "$USE_ENV_VARS" = "true" ]; then
        print_status "Running container with environment variables..."
        print_warning "Make sure you have set the following environment variables:"
        echo "  - DISCORD_ALERT_WEBHOOK_URL"
        echo "  - INFLUXDB_HOST"
        echo "  - INFLUXDB_TOKEN"
        echo ""

        docker run -d \
            --name "$CONTAINER_NAME" \
            --restart unless-stopped \
            -e DISCORD_WEBHOOK_URL \
            -e DISCORD_ALERT_WEBHOOK_URL \
            -e DISCORD_BOT_USERNAME \
            -e DISCORD_BOT_AVATAR_URL \
            -e INFLUXDB_HOST \
            -e INFLUXDB_PORT \
            -e INFLUXDB_PROTOCOL \
            -e INFLUXDB_DATABASE \
            -e INFLUXDB_USERNAME \
            -e INFLUXDB_PASSWORD \
            -e INFLUXDB_TOKEN \
            -e CRON_SCHEDULE \
            "$IMAGE_NAME"
    else
        print_status "Running container with config file..."

        # Create volume mounts for config (read-only) and data (writable)
        docker run -d \
            --name "$CONTAINER_NAME" \
            --restart unless-stopped \
            -v "$(pwd)/config:/usr/src/app/config:ro" \
            -v "multigig-data:/tmp" \
            "$IMAGE_NAME"
    fi

    if [ $? -eq 0 ]; then
        print_status "Container started successfully!"
        print_status "Container name: $CONTAINER_NAME"
        print_status "View logs with: docker logs -f $CONTAINER_NAME"
        print_status "Stop container with: docker stop $CONTAINER_NAME"
    else
        print_error "Failed to start container"
        exit 1
    fi
}

# Function to show container status
show_status() {
    print_header "Container Status"

    if docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -q "$CONTAINER_NAME"; then
        print_status "Container is running:"
        docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}' | grep "$CONTAINER_NAME"
        echo ""
        print_status "Recent logs:"
        docker logs --tail 10 "$CONTAINER_NAME"
    else
        print_warning "Container is not running"
        if docker ps -a --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            print_status "Container exists but is stopped. Status:"
            docker ps -a --format 'table {{.Names}}\t{{.Status}}' | grep "$CONTAINER_NAME"
        fi
    fi
}

# Function to show help
show_help() {
    echo "MultiGig Bot Docker Management Script"
    echo ""
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  build       Build the Docker image only"
    echo "  run         Run the container (builds image if needed)"
    echo "  rebuild     Force rebuild the image and run container"
    echo "  stop        Stop the running container"
    echo "  restart     Restart the container"
    echo "  logs        Show container logs"
    echo "  status      Show container status"
    echo "  cleanup     Stop and remove container and image"
    echo "  env         Run with environment variables (set USE_ENV_VARS=true)"
    echo "  test-errors Run with error logging test mode enabled"
    echo "  test-mode   Run in test mode (alerts go to alertwebhookUrl)"
    echo "  test-all    Run with all test modes enabled"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 run                    # Build and run with config file"
    echo "  USE_ENV_VARS=true $0 run  # Run with environment variables"
    echo "  $0 logs                   # View container logs"
    echo "  $0 test-errors            # Test error logging to Discord"
    echo "  $0 test-mode              # Run with alerts going to test channel"
    echo "  $0 test-all               # Run with all test modes enabled"
    echo "  $0 cleanup                # Clean up everything"
}

# Main script logic
main() {
    case "${1:-run}" in
        "build")
            check_docker
            build_image
            ;;
        "run")
            check_docker
            check_config

            # Build image if it doesn't exist
            if ! docker images | grep -q "^${IMAGE_NAME}"; then
                build_image
            fi

            cleanup_container
            run_container
            show_status
            ;;
        "rebuild")
            check_docker
            check_config
            print_status "Force rebuilding image..."
            docker rmi "$IMAGE_NAME" >/dev/null 2>&1 || true
            build_image
            cleanup_container
            run_container
            show_status
            ;;
        "stop")
            print_status "Stopping container: $CONTAINER_NAME"
            docker stop "$CONTAINER_NAME" || print_warning "Container may not be running"
            ;;
        "restart")
            print_status "Restarting container: $CONTAINER_NAME"
            docker restart "$CONTAINER_NAME" || print_error "Failed to restart container"
            ;;
        "logs")
            if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
                print_status "Following logs for: $CONTAINER_NAME (Ctrl+C to exit)"
                docker logs -f "$CONTAINER_NAME"
            else
                print_status "Showing recent logs for: $CONTAINER_NAME"
                docker logs --tail 50 "$CONTAINER_NAME" 2>/dev/null || print_error "Container not found"
            fi
            ;;
        "status")
            show_status
            ;;
        "cleanup")
            print_header "Cleaning Up"
            print_status "Stopping and removing container..."
            docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
            docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
            print_status "Removing image..."
            docker rmi "$IMAGE_NAME" >/dev/null 2>&1 || true
            print_status "Cleanup complete!"
            ;;
        "env")
            export USE_ENV_VARS=true
            check_docker

            # Build image if it doesn't exist
            if ! docker images | grep -q "^${IMAGE_NAME}"; then
                build_image
            fi

            cleanup_container
            run_container
            show_status
            ;;
        "test-errors")
            check_docker
            check_config

            # Build image if it doesn't exist
            if ! docker images | grep -q "^${IMAGE_NAME}"; then
                build_image
            fi

            cleanup_container
            print_status "Running container with error logging test enabled..."

            docker run -d \
                --name "$CONTAINER_NAME" \
                --restart unless-stopped \
                -v "$(pwd)/config:/usr/src/app/config:ro" \
                -v "multigig-data:/tmp" \
                -e TEST_ERROR_LOGGING=true \
                "$IMAGE_NAME"

            show_status
            print_status "Error logging test mode enabled. Check Discord for test messages."
            ;;
        "test-mode")
            check_docker
            check_config

            # Build image if it doesn't exist
            if ! docker images | grep -q "^${IMAGE_NAME}"; then
                build_image
            fi

            cleanup_container
            print_status "Running container in test mode (alerts go to alertwebhookUrl)..."

            docker run -d \
                --name "$CONTAINER_NAME" \
                --restart unless-stopped \
                -v "$(pwd)/config:/usr/src/app/config:ro" \
                -v "multigig-data:/tmp" \
                -e TEST_MODE=true \
                "$IMAGE_NAME"

            show_status
            print_status "Test mode enabled. All celebration alerts will go to alertwebhookUrl."
            ;;
        "test-all")
            check_docker
            check_config

            # Build image if it doesn't exist
            if ! docker images | grep -q "^${IMAGE_NAME}"; then
                build_image
            fi

            cleanup_container
            print_status "Running container with ALL test modes enabled..."

            docker run -d \
                --name "$CONTAINER_NAME" \
                --restart unless-stopped \
                -v "$(pwd)/config:/usr/src/app/config:ro" \
                -v "multigig-data:/tmp" \
                -e TEST_MODE=true \
                -e TEST_ERROR_LOGGING=true \
                -e TEST_WEBHOOK=true \
                "$IMAGE_NAME"

            show_status
            print_status "All test modes enabled:"
            print_status "- Celebration alerts -> alertwebhookUrl"
            print_status "- Error logging test messages enabled"
            print_status "- Webhook test alert enabled"
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
