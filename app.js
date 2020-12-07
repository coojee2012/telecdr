"use strict";
const express = require("express");
const bodyParser = require("body-parser");
const Telnet = require("telnet-client");
const log4js = require("log4js");
const config = require("./config");
const logOptions = require("./log4js.json");
const axios = require("axios");
const querystring = require("querystring");
const iconv = require("iconv-lite");
const BufferHelper = require("bufferhelper");
const { bindHost, bindPort, exchanges, fsAPI } = config;
const app = express();

log4js.configure({
  appenders: {
    app: {
      type: "file",
      filename: "./logs/log_file/app.log",
      maxLogSize: 104800,
      backups: 10,
    },
  },
  categories: { default: { appenders: ["app"], level: "debug" } },
});
const logger = log4js.getLogger("app");
// app.use(log4js.connectLogger(log4js.getLogger("app"), { level: "auto" }));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({limit:'100mb'}));
app.use(bodyParser.urlencoded({ limit:'100mb', extended: true }));
let retryYear = 0;
let retryMonth = 0;
let retryDay = 0;
let retryDays = 0;
let intervalNum = 0;
// these parameters are just examples and most probably won't work for your use-case.
const telnetJx10Options = {
  host: "192.224.2.1",
  port: 23,
  negotiationMandatory: false,
  shellPrompt: "/MML>/", // or negotiationMandatory: false
  timeout: 1500,
  loginPrompt: "/login:/i",
  passwordPrompt: "/password:/i",
  username: "root", //default root
  password: "guest", // default guest
  execTimeout: 1000 * 2, //default 2000 ms
  sendTimeout: 1000 * 2,
  debug: false,
};

const telnetGL04Options = {
  host: "192.224.2.1",
  port: 7005,
  negotiationMandatory: false,
  shellPrompt: "/ROOT/", // or negotiationMandatory: false
  timeout: 1500,
  loginPrompt: "/UserName:/i",
  passwordPrompt: "/PassWord:/i",
  username: "root", //default root
  password: "guest", // default guest
  execTimeout: 1000 * 2, //default 2000 ms
  sendTimeout: 1000 * 2,
  debug: false,
};

