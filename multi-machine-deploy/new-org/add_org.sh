#!/bin/bash

IP=
ORG_NAME=
DOMAIN=
CUR_ORG="org1"			 # one of current orgs in network
URL="localhost:4000"
CHANNEL_NAME="mychannel"

function printHelp() {
    echo "Usage:"
    echo "     add_org.sh --org <orgname> --ip <IP>"
}

function modifyConfig() {
    # move the new org's msp to crypto-config dir
    DOMAIN=$(ls | grep "$ORG_NAME")
    if [[ $? -ne 0 ]]; then
        echo "Please copy the msp dir to new_org dir"
        exit 1
    fi
    mv $DOMAIN ../artifacts/channel/crypto-config/peerOrganizations/

    # modify the network-config-template.json
    cp network-config-template.json network-config.json
    sed -i "s/ORG_NAME/$ORG_NAME/g" network-config.json
    sed -i "s/DOMAIN/$DOMAIN/g" network-config.json
    sed -i "s/IP/$IP/g" network-config.json
}

function addOrg() {
    jq --version > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo "Please Install 'jq' https://stedolan.github.io/jq/ to execute this script"
        echo
        exit 1
    fi
    # start configtxlator
    ./configtxlator start &

    # enroll by current org
    echo
    echo "POST request Enroll on $CUR_ORG  ..."
    TOKEN=$(curl -s -X POST \
      http://$URL/users \
      -H "content-type: application/x-www-form-urlencoded" \
      -d "username=admin&orgName=$CUR_ORG&password=123")
    TOKEN=$(echo $TOKEN | jq ".token" | sed "s/\"//g")
    
    # add org
    echo
    echo "Add $ORG_NAME in network ..."
    curl -s -X POST \
        http://$URL/channels/$CHANNEL_NAME/addNewOrg \
        -H "authorization: Bearer $TOKEN" \
        -H "content-type: application/json" \
        -d '{
            "domain": "'$DOMAIN'",
            "fcn": "add"
    }'
    # add config of new org in network-config.json
    node modify-network.js $ORG_NAME
    rm -f network-config.json

    # enroll by new org
    echo
    echo "POST request Enroll on $ORG_NAME  ..."
    TOKEN=$(curl -s -X POST \
      http://$URL/users \
      -H "content-type: application/x-www-form-urlencoded" \
      -d "username=admin&orgName=$ORG_NAME&password=123")
    TOKEN=$(echo $TOKEN | jq ".token" | sed "s/\"//g")
 
    # join new peers in channel
    echo
    echo "Join $ORG_NAME in channel $CHANNEL_NAME..."
    curl -s -X POST \
        http://$URL/channels/$CHANNEL_NAME/peers \
        -H "authorization: Bearer $TOKEN" \
        -H "content-type: application/json" \
        -d '{
        "peers": ["peer1", "peer2"]
    }'

    # install chaincode in new peers
    echo
    echo "Install chaincode in $ORG_NAME..."
    curl -s -X POST \
        http://localhost:4000/chaincodes \
        -H "authorization: Bearer $TOKEN" \
        -H "content-type: application/json" \
        -d '{
            "peers": ["peer1", "peer2"],
            "chaincodeName":"mycc",
            "chaincodePath":"github.com/example_cc/go",
            "chaincodeVersion":"v0"
    }'

    # close configtxlator
    kill -9 $(ps -aux|grep "configtxlator"|grep -v "grep"|awk '{print $2}')
    echo "Add Org successfully"
}

if [[ $# -eq 4 && "$1" = "--org" && -n "$2" && "$3" = "--ip" && -n "$4" ]]; then
    ORG_NAME=$2
    IP=$4
    modifyConfig
    echo "Add new org"
    echo "Orgname:    $ORG_NAME"
    echo "Domain:     $DOMAIN"
    echo "IP address: $IP"
    echo
    addOrg
else
    printHelp
fi
