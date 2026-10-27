+++
title = "Intelligence-Augmented Computer Systems"
date = 2021-12-06
project = "learnedsystems"
period = "2014–2021"
institution = "University of Illinois at Urbana-Champaign"
institution_key = "uiuc"
description = "Hybrid Bayesian–deep learning controllers and custom accelerators for managing heterogeneous computer systems."
+++

Modern heterogeneous computer systems integrate diverse CPUs, GPUs, FPGAs,
interconnects, and disaggregated storage using brittle, handcrafted,
average-case heuristics that must be reinvented across workloads and hardware
generations. Automating system management faces two fundamental hurdles:
*complexity* from non-linear parameter interactions across the hardware-software
stack, and *dynamics* from unpredictable shifts in workloads, multi-tenant
contention, and user goals. Pure black-box deep learning struggles in production
systems because it requires prohibitive training data and offers little
interpretability when decisions go wrong.

My research overcomes both hurdles by combining neural networks (to capture
high-dimensional system complexity) with domain-knowledge-driven Bayesian
probabilistic models of hardware and software architecture (to capture dynamics,
partial observability, and uncertainty). Jointly training and inferring these
grey-box hybrid models produces data-efficient, interpretable reinforcement
learning (RL) controllers deployed in production environments at IBM, NVIDIA,
and NCSA at UIUC:

* *Policies for Automated Resource Management:* Hybrid Bayesian-RL controllers
  that replace static heuristics across cluster, cloud, and kernel layers:
  * *[Symphony]* couples a probabilistic model of microarchitectural
    backpressure with a learned optimizer to schedule dataflow graphs across
    CPUs, GPUs, and FPGAs, outperforming black-box RL by up to 2.2×.
  * *[FIRM]* combines per-critical-path variability attribution with multilevel
    RL to reprovision microservice resources dynamically and cut tail-latency
    SLO violations by up to 16×, complemented by production *[serverless
    consolidation studies][WoSC]*.
  * *[ML-LB]* embeds low-overhead (1.9 μs) resource-aware neural inference
    directly inside the Linux Completely Fair Scheduler at 99% decision
    accuracy.
* *State Estimation & Live Resilience Management:* Treating telemetry noise and
  distributed failure propagation as first-class inference problems:
  * *[BayesPerf]* extends Linux `perf` with a microarchitecture-aware Bayesian
    model across multiplexed hardware performance counters, cutting measurement
    error by up to 5.3× at under 2% latency overhead.
  * *[Kaleidoscope]* (*SC 2020 Best Paper & Best Student Paper Finalist*) uses
    hierarchical topology-aware probabilistic models on the 25K+-node Blue
    Waters supercomputer to localize (99.3%) and disambiguate (95.8%) fail-stop,
    fail-slow, and congestion failures within one minute at under 0.01% I/O
    overhead.
  * *[CAUDIT]* captures live attack traces via honeypots and replays them for
    continuous online auditing at NCSA, blocking 57M daily SSH attacks (66×
    reduction).
* *Low-Latency Bayesian Training & Hardware Acceleration:* Moving probabilistic
  training and MCMC inference off latency-critical system paths:
  * *Approximate sampling gradients* ([Symphony]) backpropagate through
    probabilistic models without NP-hard exact inference, cutting online model
    update latency by 7.4×.
  * *[AcMC²]* is a high-level synthesis compiler and EDA flow that exploits
    marginal and conditional independencies in probabilistic programs to
    generate custom FPGA MCMC accelerators with 1–2 orders of magnitude runtime
    and performance-per-watt gains over CPUs and GPUs.

These abstractions were motivated by and co-designed with end-to-end workloads
in computational genomics and precision medicine, including distributed runtime
and custom FPGA/GPU accelerators for genome alignment and variant calling
(*[IGen]*, *[ASAP]*, *[Pair-HMM FPGA][FPL17]*, *[Pair-HMM GPU][ICCD21]*) and
longitudinal factor-graph models for psychiatric drug-response prediction
(*[CIBCB 2017 Best Paper][CIBCB17]*).

[Symphony]: /publications/icml2020/
[FIRM]: /publications/osdi2020/
[WoSC]: /publications/wosc2021/
[ML-LB]: /publications/apsys2020/
[BayesPerf]: /publications/asplos2021/
[Kaleidoscope]: /publications/sc2020/
[CAUDIT]: /publications/nsdi2019/
[AcMC²]: /publications/asplos2019/
[IGen]: /publications/didc2016/
[ASAP]: /publications/tc2018/
[FPL17]: /publications/fpl2017/
[ICCD21]: /publications/iccd2021/
[CIBCB17]: /publications/cibcb2017/
