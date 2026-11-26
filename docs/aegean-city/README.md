# 爱琴余晖

在仓库的实验分支运行 `npm run dev`，打开 [实验入口](http://127.0.0.1:5173/experiments/aegean-city/)。生产预览使用 `npm run build` 和 `npm run preview`，页面位于同一路径。

## 场景设计

这座虚构城邦以公元前 5 世纪的爱琴海为背景。镜头从两座木栈桥和港口信标越过海湾，经过长柱廊与市集，沿挡土墙和石阶抬升至山顶多立克柱式神庙。东坡剧场保留半圆座席和独立舞台。场景采用古典雅典的卫城、山坡与广场关系，半圆石剧场沿用了跨时期的希腊建筑形象。海岸聚落与日常生活取自《Discovery Tour》的观察方向，低矮植被和手工尺度参照《Tiny Glade》。所有可见几何和纹理在项目中生成。[古典卫城](https://ancientathens3d.com/classical-acropolis/) · [卫城南坡](https://ancientathens3d.com/acropolis-south-slope/) · [古典市集](https://ancientathens3d.com/classical-agora/) · [Discovery Tour](https://www.ubisoft.com/en-sg/game/assassins-creed/news/48xoxZPLb5aiXVrQMT9Q2/discovery-tour-ancient-greece-now-available) · [Tiny Glade](https://store.steampowered.com/app/2198150/Tiny_Glade/)

海面沿用反射方向与波纹法线相结合的做法，另用地形生成的深度纹理控制浅滩、岸边泡沫和码头水色。一天中的变化同时驱动太阳、灯火、空气透视和水色。夜间港口高光是跟随波纹的近似反射。[Three.js 水面示例](https://threejs.org/examples/webgl_shaders_ocean.html)

## 浏览器截图

| 视角 | 实际截图 |
| --- | --- |
| 全景与界面 | [默认视图](screenshots/city-ui.jpg) |
| 同机位昼夜 | [06:36 清晨](screenshots/dawn.jpg) · [12:00 正午](screenshots/noon.jpg) · [18:33 黄昏](screenshots/twilight.jpg) · [22:00 夜晚](screenshots/night.jpg) |
| 手机竖屏 | [Pixel 7 模拟](screenshots/mobile.jpg) |
| 地标与地形 | [垂直俯瞰](screenshots/overhead.jpg) · [神庙](screenshots/temple.jpg) · [剧场](screenshots/theatre.jpg) · [港湾](screenshots/harbour.jpg) |

首轮渲染暴露了笔直的右岸、水面等距条纹、朝向广场背面的柱廊与局部路面断裂。后续截图核对了弧形海岸、分层外海岛影、去除水面网格接缝、面向广场的柱列，以及重铺后的贴地道路与卫城入口石阶。

## 观赏操作

左键拖动旋转，右键拖动平移，滚轮缩放。手机可单指旋转、双指缩放和平移。底部可选全景、卫城、剧场、港湾和俯瞰，也可打开环视。拖动时间滑块会暂停自动播放。按 H 或点击右上角按钮可隐藏、恢复控制区。

## 运行验收

- Vite 开发服务器和 Vite 生产预览均在 Chrome 中加载实验入口，返回 HTTP 200。`npm run build` 成功，`npm test` 的 36 个光学断言通过。
- 桌面实测旋转、平移、缩放、回全景、环视、拖动时间、自动播放与暂停，以及隐藏和恢复界面。Pixel 7 触控模拟实测单指旋转、双指缩放、切换预设和隐藏与恢复界面。

- 现代夜城生产入口返回 HTTP 200。另行用浏览器从初光逐关点亮八个街区，确认自动前进、终局、八关存档和重玩。原 Playwright 用例中，画布点镜、移动端解谜、移动端终局观赏通过。桌面终局用例在重载后截图处耗尽 240 秒超时，原桌面八关用例等待通关提示超时。生产八关核验按存档状态和自动前进判断通关。

### 软件渲染性能

Chrome Headless／ANGLE SwiftShader，生产构建，默认黄昏全景，动画开启，1440 × 900 CSS 视口。像素比例自适应后，绘制缓冲区为 898 × 561。预热约 29 帧后采样 30 个浏览器帧间隔，中位数 384.4 ms，P90 420.8 ms。这个软件环境中的镜头动画会卡顿。实际硬件帧率需另行实测。

## 取舍

环境活动集中在海面、船、帆、旗、橄榄树和灯火。本轮省略环境音、行人和港口作业。极近观察仍可看出植被的低多边形、程序化瓦片以及简化的雕塑。移动端验收使用浏览器触控模拟，硬件 GPU 和实体手机的帧率仍待实测。
