/**
 * ESPConnect 国际化翻译文件
 * 
 * 使用说明：
 * 1. 在 translations 对象中添加需要翻译的文本
 * 2. key 是英文原文（需要精确匹配），value 是中文翻译
 * 3. 支持正则匹配，使用 regexTranslations 数组
 * 
 * 当原项目更新时，只需更新此文件即可
 */

export const translations = {
  // ==================== 导航与通用 ====================
  'Sections': '功能区',
  'Resources': '资源',
  'Connect': '连接',
  'Disconnect': '断开连接',
  'Baud rate': '波特率',
  'Connected': '已连接',
  'Disconnected': '未连接',
  'A higher baudrate can be used': '可以使用更高的波特率',

  // ==================== 导航菜单项 ====================
  'Device Info': '设备信息',
  'Partitions': '分区表',
  'Apps': '应用',
  'SPIFFS Tools': 'SPIFFS 工具',
  'LittleFS Tools': 'LittleFS 工具',
  'FATFS Tools': 'FATFS 工具',
  'Flash Tools': '烧录工具',
  'Serial Monitor': '串口终端',
  'Session Log': '会话日志',
  'About': '关于',

  // ==================== 设备信息页面 ====================
  'No device connected': '未连接设备',
  'Connect to an ESP32 to see device information.': '连接 ESP32 以查看设备信息。',
  'Connect to an ESP32 to continue.': '连接 ESP32 以继续。',
  'Flash & Clock': 'Flash 与时钟',
  'Feature Set': '功能特性',
  'Crystal': '晶振',
  'Unknown': '未知',
  'capabilities': '项功能',
  'No features reported': '无功能报告',
  'No optional capabilities.': '无可选功能。',
  
  // 设备信息 - 分组标题
  'Package & Revision': '封装与版本',
  'Embedded Memory': '内置存储',
  'Security': '安全',
  'Peripherals': '外设',
  'Connection': '连接',
  'Documentation': '文档',
  
  // 设备信息 - 详细字段
  'Chip Variant': '芯片型号',
  'Revision': '芯片版本',
  'Embedded Flash': '内置 Flash',
  'Embedded PSRAM': '内置 PSRAM',
  'Flash Vendor (eFuse)': 'Flash 厂商 (eFuse)',
  'PSRAM Vendor (eFuse)': 'PSRAM 厂商 (eFuse)',
  'Flash ID': 'Flash ID',
  'Flash Manufacturer': 'Flash 制造商',
  'Flash Device': 'Flash 型号',
  'Package Form Factor': '封装形式',
  'USB Bridge': 'USB 转串口芯片',
  'Connection Baud': '当前波特率',
  'eFuse Block Version': 'eFuse 块版本',
  'PWM/LEDC': 'PWM/LEDC',
  'CPU Cores': 'CPU 核心数',
  'Max CPU Frequency': '最高主频',
  
  // 设备信息 - 安全相关
  'Flash Encryption': 'Flash 加密',
  'Flash Encryption Details': 'Flash 加密详情',
  'Flash Encryption Mode': 'Flash 加密模式',
  'Secure Boot': '安全启动',
  'Secure Boot Type': '安全启动类型',
  'JTAG Protection': 'JTAG 保护',
  'USB Protection': 'USB 保护',
  'Download-Mode Caches': '下载模式缓存',
  'Security Note': '安全说明',
  
  // 设备信息 - 文档链接
  'Hardware Reference': '硬件参考',
  'Datasheet': '数据手册',
  'Technical Reference Manual': '技术参考手册',
  'Errata': '勘误表',
  'Hardware Design Guidelines': '硬件设计指南',

  // ==================== 分区表页面 ====================
  'Partition Table': '分区表',
  'No partition data yet': '暂无分区数据',
  'Connect to an ESP32 to load its partition table (ESP8266 not supported).': 
    '连接 ESP32 以加载其分区表（不支持 ESP8266）。',
  'Unnamed': '未命名',
  'Label': '标签',
  'Type': '类型',
  'Subtype': '子类型',
  'Offset': '偏移地址',
  'Size': '大小',
  'Flags': '标志',
  'Unused': '未使用',
  'Flash Size': 'Flash 容量',
  'partition tutorial': '分区教程',
  'ESP32 partition builder': 'ESP32 分区生成器',
  'Want to customize this layout? Watch the': '想要自定义此布局？观看',
  'or open the': '或打开',
  // 分区表动态提示
  'Unused flash detected - about': '检测到未使用的 Flash - 约',
  'is reclaimable.': '可回收。',
  'See the': '查看',
  'or try the': '或尝试',
  'bytes': '字节',

  // ==================== 文件系统管理 ====================
  'SPIFFS Partition': 'SPIFFS 分区',
  'LittleFS Partition': 'LittleFS 分区',
  'FATFS Partition': 'FATFS 分区',
  'Partition': '分区',
  'Partition name': '分区名称',
  'Read Partition': '读取分区',
  'Read': '读取',
  'Backup': '备份',
  'Restore': '恢复',
  'Restore Image': '恢复镜像',
  'Format': '格式化',
  'Save Changes': '保存更改',
  'Save to Flash': '写入 Flash',
  'Upload': '上传',
  'Upload File': '上传文件',
  'Select file': '选择文件',
  'Download': '下载',
  'Delete': '删除',
  'View': '查看',
  'Listen': '播放',
  'Refresh': '刷新',
  'New Folder': '新建文件夹',
  'Folder name': '文件夹名称',
  'Create': '创建',
  'Files': '文件',
  'File Name': '文件名',
  'Name': '名称',
  'File Size': '文件大小',
  'Actions': '操作',
  'No files found': '未找到文件',
  'Loading...': '加载中...',
  'Saving...': '保存中...',
  'Usage': '使用量',
  'Used': '已使用',
  'Free': '空闲',
  'Total': '总计',
  'Read-only': '只读',
  'Cancel': '取消',
  'Confirm': '确认',
  'Close': '关闭',
  'OK': '确定',
  
  // 文件系统详细操作
  'Unsaved changes': '未保存的更改',
  'Drop files or a folder to add': '拖放文件或文件夹以添加',
  'Drop files to add': '拖放文件以添加',
  'Filter files': '过滤文件',
  'File type': '文件类型',
  'All files': '所有文件',
  'Items per page:': '每页数量:',
  'No files match the current filter': '没有文件匹配当前过滤条件',
  
  // 文件类型过滤器
  'All types': '所有类型',
  'Text': '文本',
  'Images': '图片',
  'Audio': '音频',
  'Other': '其他',
  'No files': '无文件',
  'file': '个文件',
  'files': '个文件',
  'All': '全部',  // 分页器中的"全部"
  
  // 文件系统空状态消息
  'No files detected. Upload or restore a SPIFFS image to begin.': 
    '未检测到文件。上传或恢复 SPIFFS 镜像以开始。',
  'No files detected. Upload or restore a LittleFS image to begin.': 
    '未检测到文件。上传或恢复 LittleFS 镜像以开始。',
  'No files detected. Upload or restore a FATFS image to begin.': 
    '未检测到文件。上传或恢复 FATFS 镜像以开始。',
    
  // 文件系统加载取消消息
  'SPIFFS load cancelled. Use "Read" to fetch the partition again.':
    'SPIFFS 加载已取消。使用"读取"重新获取分区。',
  'LittleFS load cancelled. Use "Read" to fetch the partition again.':
    'LittleFS 加载已取消。使用"读取"重新获取分区。',
  'FATFS load cancelled. Use "Read" to fetch the partition again.':
    'FATFS 加载已取消。使用"读取"重新获取分区。',
    
  // 文件系统只读消息
  'SPIFFS is in read-only mode. Changes cannot be saved.':
    'SPIFFS 处于只读模式。更改无法保存。',
  'LittleFS is in read-only mode. Changes cannot be saved.':
    'LittleFS 处于只读模式。更改无法保存。',
  'FATFS is in read-only mode. Changes cannot be saved.':
    'FATFS 处于只读模式。更改无法保存。',
  'Changes cannot be saved.': '更改无法保存。',
  
  // 文件系统状态消息
  'Load a SPIFFS partition to begin.': '加载 SPIFFS 分区以开始。',
  'Load a LittleFS partition to begin.': '加载 LittleFS 分区以开始。',
  'Load a FATFS partition to begin.': '加载 FATFS 分区以开始。',
  'SPIFFS is read-only.': 'SPIFFS 是只读的。',
  'LittleFS is read-only.': 'LittleFS 是只读的。',
  'FATFS is read-only.': 'FATFS 是只读的。',
  'Loading SPIFFS...': '正在加载 SPIFFS...',
  'Loading LittleFS...': '正在加载 LittleFS...',
  'Loading FATFS...': '正在加载 FATFS...',
  'Select a SPIFFS partition first.': '请先选择 SPIFFS 分区。',
  'Select a LittleFS partition first.': '请先选择 LittleFS 分区。',
  'Select a FATFS partition first.': '请先选择 FATFS 分区。',
  'Connect to a device first.': '请先连接设备。',
  'Backup downloaded. You can now save changes.': '备份已下载。现在可以写入更改。',
  'SPIFFS backup cancelled.': 'SPIFFS 备份已取消。',
  'LittleFS backup cancelled.': 'LittleFS 备份已取消。',
  'FATFS backup cancelled.': 'FATFS 备份已取消。',
  'SPIFFS backup failed.': 'SPIFFS 备份失败。',
  'LittleFS backup failed.': 'LittleFS 备份失败。',
  'FATFS backup failed.': 'FATFS 备份失败。',
  'SPIFFS image restored.': 'SPIFFS 镜像已恢复。',
  'LittleFS image restored.': 'LittleFS 镜像已恢复。',
  'FATFS image restored.': 'FATFS 镜像已恢复。',
  'Restore failed.': '恢复失败。',
  'Failed to read SPIFFS.': '读取 SPIFFS 失败。',
  'Failed to read LittleFS.': '读取 LittleFS 失败。',
  'Failed to read FATFS.': '读取 FATFS 失败。',
  'This file type cannot be previewed. Download it instead.': '此文件类型无法预览。请下载查看。',
  'Resolve blocked upload before continuing.': '请先解决上传阻塞问题再继续。',
  'Select a file to upload.': '请选择要上传的文件。',
  'Selected file has no name. Rename it and try again.': '所选文件没有名称。请重命名后重试。',
  'This filesystem is read-only.': '此文件系统为只读。',
  
  // 文件系统提示信息
  'Download a backup image first (use the "Backup" button once per session). "Save to Flash" becomes available after any successful backup made during this connection.':
    '请先下载备份镜像（每次会话使用一次"备份"按钮）。在此连接期间成功备份后，"写入 Flash"将可用。',
  'Changes are staged locally until you click "Save to Flash". A recent backup ensures you can recover if something goes wrong.':
    '更改将暂存在本地，直到您点击"写入 Flash"。最近的备份可确保出现问题时能够恢复。',
  'Changes are staged locally until you click “Save to Flash”. A recent backup ensures you can recover if something goes wrong.':
    '更改将暂存在本地，直到您点击"写入 Flash"。最近的备份可确保出现问题时能够恢复。',
  
  // Vuetify 数据表格默认文本
  'No data available': '暂无数据',
  'of': '/',
  'Items per page': '每页数量',

  // ==================== 固件烧录页面 ====================
  'Flash Backup & Erase': '固件备份与擦除',
  'Firmware tools are intended for advanced users. Writing or erasing flash can permanently remove data or render the microcontroller unbootable. Double-check settings before proceeding.':
    '固件工具仅供高级用户使用。写入或擦除 Flash 可能会永久删除数据或导致微控制器无法启动。请在操作前仔细检查设置。',
  'Download Selected Partition': '下载选定分区',
  'Download All Partitions': '下载所有分区',
  'Download Used Flash': '下载已用 Flash',
  'Start offset': '起始偏移地址',
  'Length (bytes)': '长度（字节）',
  'Download Flash Region': '下载 Flash 区域',
  'Erase Entire Flash': '擦除整片 Flash',
  'Select Firmware': '选择固件',
  'Firmware binary (.bin)': '固件文件 (.bin)',
  'Flash offset': '烧录偏移地址',
  'Recommended offsets': '推荐偏移地址',
  'Offset Presets': '偏移地址预设',
  'Erase Flash': '擦除 Flash',
  'Erase before flashing': '烧录前擦除',
  'Erase entire flash before writing': '写入前擦除整片 Flash',
  'Start Flash': '开始烧录',
  'Flash Firmware': '烧录固件',
  'Flashing...': '烧录中...',
  'Flash Progress': '烧录进度',
  'Flash Complete': '烧录完成',
  'Flash Failed': '烧录失败',
  'Cancel Flash': '取消烧录',
  'Stop': '停止',
  // 烧录提示 - 普通空格版本
  'Flashing runs at 921,600 bps by default. Drop the baud if the device struggles to sync. The serial monitor automatically switches to 115,200 bps for stability.':
    '默认使用 921,600 bps 波特率烧录。如果设备同步困难，请降低波特率。串口监视器自动切换到 115,200 bps 以保证稳定性。',
  // 烧录提示 - 不换行空格版本（HTML &nbsp; 渲染后为 \u00A0）
  'Flashing runs at 921,600\u00A0bps by default. Drop the baud if the device struggles to sync. The serial monitor automatically switches to 115,200\u00A0bps for stability.':
    '默认使用 921,600\u00A0bps 波特率烧录。如果设备同步困难，请降低波特率。串口监视器自动切换到 115,200\u00A0bps 以保证稳定性。',
  'Preparing flash...': '准备烧录中...',
  'Flash in progress': '正在烧录',
  'Flash download in progress': '正在下载 Flash',
  'Preparing download...': '准备下载中...',

  // 寄存器操作
  'Register Operations': '寄存器操作',
  'Register Access': '寄存器访问',
  'Register address': '寄存器地址',
  'Register Address': '寄存器地址',
  'Value': '值',
  'Register Value': '寄存器值',
  'Read Register': '读取寄存器',
  'Write Register': '写入寄存器',
  'Register Reference': '寄存器参考',
  'Quick-select register': '快速选择寄存器',
  'View register reference': '查看寄存器参考',
  'Open technical reference': '打开技术参考',
  'Last read value:': '上次读取值:',

  // MD5 校验
  'Flash Integrity': 'Flash 校验',
  'MD5 Checksum': 'MD5 校验',
  'MD5 checksum:': 'MD5 校验和:',
  'Compute MD5': '计算 MD5',
  'MD5 Offset': 'MD5 偏移地址',
  'MD5 Length': 'MD5 长度',
  'Selecting a partition will auto-fill the offset and length fields below.':
    '选择分区后将自动填充下方的偏移地址和长度。',

  // Flash 读取/下载
  'Download Flash': '下载固件',
  'Download Partition': '下载分区',
  'Flash Read Offset': '读取偏移地址',
  'Flash Read Length': '读取长度',
  'Read Flash': '读取 Flash',

  // ==================== 串口监视器 ====================
  'Live': '实时',
  'Stopped': '已停止',
  'Start': '开始',
  'Pause': '暂停',
  'Resume': '恢复',
  'Reset': '重置',
  'Start Monitor': '启动终端',
  'Stop Monitor': '停止终端',
  'Clear': '清空',
  'Filter output': '过滤输出',
  'Monitor output will appear here once started.': '启动后终端输出将显示在此处。',
  'Reset Board': '重置开发板',
  'Send': '发送',
  'Input command...': '输入命令...',
  'Autoscroll': '自动滚动',
  'Show timestamps': '显示时间戳',
  'Line ending': '行结束符',
  'None': '无',
  'Newline': '换行',
  'Carriage return': '回车',
  'Both NL & CR': '换行+回车',
  'Console run at 115200 bps automatically for reliable output. Flashing uses the baud rate selected in the toolbar.':
    '串口终端自动以 115200 bps 运行以确保可靠输出。烧录使用工具栏中选择的波特率。',
  'Starting the serial monitor resets the board into normal firmware mode so you can view UART output. Stopping the serial monitor automatically re-enters bootloader (stub) mode for maintenance (flash, partition tools, etc.).':
    '启动串口监视器会将开发板复位到正常固件模式以查看 UART 输出。停止串口监视器会自动重新进入 Bootloader（stub）维护模式（刷写、分区工具等）。',
  'Starting the serial monitor closes the bootloader connection, resets the board into normal firmware mode, and releases the USB port so the browser stops access once you exit. Reconnect with the main':
    '启动串口终端将关闭 Bootloader 连接，将开发板重置为正常固件模式，并释放 USB 端口，退出后浏览器将停止访问。请使用主',
  'button before running maintenance (flash, partition tools, etc.).':
    '按钮重新连接后再运行维护操作（烧录、分区工具等）。',

  // ==================== OTA 应用页面 ====================
  'Application Slots': '应用分区',
  'Active': '当前运行',
  'Active Slot': '当前启动分区',
  'Active slot:': '当前启动分区:',
  'Active slot unknown.': '当前启动分区未知。',
  'Active slot invalid.': '当前启动分区无效。',
  'factory': 'factory 分区',
  'factory (fallback)': 'factory 分区 (回退)',
  'ota_0': 'OTA_0',
  'ota_1': 'OTA_1',
  '(fallback)': '(回退)',
  'Encrypted/Invalid': '已加密/无效',
  'No application partitions detected.': '未检测到应用分区。',
  'Reading application metadata…': '正在读取应用元数据…',
  'Project': '项目名称',
  'Version': '版本',
  'Built': '编译时间',
  'IDF / Core': 'IDF / Arduino',
  'Entry address': '入口地址',
  'Segments': '段数量',
  'Application descriptor not found in first 64 KB.': '在前 64 KB 中未找到应用描述符。',
  'Encrypted or invalid image header.': '镜像头已加密或无效。',

  // ==================== 会话日志 ====================
  'Export Log': '导出日志',
  'Clear Log': '清空日志',
  'Copy to Clipboard': '复制到剪贴板',
  'Copy': '复制',
  'Copied!': '已复制！',
  'Session log copied to clipboard.': '会话日志已复制到剪贴板。',
  'Unable to copy log. Please try again.': '无法复制日志。请重试。',
  'Logs will appear here once actions begin.': '操作开始后日志将显示在此处。',

  // ==================== 关于页面 ====================
  'About ESPConnect': '关于 ESPConnect',
  'License': '许可证',
  'Source Code': '源代码',
  'Report Issue': '报告问题',
  'GitHub Repository': 'GitHub 仓库',
  'Filesystem Tools': '文件系统工具',
  'Firmware & Maintenance': '固件与维护',
  'Safety-first Workflow': '安全优先工作流',
  'Privacy & Security': '隐私与安全',
  
  // 关于页面 - 文件系统工具描述
  'SPIFFS:': 'SPIFFS:',
  'LittleFS:': 'LittleFS:',
  'FATFS:': 'FATFS:',
  
  // 关于页面内容
  'ESPConnect is a browser-based toolkit for ESP32 devices. It brings common maintenance tasks together so you can connect, inspect and update your board without installing desktop utilities.':
    'ESPConnect 是一个基于浏览器的 ESP32 设备工具包。它将常见的维护任务集成在一起，让您无需安装桌面工具即可连接、检查和更新开发板。',
  'The application talks to the device over the Web Serial API, then exposes high-level tools for firmware flashing, partition management, filesystem editing, backup/restore workflows, as well as a session log and serial monitor for troubleshooting. It is based on Jason2866\'s':
    '该应用通过 Web Serial API 与设备通信，提供固件烧录、分区管理、文件系统编辑、备份/恢复工作流等高级工具，以及用于故障排除的会话日志和串口监视器。它基于 Jason2866 的',
  'TypeScript emulator for staging changes locally before writing flash.': 
    'TypeScript 模拟器，用于在写入 Flash 前本地暂存更改。',
  'Backed by the littlefs-wasm module for true storage parity.': 
    '由 littlefs-wasm 模块支持，实现真正的存储一致性。',
  'New wasm-powered tooling for FAT partitions, mirroring your device layout.': 
    '新的 wasm 驱动工具，用于 FAT 分区，镜像您的设备布局。',
  'Drag-and-drop uploads, preview/listen for common file types, diff summaries, and mandatory backups before saving keep the workflow safe.':
    '拖放上传、常见文件类型的预览/播放、差异摘要和保存前的强制备份确保工作流程安全。',
  'Flash custom binaries with progress tracking, presets, and safety prompts.':
    '烧录自定义二进制文件，带有进度跟踪、预设和安全提示。',
  'Inspect partition tables, OTA slots, device descriptors, and flash usage at a glance.':
    '一目了然地检查分区表、OTA 分区、设备描述符和 Flash 使用情况。',
  'Serial monitor with command shortcuts and session logging for troubleshooting.':
    '带有命令快捷键和会话日志的串口终端，用于故障排除。',
  'Every destructive action is gated behind confirmation prompts and recent backups. ESPConnect keeps staged changes in-memory until you explicitly write them to flash, making it easy to review modifications or revert by re-reading the partition.':
    '每个破坏性操作都需要确认提示和最近的备份。ESPConnect 将暂存的更改保存在内存中，直到您明确将其写入 Flash，便于审查修改或通过重新读取分区来恢复。',
  'ESPConnect runs fully in your browser -- there is no backend, account, or telemetry. Firmware files, backups, and diagnostics stay local and only move when you download them yourself. Always flash firmware from trusted sources.':
    'ESPConnect 完全在您的浏览器中运行——没有后端、账户或遥测。固件文件、备份和诊断信息都保存在本地，只有在您自己下载时才会移动。请始终从可信来源烧录固件。',

  // ==================== 错误与提示信息 ====================
  'This browser does not support the Web Serial API. Use Chrome, Edge, or another Chromium-based browser.': 
    '此浏览器不支持 Web Serial API。请使用 Chrome、Edge 或其他基于 Chromium 的浏览器。',
  'Serial monitor closed — click Connect to re-enter maintenance mode.': 
    '串口终端已关闭 — 点击连接以重新进入维护模式。',
  'Connect to an ESP32 to browse and edit SPIFFS files.': 
    '连接 ESP32 设备以浏览和编辑 SPIFFS 文件。',
  'Connect to an ESP32 with a LittleFS partition to use these tools.': 
    '连接带有 LittleFS 分区的 ESP32 设备以使用这些工具。',
  'Connect to an ESP32 with a FATFS partition to use these tools.': 
    '连接带有 FATFS 分区的 ESP32 设备以使用这些工具。',
  'Connect to a device to inspect OTA application slots.': 
    '连接设备以查看 OTA 应用槽位。',
  'Connect to your board to flash firmware or inspect registers.': 
    '连接开发板以烧录固件或检查寄存器。',
  'No LittleFS files found. Read the partition or upload to begin.': 
    '未找到 LittleFS 文件。读取分区或上传文件以开始。',
  'No FATFS files found. Read the partition or upload to begin.': 
    '未找到 FATFS 文件。读取分区或上传文件以开始。',
  'PWM/LEDC capabilities are based on the chip family, not on live data read from the device.':
    'PWM/LEDC 能力基于芯片系列，而非从设备实时读取的数据。',

  // ==================== 文件系统进度对话框 ====================
  // LittleFS 对话框
  'LittleFS Backup': 'LittleFS 备份',
  'Loading LittleFS': '正在加载 LittleFS',
  'Saving LittleFS': '正在保存 LittleFS',
  'Restoring LittleFS': '正在恢复 LittleFS',
  'Preparing backup...': '正在准备备份...',
  'Writing LittleFS image...': '正在写入 LittleFS 镜像...',
  
  // FATFS 对话框
  'FATFS Backup': 'FATFS 备份',
  'Loading FATFS': '正在加载 FATFS',
  'Saving FATFS': '正在保存 FATFS',
  'Restoring FATFS': '正在恢复 FATFS',
  'Writing FATFS image...': '正在写入 FATFS 镜像...',
  
  // SPIFFS 对话框
  'SPIFFS Backup': 'SPIFFS 备份',
  'Loading SPIFFS': '正在加载 SPIFFS',
  'Saving SPIFFS': '正在保存 SPIFFS',
  'Restoring SPIFFS': '正在恢复 SPIFFS',
  'Writing SPIFFS image...': '正在写入 SPIFFS 镜像...',
  'Reading SPIFFS...': '正在读取 SPIFFS...',
  
  // 通用进度对话框
  'Reading partition data...': '正在读取分区数据...',
  'Reading partition...': '正在读取分区...',
  'Writing to flash...': '正在写入 Flash...',
  'Reading LittleFS...': '正在读取 LittleFS...',
  'Reading FATFS...': '正在读取 FATFS...',
  
  // 端口繁忙对话框
  'Port Busy': '端口繁忙',
  'Selected port is busy or in use. Close other apps or tabs using it and try again.': 
    '所选端口正被占用。请关闭正在使用该端口的其他应用程序或标签页，然后重试。',
  'If you just disconnected from another tool, wait a moment for the OS to release the port.': 
    '如果您刚从其他工具断开连接，请稍等片刻让系统释放端口。',

  // ==================== 连接过程对话框 ====================
  'Connecting': '正在连接',
  'Connecting to ESP device...': '正在连接 ESP 设备...',
  'Opening serial port...': '正在打开串口...',
  'Handshaking with ROM bootloader...': '正在与 ROM Bootloader 握手...',
  'Loading stub flasher...': '正在加载 Stub 烧写器...',
  'Getting security information...': '正在获取安全信息...',
  'Cannot read security information': '无法读取安全信息',
  'Reading Flash size...': '正在读取闪存大小...',
  'Preparing information...': '正在准备信息...',
  'Reading partition table...': '正在读取分区表...',
  
  // 连接错误对话框
  'Processing Error': '处理错误',
  'An error occurred while processing information from the device.': 
    '处理设备信息时发生错误。',
  'Last error:': '错误:',
  'Got it': '知道了',
  
  // 连接提示对话框
  'Connection Tips': '连接提示',
  'We couldn\'t communicate with the board. Try putting your ESP32 into bootloader mode:':
    '无法与开发板通信。请尝试将 ESP32 置于 Bootloader 模式：',
  'Press and hold the': '按住',
  'BOOT': 'BOOT',
  '(GPIO0) button and keep it held down.': '(GPIO0) 按钮并保持按住。',
  'Tap': '点按',
  'RESET': 'RESET',
  ', then release only the RESET button.': '，然后只松开 RESET 按钮。',
  'While still holding BOOT, click': '继续按住 BOOT，点击',
  'Release the BOOT button once the log shows the ESP-ROM banner or the connection completes.':
    '当日志显示 ESP-ROM 标识或连接完成后，松开 BOOT 按钮。',
  
  // Toast 提示信息 (右下角弹出)
  'Detected CH340 bridge; lowering baud to': '检测到 CH340 桥接芯片；为保证稳定性，已将波特率降低至',
  'bps for stability.': 'bps。',
  
  // 常见错误信息
  'Timed out waiting for packet header': '等待数据包头超时',
  'Failed to connect': '连接失败',
  'Connection failed': '连接失败',
  'Port closed': '端口已关闭',
  'Device not found': '未找到设备',
  'Permission denied': '权限被拒绝',
  'Device is busy': '设备忙碌中',

  // ==================== 对话框 ====================
  'Are you sure?': '确定吗？',
  'This action cannot be undone.': '此操作无法撤销。',
  'You have unsaved changes. Do you want to save before continuing?': 
    '您有未保存的更改。继续之前是否保存？',
  'Save': '保存',
  'Don\'t Save': '不保存',
  'Discard': '放弃',

  // ==================== 状态信息 ====================
  'Ready': '就绪',
  'Busy': '忙碌',
  'Error': '错误',
  'Success': '成功',
  'Warning': '警告',
  'Info': '信息',
  'Pending': '等待中',
  'Processing': '处理中',
  'Completed': '已完成',
  'Failed': '失败',
};

