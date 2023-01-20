## 环境要求

- node.js

- python(PIL,numpy)

## 安装

```shell
npm install
```

## 使用方法

### 准备图像

将你的图像保存为 `maintain.png`，大小为 1000 \* 600。透明色指定为 RGB(11, 45, 14)（十进制），为透明色的部分脚本将会忽略不维护，其余地方会绘画在绘版相应位置。

然后运行

```shell
python gen.py
```

将图片转化为数组，存在 `data.js`。

### 准备 token

`./token.txt`为你的`token`，支持多`token`，用换行符分割

可在控制台运行`localStorage.getItem("token");`获得你的`token`。

### 开始维护

`./main.js`为主文件，记得修改 ws url 与 mode。

`node main.js` 运行。

## 分块维护算法

如果块长是 w，则对于第 x 行第 y 列的点的排名指数为 (x mod w) \* 100000000 + x \* 10000 + y。会优先选择排名指数小的点维护。

## 模式

1. 维护：画未完成的图
   
   此时会输出绘制点的坐标与颜色可供查错。

2. 保护：保护已经完成的图
   
   此时你可以适当调低 `setInterval(maintain, 508);` 一行的 cd（毫秒），以获得较高的维护效果。不建议在画未完成的图时这样做。此时只会输出 `Attack`，即每次 `maintain` 维护的点个数，可以用此初步判断攻击你的 `token` 数。

3. 调试
   
   用于调试脚本，输出所有调试信息。
