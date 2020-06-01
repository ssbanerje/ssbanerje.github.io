+++
pubtypes = ["paper", "featured"]
projects = ["compgen"]
title = "Inductive Bias-driven Reinforcement Learning for Efficient Schedules in Heterogeneous Clusters"
authors = "Subho S. Banerjee, Saurabh Jha, and Ravishankar K. Iyer"
venue = "ICML 2020"
date = 2020-07-14

[[links]]
  name = "DOI"
  icon = "ai ai-doi"
  url = "#"

[[links]]
  name = "arXiv (old draft)"
  icon = "ai ai-arxiv"
  url = "https://arxiv.org/abs/1909.02119"
+++

The problem of scheduling of workloads onto heterogeneous processors (e.g., CPUs, GPUs, FPGAs) is of
fundamental importance in modern datacenters.  Current system schedulers rely on
application/system-specific heuristics that have to be built on a case-by-case basis.  Recent work
has demonstrated ML techniques to automate this heuristic search using black box approaches which
require significant training data and time, which make them challenging to use in practice.  This
paper addresses the challenge in two ways: (i) a domain-driven Bayesian reinforcement learning (RL)
model for scheduling, which inherently models the resource dependencies identified from the system
architecture; and (ii) a sampling-based technique which allows the computation of gradients of a
Bayesian model without performing full probabilistic inference.  Together, these techniques reduce
both the amount of training-data and -time required to produce scheduling policies that
significantly outperform black box approaches by up to 2.2×.
