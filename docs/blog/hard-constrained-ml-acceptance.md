# Hard-Constrained ML Blog：交付与验收

2026-10-03，修订版 17。本地候选已检查；尚未提交、推送或部署。

## 本轮交付

文章定位为框架展示与分类讨论：约 2,815 个英文词（含图注，不含参考文献），8 节正文、15 条精选参考文献、两个交互例子。

- 预测与生成图统一为短流程：每张只表达一个分类角色，桌面两列、手机单列。
- 删除正文中的具体算法多级流程、推导及可展开坐标技术细节。
- 保留 neural-network prediction、flow generation 背景图及 penalty / projection / feasible coordinates 和 rejection / projection 两个例子。
- 完整分类和方法文献分别链接 companion GitHub 的 prediction 与 generation guides。
- b、q 的定义和交互计算保持一致。导航保持 Main → News → Blog → Resources。

本地预览：[文章](http://127.0.0.1:8765/blog/hard-constrained-machine-learning/?review=17) · [Blog 列表](http://127.0.0.1:8765/blog/)。

## 当前检查

| 项目 | 结果 |
| --- | --- |
| 分类语义 | 图表达机制角色，不再代表单篇论文的完整算法；关键边界见 [framework-method-review.md](framework-method-review.md) |
| 浏览器与宽度 | Chromium、WebKit；360 / 390 / 768 / 1440 px；每套引擎 20 张框架截图 |
| 图片与页面 | 11 个活跃框架 SVG 加载正常，无标签裁切、横向溢出或页面运行错误；无 JS 框架图正常 |
| 图内间距 | 每套引擎检查 15 个 SVG，文字之间及文字与箭头的自动相交检查均为 0；桌面与手机截图另作目视检查 |
| 本地引用 | 文章和 Blog 列表的 68 个本地引用、16 个 SVG 尺寸及全部 26 个 SVG XML 通过 |
| 资源预算 | 全部新增 CSS / JS / SVG 的保守逐文件 gzip 总计 87,292 bytes，低于 200 KiB；包含未使用的旧图版本 |
| 数值与交互 | 复用修订版 15 的 8,030 项数值检查及既有交互检查；数值 JS、demo CSS、primary JSON 的 SHA-256 不变 |
| 性能 | 本轮未重测；JSON 保留修订版 12 的历史本地模拟测量，不作为本轮性能结论 |

记录与源文件 SHA-256 见 [hard-constrained-ml-acceptance.json](hard-constrained-ml-acceptance.json)。

## 保留的解释边界

Guidance 的目标改善不等于精确可行。Correction 的对象和时机影响最终输出。Parameterization 依赖允许的坐标域和可行映射，覆盖性另行考虑。Geometry-aware sampling 依赖建模的几何与适当数值更新。Training 可配合多种机制。图中四类是读者理解框架的入口，完整分类在 GitHub。

Penalty 演示是点上的二次优化问题，不训练神经网络。坐标映射 `(b*q, b*(1-q))` 保证三角形可行性。生成演示固定 square 上的 uniform proposals，比较 rejection 与 projection 的不同输出分布；静态数据、随机种子和点位置没有改变。

## 复查入口

```sh
python3 -m http.server 8765 --bind 127.0.0.1
node scripts/verify-hard-constrained-demo.mjs
playwright-cli -s=blog run-code --filename=docs/blog/qa/frameworks.js
playwright-cli -s=blog run-code --filename=docs/blog/qa/diagram-clearance.js
```

正文：`blog/hard-constrained-machine-learning/index.html`。图与生成源：`assets/img/blog/hard-constrained-ml/`。截图：已忽略的 `output/playwright/`。

未进行实体手机测试、手动 screen-reader audit 或部署后的检查。
