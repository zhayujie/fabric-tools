'use strict';
var fs = require('fs-extra');

var CONFIG_PATH = '../app/network-config.json'

var config_string = fs.readFileSync("./network-config.json", "utf-8")

var orgname = process.argv[2]

var new_config = JSON.parse(config_string)[orgname]

var all_config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"))

all_config['network-config'][orgname] = new_config

var all_config_string = JSON.stringify(all_config, null, 4)

fs.writeFileSync(CONFIG_PATH, all_config_string)