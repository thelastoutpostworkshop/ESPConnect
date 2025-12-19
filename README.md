[<img src="https://github.com/thelastoutpostworkshop/images/blob/main/ESPConnect-github.png">](https://youtu.be/-nhDKzBxHiI)

# ESPConnect 中文版

<a href="https://www.buymeacoffee.com/thelastoutpostworkshop" target="_blank">
<img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee">
</a>

ESPConnect 是一个基于浏览器的 ESP32 和 ESP8266 系列开发板控制中心。它完全在现代 Chromium 浏览器中运行，无需安装桌面软件即可检查硬件详情、管理 SPIFFS/LittleFS/FATFS 文件、备份 Flash 和部署固件。本项目基于 Jason2866 的 [WebSerial ESPTool](https://github.com/Jason2866/WebSerial_ESPTool/tree/development)。

- [视频教程 - Original Youtube](https://youtu.be/-nhDKzBxHiI)
- [在线应用 - Original Website](https://thelastoutpostworkshop.github.io/microcontroller_devkit/espconnect/)
- [原版项目 - Original Project](https://github.com/thelastoutpostworkshop/ESPConnect)

---

## 🌐 中文翻译系统

本中文版采用了一套**无侵入式翻译系统**，具有以下特点：

### 核心优势

| 特性 | 说明 |
|------|------|
| ✅ **零源码修改** | 不修改 Vue 组件源代码，原项目更新时只需同步翻译文件 |
| ✅ **实时翻译** | 基于 MutationObserver 监听 DOM 变化，自动翻译动态内容 |
| ✅ **中英切换** | 支持一键切换中英文界面，切换按钮位于工具栏 |
| ✅ **专业术语** | 翻译遵循 ESP32/嵌入式开发领域的专业术语规范 |
| ✅ **易于维护** | 所有翻译集中在 `src/i18n/` 目录，便于更新和扩展 |

### 工作原理

```
┌─────────────────────────────────────────────────────────────┐
│                    Vue 应用渲染 DOM                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              MutationObserver 监听 DOM 变化                  │
│  • childList: 新增节点                                       │
│  • characterData: 文本内容变化                               │
│  • attributes: placeholder/title/aria-label 等属性变化       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    翻译引擎处理流程                           │
│  1. 检查是否应跳过（芯片型号、十六进制地址、版本号等）          │
│  2. 精确匹配：translations 字典查找                          │
│  3. 正则匹配：regexTranslations 模式匹配                     │
│  4. 替换文本节点或属性值                                      │
└─────────────────────────────────────────────────────────────┘
```

### 文件结构

```
src/i18n/
├── index.js          # 翻译引擎核心（MutationObserver、翻译逻辑、语言切换）
└── translations.js   # 翻译字典（静态翻译 + 正则翻译 + 跳过规则）
```

### 如何添加新翻译

#### 1. 静态文本翻译

在 `translations.js` 的 `translations` 对象中添加：

```javascript
export const translations = {
  // 格式：'英文原文': '中文翻译'
  'Device Info': '设备信息',
  'Connect': '连接',
  'Disconnect': '断开连接',
  // ... 添加更多
};
```

#### 2. 动态文本翻译（正则）

在 `regexTranslations` 数组中添加：

```javascript
export const regexTranslations = [
  // 格式：{ pattern: 正则表达式, replacement: 替换文本 }
  {
    pattern: /^(\d+)\s+files?$/,
    replacement: '$1 个文件'
  },
  {
    pattern: /^Active slot:\s*ota_(\d+)$/,
    replacement: '当前启动分区: ota_$1'
  },
  // ... 添加更多
];
```

#### 3. 跳过不翻译的内容

在 `skipPatterns` 数组中添加：

```javascript
export const skipPatterns = [
  /^ESP32/i,           // ESP 芯片型号
  /^0x[0-9A-Fa-f]+$/,  // 十六进制地址
  /^v?\d+\.\d+/,       // 版本号
  // ... 添加更多
];
```

### 同步原项目更新

当原版 ESPConnect 更新时：

1. 拉取原项目最新代码
2. 保留 `src/i18n/` 目录和 `src/main.js` 中的导入语句
3. 检查是否有新增的英文文本需要翻译
4. 运行测试确保翻译正常工作

---

## 系统要求

- Chrome、Edge、Brave、Arc 或其他基于 Chromium 89+ 的浏览器
- ESP32、ESP32-C3、ESP32-S2、ESP32-S3、ESP32-C6、ESP32-H2、ESP32-C5、ESP32-P4 或 ESP8266 开发板
- 带数据线的 USB 连接线（如果开发板没有自动复位电路，应用会引导您手动进入 Bootloader 模式）

## 快速开始

1. 打开 [ESPConnect - Original Website None Translated](https://thelastoutpostworkshop.github.io/microcontroller_devkit/espconnect/)
2. 点击 **连接**，在浏览器弹出的对话框中选择您的设备
3. 握手完成后，导航栏将解锁所有工具：设备信息、分区表、SPIFFS、应用、烧录工具、串口终端和日志
4. 需要释放 USB 端口给其他应用时，点击 **断开连接**

## 功能概览

### 设备与 Flash 感知

- **设备信息页** – 实时显示芯片系列、版本、MAC 地址、Flash 大小、晶振频率、功能特性等。未连接设备时自动显示"未连接设备"卡片
- **分区表页** – 图形化分区映射和详细的分区表，包括大小、偏移地址和未使用的 Flash 空间，便于在烧录前检查布局

### 文件系统管理器（支持 SPIFFS、LittleFS 和 FATFS）

- 浏览文件，支持即时文本过滤和分页控制
- 通过文件选择器或拖放上传；应用会检查可用空间并阻止超大文件传输
- 运行完整文件系统备份、恢复镜像或格式化分区（确认备份后）
- 本地暂存编辑，满意后点击 **写入 Flash** 提交更改
- 预览 UTF-8 文本（JSON、HTML、日志等）、内联渲染图片、播放 MP3、WAV、OGG/Opus、AAC/M4A、FLAC 和 WebM 等音频格式——无需离开浏览器
- 下载或删除单个文件，监控使用量仪表显示已用、空闲和总字节数

### OTA 分区洞察

- **应用页** – 查看应用分区/OTA 分区。显示当前活动分区及构建元数据、大小等详细信息，让您始终了解当前运行的固件和下一个待启动的固件

### Flash 与维护工作区

- **烧录固件** – 加载任意 `.bin` 文件，从常用偏移地址预设中选择，可选择擦除整片芯片，通过详细对话框查看进度
- **备份与下载** – 捕获单个分区、整个分区表、仅已使用的 Flash 区域或您指定的任意区域
- **完整性检查** – 提供偏移地址和长度计算 MD5 哈希值，快速验证设备上存储的内容
- **寄存器访问** – 使用集成的地址和描述指南直接读写硬件寄存器
- **控制操作** – 取消长时间传输、停止备份、擦除 Flash 或保存暂存的 SPIFFS 更改，具有清晰的确认和进度指示

### 实时监控与历史记录

- **串口终端页** – 流式传输 UART 输出、发送命令、清空终端、更改波特率或直接从浏览器重置开发板
- **会话日志页** – 连接、烧录、下载和警告的时间顺序记录。随时清空以获得干净的状态

## 提示与故障排除

- 如果自动进入 Boot 模式失败，按住 **BOOT**，点按 **RESET**，继续按住 **BOOT** 同时点击 **连接**，看到 ESP-ROM 标识后松开
- 同一时间只有一个应用可以使用 USB 串口桥接。连接前请关闭 Arduino IDE、PlatformIO 或其他工具
- 连接后可以更改波特率。如果传输停滞，请降至 460800 或 115200 bps
- 取消烧录或下载会安全暂停。准备好后再次运行即可

### ESP8266 兼容性
> ESP8266 设备可以连接，但支持非常有限。
> 该工具无法读取分区表或访问 SPIFFS/LittleFS，ESP32 上可用的高级功能未在 ESP8266 上实现。

## 本地运行 ESPConnect

ESPConnect 是一个**纯浏览器端 Web 应用**——无后端、无需安装，所有操作直接在浏览器中使用 Web Serial / WebUSB 进行。

### 1. 作为桌面应用运行（Electron）

请参阅[最新发布版本](https://github.com/thelastoutpostworkshop/ESPConnect/releases/latest)中的安装说明

开发模式（推荐贡献者使用 - Electron 加载 Vite 开发服务器）：
```bash
npm install
npm run dev
# 在另一个终端中：
npm run start
```

### 2. Web 应用开发模式（推荐贡献者使用）

```bash
git clone https://github.com/thelastoutpostworkshop/ESPConnect.git
cd ESPConnect
npm install
npm run dev
```

### 3. 通过 Docker 运行 ESPConnect

```bash
docker build -t espconnect .
docker run --rm -p 8080:80 espconnect
```

### 4. 本地运行构建版本（静态服务器）

步骤 1 — 构建应用
```bash
npm install
npm run build
```

步骤 2 — 提供 dist/ 文件夹服务，您可以使用以下任一选项：
> 选项 A — Node "serve"
```bash
cd dist
npx serve .
```
> 选项 B — Python 3
```bash
cd dist
python -m http.server 8080
```

## 隐私与安全

ESPConnect 完全在您的浏览器中运行——没有后端、账户或遥测。固件文件、备份和诊断信息都保存在本地，只有在您自己下载时才会移动。请始终从可信来源烧录固件。

## 许可证

ESPConnect 基于 MIT 许可证发布。完整文本请参阅 [LICENSE](LICENSE)。

---

## 致谢

- 原版项目：[ESPConnect](https://github.com/thelastoutpostworkshop/ESPConnect) by thelastoutpostworkshop
- 基础工具：[WebSerial ESPTool](https://github.com/Jason2866/WebSerial_ESPTool) by Jason2866
- 中文翻译系统：基于 MutationObserver 的无侵入式翻译方案 Powered by Claude Opus 4.5