/**
 * 正则表达式翻译规则
 * 用于处理包含动态内容的文本
 * 格式: { pattern: RegExp, replacement: string | function }
 */
export const regexTranslations = [
  // 示例: "3 capabilities" -> "3 项功能"
  {
    pattern: /^(\d+)\s+capabilities$/,
    replacement: '$1 项功能'
  },
  // 示例: "+5 more" -> "+5 更多"
  {
    pattern: /^\+(\d+)\s+more$/,
    replacement: '+$1 更多'
  },
  // 示例: "Crystal 40MHz" -> "晶振 40MHz"
  {
    pattern: /^Crystal\s+(.+)$/,
    replacement: '晶振 $1'
  },
  // 示例: "Flash Size: 4MB" -> "闪存大小: 4MB"
  {
    pattern: /^Flash Size:\s*(.+)$/,
    replacement: '闪存大小: $1'
  },
  // 示例: "Used: 1.2MB" -> "已使用: 1.2MB"
  {
    pattern: /^Used:\s*(.+)$/,
    replacement: '已使用: $1'
  },
  // 示例: "Free: 2.8MB" -> "空闲: 2.8MB"
  {
    pattern: /^Free:\s*(.+)$/,
    replacement: '空闲: $1'
  },
  // CH340 波特率提示: "Detected CH340 bridge; lowering baud to 460800 bps for stability."
  {
    pattern: /^Detected CH340 bridge; lowering baud to (\d+) bps for stability\.$/,
    replacement: '检测到 CH340 桥接芯片；为保证稳定性，已将波特率降低至 $1 bps。'
  },
  // 错误信息: "Last error: xxx"
  {
    pattern: /^Last error:\s*(.+)$/,
    replacement: '最后错误: $1'
  },
  // 分区表标题: "Partitions · 8MB" -> "分区表 · 8MB"
  {
    pattern: /^Partitions\s*·\s*(.+)$/,
    replacement: '分区表 · $1'
  },
  // 未使用 Flash 提示: "Unused flash detected - about 8 MB (8,388,608 bytes) is reclaimable."
  {
    pattern: /^Unused flash detected - about (.+?) \((.+?) bytes\) is reclaimable\.$/,
    replacement: '检测到未使用的 Flash - 约 $1（$2 字节）可回收。'
  },
  // Apps页面当前启动分区: "Active slot: factory (fallback)" -> "当前启动分区: factory (回退)"
  {
    pattern: /^Active slot:\s*factory\s*\(fallback\)$/,
    replacement: '当前启动分区: factory (回退)'
  },
  // Apps页面当前启动分区: "Active slot: factory" -> "当前启动分区: factory"
  {
    pattern: /^Active slot:\s*factory$/,
    replacement: '当前启动分区: factory'
  },
  // Apps页面当前启动分区: "Active slot: ota_0" -> "当前启动分区: ota_0"
  {
    pattern: /^Active slot:\s*ota_(\d+)$/,
    replacement: '当前启动分区: ota_$1'
  },
  // Apps页面当前启动分区通用匹配: "Active slot: xxx (fallback)" 
  {
    pattern: /^Active slot:\s*(.+?)\s*\(fallback\)$/,
    replacement: '当前启动分区: $1 (回退)'
  },
  // Apps页面当前启动分区通用匹配: "Active slot: xxx"
  {
    pattern: /^Active slot:\s*(.+)$/,
    replacement: '当前启动分区: $1'
  },
  // Apps页面推断启动分区: "Active slot inferred: ota_0." -> "推断启动分区: ota_0。"
  {
    pattern: /^Active slot inferred:\s*ota_(\d+)\.$/,
    replacement: '推断启动分区: ota_$1。'
  },
  // Apps页面推断启动分区: "Active slot inferred: factory." -> "推断启动分区: factory。"
  {
    pattern: /^Active slot inferred:\s*factory\.$/,
    replacement: '推断启动分区: factory。'
  },
  // Apps页面推断启动分区通用匹配: "Active slot inferred: xxx."
  {
    pattern: /^Active slot inferred:\s*(.+)\.$/,
    replacement: '推断启动分区: $1。'
  },
  // Apps页面分区无效: "Active slot ota_0 invalid. Using ota_1." -> "当前启动分区 ota_0 无效。切换至 ota_1。"
  {
    pattern: /^Active slot\s+ota_(\d+)\s+invalid\.\s*Using\s+ota_(\d+)\.$/,
    replacement: '当前启动分区 ota_$1 无效。切换至 ota_$2。'
  },
  // Apps页面分区无效通用匹配: "Active slot xxx invalid. Using yyy."
  {
    pattern: /^Active slot\s+(.+?)\s+invalid\.\s*Using\s+(.+)\.$/,
    replacement: '当前启动分区 $1 无效。切换至 $2。'
  },
  // 分区偏移和大小: "Offset 0x10000 • Size 1.5 MB"
  {
    pattern: /^Offset\s+(0x[0-9a-fA-F]+)\s*•\s*Size\s+(.+)$/,
    replacement: '偏移 $1 • 大小 $2'
  },
  // 文件系统使用量: "Used 45% (1.2 MB / 2.8 MB)"
  {
    pattern: /^Used\s+(\d+)%\s*\((.+?)\s*\/\s*(.+?)\)$/,
    replacement: '已使用 $1%（$2 / $3）'
  },
  // 文件数量统计: "X files" -> "X 个文件"
  {
    pattern: /^(\d+)\s+files?$/,
    replacement: '$1 个文件'
  },
  // 文件夹统计: "X folders" -> "X 个文件夹"
  {
    pattern: /^(\d+)\s+folders?$/,
    replacement: '$1 个文件夹'
  },
  // "X of Y files" -> "X / Y 个文件"
  {
    pattern: /^(\d+)\s+of\s+(\d+)\s+files$/,
    replacement: '$1 / $2 个文件'
  },  
  // ==================== 文件加载数量 ====================
  // "Loaded 1 file." -> "已加载 1 个文件。"
  {
    pattern: /^Loaded (\d+) files?\.$/,
    replacement: '已加载 $1 个文件。'
  },
  
  // ==================== 恢复文件大小检查 ====================
  // "Restore file must be exactly 1.5 MB." -> "恢复文件必须正好为 1.5 MB。"
  {
    pattern: /^Restore file must be exactly (.+)\.$/,
    replacement: '恢复文件必须正好为 $1。'
  },  
  // ==================== 文件系统分区标题 ====================
  // SPIFFS 分区标题: "SPIFFS Partition · 1.5 MB" -> "SPIFFS 分区 · 1.5 MB"
  {
    pattern: /^SPIFFS Partition\s*·\s*(.+)$/,
    replacement: 'SPIFFS 分区 · $1'
  },
  // SPIFFS 分区标题 (无大小): "SPIFFS Partition" -> "SPIFFS 分区"
  {
    pattern: /^SPIFFS Partition$/,
    replacement: 'SPIFFS 分区'
  },
  // LittleFS 分区标题: "LittleFS Partition · 1.5 MB" -> "LittleFS 分区 · 1.5 MB"
  {
    pattern: /^LittleFS Partition\s*·\s*(.+)$/,
    replacement: 'LittleFS 分区 · $1'
  },
  // LittleFS 分区标题 (无大小): "LittleFS Partition" -> "LittleFS 分区"
  {
    pattern: /^LittleFS Partition$/,
    replacement: 'LittleFS 分区'
  },
  // FATFS 分区标题: "FATFS Partition · 1.5 MB" -> "FATFS 分区 · 1.5 MB"
  {
    pattern: /^FATFS Partition\s*·\s*(.+)$/,
    replacement: 'FATFS 分区 · $1'
  },
  // FATFS 分区标题 (无大小): "FATFS Partition" -> "FATFS 分区"
  {
    pattern: /^FATFS Partition$/,
    replacement: 'FATFS 分区'
  },
  
  // ==================== 文件类型过滤器带数量 ====================
  // "All types (10)" -> "所有类型 (10)"
  {
    pattern: /^All types\s*\((\d+)\)$/,
    replacement: '所有类型 ($1)'
  },
  // "Text (5)" -> "文本 (5)"
  {
    pattern: /^Text\s*\((\d+)\)$/,
    replacement: '文本 ($1)'
  },
  // "Images (3)" -> "图片 (3)"
  {
    pattern: /^Images\s*\((\d+)\)$/,
    replacement: '图片 ($1)'
  },
  // "Audio (2)" -> "音频 (2)"
  {
    pattern: /^Audio\s*\((\d+)\)$/,
    replacement: '音频 ($1)'
  },
  // "Other (1)" -> "其他 (1)"
  {
    pattern: /^Other\s*\((\d+)\)$/,
    replacement: '其他 ($1)'
  },
  
  // ==================== 文件系统空状态消息（动态） ====================
  // "No files detected. Upload or restore a SPIFFS image to begin."
  {
    pattern: /^No files detected\. Upload or restore a (SPIFFS|LittleFS|FATFS) image to begin\.$/,
    replacement: '未检测到文件。上传或恢复 $1 镜像以开始。'
  },
  
  // ==================== 文件系统加载取消消息 ====================
  // "SPIFFS load cancelled. Use "Read" to fetch the partition again."
  {
    pattern: /^(SPIFFS|LittleFS|FATFS) load cancelled\. Use "Read" to fetch the partition again\.$/,
    replacement: '$1 加载已取消。使用"读取"重新获取分区。'
  },
  
  // ==================== 文件系统只读消息 ====================
  // "SPIFFS is in read-only mode. Changes cannot be saved."
  {
    pattern: /^(SPIFFS|LittleFS|FATFS) is in read-only mode\. (.+)$/,
    replacement: '$1 处于只读模式。$2'
  },
  {
    pattern: /^(SPIFFS|LittleFS|FATFS) is in read-only mode\.$/,
    replacement: '$1 处于只读模式。'
  },
  
  // ==================== 文件系统使用量显示 ====================
  // "Used 45% (1.2 KB / 2.8 KB)" 已在上方定义
  // "Free 1.5 MB" -> "空闲 1.5 MB"
  {
    pattern: /^Free\s+(.+)$/,
    replacement: '空闲 $1'
  },
  
  // ==================== 进度对话框标签 ====================
  // "Reading partition data..." 
  {
    pattern: /^Reading partition( data)?\.{3}$/,
    replacement: '正在读取分区数据...'
  },
  // "Reading LittleFS @ 921,600 bps - 786,432 of 1,441,792 bytes" (带字节进度)
  {
    pattern: /^Reading\s+(.+?)\s*-\s*([\d,]+)\s+of\s+([\d,]+)\s+bytes$/,
    replacement: '正在读取 $1 - $2 / $3 字节'
  },
  // "Stopping read of xxx after current chunk... (xxx of xxx bytes)"
  {
    pattern: /^Stopping read of\s+(.+?)\s+after current chunk\.{3}\s*\(([\d,]+)\s+of\s+([\d,]+)\s+bytes\)$/,
    replacement: '正在停止读取 $1（等待当前块完成）... ($2 / $3 字节)'
  },
  // "Stopping LittleFS load..." -> "正在停止加载 LittleFS..."
  {
    pattern: /^Stopping\s+(SPIFFS|LittleFS|FATFS)\s+load\.{3}$/,
    replacement: '正在停止加载 $1...'
  },
  // "Reading LittleFS @ 921600 bps..." -> "正在读取 LittleFS @ 921600 bps..."
  {
    pattern: /^Reading LittleFS\s*(@\s*[\d,]+\s*bps)?\.{3}$/,
    replacement: '正在读取 LittleFS$1...'
  },
  // "Reading SPIFFS @ 921600 bps..." -> "正在读取 SPIFFS @ 921600 bps..."
  {
    pattern: /^Reading SPIFFS\s*(@\s*[\d,]+\s*bps)?\.{3}$/,
    replacement: '正在读取 SPIFFS$1...'
  },
  // "Reading FATFS @ 921600 bps..." -> "正在读取 FATFS @ 921600 bps..."
  {
    pattern: /^Reading FATFS\s*(@\s*[\d,]+\s*bps)?\.{3}$/,
    replacement: '正在读取 FATFS$1...'
  },
  // 通用 Reading xxx @ bps... 模式（分区名称，支持带逗号数字）
  {
    pattern: /^Reading\s+(.+?)\s*@\s*([\d,]+)\s*bps\.{3}$/,
    replacement: '正在读取 $1 @ $2 bps...'
  },
  // Reading SPIFFS @ 0x290000 @ 921600 bps...
  {
    pattern: /^Reading\s+(SPIFFS|LittleFS|FATFS)\s*@\s*(0x[0-9a-fA-F]+)\s*@\s*([\d,]+)\s*bps\.{3}$/,
    replacement: '正在读取 $1 @ $2 @ $3 bps...'
  },
  // "Reading xxx @ 0x290000..." -> "正在读取 xxx @ 0x290000..."
  {
    pattern: /^Reading\s+(.+?)\s*@\s*(0x[0-9a-fA-F]+)\.{3}$/,
    replacement: '正在读取 $1 @ $2...'
  },
  // "Writing xxx... 123,456 / 789,012 bytes" -> "正在写入 xxx... 123,456 / 789,012 字节"
  {
    pattern: /^Writing\s+(.+?)\.{3}\s*([\d,]+)\s*\/\s*([\d,]+)\s+bytes$/,
    replacement: '正在写入 $1... $2 / $3 字节'
  },
  
  // ==================== 文件操作提示 (tooltip) ====================
  // "Download filename.txt" -> "下载 filename.txt"
  {
    pattern: /^Download\s+(.+)$/,
    replacement: '下载 $1'
  },
  // "Delete filename.txt" -> "删除 filename.txt"
  {
    pattern: /^Delete\s+(.+)$/,
    replacement: '删除 $1'
  },
  // "View filename.txt" -> "查看 filename.txt"
  {
    pattern: /^View\s+(.+)$/,
    replacement: '查看 $1'
  },
  // "Listen filename.mp3" -> "播放 filename.mp3"  (from LittleFS previewLabel)
  {
    pattern: /^Listen\s+(.+)$/,
    replacement: '播放 $1'
  },
  // "Listen to filename.mp3" -> "播放 filename.mp3"
  {
    pattern: /^Listen to\s+(.+)$/,
    replacement: '播放 $1'
  },
  
  // 示例: "v1.0.0" 保持不变（版本号不翻译）
];

