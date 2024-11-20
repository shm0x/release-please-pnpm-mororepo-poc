# USDN Backend Monorepo

[![build](https://github.com/backend-ra2-tech/usdn-backend/actions/workflows/build.yml/badge.svg)](https://github.com/backend-ra2-tech/usdn-backend/actions/workflows/build.yml)
[![tests](https://github.com/backend-ra2-tech/usdn-backend/actions/workflows/tests.yml/badge.svg)](https://github.com/backend-ra2-tech/usdn-backend/actions/workflows/tests.yml)

## API Specification

### Metrics API

The API specification is available at [openapi.yml](./packages/lambda-metrics-api/openapi.yml).

### Oracle Prices API

The API specification is available at [openapi.yml](./packages/lambda-prices-api/openapi.yml).

## Install

### Prerequisite

- [usdn-backend](https://github.com/Backend-RA2-Tech/usdn-backend) repository
- [foundry](https://book.getfoundry.sh/getting-started/installation) installed (In WSL on Window)
- [aws](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) installed (In WSL on Window)
- create a `.env` based on `.env.example` inside the `usdn-backend` repository

### Step-by-step

**1. Login with AWS**

In order to run the stack you need to be logged in with AWS.

**1.1 Create a new AWS Session**

The session token is valid for 36 hours. You can create a new session token with the following command:
```sh
AWS_SESSION_TOKEN=$(aws sts get-session-token --duration-seconds 129600 --serial-number "<AWS_IAM_MFA_ARN>" --token-code "<AWS_2FA_CODE>" --profile "login")

export AWS_ACCESS_KEY_ID=$(echo $AWS_SESSION_TOKEN | jq -r '.Credentials.AccessKeyId')
export AWS_SECRET_ACCESS_KEY=$(echo $AWS_SESSION_TOKEN | jq -r '.Credentials.SecretAccessKey')
export AWS_SESSION_TOKEN=$(echo $AWS_SESSION_TOKEN | jq -r '.Credentials.SessionToken')
aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID --profile "default"
aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY --profile "default"
aws configure set aws_session_token $AWS_SESSION_TOKEN --profile "default"
```

**1.2 Login with AWS CodeArtifact**

```sh
aws codeartifact login --tool npm --domain ra2 --repository ra2-dev --namespace common-ra2
aws codeartifact login --tool npm --domain ra2 --repository ra2-dev --namespace vordex
aws codeartifact login --tool npm --domain ra2 --repository ra2-dev --namespace smardex
aws codeartifact login --tool npm --domain ra2 --repository ra2-dev --namespace usdn
```

**1.3 Login with AWS ECR**

```sh
aws ecr get-login-password --region eu-central-1 | docker login --username AWS --password-stdin 927114455157.dkr.ecr.eu-central-1.amazonaws.com
```


**2. Populate `.env` file**

Ask a team member for the `.env` file missing values, and place it in the root of the `usdn-backend` repository.

**3. Launch the backend stack**

> This step has to be ran inside [usdn-backend](https://github.com/Backend-RA2-Tech/usdn-backend) repository.

You can launch all the services needed to make the backend work with the start script:

```sh
./start.sh <env> [build]

# Example
./start.sh dev build
# Will rebuild the backend stack and run the stack in dev environment
./start.sh dev
# Will just run the stack in dev environment
./start.sh prod
# Will just run the stack in prod environment
```

### Test API

You should be able to use the Metrics API locally with using `GW_ID` from the localstack logs finding `API GATEWAY available at ID:`:

- example to get the first position created by the deployer address: http://localhost:8443/restapis/$GW_ID/default/_user_request_/positions?address=0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266

## Available Scripts

In the root directory, you can run:

### `npm run build`

Build all packages:

```sh
npm run build
```

Build a single package:

```sh
npm run build --scope=<package-name>
```

For example:

```sh
npm run build --scope=example-a
```

### `npm run clean`

Delete build artifacts for all packages:

```sh
npm run clean
```

Clean a single package:

```sh
npm run clean --scope=<package-name>
```

For example:

```sh
npm run clean --scope=example-a
```

### `npm run create-package`

Create a package:

```sh
npm run create-package
```

### `npm run lint`

Lint all packages:

```sh
npm run lint
```

Lint a single package:

```sh
npm run lint --scope=<package-name>
```

For example:

```sh
npm run lint --scope=example-a
```

### `npm run lint:fix`

Fix lint errors for all packages:

```sh
npm run lint:fix
```

Fix lint errors for a single package:

```sh
npm run lint:fix --scope=<package-name>
```

For example:

```sh
npm run lint:fix --scope=example-a
```

### `npm run test`

Run tests for all packages:

```sh
npm run test
```

Run tests for a single package:

```sh
npm run test --scope=<package-name>
```

For example:

```sh
npm run test --scope=example-a
```

### Make transactions on FORK via foundry

#### Approve wstETH with UsdnProtocol as spender

cast send --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0 "approve(address,uint256)" 0x484242986F57dFcA98EeC2C78427931C63F1C4ce
1000000000000000000

### get some wstETH

cast send --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0 --value 5ether

#### Initiate open position with 1 wstETH at tick -20000

cast send --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
0x484242986F57dFcA98EeC2C78427931C63F1C4ce "initiateOpenPosition(uint96,int24,bytes,bytes)" 1000000000000000000 --
-20000 "0x" "0x"

#### Validate open position by providing pyth price signature for timestamp ts+24s compared to when the previous transaction was mined

cast send --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
0x484242986F57dFcA98EeC2C78427931C63F1C4ce "validateOpenPosition(bytes,bytes)" "0x...." "0x"

## Compose files

| Variable      | Description                                       |
| ------------- | ------------------------------------------------- |
| local         | Contains the necessary stack to run locally       |
| fork          | Runs an instance of Anvil                         |
| fork-services | Runs the different services for the deployed fork |

### Execute local compose

To build the images used by the Docker Compose, you'll need to run the following command and provide the path to your
NPMRC file to access our private npm registries.

In a Windows environment, you'll need to add explicit `\n` in the NPMRC file in between line feeds to execute the following command:

```
docker-compose -f .\docker-compose.local.yml build --build-arg NPMRC="$(cat /PATH_TO_NPMRC/.npmrc)"
```

To run the docker compose file you'll have to run the following command after the build command

```
docker-compose -f .\docker-compose.fork-services.yml up -d
```

#### Fork composes

The composes are meant to be run by the EC2 forks, the compose `fork` contains only the Anvil,
whilst the `fork-services` contains all the services,

Both composes share the same network to enable the services to access the Anvil node seamlessly. This network
configuration ensures smooth communication between different components within the fork environment, facilitating
efficient development and testing processes.

## Docker file

The root Dockerfile is utilized for building lambdas and seamlessly integrating them into LocalStack.

This file serves as the blueprint for creating Docker images that encapsulate the lambda functions and their
dependencies. By defining the necessary configurations and commands within this Dockerfile, you ensure that the lambdas
are packaged and configured correctly for deployment within the LocalStack environment.

During the Docker build process, this Dockerfile instructs Docker to install the required dependencies, copy the lambda
function code into the image, and configure any runtime settings needed for integration with LocalStack.

Once the Docker image is built, it can be deployed within the LocalStack environment, allowing you to develop and test
lambda functions locally with the same environment and services as in the cloud. This streamlined approach to
development and testing helps ensure consistency and reliability across different environments.

# Import SQL dump locally

## Requirements

- Install postgresqul client `psql` on Linux or `postgres`on MacOS

## Steps to import SQL dump in your docker database

1. Run your docker-compose file
2. Stop on-chain-sync service
3. Import SQL dump from S3 at https://staging-sepolia-usdn-REGION-metrics-database-dumps.s3.REGION.amazonaws.com/staging-sepolia_usdn_metrics-table_IDS.sql
4. Import SQL dump in your DB: `psql -U postgres -d postgres -a -f DUMP_FILE_DOWNLOADED.sql -h localhost -p 5432`
5. Clear tables except `metrics`

```sql
DELETE FROM latest_metrics;
DELETE FROM transaction_history;
DELETE FROM rebalancer_account_position;
DELETE FROM rebalancer_transaction;
DELETE FROM rebalancer_account;
DELETE FROM rebalancer_position;
DELETE FROM positions;
DELETE FROM rebalancer;
DELETE FROM statistics;
DELETE FROM synced_block;
DELETE FROM vaults;
```

6. Start `on-chain-sync` service again. The metrics catchup will take no time as Data is already in your DB. But the Event catchup will run (about 15min to recover all logs in a month)
