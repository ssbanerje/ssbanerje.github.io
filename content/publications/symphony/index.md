+++
pubtypes = ["paper", "featured"]
projects = ["compgen"]
title = "Inductive Bias-driven Reinforcement Learning For Efficient Schedules in Heterogeneous Clusters"
authors = "Subho S. Banerjee, Saurabh Jha and Ravishankar K. Iyer"
venue = "Preprint (In Submission)"
date = 2019-09-06

[[links]]
  name = "arXiv"
  icon = "ai ai-arxiv"
  url = "https://arxiv.org/abs/1909.02119"
+++

The problem of scheduling of workloads onto heterogeneous processors (e.g., CPUs, GPUs, FPGAs) is of fundamental
importance in modern datacenters. Most current approaches rely on building application/system-specific heuristics
that have to be reinvented on a case-by-case basis. This can be prohibitively expensive and is untenable going
forward. In this paper, we propose a domain-driven reinforcement learning (RL) model for scheduling that can be
broadly applied to a large class of heterogeneous processors. The key novelty of our approach is (i) the RL model;
and (ii) the significant reduction of training-data (using domain knowledge) and -time (using sampling based
end-to-end gradient propagation). We demonstrate the approach using real world GPU and FPGA accelerated applications
to produce scheduling policies that significantly outperform hand-tuned heuristics.