/**
 * 不需要翻译的元素选择器
 * 这些元素的内容将被跳过
 */
export const excludeSelectors = [
  'code',
  'pre',
  '.no-translate',
  '[data-no-translate]',
  '.v-icon',
  '.mdi',
  'script',
  'style',
  'noscript',
  // 设备芯片名称（如 ESP32-S3）不应被翻译
  '.device-chip-name',
  '.device-chip-alias',
  // 串口终端输出区域 - 防止翻译设备发送的原始数据
  '.monitor-terminal',
  '.monitor-terminal__output',
  '.monitor-shell pre',
];

/**
 * 不应被翻译的文本模式（正则）
 * 用于识别芯片型号等不应翻译的动态内容
 */
export const skipPatterns = [
  // ESP 芯片型号模式 - 更全面的匹配
  /^ESP32/i,
  /^ESP8266/i,
  /^ESP-/i,
  /ESP32-[A-Z]\d*/i,  // ESP32-S3, ESP32-C3, ESP32-C6 等
  /ESP32[A-Z]\d*/i,   // ESP32S3, ESP32C3 等（无连字符）
  // MAC 地址
  /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/,
  // 十六进制地址
  /^0x[0-9A-Fa-f]+$/,
  // 版本号
  /^v?\d+\.\d+/,
];

/**
 * 当前语言
 */
export let currentLanguage = localStorage.getItem('espconnect-language') || 'en';

export function setLanguage(lang) {
  currentLanguage = lang;
  localStorage.setItem('espconnect-language', lang);
}

export function getLanguage() {
  return currentLanguage;
}
