# Framework figures: classification overview

Revision 20 follows the current companion survey and repository, read on 5 October 2026. The blog remains an overview: short chains show mechanism roles, while GitHub holds the detailed taxonomy and literature.

| Group | Reader-facing distinction | Necessary boundary |
| --- | --- | --- |
| Prediction | Training-based approaches; structured NN layers; constraint parameterization; post-processing | Families can overlap. A projection's role depends on whether training accounts for it. |
| Prediction parameterization | Feasible combinations, feasible distributions, global feasible-set maps | The triangle illustrates the coordinate-map case. Sampling feasible points and taking their mean differ on nonconvex sets. Validity and coverage are separate. |
| Generation processes | Direct; autoregressive; diffusion and flow-based | A locally valid prefix may have no valid completion. A generated physical route and the sampler's sequence of states are different objects. |
| Training-based generation | Adapt the generator, its supervision, or its response to an inference operation | A sample estimate, rollout endpoint, and population statistic support different claims. A penalty or expectation bound does not ensure every sample is feasible. |
| Geometry-aware sampling | Reflect at boundaries or use manifold dynamics | The figure shows the manifold case. The represented geometry and numerical updates determine which requirements are preserved. |
| Constraint parameterization | Generate valid coordinates and map into feasible outputs | An approximate learned map needs validity evidence. Coverage and the resulting distribution also matter. |
| Guidance, correction, and search | Steer, repair, or select among proposals | Related operations share a top-level group. Search spends additional evaluations; finite search and objective improvement alone do not establish feasibility. |
| Combining mechanisms | Train for the inference operation or divide complementary requirements among stages | Later operations can undo earlier feasibility. Compare the complete output and budget. |

Responsible manuscript sources are `preprint/Sections/1.Intro.tex`, `Part1.tex`, `Part2.tex`, `4.Discussion.tex`, and `4.Discussion_Generation_Extension.tex` in the ACM-Survey-Submission project. The companion README and `docs/papers/prediction.md` / `generation.md` confirm the reader-facing classification and links. Exact hashes are recorded in `hard-constrained-ml-acceptance.json`.

The generation grid keeps four main viewpoints; combinations receive a short paragraph below it. Guidance and correction are examples within the grouped intervention family, rather than separate top-level categories. Training is explicitly represented. Bridge/control constructions and discrete interventions are signposted to GitHub rather than expanded into algorithm diagrams.

The two interactive examples retain their definitions and fixed data. Browser checks separately verify loading, responsive layout, subscripts, text/connector clearance, no-JavaScript display, and directory anchors. They do not establish research-method validity.
