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
# Check if gh is installed
if [ -z "$(command -v gh)" ]
then
    usdn_message "${RED}gh${RESET} not found !"
    if confirm_yes "Do you want to install ${YELLOW}gh${RESET} (Github CLI)?"
    then
        (type -p wget >/dev/null || (sudo apt update && sudo apt-get install wget -y)) \
          && sudo mkdir -p -m 755 /etc/apt/keyrings \
          && wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
          && sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
          && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
          && sudo apt update \
          && sudo apt install gh -y
    else
        usdn_message "Please install ${YELLOW}gh${RESET} and try again."
        exit 1
    fi
fi

# Check if github is logged in
GH_AUTH=$(gh auth status)
if [[ "$GH_AUTH" != *"Logged in to github.com"* ]]
then
    usdn_message "You are not logged in to ${YELLOW}Github${RESET} !"
    if confirm_yes "Do you want to login to ${YELLOW}Github${RESET}?"
    then
        gh auth login
    else
        usdn_message "Please login to ${YELLOW}Github${RESET} and try again."
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