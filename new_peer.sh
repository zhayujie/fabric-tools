#!/bin/bash
#new one peer in ogr1 in default
ORG_TOKEN=
DOMAIN=
NUM=2
DEL_ORG=

function printHelp() {
    echo "Only use this script when you need to add an org in a channel"
    echo "Usage:   new_org.sh --add domain --number num      add an new org"
    echo "         new_org.sh --del orgname          delete an existing org"
}

function addCrypto() {
    #Adding Identity Information of New peer
    echo "Adding Identity Information of New peer"
    if [[ -f "cryptogen.yaml" ]]; then
        rm cryptogen.yaml
    fi
    cp cryptogenNewPeer.yaml cryptogen.yaml
    sed -i "s/NUM/$NUM/g" cryptogen.yaml

    cryptogen extend --config=./cryptogen.yaml
}

function newPeerDockerCompose(){
    # aritifacts
    echo "newPeerDockerCompose"
    cd ..
    docker-compose -f new-peer.yaml up -d
}

function netWorkConfig(){
   # modified networkConfig
   echo "modified networkConfig"

}

function joinChannel(){
    # join Channel
    echo "join Channel"
    curl -s -X POST \
    http://localhost:4000/channels/mychannel/peers \
    -H "authorization: Bearer $ORG1_TOKEN" \
    -H "content-type: application/json" \
    -d '{
    "peers": ["peer2.org1example.com"]
  }'
}

function installChainnode(){
  # install chaincode on new peer
  echo "install chaincode on new peer"
  curl -s -X POST \
   http://localhost:4000/chaincodes \
   -H "authorization: Bearer $ORG1_TOKEN" \
   -H "content-type: application/json" \
   -d '{
    "peers": ["peer2.org1.example.com],
    "chaincodeName":"mycc",
    "chaincodePath":"github.com/example_cc/go",
    "chaincodeType": "golang",
    "chaincodeVersion":"v0"
   }'
}

if [[ $# -eq 4 && "$1" = "--token" && "$3" = "--number" && -n "$2" && -n "$4" ]]; then
    ORG_TOKEN=$2
    NUM=$4

    echo "New peer"
    echo "ORG_TOKEN: $ORG_TOKEN"
    echo "Number: $NUM"
    echo
    addCrypto
    newPeerDockerCompose
    netWorkConfig
    joinChannel
    installChainnode
else
    printHelp
fi
