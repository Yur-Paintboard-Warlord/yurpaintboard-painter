const WebSocket = require('ws');
const ZSTDDecoder = require("./zstd.js");
const WS_URL = "wss://paint.d0j1a1701.cc/api/ws"; // ws url
const Data = require("./data"); // 画的内容，[600][1000]（详见 readme）
const fs = require('fs');

const mode = 1; // 1 维护 2 保护 3 调试（详见 readme）

fs.readFile('./tokens.txt', (err, data) => {
  if (err) {
    console.error(err);
    return
  }
  console.log(data.toString());
  tokens = data.toString().split(/\r?\n/);
  if (tokens == 0) {
    console.log("[ERROR] No Token!");
    return;
  }
  console.log("[INFO] %d token(s) read.", tokens.length);
  console.log("[INFO] try create main ws(%s).", tokens[0].substring(0, 6));
  createWs(tokens[0], true);
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] == 0) {
      console.log("[WARNING] token(%d)=\"%s\" skipped", i + 1, tokens[i]);
      continue;
    }
    console.log("[INFO] try create ws(%s).", tokens[i].substring(0, 6));
    createWs(tokens[i], false);
  }
  setInterval(maintain, 508); // 选择保护选项时可以适当调小
});

const W = 1000;
const H = 600;
let wsList = []; // 可用 ws 列表

const board = Array.from(Array(H), () => new Array(W)); // 绘版状态，不要用除了 update 和 updateraw 的方式修改。

const inq = Array.from(Array(H), () => new Array(W)); // 是否在维护队列里面，防止多次入队
const wait = Array.from(Array(H), () => new Array(W)); // 是否在等 ws 更新自己的画图指令，防止调动入队
const justt = Array.from(Array(H), () => new Array(W)); // 是否刚刚更新过，防止延迟再次扫到自己
// 以上三个数组用于增加维护效率。

function coloreq(a, b) {
  // b 存放的是 Data 中的值，只有 b 中有透明色才会看作透明。
  if (b[0] == 11 && b[1] == 45 && b[2] == 14) return true;
  return a[0] == b[0] && a[1] == b[1] && a[2] == b[2];
}

function update(a) {
  if (mode == 3) console.log("[INFO] update ", a, " -> ", Data[a.y][a.x]);
  mypush([a.y, a.x]); // 需要更新
  updateraw(a);
}

function updateraw(a) {
  board[a.y][a.x] = a.c;
}

let allOk = false; // 是否载入了版面

