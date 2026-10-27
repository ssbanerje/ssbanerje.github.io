+++
title = "Autonomous Vehicle Resilience"
date = 2020-06-30
period = "2017–2020"
institution = "University of Illinois at Urbana-Champaign"
institution_key = "uiuc"
description = "Causal Bayesian fault injection, field-data analytics, and adversarial testing for autonomous vehicles."
+++

Autonomous vehicles (AVs) exemplify safety-critical, heterogeneous ML-driven
systems where perception, tracking, and control pipelines operate closed-loop in
uncertain physical environments. Validating AV dependability through road
testing or unguided random fault injection is intractable because safety-critical
hazards arise from rare conjunctions of environmental corner cases and transient
faults.

My research establishes a principled, model-guided resilience and security
assessment framework for live ML-driven systems, validated on industry-grade
[NVIDIA Drive][Drive] and [Baidu Apollo][Apollo] stacks. By capturing functional
relationships across program control flow, neural fault propagation, and
physical vehicle kinematics in dynamic probabilistic models, these tools steer
testing directly toward safety-violating states:

* *Fleet Field-Data Assessment:* *[LogDriver]* statistically analyzes over
  1.1 million autonomous miles of public California DMV disengagement and crash
  filings, showing that ML perception and control pipelines trigger 64% of human
  safety takeovers.
* *Causal & Bayesian Fault Injection:* End-to-end fault selection and injection
  across sensors, neural networks, and closed-loop driving stacks:
  * *[AVFI]* injects sensor and hardware/software faults into closed-loop
    driving simulations to test end-to-end recovery.
  * *[BDLFI]* models fault propagation through deep neural networks and
    differentiable programs via Bayesian deep learning and MCMC inference.
  * *[DriveFI]* performs causal and counterfactual Bayesian fault selection to
    mine situations and faults that violate safety envelopes, uncovering 561
    safety-critical faults in under 4 hours where weeks of random injection
    found none.
* *Timing-Targeted Adversarial Malware:* *[RoboTack]* repurposes causal fault
  selection into stealthy perception malware against multi-object tracking,
  launching adversarial perturbations only during vulnerable kinematic windows
  to trigger 32× more emergency braking than random attacks and collisions in
  52.6% of driving scenarios.

[LogDriver]: /publications/dsn2018/
[AVFI]: /publications/dsn2018_avfi/
[BDLFI]: /publications/dsn2019_bdlfi/
[DriveFI]: /publications/dsn2019/
[RoboTack]: /publications/dsn2020/
[Drive]: https://www.nvidia.com/en-us/self-driving-cars/drive-platform/software/
[Apollo]: https://apollo.auto/
