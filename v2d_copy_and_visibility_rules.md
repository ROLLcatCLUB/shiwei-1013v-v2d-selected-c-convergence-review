# V2D Copy And Visibility Rules

## 派生规则

V2D 从以下文件复制派生：

```text
outputs/1013V_VISUAL_SYSTEM_POLISH_LINE/V2C_R97B_VISUAL_HIERARCHY_AND_AESTHETIC_DIRECTION/v2c_direction_C_notebook_paper.html
```

V2D 派生文件为：

```text
outputs/1013V_VISUAL_SYSTEM_POLISH_LINE/V2D_SELECTED_C_CONVERGENCE_WITH_A_STABILITY/v2d_selected_C_converged_teacher_notebook_workbench.html
```

原稿不改，hash 由 `source_lock.json` 和 validator 记录。

## 教师默认文案规则

教师默认视图只允许出现教师能直接理解的业务词：

- 备课室
- 备课本
- 教材解析
- 进入编辑
- 小教推进
- 下游影响预览
- 课堂大屏
- 学习单
- 评价点
- 预览课堂材料
- 查看全部

教师默认视图不得出现工程/审计词：

- `preview_only`
- `formal_apply`
- `static only`
- `affected_fields`
- `downstream_dirty_fields`
- `preview_delta`
- `小教判断区`

## 内部数据保留规则

如果历史 JSON、script 或审计数据需要保留：

```html
data-audit-only="true"
aria-hidden="true"
```

这些内容不允许进入教师默认可见文本，也不允许进入默认可访问文本。

## 工具栏规则

本轮不执行“收起工具栏”的 GPT 建议。

```text
TOOLBAR_POLICY = KEEP_EXPANDED_BY_HUMAN_REQUEST
```

validator 会检查：

- 工具栏展开标记存在。
- 可见工具数不低于 10。
- 主按钮不换行。
- 主按钮图标仍是 inline SVG。
