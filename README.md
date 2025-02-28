
### tee-plugin动态导入报错 是因为缺包 解决方式：
通过运行：
node --experimental-vm-modules
await import("@elizaos-plugins/plugin-tee") 

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


### docker
docker login
docker build -t mrzqii/elizav1.0.3 .
docker push mrzqii/elizav1.0.3


### phala
如果需要更新docker版本

先点击shutdown
再点击update 保存 就可以了