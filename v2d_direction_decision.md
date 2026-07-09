# V2D Direction Decision

## 审核口径

V2C 三个方向中，人工选择 C：

```text
HUMAN_SELECTED_DIRECTION = C_NOTEBOOK_PAPER
```

C 的价值是保留师维备课室的独特场景感：备课本、纸面正文、目录、旁注，而不是变成通用 SaaS 工作台。

## 与 GPT 审核建议的取舍

GPT 建议继续减少顶部工具栏噪声，但人工口径明确指出：

```text
TOOLBAR_POLICY = KEEP_EXPANDED_BY_HUMAN_REQUEST
```

因此 V2D 不收起工具栏。V2D 的处理方式是：

- 工具栏继续展开。
- 主工具和辅助工具仍然可见。
- 非主工具仅降低阴影和边框重量。
- validator 明确检查工具栏展开，不允许误收。

## A 方向作为稳定参考

A 不作为主视觉方向，只作为稳定性参考：

- 正文优先。
- 低噪声。
- 教师长期使用不疲劳。
- 右栏少动作，像摘要而不是调试面板。

V2D 不是 A/C 混合重做，而是在 C 的纸面感上吸收 A 的安静程度。

## 当前结论

```text
1013V_V2D_SELECTED_C_CONVERGENCE_WITH_A_STABILITY = REVIEW_READY
FORMAL_APPLY = NOT_READY
```
