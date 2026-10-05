# Hard-Constrained ML Blog：交付与验收

2026-10-05，修订版 20。本地候选已对齐最新 survey 与 companion 仓库；本轮尚未提交、推送或部署。

## 本轮更新

文章保留框架总览与分类讨论的定位，约 3,000 个英文词，8 节正文、15 条精选文献、两个交互例子。

- 预测分类采用 Training-Based Approaches、Structured NN Layers、Constraint Parameterization、Post-Processing 的统一名称；说明同一操作在不同位置的作用与训练要求。
- Parameterization 补全为 feasible combinations、feasible distributions、global feasible-set maps。三角形仍作为坐标映射的例子，不代表整个分类。
- 生成背景区分 direct、autoregressive、diffusion/flow。说明局部合法的前缀不一定有可行完成。
- Diffusion/flow 的四个图块依次是 training、geometry、parameterization、guidance/correction/search；下方简述机制组合。Detailed taxonomy、离散干预及 bridge/control 构造保留 GitHub 入口。
- 方法选择补充不依赖目标梯度的 candidate/path search；评估区分逐样本可行性、总体期望要求、目标分布与完整成本。

来源为 ACM-Survey-Submission 的 `preprint/Sections/1.Intro.tex`、`Part1.tex`、`Part2.tex`、`4.Discussion.tex`、`4.Discussion_Generation_Extension.tex`，以及 companion 仓库 README 和 prediction/generation guides。精确 SHA-256 与 companion commit 记录在 JSON。

## 当前验证

| 项目 | 结果 |
| --- | --- |
| 分类与语义 | 已对照 survey 和 companion；图保持机制层次，不展开单篇论文算法；详见 [framework-method-review.md](framework-method-review.md) |
| 页面与框架 | Chromium / WebKit，360 / 390 / 768 / 1440 px；图片加载正常，无横向溢出、公式错误或运行错误 |
| 图内清晰度 | 每套引擎 11 个活跃框架资产、15 个 SVG 间距检查；文字与文字、文字与箭头碰撞为 0；另目视检查手机和桌面截图 |
| 目录与背景 | 8 节正文及 references、独立 prediction-to-generation 背景、分类顺序和所有目录锚点通过；无 JS 可阅读 |
| 引用与资产 | 文章与 Blogs 列表的本地路径、片段 ID、SVG 原生尺寸、XML 和资源预算重新检查；准确计数见 JSON |
| 数值 | 当前版本通过 8,030 项数值检查；交互算法、公式源、静态数据和随机种子本轮没有修改 |
| 检查范围 | 此轮没有重复触屏、键盘、全站导航或加载性能测量；相关历史记录保留原修订版本 |

测试浏览器检查后关闭，避免在桌面留下自动化窗口。本地预览：[文章](http://127.0.0.1:8765/blog/hard-constrained-machine-learning/?review=20)。

## 复查入口

```sh
python3 -m http.server 8765 --bind 127.0.0.1
node scripts/verify-hard-constrained-demo.mjs
playwright-cli -s=blog run-code --filename=docs/blog/qa/frameworks.js
playwright-cli -s=blog run-code --filename=docs/blog/qa/diagram-clearance.js
playwright-cli -s=blog run-code --filename=docs/blog/qa/prediction-generation.js
```

截图位于已忽略的 `output/playwright/`。本轮编辑没有改变 Homeomorphism Methods 文章、共享 CSS、导航或主页。机器记录见 [hard-constrained-ml-acceptance.json](hard-constrained-ml-acceptance.json)。
