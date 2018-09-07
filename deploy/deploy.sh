#!/bin/bash

ORG_NAME=
DOMAIN=
ORDERER_IP="192.168.1.51"

function printHelp() {
    echo "Usage:   new_org.sh --domain domain --order ordererIP         deploy the new org"
    echo "(the default ordererIP is 192.168.1.51)"
}

function dockerInstall() {
    if [[ -d pkg ]]; then
        cd pkg
    fi
    echo "==> INSTALL DOCKER"
    docker --version > /dev/null 2>&1
    RES=$?
    if [[ -f  "docker-18.03.0-ce.tgz" && $RES -ne 0 ]]; then
        tar -zxvf docker-18.03.0-ce.tgz
        cp docker/* /usr/bin/
        dockerd &
        curl -sSL https://get.daocloud.io/daotools/set_mirror.sh | sh -s http://6e4616d7.m.daocloud.io
        kill -9 $(ps -aux|grep "dockerd"|grep -v "grep"|awk '{print $2}')
        dockerd &
    elif [[ $RES -ne 0 ]]; then
        yum -y install docker-io
        service docker start
        curl -sSL https://get.daocloud.io/daotools/set_mirror.sh | sh -s http://6e4616d7.m.daocloud.io
        service docker restart
    fi
    echo "DOCKER DOWNLOAD FINISH"
    echo
    echo "==> INSTALL DOCKER-COMPOSE"
    docker-compose --version > /dev/null 2>&1
    RES=$?
    if [[ -f docker-compose && $RES -ne 0 ]]; then
        cp docker-compose /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    elif [[ $RES -ne 0 ]]; then
        curl -L https://get.daocloud.io/docker/compose/releases/download/1.12.0/docker-compose-`uname -s`-`uname -m` > /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi
    echo "DOCKER-COMPOSE DOWNLOAD FINISH"
    echo
    if [[ ! -f "deploy.sh" ]]; then
        cd ..
    fi
}

function imagesPull() {
    if [[ -d pkg ]]; then
        cd pkg
    fi
    FABRIC_VERSION="x86_64-1.1.0"
    COUCH_VERSION="0.4.8"

    for IMAGES in peer ccenv ca couchdb; do
        echo "==> INSTALL FABRIC IMAGE: $IMAGES"
        if [[ -f "$IMAGES"".tar" ]]; then
            docker load -i "$IMAGES"".tar"
        else
            if [[ $IMAGES == "couchdb" ]]; then
                docker pull hyperledger/fabric-$IMAGES:$COUCH_VERSION
            else
                docker pull hyperledger/fabric-$IMAGES:$FABRIC_VERSION
            fi
            docker tag hyperledger/fabric-$IMAGES hyperledger/fabric-$IMAGES:latest
        fi
    done
    echo
    echo "==> FABRIC IMAGES DOWNLOAD FINISH"
    if [[ ! -f "deploy.sh" ]]; then
        cd ..
    fi
}

function createNetwork() {
    echo "==> Generate Crypto"
    cd artifacts
    if [[ -f crypto-config.yaml ]]; then
        rm -f crypto-config.yaml
    fi
    cp crypto-template.yaml crypto-config.yaml
    sed -i "s/ORG_NAME/$ORG_NAME/g" crypto-config.yaml
    sed -i "s/DOMAIN/$DOMAIN/g" crypto-config.yaml
    ./cryptogen generate --config=./crypto-config.yaml
    mv crypto-config/peerOrganizations/$DOMAIN .
    rm -rf crypto-config
    echo

    echo "==> Modify config files"
    if [[ -f docker-compose.yaml ]]; then
        rm -f docker-compose.yaml
    fi
    cp fabric-ca-server-template.yaml fabric-ca-server-config.yaml
    sed -i "s/ORG_NAME/$ORG_NAME/g" fabric-ca-server-config.yaml

    
    if [[ -f docker-compose.yaml ]]; then
        rm -f docker-compose.yaml
    fi

    CA_PRIVATE_KEY=$(ls ./$DOMAIN/ca/*_sk)
    CA_PRIVATE_KEY=${CA_PRIVATE_KEY##*/}
    cp docker-compose-template.yaml docker-compose.yaml
    sed -i "s/ORG_NAME/$ORG_NAME/g" docker-compose.yaml
    sed -i "s/DOMAIN/$DOMAIN/g" docker-compose.yaml
    sed -i "s/CA_PRIVATE_KEY/$CA_PRIVATE_KEY/g" docker-compose.yaml
    sed -i "s/ORDERER_IP/$ORDERER_IP/g" docker-compose.yaml
    
    docker-compose up -d
}

if [[ $1 = "--domain" && -n $2 ]]; then
    DOMAIN=$2
    ORG_NAME=${DOMAIN%%.*}
    if [[ $3 = "--order" && -n $4 ]]; then
        ORDERER_IP=$4
    fi

    echo "Domain:     $DOMAIN"
    echo "Orgname:    $ORG_NAME"
    echo "Orderer ip: $ORDERER_IP"

    dockerInstall
    imagesPull
    createNetwork
    
else
    printHelp
fi
