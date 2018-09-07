## 修改组织和通道名称
### set_config.sh
执行脚本一键设置组织名称和通道名称：
```
./set_config.sh <orgName> <channelName>
```

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
**第一步：**将deploy目录拷贝至新加入的机器，在目录下执行：
```
sudo ./deploy.sh --domain <domain>  --order <ordererIP>
```

(domain参数：新加组织的域名， order参数：orderer节点所在的ip地址)
```
e.g.     sudo ./deploy.sh --domain archain.example.com --order 192.168.1.51
```

**第二步：**将deploy/artifacts目录下生成的新组织证书目录(e.g. airchain.example.com)拷贝到应用程序所在服务器的airtrip/new-org目录下。并在new-org目录下执行：
```
sudo ./add_org.sh - -org <orgName> --ip <IP>
```

（org参数：新加组织的名称，ip参数：新组织所在机器的ip地址）
```
e.g.     sudo ./add_org.sh --org archain --ip 192.168.1.52
```