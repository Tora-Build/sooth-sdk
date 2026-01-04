#!/bin/bash
#
# Start all Sooth services
#
# Usage:
#   ./scripts/start-all.sh           # Start web + indexer
#   ./scripts/start-all.sh --web     # Start web only
#   ./scripts/start-all.sh --indexer # Start indexer only
#   ./scripts/start-all.sh --stop    # Stop all services
#

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$ROOT_DIR/.pids"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

mkdir -p "$PID_DIR"

start_web() {
  log_info "Starting web server..."
  cd "$ROOT_DIR/apps/web"
  
  if [ -f "$PID_DIR/web.pid" ] && kill -0 "$(cat "$PID_DIR/web.pid")" 2>/dev/null; then
    log_warn "Web server already running (PID: $(cat "$PID_DIR/web.pid"))"
    return
  fi
  
  pnpm dev > "$PID_DIR/web.log" 2>&1 &
  echo $! > "$PID_DIR/web.pid"
  log_success "Web server started (PID: $!, logs: .pids/web.log)"
  log_info "  → http://localhost:5173"
}

start_indexer() {
  log_info "Starting indexer..."
  cd "$ROOT_DIR/packages/indexer"
  
  # Check for .env
  if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
      log_warn "No .env found, copying from .env.example"
      cp .env.example .env
      log_warn "Please configure RPC URLs in packages/indexer/.env"
    else
      log_error "No .env or .env.example found in packages/indexer"
      return 1
    fi
  fi
  
  if [ -f "$PID_DIR/indexer.pid" ] && kill -0 "$(cat "$PID_DIR/indexer.pid")" 2>/dev/null; then
    log_warn "Indexer already running (PID: $(cat "$PID_DIR/indexer.pid"))"
    return
  fi
  
  pnpm dev > "$PID_DIR/indexer.log" 2>&1 &
  echo $! > "$PID_DIR/indexer.pid"
  log_success "Indexer started (PID: $!, logs: .pids/indexer.log)"
  log_info "  → http://localhost:42069"
}

stop_service() {
  local name=$1
  local pid_file="$PID_DIR/$name.pid"
  
  if [ -f "$pid_file" ]; then
    local pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
      log_success "Stopped $name (PID: $pid)"
    else
      log_warn "$name was not running"
    fi
    rm -f "$pid_file"
  else
    log_warn "No PID file for $name"
  fi
}

stop_all() {
  log_info "Stopping all services..."
  stop_service "web"
  stop_service "indexer"
  log_success "All services stopped"
}

show_status() {
  echo ""
  echo "═══════════════════════════════════════════"
  echo "  Sooth Services Status"
  echo "═══════════════════════════════════════════"
  
  for service in web indexer; do
    local pid_file="$PID_DIR/$service.pid"
    if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
      echo -e "  ${GREEN}●${NC} $service (PID: $(cat "$pid_file"))"
    else
      echo -e "  ${RED}○${NC} $service (not running)"
    fi
  done
  
  echo ""
  echo "  Logs: .pids/*.log"
  echo "  Stop: pnpm start:all --stop"
  echo "═══════════════════════════════════════════"
}

# Parse arguments
case "${1:-}" in
  --web)
    start_web
    ;;
  --indexer)
    start_indexer
    ;;
  --stop)
    stop_all
    ;;
  --status)
    show_status
    ;;
  *)
    # Start all
    echo ""
    echo "╔═══════════════════════════════════════════╗"
    echo "║       Starting Sooth Dev Environment      ║"
    echo "╚═══════════════════════════════════════════╝"
    echo ""
    start_indexer
    start_web
    show_status
    echo ""
    log_info "Press Ctrl+C or run 'pnpm start:all --stop' to stop"
    echo ""
    # Wait for interrupt
    tail -f "$PID_DIR/web.log" "$PID_DIR/indexer.log" 2>/dev/null || true
    ;;
esac
