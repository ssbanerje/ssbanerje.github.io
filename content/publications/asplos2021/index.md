+++
featured = true
pubtype = "conference"
projects = ["compgen"]
title = "BayesPerf: Minimizing Performance Monitoring Errors Using Bayesian Statistics"
authors = "Subho S. Banerjee, Saurabh Jha, Zbigniew T. Kalbarczyk, and Ravishankar K. Iyer"
venue = "ASPLOS 2021"
date = 2021-04-19

[[links]]
 name = "DOI"
 icon = "ai ai-acmdl"
 url = "https://doi.org/10.1145/3445814.3446739"
[[links]]
 name = "arXiv"
 icon = "ai ai-arxiv"
 url = "https://arxiv.org/abs/2102.10837"

+++

Hardware performance counters (HPCs) that measure low-level architectural and microarchitectural
events provide dynamic contextual information about the state of the system. However, HPC
measurements are error-prone due to non determinism (e.g., undercounting due to event multiplexing,
or OS interrupt-handling behaviors). In this paper, we present BayesPerf, a system for quantifying
uncertainty in HPC measurements by using a domain-driven Bayesian model that captures
microarchitectural relationships between HPCs to jointly infer their values as probability
distributions. We provide the design and implementation of an accelerator that allows for
low-latency and low-power inference of the BayesPerf model for x86 and ppc64 CPUs. BayesPerf
reduces the average error in HPC measurements from 40.1% to 7.6% when events are being multiplexed.
The value of BayesPerf in real-time decision-making is illustrated with a simple example of
scheduling of PCIe transfers.
