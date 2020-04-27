# Hyperledger Fabric自动化部署工具集

本项目包含一系列对fabric区块链进行动态调整组织和自动化部署的工具，旨在简化fabric网络在部署或变更时繁杂的配置和操作流程，提高生产环境下的运维效率。

项目的实现过程和踩坑细节可参考[博客](http://zhayujie.com/category/fabric/)。以下文档以[balance-transfer](https://github.com/hyperledger/fabric-samples/tree/release-1.0/balance-transfer)项目为例介绍如何在实际项目中集成这些工具。

## 功能一：修改组织和通道名称
代码位于`modify-org`目录中，将该目录下所有文件根据相对路径放入实际项目中。执行set_config.sh脚本可完成组织和通道名称的修改：
```
./set_config.sh <orgName> <channelName>
```
+ orgName: 组织名称
+ channelName: 通道名称

具体参见：[详细文档](http://zhayujie.com/fabric/modify-orgname.html)

## 功能二：动态增加或删除组织
代码位于`add-org`目录中
+ 首先需要把app.js、add-org.js等二次开发的代码整合到实际项目中：add-org.js放置于app/目录下，并在app.js中添加addNewOrg接口；
+ 将new_org.sh和crypto-new-org-template.yaml文件放入项目的artifacts目录下；
+ 编译生成configtxlator工具，与new_org.sh脚本置于同一目录下。

完成准备工作后即可实现以下功能：

1.动态增加组织
```
./new_org.sh --add <domain> --number <num>
```
+ domain: 新增组织的域名，域名的第一部分为组织名
+ num: 新增组织中初始节点数量

2.删除已有组织
```
./new_org.sh --del <orgName>
```
+ orgName: 组织名称

具体参见：[详细文档](http://zhayujie.com/fabric/add-org.html)

## 功能三：多机部署新组织并加入网络
代码位于`multi-machine-deploy`目录中。在此之前，应用程序需参考上一节实现使用SDK增加组织的接口。
### 第一步
将deploy/目录放置于待加入的机器上，并在目录下执行以下命令。将自动安装所需镜像及依赖，新组织默认为1CA, 2peer, 2couchdb的架构：
```
sudo ./deploy.sh --domain <domain>  --order <ordererIp>
```
+ domain: 新加组织的域名
+ orderIp: orderer节点所在机器的ip
```
例： sudo ./deploy.sh --domain org3.example.com --order 192.168.1.51
```

### 第二步
首先将new-org/目录放置于应用程序的根目录下（如balance-transfer/new-org），然后把上一步在deploy/artifacts下生成的新组织的证书目录 (如org3.example.com) 复制一份到new-org目录中，并在new-org目录下执行脚本：
```
sudo ./add_org.sh --org <orgName> --ip <ip>
```
+ orgName: 组织名称
+ ip: 新组织所在机器的ip
```
例： sudo ./add_org.sh --org org3 --ip 192.168.1.52
```
具体参见：[详细文档](http://zhayujie.com/fabric/multi-host.html)
