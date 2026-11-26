# 两岸灯火

运行 `npm run dev`，打开 [上海实验入口](http://127.0.0.1:5173/experiments/shanghai-city/)。生产构建使用 `npm run build` 和 `npm run preview`，路径同为 `/experiments/shanghai-city/`。

## 城市与灯光

黄浦江的弯道、外滩向江连续排开的历史建筑和陆家嘴的高层天际线决定了构图。默认从南侧沿江望向蓝调时刻的两岸。点「外滩望江」可从低机位看东方明珠和三座高楼，点「浦东望西」可看到海关钟楼、和平饭店和暖光下的石材立面。

「点亮两岸」约 24 秒。先从黄金时刻开始，随后外滩暖光沿江展开，浦东的窗灯与地标轮廓分层亮起，最后点亮岸灯与船灯。人工灯光使用原创编排。演出结束后保留最终时刻，可直接自由观赏或重播。

江面使用低分辨率平面反射，并以两种尺度的连续噪声扰动反射坐标。船沿水域横截面内航行，尾迹为程序化图形。车辆沿滨水附近的 OSM 道路折线平滑移动。步道、栏杆和短码头是艺术化搭建。

## 数据、裁剪与署名

2026 年 11 月 26 日取得 [OpenStreetMap France 上海提取包](https://download.openstreetmap.fr/extracts/asia/china/shanghai.osm.pbf)，PBF 记录的快照为 2026-11-25 00:29:03 UTC。部分 Overpass 与 OSM API 请求超时或返回 HTTP 406。可用的 Overpass 镜像仅供对照，交付数据全部来自离线 PBF。

- 以 WGS 84 的东经 121.495°、北纬 31.236° 为局部原点，东为 X 正向，南为 Z 正向。近似投影后每渲染单位约 10 米。
- 细节核心约为东经 121.4818°–121.5104°、北纬 31.2240°–31.2481°。外围扩展约为东经 121.4688°–121.5217°、北纬 31.2146°–31.2579°，保留主路和较大楼栋来延续远景。
- 离线将闭合路径和多面关系修复、裁剪、简化并去除重复轮廓，保留内环。水域合并后从地表扣除。楼栋使用整体轮廓，多数建筑分部并入整体表达。数据中保留建筑 OSM 标识、名称和原有数值标签。
- 最终本地数据包含 2,491 个建筑轮廓，其中 1,433 个与细节核心相交。71 个含高度值，761 个含楼层值，1,719 个两者均无。数据还包含 2,386 段道路和 45 个合并后的水域面。高度以 OSM 高度标签优先，其次用楼层数乘约 3.6 米。其余基于区位、轮廓和建筑类型估算。标签也可能来自估算。
- 六座地标的坐标来自对应的 OSM 建筑面质心。地标外形、普通楼栋材质、缺失高度及环境设施为程序化解释。页面运行只读取本地产物，无在线地图依赖。

数据版权归 OpenStreetMap contributors。仓库中的 [可编辑裁剪数据](../../src/experiments/shanghai-city/map.json)作为 OSM 衍生数据库按 [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) 提供。页面持续显示署名并链接到 OSM 版权页。模型、着色器和环境纹理由项目生成。[OSM 许可与署名](https://www.openstreetmap.org/copyright) · [Simple 3D Buildings 标签](https://wiki.openstreetmap.org/wiki/Simple_3D_Buildings)

复现裁剪可安装 Python 的 `osmium`、`shapely`，再运行 `python tools/shanghai/extract.py <上海快照.osm.pbf>`。使用不同日期的快照会产生不同结果。这两个库只用于离线处理。

## 地标建模依据

| 地标 | 模型特征 |
| --- | --- |
| 东方明珠 | 468 米轮廓、三支柱与斜撑、多层球体、顶部天线，夜景使用玫红球体与冷色竖向灯。 [上海市英文门户](https://english.shanghai.gov.cn/en-ScenicSpots/20231205/19a5f5184eca45728fd57a4d4c8efc61.html) · [Otis 项目资料](https://www.otis.com/en/eg/our-company/global-projects/project-showcase/oriental-pearl-tower) |
| 上海中心 | 632 米收束轮廓、逐层旋转的圆角三角截面、随视角变化的幕墙。 [上海中心](https://en.shanghaitower.com/ProjectIntroduction.html) |
| 环球金融中心 | 492 米渐缩塔身，连接两侧实体结构的顶部横梁，梯形开口可看到背后的天空。 [KPF 项目资料](https://www.kpf.com/project/shanghai-world-financial-center) |
| 金茂大厦 | 421 米塔式退台、叠置多边形塔身、竖向分割与尖顶。 [SOM 项目资料](https://www.som.com/projects/jin-mao-tower/) |
| 海关大楼 | 约 79 米钟楼、四向钟盘、古典门廊与暖光照明。 [上海市服务资讯](https://touch.shio.gov.cn/jsp/zfxw_detail.jsp?id=20250929181837586) |
| 和平饭店北楼 | 临江街角体量、Art Deco 竖线与铜绿色金字塔屋顶。 [上海市资料](https://service.shanghai.gov.cn/sheninfo/specialdetail.aspx?Id=53fcda72-b6ba-4c67-8861-d567d0257cc8) |

## 浏览器截图

| 视角 | 实际截图 |
| --- | --- |
| 全景与界面 | [蓝调全景](screenshots/city-ui.jpg) · [垂直俯瞰](screenshots/top.jpg) · [Pixel 7 模拟](screenshots/mobile.jpg) |
| 两岸互望 | [外滩望陆家嘴](screenshots/bund.jpg) · [浦东望外滩](screenshots/pudong.jpg) · [外滩建筑](screenshots/heritage.jpg) |
| 六座地标 | [东方明珠](screenshots/pearl.jpg) · [上海中心](screenshots/tower.jpg) · [环球金融中心](screenshots/finance.jpg) · [金茂大厦](screenshots/jin.jpg) · [海关](screenshots/customs.jpg) · [和平饭店](screenshots/peace.jpg) |
| 同机位时段与演出 | [清晨](screenshots/dawn.jpg) · [白昼](screenshots/day.jpg) · [黄金](screenshots/gold.jpg) · [蓝调](screenshots/blue.jpg) · [深夜](screenshots/night.jpg) · [演出完成](screenshots/show.jpg) |

首轮截图中，城市在视野边缘骤然截断，外滩照明近似轮廓描边，外滩望江机位裁掉东方明珠。后续扩大了真实数据的低细节背景，加入立面暖光和沿江错峰点亮，移动预设机位并降低倒影视差抖动。复拍确认了两岸纵深、点亮后的立面与真实贯通开口。竖屏复查发现天空被远裁剪面截出黑块，修订后将天空球随镜头定位，并补调和平饭店机位。

## 运行验收

- Vite 开发及生产实验入口均在真实 Chrome 中返回 HTTP 200。`npm run build` 通过，`npm test` 的 36 项光学断言通过。
- 桌面验证轮换机位、地标特写、旋转、平移、缩放、环视、时间滑块、自动播放与暂停、隐藏和恢复界面。完整观看灯光秀四段、返回自由观赏并再次启动。
- Pixel 7 浏览器模拟验证单指旋转、双指缩放、切换机位与界面隐藏和恢复。
- 现有现代夜城从生产入口实际点亮八关，核对自动前进、完成记录、重载后进入终局和重玩清空记录。《爱琴余晖》从生产入口完成卫城镜头切换、夜景时间切换及界面隐藏和恢复。这些是定向浏览器回归，原有 Playwright 全量套件本轮未重跑。

## 软件渲染性能

Chrome Headless 经 ANGLE SwiftShader 使用软件渲染。生产构建默认蓝调全景、动画开启，视口为 1440 × 900，自适应绘制缓冲区为 876 × 547。预热 28 帧后测量 30 个浏览器帧间隔，中位数为 237.6 ms，P90 为 287.4 ms。软件环境中的镜头运动仍会卡顿，硬件 GPU 和实体手机帧率待实测。

## 已知限制

外围保留 OSM 大型体量，远处仍可看到数据范围终止。普通楼栋夜景使用程序化窗灯，车辆与船的路径到端点后循环。江中反射使用较低分辨率并随镜头、时段或周期刷新。地标内部和测绘级复原不在范围内。网页未部署公网，公开上线前仍需核对适用的地图展示要求。