const sendJx10Cmd = async (host, cmd, login = false) => {
  const connection = new Telnet();
  let connected = false;
  let bufferHelper = [];
  connection.on("connect", () => {
    connected = true;
  });
  connection.on("data", (buff) => {
    bufferHelper.push(buff);
  });
  connection.on("end", () => {
    console.log(
      "Emitted when the other end of the socket (remote host) sends a FIN packet."
    );
  });
  try {
    const params = Object.assign({}, telnetJx10Options, { host });
    await connection.connect(params);
    logger.debug("connection connected");
    await connection.send("\r\n"); // 发送一个回车开始
    if (login) {
      const login = await connection.send("J1\r\n");
      logger.debug("connection login return:", login);
      const password = await connection.send("J1COD\r\n");
      logger.debug("connection password return:", password);
    }
    bufferHelper = [];
    await connection.send(`${cmd}\r\n`);
    const resStr = iconv.decode(Buffer.concat(bufferHelper), "GBK");
    console.log("cmd return:", resStr);
    logger.info("cmd return:", resStr);
    await connection.end();
    await connection.destroy();
    if (/修改用户属性成功/.test(resStr)) {
      return { success: true, result: resStr };
    } else {
      return { success: false, result: resStr };
    }
  } catch (error) {
    // handle the throw (timeout)
    console.error("error:", error);
    if (connected) {
      await connection.end();
      await connection.destroy();
    }
    return { success: false, message: `指令执行错误：${error.message}` };
  }
};
const sendJx10Auth = async (host,sdn, das,group,login = false) => {
  const connection = new Telnet();
  let connected = false;
  let bufferHelper = [];
  connection.on("connect", () => {
    connected = true;
  });
  connection.on("data", (buff) => {
    bufferHelper.push(buff);
  });
  connection.on("end", () => {
    console.log(
      "Emitted when the other end of the socket (remote host) sends a FIN packet."
    );
  });
  try {
    const params = Object.assign({}, telnetJx10Options, { host });
    await connection.connect(params);
    logger.debug("connection connected");
    await connection.send("\r\n"); // 发送一个回车开始
    if (login) {
      const login = await connection.send("J1\r\n");
      logger.debug("connection login return:", login);
      const password = await connection.send("J1COD\r\n");
      logger.debug("connection password return:", password);
    }
    
    let cmd = '';
    // 判断是否曾经添加过
    bufferHelper = [];
    cmd  = `SHW CSATTR:GROUP=${group}:SDN=${sdn}:`;
    await connection.send(`${cmd}\r\n`);
    let resStr = iconv.decode(Buffer.concat(bufferHelper), "GBK");
    console.log(`cmd ${cmd} return: ${resStr}`);
    logger.info(`cmd ${cmd} return: ${resStr}`);

   
    if (/用户不存在/.test(resStr)) {
      cmd=`ADD CS SUB:GROUP=${group}:GRPNAME=0:SDN=${sdn}:NAME=0:ADDRESS=0:PHONE=0:TPDAS=${das}:DDI=0:TPLMTSET=0:MATCHOP=0:SAVEOP=0:REGETSUB=0:OWEFEE=0:ISLMTGRP=0:`;
    } else {
      cmd=`MOD CS SUB:GROUP=${group}:SDN=${sdn}:NAME=0:ADDRESS=0:PHONE=0:TPDAS=${das}:DDI=-1:TPLMTSET=-1:MATCHOP=-1:SAVEOP=-1:REGETSUB=-1:OWEFEE=-1:ISLMTGRP=-1:`;
    }
    bufferHelper = [];
    resStr = '';
    await connection.send(`${cmd}\r\n`);
    resStr = iconv.decode(Buffer.concat(bufferHelper), "GBK");
    console.log(`cmd ${cmd} return: ${resStr}`);
    logger.info(`cmd ${cmd} return: ${resStr}`);
    await connection.end();
    await connection.destroy();
    if (/鉴权用户成功/.test(resStr)) {
      return { success: true, result: resStr };
    } else {
      return { success: false, result: resStr };
    }
  } catch (error) {
    // handle the throw (timeout)
    console.error("error:", error);
    if (connected) {
      await connection.end();
      await connection.destroy();
    }
    return { success: false, message: `指令执行错误：${error.message}` };
  }
};
const sendGL04Cmd = async (host, cmd, exchange, login = false) => {
  const connection = new Telnet();
  let connected = false;
  let bufferHelper = [];
  connection.on("connect", () => {
    connected = true;
  });
  connection.on("data", (buff) => {
    bufferHelper.push(buff);
  });
  connection.on("end", () => {
    console.log(
      "Emitted when the other end of the socket (remote host) sends a FIN packet."
    );
  });
  try {
    const params = Object.assign({}, telnetGL04Options, { host });
    await connection.connect(params);
    logger.debug("connection connected");
    const welcome = await connection.send("\r\n"); // 发送一个回车开始
    //console.log(welcome);
    if (login) {
      const login = await connection.send("a\n");
      //console.log("connection login return:", login);
      const password = await connection.send("a\n");
      //console.log("connection password return:", password);
    }
    const cdexchange = await connection.send(`cd ${exchange}\n`);
    //console.log("cdexchange return:",cdexchange);
    bufferHelper = [];
    const cmdReturn = await connection.send(`${cmd}\n`);
    //console.log("cmdReturn return:",cmdReturn);
    const resStr = iconv.decode(Buffer.concat(bufferHelper), "GBK");
    //console.log("cmd return:", resStr);
    logger.info("cmd return:", resStr);
    await connection.end();
    await connection.destroy();
    if (/修改用户群号成功/.test(resStr)) {
      return { success: true, result: resStr };
    } else {
      return { success: false, result: resStr };
    }
  } catch (error) {
    // handle the throw (timeout)
    console.error("error:", error);
    if (connected) {
      await connection.end();
      await connection.destroy();
    }
    return { success: false, message: `指令执行错误：${error.message}` };
  }
};
app.all("*", async (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
  res.header("X-Powered-By", " 3.2.1");
  res.header("Content-Type", "application/json;charset=utf-8");
  next();
});
app.get("/health", async (req, res) => {
  logger.info("check health:", req.hostname);
  try {
    const url = `${fsAPI}/show?status`;
    const response = await axios.get(url, {
      auth: {
        username: "f7811",
        password: "w7811",
      },
      responseType: "text",
      // timeout: 30,
      // maxRedirects: 5, // default
    });
    res.status(200).send("ok");
  } catch (error) {
    logger.error("Something went wrong in health check:", error.message);
    res.status(200).send(error.message);
  }
});
// 测试用
app.post("/post", async (req, res) => {
  //console.log(JSON.stringify(req.body));
  const OUT_BUREAU = [];
  req.body.forEach((element) => {
    OUT_BUREAU.push(element.OUT_BUREAU);
  });
  console.log(OUT_BUREAU + "\r\n");
  var result = { code: 200, message: "post请求成功" };
  res.send(result);
});
/**
 * exchange:  交换局
 * sdn: 电话号码
 * das: 群号
 * islocal: 是否本地 （0控制下挂交换机，1控制本交换机）
 * group: 群组（大部分是3，默认采用-1即可）
 */
