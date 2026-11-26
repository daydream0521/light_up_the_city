# 两岸灯火 v2

运行 `npm run dev`，打开 [上海实验入口](http://127.0.0.1:5173/experiments/shanghai-city/)。构建与预览使用 `npm run build` 和 `npm run preview`。

## 构图实验

| 原版 | 完整沙盘试拍 | 保留外围街区试拍 | 正式重制 |
| --- | --- | --- | --- |
| [ff725b4 蓝调](../shanghai-city/screenshots/city-ui.jpg) | [蓝调斜俯视](studies/board/city-ui.jpg) · [垂直俯瞰](studies/board/top.jpg) | [蓝调斜俯视](studies/context/city-ui.jpg) | [蓝调斜俯视](screenshots/city-ui.jpg) |

试拍后选择完整沙盘。外围街区试拍保留了更宽的航拍视野，城市尽头仍出现直线切边。沙盘让江道切面、两岸街区与底座边缘成为同一个展件。在弱透视全景里同时展出黄浦江弯道、外滩暖光和陆家嘴高层，保留外滩望江的低机位。

第一轮沙盘截图中，外侧边角贴屏，水面受远处天色影响偏灰。后续拉开机位、改变相机方位以拆开高层轮廓、保留完整底座边距，并减弱水体远距离混色。建筑试拍还暴露了上海中心塔冠重叠、近景的棚底地平线接缝和地面条纹。最终移除重叠塔冠面，让棚底与天空连续过渡，并限制石材纹理在远距离的响应。

## 建筑重制

- 东方明珠增加球体分块接缝、观景带玻璃和竖梃、裙楼与支撑接点。玫红球体和冷色支柱独立显形。[上海市资料](https://english.shanghai.gov.cn/en-ScenicSpots/20231205/19a5f5184eca45728fd57a4d4c8efc61.html) · [Otis 项目资料](https://www.otis.com/en/eg/our-company/global-projects/project-showcase/oriental-pearl-tower)
- 上海中心弱化均匀窗格，以扭转外壳、低对比设备带、独立塔冠和两层裙楼形成层次。环球金融中心增加真实开口边框、顶部横梁的竖梃与塔身边缘分割，保留贯通空间。金茂大厦用渐缩切角截面替代相互穿插的矩形，逐层加入竖框、退台冠线与尖顶。 [Gensler](https://www.gensler.com/projects/shanghai-tower) · [KPF](https://www.kpf.com/project/shanghai-world-financial-center) · [SOM](https://www.som.com/projects/jin-mao-tower/)
- 海关钟楼新增长窗、塔冠收边、连廊入口与阶梯。和平饭店增加铜顶接缝、立面竖饰与雨棚。外滩沿江保留 OSM 轮廓，以汇丰银行大楼的柱廊和穹顶、拱廊、古典、装饰艺术及阁楼原型区分邻接楼栋。部分重点建筑按 OSM 标识选用相应立面，其余使用风格化原型。[海关大楼](https://touch.shio.gov.cn/jsp/zfxw_detail.jsp?id=20250929181837586) · [和平饭店](https://service.shanghai.gov.cn/sheninfo/specialdetail.aspx?Id=53fcda72-b6ba-4c67-8861-d567d0257cc8) · [汇丰建筑研究](https://link.springer.com/article/10.1186/s43238-022-00067-9) · [外滩逐栋资料](https://www.shanghaitourism.org/the-bund-architecture-guide/)
- 普通楼栋按体量和区位采用玻璃塔楼、裙楼、退台、横向楼板和低层体量，细化集中在两岸岸线与核心建筑旁。街墙基脚加深，石材、铜屋面、玻璃和水面使用各自的表面响应。「点亮两岸」沿用原有约 24 秒节奏，保留两岸分段亮灯和游船、车灯与江面反射。

## 浏览器实拍对照

预设机位和时间保持可比。全景改为弱透视，俯瞰的画幅现在包含沙盘边缘。原版图直接引用 `ff725b4` 已保存的浏览器截图。

| 视角 | 原版 | 重制 |
| --- | --- | --- |
| 默认全景 | [原版](../shanghai-city/screenshots/city-ui.jpg) | [重制](screenshots/city-ui.jpg) |
| 垂直俯瞰 | [原版](../shanghai-city/screenshots/top.jpg) | [重制](screenshots/top.jpg) |
| 外滩近景 | [原版](../shanghai-city/screenshots/pudong.jpg) | [重制](screenshots/pudong.jpg) |
| 陆家嘴天际线 | [原版](../shanghai-city/screenshots/bund.jpg) | [重制](screenshots/bund.jpg) |
| 东方明珠 | [原版](../shanghai-city/screenshots/pearl.jpg) | [重制](screenshots/pearl.jpg) |
| 上海中心 | [原版](../shanghai-city/screenshots/tower.jpg) | [重制](screenshots/tower.jpg) |
| 环球金融中心 | [原版](../shanghai-city/screenshots/finance.jpg) | [重制](screenshots/finance.jpg) |
| 金茂大厦 | [原版](../shanghai-city/screenshots/jin.jpg) | [重制](screenshots/jin.jpg) |
| 海关大楼 | [原版](../shanghai-city/screenshots/customs.jpg) | [重制](screenshots/customs.jpg) |
| 和平饭店 | [原版](../shanghai-city/screenshots/peace.jpg) | [重制](screenshots/peace.jpg) |
| 昼夜 | [白昼](../shanghai-city/screenshots/day.jpg) · [黄金](../shanghai-city/screenshots/gold.jpg) · [蓝调](../shanghai-city/screenshots/blue.jpg) · [深夜](../shanghai-city/screenshots/night.jpg) | [白昼](screenshots/day.jpg) · [黄金](screenshots/gold.jpg) · [蓝调](screenshots/blue.jpg) · [深夜](screenshots/night.jpg) |
| 演出完成 | [原版](../shanghai-city/screenshots/show.jpg) | [重制](screenshots/show.jpg) |
| 手机 | [原版](../shanghai-city/screenshots/mobile.jpg) | [重制](screenshots/mobile.jpg) |

## 数据、许可与艺术化范围

原 [OSM 数据](../../src/experiments/shanghai-city/map.json)来自 2026-11-25 UTC 的上海提取包。重制直接使用该文件。沙盘从原地表裁出约 2.58 × 1.86 公里的圆角展陈范围，核心河道、道路走向及六座地标位置沿用原数据。出框楼栋隐藏，外围简化，部分普通楼栋压低以免遮住地标。底座、立面、环境设施和窗口照明为美术设计。建筑分区、颜色与布局取舍均为模型表达。

原数据和衍生的 [底座裁剪数据](../../src/experiments/shanghai-city/display-cut.json)以 [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) 提供，页面显示 OpenStreetMap contributors 署名。来源及预处理细节见[原版数据说明](../shanghai-city/README.md)。

## 验收

- Chrome 开发与生产入口均返回 HTTP 200。生产构建和 36 项光学断言通过。
- 开发版在桌面验证了拖动旋转、平移、缩放、预设、环视、时间滑块、自动播放和暂停、隐藏与恢复，以及四段灯光秀播放和重播。Pixel 7 模拟验证了单指旋转、双指缩放、预设和界面操作。首次移动端截图被开发时的热重载中断，源码稳定后重新通过。
- 生产预览中，现代夜城通关八个街区，验证自动前进、存档、重载终局和重玩。《爱琴余晖》验证了卫城机位、夜晚与界面操作。采用定向回归，未重跑完整原 Playwright 套件。旧桌面套件超时已在[爱琴余晖验收](../aegean-city/README.md)记录。

## 软件渲染性能

Chrome Headless／ANGLE SwiftShader，生产构建默认蓝调全景，动画开启。1440 × 900 视口自适应至 876 × 547 绘制缓冲区。单独运行且预热 28 帧后，采样 30 个浏览器帧间隔，中位数为 237.5 ms，P90 为 270.7 ms。原版报告分别为 237.6 ms 和 287.4 ms，两个版本使用各自默认机位。软件环境中的镜头运动仍会卡顿，硬件 GPU 与实体手机帧率待实测。

## 已知限制

放大后仍能看出局部历史窗洞是叠层阴影和框线，个别后街体量只保留屋顶和轮廓。底座边缘为明确的截景，主要道路在边缘终止。天气、室内和实体手机性能均未覆盖。
