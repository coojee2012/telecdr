const Service = require("node-windows").Service;

const svc = new Service({
  name: "stopen", //服务名称
  description: "停开机服务", //描述
  script: "E:mykoaindex.js", //nodejs项目要启动的文件路径
});

svc.on("uninstall", function () {
  console.log("Uninstall complete.");
  console.log("The service exists: ", svc.exists);
});

svc.uninstall();
