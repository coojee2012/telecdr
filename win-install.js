const Service = require("node-windows").Service;

const svc = new Service({
  name: "stopen", //服务名称
  description: "停开机服务", //描述
  script: "E:/mykoa/index.js", //nodejs项目要启动的文件路径
});

svc.on("install", () => {
  console.log("install complete.");
  svc.start();
});

svc.install();
