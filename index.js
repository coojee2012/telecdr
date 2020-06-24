var fs = require("fs"); //使用nodejs的FS文件模块

var bytesToBinary = function bytesToBinary(bytes) {
  const length = bytes.length;
  let result = "";
  for (let i = 0; i < length; i++) {
    const binStr = Number(bytes[i]).toString(2);
    result += "0".repeat(8 - binStr.length) + binStr; // 不足八位前置补0
  }
  var resultArr = result.split("");
  //console.log(resultArr.length);
  var r = "";
  while (resultArr.length) {
    var a1 = resultArr.shift();
    var a2 = resultArr.shift();
    var a3 = resultArr.shift();
    var a4 = resultArr.shift();
    r += `${Number(a1) * 5 + Number(a2) * 4 + Number(a3) * 2 + Number(a4) * 1}`;
  }
  console.log(r);

  return result.toString();
};
//先判断底层系统是否生成新的文件，如果不存在返回给  页面一个wait，则页面上不做操作
fs.open("20160608.cdr", "r", function (err, result) {
  if (err) {
    if (err.code == "ENOENT") {
      console.log("文件和目录不存在");
      console.info("wait");
    } else {
      console.log("打开文件失败");
      console.error(err);
    }
  } else {
    //若文件存在，则读取文件
    fs.readFile(result, function (err, bytes) {
      if (err) {
        console.log("读取文件失败");
        console.error(err);
      } else {
        var buf = Buffer.from(bytes); //将文件中读取的二进制数据，存入一个buffer对象
        var offset = 0;
        var list = [];
        var line1 = [];

        //遍历buffer中的每一个二进制

        //console.log("buf.length:", buf.slice(36, 46));

        while (offset < buf.length) {
          //console.log("buf.length:", buf.readInt8(offset));
          //list.push(readRecord(buf, offset)); //前两个byte为时间   后面12个  每两个byte 为一个数据点

          // 主叫
          //console.log(bytesToBinary(buf.slice(offset + 36, offset + 40)));

          // 被叫
          console.log(bytesToBinary(buf.slice(offset + 10, offset + 14)));
          offset += 96;
        }
        var charttime = new Date().getTime() + 28800000 - 3000;
        for (var i = 0; i < list.length; i++) {
          line1.push([charttime + i, list[i].value1]);
        }

        console.log(line1);
      }
    });
  }
});
