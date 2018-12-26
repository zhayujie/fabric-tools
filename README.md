## 修改组织和通道名称
### set_config.sh
执行脚本一键设置组织名称和通道名称：
```
./set_config.sh <orgName> <channelName>
```
eg:
```
./set_config.sh <RUC> <rucChannel>
```
值得注意的是，该脚本只能修改一个组织的名称，暂不支持两个组织同时修改。

## 在组织中添加新的节点
### new_peer.sh
执行脚本一键在通道中新增新的节点
```
./new_peer.sh --token <ORG_TOKEN> --number <num>
```
### 说明：
该脚本需要的条件，该脚本传入的第一个参数是需要添加组织的token，获取方法见我的笔记。https://app.yinxiang.com/shard/s61/nl/21811079/208e9cd9-8626-46e1-8eac-98ef153473c8/
该脚本使用的文件有:
+ new-peer-templete.yaml用于为新的Peer节点创建一个新的docker容器。
+ cryptogenNewPeer.yaml用于追加新的证书时使用的文件。
+ network-config.yaml用于通信

## 动态增加或删除组织
### new_org.sh 
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

### add_org.js
调用SDK实现增加和删除组织的功能

## 多机部署新组织并加入网络
### 第一步
将deploy目录拷贝至新加入的机器，在目录下执行：
```
sudo ./deploy.sh --domain <domain>  --order <ordererIP>
```

(domain参数：新加组织的域名， order参数：orderer节点所在的ip地址)
```
e.g.     sudo ./deploy.sh --domain archain.example.com --order 192.168.1.51
```

### 第二步
将deploy/artifacts目录下生成的新组织证书目录 (e.g. airchain.example.com) 拷贝到应用程序所在服务器的airtrip/new-org目录下，并在new-org目录下执行：
```
sudo ./add_org.sh - -org <orgName> --ip <IP>
```

（org参数：新加组织的名称，ip参数：新组织所在机器的ip地址）
```
e.g.     sudo ./add_org.sh --org airchain --ip 192.168.1.52
```
