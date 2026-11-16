# 点亮夜城 · Light Up the City

一款纯前端、程序化生成的浏览器 3D 光路解谜游戏。旋转屋顶镜面，让光塔的光束抵达目标建筑，依次唤醒四个雨夜街区。

## 在线体验

[打开 Qoder Sites 公网版本](https://light-up-the-city-oqwsk12x62f.qoder.zone)，无需登录。实际验收记录与关键截图见 [验收记录](docs/ACCEPTANCE.md)。

## 本地运行

```bash
npm ci
npm run dev
```

打开终端显示的本地地址。生产构建：`npm run build`；预览构建：`npm run preview`；逻辑测试：`npm test`。

真实 Chrome 验收：`npm run test:e2e`（自动启动开发服务器，默认使用本机 Chrome，可通过 `CHROME_PATH` 指定浏览器）。测试覆盖直接点击 3D 镜面、四关完整流程、刷新存档、重玩及移动端触摸，截图写入 `test-results/`。

## 操作

1. 点击「开始点亮」。
2. 点击场景中的镜面，或下方对应的镜面按钮，在 `/` 与 `\` 之间切换。
3. 让青色光束抵达带暖色光环的目标建筑。
4. 可拖动空白处转动视角、滚轮缩放；「重置」只重置当前关。
5. 四个街区全部点亮后可查看城市全景，并选择「再玩一次」。

声音默认关闭，点击声音按钮开启合成雨声与反馈音。进度与静音偏好仅保存在当前浏览器，无需登录。

## 技术

- Vite + TypeScript + Three.js，无后端、远程模型或贴图依赖。
- `src/game`：与渲染无关的关卡、光路和存档规则。
- `src/scene`：程序化城市、3D 交互、镜头、雨与灯光。
- `src/ui`：语义化界面与流程状态。
- `tests`：光路及关卡可解性回归测试。

协作与视觉约定见 [公共设计规范](docs/DESIGN.md) 和 [开发指南](docs/CONTRIBUTING.md)。
