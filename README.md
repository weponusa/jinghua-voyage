# 镜花缘 · 海外奇游

取材自清代李汝珍《镜花缘》的简体中文第三人称 3D 探索游戏。随唐敖、林之洋、多九公乘船出海，游历六国风物，收集六枚镜花，登小蓬莱完成七章航程。

## 完整版本

- 七章可玩：君子国、大人国、两面国、无肠国、白民国、黑齿国、小蓬莱。
- 真实 Three.js 地形、建筑、植被与 Rapier 碰撞，唐敖骨骼蒙皮动画及 NPC 分部位动作。
- 七国独立地域风貌、手绘航海图与岛图、实时位置、任务距离、地标和游记。
- 原创动态管弦配乐、七国变奏、场景音效与对话混音。
- 章内检查点、自动保存、刷新恢复和线性章节解锁。
- 键盘、鼠标及手机横竖屏触控。

普通入口使用正式存档 `jinghua.save`。在 URL 后添加 `?test=1` 可打开七章测试模式，固定持有六枚镜花，使用独立存档 `jinghua.save.test`，不会修改正式进度。

## 操作

| 操作 | 键盘 / 鼠标 | 手机 |
| --- | --- | --- |
| 行走 | WASD 或方向键 | 左侧摇杆 |
| 转视角 | 按住鼠标拖动 | 右侧滑动 |
| 快走 / 跳跃 | Shift / 空格 | 跳跃按钮 |
| 交谈、读牌、登船 | E | 互动按钮 |
| 展开岛图 | M 或小地图按钮 | 小地图按钮 |
| 航海图 | 右上航海图按钮 / 甲板图桌 | 同左 |
| 暂停 | Esc | 暂停按钮 |

## 本地开发

需要 Node.js 22 和 pnpm 10。

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm preview
```

生产文件输出到 `dist/`。Vite 使用相对资源路径，可部署到域名根目录或 GitHub Pages 项目子路径。

## 自动部署

`.github/workflows/deploy-pages.yml` 在主分支推送后安装依赖、执行生产构建，并将 `dist/` 发布到 GitHub Pages。仓库 Settings → Pages 的 Source 选择 GitHub Actions。

## 主要结构

- `src/game/chapters/`：海船与七章场景、任务和剧情。
- `src/game/voyage.ts`：场景切换、交互、导航与进度闭环。
- `src/engine/`：输入、音频、物理、渲染、存档与固定步长循环。
- `src/ui/`：航海图、岛图、对话和触屏界面。
- `assets/models/`：正式运行用压缩模型。
- `public/audio/`：本地管弦采样及许可。
- `public/interface/`：航海图、岛图和 HUD 缩图。

历史构建、验收截图、源模型和生成候选不进入发布仓库。验收脚本位于 `scripts/`，包括完整通关、刷新恢复、手机地图、视觉和上线专项检查。

## Credits

原著：清·李汝珍《镜花缘》。人物、建筑及地域植物含本地 Blender 制作和 AI 辅助生成资产；自然景物部分沿用 Kenney Nature Kit（CC0）。管弦采样使用 FluidR3（CC BY 3.0），许可与署名见 `public/audio/`。字体 ManusCC0 Sans CJK SC（CC0），许可在 `public/fonts/`。Three.js（MIT）、Rapier（Apache-2.0）。
