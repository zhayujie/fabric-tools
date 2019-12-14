'use strict';
var log4js = require('log4js');
var tools = require('./tools.js')
var logger = tools.getLogger('Helper');
//logger.setLevel('DEBUG');

var path = require('path');
var util = require('util');
var fs = require('fs-extra');
var User = require('fabric-client/lib/User.js');
var crypto = require('crypto');
var copService = require('fabric-ca-client');

var hfc = require('fabric-client');
hfc.setLogger(logger);
var ORGS = {};

var superagent = require('superagent');
var agent = require('superagent-promise')(require('superagent'), Promise);
var requester = require('request');

var clients = {};
var channels = {};
var caClients = {};

// set up the client and channel objects for each org
function loadConfig() {
	ORGS = reloadConfig();
	for (let key in ORGS) {
		//if (key.indexOf('org') === 0) {
		if (key != 'orderer') {
			let client = new hfc();
			let cryptoSuite = hfc.newCryptoSuite();
			cryptoSuite.setCryptoKeyStore(hfc.newCryptoKeyStore({path: getKeyStoreForOrg(ORGS[key].name)}));
			client.setCryptoSuite(cryptoSuite);

			let channel = client.newChannel(hfc.getConfigSetting('channelName'));
			channel.addOrderer(newOrderer(client));
			clients[key] = client;
			channels[key] = channel;

			setupPeers(channel, key, client);

			let caUrl = ORGS[key].ca;
			caClients[key] = new copService(caUrl, null /*defautl TLS opts*/, '' /* default CA */, cryptoSuite);
		}
	}
}

function reloadConfig() {
	var config = fs.readFileSync(path.join(__dirname, 'network-config.json'), "utf-8")
	config = JSON.parse(config)['network-config'];
	hfc.setConfigSetting('network-config', config);
	return config;
}

function setupPeers(channel, org, client) {
	for (let key in ORGS[org].peers) {
		let data = fs.readFileSync(path.join(__dirname, ORGS[org].peers[key]['tls_cacerts']));
		let peer = client.newPeer(
			ORGS[org].peers[key].requests,
			{
				pem: Buffer.from(data).toString(),
				'ssl-target-name-override': ORGS[org].peers[key]['server-hostname']
			}
		);
		peer.setName(key);

		channel.addPeer(peer);
	}
}

function newOrderer(client) {
	var caRootsPath = ORGS.orderer.tls_cacerts;
	let data = fs.readFileSync(path.join(__dirname, caRootsPath));
	let caroots = Buffer.from(data).toString();
	return client.newOrderer(ORGS.orderer.url, {
		'pem': caroots,
		'ssl-target-name-override': ORGS.orderer['server-hostname']
	});
}

function readAllFiles(dir) {
	var files = fs.readdirSync(dir);
	var certs = [];
	files.forEach((file_name) => {
		let file_path = path.join(dir,file_name);
		let data = fs.readFileSync(file_path);
		certs.push(data);
	});
	return certs;
}

function getOrgName(org) {
	return ORGS[org].name;
}

function getKeyStoreForOrg(org) {
	return hfc.getConfigSetting('keyValueStore') + '_' + org;
}

function newRemotes(names, forPeers, userOrg) {
	let client = getClientForOrg(userOrg);

	let targets = [];
	// find the peer that match the names
	for (let idx in names) {
		let peerName = names[idx];
		if (ORGS[userOrg].peers[peerName]) {
			// found a peer matching the name
			let data = fs.readFileSync(path.join(__dirname, ORGS[userOrg].peers[peerName]['tls_cacerts']));
			let grpcOpts = {
				pem: Buffer.from(data).toString(),
				'ssl-target-name-override': ORGS[userOrg].peers[peerName]['server-hostname']
			};

			if (forPeers) {
				targets.push(client.newPeer(ORGS[userOrg].peers[peerName].requests, grpcOpts));
			} else {
				let eh = client.newEventHub();
				eh.setPeerAddr(ORGS[userOrg].peers[peerName].events, grpcOpts);
				targets.push(eh);
			}
		}
	}

	if (targets.length === 0) {
		logger.error(util.format('Failed to find peers matching the names %s', names));
	}

	return targets;
}

//-------------------------------------//
// APIs
//-------------------------------------//
var getChannelForOrg = function(org) {
	return channels[org];
};

var getClientForOrg = function(org) {
	return clients[org];
};

var newPeers = function(names, org) {
	return newRemotes(names, true, org);
};

var newEventHubs = function(names, org) {
	return newRemotes(names, false, org);
};

var getMspID = function(org) {
	logger.debug('Msp ID : ' + ORGS[org].mspid);
	return ORGS[org].mspid;
};

