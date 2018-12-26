#!/bin/bash

ORG_NAME=
DOMAIN=
NUM=2
DEL_ORG=
ORG1_TOKEN=

function printHelp() {
	echo "Only use this script when you need to add an org in a channel"
	echo "Usage:   new_org.sh --add domain --number num      add an new org"
	echo "         new_org.sh --del orgname          delete an existing org"
}

function startConfigtxlator() {
	configtxlator start &
}

function closeConfigtxlator() {
	kill -9 $(ps -aux|grep "configtxlator"|grep -v "grep"|awk '{print $2}')
}

function generateCrypto() {
	if [[ -f "crypto-new-org.yaml" ]]; then
		rm crypto-new-org.yaml
	fi
	cp crypto-new-org-template.yaml crypto-new-org.yaml
	sed -i "s/ORG_NAME/$ORG_NAME/g" crypto-new-org.yaml
	sed -i "s/DOMAIN/$DOMAIN/g" crypto-new-org.yaml
	sed -i "s/NUM/$NUM/g" crypto-new-org.yaml

	cryptogen generate --config=./crypto-new-org.yaml --output ./../artifacts/channel/crypto-config
}

function getToken(){
	echo "POST request Enroll on Org1  ..."
	echo
	ORG1_TOKEN=$(curl -s -X POST \
	  http://localhost:4000/users \
	  -H "content-type: application/x-www-form-urlencoded" \
	  -d 'username=Jim&orgName=jetair&password=123')
	echo $ORG1_TOKEN
	ORG1_TOKEN=$(echo $ORG1_TOKEN | jq ".token" | sed "s/\"//g")
	echo
	echo "ORG1 token is $ORG1_TOKEN"
	echo
}

function addOrg() {
	echo "add new Org"
	curl -s -X POST \
    http://localhost:4000/channels/airtrip-union/addNewOrg \
    -H "authorization: Bearer $ORG1_TOKEN" \
    -H "content-type: application/json" \
    -d '{
    	"domain": "'$DOMAIN'",
    	"fcn": "add"
	}'
}

function delOrg() {
	curl -s -X POST \
    http://localhost:4000/channels/airtrip-union/addNewOrg \
    -H "authorization: Bearer $ORG1_TOKEN" \
    -H "content-type: application/json" \
    -d '{
    	"domain": "'$DEL_ORG'",
    	"fcn": "delete"
	}'
}


if [[ $# -eq 4 && "$1" = "--add" && "$3" = "--number" && -n "$2" && -n "$4" ]]; then
	DOMAIN=$2
	NUM=$4
	ORG_NAME=${DOMAIN%%.*}
	echo "Add org"
	echo "Domain: $DOMAIN"
	echo "Number: $NUM"
	echo "Orgname: $ORG_NAME"
	echo
	#startConfigtxlator
	generateCrypto
	#getToken
	#addOrg
	#closeConfigtxlator


elif [[ $# -eq 2 && "$1" = "--del" && -n "$2" ]]; then
	DEL_ORG=$2
	echo "Delete org"
	echo "Orgname: $DEL_ORG"
	startConfigtxlator
	delOrg
	closeConfigtxlator
else
	printHelp
fi