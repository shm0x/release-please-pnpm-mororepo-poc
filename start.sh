#!/usr/bin/env bash

REBUILD=false
RESTART=false
CLEANUP=false
VERBOSE=false
DEPLOY=false
CONTAINERS=()



RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

usdn_color_output() {
    echo -en "${2:-$RED}$1${NC}"
}

usdn_message() {
  # if verbose dont echo  -n else echo -n
  if [[ $VERBOSE = true ]]; then
    echo $1
  else
    echo -n $1
  fi
}


usage() {
  echo "Prepare and run USDN docker stack."
  echo
  echo "Usage: $0 [options] <env>"
  echo
  echo "Example:"
  usdn_color_output "  # Rebuild docker images and deploy USDN contracts on local fork,\n" ${CYAN}
  usdn_color_output "  then run the stack in dev environment\n" ${CYAN}
  echo "  $0 -db dev"
  usdn_color_output "  # Rebuild only on-chain-sync and historical-stats images, \n" ${CYAN}
  usdn_color_output "  deploy USDN contracts on local fork and run the stack in dev environment\n" ${CYAN}
  echo "  $0 -dbc on-chain-sync -c historical-stats dev"
  usdn_color_output "  # Rebuild docker images, then run the stack in prod environment without fork\n" ${CYAN}
  echo "  $0 -b prod "
  echo
  echo "Options:"
  echo "  --clean                   Clean up everything"
  echo "  -d | --deploy             Deploy USDN contracts on local fork"
  echo "  -b | --build              Rebuild docker images"
  echo "  -r | --restart            Restart docker images"
  echo "  -c | --container <name>   Rebuild only the specified container(s), can be used multiple times"
  echo "  -v | --verbose            Enable verbose mode"
  echo "  -h | --help               Display this help"
  echo "Argument:"
  echo "  env                       Can be one of the following: dev | prod"
  exit 1
}

while [[ "$1" != "" ]]; do
    case "$1" in
        -[dbrcvh]*)
            opts="${1:1}"
            for ((i=0; i<${#opts}; i++)); do
                case "${opts:$i:1}" in
                    d) DEPLOY=true ;;
                    b) REBUILD=true ;;
                    r) RESTART=true ;;
                    c) shift
                        if [[ -n "$1" ]]; then
                            CONTAINERS+=("$1")
                        else
                            usdn_color_output "Error : -c needs a container name.\n"
                            usage
                        fi
                        ;;
                    v) VERBOSE=true ;;
                    h) usage ;;
                    *) usdn_color_output "Error : Unknown option: -${opts:$i:1}\n"; usage ;;
                esac
            done
            ;;
        --clean) CLEANUP=true ;;
        -d|--deploy) DEPLOY=true ;;
        -b|--build) REBUILD=true ;;
        -r|--restart) REBUILD=true ;;
        -c|--container)
            shift
            if [[ -n "$1" ]]; then
                CONTAINERS+=("$1")
            else
                usdn_color_output "Error : -c needs a container name.\n"
                usage
            fi
            ;;
        -v|--verbose) VERBOSE=true ;;
        -h|--help) usage ;;
        -*|--*) usage ;;
        *)
            if [[ "$1" != "dev" && "$1" != "prod" && "$1" != "unit-test" ]]; then
                usdn_color_output "Error : Unknown environment: $1\n"
                usage
            fi
            STACK_ENV=$1
            ;;
    esac
    shift
done

# Redirecting stdout to /dev/null if not in verbose mode (default)
exec 3>/dev/null

# Reenabling stdout if VERBOSE is enabled
if [[ $VERBOSE = true ]]; then
    echo "Verbose mode enabled"
    exec 3>&1
fi

if [[ -z $STACK_ENV ]]; then
    usdn_color_output "Error : missing environment argument.\n"
    usage
fi