app.all("/stopen/:exchange/:sdn/:das/:islocal/:group", async (req, res) => {
  const { exchange, sdn, das,islocal,group } = req.params;
  console.log("stopen request params:", { exchange, sdn, das });
  if (exchange && sdn && das) {
    const exc = exchanges.find((v) => {
      return v.exchangeNum === exchange;
    });
    if (
      ["jx10576", "jx10680"].indexOf(exc.pbxType) > -1 &&
      ["1", "11", "12", "13", "41"].indexOf(das) < 0
    ) {
      res.send({ success: false, message: "群号错误" });
      return;
    } else if (
      ["gl04500"].indexOf(exc.pbxType) > -1 &&
      ["1", "11", "12", "13", "41"].indexOf(das) < 0
    ) {
      res.send({ success: false, message: "群号错误" });
      return;
    }

    if (!!exc) {
      const cmd = `UPDATE_SUB_ATTR:SDN=${sdn}:NUM=1:DAS=${das}:`;
      if (exc.pbxType === "jx10576") {
        let result = { success: false, result: '' };
        if(islocal === '0'){
          result = await sendJx10Auth(exc.ipAddr, sdn, das,group,false);
        }else{
           result = await sendJx10Cmd(exc.ipAddr, cmd, false);
        }
        res.status(200).send(result);
      } else if (exc.pbxType === "jx10680") {
        const result = await sendJx10Cmd(exc.ipAddr, cmd, true);
        res.status(200).send(result);
      } else if (exc.pbxType === "gl04500") {
        const result = await sendGL04Cmd(
          exc.ipAddr,
          `0c0c ${sdn} ${das}`,
          500,
          true
        );
        res.status(200).send(result);
      } else {
        res.status(200).send({
          success: false,
          message: "暂时不支持该类型交换机指令",
        });
      }
    } else {
      res.status(200).send({ success: false, message: "没有找到交换局" });
    }
  } else {
    res.status(200).send({ success: false, message: "请求参数错误" });
  }
});

app.all("/notice/:phone/:ntype", async (req, res) => {
  const { phone, ntype } = req.params;
  if (phone && ntype) {
    try {
      const paramstr = querystring.unescape(
        `{ignore_early_media=true}sofia/gateway/mx8/${phone} ${ntype}`
      );
      const url = `${fsAPI}/originate?${paramstr}`;
      const response = await axios.get(url, {
        auth: {
          username: "f7811",
          password: "w7811",
        },
        responseType: "text",
        // timeout: 30,
        // maxRedirects: 5, // default
      });
      res.status(200).send({ success: true, data: response.data });
    } catch (error) {
      logger.error("Something went wrong:", error.message);
      res.status(200).send({ success: false, message: error.message });
    }
  } else {
    res.status(200).send({ success: false, message: "请求参数错误" });
  }
});

app.all("/retrycdr/:year/:month/:day/:days", async (req, res) => {
  const { year, month, day, days } = req.params;
  if (year && month) {
    try {
      retryYear = year;
      retryMonth = month;
      retryDay = day;
      retryDays = days;
      res.status(200).send({ success: true });
    } catch (error) {
      logger.error("Something went wrong:", error.message);
      res.status(200).send({ success: false, message: error.message });
    }
  } else {
    res.status(200).send({ success: false, message: "请求参数错误" });
  }
});

app.all("/cdrconfig/:interval", async (req, res) => {
  let { interval } = req.params;
  if (interval) {
    try {
      interval = Number(interval);
      intervalNum = interval >= 5 ? interval : 0;
      res.status(200).send({ success: true });
    } catch (error) {
      logger.error("Something went wrong:", error.message);
      res.status(200).send({ success: false, message: error.message });
    }
  } else {
    res.status(200).send({ success: false, message: "请求参数错误" });
  }
});

app.all("/getcdrconf", async (req, res) => {
  try {
    const sendData = Object.assign(
      {},
      {
        code: 200,
        year: retryYear,
        month: retryMonth,
        day: retryDay,
        days: retryDays,
        interval: intervalNum,
      }
    );
    retryYear = 0;
    retryMonth = 0;
    retryDay = 0;
    retryDays = 0;
    intervalNum = 0;
    res.status(200).send(sendData);
  } catch (error) {
    logger.error("Something went wrong:", error.message);
    res.status(200).send({ code: 500, success: false, message: error.message });
  }
});

app.use((req, res, next) => {
  const err = new Error("Not Found");
  err.status = 404;
  next(err);
});
app.use((err, req, res, next) => {
  logger.error("Something went wrong:", err.message);
  res.status(err.status || 500);
  res.status(500).send({
    message: err.message,
  });
});
app.listen(bindPort, bindHost, function () {
  console.log(`服务器运行在http://${bindHost}:${bindPort}`);
});
