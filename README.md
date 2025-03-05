
### tee-plugin动态导入报错 是因为缺包 解决方式：
通过运行：
cd agent目录
node --experimental-vm-modules
await import("@elizaos-plugins/plugin-tee") 
通过以上方式可以发现详细的报错

发现缺包：

"@elizaos/core": "workspace:*",
"@phala/dstack-sdk": "0.1.7",
"@solana/spl-token": "0.4.9",
"@solana/web3.js": "1.95.8",
"bignumber.js": "9.1.2",
"bs58": "6.0.0",
"node-cache": "5.1.2",
"pumpdotfun-sdk": "1.3.2",
"tsup": "8.3.5",
"undici": "6.21.1"

安装其他插件的时候也要注意这个问题， 另外注意包的名字是有变化的 需要手动调整

### docker
本地模拟器启动
docker pull phalanetwork/tappd-simulator:latest
# by default the simulator is available in localhost:8090
docker run --rm -p 8090:8090 phalanetwork/tappd-simulator:latest

推镜像到docker hub
docker login
docker build -t mrzqii/elizav1.0.3 .
docker push mrzqii/elizav1.0.3

sudo docker ps


### phala
如果需要更新docker版本
先点击shutdown
再点击update 保存 就可以了

// 没有设置正确的tee 运行环境
ERROR: Error deriving key:
    errno: -2
    code: "ENOENT"
    syscall: "connect"
    address: "/var/run/tappd.sock"