function createWs(token, isMain) {
  // isMain：是否是主 token。
  let ws = null, open = false;
  try {
    ws = new WebSocket(WS_URL);
  } catch (e) {
    console.alert("[ERROR] Can't connect to ws server.");
    return;
  }
  ws.binaryType = "arraybuffer";
  ws.onopen = () => {
    open = true;
    const hex_token = token.replaceAll("-", "");
    let token_msg = [0xff];
    console.log("[INFO] token(%s) send auth", token.substring(0, 6));
    for (let i = 0; i < 16; ++i) {
      const byte = parseInt(hex_token.slice(i * 2, i * 2 + 2), 16);
      token_msg.push(byte);
    }
    ws.send(new Uint8Array(token_msg));
  };
  if (isMain) {
    ws.onmessage = (event) => {
      const raw_data = new Uint8Array(event.data);
      const [type, data] = [raw_data[0], raw_data.slice(1)];
      switch (type) {
        case 0xfc: { // 验证成功
          console.log("[INFO] main token (%s) success", token.substring(0, 6));
          ws.send(new Uint8Array([0xf9]));
          wsList.push(ws)
          break;
        }
        case 0xfd: { // 验证失败
          console.log("[INFO] main token (%s) dead");
          break;
        }
        case 0xfb: { // 获得版面，这里使用 update 会导致无用入队
          const decoder = new ZSTDDecoder();
          decoder.init()
            .then(() => {
              const board = decoder.decode(data, 1800000);
              if (board.length !== 1800000) {
                console.log("Len:", board.length);
                alert("Paintboard broken.");
              }
              let idx = 0;
              for (let x = 0; x < W; ++x) {
                for (let y = 0; y < H; ++y) {
                  updateraw({ y, x, c: board.slice(idx, idx + 3) });
                  idx += 3;
                }
              }
              console.log("[INFO] board loaded.");
              allOk = true;
            });
          break;
        }
        case 0xfa: { // 更新并判断入队
          for (let i = 0; i < data.length; i += 7) {
            const x = data[i + 1] * 256 + data[i];
            const y = data[i + 3] * 256 + data[i + 2];
            const c = data.slice(i + 4, i + 7);
            if (coloreq(c, Data[y][x]) || wait[y][x]) {
              wait[y][x] = 0;
              updateraw({ x, y, c });
            } else {
              update({ x, y, c });
            }
          }
          break;
        }
        case 0xf8: { // ping
          ws.send(new Uint8Array([0xf7]));
        }
      }
    };
  }
  else {
    ws.onmessage = (event) => {
      const raw_data = new Uint8Array(event.data);
      const [type, data] = [raw_data[0], raw_data.slice(1)];
      switch (type) {
        case 0xfc: { // 验证成功
          console.log("[INFO] token(%s) success", token.substring(0, 6));
          wsList.push(ws)
          break;
        }
        case 0xfc: { // 验证失败
          console.log("[INFO] token(%s) dead");
          wsList.push(ws)
          break;
        }
        case 0xf8: { // ping
          ws.send(new Uint8Array([0xf7]));
        }
      }
    };
  }
}

function mypush(x) {
  // 入队
  if (inq[x[0]][x[1]]) return;
  mqueue.push(x);
  inq[x[0]][x[1]] = 1;
}
function mypop() {
  // 出队
  let ret = mqueue.shift();
  inq[ret[0]][ret[1]] = 0;
  return ret;
}

let mqueue = [];

let nowplc = 0;
function getws() {
  // 获得下一个 token。轮换使用 token。
  let ret = wsList[nowplc];
  nowplc = (nowplc + 1) % wsList.length;
  return ret;
}

function maintainq() {
  // 维护队列里面列表，最多 token 个数次。
  let x = 0;
  while (++x <= wsList.length && mqueue.length) {
    let s = mypop();
    if (mode != 2) {
      console.log("[INFO] Now maintain (%d,%d) by token#%d", s[1], s[0], nowplc + 1);
      console.log(Data[s[0]][s[1]]);
    }
    change(getws(), s[1], s[0], Data[s[0]][s[1]]);
    wait[s[0]][s[1]] = justt[s[0]][s[1]] = 1;
  }
  console.log("[INFO] Attack: %d", x - 1);
}

function maintain() {
  console.log("[INFO] Maintaining with %d tokens", wsList.length);
  if (!allOk) {
    return;
  }
  if (wsList.length == 0) return;
  const blocksize = 25; // 块长
  for (let i = 0; i < blocksize; ++i) {
    for (let k = 0; k < W; ++k) {
      for (let j = i; j < H; j += blocksize) {
        // 分块维护（详见 readme）
        if (!coloreq(board[j][k], Data[j][k])) {
          if (justt[j][k]) {
            justt[j][k] = 0;
          } else {
            if (mode == 3) {
              console.log("Find difference: (%d,%d)", k, j);
            }
            mypush([j, k]);
          }
          if (mqueue.length >= wsList.length) {
            maintainq();
            return;
          }
        }
      }
    }
  }
  maintainq();
}

function change(ws, x, y, c) {
  if (!allOk) {
    return;
  }
  const msg = [
    0xfe,
    x & 255, (x >> 8) & 255,
    y & 255, (y >> 8) & 255,
    c[0], c[1], c[2]
  ];
  ws.send(new Uint8Array(msg));
};
