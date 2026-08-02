# 离线启动入口

当前推荐的离线入口面向 mac 本机使用：

- 双击入口：`launchers/mac/启动拼贴系统.command`
- 启动编排器：`tools/launch_collage_web.py`

## 职责边界

- `launcher/app-shell` 只负责启动与宿主体验
- 拼贴业务逻辑继续留在 `work/collage_web/` 与 `work/collage_batch/`

当前这一层负责：

- 选择运行环境
- 选择端口
- 复用已有本地实例
- 打开浏览器
- 保存轻量启动状态

当前这一层不负责：

- 模板定义
- 渲染算法
- 项目文件语义
- 画布业务逻辑

## 后续扩展

后续如果升级成更像桌面 App 的宿主，优先复用 `tools/launch_collage_web.py` 的启动编排逻辑，不要把网页业务重新写进壳层。
