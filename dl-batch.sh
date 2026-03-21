#!/bin/bash

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <path_to_file> <directory_name>"
    exit 1
fi

FILE_PATH=$1
DIR_NAME=$2
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

mkdir -p "$DIR_NAME"
cd "$DIR_NAME" || exit

# Check for file existence (checking parent dir since we moved)
if [ ! -f "../$FILE_PATH" ]; then
    echo "Error: File '$FILE_PATH' not found."
    exit 1
fi

while IFS= read -r line || [ -n "$line" ]; do
    [[ -z "$line" || "$line" =~ ^# ]] && continue

    # Strip everything starting from '&list=' to the end of the string
    CLEAN_URL="${line%%&list=*}"

    echo "Processing: $CLEAN_URL"
    "$SCRIPT_DIR/.venv-yt/bin/yt-dlp" "$CLEAN_URL"
done < "../$FILE_PATH"
