var newOrg = require('./add-org.js');
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