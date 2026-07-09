# 1013V V2D Selected C Convergence With A Stability

本包是 `1013V_VISUAL_SYSTEM_POLISH_LINE` 的 V2D 视觉收敛审计包。

## 结论

```text
1013V_V2C_SELECTED_C_R97B_VISUAL_DIRECTION = PASS_WITH_NOTES
1013V_V2D_SELECTED_C_CONVERGENCE_WITH_A_STABILITY = REVIEW_READY
HUMAN_SELECTED_DIRECTION = C_NOTEBOOK_PAPER
STABILITY_REFERENCE = A_TEACHER_WORKBENCH
TOOLBAR_POLICY = KEEP_EXPANDED_BY_HUMAN_REQUEST
FORMAL_APPLY = NOT_READY
```

## 边界

- 本轮不 formal apply。
- 本轮不改 V2C 原稿，只从 V2C C 方向复制派生。
- 本轮不接 provider/model，不写数据库，不接飞书。
- 本轮不改 R21/R36/R97B/R220B 核心合同。
- 本轮保留顶部工具栏展开，因为人工审核明确要求保留。

## 本轮修改

1. 基于人工选中的 C 方向继续收敛。
2. 保留展开工具栏，但降低非主工具视觉重量。
3. 降低纸面网格和舞台背景纹理噪声。
4. 左侧备课本目录进一步降权：非当前条目更安静，当前课例保持清晰。
5. 右栏改成教师旁注式摘要，只保留“预览课堂材料 / 查看全部”两个动作。
6. 教师默认视图不暴露工程词；保留的内部数据放入 audit-only 层。

## 关键文件

- `v2d_selected_C_converged_teacher_notebook_workbench.html`
- `v2d_direction_decision.md`
- `v2d_selected_C_convergence_notes.md`
- `v2d_copy_and_visibility_rules.md`
- `source_lock.json`
- `screenshot_manifest.json`
- `visual_smoke_result.json`
- `validator_result.json`
- `screenshots/`
- `tools/capture_v2d_selected_c_smoke.cjs`
- `validator/validate_1013V_V2D_selected_C_convergence.py`

## 本地预览

```text
http://127.0.0.1:54068/outputs/1013V_VISUAL_SYSTEM_POLISH_LINE/V2D_SELECTED_C_CONVERGENCE_WITH_A_STABILITY/v2d_selected_C_converged_teacher_notebook_workbench.html?review=v2d-toolbar-kept
```

## 验证命令

```powershell
node outputs/1013V_VISUAL_SYSTEM_POLISH_LINE/V2D_SELECTED_C_CONVERGENCE_WITH_A_STABILITY/tools/capture_v2d_selected_c_smoke.cjs
python outputs/1013V_VISUAL_SYSTEM_POLISH_LINE/V2D_SELECTED_C_CONVERGENCE_WITH_A_STABILITY/validator/validate_1013V_V2D_selected_C_convergence.py --root .
```

V2D 仍是视觉审计与收敛包，不是正式上线页。
