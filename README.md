# DSH Composer Collapse

DSH Web GUI 对话栏（composer）的三态收起插件：**自动缩小**、**一键收起成气泡**、**完全隐藏**，全部带缓动动画和液态玻璃（liquid glass）皮肤。

不替换原生对话栏，只给它打标记 + 加动画，所以输入、快捷键、附件、语音等原有能力完全不受影响。

```
full    ── 原生对话栏（默认）
mini    ── 收起成一条 200×38 的长胶囊，点一下恢复
hidden  ── 完全隐藏，只留一条常驻召回胶囊
```

## 特性

- **三态收起**：`full` / `mini` / `hidden`，状态写入 `localStorage`，重启后保持。
- **自动缩小**：输入框为空、失去焦点约 2.2 秒后自动收成 `mini`；一聚焦、一打字立刻展开，不会打断输入。
- **预留底部带**：收起后对话栏不再压到 0 高，而是保留 54px 的透明带。消息列表在这里停住，气泡落在带内 —— **不会盖住最后一条消息**。
- **液态玻璃常开**：对话栏卡片、召唤胶囊、召回胶囊、控制簇共用同一套毛玻璃配方（`--dshcc-blur` / `--dshcc-sat` / `--dshcc-tint`），带跟随指针的镜面高光和拟态内阴影。
- **帧同步跟随**：位置每帧从对话栏的真实 `getBoundingClientRect()` 重算（不是靠 `MutationObserver` 猜），所以配合壁纸引擎（Wallpaper Engine）的 3D 视差也能逐帧对齐，并带轻微 `perspective` 倾斜。
- **避让排队消息栏**：控制簇优先落在卡片右上**外侧**，一旦那里有内容（例如排队消息栏），自动缩进卡片右上**内侧**，不重叠。
- **点消息即收起**：点对话栏上方的对话区域，自动收成气泡。
- **壁纸透传**：可清掉 `html` / `body` / 应用外壳的背景，让壁纸从毛玻璃后面透出来。
- **尊重 `prefers-reduced-motion`**：系统的减少动效偏好会关掉过渡。

## 安装

两种方式任选其一，都需要**重启 DSH 桌面应用**（Host 侧插件与客户端 bundle 只在新的一代里加载）。

### 方式 A：按路径直插（免安装，推荐）

```bash
git clone <this-repo> ~/.dsh/plugins/dsh-composer-collapse
```

在 `~/.dsh/profiles/desktop/cordis.patch.yml` **末尾**追加：

```yaml
- insert:
    - id: composer-collapse
      name: "../../plugins/dsh-composer-collapse/index.js"
      config: {}
```

### 方式 B：作为 profile bundle

把本目录放进 `~/.dsh/profiles/desktop/` 下的 `node_modules/@dsh-local/dsh-composer-collapse`（或加为 `dependencies` 后安装），然后 profile 的 `package.json` 会通过 `dsh.bundle.patch` 自动应用本仓库自带的 `cordis.patch.yml`：

```yaml
- insert:
    - id: composer-collapse
      name: '@dsh-local/dsh-composer-collapse'
      config: {}
```

## 使用

| 操作 | 方式 |
| --- | --- |
| 收起 / 展开 | 控制簇 `⌄` 按钮，或 `Ctrl+Shift+M` |
| 隐藏 / 召回 | 控制簇 `✕` 按钮，或 `Ctrl+Shift+H` |
| 点击对话区域 | 自动收起（仅在 `full` 状态） |
| 恢复 | `Esc` |

控制簇是对话栏右上角的三个玻璃小圆钮（收起 / 隐藏），悬停才显形。

## 配置

全部存在 `localStorage`，改完刷新或下次进入即生效：

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `dshcc.mode` | `full` | 当前状态：`full` / `mini` / `hidden` |
| `dshcc.auto` | `1` | `1` 开启自动缩小，`0` 关闭 |
| `dshcc.wall` | `1` | `1` 开启壁纸透传（清背景），`0` 关闭 |
| `dshcc.depth` | `1` | 3D 倾斜深度倍数，`0.2`–`2.5` |
| `dshcc.follow` | `1` | `1` 让排队消息栏跟随对话栏位移，`0` 关闭 |

例如关掉自动缩小与壁纸透传：

```js
localStorage.setItem('dshcc.auto', '0');
localStorage.setItem('dshcc.wall', '0');
location.reload();
```

## 工作原理

- 找到 `[data-composer-card]`，给它的 `parentElement` 打 `data-dshcc-root`。
- 状态写到 `[data-dshcc-root][data-dshcc-mode]`，三态全部由 CSS 过渡驱动（`max-height` / `opacity` / `transform`）。
- 状态变更**同步**写 DOM 属性并强制一次 reflow —— 后台标签页或最小化窗口里 `requestAnimationFrame` 可能永远不跑，恢复不能等它。
- 气泡的开合位置来自最近一次 `full` 状态的实测 rect，所以窗口缩放、侧栏折叠都不会让它飘走。
- 自动缩小只在「页面可见且有焦点」时触发；窗口重新获得焦点会把自动收起的气泡收回 `full`。

## 已知限制

- **壁纸引擎透视**取决于 Electron 外壳是否开了透明窗（`transparent: true` / `vibrancy`）。插件跑在渲染进程里，只能清掉 CSS 背景，**不能**强制 `BrowserWindow` 变透明；若外壳不透明，清背景只会在窗口底色上留白。
- 依赖 DSH 的两个 DOM 契约：`[data-composer-card]` 与「composer 卡片是根节点的直接子元素」。DSH 改版后如缺失，插件会静默不生效（不会报错、不会破坏原生对话栏）。
- 只做过 DSH 桌面版（Windows）实测，Web 版理论可用但未验证。

## 开发

无构建步骤，`client.js` 直接由 `window.__ModuleLoader__` 加载：

```bash
node --check client.js    # 唯一的静态检查
```

约定：

- `index.js` 是 Host 侧空壳（只导出 `name` / `apply`），真正的功能全在浏览器端。
- loader id 必须与 `package.json` 的包名一致。
- `client.js` 里只能用 `require('react')`，其余一律原生 DOM。

## 隐私与数据

这个插件**不收集任何数据**，也不访问网络：

- **不发请求**：`client.js` 里没有任何 `fetch` / `XMLHttpRequest` / `WebSocket` / `sendBeacon` 调用，不向任何服务器上报。
- **不读账户与模型信息**：不读取 DSH 的登录态、凭据、profile、会话内容、模型名、provider 配置或计费信息；只操作 DOM 与 `localStorage`。
- **不落盘、不索引对话内容**：只处理元素位置（`getBoundingClientRect`）与输入框是否为空，不读取、不缓存、不传输消息正文。
- **只存 5 个开关**：`localStorage` 里仅 `dshcc.mode` / `dshcc.auto` / `dshcc.wall` / `dshcc.depth` / `dshcc.follow`，值都是状态字符串或数字。
- **纯本地**：没有遥测、没有崩溃上报、没有第三方脚本、没有 `eval`/`new Function`、没有任何外链资源。

仓库里也不含作者的个人路径、凭据或密钥；安装时请勿把 `~/.dsh/.credentials.yaml` 之类的文件放进插件目录。

## License

MIT
