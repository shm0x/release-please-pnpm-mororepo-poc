#!/usr/bin/env bash


RED='\033[0;31m'
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RESET='\033[0m'

function usdn_message {
    echo -e "$1${RESET}"
}

function confirm_no {
    usdn_message "${RED}$1${RESET} [y/${GREEN}N${RESET}]"
    read -r -p "" response
    case "$response" in
        [yY][eE][sS]|[yY])
            true
            ;;
        *)
            false
            ;;
    esac
}
function confirm_yes {
    usdn_message "${BLUE}$1${RESET} [${GREEN}Y${RESET}/n]"
    read -r -p "" response
    case "$response" in
        [nN][oO]|[nN])
            false
            ;;
        *)
            true
            ;;
    esac
}

# Check if pnpm is installed
if [ -z "$(command -v pnpm)" ]
then
    usdn_message "${RED}pnpm${RESET} not found !"
    if confirm_yes "Do you want to install ${YELLOW}pnpm${RESET}?"
    then
        curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=9.14.1 sh -
    else
        usdn_message "Please install ${YELLOW}pnpm${RESET} and try again."
        exit 1
    fi
fi
# Check if jq is installed
if [ -z "$(command -v jq)" ]
then
    usdn_message "${RED}jq${RESET} not found !"
    if confirm_yes "Do you want to install ${YELLOW}jq${RESET}?"
    then
        sudo apt install ${YELLOW}jq${RESET}
    else
        usdn_message "Please install ${YELLOW}jq${RESET} and try again."
        exit 1
    fi
fi

# Check if tsx is installed globally
GLOBAL_DEPS=$(pnpm list -g --depth 0 --json)
HAS_TSX=$(echo $GLOBAL_DEPS | jq '.[] | .dependencies | .tsx')
if [[ "$HAS_TSX" == null ]]
then
    usdn_message "${RED}tsx${RESET} not found !"
    if confirm_yes "Do you want to install ${YELLOW}tsx${RESET} globally?"
    then
        pnpm add -g tsx
    else
        usdn_message "Please install ${YELLOW}tsx${RESET} globally and try again."
        exit 1
    fi
fi

THIS_SCRIPT_DIR=$(dirname "$(realpath "$0")")

pnpx tsx $THIS_SCRIPT_DIR/index.ts $@