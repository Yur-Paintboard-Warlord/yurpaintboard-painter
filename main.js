const WebSocket = require('ws');
const ZSTDDecoder = require("./zstd.js");
const WS_URL = "wss://paint.d0j1a1701.cc/api/ws"; // ws url
const Data = require("./data"); // �������ݣ�[600][1000]����� readme��
const fs = require('fs');

const mode = 1; // 1 ά�� 2 ���� 3 ���ԣ���� readme��

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
  setInterval(maintain, 508); // ѡ�񱣻�ѡ��ʱ�����ʵ���С
});

const W = 1000;
const H = 600;
let wsList = []; // ���� ws �б�

const board = Array.from(Array(H), () => new Array(W)); // ���״̬����Ҫ�ó��� update �� updateraw �ķ�ʽ�޸ġ�

const inq = Array.from(Array(H), () => new Array(W)); // �Ƿ���ά���������棬��ֹ������
const wait = Array.from(Array(H), () => new Array(W)); // �Ƿ��ڵ� ws �����Լ��Ļ�ͼָ���ֹ�������
const justt = Array.from(Array(H), () => new Array(W)); // �Ƿ�ոո��¹�����ֹ�ӳ��ٴ�ɨ���Լ�
// ��������������������ά��Ч�ʡ�

function coloreq(a, b) {
  // b ��ŵ��� Data �е�ֵ��ֻ�� b ����͸��ɫ�Żῴ��͸����
  if (b[0] == 11 && b[1] == 45 && b[2] == 14) return true;
  return a[0] == b[0] && a[1] == b[1] && a[2] == b[2];
}

function update(a) {
  if (mode == 3) console.log("[INFO] update ", a, " -> ", Data[a.y][a.x]);
  mypush([a.y, a.x]); // ��Ҫ����
  updateraw(a);
}

function updateraw(a) {
  board[a.y][a.x] = a.c;
}

let allOk = false; // �Ƿ������˰���

function createWs(token, isMain) {
  // isMain���Ƿ����� token��
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
        case 0xfc: { // ��֤�ɹ�
          console.log("[INFO] main token (%s) success", token.substring(0, 6));
          ws.send(new Uint8Array([0xf9]));
          wsList.push(ws)
          break;
        }
        case 0xfd: { // ��֤ʧ��
          console.log("[INFO] main token (%s) dead");
          break;
        }
        case 0xfb: { // ��ð��棬����ʹ�� update �ᵼ���������
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
        case 0xfa: { // ���²��ж����
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
        case 0xfc: { // ��֤�ɹ�
          console.log("[INFO] token(%s) success", token.substring(0, 6));
          wsList.push(ws)
          break;
        }
        case 0xfc: { // ��֤ʧ��
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
  // ���
  if (inq[x[0]][x[1]]) return;
  mqueue.push(x);
  inq[x[0]][x[1]] = 1;
}
function mypop() {
  // ����
  let ret = mqueue.shift();
  inq[ret[0]][ret[1]] = 0;
  return ret;
}

let mqueue = [];

let nowplc = 0;
function getws() {
  // �����һ�� token���ֻ�ʹ�� token��
  let ret = wsList[nowplc];
  nowplc = (nowplc + 1) % wsList.length;
  return ret;
}

function maintainq() {
  // ά�����������б���� token �����Ρ�
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
  const blocksize = 25; // �鳤
  for (let i = 0; i < blocksize; ++i) {
    for (let k = 0; k < W; ++k) {
      for (let j = i; j < H; j += blocksize) {
        // �ֿ�ά������� readme��
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