var getAdminUser = function(userOrg) {
	var users = hfc.getConfigSetting('admins');
	var username = users[0].username;
	var password = users[0].secret;
	var member;
	var client = getClientForOrg(userOrg);

	return hfc.newDefaultKeyValueStore({
		path: getKeyStoreForOrg(getOrgName(userOrg))
	}).then((store) => {
		client.setStateStore(store);
		// clearing the user context before switching
		client._userContext = null;
		return client.getUserContext(username, true).then((user) => {
			if (user && user.isEnrolled()) {
				logger.info('Successfully loaded member from persistence');
				return user;
			} else {
				let caClient = caClients[userOrg];
				// need to enroll it with CA server
				return caClient.enroll({
					enrollmentID: username,
					enrollmentSecret: password
				}).then((enrollment) => {
					logger.info('Successfully enrolled user \'' + username + '\'');
					member = new User(username);
					member.setCryptoSuite(client.getCryptoSuite());
					return member.setEnrollment(enrollment.key, enrollment.certificate, getMspID(userOrg));
				}).then(() => {
					return client.setUserContext(member);
				}).then(() => {
					return member;
				}).catch((err) => {
					logger.error('Failed to enroll and persist user. Error: ' + err.stack ?
						err.stack : err);
					return null;
				});
			}
		});
	});
};

var getRegisteredUsers = async function(username, userOrg) {
	var member;
	var client = getClientForOrg(userOrg);
	var enrollmentSecret = null;

	return hfc.newDefaultKeyValueStore({
		path: getKeyStoreForOrg(getOrgName(userOrg))
	}).then((store) => {
		client.setStateStore(store);
		// clearing the user context before switching
	
		client._userContext = null;
		
		return client.getUserContext(username, true).then((user) => {
			if (user && user.isEnrolled()) {
				logger.info('Successfully loaded member from persistence');
				return user;
			} else {
				let caClient = caClients[userOrg];
				return getAdminUser(userOrg).then(function(adminUserObj) {
					member = adminUserObj;
					return caClient.register({
						enrollmentID: username,
						affiliation: userOrg + '.department1'
					}, member);
				}).then((secret) => {
					enrollmentSecret = secret;
					logger.debug(username + ' registered successfully');

					return caClient.enroll({
						enrollmentID: username,
						enrollmentSecret: secret
					});
				}, (err) => {
					console.trace()
					logger.debug(username + ' failed to register');
					logger.debug('123' + err);

					return '' + err;
					//return 'Failed to register '+username+'. Error: ' + err.stack ? err.stack : err;
				}).then((message) => {
					if (message && typeof message === 'string' && message.includes(
							'Error:')) {
						logger.error(username + ' enrollment failed');
						return message;
					}
					logger.debug(username + ' enrolled successfully');

					member = new User(username);
					member._enrollmentSecret = enrollmentSecret;
					return member.setEnrollment(message.key, message.certificate, getMspID(userOrg));
				}).then(() => {
					client.setUserContext(member);
					return member;
				}, (err) => {
					logger.error(util.format('%s enroll failed: %s', username, err.stack ? err.stack : err));
					return '' + err;
				});;
			}
		});
	})
};

var getOrgAdmin = function(userOrg) {
	var admin = ORGS[userOrg].admin;
	var keyPath = path.join(__dirname, admin.key);
	var keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString();
	var certPath = path.join(__dirname, admin.cert);
	var certPEM = readAllFiles(certPath)[0].toString();

	var client = getClientForOrg(userOrg);
	var cryptoSuite = hfc.newCryptoSuite();
	if (userOrg) {
		cryptoSuite.setCryptoKeyStore(hfc.newCryptoKeyStore({path: getKeyStoreForOrg(getOrgName(userOrg))}));
		client.setCryptoSuite(cryptoSuite);
	}

	return hfc.newDefaultKeyValueStore({
		path: getKeyStoreForOrg(getOrgName(userOrg))
	}).then((store) => {
		client.setStateStore(store);

		return client.createUser({
			username: 'peer'+userOrg+'Admin',
			mspid: getMspID(userOrg),
			cryptoContent: {
				privateKeyPEM: keyPEM,
				signedCertPEM: certPEM
			}
		});
	});
};

var getKey = function(username, userOrg)  {
    var org = userOrg;

    var file="/tmp/fabric-client-kvs_peer"+org+"\/"+username;
    var user=JSON.parse(fs.readFileSync( file));
	var signingIdentity = user.enrollment.signingIdentity;
	var certPEM = user.enrollment.identity.certificate.toString();
	var keyPath = "/tmp/fabric-client-kvs_peer"+org+"\/"+signingIdentity+'-priv';
	var keyPEM = fs.readFileSync(keyPath).toString();
	var cryptoContent = {
		privateKeyPEM: keyPEM,
		signedCertPEM: certPEM,
	};
	return cryptoContent;
};
			

var setupChaincodeDeploy = function() {
	process.env.GOPATH = path.join(__dirname, hfc.getConfigSetting('CC_SRC_PATH'));
};

var getLogger = function(moduleName) {
	var logger = tools.getLogger(moduleName);
	return logger;
};



// add new org
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

loadConfig()


exports.loadConfig = loadConfig;
exports.getChannelForOrg = getChannelForOrg;
exports.getClientForOrg = getClientForOrg;
exports.getLogger = getLogger;
exports.setupChaincodeDeploy = setupChaincodeDeploy;
exports.getMspID = getMspID;
exports.ORGS = ORGS;
exports.newPeers = newPeers;
exports.newEventHubs = newEventHubs;
exports.getRegisteredUsers = getRegisteredUsers;
exports.getOrgAdmin = getOrgAdmin;
exports.getKey = getKey;
exports.addNewOrg = addNewOrg;
