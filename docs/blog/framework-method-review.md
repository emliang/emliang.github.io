# Framework figures: classification overview

Revision 17 keeps the blog at the level of frameworks and method categories. The short chains show where constraint handling acts; they do not specify the algorithms of individual papers.

| Group | Reader-facing distinction | Necessary boundary |
| --- | --- | --- |
| Prediction | Shape the predictor; train through an output operation; use feasible coordinates; correct a candidate | Roles can be combined. A training objective alone does not establish an output guarantee. |
| Base generator | Noise → iterative sampling → output | Model evaluation and numerical updates jointly construct the sample. A robot route is a complete generated object, not a sequence of sampling states. |
| Guidance | Steer the sampling update | A better objective value need not mean exact feasibility. |
| Correction | Correct a specified candidate | A sampler state, output estimate and returned sample are distinct; correction timing matters. |
| Parameterization | Valid coordinates → feasible map → output | The coordinate domain and decoder determine feasibility and coverage. |
| Geometry-aware sampling | Evolve a state using its domain or manifold | Modeled geometry and numerical updates determine which requirements are respected. |

Training is a supporting choice that can accompany several mechanisms. The four generation categories are useful examples, not the full taxonomy. The blog links the complete [prediction guide](https://github.com/emliang/Hard-Constrained-ML-Survey/blob/main/docs/papers/prediction.md) and [generation guide](https://github.com/emliang/Hard-Constrained-ML-Survey/blob/main/docs/papers/generation.md).

The two interactive examples retain their mathematical definitions and fixed data. Browser checks separately verify loading, responsive layout, subscripts, text/connector clearance and no-JavaScript display. These checks do not establish research-method validity.
