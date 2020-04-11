+++
title = "Autonomous Vehicle Resilience"
date = 2017-10-01
project = "av"
description = "Characterizing and assessing the resilience of self-driving vehicles."
weight = 9
+++

The emergence of ML-driven systems and their ubiquitous adoption means that their trustworthiness
and dependability are now of paramount importance. Autonomous vehicle (AV) technologies are the
perfect examples of such systems and are advertised to be transformative, with the potential to
improve traffic congestion, safety, productivity, and comfort. With the increasing popularity and
ubiquitous deployment of AVs on public roads, dependability, and trustworthiness have increasingly
become critical requirements for public acceptance and adoption. A trustworthy system must be
functionally correct, robust, safe, resilient, privacy-preserving, and secure.

We have developed a suite of ML-driven techniques and associated tools for assessing resilience and
security of AVs:
* *Field-Data Assessment:* We have built *[LogDriver]* to parse and statistically analyze
disengagement and accident reports obtained from public DMV databases, thereby providing a method to
investigate the causes, dynamics, and impacts of AV failures in the wild.
* *Fault Injection:* We have built fault-selection and -injection techniques, and tools for end-to-end
reliability assessment of AVs.
  * We have built *[AVFI]*, a fault injector that targets sensor fault and failure models.
  * We have built *[BDLFI]*, a fault injector for neural network training and inference, which uses
  Bayesian deep learning to model fault propagation.
  * We have built *[BFI]*, an intelligent resiliency assessment tool that can automatically identify
  situations and faults that will likely lead to safety violations. The BFI relies on an ML-based
  fault selection engine for causal and counterfactual reasoning about the system state in terms of
  safety under a fault scenario.
* *Adversarial Attacks:* We created *[RoboTack]*, an intelligent malware that can disguise
attacks as accidental/random to evade detection, yet cause serious safety/reliability incidents
(e.g., an accident of an autonomous vehicle). The attack targets the use of adversarial examples in
the multiple object tracking process of the AV's perception pipeline.

We have used BFI and RoboTack on two industry-grade AV technology stacks: *[Drive]* (from NVIDIA) and
*[Apollo]* (from Baidu).


[LogDriver]: {{< relref "/publications/dsn2018/index.md" >}}
[AVFI]: {{< relref "/publications/dsn2018_avfi/index.md" >}}
[BFI]: {{< relref "/publications/dsn2019/index.md" >}}
[BDLFI]: {{< relref "/publications/dsn2019_bdlfi/index.md" >}}
[RoboTack]: {{< relref "/publications/dsn2020/index.md" >}}
[Drive]: https://www.nvidia.com/en-us/self-driving-cars/drive-platform/software/
[Apollo]: http://apollo.auto
