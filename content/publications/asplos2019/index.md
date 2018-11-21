+++
pubtypes = ["paper", "featured"]
projects = ["compgen"]
title = "AcMC²: Accelerated Markov Chain Monte Carlo for Probabilistic Models"
authors = "Subho S. Banerjee, Zbigniew T. Kalbarczyk and Ravishankar K. Iyer"
venue = "ASPLOS 2019"
date = 2018-11-07
+++

{{% block info %}}
To appear in [ASPLOS 2019](https://asplos-conference.org/) (13-17 April 2019).
{{% /block %}}

Probabilistic models (PMs) are ubiquitously used across a variety of machine learning applications.
They have been shown to successfully integrate structural prior information about data and
effectively quantify uncertainty to enable the development of more powerful, interpretable and
efficient learning algorithms. This paper presents AcMC², a compiler that transforms PMs into
optimized hardware accelerators (for use in FPGAs or ASICs) that utilizes Markov chain Monte Carlo
methods to infer and query a distribution of posterior samples from the model. The compiler analyzes
statistical dependencies in the PM to drive several optimizations to maximally exploit parallelism
and data locality available in the problem. We demonstrate the use of AcMC² to implement several
learning and inference tasks on a Xilinx Virtex-7 FPGA. AcMC²-generated accelerators provide a
47-100x improvement in runtime performance over a 6-core IBM Power8 CPU, further providing a
753-1600x improvement in performance-per-watt terms.
