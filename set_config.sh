#!/bin/bash

# Execute this script to change orgName and channelName Aatomatically.
# But the normally running depends on current fixed directory. Just need
# to modify the script slightly and you can run it in new environment.

ORG_NAME=
CHANNEL_NAME=
export FABRIC_CFG_PATH=$PWD/channel

function printHelp() {
    echo "Only use this script when you need to modify the orgName or channelName"
    echo "Usage: set_config.sh <newOrgName> <newChannelName>"
}

# create crypto-config directory
function createCrypto() {
    rm -rf ./channel/crypto-config ./channel/*.block ./channel/*.tx
    cd channel
    if [[ -f "configtx.yaml" ]]; then
        rm configtx.yaml
    fi
    if [[ -f "cryptogen.yaml" ]]; then
        rm cryptogen.yaml
    fi
    cp cryptogen-template.yaml cryptogen.yaml
    cp configtx-template.yaml configtx.yaml
    sed -i "s/ORG_NAME/$ORG_NAME/g" ./cryptogen.yaml ./configtx.yaml
    ./cryptogen generate --config=./cryptogen.yaml
      ./configtxgen -profile TwoOrgsOrdererGenesis -outputBlock ./genesis.block
      ./configtxgen -profile TwoOrgsChannel -outputCreateChannelTx ./"$CHANNEL_NAME.tx" -channelID "$CHANNEL_NAME"
      cd ..
}

function changeConfigFile() {
    # docker-compose.yaml
    CA_PRIVATE_KEY=$(ls ./channel/crypto-config/peerOrganizations/$ORG_NAME.example.com/ca/*_sk)
    CA_PRIVATE_KEY=${CA_PRIVATE_KEY##*/}
    if [[ -f "docker-compose.yaml" ]]; then
        rm docker-compose.yaml
    fi
    cp docker-compose-template.yaml docker-compose.yaml
    sed -i "s/ORG_NAME/$ORG_NAME/g" docker-compose.yaml
    sed -i "s/CA_PRIVATE_KEY/$CA_PRIVATE_KEY/g" docker-compose.yaml

    # config.json
        cd ..
    if [[ -f "config.json" ]]; then
        rm config.json
    fi
    cp config-template.json config.json
    sed -i "s/CHANNEL_NAME/$CHANNEL_NAME/g" config.json
    cd app

    # network-config.json
    if [[ -f "network-config.json" ]]; then
        rm network-config.json
    fi
    cp network-config-template.json network-config.json
    sed -i "s/ORG_NAME/$ORG_NAME/g" network-config.json

    # remove local crypto key
    ls /tmp/fabric-client-kvs_peer* > /dev/null
    if [[ $? -eq 0 ]]; then
        rm -rf /tmp/fabric-client-kvs_peer*
    fi
}

function modifyConfig() {
    createCrypto
    changeConfigFile
}

if [[ $# -eq 2 && -n "$1" && -n "$2" ]]; then
    echo "new orgName:      $1"
    echo "new channelName:  $2"
    ORG_NAME=$1
    CHANNEL_NAME=$2

    modifyConfig
    echo
    echo
else
    printHelp
fi
