'use strict';
var log4js = require('log4js');
var logger = log4js.getLogger('new-org');
var fs = require('fs-extra');
//var superagent = require('superagent');
var agent = require('superagent-promise')(require('superagent'), Promise);
var requester = require('request');

require('../config.js');
var helper = require('./helper.js');

var addNewOrg = async function(domain, channel_name, fcn) {
    var orgs = ORGS;
    var cur_orgs = [];
    var orgname = domain.split('.')[0]
    for (var key in orgs) {
        if (orgname == key && fcn == 'add') {
            return null;
        }
        if (key != 'orderer')
            cur_orgs.push(key)
    }
    var cur_org = cur_orgs[0];
    var cur_MSP = cur_org + 'MSP';
    var new_MSP = orgname + 'MSP';

    var client = getClientForOrg(cur_org);
    var channel = getChannelForOrg(cur_org);
    var admins = path.join(__dirname, '../artifacts/channel/crypto-config/peerOrganizations/' +domain +'/msp/admincerts/' + 'Admin@' + domain + '-cert.pem')
    var root_certs = path.join(__dirname, '../artifacts/channel/crypto-config/peerOrganizations/' +domain +'/msp/cacerts/' + 'ca.' + domain + '-cert.pem')
    var tls_root_certs = path.join(__dirname, '../artifacts/channel/crypto-config/peerOrganizations/' +domain +'/msp/tlscacerts/' +'tlsca.' + domain + '-cert.pem')

    console.log(cur_org)
    try {

        await getOrgAdmin(cur_org);
        // get the latest config block of the channel: map
        var config_envelope = await channel.getChannelConfig()

        // original "config" object: protobuf
        var original_config_proto = config_envelope.config.toBuffer();

        // use tool : configtxlator : pb->json
        var response = await agent.post('http://127.0.0.1:7059/protolator/decode/common.Config',
            original_config_proto).buffer();

        // original config: json
        var original_config_json = response.text.toString()

        var updated_config_json = original_config_json;
        // Json string -> Json object
        var updated_config = JSON.parse(updated_config_json);

        // modify the config -- add new org
        
        if (fcn == 'add') {
            // deep copy
            var new_config = JSON.stringify(updated_config.channel_group.groups.Application.groups[cur_MSP]);
            new_config = JSON.parse(new_config);
            new_config.policies.Admins.policy.value.identities[0].principal.msp_identifier = new_MSP;
            new_config.policies.Readers.policy.value.identities[0].principal.msp_identifier = new_MSP;
            new_config.policies.Writers.policy.value.identities[0].principal.msp_identifier = new_MSP;
            new_config.values.MSP.value.config.name = new_MSP;

            var f1 = fs.readFileSync(admins)
            var f2 = fs.readFileSync(root_certs)
            var f3 = fs.readFileSync(tls_root_certs)

            f1 = new Buffer(f1).toString('base64')
            f2 = new Buffer(f2).toString('base64')
            f3 = new Buffer(f3).toString('base64')

            new_config.values.MSP.value.config.admins[0] = f1;
            new_config.values.MSP.value.config.root_certs[0] = f2;
            new_config.values.MSP.value.config.tls_root_certs[0] = f3;

            updated_config.channel_group.groups.Application.groups[new_MSP] = new_config;
        }
        else if (fcn == 'delete'){
            var del_org = domain + 'MSP'
            var res = delete updated_config.channel_group.groups.Application.groups[del_org]
        }
        //console.log(JSON.stringify(updated_config))
        updated_config_json = JSON.stringify(updated_config);
        
        // configtxlator: json -> pb
        response = await agent.post('http://127.0.0.1:7059/protolator/encode/common.Config',
            updated_config_json.toString()).buffer();

        var updated_config_proto = response.body;

        var formData = {
            channel: channel_name,
            original: {
                value: original_config_proto,
                options: {
                    filename: 'original.proto',
                    contentType: 'application/octet-stream'
                }
            },
            updated: {
                value: updated_config_proto,
                options: {
                    filename: 'updated.proto',
                    contentType: 'application/octet-stream'
                }
            }
        };

        // configtxlator: computer
        // need request v1.9.8   (2.87.0  err)
        response = await new Promise((resolve, reject) => {
            requester.post({
                url: 'http://127.0.0.1:7059/configtxlator/compute/update-from-configs',
                // if dont have 'encoding' and 'headers', it will: error authorizing update
                encoding: null,
                headers: {
                    accept: '/',
                    expect: '100-continue'
                },
                formData: formData
            }, (err, res, body) => {
                if (err) {
                    logger.error('Failed to get the updated configuration ::' + err);
                    reject(err);
                } else {
                    const proto = Buffer.from(body, 'binary');
                    resolve(proto);
                }
            });
        });

        logger.debug('Successfully had configtxlator compute the updated config object')
        var config_proto = response;

        var signatures = []
        //client._userContext = null;

        for (let org of cur_orgs) {
            // assign the admin userobj to client
            client = getClientForOrg(org)
            var r = await getOrgAdmin(org)
            //console.log(r)
            //console.log(client)

            let signature = client.signChannelConfig(config_proto);
            signatures.push(signature)
        }
        logger.debug('Successfully signed config update by orgs')

        let tx_id = client.newTransactionID();
        var request = {
            config: config_proto,
            signatures: signatures,
            name: channel_name,
            orderer: channel.getOrderers()[0],
            txId: tx_id
        };
        var result = await client.updateChannel(request);
        if(result.status && result.status === 'SUCCESS') {
            logger.debug('Successfully updated the channel.');
        } else {

            logger.error('Failed to update the channel.');
        }
    }
    catch(err) {
        logger.error('Failed to update the channel: ' + err.stack ? err.stack : err);
    }
    return result;

}

addNewOrg("org3.example.com", "mychannel", "add")
