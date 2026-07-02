#!/bin/bash
set -e

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
FLASK="$SCRIPT_DIR/venv/bin/flask"
export FLASK_APP=freezr

if [ ! -f "$FLASK" ]; then
    echo "Error: venv not found. Run setup first." >&2
    exit 1
fi

usage() {
    echo "Usage: freezr-admin <command>"
    echo ""
    echo "Commands:"
    echo "  init-db          Wipe and reinitialise the database (new password will be shown)"
    echo "  reset-password   Generate a new random login password"
    echo "  reset-password <password>  Set a specific password"
    echo ""
}

case "${1:-}" in
    init-db)
        echo "WARNING: This will delete all data. Press Ctrl-C to cancel, Enter to continue."
        read -r
        cd "$SCRIPT_DIR" && "$FLASK" init-db
        ;;
    reset-password)
        cd "$SCRIPT_DIR" && "$FLASK" reset-password "${2:-}"
        ;;
    *)
        usage
        exit 1
        ;;
esac