usdn_cleanup() {
    if [[ $CLEANUP = true  ]]; then
        usdn_message "Cleaning up USDN stack... "
        {
            npm run clean
            npm cache clean --force
            rm -rf ./packages/*/node_modules ./packages/*/package-lock.json ./node_modules package-lock.json .env.fork ./packages/*/.env.fork .tmp.log
        } >&3
        echo "Done !"
    fi
}

usdn_check_aws() {
  NPMRC=$(cat ~/.npmrc)
  AWS_EXPIRATION_TIMESTAMP_STRING=$(cat ~/.npmrc | awk -F "ra2-927114455157.d.codeartifact.eu-central-1.amazonaws.com/npm/ra2-dev/:_authToken=" '{print $2}' | cut -d '.' -f1 | base64 -d | jq '.exp')
  NOW_TIMESTAMP=$(date +%s)
  if [[ $NOW_TIMESTAMP -gt $AWS_EXPIRATION_TIMESTAMP_STRING ]]; then
    return 1
  fi
  return 0
}

usdn_init() {
    if [[ $REBUILD = true || $CLEANUP = true ]]; then
      usdn_check_aws
      if [ $? -ne '0' ]; then
          usdn_color_output "AWS CodeArtifact session is expired, please re-login to AWS CodeArtifact in another terminal and press any key to continue...\n"
          read -n 1 -s
      fi
      usdn_message "Setting up USDN stack... "
      {
          npm i  --verbose
          npm run build
          touch .env.fork
          aws ecr get-login-password --region eu-central-1 | docker login --username AWS --password-stdin 927114455157.dkr.ecr.eu-central-1.amazonaws.com
      } >&3
      echo "Done !"
    fi
}

usdn_deploy() {
    # if restart is true, then down the running stack (before eventually deploying the contracts on fork)
    if [[ $RESTART = true ]]; then
      docker compose -f docker-compose.${STACK_ENV}.yml down
    fi
    if [[ $DEPLOY = true  ]]; then
      usdn_message "Deploying USDN contract on local fork... "
      BG_LOG_PID=0
      {
          docker compose -f docker-compose.${STACK_ENV}.yml down anvil
          docker compose -f docker-compose.${STACK_ENV}.yml up -d anvil
          docker compose -f docker-compose.${STACK_ENV}.yml logs -f anvil > .tmp.log &
          BG_LOG_PID=$!
      } >&3
      attempt=0
      while [ $attempt -le 120 ] && ! grep -q 'USDN_TOKEN_BIRTH_TIME=' .tmp.log
      do
          sleep 1
          attempt=$(( $attempt + 1 ))
          if [ $attempt -ge 120 ]; then
              echo
              usdn_color_output "Error : Contracts deployment failed, aborting the mission...\n"
              tail -f .tmp.log
              rm .tmp.log
              kill $BG_LOG_PID
              exit 1
          fi
      done
      kill $BG_LOG_PID
      rm .tmp.log
      echo "Done !"
    fi
}

usdn_run() {
    if [[ $REBUILD = true ]]; then
        usdn_message "Building USDN stack... "
        {
          containers="${CONTAINERS[*]}"
          docker compose -f docker-compose.${STACK_ENV}.yml build --no-cache --build-arg NPMRC="$(cat ~/.npmrc)" $containers
        }
        echo "Done !"
    fi
    echo "Running USDN stack in ${STACK_ENV} mode... "
    {
        if [[ $STACK_ENV = "dev" ]]; then
          docker compose -f docker-compose.${STACK_ENV}.yml up -d database
          sleep 5
          (
            cd packages/database
            echo "N\n" | DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres?schema=public" npx prisma db push;
            if [ $? -ne 0 ]; then
              echo "Prisma Schema has conflicts with current database, aborting";
              exit 1;
            fi
          )
        fi
        docker compose -f docker-compose.${STACK_ENV}.yml up -d
    } >&3
    echo "Done ! USDN stack is up and running !"
}

usdn_start() {
    usdn_cleanup
    usdn_init
    usdn_deploy
    usdn_run
}

usdn_start
