+++
title = "Intelligence Augmented Compter Systems"
date = 2018-01-01
project = "learnedsystems"
description = "A framework for intelligent control, management, and optimization of large-scale heterogeneous computer systems."
weight = 10
concluded = false
+++

Computer systems are rapidly evolving to meet the computational demands of emerging application
demands by incorporating innovations in hardware architecture, operating systems, network
interconnects, and storage, leading to increased heterogeneity. The state of the art is to
vertically integrate these systems with painstakingly built, handcrafted, average-case heuristics.
Heuristic generation is already a fundamental challenge, as variations across machine
configurations, workloads, and deployment environments can make heuristic generation painful and
costly. Moreover, we are reaching the limits of conventional approaches of generating heuristics,
which involve recurring human-expert-driven engineering efforts.

My research addresses the above challenge by providing intelligent control, management, and
optimization of large-scale heterogeneous computer systems in a fundamental way, starting with
mathematical models and ending with real software and hardware that provides efficient, scalable,
and composable system management solutions. It does so by building innovations at the intersection
of systems, machine learning (ML), and computer architecture to develop computer systems that
continuously monitor themselves, adapting both their behavior and internal models to ensure that the
users' throughput, latency, and resilience goals are met in complex, dynamic environments.

We have used those techniques to implement:
* *Policies for Automated Resource Management:* We have built several systems for performance-oriented
resource management in heterogeneous clusters.
  * We have built *[Symphony]* to schedule data-flow graphs across heterogeneous clusters containing
  multiple types of CPUs as well as accelerators like GPUs and FPGAs.
  * We have built *[FIRM]* for reallocating resources to microservices in order minimize tail
  latency and sustain SLOs.
  * We have built *[ML-LB]* to load-balance threads across multiple scheduling domains in Linux's
  Completely Fair Scheduler.
* *Policies for Automated Resilience Management:* We have built several systems for diagnosing and
correcting errors in large heterogeneous systems.
  * We have built *[BayesPerf]* for correcting measurement errors in the input telemetry data to the
  ML-controllers.
  * We have built *[Kaleidoscope]* for the diagnosis and localization of failures in large
  disaggregated storage systems.
  * We have built *[BFI]* for targeted test-case generation for fault injection campaigns to test
  the resilience of ML-controllers.
* *Enabling low-latency training and inference:* We have built several techniques to satisfy the
tight latency constraints required by these ML-controllers:
  * We have designed sampling-based [approximate inference methods][Symphony] for hybrid
  Bayesian-deep learning models.
  * We have designed [AcMC²] a high-level synthesis compiler for FPGA-based Markov chain Monte Carlo
  accelerators to target sampling-based training and inference of ML-controllers.


Moreover, applications, their computational requirements, and their ease of programming have been
essential in my research and a driving force behind the broader goals of managing, controlling, and
optimizing computer system performance using ML. For example, in my work on designing and
implementing a *workload optimized computing system for computational genomics and precision
medicine applications*
[[1](/publications/didc2016/),
[2](/publications/fpl2017/),
[3](/publications/tc2018/),
[4](/publications/cibcb2017/)].


[Symphony]: /publications/icml2020/
[FIRM]: /publications/osdi2020/
[ML-LB]: /publications/apsys2020/
[Kaleidoscope]: /publications/sc2020/
[BayesPerf]: /publications/asplos2021/
[BFI]: /publications/dsn2019/
[AcMC²]: /publications/asplos2019/
