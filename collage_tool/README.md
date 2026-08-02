# 拼贴工具聚合入口

这里是当前项目的唯一建议进入点。

## 启动方式

mac 双击离线入口：

```bash
open launchers/mac/启动拼贴系统.command
```

真实启动编排器：

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

## 下一步建议阅读

- `collage_tool/INDEX.md`
- `collage_tool/HANDOFF.md`
- `collage_tool/ITERATION_GUIDE.md`
