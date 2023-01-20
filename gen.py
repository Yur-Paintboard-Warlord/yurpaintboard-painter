from PIL import Image
import numpy as np

paint = []
for i in range(0, 600):
  paint.append([])
  for j in range(0, 1000):
    paint[i].append([11, 45, 14])
cnt = 0
def addpaint(img_path):
  global cnt
  img = Image.open(img_path)
  if img.mode != "RGB":
    img = img.convert("RGB")
  img = np.array(img)
  if (img.shape[0] != 600 or img.shape[1] != 1000):
    print("Not 1000x600!")
    return
  for i in range(0, 600):
    for j in range(0, 1000):
      if (paint[i][j][0] == 11 and paint[i][j][1] == 45 and paint[i][j][2] == 14 ):
        paint[i][j] = img[i][j]
        if (paint[i][j][0] == 11 and paint[i][j][1] == 45 and paint[i][j][2] == 14 ):
          cnt += 1
addpaint("maintain.png")

with open("data.js", "w") as f:
  f.write("module.exports=[")
  for i in range(600):
    f.write("[")
    for j in range(1000):
      f.write("[{},{},{}],".format(*paint[i][j]))
    f.write("],\n")

  f.write("]")
print(600000 - cnt)