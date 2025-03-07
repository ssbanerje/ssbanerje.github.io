+++
featured = true
pubtype = "conference"
projects = ["learnedsystems"]
title = "AcMC²: Accelerated Markov Chain Monte Carlo for Probabilistic Models"
authors = "Subho S. Banerjee, Zbigniew T. Kalbarczyk, and Ravishankar K. Iyer"
venue = "ASPLOS 2019"
date = 2019-04-13

[[links]]
  name = "DOI"
  icon = "ai ai-acmdl"
  url = "https://dl.acm.org/citation.cfm?id=3304019"

[[links]]
  name = "Lightning Talk"
  icon = "fab fa-youtube"
  url = "https://youtu.be/3l_ZuBkZjJk"
+++

Probabilistic models (PMs) are ubiquitously used across a variety of machine learning applications.
They have been shown to successfully integrate structural prior information about data and
effectively quantify uncertainty to enable the development of more powerful, interpretable, and
efficient learning algorithms. This paper presents AcMC², a compiler that transforms PMs into
optimized hardware accelerators (for use in FPGAs or ASICs) that utilize Markov chain Monte Carlo
methods to infer and query a distribution of posterior samples from the model. The compiler analyzes
statistical dependencies in the PM to drive several optimizations to maximally exploit the
parallelism and data locality available in the problem. We demonstrate the use of AcMC² to implement
several learning and inference tasks on a Xilinx Virtex-7 FPGA. AcMC²-generated accelerators provide
a 47−100× improvement in runtime performance over a 6-core IBM Power8 CPU and a 8−18× improvement
over an NVIDIA K80 GPU. This corresponds to a 753−1600× improvement over the CPU and 248−463× over
the GPU in performance-per-watt terms.
