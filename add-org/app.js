var newOrg = require('./app/add-org.js');
var upgrade = require('./app/upgrade-chaincode.js');

// Add Org
// need: configtxlator listen in 7059
app.post('/channels/:channelName/addNewOrg', function(req, res) {
    logger.info('<<<<<<<<<<<<<<<<< A D D  O R G >>>>>>>>>>>>>>>>>');
    var channelName = req.params.channelName;
    var domain = req.body.domain;
    var fcn = req.body.fcn;
    logger.debug('channelName : ' + channelName);
    
    if (!channelName) {
        res.json(getErrorMessage('\'channelName\''));
        return;
    }
    if (!domain) {
        res.json(getErrorMessage('\'domain\''));
        return;
    }
    if (!fcn || (fcn != 'add' && fcn != 'delete')) {
        res.json(getErrorMessage('\'fcn\''));
        return;
    }
    
    newOrg.addNewOrg(domain, channelName, fcn)
    .then(function(message) {
        res.status(200).send(message);
    }, function(err) {
        res.status(500).send(message);
    });
});

// Upgrade chaincode on all peers
app.post('/channels/:channelName/chaincodes/upgrade', function(req, res) {
    logger.debug('==================== Upgrade CHAINCODE ==================');
    var chaincodeName = req.body.chaincodeName;
    var chaincodeVersion = req.body.chaincodeVersion;
    var channelName = req.params.channelName;
    var peers = req.body.peers;
    var fcn = req.body.fcn;
    logger.debug('channelName  : ' + channelName);
    logger.debug('chaincodeName : ' + chaincodeName);
    logger.debug('chaincodeVersion  : ' + chaincodeVersion);
    if (!chaincodeName) {
        res.json(getErrorMessage('\'chaincodeName\''));
        return;
    }
    if (!chaincodeVersion) {
        res.json(getErrorMessage('\'chaincodeVersion\''));
        return;
    }
    if (!channelName) {
        res.json(getErrorMessage('\'channelName\''));
        return;
    }
    upgrade.upgradeChaincode(peers, channelName, chaincodeName, chaincodeVersion, fcn, req.username, req.orgname)
        .then(function(message) {
            res.send(message);
        });
});
