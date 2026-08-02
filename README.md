# 拼贴工具

`collage_tool/` 是当前项目的唯一建议进入点。

本项目当前提供两条本地能力：

- 透明 PNG 批处理拼贴
- 上传 PNG / JPG / HEIC 图片的本地网页工具

## 推荐起手方式

先看：

- `collage_tool/README.md`
- `collage_tool/INDEX.md`

## 快速启动

日常离线使用：

```bash
open launchers/mac/启动拼贴系统.command
```

实际双击入口：

- `launchers/mac/启动拼贴系统.command`
- `tools/launch_collage_web.py`

开发态网页模式：

```bash
/Users/lipeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 tools/launch_collage_web.py
```

兼容 CLI 网页模式：

```bash
/Users/lipeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 collage_tool/run_collage_tool.py web
```

批处理模式：

```bash
/Users/lipeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 collage_tool/run_collage_tool.py batch --input-dir /absolute/path --template print-warm
```

## 核心目录

- `work/collage_batch`：模板与渲染管线
- `work/collage_web`：网页服务与静态资源
- `launchers/`：离线双击入口与宿主层说明
- `tools/launch_collage_web.py`：离线网页启动编排器
- `tests`：CLI 与网页测试
- `collage_tool/`：聚合入口、对接文档与迭代导航
