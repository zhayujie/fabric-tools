## 修改组织和通道名称
### set_config.sh
执行脚本一键设置组织名称和通道名称：
```
./set_config.sh <orgName> <channelName>
```

## 动态增加或删除组织
### new_org.sh 
**动态增加组织**
```
./new_org.sh --add <domain> --number <num>
```
+ domain: 新增组织的域名，域名的第一部分为组织名
+ num: 新增组织中初始节点数量

**删除已有组织**
```
./new_org.sh --del <orgName>
```
+ orgName: 组织名称

### add_org.js
调用SDK实现增加和删除组织的功能

## 多机部署新组织并加入网络
