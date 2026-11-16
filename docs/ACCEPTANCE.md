# 验收记录

更新时间：2026-11-16。本文只记录实际执行结果，不把代码已实现但未运行的项目标为通过。

## v2.0 Phase A：玩法系统与关卡设计（`feature/v2`，未发布）

范围：分光器 + 能量机制、八关主线、评分与个人最佳、存档 v2。按开发计划，公网部署保留 v1.0，待 v2 整体验收（Phase D）后再更新。

| 层级 | 检查 | 状态 | 目标 / 证据 |
| --- | --- | --- | --- |
| 本地 | TypeScript 与 Vite 生产构建 | 通过 | `npm run build`，26 个模块；主 JS 592.77 kB（gzip 153.20 kB） |
| 本地 | 反射/分光/能量规则、八关初始未通关、指定解法通关、求解器校验（每关有解、`parMoves` = 最少操作数、第 5 关多解）、重置 | 通过 | Vitest：`tests/optics.test.ts` 32 项测试全部通过 |
| 本地 Chrome | 3D 镜面投影位置直接点击 | 通过 | `tests/e2e/canvas.spec.ts`（11.3s），真实 raycast 命中并完成首关 |
| 本地 Chrome | 开始、声音开关、重置、八关完整流程（含分光双目标、能量芯片、星级与能量利用率、刷新续玩、终局 24★、重玩清档） | 通过 | `tests/e2e/desktop.spec.ts`（1.3m），控制台与页面错误为 0 |
| 本地 Chrome | 390×844 触摸：首关、下一关、分光关状态面板与双目标芯片、重置 | 通过 | `tests/e2e/mobile.spec.ts`（23.8s），错误为 0 |
| 本地 Chrome | 截图目视复查：分支颜色可区分、分光器/目标标签可读、状态面板无重叠、移动端八步进度不溢出、终局全城亮灯 | 通过 | 下方 v2 截图，逐张人工复查 |

Playwright 汇总：3 个 spec 全部通过（1.9m）。

### v2 关键截图

- [进入页（v2 文案）](screenshots/v2-intro.png)
- [第 3 关分光：主光束与两条分支](screenshots/v2-level-3-split.png)
- [第 5 关能量：五镜绕障、双路线](screenshots/v2-level-5-energy.png)
- [第 8 关嵌套分光与三目标](screenshots/v2-level-8.png)
- [全城终局 8/8 与 24★](screenshots/v2-finale.png)
- [移动端分光关状态面板](screenshots/v2-mobile-split.png)
- [移动端分光关过关评分](screenshots/v2-mobile-split-lit.png)

### Phase A 已知边界

- 存档键升级为 `light-up-the-city-v2`，v1 进度不迁移（关卡结构变化，旧进度无对应语义）。
- 除第 5 关（8 个解）外其余关卡解唯一，评分只按操作次数对照标准步数；能量利用率仅在非「基础反射」章节显示，避免在无选择关卡制造虚假评分维度。
- 难度递进依赖机制组合与路径选择，镜面数量保持 1–5 面；未做计时或步数上限等额外压力机制。
- 自动化浏览器使用软件 WebGL（SwiftShader）渲染，截图与交互结果真实，但不作为硬件 GPU 帧率基准。
- 本轮未开发编辑器与城市美术升级（Phase B/C），未更新公网部署（Phase D）。

## v1.0 验收（当前公网版本）

| 层级 | 检查 | 状态 | 目标 / 证据 |
| --- | --- | --- | --- |
| 本地 | TypeScript 与 Vite 生产构建 | 通过 | `npm run build`，25 个模块，输出 `dist/`；主 JS 585.11 kB（gzip 150.50 kB） |
| 本地 | 四关反射、初始状态、解法、阻挡与重置 | 通过 | Vitest 5.1.0：1 个测试文件、11 项测试全部通过 |
| 本地 Chrome | 3D 镜面投影位置悬停与直接点击 | 通过 | `tests/e2e/canvas.spec.ts`，真实 raycast 命中并完成首关 |
| 本地 Chrome | 开始、重置、声音、四关、下一关、刷新续玩、终局、重玩 | 通过 | `tests/e2e/desktop.spec.ts`；下方真实截图 |
| 本地 Chrome | 390×844 触摸首关、下一关与重置 | 通过 | `tests/e2e/mobile.spec.ts` |
| 依赖 | 生产与开发依赖审计 | 通过 | `npm audit`：0 vulnerabilities |
| 公网 | Qoder Sites 发布与公开访问 | 通过 | `published: true`、发布操作已提交；访问策略为 `public`，无需登录 |
| 公网 Chrome | 无登录打开、开始并完成首关 | 通过 | 独立浏览器上下文；首页 HTTP 200，首关完成存档为 `[0]`，控制台无错误 |

### v1 关键截图

- [进入页](screenshots/intro.png)
- [第一关真实光路](screenshots/level-1.png)
- [第四关与累积亮灯](screenshots/level-4.png)
- [全城终局](screenshots/finale.png)
- [移动端首关](screenshots/mobile-level-1.png)
- [公网进入页](screenshots/public-intro.png)
- [公网首关实际点亮](screenshots/public-level-1-complete.png)

公网地址：https://light-up-the-city-oqwsk12x62f.qoder.zone

## 开发过程摘要

1. 从 PRD 提取固定四关规则，将二维光路写成独立纯函数，以自动测试验证可解性。
2. 使用 Three.js 程序化生成建筑、窗户、街道、桥梁、镜面、雨滴和光效，无远程模型或贴图。
3. 完成开始、游戏、过关、终局与重玩状态机，加入本地进度、合成音效和移动端等价按钮。
4. 使用本机 Chrome/Playwright 实际操作并截图。根据截图提高建筑暗部亮度、降低窗灯与光塔过曝；根据低帧率测试修正镜头补间使用真实经过时间。
5. 分离 Vitest 与 Playwright 测试范围，升级测试依赖，最终执行生产构建、逻辑测试和真实浏览器回归。
6. v2 Phase A：在纯光路引擎中加入分光与能量单调递减规则；用穷举求解器迭代修正第 5/7/8 关的不可解布局（目标列与反射列错位、分支回打分光器归零等），最终八关全部有解且初始未通关；复用四街区美术做两关一区的渐进亮灯；真实 Chrome 走完八关与移动端分光流程。

## 通用已知边界

- 需要支持 WebGL 的现代浏览器；不支持时显示兼容性说明。
- 进度仅保存在当前浏览器，不提供云存档（PRD 范围外）。
- 声音由 Web Audio 实时合成，默认静音，需用户主动开启。
- 移动端已验证基本触摸与分光流程；主要视觉与镜头体验仍以桌面端为目标。